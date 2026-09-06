"""
Связка модулей: составленный договор попадает в библиотеку.

Это и есть смысл всей перестройки: по одному спору договор, переписка и
решение суда лежат в одном деле, а не в трёх разных разделах продукта.
Поэтому связка проверяется отдельно, а не считается деталью экспорта.
"""

import io
import json
import os
import sys

import pytest
from flask import Flask

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


@pytest.fixture
def app(tmp_path, monkeypatch):
    from config import Config
    from database.models import User, db
    import docengine.passport as pp

    monkeypatch.setattr(Config, 'WORKSPACE_UPLOAD_DIR', str(tmp_path / 'uploads'))

    d = tmp_path / 'contracts'
    d.mkdir()
    (d / 'demo.yaml').write_text(json.dumps({
        'id': 'demo', 'kind': 'contract',
        'name': {'ru': 'Демонстрационный договор'}, 'family': 'services',
        'summary': {'ru': 'Для проверки связки'}, 'form': {'ru': 'простая письменная'},
        'parties': [{'role': {'ru': 'Заказчик'}}, {'role': {'ru': 'Исполнитель'}}],
        'fields': [{'name': 'subject', 'label': {'ru': 'Предмет'}, 'group': 'subject'}],
        'sections': [{'key': 'subject', 'title': {'ru': 'Предмет договора'},
                      'guidance': {'ru': 'Опиши услугу и её результат подробно'}}],
    }, ensure_ascii=False), encoding='utf-8')
    monkeypatch.setattr(pp, 'CATALOG_DIR', tmp_path)
    pp.load_catalog.cache_clear()

    application = Flask(__name__)
    application.config.update(
        SQLALCHEMY_DATABASE_URI='sqlite://', SQLALCHEMY_TRACK_MODIFICATIONS=False,
        SECRET_KEY='test', TESTING=True, LLM_PROVIDER=None,
        WORKSPACE_MAX_FILE_MB=50, WORKSPACE_PENDING_TIMEOUT_MIN=15,
    )
    db.init_app(application)

    from blueprints.auth import auth_bp
    from blueprints.drafts import drafts_bp
    from blueprints.workspace import workspace_bp

    for bp in (auth_bp, drafts_bp, workspace_bp):
        application.register_blueprint(bp)

    with application.app_context():
        db.create_all()
        user = User(email='jurist@example.kz')
        user.set_password('x')
        db.session.add(user)
        db.session.commit()
        application.config['TEST_USER_ID'] = user.id

    yield application
    pp.load_catalog.cache_clear()


@pytest.fixture
def client(app):
    c = app.test_client()
    with c.session_transaction() as s:
        s['user_id'] = app.config['TEST_USER_ID']
    return c


def make_draft(app, client, filled=True):
    """Договор с одним составленным разделом."""
    from database.models import Draft, DraftVersion, db
    from docengine.ops import Op, apply_ops
    from docengine.schema import DocTree

    public_id = client.post('/api/drafts', json={
        'type_id': 'demo', 'lang': 'ru',
        'values': {'subject': 'Разработка сайта', 'party0_name': 'ТОО «Альфа»',
                   'party1_name': 'ИП Досаев'},
    }).get_json()['draft']['id']

    if not filled:
        return public_id

    with app.app_context():
        draft = db.session.query(Draft).filter_by(public_id=public_id).first()
        tree = DocTree(**draft.head().tree_json)
        tree = apply_ops(tree, [Op(op='replace_section', key='subject', clauses=[
            {'text': 'Исполнитель обязуется разработать сайт по заданию Заказчика.'}])]).tree
        draft.current_version = 1
        db.session.add(DraftVersion(draft_id=draft.id, no=1,
                                    tree_json=tree.model_dump(mode='json'), created_by='llm'))
        db.session.commit()
    return public_id


def test_draft_lands_in_the_library(app, client):
    public_id = make_draft(app, client)
    r = client.post(f'/api/drafts/{public_id}/to-library', json={})
    assert r.status_code == 201

    doc = r.get_json()['document']
    assert doc['source'] == 'contract'
    assert doc['title'] == 'Демонстрационный договор'

    listed = client.get('/api/workspace/documents').get_json()['documents']
    assert [d['id'] for d in listed] == [doc['id']]


def test_saved_draft_is_a_real_word_file(app, client):
    """В библиотеке лежит документ, который открывается в Word, а не запись в базе."""
    public_id = make_draft(app, client)
    doc_id = client.post(f'/api/drafts/{public_id}/to-library', json={}).get_json()['document']['id']

    r = client.get(f'/api/workspace/documents/{doc_id}/file')
    assert r.status_code == 200 and r.data[:2] == b'PK'

    text = client.get(f'/api/workspace/documents/{doc_id}/text').get_json()['text']
    assert 'Исполнитель обязуется разработать сайт' in text


def test_saving_into_a_matter_binds_both_sides(app, client):
    """Дело запоминается и на стороне договора: следующий экспорт пойдёт туда же."""
    matter_id = client.post('/api/workspace/matters',
                            json={'title': 'Спор с подрядчиком'}).get_json()['matter']['id']
    public_id = make_draft(app, client)

    r = client.post(f'/api/drafts/{public_id}/to-library', json={'matter_id': matter_id})
    assert r.get_json()['document']['matter_id'] == matter_id
    assert client.get(f'/api/drafts/{public_id}').get_json()['draft']['matter_id'] == matter_id

    inside = client.get(f'/api/workspace/documents?matter_id={matter_id}').get_json()['documents']
    assert len(inside) == 1


def test_saving_twice_does_not_duplicate(app, client):
    public_id = make_draft(app, client)
    first = client.post(f'/api/drafts/{public_id}/to-library', json={}).get_json()['document']
    again = client.post(f'/api/drafts/{public_id}/to-library', json={})
    assert again.get_json()['duplicate'] is True
    assert again.get_json()['document']['id'] == first['id']
    assert len(client.get('/api/workspace/documents').get_json()['documents']) == 1


def test_second_save_moves_the_document_into_the_named_matter(app, client):
    """Повторное сохранение чаще всего делают именно ради привязки к делу."""
    public_id = make_draft(app, client)
    client.post(f'/api/drafts/{public_id}/to-library', json={})
    matter_id = client.post('/api/workspace/matters',
                            json={'title': 'Новое дело'}).get_json()['matter']['id']

    r = client.post(f'/api/drafts/{public_id}/to-library', json={'matter_id': matter_id})
    assert r.get_json()['document']['matter_id'] == matter_id


def test_empty_draft_is_not_saved(app, client):
    """Пустой каркас в библиотеке — мусор, который потом ищут глазами."""
    public_id = make_draft(app, client, filled=False)
    r = client.post(f'/api/drafts/{public_id}/to-library', json={})
    assert r.status_code == 409
    assert client.get('/api/workspace/documents').get_json()['documents'] == []


def test_someone_elses_matter_is_refused(app, client):
    from database.models import Matter, User, db

    public_id = make_draft(app, client)
    with app.app_context():
        other = User(email='other@example.kz')
        other.set_password('x')
        db.session.add(other)
        db.session.commit()
        m = Matter(user_id=other.id, title='Чужое дело')
        db.session.add(m)
        db.session.commit()
        foreign = m.id

    r = client.post(f'/api/drafts/{public_id}/to-library', json={'matter_id': foreign})
    assert r.status_code == 404
