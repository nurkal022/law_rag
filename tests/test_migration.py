"""Разбор старых разделов законопроекта в дерево."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scripts.migrate_law_projects import parse_clauses, section_text, strip_markup  # noqa: E402


def test_markup_is_stripped():
    assert strip_markup('## **Заголовок**') == 'Заголовок'
    assert strip_markup('- пункт списка') == 'пункт списка'


def test_numbered_lines_become_clauses():
    clauses = parse_clauses('1.1. Первое условие.\n1.2. Второе условие.')
    assert [c.text for c in clauses] == ['Первое условие.', 'Второе условие.']


def test_wrapped_line_continues_previous_clause():
    """Перенос строки внутри абзаца не должен рождать пункт-обрывок."""
    clauses = parse_clauses('1.1. Начало условия,\nкоторое продолжается на следующей строке.')
    assert len(clauses) == 1
    assert clauses[0].text.endswith('на следующей строке.')


def test_unnumbered_text_survives():
    clauses = parse_clauses('Просто абзац без нумерации.')
    assert len(clauses) == 1


def test_section_text_handles_all_old_shapes():
    """Разделы хранились строкой, словарём и списком — переносим все три."""
    assert section_text('текст') == 'текст'
    assert section_text({'content': 'текст'}) == 'текст'
    assert section_text(['a', 'b']) == 'a\nb'
    assert section_text(None) == ''
