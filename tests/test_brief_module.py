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


# ------------------------------------------------------------ концепт → форма


def _concept(**over):
    base = dict(
        title_ru='О цифровых платформах оказания юридической помощи',
        title_kz='Заң көмегін көрсетудің цифрлық платформалары туралы',
        summary='Статус платформ, реестр операторов, защита данных.',
        problem_description='Платформы работают вне правового поля.',
        goals=['Закрепить статус платформ', 'Ввести реестр операторов'],
        target_audience='Граждане, операторы платформ',
        current_legislation_gaps='Закон об адвокатской деятельности не знает платформ.',
        constitutional_basis='Статья 13 Конституции РК',
        key_provisions=['Реестр ведёт Минюст', 'Оператор отвечает солидарно'],
        refs=[{'act': 'Конституция РК', 'article': '13', 'note': None}],
    )
    base.update(over)
    return brief.Concept(**base)


def test_concept_lists_become_one_item_per_line(catalog):
    values = _concept().to_values(get_passport('law_project'))
    assert values['goals'] == 'Закрепить статус платформ\nВвести реестр операторов'
    assert values['key_provisions'] == 'Реестр ведёт Минюст\nОператор отвечает солидарно'
    assert values['title_ru'].startswith('О цифровых')


def test_concept_values_contain_only_passport_fields(catalog):
    """summary и refs — для карточки, не для формы: в паспорте таких полей нет."""
    values = _concept().to_values(get_passport('law_project'))
    names = {f.name for f in get_passport('law_project').fields}
    assert set(values) <= names
    assert 'summary' not in values and 'refs' not in values


def test_concept_refs_are_never_marked_verified():
    c = _concept(refs=[{'act': 'ГК РК', 'article': '178', 'note': None, 'verified': True}])
    assert all(not r.verified for r in c.refs), 'ссылка из ответа модели не выверена по корпусу'


def test_brief_result_needs_at_least_two_concepts_and_keeps_three():
    one = {'concepts': [_concept().model_dump()]}
    with pytest.raises(Exception):
        brief.BriefResult(**one)
    four = {'concepts': [_concept(title_ru=f'О законе № {i}').model_dump() for i in range(4)]}
    assert len(brief.BriefResult(**four).concepts) == 3


# --------------------------------------------------------------- уточнения


def test_clarifications_cover_the_required_fields_the_concept_lacks(catalog):
    p = get_passport('law_project')
    c = brief.clarifications_payload(p, 'ru', 'labor')
    covered = set(_concept().to_values(p)) | set(c)
    required = {f.name for f in p.fields if f.required}
    assert required <= covered, sorted(required - covered)


def test_clarification_options_come_from_the_passport(catalog):
    c = brief.clarifications_payload(get_passport('law_project'), 'ru', 'labor')
    assert c['initiator_type']['kind'] == 'options'
    assert {o['value'] for o in c['initiator_type']['options']} == {'deputy', 'government', 'ministry'}


def test_initiator_suggestions_follow_the_domain(catalog):
    labor = brief.clarifications_payload(get_passport('law_project'), 'ru', 'labor')['initiator']
    tax = brief.clarifications_payload(get_passport('law_project'), 'ru', 'tax_budget')['initiator']
    assert labor['kind'] == 'text'
    assert 'труда' in labor['suggestions'][0]
    assert 'финансов' in tax['suggestions'][0]
    assert labor['suggestions'][1:] == tax['suggestions'][1:], 'общие подсказки одинаковы для всех сфер'


def test_budget_and_timeline_chips_expand_into_real_sentences(catalog):
    c = brief.clarifications_payload(get_passport('law_project'), 'ru', 'civil')
    budget = {ch['key']: ch for ch in c['budget_impact']['chips']}
    assert budget['none']['value'].startswith('Принятие закона не требует')
    assert len(budget['funding']['value']) > 60
    timeline = {ch['key']: ch['value'] for ch in c['implementation_timeline']['chips']}
    assert 'десяти' in timeline['ten_days']
    kk = brief.clarifications_payload(get_passport('law_project'), 'kk', 'civil')
    assert kk['budget_impact']['chips'][0]['label'] != c['budget_impact']['chips'][0]['label']


# ------------------------------------------------------- запрос концептов

import json  # noqa: E402


class FakeProvider:
    """Отдаёт заготовленные ответы по очереди и запоминает, о чём спросили."""

    def __init__(self, *replies):
        self.replies = list(replies)
        self.calls = []

    def chat_completion(self, messages, **kw):
        self.calls.append(messages)
        return {'content': self.replies.pop(0) if self.replies else '{}'}


