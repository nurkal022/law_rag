"""Каркас, генерация разделами, правка промптом и проверка — без реального LLM."""

import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from docengine.check import check
from docengine.generate import GenerationError, apply_instruction, generate_document, generate_section
from docengine.passport import EssentialTerm, Field_, Passport, PartySpec, SectionSpec, Trans
from docengine.schema import Ref
from docengine.skeleton import build_skeleton


# ------------------------------------------------------------- фикстуры


def T(ru: str) -> Trans:
    return Trans(ru=ru)


def passport() -> Passport:
    """Паспорт собирается кодом: каталог пишет другой агент, тесты от него не зависят."""
    return Passport(
        id='supply',
        kind='contract',
        name=T('Договор поставки'),
        family='sale',
        summary=T('Поставка товара юридическим лицом'),
        legal_basis=[Ref(act='ГК РК', article='406')],
        form=T('простая письменная'),
        parties=[
            PartySpec(role=T('Поставщик'), kinds=['legal']),
            PartySpec(role=T('Покупатель'), kinds=['legal', 'individual']),
        ],
        fields=[
            Field_(name='party0_name', label=T('Наименование поставщика'), party=0, group='parties'),
            Field_(name='party1_name', label=T('Наименование покупателя'), party=1, group='parties'),
            Field_(name='goods', label=T('Товар'), required=True),
            Field_(name='price', label=T('Цена'), type='money', unit='тенге'),
        ],
        sections=[
            SectionSpec(key='subject', title=T('Предмет договора'),
                        guidance=T('Определить товар, его наименование и количество'),
                        refs=[Ref(act='ГК РК', article='407')]),
            SectionSpec(key='price', title=T('Цена и порядок расчётов'),
                        guidance=T('Определить цену, срок и порядок оплаты')),
            SectionSpec(key='liability', title=T('Ответственность сторон'), required=False,
                        guidance=T('Неустойка за просрочку поставки и оплаты')),
        ],
        essential_terms=[
            EssentialTerm(key='goods', label=T('Предмет договора'), fields=['goods'], section='subject',
                          basis=Ref(act='ГК РК', article='393')),
            EssentialTerm(key='price', label=T('Цена'), fields=['price'], section='price'),
        ],
    )


def values() -> dict:
    return {
        'party0_name': 'ТОО «Альфа»',
        'party0_id_no': '123456789012',
        'party0_address': 'г. Астана, ул. Абая, 1',
        'party0_signatory': 'Иванов И.И.',
        'party0_signatory_role': 'директора',
        'party1_name': 'ТОО «Бета»',
        'party1_id_no': '210987654321',
        'party1_address': 'г. Алматы, ул. Сатпаева, 2',
        'goods': 'Цемент М400, 100 тонн',
        'price': '5 000 000',
        'city': 'Астана',
        'date': '2025-01-15',
    }


CLAUSES_JSON = (
    '{"clauses":[{"text":"Поставщик обязуется поставить, а Покупатель принять и оплатить '
    'цемент М400 в количестве 100 тонн.","refs":[{"act":"ГК РК","article":"407"}]},'
    '{"text":"Качество товара должно соответствовать СТ РК и подтверждаться паспортом качества.",'
    '"refs":[]}],"notes":""}'
)

OPS_JSON = (
    '{"ops":[{"op":"replace_clause","no":"1.1","text":"Поставщик обязуется поставить цемент М400 '
    'в количестве 100 тонн в срок до 1 марта 2025 года.","reason":"добавлен срок"},'
    '{"op":"insert_clause","key":"liability","text":"За просрочку поставки Поставщик уплачивает '
    'неустойку 0,1% от стоимости непоставленного товара за каждый день просрочки."}],'
    '"reply":"Уточнил срок поставки и добавил неустойку."}'
)


class FakeProvider:
    """Провайдер-заглушка: отдаёт заранее заданные ответы по очереди."""

    def __init__(self, *responses):
        self.responses = list(responses)
        self.calls: list[list[dict]] = []

    def chat_completion(self, messages, model=None, temperature=0.7, max_tokens=2000, **kw):
        self.calls.append(messages)
        item = self.responses[min(len(self.calls) - 1, len(self.responses) - 1)]
        if isinstance(item, Exception):
            raise item
        return {'content': item, 'model': model or 'fake', 'usage': {}}

    def is_available(self):
        return True

    def get_available_models(self):
        return ['fake']


