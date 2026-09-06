#!/usr/bin/env python3
"""
Перенос законопроектов из старых таблиц в документный движок.

law_projects хранит разделы словарём «ключ → текст с разметкой». Движок
хранит дерево. Перенос разбирает текст на разделы и пункты по нумерации,
потому что оставить его одной простынёй означало бы получить документ,
который нельзя ни адресовать, ни перегенерировать по частям, — то есть
формально перенесённый и практически бесполезный.

Запуск:
    python scripts/migrate_law_projects.py --dry-run   посмотреть, что будет
    python scripts/migrate_law_projects.py             перенести

Повторный запуск безопасен: уже перенесённые проекты пропускаются.
"""

import argparse
import logging
import os
import re
import secrets
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ.setdefault('DOCENGINE_INLINE_WORKER', '0')

log = logging.getLogger('migrate')

# «1.2.» или «1.2 » в начале строки — номер пункта; всё прочее продолжает
# предыдущий пункт. Заголовки набраны прописными или начинаются с номера.
CLAUSE_RE = re.compile(r'^\s*(\d{1,2}(?:\.\d{1,2}){0,2})\.?\s+(.+)$')
HEADING_RE = re.compile(r'^\s*(?:\d{1,2}\.?\s+)?([А-ЯЁA-Z][А-ЯЁA-Z \-«»,()]{4,})\s*$')


def strip_markup(text: str) -> str:
    """Снимает разметку, которую оставила прежняя генерация."""
    text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)
    text = re.sub(r'^#{1,6}\s*', '', text, flags=re.M)
    text = re.sub(r'^\s*[-*•]\s+', '', text, flags=re.M)
    return text.strip()


def parse_clauses(text: str):
    """Разбирает текст раздела на пункты по ведущей нумерации."""
    from docengine.schema import Clause

    clauses: list[Clause] = []
    for raw in strip_markup(text).split('\n'):
        line = raw.strip()
        if not line:
            continue
        m = CLAUSE_RE.match(line)
        if m:
            clauses.append(Clause(text=m.group(2).strip()))
        elif clauses:
            # Продолжение предыдущего пункта: перенос строки внутри абзаца.
            clauses[-1].text = f'{clauses[-1].text} {line}'.strip()
        else:
            clauses.append(Clause(text=line))
    return [c for c in clauses if len(c.text) > 1]


def section_text(value) -> str:
    """Разделы хранились по-разному: строкой, словарём с ключом content, списком."""
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        for key in ('content', 'text', 'body', 'value'):
            if isinstance(value.get(key), str):
                return value[key]
        return '\n'.join(str(v) for v in value.values() if isinstance(v, str))
    if isinstance(value, list):
        return '\n'.join(str(v) for v in value)
    return ''


def migrate(dry_run: bool = False) -> dict:
    from app import app
    from database.models import Draft, DraftVersion, LawProject, User, db
    from docengine.passport import get_passport
    from docengine.schema import DocTree, renumber
    from docengine.skeleton import build_skeleton

    stats = {'seen': 0, 'moved': 0, 'skipped': 0, 'no_owner': 0, 'failed': 0}

    with app.app_context():
        passport = get_passport('law_project')
        # Прежние таблицы не хранили владельца: у законопроектов не было
        # привязки к пользователю. Отдаём их первому администратору —
        # иначе перенесённый документ был бы недоступен никому.
        fallback = db.session.query(User).order_by(User.id).first()

        for project in db.session.query(LawProject).order_by(LawProject.id).all():
            stats['seen'] += 1
            exists = db.session.query(Draft).filter_by(
                kind='law_project', title=project.title_ru or '').first()
            if exists:
                stats['skipped'] += 1
                continue
            if fallback is None:
                stats['no_owner'] += 1
                continue

            try:
                data = project.to_dict()
                values = data.get('data') or {}
                values.setdefault('title_ru', project.title_ru or '')
                values.setdefault('title_kz', project.title_kz or '')
                values.setdefault('initiator', project.initiator or '')
                values.setdefault('initiator_type', project.initiator_type or '')

                tree: DocTree = build_skeleton(passport, values, 'ru')
                sections = data.get('sections') or {}
                filled = 0
                for section in tree.sections:
                    raw = sections.get(section.key)
                    if not raw:
                        continue
                    clauses = parse_clauses(section_text(raw))
                    if clauses:
                        section.clauses = clauses
                        section.pending = False
                        filled += 1
                renumber(tree)

                if dry_run:
                    log.info('перенёс бы «%s»: %s из %s разделов',
                             (project.title_ru or '')[:60], filled, len(tree.sections))
                    stats['moved'] += 1
                    continue

                draft = Draft(
                    public_id=secrets.token_hex(8),
                    kind='law_project',
                    type_id='law_project',
                    owner_id=fallback.id,
                    title=project.title_ru or 'Законопроект без названия',
                    lang='ru',
                    status=project.status or 'draft',
                    values_json=values,
                    current_version=0,
                    created_at=project.generation_date,
                )
                db.session.add(draft)
                db.session.flush()
                db.session.add(DraftVersion(
                    draft_id=draft.id, no=0,
                    tree_json=tree.model_dump(mode='json'),
                    summary=f'перенесено из прежнего генератора: {filled} разделов',
                    created_by='system',
                ))
                db.session.commit()
                stats['moved'] += 1
                log.info('перенесён «%s» → %s', (project.title_ru or '')[:60], draft.public_id)

            except Exception as e:
                db.session.rollback()
                stats['failed'] += 1
                log.error('проект %s не перенесён: %s', project.project_id, e)

    return stats


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dry-run', action='store_true',
                        help='показать, что будет перенесено, ничего не записывая')
    args = parser.parse_args()

    logging.basicConfig(level='INFO', format='%(levelname)-7s %(message)s')
    result = migrate(dry_run=args.dry_run)
    print('\nИтог:')
    print(f'  найдено проектов:   {result["seen"]}')
    print(f'  перенесено:         {result["moved"]}')
    print(f'  уже были:           {result["skipped"]}')
    print(f'  без владельца:      {result["no_owner"]}')
    print(f'  с ошибкой:          {result["failed"]}')
    if args.dry_run:
        print('\nЭто был пробный запуск, база не изменялась.')
