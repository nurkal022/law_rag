"""
Расширение вопроса для поиска и слияние выдач.

Прогон 72 бытовых вопросов 10.09.2026: «Как открыть ИП?» находил статьи УПК про
«открытие», «закрыть ИП» — главу ГК о займе. В кодексах нет слов «ИП» и «ТОО»,
а эмбеддинг короткого вопроса цепляется за случайное слово. Дешёвая модель
переводит вопрос в два-три запроса языком кодексов, поиск идёт по всем, выдачи
сливаются взаимными рангами (RRF), чтобы масштаб оценок не имел значения.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from rag.expand import expand_query  # noqa: E402
from rag.retriever import DocumentRetriever  # noqa: E402


class FakeProvider:
    def __init__(self, reply):
        self.reply = reply
        self.calls = []

    def chat_completion(self, messages, **kw):
        self.calls.append({'messages': messages, **kw})
        if isinstance(self.reply, Exception):
            raise self.reply
        return {'content': self.reply}


def test_expansion_returns_legal_language_queries_without_the_original():
    provider = FakeProvider('```json\n{"queries": ["государственная регистрация индивидуального предпринимателя", '
                            '"уведомление о начале деятельности в качестве индивидуального предпринимателя", "Как открыть ИП?"]}\n```')
    out = expand_query('Как открыть ИП?', provider)
    assert out == ['государственная регистрация индивидуального предпринимателя',
                   'уведомление о начале деятельности в качестве индивидуального предпринимателя']
    assert 'Как открыть ИП?' in provider.calls[0]['messages'][-1]['content']


def test_expansion_survives_garbage_and_failures():
    assert expand_query('вопрос', FakeProvider('совсем не JSON')) == []
    assert expand_query('вопрос', FakeProvider('{"queries": "строка"}')) == []
    assert expand_query('вопрос', FakeProvider(RuntimeError('сеть'))) == []


def test_expansion_is_capped_and_cleaned():
    provider = FakeProvider('{"queries": ["  а  ", "", "б", "в", "г", 5]}')
    assert expand_query('вопрос', provider, max_queries=3) == ['а', 'б', 'в']


def _chunk(cid, score):
    return {'id': cid, 'final_score': score, 'title': f'акт {cid}', 'content': f'Статья {cid}.'}


class FakeSearcher(DocumentRetriever):
    """hybrid_search подменён заготовленными выдачами по запросу."""

    def __init__(self, table):
        self.table = table
        self.queries = []

    def hybrid_search(self, query, top_k=None):
        self.queries.append(query)
        return self.table.get(query, [])


def test_many_queries_are_fused_by_reciprocal_rank():
    r = FakeSearcher({
        'вопрос': [_chunk(1, 0.9), _chunk(2, 0.8), _chunk(3, 0.7)],
        'запрос юристом': [_chunk(3, 0.4), _chunk(4, 0.3), _chunk(1, 0.2)],
    })
    out = r.hybrid_search_many(['вопрос', 'запрос юристом'], top_k=3)
    ids = [c['id'] for c in out]
    # 1 и 3 встречаются в обеих выдачах — они выше единичных 2 и 4;
    # 1 (ранги 1 и 3) выше 3 (ранги 3 и 1)? нет — суммы равны, порядок стабилен по первому запросу
    assert set(ids[:2]) == {1, 3}
    assert ids[2] == 2
    assert len(out) == 3
    assert r.queries == ['вопрос', 'запрос юристом']


def test_fusion_keeps_the_best_scored_copy_of_a_chunk():
    r = FakeSearcher({'a': [_chunk(7, 0.2)], 'b': [_chunk(7, 0.9)]})
    out = r.hybrid_search_many(['a', 'b'], top_k=5)
    assert len(out) == 1 and out[0]['final_score'] == 0.9


def test_single_query_falls_back_to_plain_search():
    r = FakeSearcher({'только': [_chunk(1, 0.5), _chunk(2, 0.4)]})
    assert [c['id'] for c in r.hybrid_search_many(['только'], top_k=1)] == [1]
