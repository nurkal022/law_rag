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


def test_prompt_without_context_still_asks_for_a_full_answer():
    prompt = build_system_prompt('казахстанское право относится ли к континентальному праву', context=None)
    assert 'Подходящих фрагментов не найдено' in prompt
    assert 'По общим сведениям о законодательстве РК' in prompt


def test_prompt_asks_for_plain_text_because_the_chat_renders_no_markdown():
    prompt = build_system_prompt('вопрос', context='x')
    assert 'без markdown' in prompt.lower()


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
