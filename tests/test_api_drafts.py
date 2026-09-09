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
            {'name': 'subject', 'label': {'ru': 'Предмет'}, 'group': 'subject', 'required': True,
             'example': {'ru': 'Разработка корпоративного сайта'}},
            {'name': 'price', 'label': {'ru': 'Цена'}, 'type': 'money', 'group': 'terms',
             'example': {'ru': '3 400 000'}},
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


def test_demo_endpoint_returns_values_for_the_whole_form(guest):
    """Кнопка «Заполнить примером» получает готовые значения формы одним запросом."""
    r = guest.get('/api/drafts/passport/demo/demo?lang=ru')

    assert r.status_code == 200
    values = r.get_json()['values']
    assert values['subject'] == 'Разработка корпоративного сайта'
    # Реквизиты сторон приходят вместе с полями: без них договор не составится.
    assert values['party0_name'] and values['party1_name']
    assert values['party0_kind'] in {'legal', 'individual', 'ip'}


def test_demo_endpoint_reports_an_unknown_type(guest):
    assert guest.get('/api/drafts/passport/nope/demo').status_code == 404


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


# ─────────────────────────── ограничение частоты ───────────────────────────


def test_generation_is_rate_limited(app, client, monkeypatch):
    """Один пользователь не должен занимать очередь генерации целиком."""
    from database.models import Job, db

    app.config['DRAFT_GENERATIONS_PER_HOUR'] = 2
    public_id = _create(client).get_json()['draft']['id']

    with app.app_context():
        user_id = app.config['TEST_USER_ID']
        for _ in range(2):
            db.session.add(Job(public_id=os.urandom(8).hex(), kind='draft.generate',
                               status='done', owner_id=user_id))
        db.session.commit()

    r = client.post(f'/api/drafts/{public_id}/generate', json={})
    assert r.status_code == 429
    assert r.get_json()['error'] == 'rate_limited'


def test_generation_allowed_under_the_limit(app, client):
    app.config['DRAFT_GENERATIONS_PER_HOUR'] = 5
    public_id = _create(client).get_json()['draft']['id']
    r = client.post(f'/api/drafts/{public_id}/generate', json={})
    assert r.status_code == 202
    assert r.get_json()['job']['status'] == 'queued'


# ──────────────────────── проверка своего договора ────────────────────────


def test_analyze_without_analyzer_is_503(client):
    public_id = _create(client).get_json()['draft']['id']
    r = client.post(f'/api/drafts/{public_id}/analyze', json={'party': 0})
    assert r.status_code == 503


def test_analyze_refuses_an_empty_skeleton(app, client):
    """Пустой каркас проверять нечего: отказ понятнее, чем разбор оглавления."""
    class Stub:
        def analyze(self, *a, **kw):
            raise AssertionError('анализатор не должен вызываться на пустом каркасе')

    app.config['CONTRACT_ANALYZER'] = Stub()
    public_id = _create(client).get_json()['draft']['id']
    r = client.post(f'/api/drafts/{public_id}/analyze', json={'party': 0})
    assert r.status_code == 409
    assert r.get_json()['error'] == 'too_short'


def test_analyze_uses_the_party_role_as_perspective(app, client):
    """Позиция задаётся ролью из договора: «Заказчик», а не «сторона 1»."""
    seen = {}

    class Stub:
        def analyze(self, text, type_id, language='ru', perspective=None):
            seen['perspective'] = perspective
            seen['length'] = len(text)
            return {'success': True, 'analysis': {'risks': []}}

    app.config['CONTRACT_ANALYZER'] = Stub()

    from database.models import Draft, DraftVersion, db
    from docengine.ops import Op, apply_ops
    from docengine.schema import DocTree

    public_id = _create(client).get_json()['draft']['id']
    with app.app_context():
        draft = db.session.query(Draft).filter_by(public_id=public_id).first()
        tree = DocTree(**draft.head().tree_json)
        tree = apply_ops(tree, [Op(op='replace_section', key='subject', clauses=[
            {'text': 'Исполнитель обязуется оказать услуги по разработке сайта. ' * 12},
        ])]).tree
        draft.current_version = 1
        db.session.add(DraftVersion(draft_id=draft.id, no=1,
                                    tree_json=tree.model_dump(mode='json'), created_by='llm'))
        db.session.commit()

    r = client.post(f'/api/drafts/{public_id}/analyze', json={'party': 1})
    assert r.status_code == 200
    assert seen['perspective'] == 'Исполнитель'
    assert r.get_json()['perspective'] == 'Исполнитель'


