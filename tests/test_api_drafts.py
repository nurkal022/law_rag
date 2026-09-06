"""
Сквозная проверка API документов.

Поднимается настоящее Flask-приложение на SQLite в памяти, с настоящим
blueprint и настоящей базой; заглушены только модель и очередь. Смысл именно
в этом: контракт с фронтендом — это HTTP, и проверять его надо по HTTP,
а не вызовами питоновских функций в обход маршрутов.
"""

import json
import os
import sys

import pytest
from flask import Flask

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from docengine.passport import Passport  # noqa: E402


@pytest.fixture
def catalog(tmp_path, monkeypatch):
    """Паспорт-минимум на диске: тесты не должны зависеть от боевого каталога."""
    import docengine.passport as pp

    d = tmp_path / 'contracts'
    d.mkdir()
    (d / 'demo.yaml').write_text(json.dumps({
        'id': 'demo',
        'kind': 'contract',
        'name': {'ru': 'Демонстрационный договор'},
        'family': 'services',
        'summary': {'ru': 'Для проверки API'},
        'form': {'ru': 'простая письменная'},
        'legal_basis': [{'act': 'ГК РК', 'article': '683'}],
        'parties': [{'role': {'ru': 'Заказчик'}}, {'role': {'ru': 'Исполнитель'}}],
        'fields': [
            {'name': 'subject', 'label': {'ru': 'Предмет'}, 'group': 'subject', 'required': True},
            {'name': 'price', 'label': {'ru': 'Цена'}, 'type': 'money', 'group': 'terms'},
        ],
        'sections': [
            {'key': 'subject', 'title': {'ru': 'Предмет договора'},
             'guidance': {'ru': 'Опиши услугу и результат'}},
            {'key': 'price', 'title': {'ru': 'Цена и расчёты'},
             'guidance': {'ru': 'Укажи цену, срок и порядок оплаты'}},
        ],
        'essential_terms': [
            {'key': 'subject', 'label': {'ru': 'Предмет договора'},
             'fields': ['subject'], 'section': 'subject'},
        ],
    }, ensure_ascii=False), encoding='utf-8')

    monkeypatch.setattr(pp, 'CATALOG_DIR', tmp_path)
    pp.load_catalog.cache_clear()
    yield
    pp.load_catalog.cache_clear()


@pytest.fixture
def app(catalog, monkeypatch):
    from database.models import User, db

    application = Flask(__name__)
    application.config.update(
        SQLALCHEMY_DATABASE_URI='sqlite://',
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
        SECRET_KEY='test',
        TESTING=True,
        LLM_PROVIDER=None,
    )
    db.init_app(application)

    from blueprints.auth import auth_bp
    from blueprints.drafts import drafts_bp

    application.register_blueprint(auth_bp)
    application.register_blueprint(drafts_bp)

    with application.app_context():
        db.create_all()
        user = User(email='jurist@example.kz', full_name='Тестовый юрист')
        user.set_password('x')
        db.session.add(user)
        db.session.commit()
        application.config['TEST_USER_ID'] = user.id

    return application


@pytest.fixture
def guest(app):
    return app.test_client()


@pytest.fixture
def client(app):
    c = app.test_client()
    with c.session_transaction() as s:
        s['user_id'] = app.config['TEST_USER_ID']
    return c


def _create(client, values=None):
    return client.post('/api/drafts', json={
        'type_id': 'demo',
        'lang': 'ru',
        'values': values if values is not None else {
            'subject': 'Разработка сайта',
            'price': '500000',
            'party0_name': 'ТОО «Альфа»',
            'party0_id_no': '123456789012',
            'party0_address': 'Астана, ул. Абая, 1',
            'party1_name': 'ИП Досаев',
            'party1_id_no': '987654321098',
        },
    })


# ───────────────────────────── каталог ─────────────────────────────


def test_catalog_open_to_guests(guest):
    """Каталог — витрина продукта, вход для его просмотра не нужен."""
    r = guest.get('/api/drafts/catalog?kind=contract')
    assert r.status_code == 200
    body = r.get_json()
    assert body['success'] and len(body['types']) == 1
    assert body['types'][0]['id'] == 'demo'
    assert 'services' in body['families']


