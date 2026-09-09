"""Регистрация / вход / выход.

Гостям разрешено GUEST_FREE_QUESTIONS бесплатных вопросов в чате —
после этого фронтенд показывает модал с предложением зарегистрироваться.
Сама проверка лимита живёт в /api/chat (см. app.py).

Договоры, генератор законопроектов и правовая аналитика закрыты для
гостей полностью — см. декоратор login_required ниже.

Архитектура учитывает Google OAuth — поле users.google_id уже есть,
маршруты /login/google* добавим, когда подключим клиент.
"""
from datetime import datetime
from functools import wraps
import re

from flask import (
    request, jsonify, render_template, redirect, url_for, session, flash
)

from database.models import db, User
from . import auth_bp


GUEST_FREE_QUESTIONS = 10
EMAIL_RE = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')


# ───────────────────── helpers (импортируются из app.py) ─────────────────────

def current_user():
    """Возвращает User или None. Кэшируется в g для одного запроса."""
    from flask import g
    if hasattr(g, '_current_user'):
        return g._current_user
    uid = session.get('user_id')
    user = db.session.get(User, uid) if uid else None
    if user and not user.is_active:
        user = None
    g._current_user = user
    return user


def login_user(user: User):
    session['user_id'] = user.id
    session.permanent = True
    user.last_login_at = datetime.utcnow()
    db.session.commit()


def logout_user():
    session.pop('user_id', None)
    from flask import g
    if hasattr(g, '_current_user'):
        delattr(g, '_current_user')


def log_usage(module: str, action: str, details: dict = None):
    """Записать событие использования. Безопасный — глотает ошибки.
    Вызывайте из любого endpoint после успешного действия."""
    try:
        import hashlib
        from database.models import UsageEvent
        ip = (request.headers.get('CF-Connecting-IP')
              or request.headers.get('X-Forwarded-For', request.remote_addr or '').split(',')[0].strip())
        ip_hash = hashlib.sha256(ip.encode()).hexdigest() if ip else None
        user = current_user()
        ev = UsageEvent(
            user_id=user.id if user else None,
            session_id=session.get('session_id'),
            ip_hash=ip_hash,
            module=module,
            action=action,
            path=request.path,
            referer=request.headers.get('Referer'),
            user_agent=(request.headers.get('User-Agent') or '')[:500],
            details=details,
        )
        db.session.add(ev)
        db.session.commit()
    except Exception as e:
        try:
            db.session.rollback()
        except Exception:
            pass
        print(f"⚠️  log_usage failed ({module}/{action}): {e}")


def login_required(view):
    """Закрывает endpoint для гостей.

    Для API (path начинается с /api/) возвращает 401 JSON — фронтенд
    показывает модал. Для GET-страниц редиректит на /login?next=<path>,
    но если запрос — это AJAX (XHR / Accept: application/json), всё равно
    отдаёт 401 JSON, чтобы клиент сам обработал.
    """
    @wraps(view)
    def wrapper(*args, **kwargs):
        if current_user():
            return view(*args, **kwargs)

        wants_json = (
            request.path.startswith('/api/')
            or request.headers.get('X-Requested-With') == 'XMLHttpRequest'
            or 'application/json' in (request.headers.get('Accept') or '')
        )
        if wants_json:
            return jsonify({
                'success': False,
                'error': 'auth_required',
                'error_type': 'auth_required',
                'message': 'Эта функция доступна только зарегистрированным пользователям',
            }), 401
        return redirect(url_for('auth.login', next=request.path))
    return wrapper


# ───────────────────── routes ─────────────────────
#
# Страницы входа и регистрации — в приложении (React): GET /login и /register
# отдаёт SPA, здесь за адресами остаётся только POST для прежних форм на
# шаблонах и помощника разработчика. Само приложение говорит JSON-ом через
# /api/auth/*: те же проверки, та же сессия, но ошибки приходят кодом и
# текстом, а не перерисованной страницей.

MIN_PASSWORD = 6

INVALID_CREDENTIALS = 'Неверная почта или пароль'


