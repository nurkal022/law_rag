"""Расшифровка голосовой реплики в текст вопроса.

Записанный в браузере фрагмент уходит в OpenAI и возвращается строкой,
которую фронтенд подставляет в поле ввода. Отправку решает человек:
распознавание ошибается на именах и номерах статей, и возможность
поправить текст до отправки важнее лишнего нажатия.

Язык намеренно не указывается. Аудитория двуязычная, а проставленный
`language` заставляет сервис транслитерировать казахскую речь в русский.
"""
import logging

import requests
from flask import request, jsonify

from . import voice_bp
from config import Config

log = logging.getLogger(__name__)

# Предел OpenAI на файл — 25 МБ. Отсекаем на входе, чтобы не гонять
# заведомо отвергнутую загрузку через весь канал.
MAX_AUDIO_BYTES = 25 * 1024 * 1024

# Порог уверенности, ниже которого расшифровка считается выдумкой.
#
# На тишине модель не молчит, а уверенно возвращает случайную фразу — за один
# прогон получались «Hello», «Danke.», «Buona giornata.», «교통사고». Отличить
# её от речи по тексту нельзя, зато видно по logprobs: замеры на настоящих
# записях дали для речи (включая тихую, короткую и казахскую) не ниже -0.15,
# а для тишины и шума от -2.2 до -5.0. Порог посередине, с запасом в обе стороны.
MIN_CONFIDENCE = -1.0

TRANSCRIPTION_URL = 'https://api.openai.com/v1/audio/transcriptions'


def _fail(code: str, message: str, status: int):
    """Ответ об ошибке в общем для бэкенда виде: код для разбора, текст для человека."""
    return jsonify({'success': False, 'error': code, 'message': message}), status


@voice_bp.route('/api/chat/transcribe', methods=['POST'])
def transcribe():
    audio = request.files.get('audio')
    if audio is None:
        return _fail('no_audio', 'Запись не прикреплена', 400)

    payload = audio.read()
    if not payload:
        return _fail('empty_audio', 'Запись пустая', 400)
    if len(payload) > MAX_AUDIO_BYTES:
        return _fail('audio_too_large', 'Запись слишком длинная — говорите короче', 413)

    api_key = getattr(Config, 'OPENAI_API_KEY', '')
    if not api_key:
        return _fail('not_configured', 'Распознавание речи не настроено', 503)

    try:
        resp = requests.post(
            TRANSCRIPTION_URL,
            headers={'Authorization': f'Bearer {api_key}'},
            files={'file': (audio.filename or 'voice.webm', payload)},
            data={
                'model': Config.TRANSCRIPTION_MODEL,
                'response_format': 'json',
                'include[]': 'logprobs',
            },
            timeout=120,
        )
    except Exception:
        # Причина нужна в журнале: снаружи сбой сети и сбой ключа выглядят
        # одинаково, а разбираться приходится по логам стенда.
        log.exception('Запрос к сервису распознавания не удался')
        return _fail('upstream_unreachable', 'Сервис распознавания недоступен', 502)

    if resp.status_code != 200:
        log.error('Сервис распознавания ответил %s: %s', resp.status_code, resp.text[:500])
        return _fail('upstream_error', 'Сервис распознавания вернул ошибку', 502)

    body = resp.json()
    text = (body.get('text') or '').strip()
    if not text:
        return _fail('no_speech', 'Речь не распознана — попробуйте ещё раз', 422)

    if _confidence(body) < MIN_CONFIDENCE:
        return _fail('no_speech', 'Речь не распознана — попробуйте ещё раз', 422)

    return jsonify({'success': True, 'text': text})


def _confidence(body) -> float:
    """Средняя уверенность расшифровки; без данных — считаем достоверной.

    Отсутствие logprobs не повод выбрасывать распознанное: сервис волен их
    не прислать, и тогда единственный разумный выбор — доверять тексту.
    """
    values = [item['logprob'] for item in (body.get('logprobs') or []) if 'logprob' in item]
    if not values:
        return 0.0
    return sum(values) / len(values)