def test_catalog_reports_unreviewed(guest):
    """Невычитанный юристом паспорт помечен: это нельзя скрывать от пользователя."""
    r = guest.get('/api/drafts/catalog')
    assert r.get_json()['types'][0]['reviewed'] is False


def test_passport_shape(guest):
    r = guest.get('/api/drafts/passport/demo?lang=ru')
    p = r.get_json()['passport']
    assert [f['name'] for f in p['fields']] == ['subject', 'price']
    assert [s['key'] for s in p['sections']] == ['subject', 'price']
    assert p['parties'][0]['role'] == 'Заказчик'
    assert p['essential_terms'][0]['key'] == 'subject'


def test_unknown_type_is_404(guest):
    assert guest.get('/api/drafts/passport/nope').status_code == 404


# ────────────────────────── создание документа ──────────────────────────


def test_guest_cannot_create(guest):
    assert _create(guest).status_code == 401


def test_create_returns_skeleton_immediately(client):
    """Каркас приходит без обращения к модели: лист виден сразу."""
    r = _create(client)
    assert r.status_code == 201
    draft = r.get_json()['draft']
    tree = draft['tree']
    assert draft['version'] == 0
    assert [s['key'] for s in tree['sections']] == ['subject', 'price']
    assert all(s['pending'] for s in tree['sections'])
    assert tree['requisites']['parties'][0]['name'] == 'ТОО «Альфа»'
    assert 'Заказчик' in tree['preamble']


def test_create_rejects_unknown_type(client):
    r = client.post('/api/drafts', json={'type_id': 'nope', 'values': {}})
    assert r.status_code == 404


def test_create_rejects_non_object_values(client):
    r = client.post('/api/drafts', json={'type_id': 'demo', 'values': ['нет']})
    assert r.status_code == 400


def test_missing_essential_term_is_reported(client):
    """Существенное условие не закрыто — документ обязан об этом сказать."""
    r = _create(client, values={})
    issues = r.get_json()['draft']['tree']['issues']
    codes = {i['code'] for i in issues}
    assert 'essential_term_missing' in codes
    assert any(i['level'] == 'error' for i in issues)


def test_bad_iin_is_reported(client):
    r = _create(client, values={'subject': 'х', 'party0_name': 'Иванов',
                                'party0_id_no': '123', 'party0_address': 'Астана'})
    codes = {i['code'] for i in r.get_json()['draft']['tree']['issues']}
    assert 'party_id_invalid' in codes


# ──────────────────────── чужие документы ────────────────────────


def test_other_users_draft_is_invisible(app, client):
    """В договоре лежат ИИН, адреса и суммы: чужой документ не существует."""
    from database.models import User, db

    public_id = _create(client).get_json()['draft']['id']

    with app.app_context():
        other = User(email='other@example.kz')
        other.set_password('x')
        db.session.add(other)
        db.session.commit()
        other_id = other.id

    c2 = app.test_client()
    with c2.session_transaction() as s:
        s['user_id'] = other_id

    assert c2.get(f'/api/drafts/{public_id}').status_code == 404
    assert c2.delete(f'/api/drafts/{public_id}').status_code == 404
    assert c2.get(f'/api/drafts/{public_id}/export?format=docx').status_code == 404


# ─────────────────────────── правка вручную ───────────────────────────


def test_manual_edit_locks_clause_and_makes_version(client):
    """Правленный человеком пункт защищён от перезаписи моделью."""
    from docengine.ops import Op, apply_ops
    from docengine.schema import DocTree

    public_id = _create(client).get_json()['draft']['id']

    # Наполняем каркас так, как это сделала бы генерация.
    from database.models import Draft, DraftVersion, db

    with client.application.app_context():
        draft = db.session.query(Draft).filter_by(public_id=public_id).first()
        tree = DocTree(**draft.head().tree_json)
        tree = apply_ops(tree, [Op(op='replace_section', key='subject',
                                   clauses=[{'text': 'Исполнитель оказывает услуги.'}])]).tree
        draft.current_version = 1
        db.session.add(DraftVersion(draft_id=draft.id, no=1,
                                    tree_json=tree.model_dump(mode='json'), created_by='llm'))
        db.session.commit()

    r = client.put(f'/api/drafts/{public_id}/clauses/1.1',
                   json={'text': 'Исполнитель оказывает услуги по разработке сайта.'})
    assert r.status_code == 200
    draft = r.get_json()['draft']
    assert draft['version'] == 2
    clause = draft['tree']['sections'][0]['clauses'][0]
    assert clause['locked'] is True
    assert clause['text'].endswith('разработке сайта.')


