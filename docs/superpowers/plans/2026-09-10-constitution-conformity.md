# Блок «Конституция» — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Демонстрационный раздел «Конституция»: агент один раз проходит все акты корпуса по иерархии юридической силы, каждой норме даёт оценку соответствия Конституции 2026 в формулировках ТЗ, результат виден на трёх экранах (обзор, акт, статья Конституции) на law.archeo.asia.

**Architecture:** Конституция 2026 попадает в корпус текстовым файлом через существующий загрузчик, Конституция 1995 остаётся в базе, но уходит из поиска (`documents.retired_at`). Модуль `conformity/` без зависимости от Flask: реестр актов и реестр изменений «было → стало» (YAML), механический слой по словарю институтов и перенумерации статей, модель (gpt-4o-mini) на каждой норме с ближайшими статьями Конституции в контексте, второй проверочный проход (gpt-5-mini) для уровней 2–3. Прогон — скрипт в контейнере, возобновляемый, пишет ход обхода по актам. Blueprint отдаёт результаты только на чтение; фронтенд рисует пирамиду ярусов, штрих-коды актов и карту Конституции инлайновым SVG на токенах.

**Tech Stack:** Python 3.10, Flask, SQLAlchemy, pgvector (векторы уже в `document_chunks`), numpy, PyYAML, pytest (SQLite в памяти, модель подменяется); React 19 + TypeScript + Vite, react-router 7, дизайн-токены (`npm run check` = tsc + lint-tokens).

**Spec:** `docs/superpowers/specs/2026-09-10-constitution-conformity-design.md`

## Global Constraints

