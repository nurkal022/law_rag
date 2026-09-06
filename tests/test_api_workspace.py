"""
Сквозная проверка библиотеки документов и дел.

Файлы настоящие: PDF и DOCX собираются в тесте и проходят через тот же приём,
разбор и хранение, что в работе. Заглушенный приём файла проверял бы только
то, что маршрут отвечает, — а ломается обычно чтение.
"""

import io
import os
import sys

import pytest
from flask import Flask

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def make_docx(paragraphs) -> bytes:
    import docx

    d = docx.Document()
    for p in paragraphs:
        d.add_paragraph(p)
    buf = io.BytesIO()
    d.save(buf)
    return buf.getvalue()


@pytest.fixture
def app(tmp_path, monkeypatch):
    from config import Config
    from database.models import User, db

    monkeypatch.setattr(Config, 'WORKSPACE_UPLOAD_DIR', str(tmp_path / 'uploads'))

    application = Flask(__name__)
    application.config.update(
        SQLALCHEMY_DATABASE_URI='sqlite://',
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
        SECRET_KEY='test', TESTING=True,
        WORKSPACE_MAX_FILE_MB=1,
        WORKSPACE_PENDING_TIMEOUT_MIN=15,
    )
    db.init_app(application)

    from blueprints.auth import auth_bp
    from blueprints.workspace import workspace_bp

    application.register_blueprint(auth_bp)
    application.register_blueprint(workspace_bp)

    with application.app_context():
        db.create_all()
        user = User(email='jurist@example.kz')
        user.set_password('x')
        db.session.add(user)
        db.session.commit()
        application.config['TEST_USER_ID'] = user.id
    return application


@pytest.fixture
def client(app):
    c = app.test_client()
    with c.session_transaction() as s:
        s['user_id'] = app.config['TEST_USER_ID']
    return c


def upload(client, name='dogovor.docx', content=None, **form):
    data = {'file': (io.BytesIO(content if content is not None
                                else make_docx(['Договор поставки', 'Пункт 1.1'])), name)}
    data.update(form)
    return client.post('/api/workspace/documents', data=data,
                       content_type='multipart/form-data')


# ─────────────────────────────── дела ───────────────────────────────


def test_guest_sees_nothing(app):
    guest = app.test_client()
    assert guest.get('/api/workspace/matters').status_code == 401
    assert guest.get('/api/workspace/documents').status_code == 401


def test_create_and_list_matter(client):
    r = client.post('/api/workspace/matters', json={'title': 'Спор с подрядчиком'})
    assert r.status_code == 201
    assert r.get_json()['matter']['title'] == 'Спор с подрядчиком'
    assert len(client.get('/api/workspace/matters').get_json()['matters']) == 1


def test_matter_needs_a_title(client):
    assert client.post('/api/workspace/matters', json={'title': '  '}).status_code == 400


def test_archived_matters_are_hidden_by_default(client):
    mid = client.post('/api/workspace/matters', json={'title': 'Старое'}).get_json()['matter']['id']
    client.patch(f'/api/workspace/matters/{mid}', json={'is_archived': True})
    assert client.get('/api/workspace/matters').get_json()['matters'] == []
    assert len(client.get('/api/workspace/matters?archived=1').get_json()['matters']) == 1


def test_deleting_a_matter_keeps_its_documents(client):
    """Папка — способ группировки, а не владелец: документы переживают дело."""
    mid = client.post('/api/workspace/matters', json={'title': 'Дело'}).get_json()['matter']['id']
    doc = upload(client, matter_id=str(mid)).get_json()['document']
    assert doc['matter_id'] == mid

    r = client.delete(f'/api/workspace/matters/{mid}')
    assert r.status_code == 200 and r.get_json()['documents_freed'] == 1
    assert client.get(f'/api/workspace/documents/{doc["id"]}').status_code == 200


# ──────────────────────────── приём файла ────────────────────────────


