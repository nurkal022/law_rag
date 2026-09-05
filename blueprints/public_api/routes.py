"""Публичный API (/api/v1) для сторонних программ.

Аутентификация: заголовок `Authorization: Bearer <api_key>`.
Каждый успешно аутентифицированный вызов увеличивает счётчик ключа
(request_count) и обновляет last_used_at — для статистики/биллинга.
Лимитов на число запросов нет (по требованию).
"""
from functools import wraps
from datetime import datetime

from flask import request, jsonify, g, current_app

from . import public_api_bp
from database.models import db, ApiKey


def _extract_key():
    """Достаёт ключ из Authorization: Bearer <key> или заголовка X-API-Key."""
    auth = request.headers.get('Authorization', '')
    if auth.startswith('Bearer '):
        return auth[7:].strip()
    return (request.headers.get('X-API-Key') or '').strip()


def api_key_required(view):
    """Проверяет API-ключ, считает вызов, кладёт ключ в g.api_key.

    Счётчик инкрементируется ДО выполнения обработчика (учитываем сам факт
    обращения к API). Инкремент атомарен на уровне SQL (UPDATE ... + 1),
    поэтому конкурентные запросы не теряют счёт."""
    @wraps(view)
    def wrapper(*args, **kwargs):
        raw = _extract_key()
        if not raw:
            return jsonify({
                'success': False,
                'error': 'API-ключ не передан. Используйте заголовок Authorization: Bearer <key>',
                'error_code': 'missing_api_key',
            }), 401

        key = ApiKey.query.filter_by(key_hash=ApiKey.hash_key(raw), is_active=True).first()
        if not key:
            return jsonify({
                'success': False,
                'error': 'Неверный или отозванный API-ключ',
                'error_code': 'invalid_api_key',
            }), 401

        # Атомарный инкремент счётчика + отметка времени
        try:
            ApiKey.query.filter_by(id=key.id).update(
                {ApiKey.request_count: ApiKey.request_count + 1,
                 ApiKey.last_used_at: datetime.utcnow()},
                synchronize_session=False,
            )
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            current_app.logger.warning(f"api_key counter update failed: {e}")

        g.api_key = key
        return view(*args, **kwargs)
    return wrapper


# ─────────────────────────── endpoints ───────────────────────────

@public_api_bp.route('/contracts/types', methods=['GET'])
@api_key_required
def api_contract_types():
    """Справочник типов договоров и их полей."""
    templates = current_app.contract_templates
    return jsonify({'success': True, 'types': templates.get_all_types()})


@public_api_bp.route('/contracts/fields/<contract_type>', methods=['GET'])
@api_key_required
def api_contract_fields(contract_type):
    """Поля и секции конкретного типа договора (для интеграции форм)."""
    templates = current_app.contract_templates
    try:
        fields = templates.get_fields(contract_type)
        sections = templates.get_sections(contract_type)
        type_info = templates.get_type_info(contract_type)
    except (ValueError, KeyError):
        return jsonify({'success': False, 'error': 'Неизвестный тип договора',
                        'error_code': 'unknown_type'}), 404
    return jsonify({
        'success': True,
        'fields': fields,
        'sections': sections,
        'type_info': type_info,
    })


@public_api_bp.route('/contracts/analyze', methods=['POST'])
@api_key_required
def api_contract_analyze():
    """Анализ договора. Принимает JSON {text, contract_type?, language?, perspective?}
    или multipart с файлом (file). Возвращает структурированный анализ."""
    analyzer = current_app.contract_analyzer
    if not analyzer:
        return jsonify({'success': False, 'error': 'Анализатор недоступен',
                        'error_code': 'service_unavailable'}), 503

    text = ''
    contract_type = None
    language = 'ru'
    perspective = None

    if 'file' in request.files and request.files['file'].filename:
        f = request.files['file']
        text = analyzer.extract_text_from_file(f)
        contract_type = request.form.get('contract_type')
        language = request.form.get('language', 'ru')
        perspective = request.form.get('perspective') or None
    else:
        data = request.get_json(silent=True) or {}
        text = data.get('text', '')
        contract_type = data.get('contract_type')
        language = data.get('language', 'ru')
        perspective = data.get('perspective') or None

    if not text or len(text.strip()) < 50:
        return jsonify({'success': False,
                        'error': 'Текст договора слишком короткий или не удалось извлечь текст из файла',
                        'error_code': 'too_short'}), 400

    # Подключаем актуальный retriever, если RAG уже инициализирован
    retriever = getattr(current_app, 'retriever', None)
    if retriever:
        analyzer.retriever = retriever

    result = analyzer.analyze(text, contract_type, language=language, perspective=perspective)
    status = 200 if result.get('success') else 502
    return jsonify(result), status


@public_api_bp.route('/contracts/generate', methods=['POST'])
@api_key_required
def api_contract_generate():
    """Генерация договора. JSON: {contract_type, language?, ...поля из /fields}."""
    generator = current_app.contract_generator
    if not generator:
        return jsonify({'success': False, 'error': 'Генератор недоступен',
                        'error_code': 'service_unavailable'}), 503

    data = request.get_json(silent=True) or {}
    contract_type = data.pop('contract_type', None)
    language = data.pop('language', 'ru')
    if not contract_type:
        return jsonify({'success': False, 'error': 'Не указан тип договора (contract_type)',
                        'error_code': 'missing_type'}), 400

    retriever = getattr(current_app, 'retriever', None)
    if retriever:
        generator.retriever = retriever

    result = generator.generate(contract_type, data, language)
    status = 200 if result.get('success') else 502
    return jsonify(result), status


@public_api_bp.route('/usage', methods=['GET'])
@api_key_required
def api_usage():
    """Текущая статистика по ключу (счётчик вызовов)."""
    from flask import g
    k = g.api_key
    return jsonify({
        'success': True,
        'usage': {
            'name': k.name,
            'key_prefix': k.key_prefix,
            'request_count': k.request_count,
            'last_used_at': k.last_used_at.isoformat() if k.last_used_at else None,
        },
    })
