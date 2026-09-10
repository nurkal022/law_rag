"""
Результаты прогона соответствия Конституции 2026 — только чтение, открыто гостям.

Витрина: раздел показывает, как агент прошёл акты и что нашёл. Персональных
данных здесь нет, поэтому входа не требуется; писать сюда нечем — прогон
запускается скриптом.
"""
from __future__ import annotations

from collections import defaultdict
from typing import Dict, List

from flask import jsonify, request

from conformity.changes import load_changes
from conformity.constitution import ConstitutionIndex
from conformity.registry import load_registry
from conformity.wording import LEVELS, category_label, wording
from database.models import ConformityFinding, ConformityRun, ConformityRunAct, Document, DocumentChunk, db

from . import constitution_bp

LANGS = ('ru', 'kk', 'en')


def _err(message: str, code: int = 404, kind: str = 'not_found'):
    return jsonify({'success': False, 'error': kind, 'message': message}), code


def _latest_run():
    return ConformityRun.query.filter(ConformityRun.status.in_(('running', 'done'))) \
        .order_by(ConformityRun.started_at.desc()).first()


def _wording(level):
    return {lang: wording(level, lang) for lang in LANGS} if level is not None else None


def _act_payload(doc: Document, meta) -> dict:
    return {
        'document_id': doc.id, 'title': doc.title, 'code': meta.code if meta else doc.title,
        'tier': meta.tier if meta else None, 'adilet': meta.adilet if meta else '',
        'edition': meta.edition if meta else '', 'url': meta.url if meta else '',
    }


def _finding_payload(f: ConformityFinding) -> dict:
    out = f.to_dict()
    out['wording'] = _wording(f.level)
    out['category_label'] = {lang: category_label(f.category, lang) for lang in LANGS}
    return out


def _flagged(run) -> List[ConformityFinding]:
    return ConformityFinding.query.filter(ConformityFinding.run_id == run.id, ConformityFinding.level >= 1).all()


def _worst(levels) -> int:
    return max([lv for lv in levels if lv is not None], default=0)


@constitution_bp.route('/overview')
def overview():
    run = _latest_run()
    registry = load_registry()
    cs = load_changes()
    if run is None:
        return jsonify({'success': True, 'run': None, 'walk': [], 'tiers': [
            {'tier': t, 'title': {lang: registry.tier_title(t, lang) for lang in LANGS}, 'acts': []}
            for t in sorted(registry.tiers)], 'constitution': None, 'changes': [
            {'id': c.id, 'kind': c.kind, 'title': c.title, 'summary': c.summary,
             'old_articles': c.old_articles, 'new_articles': c.new_articles,
             'old_quote': c.old_quote, 'new_quote': c.new_quote, 'norms': 0} for c in cs.changes],
            'current': None})

    acts = ConformityRunAct.query.filter_by(run_id=run.id).order_by(ConformityRunAct.position).all()
    flagged = _flagged(run)

    per_article: Dict[int, list] = defaultdict(list)
    per_change: Dict[str, int] = defaultdict(int)
    for f in flagged:
        for n in f.constitution_articles_json or []:
            per_article[int(n)].append(f.level)
        for cid in f.change_ids_json or []:
            per_change[cid] += 1

    tiers = []
    by_tier: Dict[int, list] = defaultdict(list)
    for a in acts:
        by_tier[a.tier].append({
            'document_id': a.document_id, 'code': a.code, 'title': a.document.title if a.document else '',
            'norms': a.norms_total, 'done': a.norms_done, 'counts': a.counts_json or {},
            'worst': _worst(int(k) for k, v in (a.counts_json or {}).items() if k.isdigit() and v),
        })
    for t in sorted(registry.tiers):
        tiers.append({'tier': t, 'title': {lang: registry.tier_title(t, lang) for lang in LANGS}, 'acts': by_tier.get(t, [])})

    index = ConstitutionIndex.from_document(run.constitution_document_id)
    sections = []
    for s in index.sections():
        sections.append({'no': s['no'], 'title': s['title'], 'articles': [
            {'no': n, 'norms': len(per_article.get(n, [])), 'worst': _worst(per_article.get(n, []))} for n in s['articles']]})

    current = None
    if run.status == 'running':
        last = ConformityFinding.query.filter_by(run_id=run.id).order_by(ConformityFinding.id.desc()).first()
        if last is not None:
            act = next((a for a in acts if a.document_id == last.document_id), None)
            current = {'document_id': last.document_id, 'code': act.code if act else '', 'article_no': last.article_no}

    return jsonify({
        'success': True,
        'run': run.to_dict(),
        'walk': [a.to_dict() for a in acts],
        'tiers': tiers,
        'constitution': {'document_id': run.constitution_document_id, 'sections': sections},
        'changes': [{'id': c.id, 'kind': c.kind, 'title': c.title, 'summary': c.summary,
                     'old_articles': c.old_articles, 'new_articles': c.new_articles,
                     'old_quote': c.old_quote, 'new_quote': c.new_quote, 'norms': per_change.get(c.id, 0)}
                    for c in cs.changes],
        'current': current,
    })


