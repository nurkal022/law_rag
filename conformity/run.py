"""
Прогон: все действующие акты корпуса по ярусам иерархии, каждая норма — через
analyze_norm, результат — в conformity_findings, ход обхода — в conformity_run_acts.

Возобновляемость по (run_id, chunk_id): прерванный прогон (деплой, обрыв) при
следующем запуске продолжает с места остановки. Модель и индекс не трогают базу,
поэтому анализ идёт в пуле потоков, а записывает главный поток пачками.
"""
from __future__ import annotations

import hashlib
import re
import secrets
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from typing import Callable, Dict, List, Optional, Tuple

from .analyze import AnalyzeConfig, Norm, analyze_norm
from .changes import _PATH as CHANGES_PATH, load_changes, validate
from .constitution import ConstitutionIndex
from .finding import Finding
from .registry import ActMeta, load_registry

BATCH = 25
_ARTICLE = re.compile(r'^Статья\s+([\d\-]+)\.?\s*(.*)$')
EMPTY_COUNTS = {'0': 0, '1': 0, '2': 0, '3': 0, 'errors': 0}


def changes_version(path: str = CHANGES_PATH) -> str:
    with open(path, 'rb') as f:
        return hashlib.sha1(f.read()).hexdigest()[:12]


def plan_acts(registry) -> List[Tuple['Document', ActMeta]]:  # noqa: F821
    """Действующие акты корпуса, известные реестру, кроме самой Конституции, в порядке ярусов."""
    from database.models import Document
    out = []
    for doc in Document.query.filter(Document.retired_at.is_(None)).all():
        meta = registry.act(doc.filename)
        if meta is None or meta.tier == 1 or meta.retired:
            continue
        out.append((doc, meta))
    out.sort(key=lambda p: (p[1].tier, p[1].code, p[0].title or ''))
    return out


def constitution_document(registry) -> 'Document':  # noqa: F821
    from database.models import Document
    for doc in Document.query.filter(Document.retired_at.is_(None)).all():
        meta = registry.act(doc.filename)
        if meta and meta.tier == 1 and not meta.retired:
            return doc
    raise LookupError('в корпусе нет действующей Конституции (ярус 1 в conformity/acts.yaml)')


def load_norms(document_id: int, act_title: str) -> List[Norm]:
    from database.models import DocumentChunk
    rows = DocumentChunk.query.filter_by(document_id=document_id).order_by(DocumentChunk.chunk_index).all()
    norms = []
    for row in rows:
        no, title = '', ''
        for line in row.content.split('\n'):
            m = _ARTICLE.match(line.strip())
            if m:
                no, title = m.group(1), line.strip()
                break
        norms.append(Norm(chunk_id=row.id, document_id=document_id, act_title=act_title, article_no=no,
                          article_title=title or f'Фрагмент {row.chunk_index}', text=row.content,
                          vector=row.get_embedding()))
    return norms


def _count(findings) -> Dict[str, int]:
    counts = dict(EMPTY_COUNTS)
    for f in findings:
        if f.level is None:
            counts['errors'] += 1
        else:
            counts[str(f.level)] += 1
    return counts


def recount(run) -> None:
    """Счётчики прогона и его актов — из базы, а не из памяти: так они верны и после возобновления."""
    from database.models import ConformityFinding, ConformityRunAct, db
    from sqlalchemy import func
    acts = ConformityRunAct.query.filter_by(run_id=run.id).all()
    rows = ConformityFinding.query.filter_by(run_id=run.id).with_entities(
        ConformityFinding.document_id, ConformityFinding.level, ConformityFinding.tokens).all()
    per_doc: Dict[int, list] = {}
    for doc_id, level, tokens in rows:
        per_doc.setdefault(doc_id, []).append((level, tokens))
    total = dict(EMPTY_COUNTS)
    total_tokens = 0
    for a in acts:
        mine = per_doc.get(a.document_id, [])
        counts = dict(EMPTY_COUNTS)
        for level, tokens in mine:
            counts['errors' if level is None else str(level)] += 1
            total_tokens += tokens or 0
        a.counts_json = counts
        a.norms_done = len(mine)
        a.tokens = sum(t or 0 for _, t in mine)
        for k in total:
            total[k] += counts[k]
    run.counts_json = total
    run.norms_done = len(rows)
    run.tokens_used = total_tokens
    db.session.commit()


def _to_row(run, norm: Norm, f: Finding):
    from database.models import ConformityFinding
    return ConformityFinding(
        run_id=run.id, document_id=norm.document_id, chunk_id=norm.chunk_id,
        article_no=norm.article_no, article_title=norm.article_title[:500],
        level=f.level, category=f.category, method=f.method,
        constitution_articles_json=f.constitution_articles, change_ids_json=f.change_ids,
        quote_norm=f.quote_norm, explanation=f.explanation, recommendation=f.recommendation,
        model=f.model, tokens=f.tokens, error=f.error or '',
    )