# ──────────────────────────────── реестр ────────────────────────────────


def test_registry_shows_type_name_not_its_code(client):
    """В реестре стоит «Демонстрационный договор», а не служебное «demo»."""
    _create(client)
    row = client.get('/api/drafts?kind=contract').get_json()['drafts'][0]
    assert row['type_name'] == 'Демонстрационный договор'


def test_registry_shows_party_names(client):
    """Стороны берутся из значений формы: грузить дерево ради двух имён — лишнее."""
    _create(client)
    row = client.get('/api/drafts?kind=contract').get_json()['drafts'][0]
    assert row['parties'] == ['ТОО «Альфа»', 'ИП Досаев']


def test_registry_survives_a_draft_without_parties(client):
    _create(client, values={'subject': 'что-то'})
    row = client.get('/api/drafts?kind=contract').get_json()['drafts'][0]
    assert row['parties'] == []


# ─────────────────── правка готового договора промптом ───────────────────
#
# Это то, ради чего затевался движок: договор уже составлен, человек пишет
# «добавь пеню за просрочку» — и меняется ровно то, что он попросил, а
# остальной документ остаётся нетронутым.


class ScriptedProvider:
    """Модель, отвечающая заранее заданным разбором указания."""

    def __init__(self, payload):
        self.payload = payload
        self.calls = []

    def chat_completion(self, messages, **kw):
        self.calls.append(messages)
        return {'content': json.dumps(self.payload, ensure_ascii=False), 'model': 'stub'}


@pytest.fixture
def drafted(app, client):
    """Договор с двумя составленными разделами."""
    from database.models import Draft, DraftVersion, db
    from docengine.ops import Op, apply_ops
    from docengine.schema import DocTree

    public_id = _create(client).get_json()['draft']['id']
    with app.app_context():
        draft = db.session.query(Draft).filter_by(public_id=public_id).first()
        tree = DocTree(**draft.head().tree_json)
        tree = apply_ops(tree, [
            Op(op='replace_section', key='subject', clauses=[
                {'text': 'Исполнитель обязуется оказать услуги по разработке сайта.'}]),
            Op(op='replace_section', key='price', clauses=[
                {'text': 'Стоимость услуг составляет 500 000 тенге.'},
                {'text': 'Оплата производится в течение 10 банковских дней.'}]),
        ]).tree
        draft.current_version = 1
        db.session.add(DraftVersion(draft_id=draft.id, no=1,
                                    tree_json=tree.model_dump(mode='json'), created_by='llm'))
        db.session.commit()
    return public_id


def test_prompt_adds_a_clause_and_leaves_the_rest_alone(app, client, drafted):
    app.config['LLM_PROVIDER'] = ScriptedProvider({
        'ops': [{'op': 'insert_clause', 'key': 'price',
                 'text': 'За просрочку оплаты начисляется пеня 0,1% за каждый день.',
                 'refs': [{'act': 'ГК РК', 'article': '353'}]}],
        'reply': 'Добавил пункт о пене за просрочку оплаты.',
    })

    r = client.post(f'/api/drafts/{drafted}/turns', json={'text': 'добавь пеню за просрочку'})
    assert r.status_code == 200

    body = r.get_json()
    assert body['applied'] == 1
    assert body['rejected'] == []
    assert 'пене' in body['reply']

    sections = body['draft']['tree']['sections']
    price = next(s for s in sections if s['key'] == 'price')
    assert [c['no'] for c in price['clauses']] == ['2.1', '2.2', '2.3']
    assert price['clauses'][2]['text'].startswith('За просрочку')

    subject = next(s for s in sections if s['key'] == 'subject')
    assert subject['clauses'][0]['text'].startswith('Исполнитель обязуется оказать')


def test_prompt_creates_a_new_version_with_a_diff(app, client, drafted):
    """Прежняя редакция остаётся: к ней можно вернуться, изменения видны по пунктам."""
    app.config['LLM_PROVIDER'] = ScriptedProvider({
        'ops': [{'op': 'replace_clause', 'no': '2.2',
                 'text': 'Оплата производится в течение 5 банковских дней.'}],
        'reply': 'Сократил срок оплаты до пяти дней.',
    })

    r = client.post(f'/api/drafts/{drafted}/turns', json={'text': 'сократи срок оплаты'})
    body = r.get_json()

    assert body['draft']['version'] == 2
    change = next(c for c in body['changes'] if c['no'] == '2.2')
    assert change['kind'] == 'changed'
    assert '10 банковских' in change['before']
    assert '5 банковских' in change['after']

    versions = client.get(f'/api/drafts/{drafted}/versions').get_json()['versions']
    assert [v['no'] for v in versions] == [2, 1, 0]

    old = client.get(f'/api/drafts/{drafted}/versions/1').get_json()['version']
    assert '10 банковских' in json.dumps(old['tree'], ensure_ascii=False)