def test_edit_missing_clause_is_404(client):
    public_id = _create(client).get_json()['draft']['id']
    r = client.put(f'/api/drafts/{public_id}/clauses/9.9', json={'text': 'х'})
    assert r.status_code == 404


def test_revert_adds_version_instead_of_deleting_history(client):
    """Откат не стирает историю, а дописывает её: виден и сам факт отката."""
    public_id = _create(client).get_json()['draft']['id']
    client.put(f'/api/drafts/{public_id}/clauses/1.1', json={'text': 'х'})  # нет пункта, 404
    r = client.post(f'/api/drafts/{public_id}/revert', json={'version': 0})
    assert r.status_code == 200
    assert r.get_json()['draft']['version'] == 1
    versions = client.get(f'/api/drafts/{public_id}/versions').get_json()['versions']
    assert len(versions) == 2


# ──────────────────────── правка промптом без модели ────────────────────────


def test_turn_without_llm_is_503_not_500(client):
    """Модель не настроена — честный 503, а не падение."""
    public_id = _create(client).get_json()['draft']['id']
    r = client.post(f'/api/drafts/{public_id}/turns', json={'text': 'добавь штраф'})
    assert r.status_code == 503
    assert r.get_json()['error'] == 'llm_unavailable'


def test_turn_rejects_empty_and_overlong(client):
    public_id = _create(client).get_json()['draft']['id']
    assert client.post(f'/api/drafts/{public_id}/turns', json={'text': '  '}).status_code == 400
    assert client.post(f'/api/drafts/{public_id}/turns',
                       json={'text': 'a' * 3000}).status_code == 400


# ─────────────────────────────── экспорт ───────────────────────────────


def test_export_docx(client):
    public_id = _create(client).get_json()['draft']['id']
    r = client.get(f'/api/drafts/{public_id}/export?format=docx')
    assert r.status_code == 200
    assert r.data[:2] == b'PK'
    assert 'attachment' in r.headers['Content-Disposition']


def test_export_rejects_unknown_format(client):
    public_id = _create(client).get_json()['draft']['id']
    assert client.get(f'/api/drafts/{public_id}/export?format=rtf').status_code == 400


def test_export_xlsx_without_tables_is_refused(client):
    """Пустой файл Excel хуже отказа: человек решит, что данные потерялись."""
    public_id = _create(client).get_json()['draft']['id']
    r = client.get(f'/api/drafts/{public_id}/export?format=xlsx')
    assert r.status_code == 409
    assert r.get_json()['error'] == 'no_tables'


def test_preview_returns_html(client):
    public_id = _create(client).get_json()['draft']['id']
    r = client.get(f'/api/drafts/{public_id}/preview')
    assert r.status_code == 200
    assert 'ТОО «Альфа»' in r.get_json()['html']


# ──────────────────────────────── реестр ────────────────────────────────


def test_list_only_own_drafts(app, client):
    from database.models import User, db

    _create(client)
    with app.app_context():
        other = User(email='third@example.kz')
        other.set_password('x')
        db.session.add(other)
        db.session.commit()
        other_id = other.id
    c2 = app.test_client()
    with c2.session_transaction() as s:
        s['user_id'] = other_id
    _create(c2)

    assert len(client.get('/api/drafts?kind=contract').get_json()['drafts']) == 1
    assert len(c2.get('/api/drafts?kind=contract').get_json()['drafts']) == 1


def test_delete_removes_draft(client):
    public_id = _create(client).get_json()['draft']['id']
    assert client.delete(f'/api/drafts/{public_id}').status_code == 200
    assert client.get(f'/api/drafts/{public_id}').status_code == 404