def _registration_problem(email: str, password: str):
    """(код, текст) или None. Одна проверка для формы и для JSON."""
    if not EMAIL_RE.match(email):
        return 'invalid_email', 'Введите корректный email'
    if len(password) < MIN_PASSWORD:
        return 'weak_password', f'Пароль должен быть не короче {MIN_PASSWORD} символов'
    if User.query.filter_by(email=email).first():
        return 'email_taken', 'Аккаунт с таким email уже существует'
    return None


def _create_user(email: str, password: str, full_name: str) -> User:
    user = User(email=email, full_name=full_name or None)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    login_user(user)
    return user


def _fail(code: str, message: str, status: int):
    return jsonify({'success': False, 'error': code, 'message': message}), status


def _json_field(name: str) -> str:
    data = request.get_json(silent=True) or {}
    return str(data.get(name) or '')


@auth_bp.route('/api/auth/register', methods=['POST'])
def api_register():
    email = _json_field('email').strip().lower()
    password = _json_field('password')
    full_name = _json_field('full_name').strip()

    problem = _registration_problem(email, password)
    if problem:
        return _fail(*problem, 400)

    user = _create_user(email, password, full_name)
    return jsonify({'success': True, 'user': user.to_dict()}), 201


@auth_bp.route('/api/auth/login', methods=['POST'])
def api_login():
    email = _json_field('email').strip().lower()
    password = _json_field('password')
    user = User.query.filter_by(email=email).first()
    # Одинаковый ответ для чужой почты и неверного пароля: иначе форма входа
    # превращается в способ узнать, кто у нас зарегистрирован.
    if not user or not user.check_password(password):
        return _fail('invalid_credentials', INVALID_CREDENTIALS, 401)
    login_user(user)
    return jsonify({'success': True, 'user': user.to_dict()})


@auth_bp.route('/api/auth/logout', methods=['POST'])
def api_logout():
    logout_user()
    return jsonify({'success': True})


@auth_bp.route('/register', methods=['POST'])
def register():
    if current_user():
        return redirect(url_for('chat_page'))

    email = (request.form.get('email') or '').strip().lower()
    password = request.form.get('password') or ''
    full_name = (request.form.get('full_name') or '').strip()

    problem = _registration_problem(email, password)
    if problem:
        return render_template('auth/register.html', error=problem[1],
                               email=email, full_name=full_name), 400

    _create_user(email, password, full_name)
    return redirect(request.args.get('next') or url_for('chat_page'))


@auth_bp.route('/login', methods=['POST'])
def login():
    if current_user():
        return redirect(url_for('chat_page'))

    email = (request.form.get('email') or '').strip().lower()
    password = request.form.get('password') or ''
    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return render_template('auth/login.html',
                               error=INVALID_CREDENTIALS,
                               email=email), 401
    login_user(user)
    return redirect(request.args.get('next') or url_for('chat_page'))


@auth_bp.route('/logout', methods=['POST', 'GET'])
def logout():
    logout_user()
    return redirect(url_for('index'))


@auth_bp.route('/api/auth/me')
def me():
    """Возвращает состояние пользователя для фронтенда."""
    from database.models import ChatHistory
    user = current_user()
    sid = session.get('session_id')

    if user:
        return jsonify({
            'authenticated': True,
            'user': user.to_dict(),
            'guest_remaining': None,
        })

    used = ChatHistory.query.filter_by(session_id=sid).count() if sid else 0
    return jsonify({
        'authenticated': False,
        'user': None,
        'guest_used': used,
        'guest_limit': GUEST_FREE_QUESTIONS,
        'guest_remaining': max(0, GUEST_FREE_QUESTIONS - used),
    })


# ───────────────────── Google OAuth (заготовка) ─────────────────────
# TODO: подключить Authlib и зарегистрировать приложение в Google Cloud Console.
# Когда будут client_id / client_secret — раскомментировать роуты и убрать
# заглушку ниже. Поле User.google_id уже готово.

@auth_bp.route('/login/google')
def login_google():
    return ('Google OAuth ещё не подключён. '
            'Используйте регистрацию по email.', 501)
