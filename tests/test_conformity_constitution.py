import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from conformity.constitution import Article, ConstitutionIndex, parse_chunk  # noqa: E402

CHUNK = ('Раздел IV. Курултай\n'
         'Статья 52.\n'
         '1. Курултай Республики Казахстан – высший представительный орган.\n'
         '2. Полномочия Курултая начинаются с момента открытия его первой сессии.')


def test_parse_chunk_reads_section_and_article():
    a = parse_chunk(CHUNK)
    assert (a.no, a.section_no, a.section_title) == (52, 'IV', 'Курултай')
    assert a.text.startswith('1. Курултай')


def test_parse_chunk_without_article_is_none():
    assert parse_chunk('Раздел I. Основы\nкороткий хвост') is None


def _idx():
    return ConstitutionIndex([
        Article(1, 'I', 'Основы', 'демократическое государство', np.array([1.0, 0.0])),
        Article(52, 'IV', 'Курултай', 'высший представительный орган', np.array([0.0, 1.0])),
        Article(53, 'IV', 'Курултай', 'сто сорок пять депутатов', np.array([0.6, 0.8])),
    ])


def test_nearest_by_cosine():
    top = _idx().nearest(np.array([0.0, 1.0]), k=2)
    assert [a.no for a, _ in top] == [52, 53]
    assert top[0][1] > 0.99


def test_sections_group_articles_in_order():
    secs = _idx().sections()
    assert [s['no'] for s in secs] == ['I', 'IV']
    assert secs[1]['articles'] == [52, 53] and secs[1]['title'] == 'Курултай'
    assert _idx().texts[53] == 'сто сорок пять депутатов'
