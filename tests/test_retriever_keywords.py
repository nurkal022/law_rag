"""
Поиск по словам: морфология вместо совпадения строк.

Проверка появилась после разбора неверных ответов на стенде. Прежний поиск
делил запрос пробелами и сравнивал слова как есть, поэтому «Можно ли уволить
беременную женщину?» находил статьи Земельного кодекса по слову «можно», а
нужную статью Трудового кодекса не находил вовсе: «беременную» не равно
«беременной», а «женщину?» со знаком вопроса не равно ничему.

Тесты идут против настоящего PostgreSQL — вся нормализация делается его
русским словарём, и на SQLite проверять тут нечего. Без TEST_DATABASE_URL
они пропускаются.
"""

import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

TEST_DB = os.getenv('TEST_DATABASE_URL')

pytestmark = pytest.mark.skipif(
    not TEST_DB, reason='нужен PostgreSQL: задайте TEST_DATABASE_URL'
)


@pytest.fixture
def retriever():
    """Настоящая база с несколькими статьями: проверяем ранжирование, а не заглушку."""
    from flask import Flask
    from database.models import db, Document, DocumentChunk, DatabaseManager
    from rag.retriever import DocumentRetriever

    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = TEST_DB
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    db.init_app(app)

    with app.app_context():
        db.session.execute(db.text('CREATE EXTENSION IF NOT EXISTS vector'))
        # Не ждать блокировку молча: если база занята, тест должен упасть
        # с внятной ошибкой, а не висеть до таймаута сборки.
        db.session.execute(db.text("SET lock_timeout = '5s'"))
        db.session.commit()
        db.create_all()
        # Чистим строки, а не схему: DROP TABLE требует эксклюзивной блокировки
        # и повисает, стоит другому прогону оставить открытую транзакцию.
        _wipe(db)

        doc = Document(title='Трудовой кодекс РК', filename='tk.pdf', content='')
        other = Document(title='Земельный кодекс РК', filename='zk.pdf', content='')
        db.session.add_all([doc, other])
        db.session.flush()

        chunks = [
            (doc, 'Статья 54. Ограничение возможности расторжения трудового договора\n'
                  'Не допускается расторжение трудового договора по инициативе '
                  'работодателя с беременными женщинами.'),
            (doc, 'Статья 76. Ночное время\n'
                  'Ночным считается время с 22 до 6 часов.'),
            (other, 'Статья 43. Предоставление земельных участков\n'
                    'Земельный участок можно предоставить, если это не противоречит плану.'),
        ]
        for i, (d, text) in enumerate(chunks):
            db.session.add(DocumentChunk(
                document_id=d.id, chunk_index=i, content=text,
                start_position=0, end_position=len(text), chunk_size=len(text),
            ))
        db.session.commit()

        yield DocumentRetriever(DatabaseManager())

        db.session.rollback()
        _wipe(db)
        db.session.remove()


def _wipe(db):
    """Убирает данные теста, оставляя схему на месте."""
    db.session.execute(db.text('DELETE FROM document_chunks'))
    db.session.execute(db.text('DELETE FROM documents'))
    db.session.commit()


def titles(results):
    return [r['content'].split('\n')[0] for r in results]


def test_finds_the_norm_despite_a_different_word_form(retriever):
    """«беременную» в вопросе против «беременными» в кодексе."""
    found = titles(retriever.search_by_keywords('Можно ли уволить беременную женщину?', 5))

    assert any('Статья 54' in t for t in found), f'нужная статья не найдена: {found}'


def test_service_words_do_not_drag_in_unrelated_articles(retriever):
    """«можно» и «ли» — не признак релевантности.

    Прежний поиск возвращал по ним статьи из любого кодекса, и этот мусор
    вытеснял из контекста настоящие нормы.
    """
    found = titles(retriever.search_by_keywords('Можно ли уволить беременную женщину?', 5))

    assert not any('Статья 43' in t for t in found), (
        f'статья про земельные участки попала в выдачу по служебному слову: {found}'
    )


def test_punctuation_does_not_block_a_match(retriever):
    found = titles(retriever.search_by_keywords('расторжение договора?', 5))

    assert any('Статья 54' in t for t in found), f'знак препинания сорвал поиск: {found}'


def test_ranks_the_closer_article_higher(retriever):
    """Больше совпавших слов — выше место."""
    found = titles(retriever.search_by_keywords('расторжение трудового договора беременные', 5))

    assert found and 'Статья 54' in found[0], f'ожидали статью 54 первой, получили: {found}'


def test_returns_nothing_when_no_word_matches(retriever):
    assert retriever.search_by_keywords('криптовалюта майнинг блокчейн', 5) == []


def test_keeps_the_score_field_used_by_hybrid_search(retriever):
    """hybrid_search смешивает оценки — поле обязано остаться на месте."""
    results = retriever.search_by_keywords('расторжение трудового договора', 5)

    assert results
    assert all(isinstance(r['keyword_score'], float) for r in results)
    assert all(r['keyword_score'] > 0 for r in results)