class KeyedProvider:
    """Отдаёт ответ в зависимости от того, какой раздел просят."""

    def __init__(self, mapping: dict, default: str):
        self.mapping = mapping
        self.default = default
        self.calls = 0

    def chat_completion(self, messages, model=None, temperature=0.7, max_tokens=2000, **kw):
        self.calls += 1
        text = ' '.join(m['content'] for m in messages)
        for title, resp in self.mapping.items():
            if f'«{title}»' in text:
                if isinstance(resp, Exception):
                    raise resp
                return {'content': resp, 'model': 'fake', 'usage': {}}
        return {'content': self.default, 'model': 'fake', 'usage': {}}

    def is_available(self):
        return True

    def get_available_models(self):
        return ['fake']


# -------------------------------------------------------------- каркас


def test_skeleton_has_requisites_and_pending_sections():
    tree = build_skeleton(passport(), values(), 'ru')

    assert tree.requisites.city == 'Астана'
    assert tree.requisites.date == '2025-01-15'
    assert [p.role for p in tree.requisites.parties] == ['Поставщик', 'Покупатель']
    assert tree.requisites.parties[0].name == 'ТОО «Альфа»'
    assert tree.requisites.parties[0].id_no == '123456789012'

    assert [s.key for s in tree.sections] == ['subject', 'price', 'liability']
    assert all(s.pending and not s.clauses for s in tree.sections)
    assert [s.no for s in tree.sections] == ['1', '2', '3']

    # Преамбула собрана без модели и уже содержит стороны и основание полномочий.
    assert 'ТОО «Альфа»' in tree.preamble
    assert 'БИН 123456789012' in tree.preamble
    assert 'в лице директора Иванов И.И.' in tree.preamble
    assert 'действующего на основании устава' in tree.preamble
    assert 'с одной стороны' in tree.preamble and 'с другой стороны' in tree.preamble
    assert tree.preamble.endswith('заключили настоящий договор о нижеследующем:')


def test_skeleton_individual_party_has_other_wording():
    p = passport()
    v = values() | {'party1_kind': 'individual', 'party1_name': 'Петров Пётр Петрович'}
    tree = build_skeleton(p, v, 'ru')
    assert tree.requisites.parties[1].kind == 'individual'
    assert 'ИИН 210987654321' in tree.preamble
    assert 'Петров Пётр Петрович, ИИН' in tree.preamble
    # У физлица не бывает «в лице директора»
    assert tree.preamble.count('в лице') == 1


# ------------------------------------------------------ generate_section


def test_generate_section_parses_plain_json():
    p = passport()
    tree = build_skeleton(p, values(), 'ru')
    provider = FakeProvider(CLAUSES_JSON)

    clauses = generate_section(provider, p, p.sections[0], tree, values(), 'ru')

    assert len(clauses) == 2
    assert clauses[0].refs[0].article == '407'
    assert len(provider.calls) == 1
    # В промпт попали и руководство раздела, и значения формы.
    prompt = ' '.join(m['content'] for m in provider.calls[0])
    assert 'Определить товар' in prompt
    assert 'Цемент М400, 100 тонн' in prompt


def test_generate_section_parses_fenced_json():
    p = passport()
    tree = build_skeleton(p, values(), 'ru')
    fenced = 'Конечно, вот результат:\n```json\n' + CLAUSES_JSON + '\n```\nГотово.'
    provider = FakeProvider(fenced)

    clauses = generate_section(provider, p, p.sections[0], tree, values(), 'ru')

    assert len(clauses) == 2
    assert len(provider.calls) == 1


def test_generate_section_retries_once_and_succeeds():
    p = passport()
    tree = build_skeleton(p, values(), 'ru')
    provider = FakeProvider('Извините, я не понял задание.', CLAUSES_JSON)

    clauses = generate_section(provider, p, p.sections[0], tree, values(), 'ru')

    assert len(clauses) == 2
    assert len(provider.calls) == 2
    # Повтор содержит требование вернуть только JSON.
    assert 'ТОЛЬКО объект JSON' in provider.calls[1][-1]['content']


