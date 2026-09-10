#!/usr/bin/env python3
"""
Загрузка юридических документов из docs/ в базу данных.
Разбивка по Статьям с сохранением контекста Раздела/Главы.
"""
import sys
import os
import re
import subprocess

# Путь к проекту
PROJECT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, PROJECT_DIR)

DOCS_DIR = os.path.join(PROJECT_DIR, 'docs')

# Метаданные документов (имя файла → читаемое название)
DOC_META = {
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
    # ── Кодексы ──
    'k940001000_.12-03-2026.rus.pdf': {
        'title': 'Гражданский кодекс РК (Общая часть)',
        'type': 'code',
        'section_keyword': 'Глава',
    },
    'k990000409_.16-01-2026.rus.pdf': {
        'title': 'Гражданский кодекс РК (Особенная часть)',
        'type': 'code',
        'section_keyword': 'Глава',
    },
    'k030000442_.16-01-2026.rus.pdf': {
        'title': 'Земельный кодекс РК',
        'type': 'code',
        'section_keyword': 'Глава',
    },
    'k1100000518.09-01-2026.rus.pdf': {
        'title': 'Кодекс РК «О браке (супружестве) и семье»',
        'type': 'code',
        'section_keyword': 'Глава',
    },
    'k1400000226.08-03-2026.rus.pdf': {
        'title': 'Уголовный кодекс РК',
        'type': 'code',
        'section_keyword': 'Глава',
    },
    'k1400000231.08-03-2026.rus.pdf': {
        'title': 'Уголовно-процессуальный кодекс РК',
        'type': 'code',
        'section_keyword': 'Глава',
    },
    'k1400000235.12-03-2026.rus.pdf': {
        'title': 'Кодекс РК об административных правонарушениях',
        'type': 'code',
        'section_keyword': 'Глава',
    },
    'k1500000375.01-02-2026.rus.pdf': {
        'title': 'Предпринимательский кодекс РК',
        'type': 'code',
        'section_keyword': 'Глава',
    },
    'k1500000377.16-01-2026.rus.pdf': {
        'title': 'Гражданский процессуальный кодекс РК',
        'type': 'code',
        'section_keyword': 'Глава',
    },
    'k1500000414.20-01-2026.rus.pdf': {
        'title': 'Трудовой кодекс РК',
        'type': 'code',
        'section_keyword': 'Глава',
    },
    'k2000000350.16-01-2026.rus.pdf': {
        'title': 'Административный процедурно-процессуальный кодекс РК',
        'type': 'code',
        'section_keyword': 'Глава',
    },
    'k2100000400.09-01-2026.rus.pdf': {
        'title': 'Экологический кодекс РК',
        'type': 'code',
        'section_keyword': 'Глава',
    },
    'k2500000171.16-01-2026.rus.pdf': {
        'title': 'Бюджетный кодекс РК',
        'type': 'code',
        'section_keyword': 'Глава',
    },
    'k2500000214.18-07-2025.rus.pdf': {
        'title': 'Налоговый кодекс РК',
        'type': 'code',
        'section_keyword': 'Глава',
    },
    # ── Законы ──
    'z1600000480.09-01-2026.rus.pdf': {
        'title': 'Закон РК «О правовых актах»',
        'type': 'law',
        'section_keyword': 'Глава',
    },
    'z980000213_.06-04-2016.rus.pdf': {
        'title': 'Закон РК «О нормативных правовых актах»',
        'type': 'law',
        'section_keyword': 'Глава',
    },
    'z000000132_.01-07-2025.rus.pdf': {
        'title': 'Конституционный закон РК «О судебной системе и статусе судей»',
        'type': 'law',
        'section_keyword': 'Глава',
    },
    'z2200000153.01-01-2024.rus.pdf': {
        'title': 'Конституционный закон РК «О Конституционном Суде»',
        'type': 'law',
        'section_keyword': 'Глава',
    },
    'z2200000155.12-09-2023.rus.pdf': {
        'title': 'Конституционный закон РК «О прокуратуре»',
        'type': 'law',
        'section_keyword': 'Глава',
    },
}


