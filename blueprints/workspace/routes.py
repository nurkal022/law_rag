"""
API рабочего места: дела и библиотека документов.

Ключевая граница: пользовательские файлы живут в своих таблицах и никогда не
попадают в корпус нормативных актов. Каждая выборка фильтруется по владельцу
на уровне запроса, а не проверкой поверх общего результата — проверку рано
или поздно забывают добавить в один из запросов, а условие в выборке забыть
нельзя, запрос просто ничего не вернёт.
"""

from __future__ import annotations

import io
import logging

from flask import current_app, jsonify, request, send_file

from blueprints.auth.routes import current_user, log_usage, login_required
from database.models import Matter, UserDocument, UserDocumentVersion, db
from docengine import jobs
from workspace import storage
from workspace.indexing import sweep_stuck

from . import workspace_bp

log = logging.getLogger('workspace')


def _err(message: str, code: int = 400, kind: str = 'bad_request'):
    return jsonify({'success': False, 'error': kind, 'message': message}), code


def _limit_mb() -> int:
    """Предел размера файла.

    Берётся из конфигурации приложения, а не из класса настроек: Flask
    заполняет её из того же класса, но позволяет переопределить — и на
    стенде, и в тестах. Чтение прямо из класса делало предел неизменяемым,
    и проверить отказ было нельзя.
    """
    from config import Config

    return int(current_app.config.get('WORKSPACE_MAX_FILE_MB', Config.WORKSPACE_MAX_FILE_MB))


def _own_matter(matter_id) -> Matter | None:
    user = current_user()
    if not user or matter_id is None:
        return None
    return db.session.query(Matter).filter_by(id=matter_id, user_id=user.id).first()


def _own_document(doc_id) -> UserDocument | None:
    user = current_user()
    if not user:
        return None
    return db.session.query(UserDocument).filter_by(id=doc_id, user_id=user.id).first()


# ────────────────────────────────── дела ──────────────────────────────────


@workspace_bp.route('/matters', methods=['GET'])
@login_required
def list_matters():
    user = current_user()
    q = db.session.query(Matter).filter_by(user_id=user.id)
    if request.args.get('archived') != '1':
        q = q.filter_by(is_archived=False)
    items = q.order_by(Matter.updated_at.desc()).limit(300).all()
    return jsonify({'success': True, 'matters': [m.to_dict() for m in items]})


@workspace_bp.route('/matters', methods=['POST'])
@login_required
def create_matter():
    data = request.get_json(silent=True) or {}
    title = (data.get('title') or '').strip()
    if not title:
        return _err('У дела должно быть название')

    matter = Matter(
        user_id=current_user().id,
        title=title[:255],
        description=(data.get('description') or '').strip() or None,
    )
    db.session.add(matter)
    db.session.commit()
    log_usage('workspace', 'matter_create')
    return jsonify({'success': True, 'matter': matter.to_dict()}), 201


@workspace_bp.route('/matters/<int:matter_id>', methods=['PATCH'])
@login_required
def update_matter(matter_id: int):
    matter = _own_matter(matter_id)
    if not matter:
        return _err('Дело не найдено', 404, 'not_found')
    data = request.get_json(silent=True) or {}
    if 'title' in data and (data['title'] or '').strip():
        matter.title = data['title'].strip()[:255]
    if 'description' in data:
        matter.description = (data['description'] or '').strip() or None
    if 'is_archived' in data:
        matter.is_archived = bool(data['is_archived'])
    db.session.commit()
    return jsonify({'success': True, 'matter': matter.to_dict()})


@workspace_bp.route('/matters/<int:matter_id>', methods=['DELETE'])
@login_required
def delete_matter(matter_id: int):
    """Удаление дела не удаляет документы: они лишь выходят из папки.

    Папка — способ группировки, а не владелец содержимого. Удалить дело и
    потерять вместе с ним договоры — потеря, которой человек не ожидает.
    """
    matter = _own_matter(matter_id)
    if not matter:
        return _err('Дело не найдено', 404, 'not_found')
    freed = matter.documents.update({'matter_id': None})
    db.session.delete(matter)
    db.session.commit()
    return jsonify({'success': True, 'documents_freed': freed})


# ───────────────────────────── библиотека ─────────────────────────────


@workspace_bp.route('/documents', methods=['GET'])
@login_required
def list_documents():
    user = current_user()
    # Документ, застрявший в обработке, — состояние, из которого пользователь
    # сам выйти не может. Разбираем его при открытии библиотеки, а не по
    # расписанию: отдельный планировщик ради одной проверки не нужен.
    try:
        sweep_stuck(current_app)
    except Exception as e:
        log.warning('разбор зависших документов не удался: %s', e)

    q = db.session.query(UserDocument).filter_by(user_id=user.id)
    matter_id = request.args.get('matter_id')
    if matter_id == 'none':
        q = q.filter(UserDocument.matter_id.is_(None))
    elif matter_id and matter_id.isdigit():
        q = q.filter_by(matter_id=int(matter_id))
    status = request.args.get('status')
    if status:
        q = q.filter_by(status=status)
    source = request.args.get('source')
    if source:
        q = q.filter_by(source=source)

    items = q.order_by(UserDocument.created_at.desc()).limit(300).all()
    return jsonify({'success': True, 'documents': [d.to_dict() for d in items]})