def test_generate_section_raises_after_two_failures():
    p = passport()
    tree = build_skeleton(p, values(), 'ru')
    provider = FakeProvider('мусор', 'снова мусор')

    with pytest.raises(GenerationError) as e:
        generate_section(provider, p, p.sections[0], tree, values(), 'ru')

    assert 'снова мусор' in str(e.value)
    assert len(provider.calls) == 2


# ----------------------------------------------------- generate_document


def test_generate_document_survives_one_failing_section():
    p = passport()
    provider = KeyedProvider({'Цена и порядок расчётов': RuntimeError('сервис недоступен')}, CLAUSES_JSON)
    seen: list[tuple] = []

    tree = generate_document(provider, p, values(), 'ru', progress=lambda d, t, title: seen.append((d, t, title)))

    subject = tree.section_by_key('subject')
    liability = tree.section_by_key('liability')
    price = tree.section_by_key('price')

    assert not subject.pending and len(subject.clauses) == 2
    assert not liability.pending and len(liability.clauses) == 2
    assert price.pending and not price.clauses

    failed = [i for i in tree.issues if i.code == 'section_failed']
    assert len(failed) == 1 and failed[0].section_key == 'price'

    # Нумерация сквозная, несмотря на дыру посередине.
    assert subject.clauses[0].no == '1.1'
    assert liability.clauses[0].no == '3.1'

    # Прогресс сообщён по каждому разделу.
    assert [s[2] for s in seen[:3]] == ['Предмет договора', 'Цена и порядок расчётов', 'Ответственность сторон']
    assert seen[0][1] == 3


def test_generate_document_searches_context_per_section():
    """Правовой контекст ищется под каждый раздел отдельно, а не один раз на договор."""

    class Retriever:
        def __init__(self):
            self.queries = []

        def hybrid_search(self, query, top_k=4):
            self.queries.append(query)
            return [{'title': 'ГК РК ст. 407', 'content': 'Условие о товаре считается согласованным...'}]

    p = passport()
    r = Retriever()
    generate_document(FakeProvider(CLAUSES_JSON), p, values(), 'ru', retriever=r)

    assert len(r.queries) == 3
    assert 'Предмет договора' in r.queries[0]
    assert 'Цена и порядок расчётов' in r.queries[1]


# --------------------------------------------------------------- check


def test_check_finds_open_essential_term():
    p = passport()
    v = values()
    v.pop('price')  # цена не заполнена в форме
    tree = build_skeleton(p, v, 'ru')
    tree.section_by_key('price').pending = True  # и раздел не сгенерирован

    issues = check(tree, p, v)

    missing = [i for i in issues if i.code == 'essential_term_missing']
    assert len(missing) == 1
    assert 'Цена' in missing[0].message
    assert missing[0].level == 'error'
    assert 'ст. 393' in missing[0].message


def test_check_closes_essential_term_by_section():
    """Условие закрыто, если раздел написан, даже когда поле формы пустое."""
    from docengine.schema import Clause

    p = passport()
    v = values()
    v.pop('price')
    tree = build_skeleton(p, v, 'ru')
    s = tree.section_by_key('price')
    s.pending = False
    s.clauses = [Clause(text='Цена договора составляет 5 000 000 тенге, оплата в течение 10 рабочих дней.')]

    issues = check(tree, p, v)
    assert not [i for i in issues if i.code == 'essential_term_missing']


def test_check_finds_bad_iin():
    p = passport()
    v = values() | {'party1_id_no': '12345'}
    tree = build_skeleton(p, v, 'ru')

    issues = check(tree, p, v)

    bad = [i for i in issues if i.code == 'party_id_invalid']
    assert len(bad) == 1
    assert bad[0].level == 'warning'
    assert '12 цифр' in bad[0].message


