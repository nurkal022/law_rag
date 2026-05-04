"""Регистрация / вход / выход.

Гостям разрешено GUEST_FREE_QUESTIONS бесплатных вопросов в чате —
после этого фронтенд показывает модал с предложением зарегистрироваться.
Сама проверка лимита живёт в /api/chat (см. app.py).

Архитектура учитывает Google OAuth — поле users.google_id уже есть,
маршруты /login/google* добавим, когда подключим клиент.
"""
from datetime import datetime
import re

from flask import (
    request, jsonify, render_template, redirect, url_for, session, flash
)

from database.models import db, User
from . import auth_bp


GUEST_FREE_QUESTIONS = 5
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


# ───────────────────── routes ─────────────────────

@auth_bp.route('/register', methods=['GET', 'POST'])
def register():
    if current_user():
        return redirect(url_for('chat_page'))

    if request.method == 'GET':
        return render_template('auth/register.html')

    email = (request.form.get('email') or '').strip().lower()
    password = request.form.get('password') or ''
    full_name = (request.form.get('full_name') or '').strip()

    error = None
    if not EMAIL_RE.match(email):
        error = 'Введите корректный email'
    elif len(password) < 6:
        error = 'Пароль должен быть не короче 6 символов'
    elif User.query.filter_by(email=email).first():
        error = 'Аккаунт с таким email уже существует'

    if error:
        return render_template('auth/register.html', error=error,
                               email=email, full_name=full_name), 400

    user = User(email=email, full_name=full_name or None)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    login_user(user)
    return redirect(request.args.get('next') or url_for('chat_page'))


@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    if current_user():
        return redirect(url_for('chat_page'))

    if request.method == 'GET':
        return render_template('auth/login.html')

    email = (request.form.get('email') or '').strip().lower()
    password = request.form.get('password') or ''
    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return render_template('auth/login.html',
                               error='Неверный email или пароль',
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
