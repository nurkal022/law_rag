"""
Источники ответа консультанта.

Интерфейс рисует ссылку на норму чипом «ГК РК 178» — для этого ему нужен
номер статьи отдельным полем, а не внутри 200 символов предпросмотра, где
он есть не всегда. Номер вынимается из текста фрагмента на сервере: там
фрагмент целый.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from rag.generator import ResponseGenerator, source_article  # noqa: E402


def test_article_number_is_taken_from_the_fragment():
    assert source_article('Глава 1. Общие положения\nСтатья 178. Общий срок исковой давности\n1. …') == '178'


def test_hyphenated_article_numbers_survive():
    assert source_article('Статья 43-1. Особенности предоставления земельных участков') == '43-1'


def test_fragment_without_an_article_gives_an_empty_string():
    assert source_article('Раздел I. Общие положения о договоре') == ''


def test_sources_list_carries_the_article():
    gen = ResponseGenerator.__new__(ResponseGenerator)  # провайдер здесь не нужен
    sources = gen._prepare_sources_list([{
        'title': 'Гражданский кодекс РК (Общая часть)',
        'filename': 'gk.pdf',
        'start_position': 10, 'end_position': 20, 'chunk_index': 3,
        'similarity_score': 0.7,
        'preview': 'Глава 7. Сроки…',
        'full_content': 'Глава 7. Сроки\nСтатья 178. Общий срок исковой давности\n1. Общий срок…',
    }])
    assert sources[0]['article'] == '178'
    assert sources[0]['title'] == 'Гражданский кодекс РК (Общая часть)'
