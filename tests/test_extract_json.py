"""
Разбор JSON из ответа модели: ограждения, вежливые фразы, лишние скобки.

Модель промахивается мимо синтаксиса одинаково: дописывает лишнюю `}` после
вложенного массива. Такой ответ чинится удалением одного символа — и это
дешевле повторного запроса, за который человек ждёт ещё двадцать секунд.
"""

import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from docengine.generate import extract_json  # noqa: E402


def test_plain_and_fenced_json_are_read():
    assert extract_json('{"a": 1}') == {'a': 1}
    assert extract_json('Вот ответ:\n```json\n{"a": 1}\n```') == {'a': 1}


def test_stray_closing_brace_after_a_nested_array_is_forgiven():
    raw = ('{"clauses":[{"text":"Первый","refs":[],"subclauses":[{"text":"а","refs":[]}]}},'
           '{"text":"Второй","refs":[],"subclauses":[]}}]}')
    data = extract_json(raw)
    assert [c['text'] for c in data['clauses']] == ['Первый', 'Второй']
    assert data['clauses'][0]['subclauses'][0]['text'] == 'а'


def test_stray_closing_bracket_is_forgiven_too():
    assert extract_json('{"a":[1,2]],"b":3}') == {'a': [1, 2], 'b': 3}


def test_unrepairable_answer_still_raises():
    with pytest.raises(ValueError):
        extract_json('{"a": [1, 2')
    with pytest.raises(ValueError):
        extract_json('совсем не JSON')
