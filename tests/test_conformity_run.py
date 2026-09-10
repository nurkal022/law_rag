"""
Прогон по актам в порядке иерархии: пишет ход обхода, возобновляется, не падает
от сбоя модели на одной норме. Модель и векторы подменены; база — SQLite в памяти.
"""
import json
import os
import sys

import pytest
from flask import Flask

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from conformity import run as runner  # noqa: E402
from conformity.registry import ActMeta, Registry, load_registry  # noqa: E402


class FakeProvider:
    def __init__(self, fail_on=None):
        self.calls = 0
        self.fail_on = fail_on

    def chat_completion(self, messages, model=None, **kwargs):
        self.calls += 1
        if self.fail_on and self.fail_on in messages[1]['content']:
            raise RuntimeError('quota')
        return {'content': json.dumps({'level': 0, 'category': 'none', 'constitution_articles': [], 'change_ids': [],
                                       'quote_norm': '', 'explanation': 'Не выявлено.', 'recommendation': ''}),
                'model': model, 'usage': {'total_tokens': 50}}


@pytest.fixture
def app(monkeypatch):
    from database.models import Document, DocumentChunk, db

    application = Flask(__name__)
    application.config.update(SQLALCHEMY_DATABASE_URI='sqlite://', SQLALCHEMY_TRACK_MODIFICATIONS=False,
                              CONFORMITY_TRIAGE_MODEL='t', CONFORMITY_VERIFY_MODEL='v')
    db.init_app(application)

    def doc(filename, title, articles):
        d = Document(filename=filename, title=title, content='', file_size=0)
        db.session.add(d)
        db.session.flush()
        for i, (no, text) in enumerate(articles):
            db.session.add(DocumentChunk(document_id=d.id, chunk_index=i, content=f'Глава 1. Общие\nСтатья {no}. Заголовок\n{text}',
                                         start_position=0, end_position=len(text), chunk_size=len(text)))
        return d

    with application.app_context():
        db.create_all()
        # В мини-Конституции есть все «появившиеся» институты — иначе реестр изменений
        # справедливо откажется работать с текстом, где их нет.
        doc('const.txt', 'Конституция Республики Казахстан (2026)',
            [(1, 'Республика Казахстан – демократическое государство.'),
             (49, 'Вице-Президент назначается Президентом.'),
             (52, 'Курултай – высший представительный орган.'),
             (70, 'Қазақстан Халық Кеңесі (Народный Совет Казахстана) – консультативный орган.'),
             (72, 'Конституционный Суд – орган конституционного контроля.'),
             (86, 'Адвокатура содействует реализации прав.')])
        doc('code.pdf', 'Трудовой кодекс РК', [(1, 'Отношения.'), (2, 'Работник.')])
        doc('law.pdf', 'Закон РК «О правовых актах»', [(1, 'Понятия.'), (7, 'Виды актов.')])
        db.session.commit()

    tiny = Registry(load_registry().tiers, {
        'const.txt': ActMeta('const.txt', 1, 'Конституция РК'),
        'code.pdf': ActMeta('code.pdf', 4, 'ТК РК'),
        'law.pdf': ActMeta('law.pdf', 5, 'ЗРК О ПА'),
    })
    monkeypatch.setattr(runner, 'load_registry', lambda: tiny)
    return application


def test_full_run_walks_acts_in_tier_order_and_counts(app):
    from database.models import ConformityFinding, ConformityRunAct

    p = FakeProvider()
    with app.app_context():
        run = runner.run_conformity(app, provider=p, threads=2, log=lambda *a: None)
        assert run.status == 'done' and run.norms_total == 4 and run.norms_done == 4
        assert run.counts_json == {'0': 4, '1': 0, '2': 0, '3': 0, 'errors': 0}
        acts = ConformityRunAct.query.filter_by(run_id=run.id).order_by(ConformityRunAct.position).all()
        assert [a.code for a in acts] == ['ТК РК', 'ЗРК О ПА']
        assert all(a.started_at and a.finished_at and a.norms_done == 2 for a in acts)
        assert ConformityFinding.query.filter_by(run_id=run.id).count() == 4
        assert run.tokens_used == 200 and p.calls == 4


def test_resume_skips_norms_already_analyzed(app):
    from database.models import ConformityFinding, ConformityRun, db

    p = FakeProvider()
    with app.app_context():
        first = runner.run_conformity(app, provider=p, threads=1, limit=1, log=lambda *a: None)
        assert first.status == 'running' and first.norms_done == 2  # по одной норме на акт, прогон не завершён
        second = runner.run_conformity(app, provider=p, threads=1, log=lambda *a: None)
        assert second.id == first.id and second.status == 'done'
        assert ConformityFinding.query.filter_by(run_id=second.id).count() == 4
        assert p.calls == 4  # разобранные повторно не спрашивались
        assert ConformityRun.query.count() == 1


def test_model_failure_on_one_norm_is_recorded_and_run_completes(app):
    from database.models import ConformityFinding

    p = FakeProvider(fail_on='Виды актов')
    with app.app_context():
        run = runner.run_conformity(app, provider=p, threads=1, log=lambda *a: None)
        assert run.status == 'done'
        broken = ConformityFinding.query.filter_by(run_id=run.id).filter(ConformityFinding.error != '').all()
        assert len(broken) == 1 and broken[0].level is None and 'quota' in broken[0].error
        assert run.counts_json['errors'] == 1
        # повтор с retry_errors добивает норму
        ok = FakeProvider()
        run2 = runner.run_conformity(app, provider=ok, threads=1, retry_errors=True, log=lambda *a: None)
        assert run2.id == run.id and run2.counts_json['errors'] == 0 and ok.calls == 1
