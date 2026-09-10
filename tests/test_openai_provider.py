"""
Параметры запроса под семейство модели.

Рассуждающие модели OpenAI (gpt-5*, o-серия) отвергают temperature, top_p и
штрафы, а лимит длины принимают только как max_completion_tokens — иначе 400.
Старые модели, наоборот, не знают reasoning_effort. Провайдер обязан подобрать
набор параметров сам: вызывающий код одинаков для всех моделей.
"""

import os
import sys
from types import SimpleNamespace

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from llm_providers.openai_provider import OpenAIProvider, completion_kwargs, is_reasoning_model  # noqa: E402


@pytest.mark.parametrize('model,expected', [
    ('gpt-4o-mini', False), ('gpt-4.1', False), ('gemma4', False),
    ('gpt-5-mini', True), ('gpt-5', True), ('gpt-5.1', True), ('o3-mini', True), ('o4-mini', True),
])
def test_reasoning_models_are_recognised_by_name(model, expected):
    assert is_reasoning_model(model) is expected


def test_classic_model_keeps_temperature_and_max_tokens():
    kw = completion_kwargs('gpt-4o-mini', temperature=0.1, max_tokens=4000, reasoning_effort='low',
                           top_p=0.9, frequency_penalty=0.1)
    assert kw == {'temperature': 0.1, 'max_tokens': 4000, 'top_p': 0.9, 'frequency_penalty': 0.1}


def test_reasoning_model_gets_only_what_it_accepts():
    kw = completion_kwargs('gpt-5-mini', temperature=0.1, max_tokens=4000, reasoning_effort='low',
                           top_p=0.9, frequency_penalty=0.1, presence_penalty=0.1)
    assert kw == {'max_completion_tokens': 4000, 'reasoning_effort': 'low'}


def test_json_mode_survives_for_reasoning_models():
    kw = completion_kwargs('gpt-5-mini', temperature=0.2, max_tokens=1000, reasoning_effort='minimal',
                           response_format={'type': 'json_object'})
    assert kw['response_format'] == {'type': 'json_object'}
    assert 'temperature' not in kw


class FakeCompletions:
    def __init__(self):
        self.calls = []

    def create(self, **kw):
        self.calls.append(kw)
        return SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(content='  ответ  '))],
            model=kw['model'] + '-2025-08-07',
            usage=SimpleNamespace(prompt_tokens=10, completion_tokens=5, total_tokens=15),
        )


def _provider_with_fake_client():
    provider = OpenAIProvider.__new__(OpenAIProvider)
    completions = FakeCompletions()
    provider.client = SimpleNamespace(chat=SimpleNamespace(completions=completions))
    provider.default_model = 'gpt-4o-mini'
    provider.base_url = None
    return provider, completions


def test_chat_completion_translates_parameters_for_gpt5(monkeypatch):
    monkeypatch.setenv('LLM_REASONING_EFFORT', 'minimal')
    from config import Config
    monkeypatch.setattr(Config, 'LLM_REASONING_EFFORT', 'minimal')
    provider, completions = _provider_with_fake_client()

    result = provider.chat_completion([{'role': 'user', 'content': 'q'}], model='gpt-5-mini',
                                      temperature=0.1, max_tokens=4000, top_p=0.9)

    sent = completions.calls[0]
    assert sent['model'] == 'gpt-5-mini'
    assert sent['max_completion_tokens'] == 4000
    assert sent['reasoning_effort'] == 'minimal'
    assert 'temperature' not in sent and 'top_p' not in sent and 'max_tokens' not in sent
    assert result['content'] == 'ответ'
    assert result['model'] == 'gpt-5-mini-2025-08-07'


def test_chat_completion_keeps_the_classic_shape_for_gpt4o():
    provider, completions = _provider_with_fake_client()
    provider.chat_completion([{'role': 'user', 'content': 'q'}], model='gpt-4o-mini',
                             temperature=0.1, max_tokens=4000, top_p=0.9)
    sent = completions.calls[0]
    assert sent['temperature'] == 0.1 and sent['max_tokens'] == 4000 and sent['top_p'] == 0.9
    assert 'reasoning_effort' not in sent and 'max_completion_tokens' not in sent
