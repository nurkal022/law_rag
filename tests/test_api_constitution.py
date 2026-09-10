"""Контракт с фронтендом — по HTTP, на SQLite, с посеянным прогоном."""
import os
import sys
from datetime import datetime

import pytest
from flask import Flask

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


@pytest.fixture
def app(monkeypatch):
    from database.models import (ConformityFinding, ConformityRun, ConformityRunAct, Document, DocumentChunk, db)
    import blueprints.constitution.routes as routes
    from conformity.registry import ActMeta, Registry, load_registry

    application = Flask(__name__)
    application.config.update(SQLALCHEMY_DATABASE_URI='sqlite://', SQLALCHEMY_TRACK_MODIFICATIONS=False, TESTING=True)
    db.init_app(application)
    from blueprints.constitution import constitution_bp
    application.register_blueprint(constitution_bp)

    with application.app_context():
        db.create_all()

        def doc(filename, title, chunks):
            d = Document(filename=filename, title=title, content='', file_size=0)
            db.session.add(d)
            db.session.flush()
            ids = []
            for i, content in enumerate(chunks):
                c = DocumentChunk(document_id=d.id, chunk_index=i, content=content, start_position=0, end_position=1, chunk_size=1)
                db.session.add(c)
                db.session.flush()
                ids.append(c.id)
            return d, ids

        const, _ = doc('const.txt', 'Конституция Республики Казахстан (2026)', [
            'Раздел I. Основы\nСтатья 5.\nПорядок действия договоров определяется законами.',
            'Раздел IV. Курултай\nСтатья 52.\nКурултай – высший представительный орган.',
        ])
        law, law_ids = doc('law.pdf', 'Закон РК «О правовых актах»', [
            'Глава 1\nСтатья 6. Международные договоры\nДоговоры имеют приоритет перед законами.',
            'Глава 1\nСтатья 7. Виды актов\nНормативные постановления Парламента.',
            'Глава 1\nСтатья 8. Прочее\nТекст.',
        ])
        run = ConformityRun(public_id='r1', status='done', constitution_document_id=const.id, triage_model='t',
                            verify_model='v', norms_total=3, norms_done=3,
                            counts_json={'0': 1, '1': 0, '2': 1, '3': 1, 'errors': 0}, tokens_used=300,
                            started_at=datetime(2026, 9, 10, 10, 0), finished_at=datetime(2026, 9, 10, 11, 0))
        db.session.add(run)
        db.session.flush()
        db.session.add(ConformityRunAct(run_id=run.id, document_id=law.id, position=0, tier=5, code='ЗРК О ПА',
                                        norms_total=3, norms_done=3, counts_json=run.counts_json, tokens=300,
                                        started_at=run.started_at, finished_at=run.finished_at))
        rows = [
            dict(chunk_id=law_ids[0], article_no='6', article_title='Статья 6. Международные договоры', level=3,
                 category='competence', method='model+verified', constitution_articles_json=[5],
                 change_ids_json=['treaties_priority'], quote_norm='имеют приоритет', explanation='Исключён.',
                 recommendation='Пересмотреть.', model='t', tokens=100),
            dict(chunk_id=law_ids[1], article_no='7', article_title='Статья 7. Виды актов', level=2,
                 category='terminology', method='dictionary+model', constitution_articles_json=[52],
                 change_ids_json=['kurultai'], quote_norm='Парламента', explanation='Нет органа.',
                 recommendation='Заменить.', model='t', tokens=100),
            dict(chunk_id=law_ids[2], article_no='8', article_title='Статья 8. Прочее', level=0, category='none',
                 method='model', constitution_articles_json=[], change_ids_json=[], model='t', tokens=100),
        ]
        for r in rows:
            db.session.add(ConformityFinding(run_id=run.id, document_id=law.id, **r))
        db.session.commit()
        application.config['LAW_ID'] = law.id
        application.config['FINDING_LEVEL3_CHUNK'] = law_ids[0]

    with application.app_context():
        doc('code.pdf', 'Трудовой кодекс РК', ['Глава 1\nСтатья 1. Отношения\nТекст.'])  # в плане, но ещё не пройден
        db.session.commit()

    tiny = Registry(load_registry().tiers, {
        'const.txt': ActMeta('const.txt', 1, 'Конституция РК'),
        'law.pdf': ActMeta('law.pdf', 5, 'ЗРК О ПА', adilet='Z1600000480', edition='2026-01-09', url='https://adilet.zan.kz/rus/docs/Z1600000480'),
        'code.pdf': ActMeta('code.pdf', 4, 'ТК РК'),
    })
    monkeypatch.setattr(routes, 'load_registry', lambda: tiny)
    return application