def test_prompt_asking_for_a_missing_clause_is_reported_not_swallowed(app, client, drafted):
    """Молча проигнорированная правка хуже видимой ошибки."""
    app.config['LLM_PROVIDER'] = ScriptedProvider({
        'ops': [{'op': 'replace_clause', 'no': '9.9', 'text': 'что-то'}],
        'reply': 'Изменил пункт 9.9.',
    })

    body = client.post(f'/api/drafts/{drafted}/turns',
                       json={'text': 'поменяй девятый раздел'}).get_json()
    assert body['applied'] == 0
    assert len(body['rejected']) == 1
    assert '9.9' in body['rejected'][0]['detail']
    assert body['draft']['version'] == 1  # новая версия не заводится


def test_manual_edit_survives_a_later_prompt(app, client, drafted):
    """Формулировка, поправленная юристом, не должна исчезнуть после модели."""
    client.put(f'/api/drafts/{drafted}/clauses/1.1',
               json={'text': 'Исполнитель разрабатывает сайт по техническому заданию.'})

    app.config['LLM_PROVIDER'] = ScriptedProvider({
        'ops': [{'op': 'replace_section', 'key': 'subject',
                 'clauses': [{'text': 'Совсем другой предмет договора.'}]}],
        'reply': 'Переписал предмет договора.',
    })

    body = client.post(f'/api/drafts/{drafted}/turns',
                       json={'text': 'перепиши предмет'}).get_json()
    subject = next(s for s in body['draft']['tree']['sections'] if s['key'] == 'subject')
    texts = [c['text'] for c in subject['clauses']]
    assert 'Исполнитель разрабатывает сайт по техническому заданию.' in texts
    assert 'Совсем другой предмет договора.' in texts


def test_dialogue_is_kept(app, client, drafted):
    app.config['LLM_PROVIDER'] = ScriptedProvider({
        'ops': [{'op': 'insert_clause', 'key': 'price', 'text': 'Цена включает НДС.'}],
        'reply': 'Уточнил, что цена включает НДС.',
    })
    client.post(f'/api/drafts/{drafted}/turns', json={'text': 'уточни про НДС'})

    turns = client.get(f'/api/drafts/{drafted}/turns').get_json()['turns']
    assert [t['role'] for t in turns] == ['user', 'assistant']
    assert turns[0]['text'] == 'уточни про НДС'
    assert 'НДС' in turns[1]['text']


def test_model_sees_the_current_document(app, client, drafted):
    """Указание разбирается по нынешней редакции, иначе правка ляжет мимо."""
    provider = ScriptedProvider({'ops': [], 'reply': 'Изменений не требуется.'})
    app.config['LLM_PROVIDER'] = provider

    client.post(f'/api/drafts/{drafted}/turns', json={'text': 'проверь договор'})

    sent = json.dumps(provider.calls[0], ensure_ascii=False)
    assert 'Стоимость услуг составляет 500 000 тенге' in sent
    assert 'проверь договор' in sent


def test_revert_restores_the_previous_wording(app, client, drafted):
    app.config['LLM_PROVIDER'] = ScriptedProvider({
        'ops': [{'op': 'replace_clause', 'no': '2.1', 'text': 'Стоимость услуг — 900 000 тенге.'}],
        'reply': 'Поднял цену.',
    })
    client.post(f'/api/drafts/{drafted}/turns', json={'text': 'подними цену'})

    r = client.post(f'/api/drafts/{drafted}/revert', json={'version': 1})
    tree = r.get_json()['draft']['tree']
    price = next(s for s in tree['sections'] if s['key'] == 'price')
    assert price['clauses'][0]['text'] == 'Стоимость услуг составляет 500 000 тенге.'
    # Откат дописывает историю, а не стирает её.
    assert r.get_json()['draft']['version'] == 3


# ------------------------------------------------------ фоновое составление
#
# Интерфейс не зовёт generate_document: он ставит задачу в очередь, и разделы
# пишет обработчик draft.generate. Это единственный путь в продакшене, и
# проверять его надо через саму очередь, а не вызовом функций движка напрямую —
# иначе тесты зелёные, а составление на стенде падает на каждом разделе.


