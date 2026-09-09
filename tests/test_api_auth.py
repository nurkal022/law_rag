"""
Вход и регистрация из приложения.

Страницы входа живут в React и говорят с сервером JSON-ом; прежние формы
на шаблонах остаются только для POST. Проверяется контракт по HTTP через
настоящий blueprint и настоящую сессию: после удачного входа /api/auth/me
обязан знать пользователя — иначе шапка так и покажет «Войти».
"""

import os
import sys

import pytest
from flask import Flask

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


@pytest.fixture
def app():
    from database.models import User, db

    application = Flask(__name__)
    application.config.update(
        SQLALCHEMY_DATABASE_URI='sqlite://',
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
        SECRET_KEY='test',
        TESTING=True,
    )
    db.init_app(application)

    from blueprints.auth import auth_bp
    application.register_blueprint(auth_bp)
    # Прежние формы после входа редиректят на chat_page — в приложении это SPA.
    application.add_url_rule('/chat', endpoint='chat_page', view_func=lambda: 'chat')

    with application.app_context():
        db.create_all()
        user = User(email='jurist@example.kz', full_name='Тестовый юрист')
        user.set_password('secret-123')
        db.session.add(user)
        db.session.commit()
    return application


@pytest.fixture
def client(app):
    return app.test_client()


def me(client):
    return client.get('/api/auth/me').get_json()


# ----------------------------------------------------------------- вход


def test_login_with_valid_credentials_opens_a_session(client):
    r = client.post('/api/auth/login', json={'email': 'jurist@example.kz', 'password': 'secret-123'})

    assert r.status_code == 200
    body = r.get_json()
    assert body['success'] is True
    assert body['user']['email'] == 'jurist@example.kz'
    assert me(client)['authenticated'] is True
    assert me(client)['user']['full_name'] == 'Тестовый юрист'


def test_login_is_case_insensitive_on_email(client):
    r = client.post('/api/auth/login', json={'email': '  Jurist@Example.KZ ', 'password': 'secret-123'})
    assert r.status_code == 200


def test_login_with_wrong_password_is_refused_without_a_session(client):
    r = client.post('/api/auth/login', json={'email': 'jurist@example.kz', 'password': 'nope'})

    assert r.status_code == 401
    body = r.get_json()
    assert body['success'] is False
    assert body['error'] == 'invalid_credentials'
    assert body['message']
    assert me(client)['authenticated'] is False


def test_login_with_unknown_email_looks_the_same_as_wrong_password(client):
    """Ответ не должен выдавать, есть ли такая почта в базе."""
    wrong = client.post('/api/auth/login', json={'email': 'jurist@example.kz', 'password': 'nope'}).get_json()
    unknown = client.post('/api/auth/login', json={'email': 'nobody@example.kz', 'password': 'nope'}).get_json()
    assert wrong == unknown


# ----------------------------------------------------------- регистрация


def test_register_creates_the_account_and_signs_in(client):
    r = client.post('/api/auth/register', json={
        'email': 'new@example.kz', 'password': 'long-enough-1', 'full_name': 'Новый Пользователь',
    })

    assert r.status_code == 201
    body = r.get_json()
    assert body['success'] is True
    assert body['user']['full_name'] == 'Новый Пользователь'
    assert me(client)['authenticated'] is True


@pytest.mark.parametrize('payload, code', [
    ({'email': 'not-an-email', 'password': 'long-enough-1'}, 'invalid_email'),
    ({'email': 'ok@example.kz', 'password': 'short'}, 'weak_password'),
    ({'email': 'jurist@example.kz', 'password': 'long-enough-1'}, 'email_taken'),
])
def test_register_rejects_bad_input_with_a_machine_code(client, payload, code):
    r = client.post('/api/auth/register', json=payload)

    assert r.status_code == 400
    body = r.get_json()
    assert body['success'] is False
    assert body['error'] == code
    assert body['message']
    assert me(client)['authenticated'] is False


# ------------------------------------------------------------------ выход


def test_logout_over_api_ends_the_session(client):
    client.post('/api/auth/login', json={'email': 'jurist@example.kz', 'password': 'secret-123'})
    assert me(client)['authenticated'] is True

    r = client.post('/api/auth/logout')

    assert r.status_code == 200
    assert me(client)['authenticated'] is False


# ------------------------------------------------- страницы отдаёт приложение


def test_blueprint_no_longer_answers_get_login_and_register(client):
    """GET /login и /register — страницы React; blueprint оставляет за собой
    только POST для прежних форм. Здесь SPA не подключён, поэтому GET даёт 405,
    а в приложении тот же адрес отдаёт index.html."""
    assert client.get('/login').status_code == 405
    assert client.get('/register').status_code == 405


def test_legacy_form_post_still_signs_in(client):
    """Старые формы (и помощник разработчика) шлют form-data — это работает."""
    r = client.post('/login', data={'email': 'jurist@example.kz', 'password': 'secret-123'})
    assert r.status_code == 302
    assert me(client)['authenticated'] is True