def run_conformity(app, provider=None, threads: int = 6, resume: bool = True, retry_errors: bool = False,
                   only: Optional[List[str]] = None, limit: Optional[int] = None,
                   log: Callable[..., None] = print):
    from database.models import ConformityFinding, ConformityRun, ConformityRunAct, db

    with app.app_context():
        registry = load_registry()
        cfg = AnalyzeConfig(
            triage_model=app.config.get('CONFORMITY_TRIAGE_MODEL') or __import__('config').Config.CONFORMITY_TRIAGE_MODEL,
            verify_model=app.config.get('CONFORMITY_VERIFY_MODEL') or __import__('config').Config.CONFORMITY_VERIFY_MODEL,
            top_articles=int(app.config.get('CONFORMITY_TOP_ARTICLES') or __import__('config').Config.CONFORMITY_TOP_ARTICLES),
        )
        if provider is None:
            from llm_providers.factory import LLMProviderFactory
            provider = LLMProviderFactory.get_current_provider()

        const = constitution_document(registry)
        index = ConstitutionIndex.from_document(const.id)
        cs = load_changes()
        validate(cs, index.texts)

        run = None
        if resume:
            latest = ConformityRun.query.filter_by(constitution_document_id=const.id) \
                .order_by(ConformityRun.started_at.desc())
            run = latest.filter_by(status='running').first() or (latest.first() if retry_errors else None)
            if run is not None and run.status == 'done':
                run.status, run.finished_at = 'running', None   # добиваем ошибки в завершённом прогоне
        if run is None:
            run = ConformityRun(public_id=secrets.token_hex(8), status='running', constitution_document_id=const.id,
                                triage_model=cfg.triage_model, verify_model=cfg.verify_model,
                                changes_version=changes_version(), counts_json=dict(EMPTY_COUNTS))
            db.session.add(run)
            db.session.commit()
            log(f'прогон {run.public_id}: Конституция «{const.title}», модели {cfg.triage_model} / {cfg.verify_model}')
        else:
            log(f'продолжаю прогон {run.public_id}')

        acts = plan_acts(registry)
        if only:
            acts = [(d, m) for d, m in acts if d.filename in set(only)]
        run.norms_total = sum(d.chunks.count() for d, _ in acts)
        db.session.commit()

        for position, (doc, meta) in enumerate(acts):
            act = ConformityRunAct.query.filter_by(run_id=run.id, document_id=doc.id).first()
            if act is None:
                act = ConformityRunAct(run_id=run.id, document_id=doc.id, position=position, tier=meta.tier,
                                       code=meta.code, norms_total=doc.chunks.count(), counts_json=dict(EMPTY_COUNTS))
                db.session.add(act)
            act.position = position   # порядок обхода — всегда по плану, даже после пробного запуска
            if act.started_at is None:
                act.started_at = datetime.utcnow()
            db.session.commit()

            done_q = ConformityFinding.query.filter_by(run_id=run.id, document_id=doc.id)
            if retry_errors:
                done_q.filter(ConformityFinding.level.is_(None)).delete(synchronize_session=False)
                db.session.commit()
            done_ids = {cid for (cid,) in done_q.with_entities(ConformityFinding.chunk_id).all()}
            norms = [n for n in load_norms(doc.id, doc.title or meta.code) if n.chunk_id not in done_ids]
            if limit is not None:
                norms = norms[:limit]
            log(f'[{meta.tier}] {meta.code}: норм {act.norms_total}, к разбору {len(norms)}')
            if not norms and act.finished_at is not None:
                continue   # акт уже пройден целиком: время обхода не трогаем
            act.finished_at = None
            db.session.commit()

            def work(n: Norm) -> Tuple[Norm, Finding]:
                try:
                    return n, analyze_norm(n, index, cs, provider, cfg)
                except Exception as e:  # noqa: BLE001
                    return n, Finding(level=None, method='model', error=str(e)[:300])

            pending = 0
            with ThreadPoolExecutor(max_workers=max(1, threads)) as pool:
                for n, f in pool.map(work, norms):
                    db.session.add(_to_row(run, n, f))
                    pending += 1
                    if pending >= BATCH:
                        db.session.commit()
                        recount(run)
                        pending = 0
                        log(f'    {meta.code}: {act.norms_done}/{act.norms_total}, найдено {act.counts_json["2"] + act.counts_json["3"]}')
            db.session.commit()
            recount(run)
            if limit is None:
                act.finished_at = datetime.utcnow()
            db.session.commit()
            log(f'    {meta.code} готов: {act.counts_json}')

        recount(run)
        if limit is None and run.norms_done >= run.norms_total:
            run.status = 'done'
            run.finished_at = datetime.utcnow()
        db.session.commit()
        log(f'итог: {run.status}, норм {run.norms_done}/{run.norms_total}, {run.counts_json}, токенов {run.tokens_used}')
        return run