class FakeRetriever:
    """Корпус из одной нормы: достаточно, чтобы увидеть её в промпте."""

    def __init__(self):
        self.queries = []

    def hybrid_search(self, query, top_k=4):
        self.queries.append(query)
        return [{'title': 'ГК РК', 'content': 'Статья 406. Продавец обязуется передать товар в собственность покупателю.'}]


SECTION_PAYLOAD = {
    'clauses': [{'text': 'Исполнитель обязуется оказать услуги в согласованном объёме.', 'refs': []}],
    'notes': '',
}


def _generate_in_background(app, client, draft_id, body=None):
    """Ставит задачу через API и выполняет её обработчиком очереди.

    Захват задачи (FOR UPDATE SKIP LOCKED) есть только у Postgres, и на SQLite
    воркер запустить нельзя; здесь важен не захват, а сам обработчик — ему
    и отдаём ровно тот payload, что положил в очередь маршрут.
    """
    from database.models import Job, db
    from docengine.tasks import generate_draft

    r = client.post(f'/api/drafts/{draft_id}/generate', json=body or {})
    assert r.status_code == 202, r.get_json()
    job_id = r.get_json()['job']['id']
    with app.app_context():
        job = db.session.query(Job).filter_by(public_id=job_id).one()
        payload = dict(job.payload_json or {})
    generate_draft(app, payload, lambda *a: None)
    # Воркер после обработки закрывает задачу; иначе маршрут сочтёт её
    # незавершённой и следующую генерацию не поставит (already: true).
    with app.app_context():
        job = db.session.query(Job).filter_by(public_id=job_id).one()
        job.status = 'done'
        db.session.commit()
    return client.get(f'/api/drafts/{draft_id}').get_json()['draft']


def test_document_response_carries_the_running_job(app, client):
    """Страница документа открывается сразу после запуска генерации и должна
    подхватить идущую задачу, а не ждать, пока человек нажмёт что-то ещё."""
    app.config['LLM_PROVIDER'] = ScriptedProvider(SECTION_PAYLOAD)
    public_id = _create(client).get_json()['draft']['id']

    assert client.get(f'/api/drafts/{public_id}').get_json()['draft']['job'] is None

    started = client.post(f'/api/drafts/{public_id}/generate', json={})
    assert started.status_code == 202
    job = client.get(f'/api/drafts/{public_id}').get_json()['draft']['job']
    assert job and job['id'] == started.get_json()['job']['id']
    assert job['status'] == 'queued'


def test_generation_reports_stages_found_norms_and_a_growing_tree(app, client):
    """Полторы минуты генерации должны что-то показывать: какие нормы найдены,
    какой раздел пишется, что уже готово. Всё это уходит в meta прогресса."""
    app.config['LLM_PROVIDER'] = ScriptedProvider(SECTION_PAYLOAD)
    app.config['RAG_RETRIEVER'] = FakeRetriever()
    public_id = _create(client).get_json()['draft']['id']
    started = client.post(f'/api/drafts/{public_id}/generate', json={})
    from database.models import Job, db
    from docengine.tasks import generate_draft
    with app.app_context():
        job = db.session.query(Job).filter_by(public_id=started.get_json()['job']['id']).one()
        payload = dict(job.payload_json or {})

    calls = []
    generate_draft(app, payload, lambda done, total, label, meta=None: calls.append((done, total, label, meta)))

    metas = [m for *_, m in calls if m]
    assert [m['stage'] for m in metas[:2]] == ['retrieving', 'drafting']
    assert metas[1]['section'] == 'subject'
    assert metas[1]['found'] == [{'title': 'ГК РК', 'article': '406'}]

    partials = [m['partial'] for m in metas if m.get('partial')]
    filled = [sum(1 for s in p['sections'] if not s['pending']) for p in partials]
    total = len(partials[-1]['sections'])
    assert filled == sorted(filled) and set(filled) == set(range(1, total + 1)), \
        'дерево растёт на раздел за разделом и не откатывается'
    assert partials[0]['sections'][0]['clauses'][0]['no'] == '1.1', 'частичное дерево уже пронумеровано'
    # Поток читает задачу раз в секунду и событие с готовым разделом чаще всего
    # пропускает: следующее («ищу нормы» для нового раздела) его затирает.
    # Поэтому после первого готового раздела свежий лист едет с каждым событием.
    first = next(i for i, m in enumerate(metas) if m.get('partial'))
    assert all(m.get('partial') for m in metas[first:-1]), 'после первого готового раздела лист есть в каждом событии'
    assert metas[-1] == {'stage': 'checking'}


