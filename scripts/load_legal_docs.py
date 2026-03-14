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
    'k950001000_.01-01-2023.rus.pdf': {
        'title': 'Конституция Республики Казахстан (2023)',
        'type': 'constitution',
        'section_keyword': 'Раздел',
    },
    'z1600000480.09-01-2026.rus.pdf': {
        'title': 'Закон РК «О правовых актах» (2016, ред. 2026)',
        'type': 'law',
        'section_keyword': 'Глава',
    },
    'z980000213_.06-04-2016.rus.pdf': {
        'title': 'Закон РК «О нормативных правовых актах» (1998, ред. 2016)',
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
        if len(body) < 30:
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


def load_document(doc_filename: str, meta: dict):
    """Загрузка одного документа в базу данных."""
    from app import app
    from database.models import db, Document, DocumentChunk

    pdf_path = os.path.join(DOCS_DIR, doc_filename)
    print(f'\n📄 Обработка: {meta["title"]}')

    # Извлекаем текст
    raw_text = pdf_to_text(pdf_path)
    text = clean_text(raw_text)
    print(f'   Извлечено символов: {len(text):,}')

    # Разбиваем на статьи
    chunks = split_by_articles(text, meta['section_keyword'])
    print(f'   Найдено статей/чанков: {len(chunks)}')

    if not chunks:
        print('   ⚠️  Нет чанков, пропускаем')
        return 0

    with app.app_context():
        # Проверяем, существует ли документ
        existing = Document.query.filter_by(filename=doc_filename).first()
        if existing:
            print(f'   ℹ️  Уже в базе (id={existing.id}), пропускаем')
            return 0

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
            db.session.add(dc)
            position += len(content) + 2

        db.session.commit()
        print(f'   ✅ Загружено: {len(chunks)} чанков (doc_id={doc.id})')
        return len(chunks)


def main():
    pdf_files = [f for f in os.listdir(DOCS_DIR) if f.endswith('.pdf')]

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
        total_chunks += load_document(filename, meta)

    print(f'\n✅ Итого загружено чанков: {total_chunks}')
    print('🔄 Теперь запусти обработку embeddings в /admin → "Обновить embeddings"')


if __name__ == '__main__':
    main()
