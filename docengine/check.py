"""
Проверка готового документа.

Функция чистая: ни модели, ни сети, ни базы. Проверка обязана быть
воспроизводимой и мгновенной — её гоняют после каждой правки, и её вердикт
показывают пользователю как факт, а не как мнение модели. Всё, что требует
рассуждения, живёт в анализаторе; здесь — только то, что можно доказать
пересчётом.

Главное здесь — существенные условия: по ст. 393 ГК РК договор, в котором не
согласовано существенное условие, считается незаключённым. Это не стилистика,
это ничтожность сделки, поэтому уровень error.
"""

from __future__ import annotations

import re

from .passport import Passport
from .schema import DocTree, Issue

# Пункт короче этого — почти наверняка обрубок или заглушка модели
# («Стороны договорились.»), а не договорное условие.
MIN_CLAUSE_LEN = 20

_DIGITS12 = re.compile(r'^\d{12}$')


def _section_filled(tree: DocTree, key: str) -> bool:
    s = tree.section_by_key(key)
    return bool(s and not s.pending and any((c.text or '').strip() for c in s.clauses))


def _has_value(values: dict, name: str) -> bool:
    v = (values or {}).get(name)
    if v is None:
        return False
    if isinstance(v, str):
        return bool(v.strip())
    if isinstance(v, (list, tuple, dict)):
        return bool(v)
    return True


def check(tree: DocTree, passport: Passport, values: dict) -> list[Issue]:
    """Замечания к документу: чего не хватает и что выглядит подозрительно."""
    lang = tree.meta.lang or 'ru'
    values = values or {}
    issues: list[Issue] = []

    # ---- обязательные разделы паспорта
    for spec in passport.sections:
        section = tree.section_by_key(spec.key)
        title = spec.title.get(lang)
        if spec.required and section is None:
            issues.append(
                Issue(
                    level='error',
                    code='section_missing',
                    message=f'В документе нет обязательного раздела «{title}».',
                    section_key=spec.key,
                )
            )
            continue
        if section is None:
            continue
        empty = not any((c.text or '').strip() for c in section.clauses)
        if spec.required and empty and not section.pending:
            issues.append(
                Issue(
                    level='error',
                    code='section_empty',
                    message=f'Обязательный раздел «{title}» пуст.',
                    section_key=spec.key,
                )
            )
        if section.pending:
            issues.append(
                Issue(
                    level='info',
                    code='section_pending',
                    message=f'Раздел «{title}» ещё не сгенерирован.',
                    section_key=spec.key,
                )
            )

    # ---- существенные условия (ст. 393 ГК РК)
    for term in passport.essential_terms:
        by_field = any(_has_value(values, name) for name in term.fields)
        by_section = bool(term.section) and _section_filled(tree, term.section)
        if by_field or by_section:
            continue
        basis = f' ({term.basis.label()})' if term.basis else ''
        issues.append(
            Issue(
                level='error',
                code='essential_term_missing',
                message=(
                    f'Не согласовано существенное условие «{term.label.get(lang)}»{basis}. '
                    'Без него договор считается незаключённым (ст. 393 ГК РК).'
                ),
                section_key=term.section,
            )
        )

    # ---- реквизиты сторон
    for i, party in enumerate(tree.requisites.parties):
        who = party.role or f'сторона {i + 1}'
        for attr, label in (('name', 'наименование'), ('id_no', 'ИИН/БИН'), ('address', 'адрес')):
            if not (getattr(party, attr, '') or '').strip():
                issues.append(
                    Issue(
                        level='warning',
                        code=f'party_{attr}_empty',
                        message=f'У стороны «{who}» не заполнено {label}.',
                    )
                )
        id_no = (party.id_no or '').strip()
        if id_no and not _DIGITS12.match(id_no):
            kind_word = 'БИН' if party.kind == 'legal' else 'ИИН'
            issues.append(
                Issue(
                    level='warning',
                    code='party_id_invalid',
                    message=f'{kind_word} стороны «{who}» должен состоять из 12 цифр: «{id_no}».',
                )
            )

    # ---- подозрительно короткие пункты
    for section, clause, _parent in tree.walk_clauses():
        text = (clause.text or '').strip()
        if len(text) < MIN_CLAUSE_LEN:
            issues.append(
                Issue(
                    level='warning',
                    code='clause_too_short',
                    message=f'Пункт {clause.no or "?"} слишком короткий и, вероятно, пуст по существу: «{text}».',
                    section_key=section.key,
                    clause_no=clause.no or None,
                )
            )

    return issues
