"""
Расшифровка голоса в чате.

Проверка идёт по HTTP через настоящий blueprint: контракт с фронтендом —
это форма multipart и поле `text` в ответе, а не питоновские вызовы.
Заглушена одна-единственная граница — исходящий запрос к OpenAI; логика
маршрута, разбор ответа и обработка ошибок работают по-настоящему.
"""

import io
import os
import sys

import pytest
from flask import Flask

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from blueprints.voice import voice_bp  # noqa: E402
from blueprints.voice import routes as voice_routes  # noqa: E402


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(voice_routes.Config, 'OPENAI_API_KEY', 'test-key', raising=False)
    app = Flask(__name__)
    app.config['TESTING'] = True
    app.register_blueprint(voice_bp)
    return app.test_client()


class FakeResponse:
    def __init__(self, status_code=200, payload=None, text=''):
        self.status_code = status_code
        self._payload = payload if payload is not None else {}
        self.text = text

    def json(self):
        return self._payload


@pytest.fixture
def openai_calls(monkeypatch):
    """Перехватывает исходящий запрос к OpenAI и записывает, с чем его позвали."""
    calls = []

    def fake_post(url, **kwargs):
        calls.append({'url': url, **kwargs})
        return FakeResponse(payload={'text': 'Какой срок исковой давности?'})

    monkeypatch.setattr(voice_routes.requests, 'post', fake_post)
    return calls


def audio(content=b'OggS\x00fake audio bytes', name='voice.webm'):
    return {'audio': (io.BytesIO(content), name)}


def test_returns_recognised_text(client, openai_calls):
    resp = client.post('/api/chat/transcribe', data=audio(),
                       content_type='multipart/form-data')

    assert resp.status_code == 200
    assert resp.get_json()['text'] == 'Какой срок исковой давности?'


def test_sends_the_recording_to_the_transcription_service(client, openai_calls):
    client.post('/api/chat/transcribe', data=audio(content=b'OggS-payload'),
                content_type='multipart/form-data')

    assert len(openai_calls) == 1
    call = openai_calls[0]
    assert call['url'].endswith('/audio/transcriptions')
    assert call['files']['file'][1] == b'OggS-payload'


def test_language_is_not_forced(client, openai_calls):
    """Казахская и русская речь идут в один канал: язык определяет сервис.

    Стоит проставить `language`, и казахская реплика начнёт транслитерироваться
    в русский — на двуязычной аудитории это заметнее всего.
    """
    client.post('/api/chat/transcribe', data=audio(), content_type='multipart/form-data')

    assert 'language' not in openai_calls[0].get('data', {})


def test_rejects_request_without_audio(client, openai_calls):
    resp = client.post('/api/chat/transcribe', data={}, content_type='multipart/form-data')

    assert resp.status_code == 400
    assert 'error' in resp.get_json()
    assert not openai_calls, 'пустой запрос не должен уходить в OpenAI'


def test_failures_follow_the_common_error_shape(client, openai_calls):
    """`error` — машинный код, `message` — текст для человека.

    Общий загрузчик фронтенда разбирает ответы именно так. Положишь текст
    в `error` — и вместо внятной причины пользователь увидит «Файл не принят».
    """
    resp = client.post('/api/chat/transcribe', data={}, content_type='multipart/form-data')

    body = resp.get_json()
    assert body['error'] == 'no_audio'
    assert body['message'] and body['message'] != body['error']


def test_rejects_empty_recording(client, openai_calls):
    """Нажатие на микрофон без единого звука не должно стоить денег."""
    resp = client.post('/api/chat/transcribe', data=audio(content=b''),
                       content_type='multipart/form-data')

    assert resp.status_code == 400
    assert not openai_calls


def test_rejects_recording_over_the_service_limit(client, openai_calls):
    """У OpenAI жёсткий предел 25 МБ — отказываем сами, не тратя загрузку."""
    too_big = b'x' * (voice_routes.MAX_AUDIO_BYTES + 1)

    resp = client.post('/api/chat/transcribe', data=audio(content=too_big),
                       content_type='multipart/form-data')

    assert resp.status_code == 413
    assert not openai_calls


def test_reports_when_the_key_is_missing(client, monkeypatch, openai_calls):
    monkeypatch.setattr(voice_routes.Config, 'OPENAI_API_KEY', '', raising=False)

    resp = client.post('/api/chat/transcribe', data=audio(),
                       content_type='multipart/form-data')

    assert resp.status_code == 503
    assert not openai_calls


def test_reports_failure_of_the_transcription_service(client, monkeypatch):
    def failing_post(url, **kwargs):
        return FakeResponse(status_code=500, text='upstream is down')

    monkeypatch.setattr(voice_routes.requests, 'post', failing_post)

    resp = client.post('/api/chat/transcribe', data=audio(),
                       content_type='multipart/form-data')

    assert resp.status_code == 502
    assert 'error' in resp.get_json()


def test_reports_silence_as_a_clear_answer(client, monkeypatch):
    """Сервис на тишину отвечает пустой строкой; фронту нужен внятный отказ."""
    monkeypatch.setattr(voice_routes.requests, 'post',
                        lambda url, **kwargs: FakeResponse(payload={'text': '   '}))

    resp = client.post('/api/chat/transcribe', data=audio(),
                       content_type='multipart/form-data')

    assert resp.status_code == 422
    assert 'error' in resp.get_json()


def logprobs(*values):
    return [{'token': 'x', 'logprob': v} for v in values]


def test_rejects_a_guess_made_up_from_silence(client, monkeypatch):
    """На тишине модель уверенно выдумывает текст — и каждый раз новый.

    Замеры на настоящих записях: речь (в том числе тихая, короткая и
    казахская) держится в пределах -0.15, а тишина и шум дают от -2.2 до
    -5.0. Без этой отсечки человек, нажавший микрофон и промолчавший,
    получает в поле ввода случайное «Hallo» или «교통사고».
    """
    monkeypatch.setattr(
        voice_routes.requests, 'post',
        lambda url, **kwargs: FakeResponse(payload={
            'text': 'Buona giornata.',
            'logprobs': logprobs(-2.4, -5.1, -1.9),
        }))

    resp = client.post('/api/chat/transcribe', data=audio(),
                       content_type='multipart/form-data')

    assert resp.status_code == 422
    assert resp.get_json()['error'] == 'no_speech'


def test_keeps_quietly_spoken_words(client, monkeypatch):
    """Тихая и короткая речь распознаётся уверенно — её отсекать нельзя."""
    monkeypatch.setattr(
        voice_routes.requests, 'post',
        lambda url, **kwargs: FakeResponse(payload={
            'text': 'Три года.',
            'logprobs': logprobs(-0.007, -0.15, -0.0),
        }))

    resp = client.post('/api/chat/transcribe', data=audio(),
                       content_type='multipart/form-data')

    assert resp.status_code == 200
    assert resp.get_json()['text'] == 'Три года.'


def test_asks_the_service_for_confidence(client, openai_calls):
    """Без include[]=logprobs уверенности в ответе нет и отсечка слепа."""
    client.post('/api/chat/transcribe', data=audio(), content_type='multipart/form-data')

    assert openai_calls[0]['data'].get('include[]') == 'logprobs'


def test_accepts_transcription_without_confidence_data(client, openai_calls):
    """Сервис может не прислать logprobs — это не повод терять распознанное."""
    resp = client.post('/api/chat/transcribe', data=audio(),
                       content_type='multipart/form-data')

    assert resp.status_code == 200