def test_progress_callback_without_meta_is_still_accepted(app, client):
    """Прежние вызывающие передают три аргумента — обработчик не должен их ронять."""
    app.config['LLM_PROVIDER'] = ScriptedProvider(SECTION_PAYLOAD)
    public_id = _create(client).get_json()['draft']['id']
    tree = _generate_in_background(app, client, public_id)['tree']
    assert all(not s['pending'] for s in tree['sections'])


def test_background_generation_fills_every_section(app, client):
    app.config['LLM_PROVIDER'] = ScriptedProvider(SECTION_PAYLOAD)
    public_id = _create(client).get_json()['draft']['id']

    tree = _generate_in_background(app, client, public_id)['tree']

    failed = [i['message'] for i in tree['issues'] if i['code'] == 'section_failed']
    assert failed == [], failed
    assert all(s['clauses'] and not s['pending'] for s in tree['sections'])


def test_background_generation_feeds_corpus_norms_into_the_prompt(app, client):
    """Обработчик обязан ходить в корпус так же, как синхронный путь: без норм
    модель пишет договор по памяти, и ссылки в нём выдуманы."""
    provider = ScriptedProvider(SECTION_PAYLOAD)
    app.config['LLM_PROVIDER'] = provider
    app.config['RAG_RETRIEVER'] = FakeRetriever()
    public_id = _create(client).get_json()['draft']['id']

    _generate_in_background(app, client, public_id)

    prompt = ' '.join(m['content'] for m in provider.calls[0])
    assert 'Статья 406' in prompt
    assert app.config['RAG_RETRIEVER'].queries, 'корпус ни разу не спросили'


def test_regeneration_hint_reaches_the_model(app, client, drafted):
    """Кнопки «Разложить расходы по годам» и поле указания шлют hint;
    потерять его по дороге — значит молча проигнорировать просьбу юриста."""
    provider = ScriptedProvider(SECTION_PAYLOAD)
    app.config['LLM_PROVIDER'] = provider

    _generate_in_background(app, client, drafted,
                            {'sections': ['price'], 'hint': 'разложи расходы по годам'})

    assert len(provider.calls) == 1
    prompt = ' '.join(m['content'] for m in provider.calls[0])
    assert 'разложи расходы по годам' in prompt


def test_regenerated_section_clears_its_old_failure_note(app, client):
    """Замечание «раздел не удалось составить» относится к попытке, а не к разделу.

    Если пересборка удалась, старое замечание обязано исчезнуть — иначе юрист
    видит одиннадцать красных строк над одиннадцатью готовыми разделами и
    решает, что документ всё ещё сломан.
    """
    # Первая попытка: модель отвечает мимо схемы — все разделы падают.
    app.config['LLM_PROVIDER'] = ScriptedProvider({'sections': []})
    public_id = _create(client).get_json()['draft']['id']
    tree = _generate_in_background(app, client, public_id)['tree']
    attempted = [s['key'] for s in tree['sections']]
    failed = sorted(i['section_key'] for i in tree['issues'] if i['code'] == 'section_failed')
    assert failed == sorted(attempted), 'первая попытка должна была уронить каждый раздел'

    # Вторая попытка удаётся.
    app.config['LLM_PROVIDER'] = ScriptedProvider(SECTION_PAYLOAD)
    tree = _generate_in_background(app, client, public_id)['tree']

    assert all(s['clauses'] and not s['pending'] for s in tree['sections'])
    stale = [i['message'] for i in tree['issues'] if i['code'] == 'section_failed']
    assert stale == [], stale


def test_failure_note_survives_when_only_other_sections_are_rebuilt(app, client):
    """Пересборка одного раздела не должна стирать честное замечание о другом."""
    app.config['LLM_PROVIDER'] = ScriptedProvider({'sections': []})
    public_id = _create(client).get_json()['draft']['id']
    _generate_in_background(app, client, public_id)

    app.config['LLM_PROVIDER'] = ScriptedProvider(SECTION_PAYLOAD)
    tree = _generate_in_background(app, client, public_id, {'sections': ['price']})['tree']

    others = sorted(s['key'] for s in tree['sections'] if s['key'] != 'price')
    failed_keys = sorted(i['section_key'] for i in tree['issues'] if i['code'] == 'section_failed')
    assert failed_keys == others
    price = next(s for s in tree['sections'] if s['key'] == 'price')
    assert price['clauses'] and not price['pending']