def pdf_to_text(pdf_path: str) -> str:
    """Извлечение текста из PDF через pdftotext (без -layout для лучшего потока текста)."""
    result = subprocess.run(
        ['pdftotext', pdf_path, '-'],
        capture_output=True, text=True, encoding='utf-8', errors='ignore'
    )
    return result.stdout


def read_source(path: str) -> str:
    """Текст документа: PDF через pdftotext, .txt — как есть.

    Конституция 2026 приходит текстом с зеркала (см. scripts/fetch_constitution_2026.py),
    остальные акты — PDF с «Әділет».
    """
    if path.lower().endswith('.txt'):
        with open(path, encoding='utf-8') as f:
            return f.read()
    return pdf_to_text(path)


def clean_text(text: str) -> str:
    """Очистка текста от артефактов PDF."""
    # Убираем повторяющиеся пробелы и лишние переносы
    text = re.sub(r'[ \t]{2,}', ' ', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    # Убираем переносы слов через дефис в конце строки
    text = re.sub(r'-\n(\w)', r'\1', text)
    # Склеиваем строки внутри абзаца (НЕ перед заголовками статей)
    text = re.sub(r'(?<!\n)\n(?!(\n|Статья|Раздел|Глава|\d+\.))', ' ', text)
    return text.strip()


def split_by_articles(text: str, section_keyword: str = 'Глава') -> list:
    """
    Разбивка текста на чанки по Статьям.
    Каждый чанк содержит: [Раздел/Глава] + заголовок Статьи + текст Статьи.
    """
    chunks = []
    current_section = ''
    current_article_title = ''
    current_article_lines = []

    # Паттерны для определения разделов, глав и статей
    section_pattern = re.compile(
        rf'^({section_keyword}\s+[\dIVXivx]+[\.\:]?\s*.*)$', re.IGNORECASE
    )
    article_pattern = re.compile(
        r'^(Статья\s+\d+[\-\d]*[\.\:]?\s*.*)$', re.IGNORECASE
    )

    def flush_article():
        if not current_article_title and not current_article_lines:
            return
        body = '\n'.join(current_article_lines).strip()
        # Статья из одного абзаца без нумерованных пунктов после склейки строк
        # целиком оказывается в строке заголовка, а тело пустое. Раньше такая
        # статья отбрасывалась как короткая — так пропали ст. 88 ТК («двадцать
        # четыре календарных дня») и пятая часть статей КоАП, ГПК, ПК. Короткий
        # хвост без заголовка — мусор, статья с заголовком — нет.
        if not current_article_title and len(body) < 30:
            return
        context = ''
        if current_section:
            context = f'{current_section}\n'
        full_chunk = f'{context}{current_article_title}\n{body}'.strip()
        chunks.append({
            'title': current_article_title or current_section,
            'section': current_section,
            'content': full_chunk,
        })

    for line in text.split('\n'):
        line_stripped = line.strip()
        if not line_stripped:
            if current_article_lines:
                current_article_lines.append('')
            continue

        # Проверяем Раздел/Глава
        sec_match = section_pattern.match(line_stripped)
        if sec_match:
            flush_article()
            current_section = line_stripped
            current_article_title = ''
            current_article_lines = []
            continue

        # Проверяем Статья
        art_match = article_pattern.match(line_stripped)
        if art_match:
            flush_article()
            current_article_title = line_stripped
            current_article_lines = []
            continue

        # Тело статьи
        if current_article_title or current_section:
            current_article_lines.append(line_stripped)

    flush_article()
    return chunks


def load_document(doc_filename: str, meta: dict, replace: bool = False, embed: bool = False):
    """Загрузка одного документа в базу данных.

    replace — заменить уже загруженный документ (старые чанки удаляются вместе с ним);
    embed — сразу посчитать эмбеддинги чанков, чтобы документ был доступен поиску
    без отдельного прохода «Обновить embeddings» в админке.
    """
    from app import app
    from database.models import db, Document, DocumentChunk

    pdf_path = os.path.join(DOCS_DIR, doc_filename)
    print(f'\n📄 Обработка: {meta["title"]}')

    # Извлекаем текст
    raw_text = read_source(pdf_path)
    text = clean_text(raw_text)
    print(f'   Извлечено символов: {len(text):,}')

    # Разбиваем на статьи
    chunks = split_by_articles(text, meta['section_keyword'])
    print(f'   Найдено статей/чанков: {len(chunks)}')

    if not chunks:
        print('   ⚠️  Нет чанков, пропускаем')
        return 0

    embeddings = None
    if embed:
        from embeddings.client import EmbeddingClient
        embeddings = EmbeddingClient().encode([c['content'] for c in chunks])
        print(f'   Эмбеддингов: {len(embeddings)}')

    with app.app_context():
        # Проверяем, существует ли документ
        existing = Document.query.filter_by(filename=doc_filename).first()
        if existing and not replace:
            print(f'   ℹ️  Уже в базе (id={existing.id}), пропускаем')
            return 0
        if existing:
            old = existing.chunks.count()
            db.session.delete(existing)  # чанки уходят каскадом
            db.session.flush()
            print(f'   ♻️  Старая версия удалена (id={existing.id}, чанков {old})')

        # Полный текст документа
        full_text = '\n\n'.join(c['content'] for c in chunks)

        # Создаём запись документа
        doc = Document(
            filename=doc_filename,
            title=meta['title'],
            content=full_text,
            file_size=len(full_text)
        )
        db.session.add(doc)
        db.session.flush()  # получаем doc.id

        # Создаём чанки
        position = 0
        for i, chunk in enumerate(chunks):
            content = chunk['content']
            dc = DocumentChunk(
                document_id=doc.id,
                chunk_index=i,
                content=content,
                start_position=position,
                end_position=position + len(content),
                chunk_size=len(content)
            )
            if embeddings is not None:
                dc.set_embedding(embeddings[i])
            db.session.add(dc)
            position += len(content) + 2

        db.session.commit()
        print(f'   ✅ Загружено: {len(chunks)} чанков (doc_id={doc.id})')
        return len(chunks)


def main():
    import argparse

    ap = argparse.ArgumentParser(description='Загрузка кодексов и законов из docs/ в базу')
    ap.add_argument('--replace', action='store_true', help='заменить уже загруженные документы')
    ap.add_argument('--embed', action='store_true', help='сразу посчитать эмбеддинги чанков')
    ap.add_argument('--only', nargs='*', default=None, help='имена PDF, которые загрузить (по умолчанию все)')
    args = ap.parse_args()

    pdf_files = [f for f in os.listdir(DOCS_DIR) if f.endswith(('.pdf', '.txt'))]
    if args.only:
        pdf_files = [f for f in pdf_files if f in set(args.only)]

    if not pdf_files:
        print(f'❌ Нет PDF файлов в {DOCS_DIR}')
        sys.exit(1)

    print(f'📚 Найдено {len(pdf_files)} документов в {DOCS_DIR}')

    total_chunks = 0
    for filename in sorted(pdf_files):
        meta = DOC_META.get(filename)
        if not meta:
            print(f'⚠️  Нет метаданных для {filename}, пропускаем')
            continue
        total_chunks += load_document(filename, meta, replace=args.replace, embed=args.embed)

    print(f'\n✅ Итого загружено чанков: {total_chunks}')
    if not args.embed:
        print('🔄 Теперь запусти обработку embeddings в /admin → "Обновить embeddings"')


if __name__ == '__main__':
    main()