@constitution_bp.route('/acts/<int:document_id>')
def act(document_id: int):
    run = _latest_run()
    doc = db.session.get(Document, document_id)
    if run is None or doc is None:
        return _err('Акт не найден')
    meta = load_registry().act(doc.filename)
    rows = ConformityFinding.query.filter_by(run_id=run.id, document_id=doc.id) \
        .join(DocumentChunk, DocumentChunk.id == ConformityFinding.chunk_id) \
        .order_by(DocumentChunk.chunk_index).all()
    if not rows and meta is None:
        return _err('Акт не найден')

    articles = [{'chunk_id': f.chunk_id, 'article_no': f.article_no, 'title': f.article_title, 'level': f.level,
                 'category': f.category, 'finding_id': f.id if (f.level or 0) >= 1 else None} for f in rows]

    level = request.args.get('level', type=int)
    category = request.args.get('category')
    flagged = [f for f in rows if (f.level or 0) >= 1]
    if level in LEVELS:
        flagged = [f for f in flagged if f.level == level]
    if category:
        flagged = [f for f in flagged if f.category == category]
    flagged.sort(key=lambda f: (-(f.level or 0), rows.index(f)))

    run_act = ConformityRunAct.query.filter_by(run_id=run.id, document_id=doc.id).first()
    return jsonify({
        'success': True, 'run': run.to_dict(),
        'act': {**_act_payload(doc, meta), 'norms': len(rows), 'counts': (run_act.counts_json if run_act else {}),
                'started_at': run_act.started_at.isoformat() if run_act and run_act.started_at else None,
                'finished_at': run_act.finished_at.isoformat() if run_act and run_act.finished_at else None},
        'articles': articles,
        'findings': [_finding_payload(f) for f in flagged],
    })


@constitution_bp.route('/findings/<int:finding_id>')
def finding(finding_id: int):
    f = db.session.get(ConformityFinding, finding_id)
    if f is None:
        return _err('Находка не найдена')
    run = db.session.get(ConformityRun, f.run_id)
    chunk = db.session.get(DocumentChunk, f.chunk_id)
    doc = db.session.get(Document, f.document_id)
    index = ConstitutionIndex.from_document(run.constitution_document_id)
    cs = load_changes()
    payload = _finding_payload(f)
    payload['norm_text'] = chunk.content if chunk else ''
    payload['act'] = _act_payload(doc, load_registry().act(doc.filename)) if doc else None
    payload['articles'] = [{'no': a.no, 'section': {'no': a.section_no, 'title': a.section_title}, 'text': a.text}
                           for a in (index.article(n) for n in f.constitution_articles_json or []) if a]
    payload['changes'] = [{'id': c.id, 'kind': c.kind, 'title': c.title, 'summary': c.summary,
                           'old_articles': c.old_articles, 'new_articles': c.new_articles,
                           'old_quote': c.old_quote, 'new_quote': c.new_quote}
                          for c in (cs.by_id(cid) for cid in f.change_ids_json or []) if c]
    return jsonify({'success': True, 'finding': payload})


@constitution_bp.route('/articles/<int:no>')
def article(no: int):
    run = _latest_run()
    if run is None:
        return _err('Прогона ещё не было')
    index = ConstitutionIndex.from_document(run.constitution_document_id)
    a = index.article(no)
    if a is None:
        return _err('Статьи с таким номером нет')
    cs = load_changes()
    registry = load_registry()
    touching = [f for f in _flagged(run) if no in (f.constitution_articles_json or [])]
    touching.sort(key=lambda f: -(f.level or 0))
    docs = {d.id: d for d in Document.query.filter(Document.id.in_({f.document_id for f in touching})).all()} if touching else {}
    norms = []
    for f in touching:
        d = docs.get(f.document_id)
        norms.append({**_finding_payload(f), 'act': _act_payload(d, registry.act(d.filename)) if d else None})
    return jsonify({'success': True, 'article': {
        'no': a.no, 'section': {'no': a.section_no, 'title': a.section_title}, 'text': a.text,
        'was': [{'id': c.id, 'kind': c.kind, 'title': c.title, 'summary': c.summary,
                 'old_articles': c.old_articles, 'old_quote': c.old_quote, 'new_quote': c.new_quote}
                for c in cs.changes if no in c.new_articles],
        'norms': norms,
    }})


@constitution_bp.route('/changes')
def changes():
    run = _latest_run()
    cs = load_changes()
    per_change: Dict[str, int] = defaultdict(int)
    if run is not None:
        for f in _flagged(run):
            for cid in f.change_ids_json or []:
                per_change[cid] += 1
    return jsonify({'success': True, 'changes': [
        {'id': c.id, 'kind': c.kind, 'title': c.title, 'summary': c.summary, 'old_articles': c.old_articles,
         'new_articles': c.new_articles, 'old_quote': c.old_quote, 'new_quote': c.new_quote,
         'norms': per_change.get(c.id, 0)} for c in cs.changes]})