- Формулировки уровней — ровно пять строк из спеки §2, их ставит код (`conformity/wording.py`), модель их не пишет.
- Уровень ≥ 1 только с цитатой из нормы и опорой (номер статьи Конституции или id изменения); без опоры код понижает до 0.
- Отсутствие института в Конституции 2026 берётся только из `conformity/changes.yaml` (`absent_terms`); загрузка реестра падает, если такой термин встречается в статьях 1–93 текста 2026.
- Цвета, кегли и отступы во фронтенде — только `var(--…)` из `frontend/src/styles/tokens.css`; охра текстом — только `--ochre-ink`; теней и градиентов нет (`npm run lint:tokens`).
- Библиотек диаграмм нет: инлайновый SVG, как в `features/analytics`.
- Все ручки `/api/constitution/*` только GET, открыты гостям, формат ответа `{success: true, …}`, ошибки — `{'success': False, 'error': kind, 'message': …}`.
- Python запускать как `python3` (`/Library/Frameworks/Python.framework/Versions/3.10/bin/python3`); тесты — `python3 -m pytest tests -q`; фронтенд — из каталога `frontend/` (`npm run check && npm run build`).
- Прод: law.archeo.asia, контейнеры `dalel-app`, `dalel-postgres`, каталог `~/dalel`; чужие контейнеры и Caddy не трогать; фронтенд собирать локально и заливать rsync (`static/app/`), затем `docker compose -f docker-compose.demo.yml restart app`; бэкенд — `git pull` + `docker compose -f docker-compose.demo.yml up -d --build app`.
- Коммиты завершать строкой `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

---

## Карта файлов

| Файл | Ответственность |
|---|---|
| `scripts/fetch_constitution_2026.py` | забрать текст K2600000000 с зеркала, привести к формату загрузчика, записать `docs/k2600000000.01-07-2026.rus.txt` |
| `scripts/load_legal_docs.py` | (изменение) читать `.txt`, записи `DOC_META` для 2026 и отставки 1995, `--sync-meta` |
| `database/models.py` | (изменение) `Document.retired_at`, `apply_light_migrations()`, модели `ConformityRun`, `ConformityRunAct`, `ConformityFinding` |
| `rag/retriever.py` | (изменение) отставленные документы не участвуют в поиске |
| `conformity/__init__.py` | пустой пакет |
| `conformity/wording.py` | уровни, категории, формулировки на трёх языках |
| `conformity/registry.py` + `conformity/acts.yaml` | 11 ярусов ТЗ, метаданные актов корпуса |
| `conformity/changes.py` + `conformity/changes.yaml` | реестр изменений, словарь институтов, перенумерация, механические находки |
| `conformity/constitution.py` | индекс статей Конституции 2026: текст, раздел, вектор; ближайшие статьи |
| `conformity/analyze.py` | промпты, первый и второй проход, слияние слоёв, `Finding` |
| `conformity/run.py` + `scripts/run_conformity.py` | прогон по актам с ходом обхода, возобновление |
| `blueprints/constitution/{__init__,routes}.py` | GET-ручки |
| `config.py`, `docker-compose.demo.yml`, `app.py` | настройки моделей, регистрация blueprint, миграция |
| `frontend/src/features/constitution/*` | экраны и компоненты |
| `frontend/src/shared/ui/Data.tsx`, `ui.css` | вид статуса `note` |
| `frontend/src/app/{routes,Shell}.tsx`, `features/public/HomePage.tsx`, `home.css`, `features/legal/cite.ts` | маршруты, раздел в шапке, карточка на главной, код Конституции 1995 |
| `tests/test_constitution_text.py`, `tests/test_retired_documents.py`, `tests/test_conformity_registry.py`, `tests/test_conformity_changes.py`, `tests/test_conformity_analyze.py`, `tests/test_conformity_run.py`, `tests/test_api_constitution.py` | тесты |

---

### Task 1: Текст Конституции 2026 в `docs/` и загрузчик, понимающий `.txt`

**Files:**
- Create: `scripts/fetch_constitution_2026.py`
- Create: `docs/k2600000000.01-07-2026.rus.txt` (результат скрипта, коммитится)
- Modify: `scripts/load_legal_docs.py` (`DOC_META`, `pdf_to_text` → `read_source`, `main`)
- Test: `tests/test_constitution_text.py`

**Interfaces:**
- Produces: `fetch_constitution_2026.normalize(text: str) -> str` (строки `Раздел I. Название`, `Статья N.`, тело); `load_legal_docs.read_source(path: str) -> str`; ключ `DOC_META['k2600000000.01-07-2026.rus.txt']`.

- [ ] **Step 1: Написать падающий тест**

```python
# tests/test_constitution_text.py
"""
Конституция 2026 приходит не PDF с «Әділет» (сайт недоступен), а текстом с зеркала.
Зеркало даёт «Раздел I» и название на отдельных строках, «Статья 1» без точки.
Загрузчик корпуса понимает только «Раздел I. Название» и «Статья 1.» — приводим.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scripts.fetch_constitution_2026 import normalize  # noqa: E402
from scripts.load_legal_docs import DOC_META, clean_text, read_source, split_by_articles  # noqa: E402

MIRROR = (
    'Новая Конституция вступает в силу 1 июля: публикуем полный текст\n'
    'Раздел I\n'
    'Основы конституционного строя\n'
    'Статья 1\n'
    'Республика Казахстан – демократическое, светское, правовое и социальное государство.\n'
    'Статья 2\n'
    '1. Республика Казахстан – унитарное государство.\n'
    '2. Суверенитет Республики распространяется на всю ее территорию.\n'
    'Раздел IV\n'
    'Курултай\n'
    'Статья 52\n'
    '1. Курултай Республики Казахстан – высший представительный орган.\n'
    'Поделиться:\n'
    'Добавить комментарий\n'
)


def test_normalize_marks_sections_and_articles_for_the_loader():
    text = normalize(MIRROR)
    lines = text.split('\n')
    assert lines[0] == 'Раздел I. Основы конституционного строя'
    assert 'Статья 1.' in lines
    assert 'Раздел IV. Курултай' in lines
    assert 'Поделиться' not in text and 'публикуем полный текст' not in text


def test_loader_splits_normalized_constitution_by_articles():
    chunks = split_by_articles(clean_text(normalize(MIRROR)), 'Раздел')
    assert [c['title'] for c in chunks] == ['Статья 1.', 'Статья 2.', 'Статья 52.']
    assert chunks[2]['section'] == 'Раздел IV. Курултай'
    assert 'высший представительный орган' in chunks[2]['content']


def test_read_source_reads_plain_text(tmp_path):
    p = tmp_path / 'k2600000000.01-07-2026.rus.txt'
    p.write_text('Раздел I. Основы\nСтатья 1.\nТекст.\n', encoding='utf-8')
    assert read_source(str(p)).startswith('Раздел I. Основы')


def test_doc_meta_knows_both_constitutions():
    new = DOC_META['k2600000000.01-07-2026.rus.txt']
    old = DOC_META['k950001000_.01-01-2023.rus.pdf']
    assert new['type'] == 'constitution' and new['section_keyword'] == 'Раздел'
    assert '2026' in new['title']
    assert old['retired'] == '2026-07-01' and '1995' in old['title']
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `python3 -m pytest tests/test_constitution_text.py -q`
Expected: FAIL — `ModuleNotFoundError: scripts.fetch_constitution_2026` (и `read_source` не импортируется).

- [ ] **Step 3: Написать скрипт получения текста**

```python
# scripts/fetch_constitution_2026.py
#!/usr/bin/env python3
"""
Текст Конституции РК 2026 года (ИПС «Әділет», K2600000000) для корпуса Dalel.

Сайт adilet.zan.kz недоступен с машины разработки и с сервера (соединение
сбрасывается), поэтому текст берётся с зеркала и приводится к виду, который
понимает scripts/load_legal_docs.py: строка «Раздел N. Название», строка
«Статья N.», затем тело статьи. Итог — docs/k2600000000.01-07-2026.rus.txt.
Когда появится PDF с «Әділет», файл заменяется; номера статей те же.

    python3 scripts/fetch_constitution_2026.py            # скачать и записать
    python3 scripts/fetch_constitution_2026.py --from page.html   # из сохранённой страницы
"""
import argparse
import html
import os
import re
import sys
import urllib.request
from html.parser import HTMLParser

PROJECT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TARGET = os.path.join(PROJECT_DIR, 'docs', 'k2600000000.01-07-2026.rus.txt')

SOURCE_URL = ('https://pkzsk.info/novaya-konstitucziya-kazahstana-vstupaet-v-silu-1-iyulya_'
              '-publikuem-polnyj-tekst-dokumenta/')
HEADER = (
    'Конституция Республики Казахстан\n'
    'Принята на республиканском референдуме 15 марта 2026 года. Вступила в силу 1 июля 2026 года.\n'
    'Официальный источник: ИПС «Әділет», документ K2600000000. Текст получен с зеркала '
    'pkzsk.info 10.09.2026 и приведён к формату загрузчика корпуса.\n\n'
)
EXPECTED_ARTICLES = 96
EXPECTED_SECTIONS = 11
JUNK_AFTER = ('Поделиться', 'Добавить комментарий', 'Ваш адрес email')


class _Text(HTMLParser):
    """Текст страницы без скриптов, шапки и подвала; блочные теги — переводы строк."""

    SKIP = {'script', 'style', 'nav', 'header', 'footer', 'aside'}
    BLOCK = {'p', 'br', 'div', 'h1', 'h2', 'h3', 'h4', 'li', 'tr'}

    def __init__(self):
        super().__init__()
        self.out = []
        self.skip = 0

    def handle_starttag(self, tag, attrs):
        if tag in self.SKIP:
            self.skip += 1
        if tag in self.BLOCK:
            self.out.append('\n')

    def handle_endtag(self, tag):
        if tag in self.SKIP:
            self.skip = max(0, self.skip - 1)

    def handle_data(self, data):
        if not self.skip:
            self.out.append(data)


def html_to_text(raw: str) -> str:
    p = _Text()
    p.feed(raw)
    text = html.unescape(''.join(p.out))
    text = re.sub(r'[ \t ]+', ' ', text)
    return re.sub(r'\n\s*\n+', '\n', text)


def normalize(text: str) -> str:
    """Формат загрузчика: «Раздел I. Название», «Статья N.», тело.

    Всё до первого «Раздел I» — шапка новости, всё после первой строки-мусора
    («Поделиться», форма комментария) — подвал сайта.
    """
    lines = [ln.strip() for ln in text.split('\n')]
    out = []
    i = 0
    started = False
    while i < len(lines):
        ln = lines[i]
        if not started:
            if re.fullmatch(r'Раздел I', ln):
                started = True
            else:
                i += 1
                continue
        if any(ln.startswith(j) for j in JUNK_AFTER):
            break
        if not ln:
            i += 1
            continue
        m = re.fullmatch(r'Раздел ([IVX]+)\.?\s*(.*)', ln)
        if m:
            title = m.group(2).strip()
            if not title and i + 1 < len(lines):
                title = lines[i + 1].strip()
                i += 1
            out.append(f'Раздел {m.group(1)}. {title}' if title else f'Раздел {m.group(1)}.')
            i += 1
            continue
        m = re.fullmatch(r'Статья (\d+)\.?\s*(.*)', ln)
        if m:
            tail = m.group(2).strip()
            out.append(f'Статья {m.group(1)}.' + (f' {tail}' if tail else ''))
            i += 1
            continue
        out.append(ln)
        i += 1
    return '\n'.join(out).strip() + '\n'


def check(text: str) -> None:
    arts = set(re.findall(r'^Статья (\d+)\.', text, re.M))
    secs = re.findall(r'^Раздел [IVX]+\.', text, re.M)
    if len(arts) != EXPECTED_ARTICLES or len(secs) != EXPECTED_SECTIONS:
        raise SystemExit(f'ожидалось {EXPECTED_ARTICLES} статей и {EXPECTED_SECTIONS} разделов, '
                         f'получено {len(arts)} и {len(secs)} — формат зеркала изменился')


def main():
    ap = argparse.ArgumentParser(description='Конституция 2026 → docs/')
    ap.add_argument('--from', dest='src', help='сохранённая HTML-страница вместо загрузки')
    ap.add_argument('--out', default=TARGET)
    args = ap.parse_args()

    if args.src:
        raw = open(args.src, encoding='utf-8', errors='ignore').read()
    else:
        req = urllib.request.Request(SOURCE_URL, headers={'User-Agent': 'Mozilla/5.0 (Dalel corpus fetch)'})
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read().decode('utf-8', errors='ignore')

    text = normalize(html_to_text(raw))
    check(text)
    with open(args.out, 'w', encoding='utf-8') as f:
        f.write(HEADER + text)
    print(f'записано {args.out}: {len(text):,} знаков')


if __name__ == '__main__':
    main()
```

- [ ] **Step 4: Научить загрузчик читать `.txt` и знать обе Конституции**

В `scripts/load_legal_docs.py`:

```python
# в DOC_META — заменить запись Конституции на две:
    # ── Конституция ──
    'k2600000000.01-07-2026.rus.txt': {
        'title': 'Конституция Республики Казахстан (2026)',
        'type': 'constitution',
        'section_keyword': 'Раздел',
    },
    # Прекратила действие 1 июля 2026 года (ст. 94 Конституции 2026). Остаётся в базе
    # для сравнения «было → стало», но из поиска и ответов консультанта исключена.
    'k950001000_.01-01-2023.rus.pdf': {
        'title': 'Конституция Республики Казахстан (1995, утратила силу 01.07.2026)',
        'type': 'constitution',
        'section_keyword': 'Раздел',
        'retired': '2026-07-01',
    },
```

```python
# заменить pdf_to_text на read_source (pdf_to_text оставить как есть, добавить ниже него):
def read_source(path: str) -> str:
    """Текст документа: PDF через pdftotext, .txt — как есть.

    Конституция 2026 приходит текстом с зеркала (см. scripts/fetch_constitution_2026.py),
    остальные акты — PDF с «Әділет».
    """
    if path.lower().endswith('.txt'):
        with open(path, encoding='utf-8') as f:
            return f.read()
    return pdf_to_text(path)
```

В `load_document` заменить `raw_text = pdf_to_text(pdf_path)` на `raw_text = read_source(pdf_path)`.
В `main()` заменить `pdf_files = [f for f in os.listdir(DOCS_DIR) if f.endswith('.pdf')]` на
`pdf_files = [f for f in os.listdir(DOCS_DIR) if f.endswith(('.pdf', '.txt'))]`.

- [ ] **Step 5: Получить файл и проверить тесты**

Run: `python3 scripts/fetch_constitution_2026.py && head -8 docs/k2600000000.01-07-2026.rus.txt && grep -c '^Статья' docs/k2600000000.01-07-2026.rus.txt`
Expected: `записано … знаков`, в шапке строка «Раздел I. Основы конституционного строя», статей 96.
Run: `python3 -m pytest tests/test_constitution_text.py tests/test_load_legal_docs.py -q`
Expected: PASS (7 тестов).

- [ ] **Step 6: Коммит**

```bash
git add scripts/fetch_constitution_2026.py scripts/load_legal_docs.py docs/k2600000000.01-07-2026.rus.txt tests/test_constitution_text.py
git commit -m "feat(corpus): Конституция 2026 текстом с зеркала, загрузчик читает .txt

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Конституция 1995 уходит из поиска — `documents.retired_at`

**Files:**
- Modify: `database/models.py` (`Document`, новая функция `apply_light_migrations`)
- Modify: `app.py` (после `db.create_all()`)
- Modify: `rag/retriever.py` (`search_similar_chunks`, `search_by_keywords`)
- Modify: `scripts/load_legal_docs.py` (`sync_meta`, флаг `--sync-meta`)
- Modify: `frontend/src/features/legal/cite.ts`
- Test: `tests/test_retired_documents.py`

**Interfaces:**
- Produces: `Document.retired_at: datetime | None`; `database.models.apply_light_migrations() -> None`; `rag.retriever.active_chunks()` — запрос `DocumentChunk` join `Document` с `retired_at IS NULL`; `load_legal_docs.sync_meta() -> int`.

- [ ] **Step 1: Падающий тест**

```python
# tests/test_retired_documents.py
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
```

- [ ] **Step 2: Убедиться, что падает**

Run: `python3 -m pytest tests/test_retired_documents.py -q`
Expected: FAIL — `TypeError: 'retired_at' is an invalid keyword argument for Document` / `ImportError: active_chunks`.

- [ ] **Step 3: Колонка и миграция**

В `database/models.py`, класс `Document`, после `updated_at`:

```python
    # Дата, с которой документ утратил силу. Такой документ остаётся в базе
    # (нужен для сравнения редакций), но не попадает в поиск и ответы консультанта.
    retired_at = db.Column(db.DateTime, nullable=True)
```

и в `to_dict()` добавить `'retired_at': self.retired_at.isoformat() if self.retired_at else None,`.

После определения всех моделей (перед `class DatabaseManager`):

```python
def apply_light_migrations():
    """Колонки, добавленные после первого create_all.

    create_all создаёт недостающие таблицы, но не трогает существующие, поэтому
    новая колонка в старой таблице появляется только так. Проверяем по
    информации о схеме, а не ловим исключение: у SQLite и PostgreSQL они разные.
    """
    from sqlalchemy import inspect, text
    columns = {c['name'] for c in inspect(db.engine).get_columns('documents')}
    if 'retired_at' not in columns:
        db.session.execute(text('ALTER TABLE documents ADD COLUMN retired_at TIMESTAMP'))
        db.session.commit()
```

В `app.py` после `with app.app_context(): db.create_all()` (строка ~439):

```python
with app.app_context():
    db.create_all()
    from database.models import apply_light_migrations
    apply_light_migrations()
```

- [ ] **Step 4: Поиск обходит отставленные документы**

В `rag/retriever.py` добавить функцию уровня модуля (перед классом):

```python
def active_chunks():
    """Фрагменты действующих актов: утративший силу документ в поиске не участвует."""
    from database.models import Document, DocumentChunk, db
    return db.session.query(DocumentChunk).join(Document).filter(Document.retired_at.is_(None))
```

В `search_similar_chunks` заменить `db.session.query(DocumentChunk).join(Document).filter(DocumentChunk.embedding.isnot(None))` на `active_chunks().filter(DocumentChunk.embedding.isnot(None))`.
В SQL `search_by_keywords` строку `WHERE to_tsvector('russian', c.content) @@ q.tq` дополнить: `WHERE to_tsvector('russian', c.content) @@ q.tq AND d.retired_at IS NULL`.

- [ ] **Step 5: `--sync-meta` в загрузчике**

В `scripts/load_legal_docs.py` перед `main()`:

```python
def sync_meta() -> int:
    """Названия и даты отставки из DOC_META — в уже загруженные документы.

    Перезагружать документ ради нового названия незачем: чанки и векторы те же.
    Возвращает число изменённых документов.
    """
    from datetime import datetime
    from app import app
    from database.models import Document, db

    changed = 0
    with app.app_context():
        for filename, meta in DOC_META.items():
            doc = Document.query.filter_by(filename=filename).first()
            if not doc:
                continue
            retired = datetime.fromisoformat(meta['retired']) if meta.get('retired') else None
            if doc.title != meta['title'] or doc.retired_at != retired:
                doc.title = meta['title']
                doc.retired_at = retired
                changed += 1
                print(f'   ✎ {filename}: «{meta["title"]}»' + (f', утратил силу {meta["retired"]}' if retired else ''))
        db.session.commit()
    return changed
```

В `main()` добавить `ap.add_argument('--sync-meta', action='store_true', help='обновить названия и отставку уже загруженных документов и выйти')` и сразу после `args = ap.parse_args()`:

```python
    if args.sync_meta:
        print(f'✅ Обновлено документов: {sync_meta()}')
        return
```

Тест подменяет `loader.app`; чтобы это работало, `sync_meta` должен брать приложение так: заменить `from app import app` внутри функции на модульный доступ:

```python
    application = globals().get('app') or __import__('app').app
    with application.app_context():
```

- [ ] **Step 6: Код Конституции 1995 во фронтенде**

В `frontend/src/features/legal/cite.ts` в `ACTS` перед строкой «Конституция РК» добавить
`{ ru: 'Конституция РК (1995)', kz: 'ҚР Конституциясы (1995)', en: 'RK Constitution (1995)' },`
и в `TITLE_TO_ACT` первой строкой `[/^Конституция.*1995/i, 'Конституция РК (1995)'],`.

- [ ] **Step 7: Проверить**

Run: `python3 -m pytest tests/test_retired_documents.py tests/test_chat_sources.py -q && cd frontend && npm run check && cd ..`
Expected: PASS; `check` без ошибок.

- [ ] **Step 8: Коммит**

```bash
git add database/models.py app.py rag/retriever.py scripts/load_legal_docs.py frontend/src/features/legal/cite.ts tests/test_retired_documents.py
git commit -m "feat(corpus): утративший силу документ не участвует в поиске (documents.retired_at)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Реестр актов, ярусы иерархии, формулировки ТЗ

**Files:**
- Create: `conformity/__init__.py` (пустой)
- Create: `conformity/wording.py`
- Create: `conformity/acts.yaml`
- Create: `conformity/registry.py`
- Test: `tests/test_conformity_registry.py`

**Interfaces:**
- Produces: `wording.LEVELS = (0, 1, 2, 3)`, `wording.CATEGORIES`, `wording.wording(level: int, lang: str = 'ru') -> str`, `wording.category_label(cat, lang)`; `registry.TIER_COUNT = 11`, `registry.load_registry() -> Registry`, `Registry.act(filename) -> ActMeta | None`, `Registry.tier_title(tier: int, lang: str) -> str`, `Registry.acts: dict[str, ActMeta]`; `ActMeta(filename, tier, code, adilet, edition, url, retired)`.

- [ ] **Step 1: Падающий тест**

```python
# tests/test_conformity_registry.py
"""Реестр актов и формулировки ТЗ — данные, которые обязаны быть согласованы с корпусом."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from conformity import wording  # noqa: E402
from conformity.registry import TIER_COUNT, load_registry  # noqa: E402
from scripts.load_legal_docs import DOC_META  # noqa: E402


def test_exactly_four_levels_with_the_wording_from_the_spec():
    assert wording.LEVELS == (0, 1, 2, 3)
    assert wording.wording(0) == 'признаков противоречия в рамках автоматизированного анализа не выявлено'
    assert wording.wording(1) == 'норма требует экспертной проверки'
    assert wording.wording(2) == 'обнаружено возможное противоречие'
    assert wording.wording(3) == 'выявлен высокий риск несоответствия'
    assert wording.wording(3, 'kk') and wording.wording(3, 'en').startswith('a high risk')


def test_every_corpus_document_is_in_the_registry_with_a_valid_tier():
    reg = load_registry()
    for filename in DOC_META:
        act = reg.act(filename)
        assert act is not None, filename
        assert 1 <= act.tier <= TIER_COUNT
        assert act.code
    assert reg.act('k2600000000.01-07-2026.rus.txt').tier == 1
    assert reg.act('k950001000_.01-01-2023.rus.pdf').retired is True
    assert reg.act('k1500000414.20-01-2026.rus.pdf').code == 'ТК РК'


def test_tiers_are_named_in_three_languages():
    reg = load_registry()
    assert reg.tier_title(1, 'ru').startswith('Конституция')
    assert reg.tier_title(7, 'ru') == 'Нормативные постановления Курултая'
    assert reg.tier_title(11, 'kk') and reg.tier_title(11, 'en')
```

- [ ] **Step 2: Убедиться, что падает**

Run: `python3 -m pytest tests/test_conformity_registry.py -q`
Expected: FAIL — `ModuleNotFoundError: conformity`.

- [ ] **Step 3: Формулировки**

```python
# conformity/wording.py
"""
Формулировки уровней риска — из технического задания, дословно.

Их ставит код по уровню, а не модель: ТЗ запрещает системе выносить заключение
«акт неконституционен», и единственный способ гарантировать это — не давать
модели писать итоговую строку вовсе.
"""

LEVELS = (0, 1, 2, 3)

_WORDING = {
    0: {
        'ru': 'признаков противоречия в рамках автоматизированного анализа не выявлено',
        'kk': 'автоматтандырылған талдау шеңберінде қайшылық белгілері анықталмады',
        'en': 'no signs of conflict were found within the automated analysis',
    },
    1: {
        'ru': 'норма требует экспертной проверки',
        'kk': 'норма сараптамалық тексеруді қажет етеді',
        'en': 'the provision requires expert review',
    },
    2: {
        'ru': 'обнаружено возможное противоречие',
        'kk': 'ықтимал қайшылық анықталды',
        'en': 'a possible conflict was found',
    },
    3: {
        'ru': 'выявлен высокий риск несоответствия',
        'kk': 'сәйкессіздіктің жоғары тәуекелі анықталды',
        'en': 'a high risk of non-conformity was found',
    },
}

CATEGORIES = ('terminology', 'competence', 'rights', 'procedure', 'reference', 'none')

_CATEGORY = {
    'terminology': {'ru': 'орган или институт, которого нет в Конституции 2026',
                    'kk': '2026 жылғы Конституцияда жоқ орган немесе институт',
                    'en': 'a body or institution absent from the 2026 Constitution'},
    'competence': {'ru': 'полномочие закреплено за другим органом или иначе',
                   'kk': 'өкілеттік басқа органға немесе басқаша бекітілген',
                   'en': 'a power is vested differently or in another body'},
    'rights': {'ru': 'сужает право или гарантию Конституции 2026',
               'kk': '2026 жылғы Конституцияның құқығын немесе кепілдігін тарылтады',
               'en': 'narrows a right or guarantee of the 2026 Constitution'},
    'procedure': {'ru': 'порядок, срок или процедура расходятся с Конституцией 2026',
                  'kk': 'тәртіп, мерзім немесе рәсім 2026 жылғы Конституциямен алшақ',
                  'en': 'a procedure, term or order diverges from the 2026 Constitution'},
    'reference': {'ru': 'ссылка на статью Конституции, которой нет или она изменилась',
                  'kk': 'жоқ немесе өзгерген Конституция бабына сілтеме',
                  'en': 'a reference to a Constitution article that is gone or changed'},
    'none': {'ru': 'без замечаний', 'kk': 'ескертусіз', 'en': 'no remarks'},
}


def wording(level: int, lang: str = 'ru') -> str:
    if level not in _WORDING:
        raise ValueError(f'неизвестный уровень {level!r}')
    return _WORDING[level].get(lang) or _WORDING[level]['ru']


def category_label(category: str, lang: str = 'ru') -> str:
    row = _CATEGORY.get(category) or _CATEGORY['none']
    return row.get(lang) or row['ru']
```

- [ ] **Step 4: Реестр актов**

```yaml
# conformity/acts.yaml
# Реестр актов корпуса для блока «Конституция».
# tier — уровень иерархии юридической силы по ТЗ (1 — высший, 11 — местные акты).
# code — короткое обозначение, как в frontend/src/features/legal/cite.ts.
# adilet — номер документа в ИПС «Әділет», edition — дата редакции в корпусе.
tiers:
  1:  {ru: Конституция Республики Казахстан, kk: Қазақстан Республикасының Конституциясы, en: Constitution of the Republic of Kazakhstan}
  2:  {ru: Законы о внесении изменений и дополнений в Конституцию, kk: Конституцияға өзгерістер мен толықтырулар енгізу туралы заңдар, en: Laws amending the Constitution}
  3:  {ru: Конституционные законы, kk: Конституциялық заңдар, en: Constitutional laws}
  4:  {ru: Кодексы, kk: Кодекстер, en: Codes}
  5:  {ru: Законы, kk: Заңдар, en: Laws}
  6:  {ru: Нормативные правовые указы Президента, kk: Президенттің нормативтік құқықтық жарлықтары, en: Normative decrees of the President}
  7:  {ru: Нормативные постановления Курултая, kk: Құрылтайдың нормативтік қаулылары, en: Normative resolutions of the Kurultai}
  8:  {ru: Нормативные правовые постановления Правительства, kk: Үкіметтің нормативтік құқықтық қаулылары, en: Normative resolutions of the Government}
  9:  {ru: Нормативные приказы министров и постановления центральных органов, kk: Министрлердің нормативтік бұйрықтары және орталық органдардың қаулылары, en: Ministerial orders and resolutions of central bodies}
  10: {ru: Нормативные приказы руководителей ведомств, kk: Ведомство басшыларының нормативтік бұйрықтары, en: Orders of heads of agencies}
  11: {ru: Местные нормативные правовые акты, kk: Жергілікті нормативтік құқықтық актілер, en: Local normative legal acts}

acts:
  k2600000000.01-07-2026.rus.txt: {tier: 1, code: Конституция РК, adilet: K2600000000, edition: 2026-07-01, url: https://adilet.zan.kz/rus/docs/K2600000000}
  k950001000_.01-01-2023.rus.pdf: {tier: 1, code: Конституция РК (1995), adilet: K950001000_, edition: 2023-01-01, url: https://adilet.zan.kz/rus/docs/K950001000_, retired: true}

  z000000132_.01-07-2025.rus.pdf: {tier: 3, code: КЗРК О судебной системе, adilet: Z000000132_, edition: 2025-07-01, url: https://adilet.zan.kz/rus/docs/Z000000132_}
  z2200000153.01-01-2024.rus.pdf: {tier: 3, code: КЗРК О КС, adilet: Z2200000153, edition: 2024-01-01, url: https://adilet.zan.kz/rus/docs/Z2200000153}
  z2200000155.12-09-2023.rus.pdf: {tier: 3, code: КЗРК О прокуратуре, adilet: Z2200000155, edition: 2023-09-12, url: https://adilet.zan.kz/rus/docs/Z2200000155}

  k940001000_.12-03-2026.rus.pdf: {tier: 4, code: ГК РК, adilet: K940001000_, edition: 2026-03-12, url: https://adilet.zan.kz/rus/docs/K940001000_}
  k990000409_.16-01-2026.rus.pdf: {tier: 4, code: ГК РК, adilet: K990000409_, edition: 2026-01-16, url: https://adilet.zan.kz/rus/docs/K990000409_}
  k030000442_.16-01-2026.rus.pdf: {tier: 4, code: ЗК РК, adilet: K030000442_, edition: 2026-01-16, url: https://adilet.zan.kz/rus/docs/K030000442_}
  k1100000518.09-01-2026.rus.pdf: {tier: 4, code: КоБС РК, adilet: K1100000518, edition: 2026-01-09, url: https://adilet.zan.kz/rus/docs/K1100000518}
  k1400000226.08-03-2026.rus.pdf: {tier: 4, code: УК РК, adilet: K1400000226, edition: 2026-03-08, url: https://adilet.zan.kz/rus/docs/K1400000226}
  k1400000231.08-03-2026.rus.pdf: {tier: 4, code: УПК РК, adilet: K1400000231, edition: 2026-03-08, url: https://adilet.zan.kz/rus/docs/K1400000231}
  k1400000235.12-03-2026.rus.pdf: {tier: 4, code: КоАП РК, adilet: K1400000235, edition: 2026-03-12, url: https://adilet.zan.kz/rus/docs/K1400000235}
  k1500000375.01-02-2026.rus.pdf: {tier: 4, code: ПК РК, adilet: K1500000375, edition: 2026-02-01, url: https://adilet.zan.kz/rus/docs/K1500000375}
  k1500000377.16-01-2026.rus.pdf: {tier: 4, code: ГПК РК, adilet: K1500000377, edition: 2026-01-16, url: https://adilet.zan.kz/rus/docs/K1500000377}
  k1500000414.20-01-2026.rus.pdf: {tier: 4, code: ТК РК, adilet: K1500000414, edition: 2026-01-20, url: https://adilet.zan.kz/rus/docs/K1500000414}
  k2000000350.16-01-2026.rus.pdf: {tier: 4, code: АППК РК, adilet: K2000000350, edition: 2026-01-16, url: https://adilet.zan.kz/rus/docs/K2000000350}
  k2100000400.09-01-2026.rus.pdf: {tier: 4, code: ЭК РК, adilet: K2100000400, edition: 2026-01-09, url: https://adilet.zan.kz/rus/docs/K2100000400}
  k2500000171.16-01-2026.rus.pdf: {tier: 4, code: БК РК, adilet: K2500000171, edition: 2026-01-16, url: https://adilet.zan.kz/rus/docs/K2500000171}
  k2500000214.18-07-2025.rus.pdf: {tier: 4, code: НК РК, adilet: K2500000214, edition: 2025-07-18, url: https://adilet.zan.kz/rus/docs/K2500000214}

  z1600000480.09-01-2026.rus.pdf: {tier: 5, code: ЗРК О ПА, adilet: Z1600000480, edition: 2026-01-09, url: https://adilet.zan.kz/rus/docs/Z1600000480}
  z980000213_.06-04-2016.rus.pdf: {tier: 5, code: ЗРК О НПА, adilet: Z980000213_, edition: 2016-04-06, url: https://adilet.zan.kz/rus/docs/Z980000213_}
```

```python
# conformity/registry.py
"""
Реестр актов корпуса: уровень иерархии юридической силы, код, источник.

Данные, а не код (conformity/acts.yaml): новый акт — файл в docs/ и строка здесь.
Уровни — одиннадцать ярусов из технического задания; ст. 10 ЗРК «О правовых
актах» даёт ту же лестницу с одним отличием — местом постановлений
законодательного органа; принят порядок ТЗ.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from typing import Dict, Optional

import yaml

TIER_COUNT = 11
_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'acts.yaml')


@dataclass(frozen=True)
class ActMeta:
    filename: str
    tier: int
    code: str
    adilet: str = ''
    edition: str = ''
    url: str = ''
    retired: bool = False


class Registry:
    def __init__(self, tiers: Dict[int, Dict[str, str]], acts: Dict[str, ActMeta]):
        self.tiers = tiers
        self.acts = acts

    def act(self, filename: str) -> Optional[ActMeta]:
        return self.acts.get(filename)

    def tier_title(self, tier: int, lang: str = 'ru') -> str:
        row = self.tiers.get(tier) or {}
        return row.get('kk' if lang == 'kz' else lang) or row.get('ru') or f'Уровень {tier}'


@lru_cache(maxsize=1)
def load_registry(path: str = _PATH) -> Registry:
    with open(path, encoding='utf-8') as f:
        raw = yaml.safe_load(f) or {}
    tiers = {int(k): dict(v) for k, v in (raw.get('tiers') or {}).items()}
    if sorted(tiers) != list(range(1, TIER_COUNT + 1)):
        raise ValueError(f'в acts.yaml должно быть ровно {TIER_COUNT} ярусов, есть {sorted(tiers)}')
    acts = {}
    for filename, row in (raw.get('acts') or {}).items():
        tier = int(row['tier'])
        if not 1 <= tier <= TIER_COUNT:
            raise ValueError(f'{filename}: ярус {tier} вне 1..{TIER_COUNT}')
        acts[filename] = ActMeta(
            filename=filename, tier=tier, code=str(row['code']),
            adilet=str(row.get('adilet', '')), edition=str(row.get('edition', '')),
            url=str(row.get('url', '')), retired=bool(row.get('retired', False)),
        )
    return Registry(tiers, acts)
```

- [ ] **Step 5: Проверить и закоммитить**

Run: `python3 -m pytest tests/test_conformity_registry.py -q`
Expected: PASS (3).

```bash
git add conformity/__init__.py conformity/wording.py conformity/acts.yaml conformity/registry.py tests/test_conformity_registry.py
git commit -m "feat(conformity): реестр актов по ярусам ТЗ и формулировки уровней

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Реестр изменений «было → стало» и механический слой

**Files:**
- Create: `conformity/finding.py`
- Create: `conformity/changes.yaml`
- Create: `conformity/changes.py`
- Test: `tests/test_conformity_changes.py`

Факты реестра сверены 10.09.2026 по текстам двух Конституций (редакция 1995 на 01.01.2023 из корпуса и текст 2026): Мажилис, Сенат, Палаты Парламента, Ассамблея народа Казахстана — в 2026 отсутствуют; Парламент и Конституционный Совет упоминаются только в переходных ст. 95–96; Курултай (28 упоминаний), Вице-Президент (10), Қазақстан Халық Кеңесі (8), Адвокатура (ст. 86) — новые; п. 3 ст. 4 (приоритет ратифицированных договоров перед законами) в ст. 5 2026 заменён на «порядок действия договоров определяется законами»; п. 2 ст. 16 (задержание без санкции суда не более 72 часов) в ст. 18 2026 — «свыше сроков, предусмотренных законом»; поправки в Конституцию — только референдумом (ст. 92–93 вместо ст. 91); презумпция невиновности перенесена из ст. 77 в ст. 19, принципы правосудия — в ст. 78; перечень статей, не подлежащих ограничению, — п. 3 ст. 41 вместо п. 3 ст. 39.

**Interfaces:**
- Produces: `finding.Finding` (dataclass: `level: int | None`, `category: str`, `method: str`, `constitution_articles: list[int]`, `change_ids: list[str]`, `quote_norm: str`, `explanation: str`, `recommendation: str`, `model: str`, `tokens: int`, `error: str`), `Finding.merge(other) -> Finding`; `changes.load_changes(path=…) -> ChangeSet`; `ChangeSet.changes: list[Change]`, `ChangeSet.article_map: dict[int, list[int]]`, `ChangeSet.present_institutions: list[str]`, `ChangeSet.absent_institutions: list[str]`, `ChangeSet.by_id(id) -> Change`, `ChangeSet.hinted(norm_text) -> list[Change]`; `changes.validate(cs, articles_2026: dict[int, str]) -> None`; `changes.strip_footnotes(text) -> str`; `changes.mechanical_findings(norm_text, cs) -> list[Finding]`.

- [ ] **Step 1: Падающий тест**

```python
# tests/test_conformity_changes.py
"""
Механический слой: словарь институтов и перенумерация статей дают точные находки
без модели. Словарь обязан сходиться с текстом Конституции 2026 — иначе история
с «упразднённым» Высшим Судебным Советом повторится.
"""
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from conformity.changes import load_changes, mechanical_findings, strip_footnotes, validate  # noqa: E402

CS = load_changes()

ARTICLES_2026 = {n: '' for n in range(1, 97)}
ARTICLES_2026.update({
    49: 'Вице-Президент Республики Казахстан назначается на должность Президентом с согласия Курултая.',
    52: 'Курултай Республики Казахстан – высший представительный орган.',
    70: 'Қазақстан Халық Кеңесі (Народный Совет Казахстана) – высший консультативный орган.',
    72: 'Конституционный Суд Республики Казахстан – независимый государственный орган.',
    83: 'Председатель Верховного Суда назначается по рекомендации Высшего Судебного Совета.',
    85: 'Уполномоченный по правам человека содействует восстановлению нарушенных прав.',
    86: 'Адвокатура в Республике Казахстан содействует реализации прав человека.',
    89: 'Местный исполнительный орган возглавляет аким. Маслихаты и Центральная избирательная комиссия.',
    91: 'Правительство, Премьер-Министр, Президент, Прокуратура, Верховный Суд, Высшая аудиторская палата, Национальный Банк, Совет Безопасности.',
    95: 'Парламент Республики Казахстан прекращает свои полномочия с 1 июля 2026 года.',
    96: 'Нормативные постановления Конституционного Совета и Конституционного Суда сохраняют силу.',
})


def test_registry_validates_against_the_2026_text():
    validate(CS, ARTICLES_2026)  # не падает: отсутствующие термины есть только в ст. 94–96


def test_validation_fails_when_an_absent_term_shows_up_in_a_live_article():
    broken = dict(ARTICLES_2026)
    broken[60] = 'Сенат утверждает кандидатуру'
    with pytest.raises(ValueError, match='Сенат'):
        validate(CS, broken)


def test_senate_consent_is_a_terminology_finding_with_the_kurultai_articles():
    norm = ('Статья 27. Неприкосновенность судей\n'
            'Судья не может быть привлечен к уголовной ответственности без согласия Сената Парламента.')
    found = mechanical_findings(norm, CS)
    assert len(found) == 1
    f = found[0]
    assert f.level == 2 and f.category == 'terminology' and f.method == 'dictionary'
    assert 'kurultai' in f.change_ids
    assert 52 in f.constitution_articles
    assert 'Сената Парламента' in f.quote_norm


def test_existing_bodies_are_not_flagged():
    norm = 'Статья 30. Председатель Верховного Суда назначается по рекомендации Высшего Судебного Совета.'
    assert mechanical_findings(norm, CS) == []


def test_term_only_in_a_footnote_is_level_one():
    norm = ('Статья 5. Порядок.\nПорядок определяется законом.\n'
            'Сноска. Статья 5 в редакции Закона РК, одобренного Мажилисом Парламента 01.01.2020.')
    found = mechanical_findings(norm, CS)
    assert [f.level for f in found] == [1]
    assert strip_footnotes(norm).count('Мажилис') == 0


def test_reference_to_a_renumbered_constitution_article():
    norm = 'Статья 10. Принципы правосудия применяются в соответствии со статьей 77 Конституции Республики Казахстан.'
    found = mechanical_findings(norm, CS)
    assert len(found) == 1 and found[0].category == 'reference' and found[0].level == 1
    assert sorted(found[0].constitution_articles) == [19, 78]


def test_reference_to_a_dropped_constitution_article():
    norm = 'Статья 3. Полномочия Сената установлены статьей 55 Конституции.'
    cats = {f.category: f for f in mechanical_findings(norm, CS)}
    assert cats['reference'].level == 2 and cats['reference'].constitution_articles == []
    assert 'terminology' in cats


def test_hints_attach_the_treaty_change_to_a_norm_about_treaty_priority():
    norm = 'Международные договоры, ратифицированные Республикой Казахстан, имеют приоритет перед ее законами.'
    assert 'treaties_priority' in [c.id for c in CS.hinted(norm)]
```

- [ ] **Step 2: Убедиться, что падает**

Run: `python3 -m pytest tests/test_conformity_changes.py -q`
Expected: FAIL — `ModuleNotFoundError: conformity.changes`.

- [ ] **Step 3: Находка**

```python
# conformity/finding.py
"""Результат анализа одной нормы. Общий для механического слоя и модели."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class Finding:
    level: Optional[int] = 0          # 0..3; None — норма не разобрана (ошибка модели)
    category: str = 'none'            # см. wording.CATEGORIES
    method: str = ''                  # dictionary | model | model+verified | dictionary+model | …
    constitution_articles: List[int] = field(default_factory=list)
    change_ids: List[str] = field(default_factory=list)
    quote_norm: str = ''
    explanation: str = ''
    recommendation: str = ''
    model: str = ''
    tokens: int = 0
    error: str = ''

    def merge(self, other: 'Finding') -> 'Finding':
        """Две находки по одной норме: уровень — максимум, остальное — объединение.

        Объяснения склеиваются абзацами: читателю важно видеть и что нашёл словарь,
        и что увидела модель, а не только более строгий из двух выводов.
        """
        hi, lo = (self, other) if (self.level or 0) >= (other.level or 0) else (other, self)
        return Finding(
            level=hi.level,
            category=hi.category if hi.category != 'none' else lo.category,
            method='+'.join(sorted({m for m in (self.method, other.method) if m})),
            constitution_articles=sorted(set(self.constitution_articles) | set(other.constitution_articles)),
            change_ids=sorted(set(self.change_ids) | set(other.change_ids)),
            quote_norm=hi.quote_norm or lo.quote_norm,
            explanation='\n\n'.join(x for x in (hi.explanation, lo.explanation) if x),
            recommendation=hi.recommendation or lo.recommendation,
            model=self.model or other.model,
            tokens=self.tokens + other.tokens,
            error=self.error or other.error,
        )
```

- [ ] **Step 4: Реестр изменений**

```yaml
# conformity/changes.yaml
# Реестр изменений между Конституцией 1995 года (редакция на 01.01.2023) и Конституцией 2026 года.
# Сверено по текстам 10.09.2026. Поля:
#   kind         institution | new | removed | procedure | reference
#   old/new      статьи и цитата в каждой из Конституций
#   absent_terms регулярные выражения (Python re, регистр учитывается): институты, которых нет в 2026;
#                загрузка падает, если термин найден в статьях 1–93 текста 2026
#   absent_names те же институты словами — для справки модели и экрана
#   present_terms что появилось взамен (для справки модели)
#   hint_terms   регулярные выражения по тексту нормы, при совпадении изменение подаётся модели в контекст
#   level_hint   подсказка уровня для модели (не приказ)

present_institutions:
  - Президент Республики Казахстан
  - Вице-Президент
  - Курултай
  - Председатель Курултая
  - Правительство
  - Премьер-Министр
  - Қазақстан Халық Кеңесі (Народный Совет Казахстана)
  - Конституционный Суд
  - Верховный Суд
  - Высший Судебный Совет
  - Прокуратура
  - Уполномоченный по правам человека
  - Адвокатура
  - Центральная избирательная комиссия
  - Высшая аудиторская палата
  - Национальный Банк
  - Совет Безопасности
  - маслихаты
  - акимы

changes:
  - id: kurultai
    kind: institution
    title: Двухпалатный Парламент (Сенат и Мажилис) заменён однопалатным Курултаем
    summary: >
      Курултай — высший представительный орган из 145 депутатов, избираемых на пять лет
      по пропорциональной системе (ст. 52–53). Сената, Мажилиса и их исключительной
      компетенции (прежние ст. 54–57) нет; согласия, избрания и назначения, которые давали
      Палаты, теперь даёт Курултай или они устроены иначе.
    old: {articles: [49, 50, 51, 54, 55, 56, 57], quote: "Парламент состоит из двух Палат: Сената и Мажилиса, действующих на постоянной основе"}
    new: {articles: [52, 53, 56], quote: "Курултай Республики Казахстан – высший представительный орган Республики Казахстан, осуществляющий законодательную власть"}
    absent_terms: ['\bПарламент\w*', '\bМажилис\w*', '\bСенат\w*', '\bПалат\w* Парламента']
    absent_names: [Парламент, Мажилис, Сенат, Палаты Парламента]
    present_terms: ['Курултай']
    level_hint: 2

  - id: constitutional_council
    kind: institution
    title: Конституционного Совета нет — конституционный контроль осуществляет Конституционный Суд
    summary: >
      Совет упразднён реформой 2022 года; Конституция 2026 упоминает его только в переходной
      ст. 96 (сохранение силы его нормативных постановлений). Нормы, отсылающие к Совету и его
      полномочиям, требуют замены на Конституционный Суд (ст. 72–75).
    old: {articles: [71, 72, 73, 74], quote: "Конституционный Совет Республики Казахстан"}
    new: {articles: [72, 73, 74, 75], quote: "Конституционный Суд Республики Казахстан – независимый государственный орган, осуществляющий конституционный контроль"}
    absent_terms: ['Конституционн\w+ Совет\w*']
    absent_names: [Конституционный Совет]
    present_terms: ['Конституционный Суд']
    level_hint: 2

  - id: peoples_council
    kind: institution
    title: Ассамблея народа Казахстана исчезла из Конституции, появился Қазақстан Халық Кеңесі
    summary: >
      В 1995 году Ассамблею образовывал Президент (ст. 44) и она предлагала пять депутатов
      Сената (ст. 50). В 2026 году её нет; высший консультативный орган, представляющий народ, —
      Қазақстан Халық Кеңесі (ст. 70–71), порядок его формирования — конституционным законом.
    old: {articles: [44, 50], quote: "образует ... Ассамблею народа Казахстана"}
    new: {articles: [70, 71], quote: "Қазақстан Халық Кеңесі (Народный Совет Казахстана) – высший консультативный орган, представляющий интересы народа"}
    absent_terms: ['Ассамбле\w+ народа Казахстана']
    absent_names: [Ассамблея народа Казахстана]
    present_terms: ['Қазақстан Халық Кеңесі', 'Народный Совет']
    level_hint: 2

  - id: vice_president
    kind: new
    title: Введена должность Вице-Президента
    summary: >
      Вице-Президент назначается Президентом с согласия Курултая и по поручению Президента
      представляет его во взаимодействии с Курултаем, Правительством и иными органами (ст. 49).
      Нормы о порядке замещения и представительства Президента могут не учитывать эту должность.
    old: {articles: [], quote: ""}
    new: {articles: [49, 51], quote: "Вице-Президент Республики Казахстан назначается на должность Президентом Республики Казахстан с согласия Курултая"}
    absent_terms: []
    present_terms: ['Вице-Президент']
    hint_terms: ['временно\w* исполн\w+ обязанност\w+ Президента', 'досрочн\w+ освобожден\w+ .{0,40}Президента']
    level_hint: 1

  - id: treaties_priority
    kind: removed
    title: Исключён приоритет ратифицированных международных договоров перед законами
    summary: >
      П. 3 ст. 4 Конституции 1995 года: «Международные договоры, ратифицированные Республикой,
      имеют приоритет перед ее законами». В ст. 5 Конституции 2026 года такого правила нет:
      «Порядок действия на территории Республики Казахстан международных договоров
      определяется законами». Нормы, воспроизводящие прежний приоритет, расходятся с новой
      редакцией.
    old: {articles: [4], quote: "Международные договоры, ратифицированные Республикой, имеют приоритет перед ее законами"}
    new: {articles: [5], quote: "Порядок действия на территории Республики Казахстан международных договоров определяется законами"}
    absent_terms: []
    present_terms: []
    hint_terms: ['приоритет\w* перед .{0,60}закон', 'ратифицированн\w+ .{0,40}договор\w*', 'международн\w+ договор\w+ .{0,80}приоритет']
    level_hint: 3

  - id: detention_terms
    kind: procedure
    title: Предельный срок задержания без суда установлен законом, а не Конституцией
    summary: >
      П. 2 ст. 16 Конституции 1995 года допускал задержание без санкции суда не более
      семидесяти двух часов. П. 2 ст. 18 Конституции 2026 года: «Без судебного решения человек
      не может быть подвергнут задержанию свыше сроков, предусмотренных законом». Нормы,
      ссылающиеся на конституционный срок в 72 часа как на источник, требуют проверки основания.
    old: {articles: [16], quote: "Без санкции суда лицо может быть подвергнуто задержанию на срок не более семидесяти двух часов"}
    new: {articles: [18], quote: "Без судебного решения человек не может быть подвергнут задержанию свыше сроков, предусмотренных законом"}
    absent_terms: []
    present_terms: []
    hint_terms: ['семидесяти двух часов', '72 час\w*', 'задержан\w+ .{0,60}без санкции суда']
    level_hint: 1

  - id: amendments_referendum
    kind: procedure
    title: Изменения в Конституцию вносятся только всенародным референдумом
    summary: >
      Ст. 91 Конституции 1995 года допускала принятие поправок Парламентом. Ст. 92–93
      Конституции 2026 года: только всенародный референдум по решению Президента при наличии
      заключения Конституционного Суда. Нормы о законах, вносящих изменения в Конституцию,
      и о роли законодательного органа в этой процедуре требуют пересмотра.
    old: {articles: [91], quote: "Парламент вправе большинством не менее четырех пятых голосов ... принять закон о внесении этих изменений и дополнений в Конституцию"}
    new: {articles: [92, 93], quote: "Изменения и дополнения в Конституцию Республики Казахстан вносятся всенародным референдумом"}
    absent_terms: []
    present_terms: []
    hint_terms: ['изменени\w+ и дополнени\w+ в Конституцию', 'внос\w+ изменени\w+ .{0,30}в Конституцию']
    level_hint: 2

  - id: advocacy
    kind: new
    title: Адвокатура получила конституционный статус
    summary: >
      Ст. 86 Конституции 2026 года закрепляет роль адвокатуры в реализации права на судебную
      защиту и юридическую помощь; порядок деятельности адвоката — законом. Нормы об
      ограничении адвокатской деятельности или юридической помощи читаются теперь на фоне
      конституционной гарантии.
    old: {articles: [13], quote: "Каждый имеет право на получение квалифицированной юридической помощи"}
    new: {articles: [86, 18], quote: "Адвокатура в Республике Казахстан содействует реализации гарантированных государством прав человека на судебную защиту, на получение юридической помощи"}
    absent_terms: []
    present_terms: ['Адвокатур']
    hint_terms: ['адвокат\w*']
    level_hint: 1

  - id: rights_limits_list
    kind: reference
    title: Перечень прав, не подлежащих ограничению, — п. 3 ст. 41 (был п. 3 ст. 39) с новыми номерами статей
    summary: >
      Ст. 41 Конституции 2026 года перечисляет статьи 12, 14, 16, 17, 20, 22, 25 как не
      подлежащие ограничению ни в каких случаях; прежний перечень в п. 3 ст. 39 называл другие
      номера. Нормы, воспроизводящие прежний перечень или ссылающиеся на ст. 39, устарели.
    old: {articles: [39], quote: "Ни в каких случаях не подлежат ограничению права и свободы, предусмотренные статьями 11, 13 - 15, пунктом 1 статьи 16, статьей 17, статьей 19, статьей 22, пунктом 2 статьи 26 Конституции"}
    new: {articles: [41], quote: "Ни в каких случаях не подлежат ограничению права и свободы, предусмотренные статьями 12, 14, 16, 17, 20, 22, 25 Конституции"}
    absent_terms: []
    present_terms: []
    hint_terms: ['не подлежат ограничению', 'ограничен\w+ прав\w* и свобод']
    level_hint: 1

# Перенумерация: статья Конституции 1995 → статьи Конституции 2026 с тем же предметом.
# Пустой список — положение исключено (компетенция Палат, старые переходные положения).
article_map:
  1: [1]
  2: [2]
  3: [4]
  4: [5]
  5: [6]
  6: [8]
  7: [9]
  8: [10]
  9: [11]
  10: [13]
  11: [14]
  12: [15]
  13: [12]
  14: [16]
  15: [17]
  16: [18]
  17: [20]
  18: [21]
  19: [22]
  20: [23]
  21: [24]
  22: [25]
  23: [26]
  24: [27]
  25: [28]
  26: [29]
  27: [30]
  28: [31]
  29: [32]
  30: [33]
  31: [37]
  32: [34]
  33: [35]
  34: [36]
  35: [38]
  36: [39]
  37: [40]
  38: [37]
  39: [41]
  40: [42]
  41: [43]
  42: [44]
  43: [45]
  44: [46]
  45: [47]
  46: [48]
  47: [50]
  48: [51]
  49: [52]
  50: [53]
  51: [54]
  52: [55]
  53: [56]
  54: []
  55: []
  56: []
  57: []
  58: [57]
  59: [58]
  60: [59]
  61: [60]
  62: [61]
  63: [62]
  64: [63]
  65: [64]
  66: [65]
  67: [66]
  68: [67]
  69: [68]
  70: [69]
  71: [72]
  72: [73]
  73: [74]
  74: [75]
  75: [76]
  76: [77]
  77: [19, 78]
  78: [79]
  79: [80]
  80: [81]
  81: [82]
  82: [83]
  83: [84, 85]
  84: [86]
  85: [87]
  86: [88]
  87: [89]
  88: [90]
  89: [91]
  90: [94]
  91: [92, 93]
  92: []
  93: []
  94: []
  95: []
  96: []
  97: []
  98: []
```

- [ ] **Step 5: Загрузка, проверка, механический слой**

```python
# conformity/changes.py
"""
Реестр изменений между двумя Конституциями и механический слой анализа.

Что здесь решается без модели — решается без модели: упоминание органа, которого
нет в Конституции 2026, и ссылка на номер статьи прежней Конституции находятся
регулярными выражениями с точной цитатой. Модель получает эти факты, а не
выводит их сама: в пробе она объявила упразднённым Высший Судебный Совет,
который в Конституции 2026 есть.
"""
from __future__ import annotations

import os
import re
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Dict, List, Optional

import yaml

from .finding import Finding

_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'changes.yaml')
TRANSITIONAL = {94, 95, 96}   # переходные положения: там прежние органы названы законно
_SENTENCE_SPLIT = re.compile(r'(?<=[.;!?])\s+(?=[А-ЯЁA-Z\d«(])')
_CONST_REF = re.compile(r'(?:стать[а-яё]{1,3}|ст\.)\s*(\d+)(?:\s*[-–]\s*\d+)?[^.;]{0,60}?Конституци[ияюей]', re.IGNORECASE)


@dataclass
class Change:
    id: str
    kind: str
    title: str
    summary: str
    old_articles: List[int]
    new_articles: List[int]
    old_quote: str = ''
    new_quote: str = ''
    absent_terms: List[re.Pattern] = field(default_factory=list)
    absent_names: List[str] = field(default_factory=list)
    present_terms: List[str] = field(default_factory=list)
    hint_terms: List[re.Pattern] = field(default_factory=list)
    level_hint: int = 1


@dataclass
class ChangeSet:
    changes: List[Change]
    article_map: Dict[int, List[int]]
    present_institutions: List[str]

    def by_id(self, change_id: str) -> Optional[Change]:
        return next((c for c in self.changes if c.id == change_id), None)

    @property
    def absent_institutions(self) -> List[str]:
        """Человекочитаемый список для справки модели и экрана."""
        return [name for c in self.changes for name in c.absent_names]

    def hinted(self, norm_text: str) -> List[Change]:
        text = strip_footnotes(norm_text)
        return [c for c in self.changes if any(p.search(text) for p in c.hint_terms)]


def strip_footnotes(text: str) -> str:
    """Без сносок, примечаний и ссылок на постановления КС: там прежние органы
    названы законно (история редакций), и это не расхождение нормы."""
    text = re.sub(r'Сноска\..*?(?=\n|$)', '', text)
    text = re.sub(r'Примечание\..*?(?=\n|$)', '', text)
    text = re.sub(r'См\. нормативн\w+ постановлени\w+.*?(?=\n|$)', '', text)
    return text


def _sentence(text: str, start: int, end: int) -> str:
    """Предложение вокруг совпадения, не длиннее 300 знаков."""
    left = max(text.rfind('. ', 0, start), text.rfind('\n', 0, start), text.rfind('; ', 0, start))
    left = left + 2 if left >= 0 else 0
    right_candidates = [i for i in (text.find('. ', end), text.find('\n', end), text.find('; ', end)) if i >= 0]
    right = min(right_candidates) + 1 if right_candidates else len(text)
    sent = text[left:right].strip()
    return sent if len(sent) <= 300 else text[max(start - 140, 0):end + 140].strip()


@lru_cache(maxsize=1)
def load_changes(path: str = _PATH) -> ChangeSet:
    with open(path, encoding='utf-8') as f:
        raw = yaml.safe_load(f) or {}
    changes = []
    for row in raw.get('changes') or []:
        changes.append(Change(
            id=row['id'], kind=row['kind'], title=row['title'].strip(), summary=' '.join(row['summary'].split()),
            old_articles=[int(a) for a in (row.get('old') or {}).get('articles', [])],
            new_articles=[int(a) for a in (row.get('new') or {}).get('articles', [])],
            old_quote=(row.get('old') or {}).get('quote', ''), new_quote=(row.get('new') or {}).get('quote', ''),
            absent_terms=[re.compile(p) for p in row.get('absent_terms') or []],
            absent_names=list(row.get('absent_names') or []),
            present_terms=list(row.get('present_terms') or []),
            hint_terms=[re.compile(p, re.IGNORECASE) for p in row.get('hint_terms') or []],
            level_hint=int(row.get('level_hint', 1)),
        ))
    article_map = {int(k): [int(x) for x in (v or [])] for k, v in (raw.get('article_map') or {}).items()}
    return ChangeSet(changes, article_map, list(raw.get('present_institutions') or []))


def validate(cs: ChangeSet, articles_2026: Dict[int, str]) -> None:
    """Словарь сходится с текстом 2026: отсутствующий термин не встречается в
    действующих статьях, а каждый «появившийся» — встречается хоть раз."""
    live = '\n'.join(t for n, t in articles_2026.items() if n not in TRANSITIONAL)
    whole = '\n'.join(articles_2026.values())
    for c in cs.changes:
        for p in c.absent_terms:
            m = p.search(live)
            if m:
                raise ValueError(f'{c.id}: термин «{m.group(0)}» есть в Конституции 2026 вне переходных положений')
        for term in c.present_terms:
            if term not in whole:
                raise ValueError(f'{c.id}: «{term}» не найден в тексте Конституции 2026')


def mechanical_findings(norm_text: str, cs: ChangeSet) -> List[Finding]:
    """Находки без модели: отсутствующие институты и ссылки на прежнюю нумерацию."""
    body = strip_footnotes(norm_text)
    out: List[Finding] = []

    # 1. Институты, которых нет в Конституции 2026
    for c in cs.changes:
        hits_body = [m for p in c.absent_terms for m in p.finditer(body)]
        hits_all = [m for p in c.absent_terms for m in p.finditer(norm_text)]
        if not hits_all:
            continue
        if hits_body:
            m = hits_body[0]
            terms = sorted({h.group(0) for h in hits_body})
            out.append(Finding(
                level=2, category='terminology', method='dictionary',
                constitution_articles=list(c.new_articles), change_ids=[c.id],
                quote_norm=_sentence(body, m.start(), m.end()),
                explanation=(f'Норма называет орган, которого нет в Конституции 2026 года: {", ".join(terms)}. '
                             f'{c.title}. Полномочие или процедура, связанные с этим органом, требуют '
                             f'переадресации по Конституции 2026 (ст. {", ".join(map(str, c.new_articles))}).'),
                recommendation='Заменить упоминание прежнего органа на предусмотренный Конституцией 2026 '
                               'либо исключить норму; проверить связанные процедуры.',
            ))
        else:
            m = hits_all[0]
            out.append(Finding(
                level=1, category='terminology', method='dictionary',
                constitution_articles=list(c.new_articles), change_ids=[c.id],
                quote_norm=_sentence(norm_text, m.start(), m.end()),
                explanation=(f'Орган, которого нет в Конституции 2026 года ({m.group(0)}), упомянут только в '
                             f'сноске или примечании к статье — в истории редакций, а не в самой норме.'),
                recommendation='Проверить, не осталось ли в тексте нормы отсылок к этому органу; сноску не править.',
            ))

    # 2. Ссылки на статьи Конституции по прежней нумерации
    seen = set()
    for m in _CONST_REF.finditer(body):
        old_no = int(m.group(1))
        if old_no in seen or old_no not in cs.article_map:
            continue
        seen.add(old_no)
        new_nos = cs.article_map[old_no]
        quote = _sentence(body, m.start(), m.end())
        if not new_nos:
            out.append(Finding(
                level=2, category='reference', method='dictionary', constitution_articles=[],
                change_ids=[c.id for c in cs.changes if old_no in c.old_articles],
                quote_norm=quote,
                explanation=(f'Норма ссылается на статью {old_no} Конституции 1995 года; в Конституции 2026 года '
                             f'положения с этим предметом нет.'),
                recommendation='Установить, на какое положение Конституции 2026 должна указывать ссылка, '
                               'или исключить её.',
            ))
        elif new_nos != [old_no]:
            out.append(Finding(
                level=1, category='reference', method='dictionary', constitution_articles=list(new_nos),
                change_ids=[c.id for c in cs.changes if old_no in c.old_articles],
                quote_norm=quote,
                explanation=(f'Норма ссылается на статью {old_no} Конституции по нумерации 1995 года; в Конституции '
                             f'2026 года тот же предмет — статья {" и ".join(map(str, new_nos))}.'),
                recommendation=f'Заменить ссылку на статью {" и ".join(map(str, new_nos))} Конституции 2026 '
                               f'после проверки содержания.',
            ))
    return out
```

- [ ] **Step 6: Проверить и закоммитить**

Run: `python3 -m pytest tests/test_conformity_changes.py -q`
Expected: PASS (8).

```bash
git add conformity/finding.py conformity/changes.yaml conformity/changes.py tests/test_conformity_changes.py
git commit -m "feat(conformity): реестр изменений Конституции и механический слой по словарю

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Индекс статей Конституции 2026

**Files:**
- Create: `conformity/constitution.py`
- Test: `tests/test_conformity_constitution.py`

**Interfaces:**
- Produces: `constitution.Article(no, section_no, section_title, text, vector)`, `constitution.parse_chunk(content: str) -> Article | None`, `ConstitutionIndex(articles)`, `ConstitutionIndex.from_document(document_id) -> ConstitutionIndex` (читает `DocumentChunk`), `.article(no) -> Article | None`, `.texts -> dict[int, str]`, `.nearest(vector: np.ndarray, k: int) -> list[tuple[Article, float]]`, `.sections() -> list[dict]` (`{no, title, articles}`).

- [ ] **Step 1: Падающий тест**

```python
# tests/test_conformity_constitution.py
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from conformity.constitution import Article, ConstitutionIndex, parse_chunk  # noqa: E402

CHUNK = ('Раздел IV. Курултай\n'
         'Статья 52.\n'
         '1. Курултай Республики Казахстан – высший представительный орган.\n'
         '2. Полномочия Курултая начинаются с момента открытия его первой сессии.')


def test_parse_chunk_reads_section_and_article():
    a = parse_chunk(CHUNK)
    assert (a.no, a.section_no, a.section_title) == (52, 'IV', 'Курултай')
    assert a.text.startswith('1. Курултай')


def test_parse_chunk_without_article_is_none():
    assert parse_chunk('Раздел I. Основы\nкороткий хвост') is None


def _idx():
    return ConstitutionIndex([
        Article(1, 'I', 'Основы', 'демократическое государство', np.array([1.0, 0.0])),
        Article(52, 'IV', 'Курултай', 'высший представительный орган', np.array([0.0, 1.0])),
        Article(53, 'IV', 'Курултай', 'сто сорок пять депутатов', np.array([0.6, 0.8])),
    ])


def test_nearest_by_cosine():
    top = _idx().nearest(np.array([0.0, 1.0]), k=2)
    assert [a.no for a, _ in top] == [52, 53]
    assert top[0][1] > 0.99


def test_sections_group_articles_in_order():
    secs = _idx().sections()
    assert [s['no'] for s in secs] == ['I', 'IV']
    assert secs[1]['articles'] == [52, 53] and secs[1]['title'] == 'Курултай'
    assert _idx().texts[53] == 'сто сорок пять депутатов'
```

- [ ] **Step 2: Убедиться, что падает**

Run: `python3 -m pytest tests/test_conformity_constitution.py -q`
Expected: FAIL — `ModuleNotFoundError`.

- [ ] **Step 3: Реализация**

```python
# conformity/constitution.py
"""
Статьи Конституции 2026 с векторами — в памяти.

Их 96, векторы уже посчитаны при загрузке корпуса, поэтому ближайшие статьи к
норме ищутся numpy, а не запросом к pgvector: нет ни сети, ни зависимости от
PostgreSQL в тестах, и порядок результата воспроизводим.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

import numpy as np

_SECTION = re.compile(r'^Раздел\s+([IVX]+)\.?\s*(.*)$')
_ARTICLE = re.compile(r'^Статья\s+(\d+)\.?\s*(.*)$')


@dataclass
class Article:
    no: int
    section_no: str
    section_title: str
    text: str
    vector: Optional[np.ndarray] = None


def parse_chunk(content: str) -> Optional[Article]:
    """Чанк загрузчика: «Раздел N. Название» / «Статья N.» / тело."""
    section_no, section_title, no, body = '', '', None, []
    for line in content.split('\n'):
        line = line.strip()
        if no is None:
            m = _SECTION.match(line)
            if m:
                section_no, section_title = m.group(1), m.group(2).strip()
                continue
            m = _ARTICLE.match(line)
            if m:
                no = int(m.group(1))
                if m.group(2).strip():
                    body.append(m.group(2).strip())
                continue
            continue
        body.append(line)
    if no is None:
        return None
    return Article(no=no, section_no=section_no, section_title=section_title, text='\n'.join(body).strip())


class ConstitutionIndex:
    def __init__(self, articles: List[Article]):
        self.articles = sorted(articles, key=lambda a: a.no)
        self._by_no = {a.no: a for a in self.articles}
        with_vec = [a for a in self.articles if a.vector is not None]
        self._vec_articles = with_vec
        if with_vec:
            m = np.array([a.vector for a in with_vec], dtype=np.float32)
            norms = np.linalg.norm(m, axis=1, keepdims=True)
            norms[norms == 0] = 1.0
            self._matrix = m / norms
        else:
            self._matrix = np.zeros((0, 0), dtype=np.float32)

    @classmethod
    def from_document(cls, document_id: int) -> 'ConstitutionIndex':
        from database.models import DocumentChunk
        rows = DocumentChunk.query.filter_by(document_id=document_id).order_by(DocumentChunk.chunk_index).all()
        articles = []
        for row in rows:
            a = parse_chunk(row.content)
            if a is None:
                continue
            a.vector = row.get_embedding()
            articles.append(a)
        if not articles:
            raise ValueError(f'в документе {document_id} не найдено ни одной статьи')
        return cls(articles)

    def article(self, no: int) -> Optional[Article]:
        return self._by_no.get(no)

    @property
    def texts(self) -> Dict[int, str]:
        return {a.no: a.text for a in self.articles}

    def nearest(self, vector: np.ndarray, k: int = 4) -> List[Tuple[Article, float]]:
        if not len(self._vec_articles):
            return []
        v = np.asarray(vector, dtype=np.float32)
        n = np.linalg.norm(v)
        v = v / n if n else v
        sims = self._matrix @ v
        order = np.argsort(-sims)[:k]
        return [(self._vec_articles[i], float(sims[i])) for i in order]

    def sections(self) -> List[dict]:
        out: List[dict] = []
        for a in self.articles:
            if not out or out[-1]['no'] != a.section_no:
                out.append({'no': a.section_no, 'title': a.section_title, 'articles': []})
            out[-1]['articles'].append(a.no)
        return out
```

- [ ] **Step 4: Проверить и закоммитить**

Run: `python3 -m pytest tests/test_conformity_constitution.py -q`
Expected: PASS (4).

```bash
git add conformity/constitution.py tests/test_conformity_constitution.py
git commit -m "feat(conformity): индекс статей Конституции 2026 с поиском ближайших

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Анализ нормы: первый проход, проверка, слияние слоёв

**Files:**
- Create: `conformity/analyze.py`
- Test: `tests/test_conformity_analyze.py`

**Interfaces:**
- Consumes: `Finding`, `ChangeSet` (`hinted`, `by_id`, `present_institutions`, `absent_institutions`), `mechanical_findings`, `ConstitutionIndex.nearest/article/texts`, `provider.chat_completion(messages, model=, temperature=, max_tokens=, **kwargs) -> {'content', 'model', 'usage'}`.
- Produces: `analyze.AnalyzeConfig(triage_model, verify_model, top_articles=4, verify_from_level=2)`, `analyze.Norm(chunk_id, document_id, act_title, article_no, article_title, text, vector)`, `analyze.analyze_norm(norm, index, cs, provider, cfg) -> Finding`, `analyze.facts(cs) -> str`, `analyze.enforce_support(finding, norm_text, index, cs) -> Finding`.

- [ ] **Step 1: Падающий тест**

```python
# tests/test_conformity_analyze.py
"""
Модель подменена: проверяем правила вокруг неё — опора обязательна, второй проход
может только понизить уровень, механический слой сливается с модельным.
"""
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from conformity.analyze import AnalyzeConfig, Norm, analyze_norm, facts  # noqa: E402
from conformity.changes import load_changes  # noqa: E402
from conformity.constitution import Article, ConstitutionIndex  # noqa: E402

CS = load_changes()
CFG = AnalyzeConfig(triage_model='triage-x', verify_model='verify-x', top_articles=2)
INDEX = ConstitutionIndex([
    Article(5, 'I', 'Основы', 'Порядок действия международных договоров определяется законами.', np.array([1.0, 0.0])),
    Article(52, 'IV', 'Курултай', 'Курултай – высший представительный орган.', np.array([0.0, 1.0])),
    Article(80, 'VIII', 'Правосудие', 'Судья не может быть привлечён без согласия Курултая.', np.array([0.5, 0.5])),
])


class FakeProvider:
    def __init__(self, *answers):
        self.answers = list(answers)
        self.calls = []

    def chat_completion(self, messages, model=None, **kwargs):
        self.calls.append({'model': model, 'messages': messages})
        a = self.answers.pop(0)
        if isinstance(a, Exception):
            raise a
        return {'content': json.dumps(a, ensure_ascii=False), 'model': model, 'usage': {'total_tokens': 100}}


def norm(text, vec=(1.0, 0.0)):
    return Norm(chunk_id=7, document_id=3, act_title='Закон РК «О правовых актах»', article_no='6',
                article_title='Статья 6. Международные договоры', text=text, vector=np.array(vec))


TREATY = 'Статья 6. Международные договоры\nМеждународные договоры, ратифицированные Республикой Казахстан, имеют приоритет перед ее законами.'


def test_supported_finding_is_verified_and_kept():
    p = FakeProvider(
        {'level': 3, 'category': 'competence', 'constitution_articles': [5], 'change_ids': ['treaties_priority'],
         'quote_norm': 'имеют приоритет перед ее законами', 'explanation': 'Приоритет исключён.', 'recommendation': 'Пересмотреть.'},
        {'keep': True, 'level': 3, 'reason': 'подтверждено'},
    )
    f = analyze_norm(norm(TREATY), INDEX, CS, p, CFG)
    assert f.level == 3 and f.method == 'model+verified' and f.constitution_articles == [5]
    assert [c['model'] for c in p.calls] == ['triage-x', 'verify-x']
    # первому проходу подали и статьи, и изменение о договорах, и справку об институтах
    user = p.calls[0]['messages'][1]['content']
    assert 'treaties_priority' in user and 'Статья 5' in user and 'Высший Судебный Совет' in user


def test_level_without_a_quote_is_downgraded_and_not_verified():
    p = FakeProvider({'level': 2, 'category': 'rights', 'constitution_articles': [5], 'change_ids': [],
                      'quote_norm': '', 'explanation': 'Может быть.', 'recommendation': ''})
    f = analyze_norm(norm(TREATY), INDEX, CS, p, CFG)
    assert f.level == 0 and f.category == 'none' and len(p.calls) == 1
    assert 'нет опоры' in f.explanation


def test_quote_not_from_the_norm_is_downgraded():
    p = FakeProvider({'level': 2, 'category': 'procedure', 'constitution_articles': [5], 'change_ids': [],
                      'quote_norm': 'этого текста в норме нет', 'explanation': 'x', 'recommendation': ''})
    assert analyze_norm(norm(TREATY), INDEX, CS, p, CFG).level == 0


def test_verifier_can_lower_but_not_raise():
    p = FakeProvider(
        {'level': 2, 'category': 'competence', 'constitution_articles': [5], 'change_ids': [],
         'quote_norm': 'имеют приоритет перед ее законами', 'explanation': 'x', 'recommendation': ''},
        {'keep': False, 'level': 3, 'reason': 'вверх нельзя'},
    )
    f = analyze_norm(norm(TREATY), INDEX, CS, p, CFG)
    assert f.level == 1  # keep=False без понижения ниже 2 означает «сомнительно» → 1
    p2 = FakeProvider(
        {'level': 2, 'category': 'competence', 'constitution_articles': [5], 'change_ids': [],
         'quote_norm': 'имеют приоритет перед ее законами', 'explanation': 'x', 'recommendation': ''},
        {'keep': False, 'level': 0, 'reason': 'норма детализирует'},
    )
    assert analyze_norm(norm(TREATY), INDEX, CS, p2, CFG).level == 0


def test_dictionary_and_model_layers_merge():
    p = FakeProvider({'level': 0, 'category': 'none', 'constitution_articles': [], 'change_ids': [],
                      'quote_norm': '', 'explanation': 'Не выявлено.', 'recommendation': ''})
    text = 'Статья 27. Судья не может быть привлечен к ответственности без согласия Сената Парламента.'
    f = analyze_norm(norm(text, (0.0, 1.0)), INDEX, CS, p, CFG)
    assert f.level == 2 and f.category == 'terminology' and f.method == 'dictionary+model'
    assert 'kurultai' in f.change_ids and 52 in f.constitution_articles


def test_provider_failure_is_recorded_not_raised():
    p = FakeProvider(RuntimeError('quota'))
    f = analyze_norm(norm(TREATY), INDEX, CS, p, CFG)
    assert f.level is None and 'quota' in f.error


def test_unknown_articles_and_categories_are_dropped():
    p = FakeProvider({'level': 1, 'category': 'weird', 'constitution_articles': [5, 999], 'change_ids': ['nope', 'treaties_priority'],
                      'quote_norm': 'имеют приоритет', 'explanation': 'x', 'recommendation': ''})
    f = analyze_norm(norm(TREATY), INDEX, CS, p, CFG)
    assert f.level == 1 and f.category == 'none' and f.constitution_articles == [5] and f.change_ids == ['treaties_priority']


def test_facts_name_present_and_absent_institutions():
    text = facts(CS)
    assert 'Высший Судебный Совет' in text and 'Мажилис' in text and 'ст. 96' in text
```

- [ ] **Step 2: Убедиться, что падает**

Run: `python3 -m pytest tests/test_conformity_analyze.py -q`
Expected: FAIL — `ModuleNotFoundError: conformity.analyze`.

- [ ] **Step 3: Реализация**

```python
# conformity/analyze.py
"""
Анализ одной нормы против Конституции 2026.

Два слоя и два прохода. Механический слой (словарь институтов, перенумерация)
даёт точные находки без модели. Модель получает норму, ближайшие статьи
Конституции, относящиеся к норме изменения и справку об институтах — и отвечает
JSON. Код требует опоры (цитата из нормы + статья или изменение), иначе понижает
уровень до нуля; для уровней 2–3 второй проход другой моделью может только
подтвердить или понизить. Итоговую формулировку ТЗ здесь не пишут: её ставит
conformity/wording.py по уровню.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import List, Optional

import numpy as np

from .changes import ChangeSet, mechanical_findings, strip_footnotes
from .constitution import Article, ConstitutionIndex
from .finding import Finding
from .wording import CATEGORIES


@dataclass
class AnalyzeConfig:
    triage_model: str
    verify_model: str
    top_articles: int = 4
    verify_from_level: int = 2
    max_norm_chars: int = 3500
    max_article_chars: int = 1800


@dataclass
class Norm:
    chunk_id: int
    document_id: int
    act_title: str
    article_no: str
    article_title: str
    text: str
    vector: Optional[np.ndarray] = None


TRIAGE_SYSTEM = (
    'Вы — помощник юриста-конституционалиста. Задача: предварительный автоматизированный анализ нормы '
    'действующего акта на предмет возможного несоответствия Конституции Республики Казахстан 2026 года.\n'
    'Опирайтесь только на приведённые статьи Конституции, перечисленные изменения и справку. Не утверждайте '
    'неконституционность как факт и не пишите итоговую формулировку — её ставит система по уровню.\n\n'
    'УРОВНИ. 0 — признаков противоречия нет (значение по умолчанию). 1 — расхождение вероятно, но нужно чтение '
    'смежных норм. 2 — норма опирается на орган, полномочие или процедуру, которые в Конституции 2026 устроены '
    'иначе. 3 — норма прямо утверждает то, что Конституция 2026 исключила или запрещает.\n'
    'Уровень 1–3 допустим только при опоре: quote_norm — дословный фрагмент проверяемой нормы, и хотя бы одна '
    'статья Конституции 2026 из приведённых (constitution_articles) или изменение (change_ids). Без опоры — 0.\n\n'
    'НЕ считается противоречием: норма детализирует или развивает Конституцию; норма о том же предмете без '
    'расхождения; норма не упоминает новые институты; орган, не названный в справке, — он существует, '
    'отсутствие в справке не означает упразднения.\n\n'
    'КАТЕГОРИИ: terminology — упомянут орган из списка отсутствующих; competence — полномочие закреплено за '
    'другим органом или иначе; rights — норма сужает право или гарантию Конституции 2026; procedure — порядок, '
    'срок, процедура расходятся; reference — ссылка на статью Конституции, которой нет или она изменилась; '
    'none — без замечаний.\n\n'
    'ОТВЕТ — только JSON: {"level": 0-3, "category": "...", "constitution_articles": [номера], '
    '"change_ids": ["..."], "quote_norm": "дословно из нормы или пусто", '
    '"explanation": "2-4 предложения по-русски: что именно расходится и почему", '
    '"recommendation": "одно предложение: что сделать"}'
)

VERIFY_SYSTEM = (
    'Вы проверяете вывод первого прохода автоматизированного анализа нормы на соответствие Конституции '
    'Республики Казахстан 2026 года. Вы можете подтвердить уровень или понизить его; повышать нельзя.\n'
    'Понизьте, если: цитата не содержится в норме; названная статья Конституции не о том предмете; вывод '
    'опирается на «упразднение» органа, которого нет в списке отсутствующих (такой орган существует); норма '
    'лишь детализирует Конституцию; расхождение построено на домысле, а не на тексте.\n'
    'ОТВЕТ — только JSON: {"keep": true|false, "level": 0-3, "reason": "одно предложение"}'
)


def facts(cs: ChangeSet) -> str:
    present = '; '.join(cs.present_institutions)
    absent = '; '.join(cs.absent_institutions)
    return (
        'СПРАВКА. Конституция Республики Казахстан 2026 года принята на референдуме 15.03.2026, в силе с '
        '01.07.2026; Конституция 1995 года прекратила действие (ст. 94). Ст. 96: акты, действующие на день '
        'вступления в силу, применяются в части, не противоречащей Конституции.\n'
        f'Органы и институты, предусмотренные Конституцией 2026: {present}.\n'
        f'Органы, которых в Конституции 2026 НЕТ (названы только в переходных положениях): {absent}.\n'
        'Любой орган, не названный в этой справке, считать существующим.'
    )


def _json(content: str) -> dict:
    try:
        data = json.loads(content)
    except (TypeError, ValueError):
        m = re.search(r'\{.*\}', content or '', re.S)
        data = json.loads(m.group(0)) if m else {}
    return data if isinstance(data, dict) else {}


def _tokens(resp: dict) -> int:
    return int(((resp or {}).get('usage') or {}).get('total_tokens') or 0)


def _norm_ws(s: str) -> str:
    return re.sub(r'[\s«»"\'`]+', ' ', (s or '')).strip().lower()


def enforce_support(f: Finding, norm_text: str, index: ConstitutionIndex, cs: ChangeSet) -> Finding:
    """Правила, которые модели не доверяются: диапазон уровня, известные категории,
    существующие статьи и изменения, обязательная опора для уровня выше нуля."""
    try:
        level = int(f.level) if f.level is not None else 0
    except (TypeError, ValueError):
        level = 0
    f.level = min(3, max(0, level))
    f.category = f.category if f.category in CATEGORIES else 'none'
    f.constitution_articles = sorted({int(a) for a in f.constitution_articles
                                      if str(a).isdigit() and index.article(int(a)) is not None})
    f.change_ids = [c for c in f.change_ids if cs.by_id(c) is not None]
    if f.level == 0:
        return f
    quote = _norm_ws(f.quote_norm)
    body = _norm_ws(strip_footnotes(norm_text))
    quoted = bool(quote) and (quote[:60] in body)
    supported = bool(f.constitution_articles or f.change_ids)
    if not (quoted and supported):
        f.level = 0
        f.category = 'none'
        f.explanation = (f.explanation + ' ' if f.explanation else '') + \
            '(Понижено системой: нет опоры — дословной цитаты нормы вместе со статьёй Конституции или изменением.)'
        f.recommendation = ''
    return f


def _context_articles(norm: Norm, index: ConstitutionIndex, cs: ChangeSet, mech: List[Finding],
                      changes: List, cfg: AnalyzeConfig) -> List[Article]:
    nos: List[int] = []
    if norm.vector is not None:
        nos += [a.no for a, _ in index.nearest(norm.vector, cfg.top_articles)]
    for f in mech:
        nos += f.constitution_articles
    for c in changes:
        nos += c.new_articles
    seen, out = set(), []
    for n in nos:
        a = index.article(n)
        if a is not None and n not in seen:
            seen.add(n)
            out.append(a)
    return out[:cfg.top_articles + 3]


def _triage_user(norm: Norm, articles: List[Article], changes: List, cs: ChangeSet, cfg: AnalyzeConfig) -> str:
    parts = [facts(cs)]
    if changes:
        parts.append('ИЗМЕНЕНИЯ КОНСТИТУЦИИ, относящиеся к норме:\n' + '\n'.join(
            f'[{c.id}] {c.title}. Было (ст. {", ".join(map(str, c.old_articles)) or "—"}): «{c.old_quote}». '
            f'Стало (ст. {", ".join(map(str, c.new_articles)) or "—"}): «{c.new_quote}».'
            for c in changes))
    parts.append('СТАТЬИ КОНСТИТУЦИИ 2026 (ближайшие по смыслу и названные в изменениях):\n' + '\n\n'.join(
        f'Статья {a.no} (раздел {a.section_no}, {a.section_title}):\n{a.text[:cfg.max_article_chars]}'
        for a in articles))
    parts.append(f'ПРОВЕРЯЕМАЯ НОРМА ({norm.act_title}; {norm.article_title}):\n{norm.text[:cfg.max_norm_chars]}')
    return '\n\n'.join(parts)


def _verify(f: Finding, norm: Norm, index: ConstitutionIndex, cs: ChangeSet, provider, cfg: AnalyzeConfig) -> Finding:
    arts = '\n\n'.join(f'Статья {n}:\n{index.texts.get(n, "")[:cfg.max_article_chars]}' for n in f.constitution_articles)
    user = (f'{facts(cs)}\n\nПРОВЕРЯЕМАЯ НОРМА ({norm.act_title}; {norm.article_title}):\n'
            f'{norm.text[:cfg.max_norm_chars]}\n\nВЫВОД ПЕРВОГО ПРОХОДА:\n'
            + json.dumps({'level': f.level, 'category': f.category, 'constitution_articles': f.constitution_articles,
                          'change_ids': f.change_ids, 'quote_norm': f.quote_norm, 'explanation': f.explanation},
                         ensure_ascii=False)
            + f'\n\nСТАТЬИ КОНСТИТУЦИИ 2026, на которые он ссылается:\n{arts}')
    resp = provider.chat_completion(
        messages=[{'role': 'system', 'content': VERIFY_SYSTEM}, {'role': 'user', 'content': user}],
        model=cfg.verify_model, temperature=0.0, max_tokens=400, response_format={'type': 'json_object'})
    data = _json(resp.get('content', ''))
    f.tokens += _tokens(resp)
    f.method = 'model+verified'
    keep = bool(data.get('keep', True))
    try:
        proposed = int(data.get('level', f.level))
    except (TypeError, ValueError):
        proposed = f.level
    if keep:
        f.level = min(f.level, max(0, proposed))
    else:
        # «не подтверждаю» без явного уровня ниже — сомнение, а не опровержение: уровень 1
        f.level = min(proposed, 1) if proposed < f.level else 1
    reason = str(data.get('reason') or '').strip()
    if reason:
        f.explanation = (f.explanation + '\n\nПроверка: ' + reason).strip()
    if f.level == 0:
        f.category = 'none'
    return f


def analyze_norm(norm: Norm, index: ConstitutionIndex, cs: ChangeSet, provider, cfg: AnalyzeConfig) -> Finding:
    mech = mechanical_findings(norm.text, cs)
    changes = list(cs.hinted(norm.text))
    for f in mech:
        for cid in f.change_ids:
            c = cs.by_id(cid)
            if c and c not in changes:
                changes.append(c)
    articles = _context_articles(norm, index, cs, mech, changes, cfg)

    try:
        resp = provider.chat_completion(
            messages=[{'role': 'system', 'content': TRIAGE_SYSTEM},
                      {'role': 'user', 'content': _triage_user(norm, articles, changes, cs, cfg)}],
            model=cfg.triage_model, temperature=0.0, max_tokens=700, response_format={'type': 'json_object'})
        data = _json(resp.get('content', ''))
        model_f = Finding(
            level=data.get('level', 0), category=str(data.get('category') or 'none'), method='model',
            constitution_articles=list(data.get('constitution_articles') or []),
            change_ids=[str(c) for c in (data.get('change_ids') or [])],
            quote_norm=str(data.get('quote_norm') or '').strip(),
            explanation=str(data.get('explanation') or '').strip(),
            recommendation=str(data.get('recommendation') or '').strip(),
            model=str(resp.get('model') or cfg.triage_model), tokens=_tokens(resp),
        )
        model_f = enforce_support(model_f, norm.text, index, cs)
        if (model_f.level or 0) >= cfg.verify_from_level:
            model_f = _verify(model_f, norm, index, cs, provider, cfg)
    except Exception as e:  # noqa: BLE001 — сбой модели фиксируем в находке, прогон идёт дальше
        model_f = Finding(level=None, category='none', method='model', error=str(e)[:300], model=cfg.triage_model)

    # Слияние: уровень — максимум слоёв. Если модель упала, а словарь нашёл, норма
    # получает уровень словаря, а ошибка остаётся в находке для повторного прохода.
    result = model_f
    for f in mech:
        result = result.merge(f)
    return result
```

- [ ] **Step 4: Проверить и закоммитить**

Run: `python3 -m pytest tests/test_conformity_analyze.py -q`
Expected: PASS (8).

```bash
git add conformity/analyze.py tests/test_conformity_analyze.py
git commit -m "feat(conformity): анализ нормы — первый проход, обязательная опора, проверка, слияние слоёв

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Таблицы прогона, оркестратор и скрипт запуска

**Files:**
- Modify: `database/models.py` (три модели)
- Create: `conformity/run.py`
- Create: `scripts/run_conformity.py`
- Modify: `config.py`, `docker-compose.demo.yml`
- Test: `tests/test_conformity_run.py`

**Interfaces:**
- Produces: модели `ConformityRun`, `ConformityRunAct`, `ConformityFinding` (поля по спеке §4.6; `to_dict()` у каждой); `run.run_conformity(app, provider=None, threads=6, resume=True, retry_errors=False, only=None, limit=None, log=print) -> ConformityRun`; `run.plan_acts(registry) -> list[tuple[Document, ActMeta]]`; `run.load_norms(document_id, act_title) -> list[Norm]`; `run.recount(run) -> None`; `Config.CONFORMITY_TRIAGE_MODEL`, `Config.CONFORMITY_VERIFY_MODEL`, `Config.CONFORMITY_TOP_ARTICLES`.

- [ ] **Step 1: Падающий тест**

```python
# tests/test_conformity_run.py
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
        doc('const.txt', 'Конституция Республики Казахстан (2026)',
            [(1, 'Республика Казахстан – демократическое государство.'), (52, 'Курултай – высший представительный орган.')])
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
```

- [ ] **Step 2: Убедиться, что падает**

Run: `python3 -m pytest tests/test_conformity_run.py -q`
Expected: FAIL — `ImportError: cannot import name 'run'`.

- [ ] **Step 3: Модели**

В `database/models.py` после `class ApiKey` (перед `class DatabaseManager`):

```python
class ConformityRun(db.Model):
    """Один обход корпуса на соответствие Конституции.

    Хранится историей: перезагрузили корпус — сравнили прогоны. Статус running
    означает и «идёт», и «оборван» — различает их скрипт по времени.
    """
    __tablename__ = 'conformity_runs'

    id = db.Column(db.Integer, primary_key=True)
    public_id = db.Column(db.String(32), unique=True, nullable=False, index=True)
    status = db.Column(db.String(16), default='running', nullable=False, index=True)  # running | done | failed
    constitution_document_id = db.Column(db.Integer, db.ForeignKey('documents.id'), nullable=False)
    triage_model = db.Column(db.String(64), default='')
    verify_model = db.Column(db.String(64), default='')
    changes_version = db.Column(db.String(64), default='')
    norms_total = db.Column(db.Integer, default=0, nullable=False)
    norms_done = db.Column(db.Integer, default=0, nullable=False)
    counts_json = db.Column(db.JSON)
    tokens_used = db.Column(db.BigInteger, default=0, nullable=False)
    started_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    finished_at = db.Column(db.DateTime)

    acts = db.relationship('ConformityRunAct', backref='run', lazy='dynamic', cascade='all, delete-orphan')
    findings = db.relationship('ConformityFinding', backref='run', lazy='dynamic', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.public_id, 'status': self.status,
            'constitution_document_id': self.constitution_document_id,
            'triage_model': self.triage_model, 'verify_model': self.verify_model,
            'changes_version': self.changes_version,
            'norms_total': self.norms_total, 'norms_done': self.norms_done,
            'counts': self.counts_json or {'0': 0, '1': 0, '2': 0, '3': 0, 'errors': 0},
            'tokens_used': self.tokens_used,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'finished_at': self.finished_at.isoformat() if self.finished_at else None,
        }


class ConformityRunAct(db.Model):
    """Ход обхода: по строке на акт — когда агент начал, когда закончил, что нашёл."""
    __tablename__ = 'conformity_run_acts'
    __table_args__ = (db.UniqueConstraint('run_id', 'document_id', name='uq_conformity_run_act'),)

    id = db.Column(db.Integer, primary_key=True)
    run_id = db.Column(db.Integer, db.ForeignKey('conformity_runs.id'), nullable=False, index=True)
    document_id = db.Column(db.Integer, db.ForeignKey('documents.id'), nullable=False, index=True)
    position = db.Column(db.Integer, nullable=False)
    tier = db.Column(db.Integer, nullable=False)
    code = db.Column(db.String(64), default='')
    norms_total = db.Column(db.Integer, default=0, nullable=False)
    norms_done = db.Column(db.Integer, default=0, nullable=False)
    counts_json = db.Column(db.JSON)
    tokens = db.Column(db.BigInteger, default=0, nullable=False)
    started_at = db.Column(db.DateTime)
    finished_at = db.Column(db.DateTime)

    document = db.relationship('Document', lazy='joined')

    def to_dict(self):
        return {
            'document_id': self.document_id, 'code': self.code, 'tier': self.tier, 'position': self.position,
            'title': self.document.title if self.document else '',
            'norms_total': self.norms_total, 'norms_done': self.norms_done,
            'counts': self.counts_json or {'0': 0, '1': 0, '2': 0, '3': 0, 'errors': 0}, 'tokens': self.tokens,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'finished_at': self.finished_at.isoformat() if self.finished_at else None,
        }


class ConformityFinding(db.Model):
    """Оценка одной нормы. Уровень 0 тоже хранится: «каждая норма проверена» должно быть проверяемо."""
    __tablename__ = 'conformity_findings'
    __table_args__ = (
        db.UniqueConstraint('run_id', 'chunk_id', name='uq_conformity_finding_chunk'),
        db.Index('ix_conformity_findings_run_doc_level', 'run_id', 'document_id', 'level'),
        db.Index('ix_conformity_findings_run_level', 'run_id', 'level'),
    )

    id = db.Column(db.Integer, primary_key=True)
    run_id = db.Column(db.Integer, db.ForeignKey('conformity_runs.id'), nullable=False)
    document_id = db.Column(db.Integer, db.ForeignKey('documents.id'), nullable=False)
    chunk_id = db.Column(db.Integer, db.ForeignKey('document_chunks.id'), nullable=False)
    article_no = db.Column(db.String(16), default='')
    article_title = db.Column(db.Text, default='')
    level = db.Column(db.Integer, nullable=True)          # 0..3; NULL — не разобрана
    category = db.Column(db.String(16), default='none')
    method = db.Column(db.String(48), default='')
    constitution_articles_json = db.Column(db.JSON)
    change_ids_json = db.Column(db.JSON)
    quote_norm = db.Column(db.Text, default='')
    explanation = db.Column(db.Text, default='')
    recommendation = db.Column(db.Text, default='')
    model = db.Column(db.String(64), default='')
    tokens = db.Column(db.Integer, default=0, nullable=False)
    error = db.Column(db.Text, default='')
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    def to_dict(self):
        return {
            'id': self.id, 'document_id': self.document_id, 'chunk_id': self.chunk_id,
            'article_no': self.article_no, 'article_title': self.article_title,
            'level': self.level, 'category': self.category, 'method': self.method,
            'constitution_articles': self.constitution_articles_json or [],
            'change_ids': self.change_ids_json or [],
            'quote_norm': self.quote_norm, 'explanation': self.explanation,
            'recommendation': self.recommendation, 'model': self.model, 'tokens': self.tokens,
            'error': self.error,
        }
```

- [ ] **Step 4: Настройки**

В `config.py` после `LLM_REASONING_EFFORT`:

```python
    # Блок «Конституция»: первый проход по каждой норме — дешёвая модель, второй
    # проверочный проход для найденного — рассуждающая. Число ближайших статей
    # Конституции в контексте нормы.
    CONFORMITY_TRIAGE_MODEL = os.getenv('CONFORMITY_TRIAGE_MODEL') or LLM_MODEL
    CONFORMITY_VERIFY_MODEL = os.getenv('CONFORMITY_VERIFY_MODEL') or CHAT_LLM_MODEL
    CONFORMITY_TOP_ARTICLES = int(os.getenv('CONFORMITY_TOP_ARTICLES', '4'))
```

В `docker-compose.demo.yml` после строки `LLM_REASONING_EFFORT: ...`:

```yaml
      # Блок «Конституция»: 7 тыс. норм — первый проход на дешёвой модели,
      # проверка найденного — на рассуждающей.
      CONFORMITY_TRIAGE_MODEL: ${CONFORMITY_TRIAGE_MODEL:-gpt-4o-mini}
      CONFORMITY_VERIFY_MODEL: ${CONFORMITY_VERIFY_MODEL:-gpt-5-mini}
```

- [ ] **Step 5: Оркестратор**

```python
# conformity/run.py
"""
Прогон: все действующие акты корпуса по ярусам иерархии, каждая норма — через
analyze_norm, результат — в conformity_findings, ход обхода — в conformity_run_acts.

Возобновляемость по (run_id, chunk_id): прерванный прогон (деплой, обрыв) при
следующем запуске продолжает с места остановки. Модель и индекс не трогают базу,
поэтому анализ идёт в пуле потоков, а записывает главный поток пачками.
"""
from __future__ import annotations

import hashlib
import re
import secrets
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from typing import Callable, Dict, List, Optional, Tuple

from .analyze import AnalyzeConfig, Norm, analyze_norm
from .changes import _PATH as CHANGES_PATH, load_changes, validate
from .constitution import ConstitutionIndex
from .finding import Finding
from .registry import ActMeta, load_registry

BATCH = 25
_ARTICLE = re.compile(r'^Статья\s+([\d\-]+)\.?\s*(.*)$')
EMPTY_COUNTS = {'0': 0, '1': 0, '2': 0, '3': 0, 'errors': 0}


def changes_version(path: str = CHANGES_PATH) -> str:
    with open(path, 'rb') as f:
        return hashlib.sha1(f.read()).hexdigest()[:12]


def plan_acts(registry) -> List[Tuple['Document', ActMeta]]:  # noqa: F821
    """Действующие акты корпуса, известные реестру, кроме самой Конституции, в порядке ярусов."""
    from database.models import Document
    out = []
    for doc in Document.query.filter(Document.retired_at.is_(None)).all():
        meta = registry.act(doc.filename)
        if meta is None or meta.tier == 1 or meta.retired:
            continue
        out.append((doc, meta))
    out.sort(key=lambda p: (p[1].tier, p[1].code, p[0].title or ''))
    return out


def constitution_document(registry) -> 'Document':  # noqa: F821
    from database.models import Document
    for doc in Document.query.filter(Document.retired_at.is_(None)).all():
        meta = registry.act(doc.filename)
        if meta and meta.tier == 1 and not meta.retired:
            return doc
    raise LookupError('в корпусе нет действующей Конституции (ярус 1 в conformity/acts.yaml)')


def load_norms(document_id: int, act_title: str) -> List[Norm]:
    from database.models import DocumentChunk
    rows = DocumentChunk.query.filter_by(document_id=document_id).order_by(DocumentChunk.chunk_index).all()
    norms = []
    for row in rows:
        no, title = '', ''
        for line in row.content.split('\n'):
            m = _ARTICLE.match(line.strip())
            if m:
                no, title = m.group(1), line.strip()
                break
        norms.append(Norm(chunk_id=row.id, document_id=document_id, act_title=act_title, article_no=no,
                          article_title=title or f'Фрагмент {row.chunk_index}', text=row.content,
                          vector=row.get_embedding()))
    return norms


def _count(findings) -> Dict[str, int]:
    counts = dict(EMPTY_COUNTS)
    for f in findings:
        if f.level is None:
            counts['errors'] += 1
        else:
            counts[str(f.level)] += 1
    return counts


def recount(run) -> None:
    """Счётчики прогона и его актов — из базы, а не из памяти: так они верны и после возобновления."""
    from database.models import ConformityFinding, ConformityRunAct, db
    from sqlalchemy import func
    acts = ConformityRunAct.query.filter_by(run_id=run.id).all()
    rows = ConformityFinding.query.filter_by(run_id=run.id).with_entities(
        ConformityFinding.document_id, ConformityFinding.level, ConformityFinding.tokens).all()
    per_doc: Dict[int, list] = {}
    for doc_id, level, tokens in rows:
        per_doc.setdefault(doc_id, []).append((level, tokens))
    total = dict(EMPTY_COUNTS)
    total_tokens = 0
    for a in acts:
        mine = per_doc.get(a.document_id, [])
        counts = dict(EMPTY_COUNTS)
        for level, tokens in mine:
            counts['errors' if level is None else str(level)] += 1
            total_tokens += tokens or 0
        a.counts_json = counts
        a.norms_done = len(mine)
        a.tokens = sum(t or 0 for _, t in mine)
        for k in total:
            total[k] += counts[k]
    run.counts_json = total
    run.norms_done = len(rows)
    run.tokens_used = total_tokens
    db.session.commit()


def _to_row(run, norm: Norm, f: Finding):
    from database.models import ConformityFinding
    return ConformityFinding(
        run_id=run.id, document_id=norm.document_id, chunk_id=norm.chunk_id,
        article_no=norm.article_no, article_title=norm.article_title[:500],
        level=f.level, category=f.category, method=f.method,
        constitution_articles_json=f.constitution_articles, change_ids_json=f.change_ids,
        quote_norm=f.quote_norm, explanation=f.explanation, recommendation=f.recommendation,
        model=f.model, tokens=f.tokens, error=f.error or '',
    )


def run_conformity(app, provider=None, threads: int = 6, resume: bool = True, retry_errors: bool = False,
                   only: Optional[List[str]] = None, limit: Optional[int] = None,
                   log: Callable[..., None] = print):
    from database.models import ConformityFinding, ConformityRun, ConformityRunAct, db

    with app.app_context():
        registry = load_registry()
        cfg = AnalyzeConfig(
            triage_model=app.config.get('CONFORMITY_TRIAGE_MODEL') or __import__('config').Config.CONFORMITY_TRIAGE_MODEL,
            verify_model=app.config.get('CONFORMITY_VERIFY_MODEL') or __import__('config').Config.CONFORMITY_VERIFY_MODEL,
            top_articles=int(app.config.get('CONFORMITY_TOP_ARTICLES') or __import__('config').Config.CONFORMITY_TOP_ARTICLES),
        )
        if provider is None:
            from llm_providers.factory import LLMProviderFactory
            provider = LLMProviderFactory.get_current_provider()

        const = constitution_document(registry)
        index = ConstitutionIndex.from_document(const.id)
        cs = load_changes()
        validate(cs, index.texts)

        run = None
        if resume:
            latest = ConformityRun.query.filter_by(constitution_document_id=const.id) \
                .order_by(ConformityRun.started_at.desc())
            run = latest.filter_by(status='running').first() or (latest.first() if retry_errors else None)
            if run is not None and run.status == 'done':
                run.status, run.finished_at = 'running', None   # добиваем ошибки в завершённом прогоне
        if run is None:
            run = ConformityRun(public_id=secrets.token_hex(8), status='running', constitution_document_id=const.id,
                                triage_model=cfg.triage_model, verify_model=cfg.verify_model,
                                changes_version=changes_version(), counts_json=dict(EMPTY_COUNTS))
            db.session.add(run)
            db.session.commit()
            log(f'прогон {run.public_id}: Конституция «{const.title}», модели {cfg.triage_model} / {cfg.verify_model}')
        else:
            log(f'продолжаю прогон {run.public_id}')

        acts = plan_acts(registry)
        if only:
            acts = [(d, m) for d, m in acts if d.filename in set(only)]
        run.norms_total = sum(d.chunks.count() for d, _ in acts)
        db.session.commit()

        for position, (doc, meta) in enumerate(acts):
            act = ConformityRunAct.query.filter_by(run_id=run.id, document_id=doc.id).first()
            if act is None:
                act = ConformityRunAct(run_id=run.id, document_id=doc.id, position=position, tier=meta.tier,
                                       code=meta.code, norms_total=doc.chunks.count(), counts_json=dict(EMPTY_COUNTS))
                db.session.add(act)
            if act.started_at is None:
                act.started_at = datetime.utcnow()
            act.finished_at = None
            db.session.commit()

            done_q = ConformityFinding.query.filter_by(run_id=run.id, document_id=doc.id)
            if retry_errors:
                done_q.filter(ConformityFinding.level.is_(None)).delete(synchronize_session=False)
                db.session.commit()
            done_ids = {cid for (cid,) in done_q.with_entities(ConformityFinding.chunk_id).all()}
            norms = [n for n in load_norms(doc.id, doc.title or meta.code) if n.chunk_id not in done_ids]
            if limit is not None:
                norms = norms[:limit]
            log(f'[{meta.tier}] {meta.code}: норм {act.norms_total}, к разбору {len(norms)}')

            def work(n: Norm) -> Tuple[Norm, Finding]:
                try:
                    return n, analyze_norm(n, index, cs, provider, cfg)
                except Exception as e:  # noqa: BLE001
                    return n, Finding(level=None, method='model', error=str(e)[:300])

            pending = 0
            with ThreadPoolExecutor(max_workers=max(1, threads)) as pool:
                for n, f in pool.map(work, norms):
                    db.session.add(_to_row(run, n, f))
                    pending += 1
                    if pending >= BATCH:
                        db.session.commit()
                        recount(run)
                        pending = 0
                        log(f'    {meta.code}: {act.norms_done}/{act.norms_total}, найдено {act.counts_json["2"] + act.counts_json["3"]}')
            db.session.commit()
            recount(run)
            if limit is None:
                act.finished_at = datetime.utcnow()
            db.session.commit()
            log(f'    {meta.code} готов: {act.counts_json}')

        recount(run)
        if limit is None and run.norms_done >= run.norms_total:
            run.status = 'done'
            run.finished_at = datetime.utcnow()
        db.session.commit()
        log(f'итог: {run.status}, норм {run.norms_done}/{run.norms_total}, {run.counts_json}, токенов {run.tokens_used}')
        return run
```

- [ ] **Step 6: Скрипт**

```python
# scripts/run_conformity.py
#!/usr/bin/env python3
"""
Прогон блока «Конституция»: все акты корпуса против Конституции 2026.

    python3 scripts/run_conformity.py                  # начать или продолжить
    python3 scripts/run_conformity.py --threads 6      # число потоков к модели
    python3 scripts/run_conformity.py --retry-errors   # добить нормы, на которых упала модель
    python3 scripts/run_conformity.py --only k1500000414.20-01-2026.rus.pdf --limit 20   # проба

В контейнере: docker exec -d dalel-app sh -c 'python3 scripts/run_conformity.py > logs/conformity.log 2>&1'
Прерванный прогон продолжается следующим запуском: разобранные нормы не переспрашиваются.
"""
import argparse
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def main():
    ap = argparse.ArgumentParser(description='Прогон соответствия Конституции 2026')
    ap.add_argument('--threads', type=int, default=6)
    ap.add_argument('--no-resume', action='store_true', help='начать новый прогон, не продолжать идущий')
    ap.add_argument('--retry-errors', action='store_true')
    ap.add_argument('--only', nargs='*', default=None, help='имена файлов актов')
    ap.add_argument('--limit', type=int, default=None, help='норм на акт (проба); прогон не закрывается')
    args = ap.parse_args()

    from app import app
    from conformity.run import run_conformity

    def log(*parts):
        print(time.strftime('%H:%M:%S'), *parts, flush=True)

    run_conformity(app, threads=args.threads, resume=not args.no_resume, retry_errors=args.retry_errors,
                   only=args.only, limit=args.limit, log=log)


if __name__ == '__main__':
    main()
```

- [ ] **Step 7: Проверить и закоммитить**

Run: `python3 -m pytest tests/test_conformity_run.py tests/test_conformity_analyze.py -q`
Expected: PASS (11).

```bash
git add database/models.py config.py docker-compose.demo.yml conformity/run.py scripts/run_conformity.py tests/test_conformity_run.py
git commit -m "feat(conformity): таблицы прогона, обход по ярусам с возобновлением, скрипт запуска

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: API `/api/constitution/*`

**Files:**
- Create: `blueprints/constitution/__init__.py`, `blueprints/constitution/routes.py`
- Modify: `app.py` (регистрация после `workspace_bp`)
- Test: `tests/test_api_constitution.py`

**Interfaces:**
- Consumes: модели Task 7, `load_registry`, `load_changes`, `ConstitutionIndex.from_document`, `wording`, `category_label`.
- Produces: GET `/api/constitution/overview`, `/acts/<int:document_id>`, `/findings/<int:id>`, `/articles/<int:no>`, `/changes`. Формы ответов — ниже в коде (`_finding_payload`, `overview`).

- [ ] **Step 1: Падающий тест**

```python
# tests/test_api_constitution.py
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

    tiny = Registry(load_registry().tiers, {
        'const.txt': ActMeta('const.txt', 1, 'Конституция РК'),
        'law.pdf': ActMeta('law.pdf', 5, 'ЗРК О ПА', adilet='Z1600000480', edition='2026-01-09', url='https://adilet.zan.kz/rus/docs/Z1600000480'),
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
```

- [ ] **Step 2: Убедиться, что падает**

Run: `python3 -m pytest tests/test_api_constitution.py -q`
Expected: FAIL — `ModuleNotFoundError: blueprints.constitution`.

- [ ] **Step 3: Blueprint**

```python
# blueprints/constitution/__init__.py
from flask import Blueprint

constitution_bp = Blueprint('constitution', __name__, url_prefix='/api/constitution')

from . import routes  # noqa: E402,F401
```

```python
# blueprints/constitution/routes.py
"""
Результаты прогона соответствия Конституции 2026 — только чтение, открыто гостям.

Витрина: раздел показывает, как агент прошёл акты и что нашёл. Персональных
данных здесь нет, поэтому входа не требуется; писать сюда нечем — прогон
запускается скриптом.
"""
from __future__ import annotations

from collections import defaultdict
from typing import Dict, List

from flask import jsonify, request

from conformity.changes import load_changes
from conformity.constitution import ConstitutionIndex
from conformity.registry import load_registry
from conformity.wording import LEVELS, category_label, wording
from database.models import ConformityFinding, ConformityRun, ConformityRunAct, Document, DocumentChunk, db

from . import constitution_bp

LANGS = ('ru', 'kk', 'en')


def _err(message: str, code: int = 404, kind: str = 'not_found'):
    return jsonify({'success': False, 'error': kind, 'message': message}), code


def _latest_run():
    return ConformityRun.query.filter(ConformityRun.status.in_(('running', 'done'))) \
        .order_by(ConformityRun.started_at.desc()).first()


def _wording(level):
    return {lang: wording(level, lang) for lang in LANGS} if level is not None else None


def _act_payload(doc: Document, meta) -> dict:
    return {
        'document_id': doc.id, 'title': doc.title, 'code': meta.code if meta else doc.title,
        'tier': meta.tier if meta else None, 'adilet': meta.adilet if meta else '',
        'edition': meta.edition if meta else '', 'url': meta.url if meta else '',
    }


def _finding_payload(f: ConformityFinding) -> dict:
    out = f.to_dict()
    out['wording'] = _wording(f.level)
    out['category_label'] = {lang: category_label(f.category, lang) for lang in LANGS}
    return out


def _flagged(run) -> List[ConformityFinding]:
    return ConformityFinding.query.filter(ConformityFinding.run_id == run.id, ConformityFinding.level >= 1).all()


def _worst(levels) -> int:
    return max([lv for lv in levels if lv is not None], default=0)


@constitution_bp.route('/overview')
def overview():
    run = _latest_run()
    registry = load_registry()
    cs = load_changes()
    if run is None:
        return jsonify({'success': True, 'run': None, 'walk': [], 'tiers': [
            {'tier': t, 'title': {lang: registry.tier_title(t, lang) for lang in LANGS}, 'acts': []}
            for t in sorted(registry.tiers)], 'constitution': None, 'changes': [
            {'id': c.id, 'kind': c.kind, 'title': c.title, 'summary': c.summary,
             'old_articles': c.old_articles, 'new_articles': c.new_articles,
             'old_quote': c.old_quote, 'new_quote': c.new_quote, 'norms': 0} for c in cs.changes],
            'current': None})

    acts = ConformityRunAct.query.filter_by(run_id=run.id).order_by(ConformityRunAct.position).all()
    flagged = _flagged(run)

    per_article: Dict[int, list] = defaultdict(list)
    per_change: Dict[str, int] = defaultdict(int)
    for f in flagged:
        for n in f.constitution_articles_json or []:
            per_article[int(n)].append(f.level)
        for cid in f.change_ids_json or []:
            per_change[cid] += 1

    tiers = []
    by_tier: Dict[int, list] = defaultdict(list)
    for a in acts:
        by_tier[a.tier].append({
            'document_id': a.document_id, 'code': a.code, 'title': a.document.title if a.document else '',
            'norms': a.norms_total, 'done': a.norms_done, 'counts': a.counts_json or {},
            'worst': _worst(int(k) for k, v in (a.counts_json or {}).items() if k.isdigit() and v),
        })
    for t in sorted(registry.tiers):
        tiers.append({'tier': t, 'title': {lang: registry.tier_title(t, lang) for lang in LANGS}, 'acts': by_tier.get(t, [])})

    index = ConstitutionIndex.from_document(run.constitution_document_id)
    sections = []
    for s in index.sections():
        sections.append({'no': s['no'], 'title': s['title'], 'articles': [
            {'no': n, 'norms': len(per_article.get(n, [])), 'worst': _worst(per_article.get(n, []))} for n in s['articles']]})

    current = None
    if run.status == 'running':
        last = ConformityFinding.query.filter_by(run_id=run.id).order_by(ConformityFinding.id.desc()).first()
        if last is not None:
            act = next((a for a in acts if a.document_id == last.document_id), None)
            current = {'document_id': last.document_id, 'code': act.code if act else '', 'article_no': last.article_no}

    return jsonify({
        'success': True,
        'run': run.to_dict(),
        'walk': [a.to_dict() for a in acts],
        'tiers': tiers,
        'constitution': {'document_id': run.constitution_document_id, 'sections': sections},
        'changes': [{'id': c.id, 'kind': c.kind, 'title': c.title, 'summary': c.summary,
                     'old_articles': c.old_articles, 'new_articles': c.new_articles,
                     'old_quote': c.old_quote, 'new_quote': c.new_quote, 'norms': per_change.get(c.id, 0)}
                    for c in cs.changes],
        'current': current,
    })


@constitution_bp.route('/acts/<int:document_id>')
def act(document_id: int):
    run = _latest_run()
    doc = db.session.get(Document, document_id)
    if run is None or doc is None:
        return _err('Акт не найден')
    meta = load_registry().act(doc.filename)
    rows = ConformityFinding.query.filter_by(run_id=run.id, document_id=doc.id) \
        .join(DocumentChunk, DocumentChunk.id == ConformityFinding.chunk_id) \
        .order_by(DocumentChunk.chunk_index).all()
    if not rows and meta is None:
        return _err('Акт не найден')

    articles = [{'chunk_id': f.chunk_id, 'article_no': f.article_no, 'title': f.article_title, 'level': f.level,
                 'category': f.category, 'finding_id': f.id if (f.level or 0) >= 1 else None} for f in rows]

    level = request.args.get('level', type=int)
    category = request.args.get('category')
    flagged = [f for f in rows if (f.level or 0) >= 1]
    if level in LEVELS:
        flagged = [f for f in flagged if f.level == level]
    if category:
        flagged = [f for f in flagged if f.category == category]
    flagged.sort(key=lambda f: (-(f.level or 0), rows.index(f)))

    run_act = ConformityRunAct.query.filter_by(run_id=run.id, document_id=doc.id).first()
    return jsonify({
        'success': True, 'run': run.to_dict(),
        'act': {**_act_payload(doc, meta), 'norms': len(rows), 'counts': (run_act.counts_json if run_act else {}),
                'started_at': run_act.started_at.isoformat() if run_act and run_act.started_at else None,
                'finished_at': run_act.finished_at.isoformat() if run_act and run_act.finished_at else None},
        'articles': articles,
        'findings': [_finding_payload(f) for f in flagged],
    })


@constitution_bp.route('/findings/<int:finding_id>')
def finding(finding_id: int):
    f = db.session.get(ConformityFinding, finding_id)
    if f is None:
        return _err('Находка не найдена')
    run = db.session.get(ConformityRun, f.run_id)
    chunk = db.session.get(DocumentChunk, f.chunk_id)
    doc = db.session.get(Document, f.document_id)
    index = ConstitutionIndex.from_document(run.constitution_document_id)
    cs = load_changes()
    payload = _finding_payload(f)
    payload['norm_text'] = chunk.content if chunk else ''
    payload['act'] = _act_payload(doc, load_registry().act(doc.filename)) if doc else None
    payload['articles'] = [{'no': a.no, 'section': {'no': a.section_no, 'title': a.section_title}, 'text': a.text}
                           for a in (index.article(n) for n in f.constitution_articles_json or []) if a]
    payload['changes'] = [{'id': c.id, 'kind': c.kind, 'title': c.title, 'summary': c.summary,
                           'old_articles': c.old_articles, 'new_articles': c.new_articles,
                           'old_quote': c.old_quote, 'new_quote': c.new_quote}
                          for c in (cs.by_id(cid) for cid in f.change_ids_json or []) if c]
    return jsonify({'success': True, 'finding': payload})


@constitution_bp.route('/articles/<int:no>')
def article(no: int):
    run = _latest_run()
    if run is None:
        return _err('Прогона ещё не было')
    index = ConstitutionIndex.from_document(run.constitution_document_id)
    a = index.article(no)
    if a is None:
        return _err('Статьи с таким номером нет')
    cs = load_changes()
    registry = load_registry()
    touching = [f for f in _flagged(run) if no in (f.constitution_articles_json or [])]
    touching.sort(key=lambda f: -(f.level or 0))
    docs = {d.id: d for d in Document.query.filter(Document.id.in_({f.document_id for f in touching})).all()} if touching else {}
    norms = []
    for f in touching:
        d = docs.get(f.document_id)
        norms.append({**_finding_payload(f), 'act': _act_payload(d, registry.act(d.filename)) if d else None})
    return jsonify({'success': True, 'article': {
        'no': a.no, 'section': {'no': a.section_no, 'title': a.section_title}, 'text': a.text,
        'was': [{'id': c.id, 'kind': c.kind, 'title': c.title, 'summary': c.summary,
                 'old_articles': c.old_articles, 'old_quote': c.old_quote, 'new_quote': c.new_quote}
                for c in cs.changes if no in c.new_articles],
        'norms': norms,
    }})


@constitution_bp.route('/changes')
def changes():
    run = _latest_run()
    cs = load_changes()
    per_change: Dict[str, int] = defaultdict(int)
    if run is not None:
        for f in _flagged(run):
            for cid in f.change_ids_json or []:
                per_change[cid] += 1
    return jsonify({'success': True, 'changes': [
        {'id': c.id, 'kind': c.kind, 'title': c.title, 'summary': c.summary, 'old_articles': c.old_articles,
         'new_articles': c.new_articles, 'old_quote': c.old_quote, 'new_quote': c.new_quote,
         'norms': per_change.get(c.id, 0)} for c in cs.changes]})
```

В `app.py` после `app.register_blueprint(workspace_bp)`:

```python
# ─── Блок «Конституция»: результаты прогона соответствия, только чтение ────
from blueprints.constitution import constitution_bp
app.register_blueprint(constitution_bp)
```

- [ ] **Step 4: Проверить и закоммитить**

Run: `python3 -m pytest tests/test_api_constitution.py -q && python3 -m pytest tests -q`
Expected: PASS (5) и весь набор зелёный (прежние 352 + новые; пропуски PostgreSQL как раньше).

```bash
git add blueprints/constitution app.py tests/test_api_constitution.py
git commit -m "feat(constitution): API результатов прогона — обзор, акт, находка, статья, изменения

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: Фронтенд — каркас раздела: типы, словарь, уровни, маршруты, обзор с показателями и ходом обхода

**Files:**
- Create: `frontend/src/features/constitution/types.ts`, `dict.ts`, `levels.ts`, `Bars.tsx`, `Walk.tsx`, `OverviewPage.tsx`, `constitution.css`, `constitution.motion.css`
- Modify: `frontend/src/shared/ui/Data.tsx` (`StatusKind`), `frontend/src/shared/ui/ui.css` (`.status--note`), `frontend/src/app/routes.tsx`, `frontend/src/app/Shell.tsx`

**Interfaces:**
- Consumes: API Task 8 (`/api/constitution/overview`).
- Produces: типы для остальных экранов; `levels.levelKind(level) -> StatusKind`, `levels.levelClass(level) -> string`; `Bars.LevelBar({counts, total})`; `dict` общий для раздела; `apiLang(lang) -> 'ru'|'kk'|'en'`.

- [ ] **Step 1: Типы**

```ts
// frontend/src/features/constitution/types.ts
/** Ответы /api/constitution/*. Поля в точности как отдаёт blueprints/constitution/routes.py. */
export type ApiLang = 'ru' | 'kk' | 'en'
export type Tri = Record<ApiLang, string>

