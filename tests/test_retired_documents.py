"""
Конституция 1995 остаётся в базе для сравнения, но искать по ней нельзя:
консультант цитировал утративший силу акт. Отставка — дата в documents.retired_at.
"""
import os
import sys
from datetime import datetime

import pytest
from flask import Flask

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


@pytest.fixture
def app():
    from database.models import db

    application = Flask(__name__)
    application.config.update(SQLALCHEMY_DATABASE_URI='sqlite://', SQLALCHEMY_TRACK_MODIFICATIONS=False)
    db.init_app(application)
    with application.app_context():
        db.create_all()
        yield application


def _doc(filename, retired=None):
    from database.models import Document, DocumentChunk, db
    d = Document(filename=filename, title=filename, content='x', file_size=1, retired_at=retired)
    db.session.add(d)
    db.session.flush()
    db.session.add(DocumentChunk(document_id=d.id, chunk_index=0, content='Статья 1. Текст',
                                 start_position=0, end_position=10, chunk_size=10))
    db.session.commit()
    return d


def test_active_chunks_skip_retired_documents(app):
    from rag.retriever import active_chunks
    _doc('old.pdf', retired=datetime(2026, 7, 1))
    live = _doc('new.txt')
    ids = {c.document_id for c in active_chunks().all()}
    assert ids == {live.id}


def test_light_migration_is_idempotent(app):
    from database.models import apply_light_migrations
    apply_light_migrations()
    apply_light_migrations()  # второй вызов ничего не ломает


def test_sync_meta_retires_and_renames(app, monkeypatch):
    import scripts.load_legal_docs as loader
    from database.models import Document
    _doc('k950001000_.01-01-2023.rus.pdf')
    monkeypatch.setattr(loader, 'app', app, raising=False)
    changed = loader.sync_meta()
    doc = Document.query.filter_by(filename='k950001000_.01-01-2023.rus.pdf').one()
    assert changed == 1
    assert doc.retired_at == datetime(2026, 7, 1)
    assert '1995' in doc.title
