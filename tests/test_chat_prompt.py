"""
Промпт консультанта: отвечать на любой вопрос о праве.

Разбор 10.09.2026 показал, что строгий промпт на слабой модели отказывал там,
где надо отвечать («права человека» → «вопрос не связан с правом»), и резал
ответы до одного предложения. Новый промпт: контекст — основа, недостающее —
из знаний о праве РК с пометкой и без выдуманных номеров статей, отказ — только
на вопросы, к праву не относящиеся. Язык ответа определяется на сервере и
называется модели прямо, а не угадывается по примерам.
"""

import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import Config  # noqa: E402
from rag.generator import ResponseGenerator, build_system_prompt, detect_language  # noqa: E402


@pytest.mark.parametrize('query,lang', [
    ('Какой общий срок исковой давности?', 'ru'),
    ('казахстанское право относится ли к континентальному праву', 'ru'),
    ('Бала туылғаннан кейінгі жәрдемақы мөлшері қандай?', 'kk'),
    ('Жалақы бойынша талап ету мерзімі неше жыл болады', 'kk'),
    ('How can a foreign citizen open a business in Kazakhstan?', 'en'),
    ('Что такое LLP в Казахстане?', 'ru'),
])
def test_language_of_the_question_is_detected(query, lang):
    assert detect_language(query) == lang


def test_prompt_names_the_answer_language_explicitly():
    ru = build_system_prompt('Какой срок исковой давности?', context='[Источник 1: ГК]\nСтатья 178…')
    kk = build_system_prompt('Талап қою мерзімі қандай?', context='[Источник 1: ГК]\nСтатья 178…')
    assert 'Язык ответа: русский' in ru
    assert 'Язык ответа: казахский' in kk


def test_prompt_orders_to_answer_every_legal_question_and_not_to_refuse():
    prompt = build_system_prompt('права человека', context='[Источник 1: Конституция]\nСтатья 12…')
    assert 'любые вопросы о праве' in prompt
    assert 'Никогда не отвечайте' in prompt and 'в базе не нашлось нормы' in prompt
    # старые формулировки, из-за которых модель отказывала, исчезли
    assert 'откажитесь отвечать' not in prompt
    assert 'СТРОГО' not in prompt


def test_prompt_allows_own_knowledge_but_forbids_invented_article_numbers():
    prompt = build_system_prompt('вопрос', context='[Источник 1: ТК]\nСтатья 54…')
    assert 'По общим сведениям о законодательстве РК' in prompt
    assert 'не указывайте номер статьи, которого нет в контексте' in prompt


def test_knowledge_mark_follows_the_answer_language():
    kk = build_system_prompt('Талап қою мерзімі қандай?', context='x')
    en = build_system_prompt('What is the limitation period in Kazakhstan?', context='x')
    assert 'ҚР заңнамасы туралы жалпы мәліметтер бойынша:' in kk
    assert 'Based on general knowledge of Kazakhstan law:' in en
    assert 'По общим сведениям о законодательстве РК' not in kk


def test_prompt_without_context_still_asks_for_a_full_answer():
    prompt = build_system_prompt('казахстанское право относится ли к континентальному праву', context=None)
    assert 'Подходящих фрагментов не найдено' in prompt
    assert 'По общим сведениям о законодательстве РК' in prompt


def test_prompt_asks_for_a_long_structured_markdown_answer():
    """Коллеги сравнивают с LawVision: там медиана ответа 4750 знаков, заголовки,
    списки и таблицы. Чат теперь рисует markdown, и промпт просит той же формы."""
    prompt = build_system_prompt('вопрос', context='x')
    assert '1500–3500 знаков' in prompt
    assert 'Каждую норму называйте один раз' in prompt
    assert '**Кратко:**' in prompt
    assert '## Что говорит закон' in prompt and '## Итог' in prompt
    assert 'таблицу' in prompt
    assert 'без markdown' not in prompt.lower()


class FakeProvider:
    def __init__(self):
        self.calls = []

    def chat_completion(self, messages, **kw):
        self.calls.append({'messages': messages, **kw})
        return {'content': 'Ответ [Источник 1].', 'model': kw.get('model')}


def _generator():
    gen = ResponseGenerator.__new__(ResponseGenerator)
    gen.provider = FakeProvider()
    return gen


SOURCES = [
    {'id': 1, 'article': '12', 'title': 'Конституция Республики Казахстан'},
    {'id': 2, 'article': '17', 'title': 'Конституция Республики Казахстан'},
    {'id': 3, 'article': '', 'title': 'УПК РК'},
    {'id': 4, 'article': '18', 'title': 'Конституция Республики Казахстан'},
]


def test_in_range_cites_are_kept_in_canonical_form():
    from rag.generator import repair_cites
    assert repair_cites('Три года [Источник 1]. Также [Источник 2: Статья 17].', SOURCES) == \
        'Три года [Источник 1]. Также [Источник 2].'


def test_article_number_mistaken_for_source_number_is_mapped_back():
    from rag.generator import repair_cites
    # «[Источник 18]» — про статью 18, она в источнике 4
    assert repair_cites('Достоинство неприкосновенно [Источник 18].', SOURCES) == \
        'Достоинство неприкосновенно [Источник 4].'


def test_nonexistent_cites_vanish_with_their_commas():
    from rag.generator import repair_cites
    assert repair_cites('гарантированы [Источник 16], [Источник 99] .', SOURCES) == 'гарантированы.'