export interface Counts {
  '0': number
  '1': number
  '2': number
  '3': number
  errors: number
}

export interface Run {
  id: string
  status: 'running' | 'done' | 'failed'
  triage_model: string
  verify_model: string
  norms_total: number
  norms_done: number
  counts: Counts
  tokens_used: number
  started_at: string | null
  finished_at: string | null
}

export interface WalkAct {
  document_id: number
  code: string
  title: string
  tier: number
  position: number
  norms_total: number
  norms_done: number
  counts: Counts
  tokens: number
  started_at: string | null
  finished_at: string | null
}

export interface TierAct {
  document_id: number
  code: string
  title: string
  norms: number
  done: number
  counts: Counts
  worst: number
}

export interface Tier {
  tier: number
  title: Tri
  acts: TierAct[]
}

export interface ArticleCell {
  no: number
  norms: number
  worst: number
}

export interface Section {
  no: string
  title: string
  articles: ArticleCell[]
}

export interface Change {
  id: string
  kind: 'institution' | 'new' | 'removed' | 'procedure' | 'reference'
  title: string
  summary: string
  old_articles: number[]
  new_articles: number[]
  old_quote?: string
  new_quote?: string
  norms: number
}

export interface Overview {
  run: Run | null
  walk: WalkAct[]
  tiers: Tier[]
  constitution: { document_id: number; sections: Section[] } | null
  changes: Change[]
  current: { document_id: number; code: string; article_no: string } | null
}

