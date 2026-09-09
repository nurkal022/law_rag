"""
Ручки брифа законопроекта.

Проверка по HTTP через настоящий blueprint: контракт с интерфейсом — это
формы запроса и ответа, а не питоновские вызовы. Модель и корпус заменены
заглушками, всё остальное — настоящее.
"""

import json
import os
import sys

import pytest
from flask import Flask

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


LAW_PASSPORT = {
    'id': 'law_demo',
    'kind': 'law_project',
    'name': {'ru': 'Проект закона Республики Казахстан'},
    'family': 'legislation',
    'summary': {'ru': 'Для проверки API'},
    'form': {'ru': 'пакет'},
    'legal_basis': [{'act': 'Конституция РК', 'article': '61'}],
    'parties': [],
    'fields': [
        {'name': 'title_ru', 'label': {'ru': 'Название'}, 'group': 'subject', 'required': True},
        {'name': 'initiator', 'label': {'ru': 'Инициатор'}, 'group': 'subject', 'required': True},
        {'name': 'initiator_type', 'label': {'ru': 'Тип'}, 'type': 'select', 'group': 'subject', 'required': True,
         'options': [{'value': 'deputy', 'label': {'ru': 'Депутат'}}, {'value': 'ministry', 'label': {'ru': 'Министерство'}}]},
        {'name': 'problem_description', 'label': {'ru': 'Проблема'}, 'type': 'textarea', 'group': 'subject', 'required': True},
        {'name': 'goals', 'label': {'ru': 'Цели'}, 'type': 'textarea', 'group': 'subject', 'required': True},
        {'name': 'key_provisions', 'label': {'ru': 'Положения'}, 'type': 'textarea', 'group': 'subject'},
        {'name': 'budget_impact', 'label': {'ru': 'Бюджет'}, 'type': 'textarea', 'group': 'terms', 'required': True},
        {'name': 'implementation_timeline', 'label': {'ru': 'Срок'}, 'group': 'extra'},
    ],
    'sections': [
        {'key': 'annotation', 'title': {'ru': 'Аннотация'}, 'guidance': {'ru': 'Кратко'}},
    ],
    'essential_terms': [],
}


@pytest.fixture
def catalog(tmp_path, monkeypatch):
    import docengine.passport as pp

    (tmp_path / 'laws').mkdir()
    (tmp_path / 'laws' / 'law_demo.yaml').write_text(json.dumps(LAW_PASSPORT, ensure_ascii=False), encoding='utf-8')
    monkeypatch.setattr(pp, 'CATALOG_DIR', tmp_path)
    pp.load_catalog.cache_clear()
    yield
    pp.load_catalog.cache_clear()


