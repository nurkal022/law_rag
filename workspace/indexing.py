"""
Индексация документов библиотеки.

Работа идёт фоновой задачей той же очереди, что и генерация: документ на
шестьдесят страниц режется на десятки фрагментов, каждый из которых надо
отправить на вычисление вектора. Внутри HTTP-запроса такое не живёт.

Спецификация рабочего места предлагала поток-демон, чтобы не заводить Celery
и Redis. Очередь на PostgreSQL к этому моменту уже построена и обходится без
них, а вдобавок переживает перезапуск процесса — поток-демон не переживал.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta

from docengine.jobs import handler

log = logging.getLogger('workspace.indexing')


@handler('workspace.index')
def index_document(app, payload: dict, progress) -> dict:
    """Извлечь текст, нарезать на фрагменты, посчитать векторы.

    Фрагменты пишутся одной транзакцией в конце: наполовину
    проиндексированного документа не бывает, поэтому гибель воркера посреди
    работы не оставляет мусора, который потом попадёт в поиск.

    Недоступность сервиса эмбеддингов — это отказ с внятной причиной, а не
    сбой: документ уже сохранён и читается, он лишь не участвует в поиске.
    """
    from database.models import UserDocument, UserDocumentChunk, db

    from .storage import ExtractionFailed, extract_text

    with app.app_context():
        doc = db.session.get(UserDocument, payload['document_id'])
        if doc is None:
            raise LookupError(f'документ {payload["document_id"]} исчез из базы')

        progress(0, 3, 'чтение файла')
        try:
            text, pages = extract_text(doc.storage_path)
        except ExtractionFailed as e:
            _fail(db, doc, str(e))
            return {'document_id': doc.id, 'status': 'failed'}

        text = (text or '').strip()
        if not text:
            # Сканированный PDF без текстового слоя — обычное дело, а не сбой.
            # Пользователю нужно сказать, что делать, а не «ошибка обработки».
            _fail(db, doc, 'В файле нет текстового слоя. Вероятно, это скан: '
                           'потребуется распознавание текста.')
            return {'document_id': doc.id, 'status': 'failed'}

        doc.text_length = len(text)
        doc.pages = pages or None
        db.session.commit()

        progress(1, 3, 'разбор на фрагменты')
        processor = app.config.get('DOC_PROCESSOR')
        if processor is None:
            _fail(db, doc, 'Служба индексации недоступна. Документ сохранён, '
                           'но пока не участвует в поиске.')
            return {'document_id': doc.id, 'status': 'failed'}

        chunks = processor.split_into_chunks(text)
        if not chunks:
            _fail(db, doc, 'Не удалось разбить документ на фрагменты')
            return {'document_id': doc.id, 'status': 'failed'}

        progress(2, 3, f'векторы: {len(chunks)} фрагментов')
        vectors = processor.create_embeddings([c['content'] for c in chunks])
        if vectors is None or len(vectors) != len(chunks):
            _fail(db, doc, 'Сервис эмбеддингов недоступен. Документ сохранён '
                           'и читается, но пока не участвует в поиске.')
            return {'document_id': doc.id, 'status': 'failed'}

        # Прежние фрагменты удаляются вместе с переиндексацией: иначе после
        # загрузки новой версии в поиске остаются куски прежнего текста.
        doc.chunks.delete()

        for i, chunk in enumerate(chunks):
            db.session.add(UserDocumentChunk(
                user_document_id=doc.id,
                chunk_index=i,
                content=chunk['content'],
                start_position=chunk.get('start_position'),
                end_position=chunk.get('end_position'),
                chunk_size=len(chunk['content']),
                embedding=vectors[i],
            ))

        doc.status = 'indexed'
        doc.status_error = None
        doc.indexed_at = datetime.utcnow()
        db.session.commit()

        progress(3, 3, 'готово')
        log.info('документ %s проиндексирован: %s фрагментов', doc.id, len(chunks))
        return {'document_id': doc.id, 'status': 'indexed', 'chunks': len(chunks)}


def _fail(db, doc, reason: str) -> None:
    db.session.rollback()
    doc.status = 'failed'
    doc.status_error = reason
    db.session.commit()
    log.warning('документ %s не проиндексирован: %s', doc.id, reason)


def sweep_stuck(app) -> int:
    """Переводит зависшие документы в отказ.

    Воркер может погибнуть посреди индексации, и документ навсегда останется
    «в обработке» — состояние, из которого пользователь сам выйти не может.
    Вызывается при открытии библиотеки, а не по расписанию: отдельный
    планировщик ради одной проверки не нужен.
    """
    from config import Config
    from database.models import UserDocument, db

    minutes = int(app.config.get('WORKSPACE_PENDING_TIMEOUT_MIN',
                                 Config.WORKSPACE_PENDING_TIMEOUT_MIN))
    limit = datetime.utcnow() - timedelta(minutes=minutes)
    stuck = db.session.query(UserDocument).filter(
        UserDocument.status == 'pending', UserDocument.created_at < limit
    ).all()
    for doc in stuck:
        doc.status = 'failed'
        doc.status_error = ('Обработка не завершилась вовремя. '
                            'Документ сохранён — попробуйте переиндексировать.')
    if stuck:
        db.session.commit()
        log.warning('зависших документов переведено в отказ: %s', len(stuck))
    return len(stuck)