export interface ActMeta {
  document_id: number
  title: string
  code: string
  tier: number | null
  adilet: string
  edition: string
  url: string
  norms: number
  counts: Counts
  started_at: string | null
  finished_at: string | null
}

export interface ArticleStrip {
  chunk_id: number
  article_no: string
  title: string
  level: number | null
  category: string
  finding_id: number | null
}

export interface Finding {
  id: number
  document_id: number
  chunk_id: number
  article_no: string
  article_title: string
  level: number | null
  category: string
  method: string
  constitution_articles: number[]
  change_ids: string[]
  quote_norm: string
  explanation: string
  recommendation: string
  model: string
  tokens: number
  error: string
  wording: Tri | null
  category_label: Tri
}

export interface ActResponse {
  run: Run
  act: ActMeta
  articles: ArticleStrip[]
  findings: Finding[]
}

export interface ConstArticle {
  no: number
  section: { no: string; title: string }
  text: string
}

export interface FindingDetail extends Finding {
  norm_text: string
  act: ActMeta | null
  articles: ConstArticle[]
  changes: Change[]
}

export interface ArticleResponse {
  article: ConstArticle & {
    was: Change[]
    norms: (Finding & { act: ActMeta | null })[]
  }
}
```

- [ ] **Step 2: Уровни и полоса долей**

```ts
// frontend/src/features/constitution/levels.ts
import type { StatusKind } from '../../shared/ui'
import type { Lang } from '../../i18n'
import type { ApiLang, Counts } from './types'

