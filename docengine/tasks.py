"""
Обработчики фоновых задач движка.

Модуль импортируется при запуске приложения ради побочного эффекта:
регистрации обработчиков в очереди. Держать их рядом с маршрутами нельзя —
воркер работает отдельным процессом и веб-слой не поднимает.
"""

from __future__ import annotations

import logging
from datetime import datetime

from .check import check
from .jobs import handler
from .passport import get_passport
from .schema import DocTree, Issue, renumber

log = logging.getLogger('docengine.tasks')


@handler('draft.generate')
def generate_draft(app, payload: dict, progress) -> dict:
    """Сгенерировать разделы документа.

    Разделы пишутся по очереди, и каждый видит предыдущие: иначе модель
    заново вводит уже определённые термины и путает нумерацию ссылок внутри
    договора.

    Упавший раздел не роняет документ: он помечается замечанием и остаётся
    незаполненным. Потерять девять готовых разделов из-за десятого — худший
    исход, чем отдать документ с одной дырой, про которую честно сказано.
    """
    from database.models import Draft, DraftVersion, db
    from .generate import GenerationError, _context_text, _retrieve_chunks, _section_query, found_norms, generate_section

    with app.app_context():
        draft = db.session.get(Draft, payload['draft_id'])
        if draft is None:
            raise LookupError(f'документ {payload["draft_id"]} исчез из базы')

        passport = get_passport(draft.type_id)
        version = draft.head()
        tree = DocTree(**version.tree_json)
        values = draft.values_json or {}

        provider = app.config.get('LLM_PROVIDER')
        if provider is None:
            raise RuntimeError('LLM-провайдер не настроен')
        retriever = app.config.get('RAG_RETRIEVER')

        only = payload.get('sections') or None
        specs = [s for s in passport.sections if not only or s.key in only]
        total = len(specs)
        failed: list[str] = []

        # Замечание «раздел не удалось составить» относится к попытке, а не к
        # разделу: для всего, что пересобирается сейчас, старые замечания
        # снимаются, и остаются только те, что поставит эта попытка. Разделы,
        # которых пересборка не касается, свои замечания сохраняют.
        attempted = {s.key for s in specs}
        tree.issues = [
            i for i in tree.issues
            if not (i.code == 'section_failed' and i.section_key in attempted)
        ]

        built = False

        def meta(stage: str, key: str, found: list | None = None) -> dict:
            m: dict = {'stage': stage, 'section': key}
            if found is not None:
                m['found'] = found
            # Свежий лист едет с каждым событием, как только готов первый
            # раздел. Событие живёт до следующего progress(), а поток читает
            # задачу раз в секунду — одиночное событие «раздел готов» он
            # почти всегда пропускал, и лист наполнялся разом в конце.
            if built:
                m['partial'] = tree.model_dump(mode='json')
            return m

        for i, spec in enumerate(specs):
            title = spec.title.get(draft.lang)
            section = tree.section_by_key(spec.key)
            if section is None:
                continue
            progress(i, total, title, meta('retrieving', spec.key))
            try:
                # Нормы под раздел достаём здесь, как и generate_document:
                # сама generate_section корпуса не знает и получает уже текст.
                chunks = _retrieve_chunks(retriever, _section_query(passport, spec, draft.lang))
                found = found_norms(chunks)
                progress(i, total, title, meta('drafting', spec.key, found))
                clauses = generate_section(
                    provider, passport, spec, tree, values, draft.lang,
                    legal_context=_context_text(chunks), hint=payload.get('hint') or '',
                )
                # Пункты, правленные человеком, переживают перегенерацию.
                kept = [c for c in section.clauses if c.locked]
                section.clauses = clauses + kept
                section.pending = False
                built = True
                # Готовый раздел уходит на экран сразу, пронумерованным: лист
                # наполняется по мере работы, а не после всех разделов.
                renumber(tree)
                progress(i + 1, total, title, meta('drafting', spec.key, found))
            except Exception as e:
                log.error('раздел «%s» документа %s не сгенерирован: %s',
                          spec.key, draft.public_id, e)
                failed.append(spec.key)
                tree.issues.append(Issue(
                    level='error', code='section_failed', section_key=spec.key,
                    message=f'Раздел «{title}» не удалось составить. '
                            f'Попробуйте сгенерировать его отдельно.',
                ))

        progress(total, total, 'проверка документа', {'stage': 'checking'})
        renumber(tree)
        tree.issues = [i for i in tree.issues if i.code == 'section_failed'] + \
                      check(tree, passport, values)

        draft.current_version += 1
        db.session.add(DraftVersion(
            draft_id=draft.id, no=draft.current_version,
            tree_json=tree.model_dump(mode='json'),
            summary=('составлен документ' if not only
                     else f'перегенерированы разделы: {", ".join(only)}'),
            created_by='llm',
        ))
        draft.updated_at = datetime.utcnow()
        db.session.commit()

        return {
            'draft_id': draft.public_id,
            'version': draft.current_version,
            'sections': total,
            'failed': failed,
            'issues': len([i for i in tree.issues if i.level == 'error']),
        }