def test_upload_answers_immediately_and_indexes_later(client):
    """Ответ не ждёт разбора текста: документ обязан появиться в списке сразу."""
    r = upload(client)
    assert r.status_code == 201
    doc = r.get_json()['document']
    assert doc['status'] == 'pending'
    assert doc['title'] == 'dogovor'
    assert doc['versions_count'] == 1


def test_same_file_twice_is_one_document(client):
    """Иначе библиотека зарастает копиями одного договора под разными именами."""
    content = make_docx(['Один и тот же текст'])
    first = upload(client, 'a.docx', content).get_json()['document']
    again = upload(client, 'b.docx', content)
    assert again.get_json()['duplicate'] is True
    assert again.get_json()['document']['id'] == first['id']
    assert len(client.get('/api/workspace/documents').get_json()['documents']) == 1


def test_unsupported_format_is_refused_with_a_readable_reason(client):
    r = upload(client, 'photo.jpg', b'\xff\xd8\xff')
    assert r.status_code == 415
    assert 'jpg' in r.get_json()['message']


def test_empty_file_is_refused(client):
    assert upload(client, 'empty.txt', b'').status_code == 415


def test_oversized_file_is_refused_and_leaves_no_trace(app, client):
    """Недописанный файл на диске хуже отсутствующего: он выглядит целым."""
    from workspace.storage import uploads_root

    r = upload(client, 'big.txt', b'x' * (2 * 1024 * 1024))
    assert r.status_code == 413

    with app.app_context():
        leftovers = list(uploads_root().rglob('*.txt'))
    assert leftovers == []


def test_filename_cannot_escape_the_storage(client):
    """Имя файла присылает пользователь; до файловой системы оно не доходит."""
    r = upload(client, '../../../etc/passwd.txt', 'текст документа'.encode())
    assert r.status_code == 201
    doc = client.get(f"/api/workspace/documents/{r.get_json()['document']['id']}").get_json()
    assert '/' not in doc['document']['original_filename']


# ─────────────────────────── чужие документы ───────────────────────────


def test_other_users_document_does_not_exist(app, client):
    from database.models import User, db

    doc_id = upload(client).get_json()['document']['id']
    with app.app_context():
        other = User(email='other@example.kz')
        other.set_password('x')
        db.session.add(other)
        db.session.commit()
        other_id = other.id

    c2 = app.test_client()
    with c2.session_transaction() as s:
        s['user_id'] = other_id

    assert c2.get(f'/api/workspace/documents/{doc_id}').status_code == 404
    assert c2.get(f'/api/workspace/documents/{doc_id}/file').status_code == 404
    assert c2.delete(f'/api/workspace/documents/{doc_id}').status_code == 404
    assert c2.get('/api/workspace/documents').get_json()['documents'] == []


# ──────────────────────────── чтение и версии ────────────────────────────


def test_text_is_extracted_in_full(client):
    """Прежняя загрузка обрывала текст на восьми тысячах знаков — здесь нет."""
    long_text = ['Пункт номер {} с содержательным текстом договора.'.format(i)
                 for i in range(400)]
    doc_id = upload(client, 'long.docx', make_docx(long_text)).get_json()['document']['id']
    r = client.get(f'/api/workspace/documents/{doc_id}/text')
    assert r.status_code == 200
    body = r.get_json()
    assert body['length'] > 8000
    assert 'Пункт номер 399' in body['text']


def test_new_version_replaces_the_file_and_keeps_the_old_one(client):
    doc_id = upload(client, 'v1.docx', make_docx(['Первая редакция'])).get_json()['document']['id']
    r = client.post(
        f'/api/workspace/documents/{doc_id}/versions',
        data={'file': (io.BytesIO(make_docx(['Вторая редакция'])), 'v2.docx'),
              'note': 'правки контрагента'},
        content_type='multipart/form-data')
    assert r.status_code == 201 and r.get_json()['version'] == 2

    text = client.get(f'/api/workspace/documents/{doc_id}/text').get_json()['text']
    assert 'Вторая редакция' in text

    doc = client.get(f'/api/workspace/documents/{doc_id}').get_json()['document']
    assert doc['versions_count'] == 2
    assert doc['status'] == 'pending'  # переиндексация обязательна
    assert doc['versions'][0]['note'] == 'правки контрагента'