/** Уровень риска → вид статуса дизайн-системы. 1 — «note» на --ochre-ink, остальные как везде. */
export function levelKind(level: number | null | undefined): StatusKind {
  if (level === 3) return 'err'
  if (level === 2) return 'warn'
  if (level === 1) return 'note'
  return 'idle'
}

/** Класс для цвета штриха или ячейки: lv--0 … lv--3, lv--x — не разобрано. */
export function levelClass(level: number | null | undefined): string {
  return `lv--${level === null || level === undefined ? 'x' : level}`
}

export const LEVELS_DESC = [3, 2, 1, 0] as const

/** Сколько норм с уровнем выше нуля. */
export function flagged(counts: Counts | undefined): number {
  if (!counts) return 0
  return (counts['1'] ?? 0) + (counts['2'] ?? 0) + (counts['3'] ?? 0)
}

/** Язык интерфейса → код языка в ответах API: казахский там kk, а не kz. */
export function apiLang(lang: Lang): ApiLang {
  return lang === 'kz' ? 'kk' : lang
}
```

```tsx
// frontend/src/features/constitution/Bars.tsx
import type { CSSProperties } from 'react'
import type { Counts } from './types'

/**
 * Полоса долей уровней: слева высокий риск, справа — без признаков.
 * Ширины задаются разметкой, цвета — классами на токенах (constitution.css).
 */
