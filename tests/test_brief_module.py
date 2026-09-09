"""
Модуль концептов законопроекта: сферы, схема концепта, сборка значений формы.

Без HTTP и без модели: здесь проверяется логика, которая не должна зависеть
от того, как её вызвали. Модель подменяется записывающей заглушкой.
"""

import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from docengine import brief  # noqa: E402
from docengine.passport import get_passport, load_catalog  # noqa: E402


@pytest.fixture(scope='module')
def catalog():
    return load_catalog()


def test_law_passport_has_key_provisions_field(catalog):
    """Новеллы концепта должны попасть в генерацию под человеческой подписью."""
    p = get_passport('law_project')
    f = next(f for f in p.fields if f.name == 'key_provisions')
    assert f.type == 'textarea'
    assert f.group == 'subject'
    assert not f.required
    assert f.example and '\n' in f.example.get('ru'), 'пример — по одному положению в строке'


def test_every_domain_points_at_real_corpus_titles():
    for d in brief.DOMAINS:
        for title in d['corpus']:
            assert title in brief.CORPUS_TITLES, f'{d["key"]}: «{title}» нет в корпусе'


def test_every_corpus_document_belongs_to_some_domain():
    covered = {t for d in brief.DOMAINS for t in d['corpus']}
    assert brief.CORPUS_TITLES <= covered, sorted(brief.CORPUS_TITLES - covered)


def test_domain_lookup_and_payload_language():
    assert brief.domain('labor')['corpus'] == ['Трудовой кодекс РК']
    assert brief.domain('nope') is None
    ru = {d['key']: d['label'] for d in brief.domains_payload('ru')}
    kk = {d['key']: d['label'] for d in brief.domains_payload('kk')}
    assert ru['labor'] != kk['labor']
    assert set(ru) == {d['key'] for d in brief.DOMAINS}


def test_example_brief_uses_a_known_domain_and_real_text():
    ex = brief.example_brief('ru')
    assert brief.domain(ex['domain']) is not None
    assert len(ex['text']) > 80
    assert brief.example_brief('kk')['text'] != ex['text']