@pytest.fixture
def client(app):
    return app.test_client()


def test_overview_has_run_walk_tiers_map_and_changes(client, app):
    r = client.get('/api/constitution/overview')
    assert r.status_code == 200
    body = r.get_json()
    assert body['run']['status'] == 'done' and body['run']['counts']['3'] == 1
    assert body['walk'][0]['code'] == 'ЗРК О ПА' and body['walk'][0]['norms_done'] == 3
    tiers = {t['tier']: t for t in body['tiers']}
    assert len(tiers) == 11 and tiers[5]['acts'][0]['worst'] == 3 and tiers[6]['acts'] == []
    # акт из плана, до которого обход ещё не дошёл, стоит на своём ярусе с нулями
    assert tiers[4]['acts'][0]['code'] == 'ТК РК' and tiers[4]['acts'][0]['done'] == 0 and tiers[4]['acts'][0]['norms'] == 1
    assert tiers[5]['title']['ru'] == 'Законы'
    sections = body['constitution']['sections']
    art = {a['no']: a for s in sections for a in s['articles']}
    assert art[5]['norms'] == 1 and art[5]['worst'] == 3 and art[52]['worst'] == 2
    changes = {c['id']: c for c in body['changes']}
    assert changes['treaties_priority']['norms'] == 1 and changes['kurultai']['norms'] == 1
    assert body['current'] is None


def test_act_page_lists_barcode_and_findings_with_wording(client, app):
    r = client.get(f"/api/constitution/acts/{app.config['LAW_ID']}")
    body = r.get_json()
    assert body['act']['code'] == 'ЗРК О ПА' and body['act']['tier'] == 5 and body['act']['url'].startswith('https://')
    assert [a['article_no'] for a in body['articles']] == ['6', '7', '8']
    assert [a['level'] for a in body['articles']] == [3, 2, 0]
    assert [f['level'] for f in body['findings']] == [3, 2]
    assert body['findings'][0]['wording']['ru'] == 'выявлен высокий риск несоответствия'
    assert body['wording']['1']['ru'] == 'норма требует экспертной проверки'
    assert body['findings'][0]['category_label']['ru']
    r2 = client.get(f"/api/constitution/acts/{app.config['LAW_ID']}?level=2")
    assert [f['level'] for f in r2.get_json()['findings']] == [2]
    assert client.get('/api/constitution/acts/9999').status_code == 404


def test_finding_carries_norm_text_and_constitution_articles(client):
    fid = client.get('/api/constitution/acts/2').get_json()['findings'][0]['id']
    body = client.get(f'/api/constitution/findings/{fid}').get_json()
    assert 'имеют приоритет' in body['finding']['norm_text']
    assert body['finding']['articles'][0]['no'] == 5 and 'договоров' in body['finding']['articles'][0]['text']
    assert body['finding']['changes'][0]['id'] == 'treaties_priority'
    assert client.get('/api/constitution/findings/9999').status_code == 404


def test_constitution_article_lists_norms_touching_it(client):
    body = client.get('/api/constitution/articles/52').get_json()
    assert body['article']['section']['title'] == 'Курултай'
    assert body['article']['norms'][0]['act']['code'] == 'ЗРК О ПА'
    assert body['article']['norms'][0]['article_no'] == '7'
    assert body['article']['was'][0]['id'] == 'kurultai'
    assert client.get('/api/constitution/articles/999').status_code == 404


def test_changes_endpoint(client):
    body = client.get('/api/constitution/changes').get_json()
    assert any(c['id'] == 'kurultai' and c['norms'] == 1 for c in body['changes'])


def test_viz_endpoint_gives_norm_levels_in_act_order_and_compact_findings(client, app):
    body = client.get('/api/constitution/viz').get_json()
    acts = body['acts']
    law = next(a for a in acts if a['document_id'] == app.config['LAW_ID'])
    assert law['code'] == 'ЗРК О ПА' and law['tier'] == 5
    assert law['levels'] == [3, 2, 0]                      # по порядку статей акта
    assert law['started_at'] and law['finished_at'] and law['tokens'] == 300
    f = body['findings']
    assert {'d': app.config['LAW_ID'], 'a': [5], 'c': ['treaties_priority'], 'l': 3, 'n': '6'} in f
    assert all(x['l'] >= 1 for x in f)
    assert body['run']['status'] == 'done'
    assert body['articles'][0]['no'] == 5 and body['articles'][0]['section'] == 'I'