def test_uploading_the_same_file_as_a_version_is_refused(client):
    content = make_docx(['Без изменений'])
    doc_id = upload(client, 'v1.docx', content).get_json()['document']['id']
    r = client.post(f'/api/workspace/documents/{doc_id}/versions',
                    data={'file': (io.BytesIO(content), 'v1.docx')},
                    content_type='multipart/form-data')
    assert r.status_code == 409


def test_download_returns_the_original_file(client):
    content = make_docx(['Текст для скачивания'])
    doc_id = upload(client, 'исходник.docx', content).get_json()['document']['id']
    r = client.get(f'/api/workspace/documents/{doc_id}/file')
    assert r.status_code == 200
    assert r.data[:2] == b'PK'


def test_delete_removes_document_and_its_files(app, client):
    from workspace.storage import uploads_root

    doc_id = upload(client).get_json()['document']['id']
    assert client.delete(f'/api/workspace/documents/{doc_id}').status_code == 200
    assert client.get(f'/api/workspace/documents/{doc_id}').status_code == 404
    with app.app_context():
        assert list(uploads_root().rglob('*.docx')) == []


# ──────────────────────────── поиск и фильтры ────────────────────────────


def test_search_needs_a_real_query(client):
    assert client.get('/api/workspace/search?q=a').status_code == 400


def test_documents_filter_by_matter(client):
    mid = client.post('/api/workspace/matters', json={'title': 'Дело'}).get_json()['matter']['id']
    upload(client, 'in.docx', make_docx(['В деле']), matter_id=str(mid))
    upload(client, 'out.docx', make_docx(['Вне дела']))

    inside = client.get(f'/api/workspace/documents?matter_id={mid}').get_json()['documents']
    outside = client.get('/api/workspace/documents?matter_id=none').get_json()['documents']
    assert len(inside) == 1 and inside[0]['title'] == 'in'
    assert len(outside) == 1 and outside[0]['title'] == 'out'


def test_document_can_be_moved_between_matters(client):
    mid = client.post('/api/workspace/matters', json={'title': 'Дело'}).get_json()['matter']['id']
    doc_id = upload(client).get_json()['document']['id']
    r = client.patch(f'/api/workspace/documents/{doc_id}', json={'matter_id': mid})
    assert r.get_json()['document']['matter_id'] == mid
    r = client.patch(f'/api/workspace/documents/{doc_id}', json={'matter_id': None})
    assert r.get_json()['document']['matter_id'] is None


def test_moving_into_someone_elses_matter_is_refused(app, client):
    from database.models import Matter, User, db

    doc_id = upload(client).get_json()['document']['id']
    with app.app_context():
        other = User(email='other2@example.kz')
        other.set_password('x')
        db.session.add(other)
        db.session.commit()
        m = Matter(user_id=other.id, title='Чужое дело')
        db.session.add(m)
        db.session.commit()
        foreign_id = m.id

    r = client.patch(f'/api/workspace/documents/{doc_id}', json={'matter_id': foreign_id})
    assert r.status_code == 404


# ──────────────────────────── зависшая обработка ────────────────────────────


def test_stuck_document_becomes_failed_with_a_way_out(app, client):
    """Состояние «в обработке» навсегда — тупик, из которого человек не выйдет."""
    from datetime import datetime, timedelta

    from database.models import UserDocument, db

    doc_id = upload(client).get_json()['document']['id']
    with app.app_context():
        doc = db.session.get(UserDocument, doc_id)
        doc.created_at = datetime.utcnow() - timedelta(hours=2)
        db.session.commit()

    listed = client.get('/api/workspace/documents').get_json()['documents'][0]
    assert listed['status'] == 'failed'
    assert 'переиндексировать' in listed['status_error'].lower()

    r = client.post(f'/api/workspace/documents/{doc_id}/reindex')
    assert r.status_code == 202
    assert r.get_json()['document']['status'] == 'pending'
