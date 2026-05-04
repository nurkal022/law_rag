from functools import wraps
from flask import render_template, redirect, url_for, session, request, current_app
from . import admin_bp


def require_admin(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get('admin_logged_in'):
            return redirect(url_for('admin.login'))
        return f(*args, **kwargs)
    return decorated


@admin_bp.route('/admin/login', methods=['GET', 'POST'])
def login():
    if session.get('admin_logged_in'):
        return redirect(url_for('admin.dashboard'))
    error = None
    if request.method == 'POST':
        from config import Config
        if (request.form.get('username') == Config.ADMIN_USERNAME and
                request.form.get('password') == Config.ADMIN_PASSWORD):
            session['admin_logged_in'] = True
            return redirect(url_for('admin.dashboard'))
        error = 'Неверный логин или пароль'
    return render_template('admin_login.html', error=error)


@admin_bp.route('/admin/logout')
def logout():
    session.pop('admin_logged_in', None)
    return redirect(url_for('admin.login'))


@admin_bp.route('/admin')
@require_admin
def dashboard():
    db_manager = current_app.db_manager
    stats = db_manager.get_documents_stats()
    return render_template('admin/dashboard.html', stats=stats, active='dashboard')


@admin_bp.route('/admin/documents')
@require_admin
def documents():
    db_manager = current_app.db_manager
    stats = db_manager.get_documents_stats()
    return render_template('admin/documents.html', stats=stats, active='documents')


@admin_bp.route('/admin/settings')
@require_admin
def settings():
    return render_template('admin/settings.html', active='settings')


@admin_bp.route('/admin/questions')
@require_admin
def questions():
    from database.models import ChatHistory, ChatFeedback
    page = request.args.get('page', 1, type=int)
    q = request.args.get('q', '').strip()
    rating_filter = request.args.get('rating', 'all')
    per_page = 25

    query = ChatHistory.query
    if q:
        query = query.filter(ChatHistory.user_query.ilike(f'%{q}%'))
    if rating_filter == 'good':
        query = query.join(ChatFeedback, ChatHistory.id == ChatFeedback.chat_history_id)\
                     .filter(ChatFeedback.rating >= 4)
    elif rating_filter == 'bad':
        query = query.join(ChatFeedback, ChatHistory.id == ChatFeedback.chat_history_id)\
                     .filter(ChatFeedback.rating < 4)
    elif rating_filter == 'none':
        query = query.outerjoin(ChatFeedback, ChatHistory.id == ChatFeedback.chat_history_id)\
                     .filter(ChatFeedback.id.is_(None))

    query = query.order_by(ChatHistory.created_at.desc())
    total_all = ChatHistory.query.count()
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)

    items = []
    for ch in pagination.items:
        fb = ChatFeedback.query.filter_by(chat_history_id=ch.id).first()
        items.append({'history': ch, 'feedback': fb})

    return render_template('admin/questions.html',
                           items=items,
                           pagination=pagination,
                           q=q,
                           rating_filter=rating_filter,
                           total=total_all,
                           active='questions')


@admin_bp.route('/admin/usage')
@require_admin
def usage_page():
    """Журнал использования модулей (чат / законы / договоры)."""
    return render_template('admin/usage.html', active='usage')


@admin_bp.route('/admin/users')
@require_admin
def users_page():
    """Список пользователей с активностью."""
    return render_template('admin/users.html', active='users')


@admin_bp.route('/admin/users/<int:user_id>')
@require_admin
def user_detail_page(user_id: int):
    from database.models import User
    user = User.query.get_or_404(user_id)
    return render_template('admin/user_detail.html', user=user, active='users')