@pytest.fixture
def app(catalog):
    from database.models import User, db

    application = Flask(__name__)
    application.config.update(
        SQLALCHEMY_DATABASE_URI='sqlite://',
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
        SECRET_KEY='test',
        TESTING=True,
        LLM_PROVIDER=None,
        RAG_RETRIEVER=None,
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


class ScriptedProvider:
    def __init__(self, *payloads):
        self.payloads = list(payloads)
        self.calls = []

    def chat_completion(self, messages, **kw):
        self.calls.append(messages)
        p = self.payloads.pop(0) if self.payloads else {}
        return {'content': p if isinstance(p, str) else json.dumps(p, ensure_ascii=False), 'model': 'stub'}


class FakeRetriever:
    def hybrid_search(self, query, top_k=4):
        return [{'title': 'Конституция Республики Казахстан',
                 'content': 'Статья 13. Каждый имеет право на получение квалифицированной юридической помощи.'}]


def _concept(title='О цифровых платформах юридической помощи'):
    return {
        'title_ru': title, 'title_kz': 'Заң көмегінің цифрлық платформалары туралы',
        'summary': 'Статус, реестр, защита данных.',
        'problem_description': 'Платформы вне правового поля.',
        'goals': ['Закрепить статус', 'Ввести реестр'],
        'target_audience': 'Граждане', 'current_legislation_gaps': 'Нет норм о платформах.',
        'constitutional_basis': 'Статья 13 Конституции РК',
        'key_provisions': ['Реестр ведёт Минюст'],
        'refs': [{'act': 'Конституция РК', 'article': '13', 'note': None},
                 {'act': 'ГК РК', 'article': '999', 'note': None}],
    }


CONCEPTS = {'concepts': [_concept(), _concept('О реестре операторов юридических платформ'),
                         _concept('О квалификации онлайн-консультантов')]}

BRIEF = {'type_id': 'law_demo', 'lang': 'ru', 'text': 'платформы юридической помощи', 'domain': 'civil',
         'attachments': [{'filename': 'записка.pdf', 'text': 'Обзор рынка'}]}


def test_domains_are_public_and_carry_an_example(guest):
    r = guest.get('/api/drafts/brief/domains?lang=ru')

    assert r.status_code == 200
    body = r.get_json()
    keys = {d['key'] for d in body['domains']}
    assert 'civil' in keys and 'labor' in keys
    assert body['example']['domain'] in keys
    assert len(body['example']['text']) > 50


def test_brief_returns_three_concepts_with_form_values(app, client):
    app.config['LLM_PROVIDER'] = ScriptedProvider(CONCEPTS)
    app.config['RAG_RETRIEVER'] = FakeRetriever()

    r = client.post('/api/drafts/brief', json=BRIEF)

    assert r.status_code == 200, r.get_json()
    body = r.get_json()
    assert len(body['concepts']) == 3
    first = body['concepts'][0]
    assert first['values']['title_ru'].startswith('О цифровых')
    assert first['values']['goals'] == 'Закрепить статус\nВвести реестр'
    assert first['values']['key_provisions'] == 'Реестр ведёт Минюст'
    # Выдуманная ст. 999 отсеяна, ст. 13 из корпуса осталась
    assert [ref['article'] for ref in first['refs']] == ['13']
    assert body['clarifications']['initiator_type']['kind'] == 'options'
    assert body['clarifications']['budget_impact']['chips']


def test_concept_values_plus_clarifications_make_the_form_complete(app, client):
    """Смысл всего режима: выбранный концепт и чипы дают форму, которую сервер примет."""
    app.config['LLM_PROVIDER'] = ScriptedProvider(CONCEPTS)
    body = client.post('/api/drafts/brief', json=BRIEF).get_json()
    values = dict(body['concepts'][0]['values'])
    cl = body['clarifications']
    values['initiator_type'] = cl['initiator_type']['options'][0]['value']
    values['initiator'] = cl['initiator']['suggestions'][0]
    values['budget_impact'] = cl['budget_impact']['chips'][0]['value']
    values['implementation_timeline'] = cl['implementation_timeline']['chips'][0]['value']

    required = {f['name'] for f in LAW_PASSPORT['fields'] if f.get('required')}
    assert required <= {k for k, v in values.items() if v}

    created = client.post('/api/drafts', json={'type_id': 'law_demo', 'lang': 'ru', 'values': values})
    assert created.status_code == 201, created.get_json()


def test_brief_requires_login(guest):
    assert guest.post('/api/drafts/brief', json=BRIEF).status_code == 401


def test_brief_rejects_unknown_domain_and_empty_input(app, client):
    app.config['LLM_PROVIDER'] = ScriptedProvider(CONCEPTS)
    bad = client.post('/api/drafts/brief', json={**BRIEF, 'domain': 'space'})
    assert bad.status_code == 400 and bad.get_json()['error'] == 'unknown_domain'

    empty = client.post('/api/drafts/brief', json={'type_id': 'law_demo', 'lang': 'ru', 'text': '   ', 'domain': ''})
    assert empty.status_code == 400 and empty.get_json()['error'] == 'empty_brief'


def test_brief_without_text_but_with_domain_is_enough(app, client):
    app.config['LLM_PROVIDER'] = ScriptedProvider(CONCEPTS)
    r = client.post('/api/drafts/brief', json={'type_id': 'law_demo', 'lang': 'ru', 'text': '', 'domain': 'labor'})
    assert r.status_code == 200


def test_brief_reports_model_failure_honestly(app, client):
    app.config['LLM_PROVIDER'] = ScriptedProvider('мусор', 'снова мусор')
    r = client.post('/api/drafts/brief', json=BRIEF)

    assert r.status_code == 502
    assert r.get_json()['error'] == 'brief_failed'


def test_brief_without_provider_is_a_config_error(app, client):
    r = client.post('/api/drafts/brief', json=BRIEF)
    assert r.status_code == 503


def test_avoid_titles_reach_the_model(app, client):
    provider = ScriptedProvider(CONCEPTS)
    app.config['LLM_PROVIDER'] = provider
    client.post('/api/drafts/brief', json={**BRIEF, 'avoid': ['О первом варианте']})
    prompt = ' '.join(m['content'] for m in provider.calls[0])
    assert 'О первом варианте' in prompt


def test_brief_is_rate_limited_per_hour(app, client):
    app.config['LLM_PROVIDER'] = ScriptedProvider(CONCEPTS, CONCEPTS)
    app.config['DRAFT_BRIEFS_PER_HOUR'] = 1

    assert client.post('/api/drafts/brief', json=BRIEF).status_code == 200
    second = client.post('/api/drafts/brief', json=BRIEF)
    assert second.status_code == 429
    assert second.get_json()['error'] == 'rate_limited'