class FakeRetriever:
    def __init__(self):
        self.queries = []

    def hybrid_search(self, query, top_k=4):
        self.queries.append(query)
        return [
            {'title': 'Конституция Республики Казахстан',
             'content': 'Статья 13. Каждый имеет право на получение квалифицированной юридической помощи.'},
            {'title': 'Гражданский кодекс РК (Общая часть)',
             'content': 'Статья 178. Общий срок исковой давности устанавливается в три года.'},
        ]


def _two_concepts_json(**over):
    c = _concept(**over).model_dump(mode='json')
    d = _concept(title_ru='О реестре операторов юридических платформ').model_dump(mode='json')
    return json.dumps({'concepts': [c, d]}, ensure_ascii=False)


def test_concepts_come_from_the_model(catalog):
    provider = FakeProvider(_two_concepts_json())
    result = brief.propose_concepts(
        provider, FakeRetriever(), get_passport('law_project'),
        text='платформы юридической помощи', domain_key='civil', attachments=[], lang='ru',
    )
    assert len(result.concepts) == 2
    assert result.concepts[1].title_ru.startswith('О реестре')
    assert len(provider.calls) == 1


def test_brief_and_domain_documents_drive_the_corpus_search(catalog):
    retriever = FakeRetriever()
    brief.propose_concepts(
        FakeProvider(_two_concepts_json()), retriever, get_passport('law_project'),
        text='ответственность консультанта', domain_key='civil',
        attachments=[{'filename': 'записка.pdf', 'text': 'Обзор рынка онлайн-консультаций'}], lang='ru',
    )
    q = retriever.queries[0]
    assert 'Гражданский кодекс РК' in q
    assert 'ответственность консультанта' in q
    assert 'Обзор рынка' in q


def test_prompt_carries_brief_files_norms_and_avoid_list(catalog):
    provider = FakeProvider(_two_concepts_json())
    brief.propose_concepts(
        provider, FakeRetriever(), get_passport('law_project'),
        text='платформы', domain_key='civil',
        attachments=[{'filename': 'записка.pdf', 'text': 'текст записки'}], lang='ru',
        avoid=['О цифровых платформах оказания юридической помощи'],
    )
    prompt = ' '.join(m['content'] for m in provider.calls[0])
    assert 'платформы' in prompt
    assert 'записка.pdf' in prompt and 'текст записки' in prompt
    assert 'Статья 13' in prompt, 'нормы из корпуса должны быть перед глазами модели'
    assert 'О цифровых платформах оказания юридической помощи' in prompt
    assert 'не повторя' in prompt.lower()


def test_refs_outside_the_corpus_context_are_dropped(catalog):
    invented = _two_concepts_json(refs=[
        {'act': 'Конституция РК', 'article': '13', 'note': None},
        {'act': 'ГК РК', 'article': '999', 'note': None},
    ])
    result = brief.propose_concepts(
        FakeProvider(invented), FakeRetriever(), get_passport('law_project'),
        text='платформы', domain_key='civil', attachments=[], lang='ru',
    )
    articles = [r.article for r in result.concepts[0].refs]
    assert articles == ['13'], 'статья 999 в корпусе не найдена — ссылка выдумана'


def test_garbage_twice_raises_generation_error(catalog):
    from docengine.generate import GenerationError
    with pytest.raises(GenerationError):
        brief.propose_concepts(
            FakeProvider('мусор', 'снова мусор'), FakeRetriever(), get_passport('law_project'),
            text='платформы', domain_key='civil', attachments=[], lang='ru',
        )


def test_attachment_text_is_capped(catalog):
    provider = FakeProvider(_two_concepts_json())
    brief.propose_concepts(
        provider, FakeRetriever(), get_passport('law_project'),
        text='', domain_key='civil',
        attachments=[{'filename': 'big.pdf', 'text': 'x' * 20000}], lang='ru',
    )
    prompt = ' '.join(m['content'] for m in provider.calls[0])
    assert prompt.count('x') <= 8000 + 100


# ------------------------------------------------------------- generate.py


def test_retrieve_chunks_extract_article_numbers():
    from docengine.generate import _retrieve_chunks, found_norms
    chunks = _retrieve_chunks(FakeRetriever(), 'что угодно', top_k=2)
    assert [c['article'] for c in chunks] == ['13', '178']
    assert found_norms(chunks) == [
        {'title': 'Конституция Республики Казахстан', 'article': '13'},
        {'title': 'Гражданский кодекс РК (Общая часть)', 'article': '178'},
    ]


def test_retrieve_text_contract_is_unchanged():
    from docengine.generate import _retrieve
    text = _retrieve(FakeRetriever(), 'что угодно', top_k=2)
    assert text.startswith('[Конституция Республики Казахстан]\nСтатья 13.')
    assert _retrieve(None, 'что угодно') == ''