@workspace_bp.route('/documents', methods=['POST'])
@login_required
def upload_document():
    """Приём файла. Отвечает сразу, индексация идёт фоном.

    Ответ не ждёт разбора текста и векторов: на шестидесяти страницах это
    минуты, а человеку нужно увидеть документ в списке немедленно.
    """
    if 'file' not in request.files:
        return _err('Файл не передан')

    user = current_user()
    try:
        saved = storage.save_upload(request.files['file'], user.id, max_mb=_limit_mb())
    except storage.UnsupportedFormat as e:
        return _err(str(e), 415, 'unsupported_format')
    except storage.DocumentTooLarge as e:
        return _err(str(e), 413, 'too_large')
    except Exception as e:
        log.exception('приём файла')
        return _err(f'Не удалось сохранить файл: {e}', 500, 'upload_failed')

    # Тот же файл, загруженный повторно, — тот же документ. Иначе библиотека
    # быстро зарастает копиями одного договора под разными именами.
    twin = db.session.query(UserDocument).filter_by(
        user_id=user.id, sha256=saved['sha256']).first()
    if twin:
        storage.delete(saved['storage_path'])
        return jsonify({'success': True, 'document': twin.to_dict(), 'duplicate': True})

    matter_id = request.form.get('matter_id')
    matter = _own_matter(int(matter_id)) if (matter_id or '').isdigit() else None

    doc = UserDocument(
        user_id=user.id,
        matter_id=matter.id if matter else None,
        title=(request.form.get('title') or '').strip()[:255]
              or storage.clean_filename_title(saved['original_filename']),
        original_filename=saved['original_filename'],
        storage_path=saved['storage_path'],
        file_size=saved['file_size'],
        sha256=saved['sha256'],
        mime=saved['mime'],
        source='upload',
        status='pending',
    )
    db.session.add(doc)
    db.session.flush()

    # Версия 1 заводится вместе с документом, чтобы исходный файл оставался
    # доступен и после того, как в документ загрузят новую версию.
    db.session.add(UserDocumentVersion(
        user_document_id=doc.id, version_no=1,
        storage_path=doc.storage_path, file_size=doc.file_size,
        sha256=doc.sha256, note='исходный файл',
    ))
    db.session.commit()

    jobs.enqueue('workspace.index', {'document_id': doc.id},
                 owner_id=user.id, total=3)
    log_usage('workspace', 'upload', details={'size': doc.file_size, 'mime': doc.mime})
    return jsonify({'success': True, 'document': doc.to_dict()}), 201


@workspace_bp.route('/documents/<int:doc_id>', methods=['GET'])
@login_required
def get_document(doc_id: int):
    doc = _own_document(doc_id)
    if not doc:
        return _err('Документ не найден', 404, 'not_found')
    out = doc.to_dict(with_chunks=True)
    out['versions'] = [v.to_dict() for v in doc.versions.order_by(
        UserDocumentVersion.version_no.desc()).all()]
    return jsonify({'success': True, 'document': out})


@workspace_bp.route('/documents/<int:doc_id>', methods=['PATCH'])
@login_required
def update_document(doc_id: int):
    doc = _own_document(doc_id)
    if not doc:
        return _err('Документ не найден', 404, 'not_found')
    data = request.get_json(silent=True) or {}
    if 'title' in data and (data['title'] or '').strip():
        doc.title = data['title'].strip()[:255]
    if 'matter_id' in data:
        target = data['matter_id']
        if target is None:
            doc.matter_id = None
        else:
            matter = _own_matter(target)
            if not matter:
                return _err('Дело не найдено', 404, 'not_found')
            doc.matter_id = matter.id
    db.session.commit()
    return jsonify({'success': True, 'document': doc.to_dict()})


@workspace_bp.route('/documents/<int:doc_id>', methods=['DELETE'])
@login_required
def delete_document(doc_id: int):
    doc = _own_document(doc_id)
    if not doc:
        return _err('Документ не найден', 404, 'not_found')

    paths = [v.storage_path for v in doc.versions.all() if v.storage_path]
    if doc.storage_path:
        paths.append(doc.storage_path)
    db.session.delete(doc)
    db.session.commit()
    # Файлы удаляются после базы: осиротевшая запись без файла ломает
    # библиотеку, осиротевший файл — просто занимает место.
    for path in set(paths):
        storage.delete(path)
    return jsonify({'success': True})