def test_check_flags_short_clause_and_pending_sections():
    from docengine.schema import Clause

    p = passport()
    tree = build_skeleton(p, values(), 'ru')
    s = tree.section_by_key('subject')
    s.pending = False
    s.clauses = [Clause(no='1.1', text='Товар.')]

    issues = check(tree, p, values())

    assert [i for i in issues if i.code == 'clause_too_short' and i.clause_no == '1.1']
    pending = [i for i in issues if i.code == 'section_pending']
    assert len(pending) == 2 and all(i.level == 'info' for i in pending)


def test_check_warns_on_empty_party_requisites():
    p = passport()
    v = {'goods': 'Цемент', 'price': '1'}
    tree = build_skeleton(p, v, 'ru')

    issues = check(tree, p, v)
    codes = {i.code for i in issues}
    assert {'party_name_empty', 'party_id_no_empty', 'party_address_empty'} <= codes


# ----------------------------------------------------- apply_instruction


def test_apply_instruction_returns_valid_ops():
    from docengine.ops import apply_ops
    from docengine.schema import Clause

    p = passport()
    tree = build_skeleton(p, values(), 'ru')
    for s in tree.sections:
        s.pending = False
        s.clauses = [Clause(text='Исходное условие раздела ' + s.title + '.')]
    from docengine.schema import renumber

    renumber(tree)

    provider = FakeProvider(OPS_JSON)
    ops, reply = apply_instruction(provider, tree, 'добавь неустойку за просрочку', 'ru')

    assert [o.op for o in ops] == ['replace_clause', 'insert_clause']
    assert reply.startswith('Уточнил срок')

    report = apply_ops(tree, ops)
    assert report.applied == 2
    assert 'до 1 марта 2025 года' in report.tree.clause_by_no('1.1').text
    assert len(report.tree.section_by_key('liability').clauses) == 2

    # Модель получила текущее дерево с номерами и просьбу пользователя.
    prompt = ' '.join(m['content'] for m in provider.calls[0])
    assert '1.1.' in prompt and 'добавь неустойку' in prompt


def test_apply_instruction_raises_on_garbage():
    p = passport()
    tree = build_skeleton(p, values(), 'ru')
    provider = FakeProvider('не JSON', 'опять не JSON')

    with pytest.raises(GenerationError):
        apply_instruction(provider, tree, 'сделай красиво', 'ru')


# ─── защита от двух ошибок разбора, найденных при обзоре ───────────────────


def test_self_numbering_is_stripped():
    """Модель нумерует пункты сама, поверх ложится наш нумератор.

    Без срезки в листе выходит «1.1. 1.1. Поставщик обязуется…».
    """
    from docengine.generate import strip_own_numbering
    from docengine.schema import Clause

    c = strip_own_numbering(Clause(text='2.3. Поставщик обязуется передать товар.'))
    assert c.text == 'Поставщик обязуется передать товар.'

    c = strip_own_numbering(Clause(text='а) в течение 10 дней'))
    assert c.text == 'в течение 10 дней'


def test_numbers_inside_text_survive():
    """Срезается только ведущий номер: сроки и суммы внутри текста — данные."""
    from docengine.generate import strip_own_numbering
    from docengine.schema import Clause

    c = strip_own_numbering(Clause(text='1.1. Цена составляет 150 000 тенге, срок 30 дней.'))
    assert c.text == 'Цена составляет 150 000 тенге, срок 30 дней.'

    c = strip_own_numbering(Clause(text='Цена составляет 150 000 тенге.'))
    assert c.text == 'Цена составляет 150 000 тенге.'


def test_subclause_numbering_stripped_too():
    from docengine.generate import strip_own_numbering
    from docengine.schema import Clause

    c = strip_own_numbering(Clause(text='4.1. Основной пункт.',
                                   subclauses=[Clause(text='4.1.1. Подпункт.')]))
    assert c.subclauses[0].text == 'Подпункт.'


def test_wrong_key_is_a_parse_miss_not_an_empty_section():
    """{"sections": …} вместо {"clauses": …} обязано вызвать повтор.

    Иначе промах мимо схемы выглядит как «модель решила ничего не писать»,
    и повторная попытка не запускается.
    """
    import pytest
    from pydantic import ValidationError

    from docengine.generate import SectionResult

    with pytest.raises(ValidationError):
        SectionResult(**{'sections': [{'text': 'что-то'}]})