export function LevelBar({ counts, total, className }: { counts: Counts | undefined; total: number; className?: string }) {
  const c = counts ?? { '0': 0, '1': 0, '2': 0, '3': 0, errors: 0 }
  const denom = Math.max(1, total)
  const seg = (k: keyof Counts) => ({ width: `${(100 * (c[k] ?? 0)) / denom}%` }) as CSSProperties
  return (
    <div className={['lvbar', className ?? ''].filter(Boolean).join(' ')} aria-hidden="true">
      <span className="lvbar__seg lv--3" style={seg('3')} />
      <span className="lvbar__seg lv--2" style={seg('2')} />
      <span className="lvbar__seg lv--1" style={seg('1')} />
      <span className="lvbar__seg lv--0" style={seg('0')} />
      <span className="lvbar__seg lv--x" style={seg('errors')} />
    </div>
  )
}
```

В `frontend/src/shared/ui/Data.tsx` заменить `export type StatusKind = 'ok' | 'warn' | 'err' | 'idle'` на
`export type StatusKind = 'ok' | 'warn' | 'err' | 'idle' | 'note'`.
В `frontend/src/shared/ui/ui.css` после `.status--idle { color: var(--mute); }` добавить
`.status--note { color: var(--ochre-ink); } /* «требует проверки»: охра читаемым оттенком */`.

- [ ] **Step 3: Словарь раздела**

```ts
// frontend/src/features/constitution/dict.ts
import type { Dict } from '../../i18n'

export const dict: Dict = {
  nav: { ru: 'Конституция', kz: 'Конституция', en: 'Constitution' },
  title: {
    ru: 'Конституция 2026 и действующее законодательство',
    kz: '2026 жылғы Конституция және қолданыстағы заңнама',
    en: 'The 2026 Constitution and the legislation in force',
  },
  lead: {
    ru: 'Агент прошёл акты корпуса по иерархии юридической силы и для каждой нормы оценил, есть ли признаки расхождения с Конституцией, вступившей в силу 1 июля 2026 года (ст. 96: акты применяются в части, не противоречащей Конституции).',
    kz: 'Агент корпустағы актілерді заңдық күш иерархиясы бойынша қарап, әр норма үшін 2026 жылғы 1 шілдеде күшіне енген Конституциямен алшақтық белгілері бар-жоғын бағалады (96-бап).',
    en: 'The agent walked the corpus by legal force and, for every provision, assessed whether it shows signs of divergence from the Constitution in force since 1 July 2026 (Art. 96).',
  },
  disclaimer: {
    ru: 'Автоматизированный предварительный анализ. Система не выносит заключение о неконституционности: окончательный вывод — за уполномоченным экспертом или государственным органом.',
    kz: 'Автоматтандырылған алдын ала талдау. Жүйе конституциялық емес деп қорытынды шығармайды: түпкілікті тұжырым — уәкілетті сарапшыда немесе мемлекеттік органда.',
    en: 'Automated preliminary analysis. The system does not declare acts unconstitutional: the final conclusion rests with an authorised expert or state body.',
  },

  figActs: { ru: 'Актов пройдено', kz: 'Қаралған актілер', en: 'Acts walked' },
  figNorms: { ru: 'Норм проверено', kz: 'Тексерілген нормалар', en: 'Provisions checked' },
  figHigh: { ru: 'Высокий риск', kz: 'Жоғары тәуекел', en: 'High risk' },
  figPossible: { ru: 'Возможное противоречие', kz: 'Ықтимал қайшылық', en: 'Possible conflict' },
  figReview: { ru: 'Требуют проверки', kz: 'Тексеру қажет', en: 'Need review' },
  figClean: { ru: 'Без признаков', kz: 'Белгісіз', en: 'No signs' },

  walkHead: { ru: 'Ход обхода', kz: 'Қарау барысы', en: 'The walk' },
  walkLead: {
    ru: 'Сначала словарь институтов, которых нет в Конституции 2026, и ссылок на прежнюю нумерацию; затем модель на каждой норме с ближайшими статьями Конституции в контексте; для найденного — второй проверочный проход другой моделью.',
    kz: 'Алдымен 2026 жылғы Конституцияда жоқ институттар мен бұрынғы нөмірлеуге сілтемелер сөздігі; сосын әр нормада Конституцияның жақын баптары контекстінде модель; табылғанға — басқа модельмен екінші тексеру.',
    en: 'First a dictionary of bodies absent from the 2026 Constitution and references to old numbering; then a model on every provision with the nearest Constitution articles in context; a second verification pass for what it found.',
  },
  walkNow: { ru: 'сейчас разбирает', kz: 'қазір қарап жатыр', en: 'now analysing' },
  walkNorms: { ru: 'норм', kz: 'норма', en: 'provisions' },
  walkTokens: { ru: 'токенов', kz: 'токен', en: 'tokens' },
  walkFound: { ru: 'с замечаниями', kz: 'ескертумен', en: 'flagged' },
  walkPending: { ru: 'ожидает', kz: 'күтуде', en: 'pending' },

  pyrHead: { ru: 'Пирамида юридической силы', kz: 'Заңдық күш пирамидасы', en: 'Pyramid of legal force' },
  pyrLead: {
    ru: 'Одиннадцать уровней по техническому заданию. У каждого акта — доли норм по уровню риска; пустые ярусы означают, что актов этого уровня в базе пока нет.',
    kz: 'Техникалық тапсырма бойынша он бір деңгей. Әр актіде — тәуекел деңгейі бойынша нормалар үлесі; бос сатылар — базада бұл деңгейдегі актілер әзірге жоқ.',
    en: 'Eleven levels per the terms of reference. Each act shows its share of provisions by risk level; empty tiers mean no acts of that level are in the corpus yet.',
  },
  emptyTier: { ru: 'в базе нет актов этого уровня', kz: 'базада бұл деңгейдегі актілер жоқ', en: 'no acts of this level in the corpus' },
  constitutionRow: { ru: 'Конституция Республики Казахстан — принята 15 марта 2026, в силе с 1 июля 2026. 96 статей, 11 разделов.', kz: 'Қазақстан Республикасының Конституциясы — 2026 жылғы 15 наурызда қабылданды, 1 шілдеден күшінде. 96 бап, 11 бөлім.', en: 'Constitution of the Republic of Kazakhstan — adopted 15 March 2026, in force since 1 July 2026. 96 articles, 11 sections.' },

  mapHead: { ru: 'Карта Конституции', kz: 'Конституция картасы', en: 'Map of the Constitution' },
  mapLead: {
    ru: 'Каждая ячейка — статья. Насыщенность — сколько норм действующих актов её касаются, обводка — наихудший уровень среди них. Нажмите на статью, чтобы увидеть эти нормы.',
    kz: 'Әр ұяшық — бап. Қанықтылық — оған қатысты нормалар саны, жиек — олардың ішіндегі ең жоғары деңгей. Нормаларды көру үшін бапты басыңыз.',
    en: 'Each cell is an article. Fill shows how many provisions touch it, the outline the worst level among them. Click an article to see those provisions.',
  },
  mapArticle: { ru: 'Статья', kz: 'бап', en: 'Article' },

  chgHead: { ru: 'Что изменилось', kz: 'Не өзгерді', en: 'What changed' },
  chgLead: {
    ru: 'Реестр изменений между Конституцией 1995 года и Конституцией 2026 года, на который опирается анализ. Справа — сколько норм с замечаниями связано с каждым изменением.',
    kz: '1995 және 2026 жылғы Конституциялар арасындағы өзгерістер тізілімі — талдаудың негізі. Оң жақта — әр өзгеріске байланысты ескертуі бар нормалар саны.',
    en: 'The register of changes between the 1995 and 2026 Constitutions the analysis relies on. On the right, how many flagged provisions relate to each change.',
  },
  chgAll: { ru: 'Все', kz: 'Барлығы', en: 'All' },
  kind_institution: { ru: 'институты', kz: 'институттар', en: 'institutions' },
  kind_new: { ru: 'новое', kz: 'жаңа', en: 'new' },
  kind_removed: { ru: 'исключено', kz: 'алынып тасталды', en: 'removed' },
  kind_procedure: { ru: 'процедуры', kz: 'рәсімдер', en: 'procedures' },
  kind_reference: { ru: 'нумерация', kz: 'нөмірлеу', en: 'numbering' },
  was: { ru: 'Было', kz: 'Бұрын', en: 'Was' },
  became: { ru: 'Стало', kz: 'Қазір', en: 'Now' },

  methodHead: { ru: 'Метод', kz: 'Әдіс', en: 'Method' },
  methodModels: { ru: 'Модели', kz: 'Модельдер', en: 'Models' },
  methodRun: { ru: 'Прогон', kz: 'Жүргізу', en: 'Run' },
  methodTokens: { ru: 'Токенов', kz: 'Токен', en: 'Tokens' },
  running: { ru: 'Прогон идёт', kz: 'Жүргізу жүріп жатыр', en: 'Run in progress' },
  done: { ru: 'Завершён', kz: 'Аяқталды', en: 'Completed' },

  noRunTitle: { ru: 'Прогона ещё не было', kz: 'Жүргізу әлі болмады', en: 'No run yet' },
  noRunBody: {
    ru: 'Результаты появятся здесь после первого обхода корпуса: он запускается на сервере и занимает около часа.',
    kz: 'Нәтижелер корпусты бірінші қараудан кейін шығады: ол серверде іске қосылады және шамамен бір сағат алады.',
    en: 'Results appear after the first walk of the corpus: it runs on the server and takes about an hour.',
  },

  back: { ru: 'К обзору', kz: 'Шолуға', en: 'Back to overview' },
  tier: { ru: 'Уровень', kz: 'Деңгей', en: 'Tier' },
  edition: { ru: 'Редакция', kz: 'Редакция', en: 'Edition' },
  source: { ru: 'Источник', kz: 'Дереккөз', en: 'Source' },
  barcodeHead: { ru: 'Статьи акта', kz: 'Акт баптары', en: 'Articles of the act' },
  barcodeLead: {
    ru: 'Один штрих — одна статья в порядке акта; цвет — уровень риска. Нажмите на штрих, чтобы перейти к находке.',
    kz: 'Бір жолақ — акт ретіндегі бір бап; түс — тәуекел деңгейі. Табылғанға өту үшін жолақты басыңыз.',
    en: 'One bar is one article in the order of the act; colour is the risk level. Click a bar to jump to its finding.',
  },
  findingsHead: { ru: 'Находки', kz: 'Табылғандар', en: 'Findings' },
  noFindings: { ru: 'Замечаний по выбранным фильтрам нет', kz: 'Таңдалған сүзгілер бойынша ескерту жоқ', en: 'No findings for the chosen filters' },
  allLevels: { ru: 'Все уровни', kz: 'Барлық деңгей', en: 'All levels' },
  allCategories: { ru: 'Все категории', kz: 'Барлық санат', en: 'All categories' },
  quote: { ru: 'Фрагмент нормы', kz: 'Норма үзіндісі', en: 'Provision excerpt' },
  recommendation: { ru: 'Рекомендация', kz: 'Ұсыныс', en: 'Recommendation' },
  showNorm: { ru: 'Показать норму и статьи Конституции', kz: 'Норма мен Конституция баптарын көрсету', en: 'Show the provision and Constitution articles' },
  hideNorm: { ru: 'Свернуть', kz: 'Жию', en: 'Collapse' },
  normText: { ru: 'Текст нормы', kz: 'Норма мәтіні', en: 'Provision text' },
  constArticles: { ru: 'Статьи Конституции 2026', kz: '2026 жылғы Конституция баптары', en: '2026 Constitution articles' },
  method_dictionary: { ru: 'словарь', kz: 'сөздік', en: 'dictionary' },
  method_model: { ru: 'модель', kz: 'модель', en: 'model' },
  method_verified: { ru: 'модель, проверено', kz: 'модель, тексерілді', en: 'model, verified' },

  artSection: { ru: 'Раздел', kz: 'Бөлім', en: 'Section' },
  artWas: { ru: 'Что изменилось в этой статье', kz: 'Бұл бапта не өзгерді', en: 'What changed in this article' },
  artNorms: { ru: 'Нормы, которые касаются статьи', kz: 'Бапқа қатысты нормалар', en: 'Provisions touching this article' },
  artNoNorms: { ru: 'Замечаний, связанных с этой статьёй, нет', kz: 'Бұл бапқа байланысты ескерту жоқ', en: 'No findings relate to this article' },
}

/** Метод находки → ключ словаря. */
export function methodKey(method: string): 'method_dictionary' | 'method_model' | 'method_verified' {
  if (method.includes('verified')) return 'method_verified'
  if (method.includes('model')) return 'method_model'
  return 'method_dictionary'
}
```

- [ ] **Step 4: Ход обхода**

```tsx
// frontend/src/features/constitution/Walk.tsx
import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { Body, Caption, Cite, H2, UIText } from '../../shared/ui'
import { useLang, useT } from '../../i18n'
import { citeCode } from '../legal/cite'
import { LevelBar } from './Bars'
import { dict } from './dict'
import { apiLang, flagged } from './levels'
import type { Overview, WalkAct } from './types'

/**
 * Как агент шёл по корпусу: линия времени по актам в порядке обхода.
 * Это демонстрация работы, поэтому у каждого акта видны время, объём и цена.
 */

function hhmm(iso: string | null, locale: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
}

function duration(a: WalkAct): string {
  if (!a.started_at || !a.finished_at) return ''
  const s = Math.max(0, Math.round((Date.parse(a.finished_at) - Date.parse(a.started_at)) / 1000))
  return s >= 60 ? `${Math.floor(s / 60)} мин ${s % 60} с` : `${s} с`
}