@workspace_bp.route('/documents/<int:doc_id>/file', methods=['GET'])
@login_required
def download_document(doc_id: int):
    doc = _own_document(doc_id)
    if not doc or not doc.storage_path:
        return _err('Документ не найден', 404, 'not_found')
    try:
        path = storage.absolute(doc.storage_path)
    except ValueError:
        return _err('Файл недоступен', 404, 'not_found')
    if not path.exists():
        return _err('Файл потерян на сервере', 410, 'file_missing')
    return send_file(str(path), as_attachment=True,
                     download_name=doc.original_filename or f'document-{doc.id}',
                     mimetype=doc.mime or 'application/octet-stream')


@workspace_bp.route('/documents/<int:doc_id>/text', methods=['GET'])
@login_required
def document_text(doc_id: int):
    """Текст документа для чтения на экране."""
    doc = _own_document(doc_id)
    if not doc:
        return _err('Документ не найден', 404, 'not_found')
    try:
        text, _pages = storage.extract_text(doc.storage_path)
    except Exception as e:
        return _err(f'Не удалось прочитать файл: {e}', 500, 'extract_failed')
    return jsonify({'success': True, 'text': text, 'length': len(text)})


@workspace_bp.route('/documents/<int:doc_id>/reindex', methods=['POST'])
@login_required
def reindex_document(doc_id: int):
    doc = _own_document(doc_id)
    if not doc:
        return _err('Документ не найден', 404, 'not_found')
    doc.status = 'pending'
    doc.status_error = None
    db.session.commit()
    job = jobs.enqueue('workspace.index', {'document_id': doc.id},
                       owner_id=doc.user_id, total=3)
    return jsonify({'success': True, 'job': job.to_dict(), 'document': doc.to_dict()}), 202


@workspace_bp.route('/documents/<int:doc_id>/versions', methods=['POST'])
@login_required
def add_version(doc_id: int):
    """Загрузить новую версию документа.

    Прежний файл остаётся версией, новый становится текущим. Переиндексация
    обязательна: иначе в поиске остались бы фрагменты прежнего текста, и
    документ отвечал бы редакцией, которой уже нет.
    """
    doc = _own_document(doc_id)
    if not doc:
        return _err('Документ не найден', 404, 'not_found')
    if 'file' not in request.files:
        return _err('Файл не передан')

    try:
        saved = storage.save_upload(request.files['file'], doc.user_id, max_mb=_limit_mb())
    except storage.UnsupportedFormat as e:
        return _err(str(e), 415, 'unsupported_format')
    except storage.DocumentTooLarge as e:
        return _err(str(e), 413, 'too_large')

    if saved['sha256'] == doc.sha256:
        storage.delete(saved['storage_path'])
        return _err('Этот файл уже является текущей версией', 409, 'same_file')

    next_no = (db.session.query(db.func.max(UserDocumentVersion.version_no))
               .filter_by(user_document_id=doc.id).scalar() or 0) + 1

    doc.storage_path = saved['storage_path']
    doc.file_size = saved['file_size']
    doc.sha256 = saved['sha256']
    doc.mime = saved['mime']
    doc.status = 'pending'
    doc.status_error = None

    db.session.add(UserDocumentVersion(
        user_document_id=doc.id, version_no=next_no,
        storage_path=saved['storage_path'], file_size=saved['file_size'],
        sha256=saved['sha256'],
        note=(request.form.get('note') or '').strip() or None,
    ))
    db.session.commit()

    jobs.enqueue('workspace.index', {'document_id': doc.id},
                 owner_id=doc.user_id, total=3)
    return jsonify({'success': True, 'document': doc.to_dict(), 'version': next_no}), 201


@workspace_bp.route('/search', methods=['GET'])
@login_required
def search_library():
    """Поиск по своей библиотеке.

    Без обращения к векторам: поиск по подстроке в тексте фрагментов. Этого
    достаточно, чтобы найти документ по знакомому слову, а смысловой поиск
    приходит вместе с диалогом по документу.
    """
    from database.models import UserDocumentChunk

    user = current_user()
    query = (request.args.get('q') or '').strip()
    if len(query) < 2:
        return _err('Слишком короткий запрос')

    rows = (db.session.query(UserDocumentChunk, UserDocument)
            .join(UserDocument, UserDocumentChunk.user_document_id == UserDocument.id)
            .filter(UserDocument.user_id == user.id)
            .filter(UserDocumentChunk.content.ilike(f'%{query}%'))
            .limit(40).all())

    found: dict[int, dict] = {}
    for chunk, doc in rows:
        entry = found.setdefault(doc.id, {**doc.to_dict(), 'excerpts': []})
        if len(entry['excerpts']) < 3:
            pos = chunk.content.lower().find(query.lower())
            start = max(0, pos - 90)
            entry['excerpts'].append({
                'chunk': chunk.chunk_index,
                'text': chunk.content[start:start + 260].strip(),
            })
    return jsonify({'success': True, 'query': query, 'documents': list(found.values())})
