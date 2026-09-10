"""
Конституция 2026 приходит не PDF с «Әділет» (сайт недоступен), а текстом с зеркала.
Зеркало даёт «Раздел I» и название на отдельных строках, «Статья 1» без точки.
Загрузчик корпуса понимает только «Раздел I. Название» и «Статья 1.» — приводим.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scripts.fetch_constitution_2026 import normalize  # noqa: E402
from scripts.load_legal_docs import DOC_META, clean_text, read_source, split_by_articles  # noqa: E402

MIRROR = (
    'Новая Конституция вступает в силу 1 июля: публикуем полный текст\n'
    'Раздел I\n'
    'Основы конституционного строя\n'
    'Статья 1\n'
    'Республика Казахстан – демократическое, светское, правовое и социальное государство.\n'
    'Статья 2\n'
    '1. Республика Казахстан – унитарное государство.\n'
    '2. Суверенитет Республики распространяется на всю ее территорию.\n'
    'Раздел IV\n'
    'Курултай\n'
    'Статья 52\n'
    '1. Курултай Республики Казахстан – высший представительный орган.\n'
    'Поделиться:\n'
    'Добавить комментарий\n'
)


def test_normalize_marks_sections_and_articles_for_the_loader():
    text = normalize(MIRROR)
    lines = text.split('\n')
    assert lines[0] == 'Раздел I. Основы конституционного строя'
    assert 'Статья 1.' in lines
    assert 'Раздел IV. Курултай' in lines
    assert 'Поделиться' not in text and 'публикуем полный текст' not in text


def test_loader_splits_normalized_constitution_by_articles():
    chunks = split_by_articles(clean_text(normalize(MIRROR)), 'Раздел')
    # Тело статьи из одного абзаца склеивается загрузчиком в строку заголовка — так же,
    # как у остальных кодексов; номер и текст при этом на месте.
    assert [c['title'].split(' ')[1] for c in chunks] == ['1.', '2.', '52.']
    assert chunks[2]['section'] == 'Раздел IV. Курултай'
    assert 'высший представительный орган' in chunks[2]['content']


def test_read_source_reads_plain_text(tmp_path):
    p = tmp_path / 'k2600000000.01-07-2026.rus.txt'
    p.write_text('Раздел I. Основы\nСтатья 1.\nТекст.\n', encoding='utf-8')
    assert read_source(str(p)).startswith('Раздел I. Основы')


def test_doc_meta_knows_both_constitutions():
    new = DOC_META['k2600000000.01-07-2026.rus.txt']
    old = DOC_META['k950001000_.01-01-2023.rus.pdf']
    assert new['type'] == 'constitution' and new['section_keyword'] == 'Раздел'
    assert '2026' in new['title']
    assert old['retired'] == '2026-07-01' and '1995' in old['title']