def test_cite_with_a_trailing_remark_is_still_recognised():
    from rag.generator import repair_cites
    # «36» — номер статьи из источника 4; текст после номера — просто хвост
    assert repair_cites('порядок [Источник 18 из контекста отсутствует].',
                        SOURCES) == 'порядок [Источник 4].'
    assert repair_cites('срок [Источник 1 ст. 178].', SOURCES) == 'срок [Источник 1].'
    assert repair_cites('оба [Источники 1, 2].', SOURCES) == 'оба [Источники 1, 2].'
    assert repair_cites('оба [Источник 1 и 2].', SOURCES) == 'оба [Источники 1, 2].'


def test_group_of_cites_collapses_into_one_mark():
    from rag.generator import repair_cites
    out = repair_cites('права [Источник 1], [Источник 18] и [Источник 1].', SOURCES)
    assert out == 'права [Источники 1, 4].'


def test_identity_answer_names_dalel_and_no_one_else():
    from rag.generator import _identity_answer
    ru, kk, en = _identity_answer('кто ты?'), _identity_answer('сен кімсің'), _identity_answer('who are you')
    assert 'Dalel' in ru and 'LawVision' not in ru
    assert 'Dalel' in kk and 'Dalel' in en
    assert _identity_answer('Как открыть ИП?') is None


def test_greetings_and_thanks_get_an_instant_reply_in_their_language():
    from rag.generator import _small_talk_answer
    assert _small_talk_answer('спасибо, ты мне очень помог').startswith('Пожалуйста')
    assert _small_talk_answer('Привет!').startswith('Здравствуйте')
    assert 'Сәлеметсіз' in _small_talk_answer('сәлем')
    assert 'Рақмет' not in _small_talk_answer('көп рақмет') and 'Оқасы жоқ' in _small_talk_answer('көп рақмет')
    assert _small_talk_answer('thank you').startswith('You are welcome')


def test_section_titles_follow_the_answer_language():
    kk = build_system_prompt('Талап қою мерзімі қандай?', context='x')
    en = build_system_prompt('What is the limitation period?', context='x')
    assert '## Заң не дейді' in kk and '**Қысқаша:**' in kk and '## Что говорит закон' not in kk
    assert '## What the law says' in en and '**In short:**' in en


def test_gibberish_gets_a_request_to_rephrase_but_abbreviations_do_not():
    from rag.generator import _gibberish_answer
    assert _gibberish_answer('dfsfsd').startswith('I could not read')
    assert _gibberish_answer('фвпрлд').startswith('Не разобрал')
    assert _gibberish_answer('ыфвыфв') is None  # есть гласная — на всякий случай отдаём модели
    assert _gibberish_answer('ГК') is None
    assert _gibberish_answer('Как открыть ИП?') is None


def test_a_greeting_with_a_question_goes_to_the_model():
    from rag.generator import _small_talk_answer
    assert _small_talk_answer('Привет, как открыть ИП?') is None
    assert _small_talk_answer('dfsfsd') is None
    assert _small_talk_answer('Какой общий срок исковой давности?') is None


def test_prompt_tells_to_skip_irrelevant_fragments():
    prompt = build_system_prompt('вопрос', context='x')
    assert 'остальные молча пропускайте' in prompt
    assert 'бессмысленный набор символов' in prompt


def test_prompt_keeps_greetings_short_and_headers_exact():
    prompt = build_system_prompt('вопрос', context='x')
    assert 'без заголовков и списков' in prompt
    assert '«## Что говорит закон»' in prompt


def test_context_labels_carry_the_article_not_the_file_offset():
    gen = ResponseGenerator.__new__(ResponseGenerator)
    ctx = gen._prepare_context([
        {'title': 'Конституция Республики Казахстан', 'start_position': 13000, 'end_position': 14000,
         'full_content': 'Раздел II Человек и гражданин\nСтатья 18\n1. Каждый имеет право…'},
        {'title': 'Закон РК «О правовых актах»', 'start_position': 0, 'end_position': 900,
         'full_content': 'Глава 1. Общие положения'},
    ])
    assert '[Источник 1: Конституция Республики Казахстан, статья 18]' in ctx
    assert '[Источник 2: Закон РК «О правовых актах»]' in ctx
    assert 'позиция' not in ctx


def test_consultant_uses_the_chat_model_not_the_drafting_one(monkeypatch):
    monkeypatch.setattr(Config, 'LLM_MODEL', 'gpt-4o-mini')
    monkeypatch.setattr(Config, 'CHAT_LLM_MODEL', 'gpt-5-mini')
    gen = _generator()
    out = gen.generate_response('Какой срок исковой давности?', [{
        'title': 'Гражданский кодекс РК (Общая часть)', 'filename': 'gk.pdf',
        'start_position': 0, 'end_position': 10, 'chunk_index': 0, 'similarity_score': 0.8,
        'preview': 'Статья 178…', 'full_content': 'Статья 178. Общий срок исковой давности — три года.',
    }])
    call = gen.provider.calls[0]
    assert call['model'] == 'gpt-5-mini'
    assert call['messages'][0]['role'] == 'system'
    assert 'Статья 178' in call['messages'][0]['content']
    assert 'Язык ответа: русский' in call['messages'][0]['content']
    assert out['sources'][0]['article'] == '178'


def test_no_context_answer_is_marked_as_model_knowledge(monkeypatch):
    monkeypatch.setattr(Config, 'CHAT_LLM_MODEL', 'gpt-5-mini')
    gen = _generator()
    out = gen.generate_response('казахстанское право относится ли к континентальному праву', [])
    assert out['used_model_knowledge'] is True
    assert 'Подходящих фрагментов не найдено' in gen.provider.calls[0]['messages'][0]['content']
