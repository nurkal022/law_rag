import io
from datetime import datetime, timedelta
import json as _json

from flask import request, jsonify, session, redirect, url_for, send_file, current_app
from . import admin_bp
from .routes import require_admin


# ─── Stats ───────────────────────────────────────────────────────────────────

@admin_bp.route('/api/admin/stats')
@require_admin
def api_stats():
    try:
        stats = current_app.db_manager.get_documents_stats()
        return jsonify({
            'documents': stats['documents_count'],
            'chunks': stats['chunks_count'],
            'embeddings_ready': stats['embedding_progress']
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ─── Document management ─────────────────────────────────────────────────────

@admin_bp.route('/api/admin/auto_setup', methods=['POST'])
@require_admin
def api_auto_setup():
    try:
        from config import Config
        db_manager = current_app.db_manager
        doc_processor = current_app.doc_processor
        retriever = current_app.retriever
        ensure_rag = current_app.ensure_rag_initialized

        result = {'steps': [], 'success': True}

        load_result = db_manager.bulk_load_documents_from_directory(Config.DOCUMENTS_DIR)
        result['steps'].append({
            'step': 'document_loading',
            'status': 'completed' if (load_result['loaded'] > 0 or load_result.get('skipped', 0) > 0) else 'failed',
            'message': f"Загружено {load_result['loaded']}, пропущено {load_result.get('skipped', 0)}",
        })

        stats = db_manager.get_documents_stats()
        if stats['embedded_chunks'] < stats['chunks_count'] or stats['chunks_count'] == 0:
            if not ensure_rag():
                result['steps'].append({'step': 'processing', 'status': 'failed', 'message': 'RAG не инициализирован'})
                result['success'] = False
            else:
                proc = doc_processor.process_all_documents(Config.DOCUMENTS_DIR)
                result['steps'].append({
                    'step': 'document_processing',
                    'status': 'completed' if proc['processed'] > 0 else 'failed',
                    'message': f"Обработано {proc['processed']} документов",
                })
                if proc['processed'] == 0:
                    result['success'] = False
                retriever.refresh_cache()
        else:
            result['steps'].append({'step': 'document_processing', 'status': 'skipped', 'message': 'Уже обработано'})

        result['final_stats'] = db_manager.get_documents_stats()
        return jsonify(result)
    except Exception as e:
        return jsonify({'success': False, 'error': str(e), 'steps': []}), 500


@admin_bp.route('/api/admin/load_documents', methods=['POST'])
@require_admin
def api_load_documents():
    try:
        from config import Config
        result = current_app.db_manager.bulk_load_documents_from_directory(Config.DOCUMENTS_DIR)
        return jsonify({'success': True, 'result': result,
                        'message': f"Загружено {result['loaded']}, пропущено {result.get('skipped', 0)}"})
    except Exception as e:
        import traceback
        from config import Config
        return jsonify({'success': False, 'error': str(e),
                        'traceback': traceback.format_exc() if Config.DEBUG else None}), 500


@admin_bp.route('/api/admin/process_documents', methods=['POST'])
@require_admin
def api_process_documents():
    try:
        import os
        from config import Config
        os.makedirs(Config.DOCUMENTS_DIR, exist_ok=True)

        if not current_app.ensure_rag_initialized():
            return jsonify({'success': False, 'error': 'RAG не инициализирован'}), 500

        result = current_app.doc_processor.process_all_documents(Config.DOCUMENTS_DIR)
        current_app.retriever.refresh_cache()
        total = result.get('total', result.get('processed', 0) + result.get('failed', 0))
        return jsonify({'success': True, 'result': result,
                        'message': f"Обработано {result.get('processed', 0)} из {total}"})
    except Exception as e:
        import traceback
        from config import Config
        return jsonify({'success': False, 'error': str(e),
                        'traceback': traceback.format_exc() if Config.DEBUG else None}), 500


@admin_bp.route('/api/admin/update_embeddings', methods=['POST'])
@require_admin
def api_update_embeddings():
    try:
        if not current_app.ensure_rag_initialized():
            return jsonify({'success': False, 'error': 'RAG не инициализирован'}), 500
        result = current_app.doc_processor.update_embeddings()
        current_app.retriever.refresh_cache()
        return jsonify({'success': result, 'message': 'Готово' if result else 'Ошибка'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# ─── History & feedback ───────────────────────────────────────────────────────

@admin_bp.route('/api/admin/clear_history', methods=['POST'])
@require_admin
def api_clear_history():
    try:
        from database.models import ChatHistory, ChatFeedback, db
        ChatFeedback.query.delete()
        ChatHistory.query.delete()
        db.session.commit()
        return jsonify({'success': True, 'message': 'История очищена'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# ─── Visits & online ─────────────────────────────────────────────────────────

@admin_bp.route('/api/admin/visits')
@require_admin
def api_visits():
    try:
        stats = current_app.db_manager.get_visits_stats()
        return jsonify(stats)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/api/admin/online')
@require_admin
def api_online():
    from database.models import PageVisit, ChatHistory, db
    now = datetime.utcnow()
    online_5  = db.session.query(PageVisit.ip_hash).filter(
        PageVisit.created_at >= now - timedelta(minutes=5)).distinct().count()
    online_15 = db.session.query(PageVisit.ip_hash).filter(
        PageVisit.created_at >= now - timedelta(minutes=15)).distinct().count()
    chats_1h  = ChatHistory.query.filter(
        ChatHistory.created_at >= now - timedelta(hours=1)).count()

    last = ChatHistory.query.order_by(ChatHistory.created_at.desc()).first()
    ago = None
    if last and last.created_at:
        mins = int((now - last.created_at).total_seconds() // 60)
        if mins < 1: ago = 'только что'
        elif mins < 60: ago = f'{mins} мин. назад'
        elif mins < 1440: ago = f'{mins // 60} ч. назад'
        else: ago = f'{mins // 1440} дн. назад'

    return jsonify({'online_5': online_5, 'online_15': online_15,
                    'chats_1h': chats_1h, 'last_chat_ago': ago})


# ─── Questions ───────────────────────────────────────────────────────────────

@admin_bp.route('/api/admin/questions/recent')
@require_admin
def api_questions_recent():
    from database.models import ChatHistory, ChatFeedback
    total = ChatHistory.query.count()
    good  = ChatFeedback.query.filter(ChatFeedback.rating >= 4).count()
    bad   = ChatFeedback.query.filter(ChatFeedback.rating < 4).count()
    recent = ChatHistory.query.order_by(ChatHistory.created_at.desc()).limit(5).all()
    items = []
    for ch in recent:
        fb = ChatFeedback.query.filter_by(chat_history_id=ch.id).first()
        items.append({
            'id': ch.id,
            'query': ch.user_query[:120] + ('…' if len(ch.user_query) > 120 else ''),
            'answer': ch.ai_response[:100] + ('…' if len(ch.ai_response) > 100 else ''),
            'created_at': ch.created_at.strftime('%d.%m.%Y %H:%M') if ch.created_at else '',
            'rating': fb.rating if fb else None,
        })
    return jsonify({'total': total, 'good': good, 'bad': bad, 'items': items})


@admin_bp.route('/api/admin/questions/topics')
@require_admin
def api_questions_topics():
    """Топ тем вопросов с возможностью исключения шаблонных подсказок"""
    from database.models import ChatHistory
    import re
    from collections import Counter

    # Список suggestion-вопросов из интерфейса чата
    SUGGESTION_QUERIES = {
        'Какие права имеют граждане Казахстана согласно Конституции?',
        'Как подать жалобу на действия государственных органов?',
        'Ответственность за нарушение трудового законодательства',
        'Какие документы нужны для регистрации брака в Казахстане?',
    }

    exclude_suggestions = request.args.get('exclude_suggestions', 'true').lower() == 'true'

    all_queries = [ch.user_query for ch in ChatHistory.query.with_entities(ChatHistory.user_query).all()]

    # Фильтруем suggestion-вопросы
    filtered = [q for q in all_queries if not (exclude_suggestions and q.strip() in SUGGESTION_QUERIES)]
    suggestion_count = len(all_queries) - len(filtered)

    # ── Группировка одинаковых/похожих вопросов ──────────────────────────────
    # Нормализация: нижний регистр, убираем пунктуацию
    def normalize(q):
        return re.sub(r'[^\w\s]', '', q.lower().strip())

    norm_map = {}
    for q in filtered:
        n = normalize(q)
        norm_map.setdefault(n, {'original': q, 'count': 0})
        norm_map[n]['count'] += 1

    top_queries = sorted(norm_map.values(), key=lambda x: x['count'], reverse=True)[:15]

    # ── Топ слов / ключевых тем ───────────────────────────────────────────────
    STOP_WORDS = {
        # RU
        'как', 'что', 'это', 'и', 'в', 'на', 'с', 'по', 'для', 'из', 'к', 'о',
        'от', 'при', 'за', 'до', 'или', 'не', 'да', 'но', 'а', 'то', 'же',
        'бы', 'ли', 'ни', 'уже', 'еще', 'ещё', 'так', 'он', 'она', 'они',
        'мы', 'вы', 'я', 'его', 'её', 'их', 'им', 'мне', 'что', 'кто',
        'все', 'этот', 'этого', 'этой', 'которые', 'который', 'нужны', 'нужно',
        'является', 'могут', 'могут', 'такие', 'также', 'если', 'когда',
        # EN
        'the', 'a', 'an', 'and', 'or', 'of', 'in', 'is', 'are', 'what',
        'how', 'to', 'for', 'with', 'that', 'this', 'it', 'be', 'by', 'at',
        # KZ
        'қалай', 'не', 'бұл', 'үшін', 'және', 'де', 'да', 'болып', 'болады',
    }

    word_counter = Counter()
    for q in filtered:
        words = re.findall(r'\b\w{3,}\b', q.lower())
        for w in words:
            if w not in STOP_WORDS and not w.isdigit():
                word_counter[w] += 1

    top_keywords = [{'word': w, 'count': c} for w, c in word_counter.most_common(20)]

    return jsonify({
        'total': len(all_queries),
        'filtered': len(filtered),
        'suggestion_count': suggestion_count,
        'exclude_suggestions': exclude_suggestions,
        'suggestion_queries': sorted(SUGGESTION_QUERIES),
        'top_queries': top_queries,
        'top_keywords': top_keywords,
    })


@admin_bp.route('/api/admin/export/finetune')
@require_admin
def api_export_finetune():
    try:
        min_rating = int(request.args.get('min_rating', 4))
        data = current_app.db_manager.get_finetune_data(min_rating=min_rating)
        output = io.StringIO()
        for item in data:
            output.write(_json.dumps(item, ensure_ascii=False) + '\n')
        buf = io.BytesIO(output.getvalue().encode('utf-8'))
        buf.seek(0)
        filename = f"finetune_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jsonl"
        return send_file(buf, mimetype='application/jsonl', as_attachment=True, download_name=filename)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ─── LLM settings ────────────────────────────────────────────────────────────

@admin_bp.route('/api/settings/llm', methods=['GET'])
@require_admin
def api_settings_get():
    try:
        from config import Config
        import os
        provider_type = os.getenv('LLM_PROVIDER_TYPE', 'ollama')
        model = os.getenv('LLM_MODEL', '')
        ollama_url = os.getenv('OLLAMA_BASE_URL', 'http://localhost:11434')
        finetuned_url = os.getenv('FINETUNED_API_URL', 'http://localhost:8000')
        has_openai_key = bool(os.getenv('OPENAI_API_KEY', ''))
        temperature = float(os.getenv('TEMPERATURE', 0.1))
        max_tokens = int(os.getenv('MAX_TOKENS', 4000))
        top_k = int(os.getenv('TOP_K_RESULTS', 5))

        available = False
        available_models = []
        try:
            gen = current_app.generator
            if gen:
                available = gen.is_available()
                if provider_type == 'ollama':
                    import requests as req
                    r = req.get(f'{ollama_url}/api/tags', timeout=3)
                    available_models = [m['name'] for m in r.json().get('models', [])]
        except Exception:
            pass

        return jsonify({'success': True, 'settings': {
            'provider_type': provider_type, 'model': model,
            'ollama_base_url': ollama_url, 'finetuned_api_url': finetuned_url,
            'has_openai_key': has_openai_key, 'available': available,
            'available_models': available_models,
            'temperature': temperature, 'max_tokens': max_tokens, 'top_k_results': top_k,
        }})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@admin_bp.route('/api/settings/llm', methods=['POST'])
@require_admin
def api_settings_save():
    try:
        data = request.get_json()
        _write_env_settings(data)

        # Reinit generator
        from rag.generator import LLMGenerator
        gen = LLMGenerator()
        current_app.generator = gen
        return jsonify({'success': True, 'message': 'Настройки сохранены'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@admin_bp.route('/api/settings/llm/test', methods=['POST'])
@require_admin
def api_settings_test():
    try:
        from rag.generator import LLMGenerator
        data = request.get_json()
        _write_env_settings(data)
        gen = LLMGenerator()
        if gen.is_available():
            return jsonify({'success': True, 'model_used': data.get('model', '—')})
        else:
            return jsonify({'success': False, 'error': 'Провайдер недоступен'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


def _write_env_settings(data):
    import os, re
    env_path = os.path.join(os.getcwd(), '.env')
    updates = {}
    if 'provider_type' in data: updates['LLM_PROVIDER_TYPE'] = data['provider_type']
    if 'model' in data: updates['LLM_MODEL'] = data['model']
    if 'ollama_base_url' in data: updates['OLLAMA_BASE_URL'] = data['ollama_base_url']
    if 'finetuned_api_url' in data: updates['FINETUNED_API_URL'] = data['finetuned_api_url']
    if 'openai_api_key' in data and data['openai_api_key']: updates['OPENAI_API_KEY'] = data['openai_api_key']
    if 'temperature' in data: updates['TEMPERATURE'] = str(data['temperature'])
    if 'max_tokens' in data: updates['MAX_TOKENS'] = str(data['max_tokens'])
    if 'top_k_results' in data: updates['TOP_K_RESULTS'] = str(data['top_k_results'])

    lines = []
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            lines = f.readlines()

    result = []
    written = set()
    for line in lines:
        match = re.match(r'^([A-Z_]+)\s*=', line)
        if match and match.group(1) in updates:
            key = match.group(1)
            result.append(f'{key}={updates[key]}\n')
            written.add(key)
            os.environ[key] = updates[key]
        else:
            result.append(line)

    for key, val in updates.items():
        if key not in written:
            result.append(f'{key}={val}\n')
            os.environ[key] = val

    with open(env_path, 'w') as f:
        f.writelines(result)


# ───────────────────── Usage analytics: events + users ─────────────────────

@admin_bp.route('/api/admin/usage')
@require_admin
def api_usage_events():
    """Журнал событий использования с фильтрами.
    Query: module=, action=, period=24h|7d|30d|all, user_id=, limit=, offset="""
    from database.models import UsageEvent, db

    q = UsageEvent.query

    module = request.args.get('module')
    if module:
        q = q.filter(UsageEvent.module == module)
    action = request.args.get('action')
    if action:
        q = q.filter(UsageEvent.action == action)
    user_id = request.args.get('user_id', type=int)
    if user_id:
        q = q.filter(UsageEvent.user_id == user_id)
    elif request.args.get('only_guests') == '1':
        q = q.filter(UsageEvent.user_id.is_(None))

    period = request.args.get('period', '7d')
    if period != 'all':
        delta_map = {'24h': timedelta(hours=24), '7d': timedelta(days=7), '30d': timedelta(days=30)}
        delta = delta_map.get(period, timedelta(days=7))
        q = q.filter(UsageEvent.created_at >= datetime.utcnow() - delta)

    total = q.count()
    limit = min(int(request.args.get('limit', 50)), 500)
    offset = int(request.args.get('offset', 0))

    items = q.order_by(UsageEvent.created_at.desc()).offset(offset).limit(limit).all()

    # Агрегаты по модулям/действиям за тот же период
    agg_q = q.with_entities(
        UsageEvent.module, UsageEvent.action, db.func.count(UsageEvent.id)
    ).group_by(UsageEvent.module, UsageEvent.action).all()
    by_module = {}
    for module_name, action_name, cnt in agg_q:
        by_module.setdefault(module_name, {'total': 0, 'actions': {}})
        by_module[module_name]['total'] += cnt
        by_module[module_name]['actions'][action_name] = cnt

    return jsonify({
        'total': total,
        'period': period,
        'limit': limit, 'offset': offset,
        'items': [e.to_dict() for e in items],
        'by_module': by_module,
    })


@admin_bp.route('/api/admin/users')
@require_admin
def api_users_list():
    """Список пользователей с агрегатами активности."""
    from database.models import User, UsageEvent, db
    from sqlalchemy import func

    period = request.args.get('period', '7d')
    delta_map = {'24h': timedelta(hours=24), '7d': timedelta(days=7), '30d': timedelta(days=30)}
    since = datetime.utcnow() - delta_map.get(period, timedelta(days=7)) if period != 'all' else None

    # Подзапрос: количество событий за период
    period_subq = db.session.query(
        UsageEvent.user_id, func.count(UsageEvent.id).label('events_period')
    )
    if since is not None:
        period_subq = period_subq.filter(UsageEvent.created_at >= since)
    period_subq = period_subq.group_by(UsageEvent.user_id).subquery()

    # Всего за всё время
    total_subq = db.session.query(
        UsageEvent.user_id, func.count(UsageEvent.id).label('events_total')
    ).group_by(UsageEvent.user_id).subquery()

    rows = db.session.query(
        User,
        period_subq.c.events_period,
        total_subq.c.events_total,
    ).outerjoin(period_subq, User.id == period_subq.c.user_id) \
     .outerjoin(total_subq,  User.id == total_subq.c.user_id) \
     .order_by(db.desc(db.func.coalesce(period_subq.c.events_period, 0))) \
     .all()

    users_data = []
    for user, ev_period, ev_total in rows:
        # Найдём топ-модуль за период (1 запрос на юзера, но юзеров мало)
        top_q = db.session.query(
            UsageEvent.module, func.count(UsageEvent.id).label('c')
        ).filter(UsageEvent.user_id == user.id)
        if since is not None:
            top_q = top_q.filter(UsageEvent.created_at >= since)
        top_q = top_q.group_by(UsageEvent.module).order_by(db.desc('c')).first()

        users_data.append({
            **user.to_dict(),
            'last_login_at': user.last_login_at.isoformat() if user.last_login_at else None,
            'events_period': int(ev_period or 0),
            'events_total': int(ev_total or 0),
            'top_module': top_q[0] if top_q else None,
            'is_active': user.is_active,
        })

    return jsonify({
        'period': period,
        'count': len(users_data),
        'items': users_data,
    })


@admin_bp.route('/api/admin/users/<int:user_id>/events')
@require_admin
def api_user_events(user_id: int):
    """История событий конкретного пользователя."""
    from database.models import UsageEvent
    items = UsageEvent.query.filter_by(user_id=user_id) \
        .order_by(UsageEvent.created_at.desc()).limit(200).all()
    return jsonify({'items': [e.to_dict() for e in items]})