export function Walk({ data }: { data: Overview }) {
  const t = useT(dict)
  const { lang } = useLang()
  const navigate = useNavigate()
  const locale = lang === 'kz' ? 'kk-KZ' : lang === 'en' ? 'en-US' : 'ru-RU'
  const al = apiLang(lang)
  const tierTitle = (tier: number) => data.tiers.find((x) => x.tier === tier)?.title[al] ?? ''

  return (
    <section className="cn-block">
      <div className="cn-block__head">
        <H2>{t('walkHead')}</H2>
        <Body tone="mute" className="cn-block__lead">{t('walkLead')}</Body>
      </div>
      <ol className="walk">
        {data.walk.map((a, i) => {
          const state = a.finished_at ? 'done' : a.started_at ? 'live' : 'wait'
          const isCurrent = data.current?.document_id === a.document_id && data.run?.status === 'running'
          return (
            <li key={a.document_id} className={`walk__item walk__item--${state} enter-item`} style={{ '--i': i } as CSSProperties}>
              <span className={`walk__dot ${isCurrent ? 'walk__dot--pulse' : ''}`} aria-hidden="true" />
              <div className="walk__body">
                <div className="walk__row">
                  <Cite code={citeCode(a.code, lang)} onClick={() => navigate(`/constitution/acts/${a.document_id}`)} />
                  <UIText className="walk__title">{a.title}</UIText>
                  <Caption tone="mute">{tierTitle(a.tier)}</Caption>
                </div>
                <div className="walk__meta">
                  <Caption tone="mute" className="tabular">
                    {hhmm(a.started_at, locale)} → {hhmm(a.finished_at, locale)} {duration(a) ? `· ${duration(a)}` : ''}
                  </Caption>
                  <Caption tone="mute" className="tabular">{a.norms_done}/{a.norms_total} {t('walkNorms')}</Caption>
                  <Caption tone="mute" className="tabular">{a.tokens.toLocaleString('ru-RU')} {t('walkTokens')}</Caption>
                  {isCurrent && data.current ? (
                    <Caption tone="seal">{t('walkNow')}: {t('mapArticle').toLowerCase()} {data.current.article_no}</Caption>
                  ) : null}
                </div>
                <LevelBar counts={a.counts} total={a.norms_done} className="walk__bar" />
                <Caption tone="mute">{flagged(a.counts)} {t('walkFound')}</Caption>
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
```

- [ ] **Step 5: Обзор (пока без пирамиды, карты и изменений — они приходят в Task 10)**

```tsx
// frontend/src/features/constitution/OverviewPage.tsx
import { useEffect } from 'react'
import { Body, Caption, Display, Empty, H2, Label, Mono, Status, UIText } from '../../shared/ui'
import { useCountUpInt } from '../../shared/motion'
import { useLang, useT } from '../../i18n'
import { api } from '../../shared/api'
import { ListSkeleton, LoadFailure, useLoader } from '../drafts/shared'
import { Changes } from './Changes'
import { ConstitutionMap } from './ConstitutionMap'
import { Pyramid } from './Pyramid'
import { Walk } from './Walk'
import { dict } from './dict'
import type { Overview } from './types'
import '../drafts/drafts.css'
import './constitution.css'
import './constitution.motion.css'

function Figure({ value, label, tone }: { value: number; label: string; tone?: 'err' | 'warn' | 'note' | 'ok' }) {
  const shown = useCountUpInt(value)
  return (
    <div className="cn-figure">
      <span className={['cn-figure__value', tone ? `cn-figure__value--${tone}` : ''].filter(Boolean).join(' ')}>{shown}</span>
      <Caption tone="mute" className="cn-figure__label">{label}</Caption>
    </div>
  )
}

export function OverviewPage() {
  const t = useT(dict)
  const { lang } = useLang()
  const locale = lang === 'kz' ? 'kk-KZ' : lang === 'en' ? 'en-US' : 'ru-RU'
  const { data, error, loading, reload } = useLoader<Overview>(() => api.get<Overview>('/constitution/overview'), [])
  const status = data?.run?.status

  // Идущий прогон: обзор обновляется сам, раз в двадцать секунд — чаще незачем, акт разбирается минутами
  useEffect(() => {
    if (status !== 'running') return
    const id = window.setInterval(reload, 20_000)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  const run = data?.run ?? null
  const counts = run?.counts

  return (
    <div className="page cn">
      <div className="page__head">
        <div className="page__title">
          <Display>{t('title')}</Display>
          <Body tone="mute" className="cn-lead">{t('lead')}</Body>
        </div>
      </div>
      <Caption tone="mute" className="cn-disclaimer">{t('disclaimer')}</Caption>

      {loading ? (
        <ListSkeleton rows={8} />
      ) : error ? (
        <div className="ct-state"><LoadFailure error={error} onRetry={reload} /></div>
      ) : !data || !run ? (
        <div className="ct-state"><Empty title={t('noRunTitle')}>{t('noRunBody')}</Empty></div>
      ) : (
        <>
          <div className="cn-figures">
            <Figure value={data.walk.filter((a) => a.finished_at).length} label={t('figActs')} />
            <Figure value={run.norms_done} label={t('figNorms')} />
            <Figure value={counts?.['3'] ?? 0} label={t('figHigh')} tone="err" />
            <Figure value={counts?.['2'] ?? 0} label={t('figPossible')} tone="warn" />
            <Figure value={counts?.['1'] ?? 0} label={t('figReview')} tone="note" />
            <Figure value={counts?.['0'] ?? 0} label={t('figClean')} />
          </div>

          <Walk data={data} />
          <Pyramid data={data} />
          {data.constitution ? <ConstitutionMap sections={data.constitution.sections} /> : null}
          <Changes changes={data.changes} />

          <section className="cn-block cn-method">
            <H2>{t('methodHead')}</H2>
            <dl className="cn-method__grid">
              <dt><Label>{t('methodRun')}</Label></dt>
              <dd>
                <Status kind={run.status === 'done' ? 'ok' : 'warn'}>{run.status === 'done' ? t('done') : t('running')}</Status>{' '}
                <UIText tone="mute">
                  {run.started_at ? new Date(run.started_at).toLocaleString(locale, { dateStyle: 'long', timeStyle: 'short' }) : ''}
                  {run.finished_at ? ` — ${new Date(run.finished_at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}` : ''}
                </UIText>
              </dd>
              <dt><Label>{t('methodModels')}</Label></dt>
              <dd><Mono>{run.triage_model}</Mono> <UIText tone="mute">→</UIText> <Mono>{run.verify_model}</Mono></dd>
              <dt><Label>{t('methodTokens')}</Label></dt>
              <dd><UIText className="tabular">{run.tokens_used.toLocaleString('ru-RU')}</UIText></dd>
            </dl>
            <Caption tone="mute">{t('disclaimer')}</Caption>
          </section>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Стили раздела**

```css
/* frontend/src/features/constitution/constitution.css
   TURA — блок «Конституция». Значения только через var(--...) из tokens.css.
   Диаграммы — блоки и инлайновый SVG на токенах; библиотек нет. */

.cn-lead { max-width: var(--measure); }
.cn-disclaimer { display: block; max-width: var(--measure); padding: var(--s-3) 0; border-top: var(--border); border-bottom: var(--border); }

/* ---------- Показатели: числа через вертикальные линии ---------- */
.cn-figures { display: flex; flex-wrap: wrap; padding: var(--s-6) 0; border-bottom: var(--border); }
.cn-figure { flex: 1 1 0; min-width: 0; padding: 0 var(--s-5); border-left: var(--border); }
.cn-figure:first-child { padding-left: 0; border-left: 0; }
.cn-figure__value {
  display: block;
  font-family: var(--font-serif);
  font-size: var(--t-display-size);
  line-height: var(--t-display-lh);
  font-weight: var(--t-display-weight);
  letter-spacing: -0.01em;
  color: var(--ink);
}
.cn-figure__value--err { color: var(--err); }
.cn-figure__value--warn { color: var(--warn); }
.cn-figure__value--note { color: var(--ochre-ink); }
.cn-figure__label { display: block; margin-top: var(--s-1); }

/* ---------- Блок с заголовком ---------- */
.cn-block { margin-top: var(--s-12); }
.cn-block__head { display: flex; flex-direction: column; gap: var(--s-2); margin-bottom: var(--s-5); }
.cn-block__lead { max-width: var(--measure); }

/* ---------- Цвета уровней: одно место на весь раздел ---------- */
.lv--3 { --lv: var(--err); }
.lv--2 { --lv: var(--warn); }
.lv--1 { --lv: var(--ochre); }
.lv--0 { --lv: var(--rule); }
.lv--x { --lv: var(--rule-soft); }

/* ---------- Полоса долей ---------- */
.lvbar { display: flex; width: 100%; height: var(--s-2); background: var(--rule-soft); overflow: hidden; }
.lvbar__seg { height: 100%; background: var(--lv); }

/* ---------- Ход обхода ---------- */
.walk { list-style: none; margin: 0; padding: 0; border-left: 2px solid var(--rule); }
.walk__item { position: relative; padding: 0 0 var(--s-6) var(--s-6); }
.walk__item:last-child { padding-bottom: 0; }
.walk__dot {
  position: absolute; left: -7px; top: 5px;
  width: 12px; height: 12px; border-radius: 50%;
  background: var(--paper); border: 2px solid var(--ink-2);
}
.walk__item--done .walk__dot { background: var(--ink-2); }
.walk__item--wait .walk__dot { border-color: var(--rule); }
.walk__body { display: flex; flex-direction: column; gap: var(--s-2); }
.walk__row { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--s-3); }
.walk__title { color: var(--ink); }
.walk__meta { display: flex; flex-wrap: wrap; gap: var(--s-4); }
.walk__bar { max-width: 420px; }

/* ---------- Пирамида юридической силы ---------- */
.pyr { list-style: none; margin: 0; padding: 0; }
.pyr__tier { display: flex; justify-content: center; }
.pyr__band {
  width: calc(44% + var(--step) * 5.6%);
  max-width: 100%;
  border: var(--border);
  border-top: 0;
  background: var(--surface);
  padding: var(--s-3) var(--s-4);
  display: grid;
  grid-template-columns: minmax(150px, 220px) 1fr;
  gap: var(--s-3) var(--s-5);
}
.pyr__tier:first-child .pyr__band { border-top: var(--border); }
.pyr__tier--top .pyr__band { background: var(--seal); color: var(--paper); border-color: var(--seal); }
.pyr__tier--top .pyr__band .t-ui, .pyr__tier--top .pyr__band .t-label, .pyr__tier--top .pyr__band .t-caption { color: var(--paper); }
.pyr__tier--empty .pyr__band { background: transparent; border-style: dashed; }
.pyr__label { display: flex; flex-direction: column; gap: var(--s-1); }
.pyr__acts { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--s-2); }
.pyr__act {
  display: grid;
  grid-template-columns: minmax(90px, auto) 1fr minmax(120px, 200px) 5ch;
  align-items: center;
  gap: var(--s-3);
  color: inherit;
  border-bottom: 0;
  padding: var(--s-1) 0;
  transition: background var(--motion);
}
.pyr__act:hover { background: var(--ink-wash); }
.pyr__code { font-family: var(--font-mono); font-size: var(--t-mono-size); line-height: var(--t-mono-lh); font-weight: var(--t-mono-weight); color: var(--seal); }
.pyr__title { font-family: var(--font-serif); font-size: var(--t-body-size); line-height: var(--t-body-lh); color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pyr__n { text-align: right; }

/* ---------- Карта Конституции ---------- */
.cmap { display: flex; flex-direction: column; gap: var(--s-2); }
.cmap__row { display: grid; grid-template-columns: minmax(160px, 240px) 1fr; gap: var(--s-4); align-items: start; }
.cmap__sec { display: flex; gap: var(--s-2); align-items: baseline; padding-top: var(--s-1); }
.cmap__cells { display: flex; flex-wrap: wrap; gap: var(--s-1); }
.cmap__cell {
  position: relative;
  width: 36px; height: 30px;
  border: 1px solid var(--rule);
  background: var(--paper);
  color: var(--ink-2);
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: 0;
  transition: border-color var(--motion), color var(--motion);
}
.cmap__cell.lv--1, .cmap__cell.lv--2, .cmap__cell.lv--3 { border-color: var(--lv); border-width: 2px; }
.cmap__cell:hover { border-color: var(--ink); color: var(--ink); }
.cmap__fill { position: absolute; inset: 0; background: var(--ink-2); opacity: calc(var(--w) * 0.5); }
.cmap__no { position: relative; font-family: var(--font-mono); font-size: var(--t-mono-size); line-height: var(--t-mono-lh); font-weight: var(--t-mono-weight); }

/* ---------- Что изменилось ---------- */
.chg-filters { display: flex; flex-wrap: wrap; gap: var(--s-2); margin-bottom: var(--s-4); }
.chg { border-top: var(--border); }
.chg:last-child { border-bottom: var(--border); }
.chg__sum {
  display: grid;
  grid-template-columns: minmax(90px, 120px) 1fr minmax(60px, 80px);
  gap: var(--s-4);
  align-items: baseline;
  padding: var(--s-3) var(--s-2);
  cursor: pointer;
  list-style: none;
}
.chg__sum::-webkit-details-marker { display: none; }
.chg__sum:hover { background: var(--ink-wash); }
.chg__title { font-family: var(--font-serif); font-size: var(--t-legal-size); line-height: var(--t-body-lh); color: var(--ink); }
.chg__n { display: flex; align-items: center; gap: var(--s-2); justify-content: flex-end; }
.chg__body { padding: 0 var(--s-2) var(--s-5); display: flex; flex-direction: column; gap: var(--s-4); }
.chg__cols { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s-6); }
.chg__col { display: flex; flex-direction: column; gap: var(--s-2); }
.chg__refs { display: flex; flex-wrap: wrap; gap: var(--s-2); }

/* ---------- Метод ---------- */
.cn-method__grid { display: grid; grid-template-columns: max-content 1fr; gap: var(--s-2) var(--s-5); margin: var(--s-4) 0; }
.cn-method__grid dt, .cn-method__grid dd { margin: 0; }

/* ---------- Акт: реквизиты и штрих-код ---------- */
.act-meta { display: flex; flex-wrap: wrap; gap: var(--s-5); padding: var(--s-3) 0; border-bottom: var(--border); }
.act-meta__item { display: flex; flex-direction: column; gap: var(--s-1); }
.bc { display: block; width: 100%; height: 36px; margin-top: var(--s-3); }
.bc__bar { fill: var(--lv); cursor: default; transition: opacity var(--motion); }
.bc__bar--link { cursor: pointer; }
.bc__bar:hover { opacity: 0.65; }
.bc-scale { display: flex; justify-content: space-between; margin-top: var(--s-1); }
.act-filters { display: flex; flex-wrap: wrap; gap: var(--s-2); margin: var(--s-5) 0 var(--s-3); }

/* ---------- Находки: строки через линии ---------- */
.fnd-list { border-top: var(--border); }
.fnd { display: grid; grid-template-columns: 4ch 1fr; gap: var(--s-2) var(--s-4); padding: var(--s-5) var(--s-2); border-bottom: var(--border); scroll-margin-top: calc(var(--header-h) + var(--s-4)); }
.fnd__no { font-family: var(--font-serif); font-size: var(--t-h2-size); line-height: var(--t-h2-lh); color: var(--ink-2); text-align: right; }
.fnd__main { display: flex; flex-direction: column; gap: var(--s-3); min-width: 0; }
.fnd__title { font-family: var(--font-serif); font-size: var(--t-h3-size); line-height: var(--t-h3-lh); font-weight: var(--t-h2-weight); color: var(--ink); }
.fnd__tags { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--s-3); }
.fnd__quote { margin: 0; padding-left: var(--s-4); border-left: 2px solid var(--ochre); max-width: var(--measure); }
.fnd__why { max-width: var(--measure); }
.fnd__refs { display: flex; flex-wrap: wrap; gap: var(--s-2); }
.fnd__detail { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s-6); padding: var(--s-4); background: var(--surface); }
.fnd__col { display: flex; flex-direction: column; gap: var(--s-2); min-width: 0; }
.fnd__norm { white-space: pre-wrap; }
.fnd--target { background: var(--seal-wash); }

/* ---------- Статья Конституции ---------- */
.art-text { max-width: var(--measure); white-space: pre-wrap; margin: var(--s-4) 0; }
.art-was { display: flex; flex-direction: column; gap: var(--s-3); }

@media (max-width: 860px) {
  .cn-figures { gap: var(--s-4) 0; }
  .cn-figure { flex-basis: 50%; border-left: 0; padding: 0; }
  .pyr__band { width: 100%; grid-template-columns: 1fr; }
  .pyr__act { grid-template-columns: minmax(80px, auto) 1fr; }
  .pyr__act .lvbar, .pyr__n { display: none; }
  .cmap__row { grid-template-columns: 1fr; }
  .chg__sum { grid-template-columns: 1fr; }
  .chg__cols, .fnd__detail { grid-template-columns: 1fr; }
  .fnd { grid-template-columns: 1fr; }
  .fnd__no { text-align: left; }
}
```

```css
/* frontend/src/features/constitution/constitution.motion.css
   Движение раздела: появление ярусов сверху вниз, штрихи прорисовываются
   слева направо, точка идущего прогона дышит. Длительности — из tokens.css. */

.pyr__tier { animation: tura-enter var(--motion-enter) both; animation-delay: calc(min(var(--i, 0), 12) * var(--stagger)); }

@keyframes cn-grow { from { transform: scaleY(0); } to { transform: scaleY(1); } }
.bc__bar { transform-origin: bottom; animation: cn-grow var(--motion-state) both; animation-delay: calc(min(var(--i, 0), 60) * (var(--stagger) / 3)); }

@keyframes cn-pulse { 0%, 100% { box-shadow: none; opacity: 1; } 50% { opacity: 0.35; } }
.walk__dot--pulse { border-color: var(--seal); background: var(--seal); animation: cn-pulse 1.6s var(--ease) infinite; }

.lvbar__seg { transition: width var(--dur-3) var(--ease-out); }
.cmap__cell { animation: tura-enter var(--motion-enter) both; animation-delay: calc(min(var(--i, 0), 12) * (var(--stagger) / 2)); }
.fnd { animation: tura-enter var(--motion-enter) both; animation-delay: calc(min(var(--i, 0), 12) * var(--stagger)); }
```

Примечание: `tura-enter` объявлен в `frontend/src/shared/ui/motion.css`; `box-shadow: none` в keyframes допустим правилом lint-tokens (значение `none`).

- [ ] **Step 7: Маршруты и раздел в шапке**

В `frontend/src/app/routes.tsx` после `AdminPage`:

```tsx
const ConstitutionOverviewPage = lazy(() =>
  import('../features/constitution/OverviewPage').then((m) => ({ default: m.OverviewPage })),
)
const ConstitutionActPage = lazy(() =>
  import('../features/constitution/ActPage').then((m) => ({ default: m.ActPage })),
)
const ConstitutionArticlePage = lazy(() =>
  import('../features/constitution/ArticlePage').then((m) => ({ default: m.ArticlePage })),
)
```

и в `children` оболочки после `laws/:id`:

```tsx
      { path: 'constitution', element: <Deferred><ConstitutionOverviewPage /></Deferred> },
      { path: 'constitution/acts/:id', element: <Deferred><ConstitutionActPage /></Deferred> },
      { path: 'constitution/articles/:no', element: <Deferred><ConstitutionArticlePage /></Deferred> },
```

В `frontend/src/app/Shell.tsx`: в `dict` добавить `constitution: { ru: 'Конституция', kz: 'Конституция', en: 'Constitution' },`
и в `sections` после `laws`: `{ to: '/constitution', key: 'constitution' },`.

До появления `ActPage`, `ArticlePage`, `Pyramid`, `ConstitutionMap`, `Changes` (Tasks 10–11) `npm run check` будет падать на импортах — Task 9 закрывается вместе с Task 10 и 11 одним прогоном `npm run check`; коммит после Task 11.

---

### Task 10: Пирамида, карта Конституции, реестр изменений

**Files:**
- Create: `frontend/src/features/constitution/Pyramid.tsx`, `ConstitutionMap.tsx`, `Changes.tsx`

**Interfaces:**
- Consumes: типы `Overview`, `Section`, `Change`; `LevelBar`; `citeCode`; словарь.
- Produces: `Pyramid({data})`, `ConstitutionMap({sections})`, `Changes({changes})`.

- [ ] **Step 1: Пирамида**

```tsx
// frontend/src/features/constitution/Pyramid.tsx
import type { CSSProperties } from 'react'
import { Body, Caption, H2, Label, UIText } from '../../shared/ui'
import { Link } from '../../shared/nav'
import { useLang, useT } from '../../i18n'
import { citeCode } from '../legal/cite'
import { LevelBar } from './Bars'
import { dict } from './dict'
import { apiLang } from './levels'
import type { Overview } from './types'

/**
 * Одиннадцать ярусов иерархии юридической силы, сверху вниз, ступенями:
 * ширина яруса растёт к основанию. Конституция — печать на вершине.
 * Пустой ярус нарисован пунктиром и честно подписан.
 */
export function Pyramid({ data }: { data: Overview }) {
  const t = useT(dict)
  const { lang } = useLang()
  const al = apiLang(lang)

  return (
    <section className="cn-block">
      <div className="cn-block__head">
        <H2>{t('pyrHead')}</H2>
        <Body tone="mute" className="cn-block__lead">{t('pyrLead')}</Body>
      </div>
      <ol className="pyr">
        {data.tiers.map((tier, i) => {
          const top = tier.tier === 1
          const empty = !top && tier.acts.length === 0
          const cls = ['pyr__tier', top ? 'pyr__tier--top' : '', empty ? 'pyr__tier--empty' : ''].filter(Boolean).join(' ')
          return (
            <li key={tier.tier} className={cls} style={{ '--i': i, '--step': i } as CSSProperties}>
              <div className="pyr__band">
                <div className="pyr__label">
                  <Label>{tier.tier}</Label>
                  <UIText>{tier.title[al]}</UIText>
                </div>
                {top ? (
                  <Caption>{t('constitutionRow')}</Caption>
                ) : empty ? (
                  <Caption tone="mute">{t('emptyTier')}</Caption>
                ) : (
                  <ul className="pyr__acts">
                    {tier.acts.map((a) => (
                      <li key={a.document_id}>
                        <Link to={`/constitution/acts/${a.document_id}`} className="pyr__act" title={a.title}>
                          <span className="pyr__code">{citeCode(a.code, lang)}</span>
                          <span className="pyr__title">{a.title}</span>
                          <LevelBar counts={a.counts} total={a.done || a.norms} />
                          <span className="pyr__n tabular t-caption">{a.norms}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
```

- [ ] **Step 2: Карта Конституции**

```tsx
// frontend/src/features/constitution/ConstitutionMap.tsx
import type { CSSProperties } from 'react'
import { Body, Caption, H2, Mono } from '../../shared/ui'
import { Link } from '../../shared/nav'
import { useT } from '../../i18n'
import { dict } from './dict'
import { levelClass } from './levels'
import type { Section } from './types'

/**
 * 96 статей по 11 разделам. Насыщенность ячейки — сколько норм её касаются
 * (относительно самой «нагруженной» статьи), обводка — наихудший уровень.
 */
export function ConstitutionMap({ sections }: { sections: Section[] }) {
  const t = useT(dict)
  const max = Math.max(1, ...sections.flatMap((s) => s.articles.map((a) => a.norms)))
  let idx = 0
  return (
    <section className="cn-block">
      <div className="cn-block__head">
        <H2>{t('mapHead')}</H2>
        <Body tone="mute" className="cn-block__lead">{t('mapLead')}</Body>
      </div>
      <div className="cmap">
        {sections.map((s) => (
          <div key={s.no} className="cmap__row">
            <div className="cmap__sec">
              <Mono>{s.no}</Mono>
              <Caption tone="mute">{s.title}</Caption>
            </div>
            <div className="cmap__cells">
              {s.articles.map((a) => {
                const i = idx++
                return (
                  <Link
                    key={a.no}
                    to={`/constitution/articles/${a.no}`}
                    className={`cmap__cell ${levelClass(a.worst)}`}
                    style={{ '--w': a.norms / max, '--i': i % 12 } as CSSProperties}
                    title={`${t('mapArticle')} ${a.no} · ${a.norms}`}
                    aria-label={`${t('mapArticle')} ${a.no}, ${a.norms}`}
                  >
                    <span className="cmap__fill" aria-hidden="true" />
                    <span className="cmap__no">{a.no}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Что изменилось**

```tsx
// frontend/src/features/constitution/Changes.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Body, Caption, Chip, Cite, H2, Label, Legal } from '../../shared/ui'
import { useLang, useT } from '../../i18n'
import { citeCode } from '../legal/cite'
import { dict } from './dict'
import type { Change } from './types'

const KINDS: Change['kind'][] = ['institution', 'new', 'removed', 'procedure', 'reference']

/** Реестр «было → стало» с числом затронутых норм; раскрытие строки — цитаты обеих Конституций. */
export function Changes({ changes }: { changes: Change[] }) {
  const t = useT(dict)
  const { lang } = useLang()
  const navigate = useNavigate()
  const [kind, setKind] = useState<Change['kind'] | null>(null)
  const shown = kind ? changes.filter((c) => c.kind === kind) : changes
  const max = Math.max(1, ...changes.map((c) => c.norms))

  return (
    <section className="cn-block">
      <div className="cn-block__head">
        <H2>{t('chgHead')}</H2>
        <Body tone="mute" className="cn-block__lead">{t('chgLead')}</Body>
      </div>
      <div className="chg-filters">
        <Chip active={kind === null} onClick={() => setKind(null)}>{t('chgAll')}</Chip>
        {KINDS.filter((k) => changes.some((c) => c.kind === k)).map((k) => (
          <Chip key={k} active={kind === k} onClick={() => setKind(kind === k ? null : k)}>{t(`kind_${k}`)}</Chip>
        ))}
      </div>
      <div>
        {shown.map((c) => (
          <details key={c.id} className="chg">
            <summary className="chg__sum">
              <Caption tone="mute">{t(`kind_${c.kind}`)}</Caption>
              <span className="chg__title">{c.title}</span>
              <span className="chg__n">
                <span className="lvbar" style={{ width: `${Math.max(8, (100 * c.norms) / max)}%` }} aria-hidden="true">
                  <span className="lvbar__seg lv--2" style={{ width: '100%' }} />
                </span>
                <span className="tabular t-caption">{c.norms}</span>
              </span>
            </summary>
            <div className="chg__body">
              <div className="chg__cols">
                <div className="chg__col">
                  <Label>{t('was')}</Label>
                  {c.old_quote ? <Legal>«{c.old_quote}»</Legal> : <Caption tone="mute">—</Caption>}
                  <div className="chg__refs">
                    {c.old_articles.map((n) => <Cite key={n} code={citeCode(`Конституция РК (1995) ${n}`, lang)} disabled />)}
                  </div>
                </div>
                <div className="chg__col">
                  <Label>{t('became')}</Label>
                  {c.new_quote ? <Legal>«{c.new_quote}»</Legal> : <Caption tone="mute">—</Caption>}
                  <div className="chg__refs">
                    {c.new_articles.map((n) => (
                      <Cite key={n} code={citeCode(`Конституция РК ${n}`, lang)} onClick={() => navigate(`/constitution/articles/${n}`)} />
                    ))}
                  </div>
                </div>
              </div>
              <Body>{c.summary}</Body>
            </div>
          </details>
        ))}
      </div>
    </section>
  )
}
```

---

### Task 11: Экраны акта и статьи Конституции

**Files:**
- Create: `frontend/src/features/constitution/Barcode.tsx`, `Findings.tsx`, `ActPage.tsx`, `ArticlePage.tsx`

**Interfaces:**
- Consumes: `/api/constitution/acts/<id>?level=&category=`, `/api/constitution/findings/<id>`, `/api/constitution/articles/<no>`.
- Produces: `Barcode({articles, onPick})`, `Findings({items, withAct?})`, `ActPage()`, `ArticlePage()`.

- [ ] **Step 1: Штрих-код**

```tsx
// frontend/src/features/constitution/Barcode.tsx
import type { CSSProperties } from 'react'
import { useLang } from '../../i18n'
import { apiLang, levelClass } from './levels'
import type { ArticleStrip, Tri } from './types'

/**
 * Один штрих на статью в порядке акта. Ширина — от числа статей, высота фиксирована;
 * SVG растягивается по ширине контейнера (preserveAspectRatio="none").
 */
export function Barcode({ articles, wording, onPick }: {
  articles: ArticleStrip[]
  wording: Record<number, Tri>
  onPick: (findingId: number) => void
}) {
  const { lang } = useLang()
  const al = apiLang(lang)
  const n = Math.max(1, articles.length)
  const W = 1000
  const H = 36
  const w = W / n
  const gap = n > 400 ? 0 : Math.min(1, w * 0.25)
  return (
    <svg className="bc" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`${articles.length}`}>
      {articles.map((a, i) => {
        const level = a.level ?? null
        const label = `${a.title || a.article_no}${level && wording[level] ? ` · ${wording[level][al]}` : ''}`
        return (
          <rect
            key={a.chunk_id}
            className={`bc__bar ${levelClass(level)} ${a.finding_id ? 'bc__bar--link' : ''}`}
            x={i * w}
            y={0}
            width={Math.max(0.6, w - gap)}
            height={H}
            style={{ '--i': i % 60 } as CSSProperties}
            onClick={() => a.finding_id && onPick(a.finding_id)}
          >
            <title>{label}</title>
          </rect>
        )
      })}
    </svg>
  )
}
```

- [ ] **Step 2: Список находок с раскрытием нормы**

```tsx
// frontend/src/features/constitution/Findings.tsx
import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { Body, Button, Caption, Cite, Label, Legal, Loading, Status, UIText } from '../../shared/ui'
import { useLang, useT } from '../../i18n'
import { api, errorMessage } from '../../shared/api'
import { citeCode } from '../legal/cite'
import { dict, methodKey } from './dict'
import { apiLang, levelKind } from './levels'
import type { ActMeta, Finding, FindingDetail } from './types'

function Detail({ id }: { id: number }) {
  const t = useT(dict)
  const [data, setData] = useState<FindingDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    api.get<{ finding: FindingDetail }>(`/constitution/findings/${id}`)
      .then((r) => { if (alive) setData(r.finding) })
      .catch((e) => { if (alive) setError(errorMessage(e, 'Не загрузилось')) })
    return () => { alive = false }
  }, [id])
  if (error) return <Caption tone="err">{error}</Caption>
  if (!data) return <Loading />
  return (
    <div className="fnd__detail">
      <div className="fnd__col">
        <Label>{t('normText')}</Label>
        <Legal className="fnd__norm">{data.norm_text}</Legal>
      </div>
      <div className="fnd__col">
        <Label>{t('constArticles')}</Label>
        {data.articles.map((a) => (
          <div key={a.no} className="fnd__col">
            <UIText tone="ink2">{t('mapArticle')} {a.no} · {a.section.title}</UIText>
            <Legal className="fnd__norm">{a.text}</Legal>
          </div>
        ))}
        {data.changes.map((c) => (
          <div key={c.id} className="fnd__col">
            <UIText tone="ink2">{c.title}</UIText>
            <Body tone="mute">{c.summary}</Body>
          </div>
        ))}
      </div>
    </div>
  )
}

export function Findings({ items, withAct, targetId }: {
  items: (Finding & { act?: ActMeta | null })[]
  withAct?: boolean
  targetId?: number | null
}) {
  const t = useT(dict)
  const { lang } = useLang()
  const al = apiLang(lang)
  const navigate = useNavigate()
  const [open, setOpen] = useState<Record<number, boolean>>({})

  if (!items.length) return <Caption tone="mute">{t('noFindings')}</Caption>

  return (
    <div className="fnd-list">
      {items.map((f, i) => (
        <article
          key={f.id}
          id={`f-${f.id}`}
          className={['fnd', targetId === f.id ? 'fnd--target' : ''].filter(Boolean).join(' ')}
          style={{ '--i': i } as CSSProperties}
        >
          <span className="fnd__no">{f.article_no}</span>
          <div className="fnd__main">
            <div>
              {withAct && f.act ? (
                <Cite code={citeCode(f.act.code, lang)} onClick={() => navigate(`/constitution/acts/${f.act!.document_id}`)} />
              ) : null}
              <h3 className="fnd__title">{f.article_title}</h3>
            </div>
            <div className="fnd__tags">
              {f.wording ? <Status kind={levelKind(f.level)}>{f.wording[al]}</Status> : null}
              <Caption tone="mute">{f.category_label[al]}</Caption>
              <Caption tone="mute">{t(methodKey(f.method))}</Caption>
            </div>
            {f.quote_norm ? <blockquote className="fnd__quote t-legal">«{f.quote_norm}»</blockquote> : null}
            {f.explanation ? <Body className="fnd__why">{f.explanation}</Body> : null}
            {f.recommendation ? (
              <Body className="fnd__why"><UIText tone="ink2">{t('recommendation')}:</UIText> {f.recommendation}</Body>
            ) : null}
            {f.constitution_articles.length ? (
              <div className="fnd__refs">
                {f.constitution_articles.map((n) => (
                  <Cite key={n} code={citeCode(`Конституция РК ${n}`, lang)} onClick={() => navigate(`/constitution/articles/${n}`)} />
                ))}
              </div>
            ) : null}
            <div>
              <Button variant="ghost" onClick={() => setOpen((o) => ({ ...o, [f.id]: !o[f.id] }))}>
                {open[f.id] ? t('hideNorm') : t('showNorm')}
              </Button>
            </div>
            {open[f.id] ? <Detail id={f.id} /> : null}
          </div>
        </article>
      ))}
    </div>
  )
}
```

`Button` принимает `variant` (`primary | secondary | ghost | danger`); `Cite` с `disabled` — обычный атрибут кнопки.

- [ ] **Step 3: Экран акта**

```tsx
// frontend/src/features/constitution/ActPage.tsx
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Body, Caption, Chip, Display, Empty, H2, Label, Mono, UIText } from '../../shared/ui'
import { Link } from '../../shared/nav'
import { useLang, useT } from '../../i18n'
import { api } from '../../shared/api'
import { ListSkeleton, LoadFailure, useLoader } from '../drafts/shared'
import { Barcode } from './Barcode'
import { LevelBar } from './Bars'
import { Findings } from './Findings'
import { dict } from './dict'
import { LEVELS_DESC, apiLang } from './levels'
import type { ActResponse, Tri } from './types'
import '../drafts/drafts.css'
import './constitution.css'
import './constitution.motion.css'

export function ActPage() {
  const { id } = useParams()
  const t = useT(dict)
  const { lang } = useLang()
  const al = apiLang(lang)
  const [level, setLevel] = useState<number | null>(null)
  const [category, setCategory] = useState<string | null>(null)
  const [target, setTarget] = useState<number | null>(null)

  const query = [level !== null ? `level=${level}` : '', category ? `category=${category}` : ''].filter(Boolean).join('&')
  const { data, error, loading, reload } = useLoader<ActResponse>(
    () => api.get<ActResponse>(`/constitution/acts/${id}${query ? `?${query}` : ''}`),
    [id, query],
  )

  // Формулировки уровней для подписей штрихов берём из находок: код их не дублирует
  const wording = useMemo(() => {
    const out: Record<number, Tri> = {}
    for (const f of data?.findings ?? []) if (f.level !== null && f.wording) out[f.level] = f.wording
    return out
  }, [data])

  const categories = useMemo(() => {
    const seen = new Map<string, Tri>()
    for (const f of data?.findings ?? []) if (!seen.has(f.category)) seen.set(f.category, f.category_label)
    return [...seen.entries()]
  }, [data])

  useEffect(() => {
    if (target === null) return
    document.getElementById(`f-${target}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [target, data])

  const pick = (findingId: number) => {
    setLevel(null)
    setCategory(null)
    setTarget(findingId)
  }

  return (
    <div className="page cn">
      <Link to="/constitution" className="t-ui">← {t('back')}</Link>
      {loading && !data ? (
        <ListSkeleton rows={8} />
      ) : error ? (
        <div className="ct-state"><LoadFailure error={error} onRetry={reload} /></div>
      ) : !data ? (
        <div className="ct-state"><Empty title={t('noRunTitle')}>{t('noRunBody')}</Empty></div>
      ) : (
        <>
          <div className="page__head">
            <div className="page__title">
              <Display>{data.act.title}</Display>
              <Body tone="mute">{data.act.code}</Body>
            </div>
          </div>
          <div className="act-meta">
            <div className="act-meta__item"><Label>{t('tier')}</Label><UIText>{data.act.tier ?? '—'}</UIText></div>
            <div className="act-meta__item"><Label>{t('edition')}</Label><UIText className="tabular">{data.act.edition || '—'}</UIText></div>
            <div className="act-meta__item">
              <Label>{t('source')}</Label>
              {data.act.url ? <a href={data.act.url} target="_blank" rel="noreferrer"><Mono>{data.act.adilet}</Mono></a> : <UIText>—</UIText>}
            </div>
            <div className="act-meta__item"><Label>{t('figNorms')}</Label><UIText className="tabular">{data.act.norms}</UIText></div>
          </div>

          <section className="cn-block">
            <div className="cn-block__head">
              <H2>{t('barcodeHead')}</H2>
              <Body tone="mute" className="cn-block__lead">{t('barcodeLead')}</Body>
            </div>
            <Barcode articles={data.articles} wording={wording} onPick={pick} />
            <div className="bc-scale">
              <Caption tone="mute" className="tabular">{data.articles[0]?.article_no ?? ''}</Caption>
              <Caption tone="mute" className="tabular">{data.articles[data.articles.length - 1]?.article_no ?? ''}</Caption>
            </div>
            <LevelBar counts={data.act.counts} total={data.act.norms} className="walk__bar" />
          </section>

          <section className="cn-block">
            <div className="cn-block__head"><H2>{t('findingsHead')}</H2></div>
            <div className="act-filters">
              <Chip active={level === null} onClick={() => setLevel(null)}>{t('allLevels')}</Chip>
              {LEVELS_DESC.filter((lv) => lv > 0).map((lv) => (
                <Chip key={lv} active={level === lv} onClick={() => setLevel(level === lv ? null : lv)}>
                  {wording[lv]?.[al] ?? lv} · {data.act.counts[String(lv) as '1' | '2' | '3'] ?? 0}
                </Chip>
              ))}
            </div>
            {categories.length > 1 ? (
              <div className="act-filters">
                <Chip active={category === null} onClick={() => setCategory(null)}>{t('allCategories')}</Chip>
                {categories.map(([key, label]) => (
                  <Chip key={key} active={category === key} onClick={() => setCategory(category === key ? null : key)}>{label[al]}</Chip>
                ))}
              </div>
            ) : null}
            <Findings items={data.findings} targetId={target} />
          </section>
          <Caption tone="mute" className="cn-disclaimer">{t('disclaimer')}</Caption>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Экран статьи Конституции**

```tsx
// frontend/src/features/constitution/ArticlePage.tsx
import { useParams } from 'react-router-dom'
import { Body, Caption, Display, Empty, H2, Legal, UIText } from '../../shared/ui'
import { Link } from '../../shared/nav'
import { useT } from '../../i18n'
import { api } from '../../shared/api'
import { ListSkeleton, LoadFailure, useLoader } from '../drafts/shared'
import { Findings } from './Findings'
import { dict } from './dict'
import type { ArticleResponse } from './types'
import '../drafts/drafts.css'
import './constitution.css'
import './constitution.motion.css'

export function ArticlePage() {
  const { no } = useParams()
  const t = useT(dict)
  const { data, error, loading, reload } = useLoader<ArticleResponse>(
    () => api.get<ArticleResponse>(`/constitution/articles/${no}`),
    [no],
  )
  const a = data?.article

  return (
    <div className="page cn">
      <Link to="/constitution" className="t-ui">← {t('back')}</Link>
      {loading ? (
        <ListSkeleton rows={6} />
      ) : error ? (
        <div className="ct-state"><LoadFailure error={error} onRetry={reload} /></div>
      ) : !a ? (
        <div className="ct-state"><Empty title={t('noRunTitle')}>{t('noRunBody')}</Empty></div>
      ) : (
        <>
          <div className="page__head">
            <div className="page__title">
              <Display>{t('mapArticle')} {a.no}</Display>
              <Body tone="mute">{t('artSection')} {a.section.no}. {a.section.title}</Body>
            </div>
          </div>
          <Legal className="art-text">{a.text}</Legal>

          {a.was.length ? (
            <section className="cn-block">
              <div className="cn-block__head"><H2>{t('artWas')}</H2></div>
              <div className="art-was">
                {a.was.map((c) => (
                  <div key={c.id} className="chg__col">
                    <UIText>{c.title}</UIText>
                    {c.old_quote ? <Caption tone="mute">{t('was')}: «{c.old_quote}»</Caption> : null}
                    <Body tone="mute">{c.summary}</Body>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="cn-block">
            <div className="cn-block__head"><H2>{t('artNorms')}</H2></div>
            {a.norms.length ? <Findings items={a.norms} withAct /> : <Caption tone="mute">{t('artNoNorms')}</Caption>}
          </section>
          <Caption tone="mute" className="cn-disclaimer">{t('disclaimer')}</Caption>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Проверка типов, токенов и сборка; коммит Tasks 9–11**

Run: `cd frontend && npm run check && npm run build && cd ..`
Expected: `tsc` без ошибок, lint-tokens «ок», сборка в `static/app`.

```bash
git add frontend/src/features/constitution frontend/src/shared/ui/Data.tsx frontend/src/shared/ui/ui.css frontend/src/app/routes.tsx frontend/src/app/Shell.tsx
git commit -m "feat(constitution): раздел «Конституция» — обзор с ходом обхода, пирамида, карта, акт, статья

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 12: Карточка раздела на главной

**Files:**
- Modify: `frontend/src/features/public/HomePage.tsx` (`dict`, `MODS`, `Modules`, новый `MiniConstitution`)
- Modify: `frontend/src/features/public/home.css`

- [ ] **Step 1: Словарь и карточка**

В `dict` `HomePage.tsx` после `mod4d`:

```ts
  mod5: { ru: 'Конституция', kz: 'Конституция', en: 'Constitution' },
  mod5d: {
    ru: 'Агент прошёл кодексы и законы и показал, где они расходятся с Конституцией 2026 года.',
    kz: 'Агент кодекстер мен заңдарды қарап, олардың 2026 жылғы Конституциямен қайда алшақтайтынын көрсетті.',
    en: 'The agent walked the codes and laws and shows where they diverge from the 2026 Constitution.',
  },
```

В `MODS` пятой строкой: `{ id: 'const', icon: 'scale', name: 'mod5', body: 'mod5d', to: '/constitution', tone: 'lemon' },`

В `Modules()` внутри `.modc__art` после строки про `stats`: `{m.id === 'const' ? <MiniConstitution shown={shown} /> : null}`

Перед `const MODS` добавить иллюстрацию — штрих-код акта в миниатюре:

```tsx
/** Миниатюра раздела «Конституция»: штрих-код статей акта, три штриха с замечаниями. */
const MINI_BARS = [0, 0, 0, 3, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 3, 0]
function MiniConstitution({ shown }: { shown: boolean }) {
  return (
    <div className={['mini', 'mini--const', shown ? 'mini--on' : ''].filter(Boolean).join(' ')} aria-hidden="true">
      <div className="mbc">
        {MINI_BARS.map((lv, i) => (
          <span key={i} className={`mbc__bar mbc__bar--${lv}`} style={idx(i)} />
        ))}
      </div>
      <div className="mbc__legend">
        <span className="mbc__dot mbc__bar--3" /> <span>высокий риск</span>
        <span className="mbc__dot mbc__bar--2" /> <span>возможное противоречие</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Стили карточки**

В `home.css` после `.modc--mint .modc__icon { … }`:

```css
.modc--lemon .modc__icon { background: var(--h-lemon); }
/* Пятая карточка — одна в последней строке: занимает всю ширину, как витрина блока */
.modc:last-child:nth-child(odd) { grid-column: 1 / -1; }

/* Миниатюра «Конституция»: штрих-код */
.mini--const { display: flex; flex-direction: column; gap: var(--s-3); }
.mbc { display: flex; gap: 2px; height: 44px; align-items: flex-end; }
.mbc__bar { flex: 1 1 0; height: 100%; background: var(--h-line); transform-origin: bottom; transform: scaleY(0); transition: transform var(--h-draw) var(--ease-out); transition-delay: calc(var(--i, 0) * 25ms); }
.mini--on .mbc__bar { transform: scaleY(1); }
.mbc__bar--1 { background: var(--h-neu); }
.mbc__bar--2 { background: var(--h-warn); }
.mbc__bar--3 { background: var(--h-err); }
.mbc__legend { display: flex; align-items: center; gap: var(--s-2); font-size: var(--t-caption-size); color: var(--h-mute); }
.mbc__dot { width: var(--s-2); height: var(--s-2); display: inline-block; }
```

Класс `mini--on` новый, объявлен здесь же; `idx(i)` уже определён в `HomePage.tsx:363` и ставит `--i`. Сборка `static/app` в git не попадает (каталог в .gitignore) — собирается перед выкладкой.

- [ ] **Step 3: Проверка и коммит**

Run: `cd frontend && npm run check && npm run build && cd ..`
Expected: без ошибок.

```bash
git add frontend/src/features/public/HomePage.tsx frontend/src/features/public/home.css
git commit -m "feat(home): карточка раздела «Конституция» на главной

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 13: Выкладка, загрузка Конституции, прогон на проде, проверка

**Files:** нет новых; действия на сервере через `scratchpad/dmz.sh` (обёртка ssh к `user@95.141.135.244`).

- [ ] **Step 1: Полная проверка локально и push**

Run: `python3 -m pytest tests -q && cd frontend && npm run check && npm run build && cd .. && git status --short && git push origin version4redisign`
Expected: тесты зелёные, сборка свежая, рабочее дерево чистое, ветка отправлена.

- [ ] **Step 2: Бэкенд на прод**

```bash
dmz.sh "cd ~/dalel && git pull --ff-only && docker compose -f docker-compose.demo.yml up -d --build app && sleep 40 && docker compose -f docker-compose.demo.yml ps app"
```
Expected: `dalel-app … Up (healthy)`. Проверить: `curl -s https://law.archeo.asia/api/constitution/overview | head -c 300` → `{"success": true, "run": null, …}`.

- [ ] **Step 3: Конституция 2026 в корпус, 1995 — в отставку**

```bash
dmz.sh "docker exec dalel-app python3 scripts/load_legal_docs.py --embed --only k2600000000.01-07-2026.rus.txt && docker exec dalel-app python3 scripts/load_legal_docs.py --sync-meta"
```
Expected: `Найдено статей/чанков: 96 … Загружено: 96 чанков`, затем `Обновлено документов: 1` (1995 → утратила силу). Проверка консультанта: задать в чате «Кто осуществляет законодательную власть?» — ответ про Курултай со ссылкой на Конституцию РК, без Парламента.

- [ ] **Step 4: Фронтенд на прод**

```bash
rsync -az --delete --exclude '__devlogin.html' -e ./dmz_ssh.sh static/app/ user@95.141.135.244:~/dalel/static/app/
dmz.sh "cd ~/dalel && docker compose -f docker-compose.demo.yml restart app && sleep 30 && curl -s -o /dev/null -w '%{http_code}\n' http://localhost:5003/constitution"
```
Expected: `200`; в браузере https://law.archeo.asia/constitution показывает «Прогона ещё не было».

- [ ] **Step 5: Проба прогона на одном акте**

```bash
dmz.sh "docker exec dalel-app python3 scripts/run_conformity.py --only z1600000480.09-01-2026.rus.pdf --limit 20 --threads 4"
```
Expected: 20 норм за ~1 мин; `curl -s https://law.archeo.asia/api/constitution/overview | python3 -m json.tool | head -60` показывает `run.status = running`, ход обхода с ЗРК «О правовых актах». Прочитать находки ст. 6 и 7 через `/api/constitution/acts/<id>` — ожидаются уровни 2–3 с формулировками ТЗ; ложных находок на нейтральных статьях быть не должно. Если промпт даёт шум — править `TRIAGE_SYSTEM`, тесты, повторить пробу с `--retry-errors` не нужно: `--no-resume` даст новый прогон.

- [ ] **Step 6: Полный прогон в фоне**

```bash
dmz.sh "docker exec -d dalel-app sh -c 'python3 scripts/run_conformity.py --threads 6 >> exports/conformity.log 2>&1'"
```
Каждые ~10 минут: `dmz.sh "tail -3 ~/dalel/exports/conformity.log"` и обзор в браузере (обновляется сам). Ожидание: ~7 000 норм, 45–75 минут, 3–6 $. Если контейнер перезапускался — тот же запуск продолжит прогон.

- [ ] **Step 7: Проверка в браузере (chrome-devtools)**

Открыть https://law.archeo.asia/constitution: показатели, ход обхода с временем по актам, пирамида с заполненными ярусами 3–5 и пустыми остальными, карта с подсвеченными ст. 5, 52–62, 72–75, реестр изменений с числами. Перейти на акт (ЗРК «О правовых актах»): штрих-код, находки ст. 6 и 7, раскрытие нормы. Перейти на статью 52: нормы, которые её касаются. Проверить /kk и /en: заголовки и формулировки на языке. Снимки экрана сохранить в scratchpad.

- [ ] **Step 8: Выборочная проверка качества**

Через API выбрать 20 находок уровней 2–3 из разных актов и 20 норм уровня 0 из конституционных законов; прочитать, посчитать ложные срабатывания и пропуски. Записать доли и примеры в память проекта (`project_constitution_conformity.md`). Если ложных срабатываний > 20 % — ужесточить `TRIAGE_SYSTEM` (примеры того, что не считается противоречием), обновить тесты, запустить новый прогон `--no-resume`.

- [ ] **Step 9: Память и итог**

Обновить `project_constitution_conformity.md`: дата прогона, модели, число норм и находок по уровням, стоимость, примеры настоящих находок и шума, что осталось (пустые ярусы, PDF с «Әділет»). Сообщить пользователю: адрес раздела, цифры прогона, список PDF для пустых ярусов (спека §9).
