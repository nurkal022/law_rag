"""
API документного движка: договоры и законопроекты.

Один набор маршрутов на оба вида документов. Разница между договором и
законопроектом целиком лежит в паспорте типа — данных, а не в коде, — поэтому
дублировать здесь нечего.

Порядок работы с документом:
    POST /api/drafts                 создать по данным формы; каркас мгновенно
    POST /api/drafts/<id>/generate   поставить генерацию в очередь
    GET  /api/jobs/<id>/events       поток прогресса
    POST /api/drafts/<id>/turns      правка промптом
    GET  /api/drafts/<id>/export     скачать DOCX / PDF / XLSX
"""

from __future__ import annotations

import io
import json
import logging
import secrets
import time
from datetime import datetime, timedelta

from flask import Response, current_app, jsonify, request, send_file

from blueprints.auth.routes import current_user, log_usage, login_required
from database.models import Draft, DraftTurn, DraftVersion, Job, db
from docengine import jobs
from docengine.check import check
from docengine.ops import Op, apply_ops, diff
from docengine.passport import CatalogError, get_passport, list_passports, load_catalog
from docengine.schema import DocTree
from docengine.skeleton import build_skeleton

from . import drafts_bp

log = logging.getLogger('drafts')

LANGS = ('ru', 'kk', 'en')
MAX_INSTRUCTION = 2000


def _lang() -> str:
    lang = (request.args.get('lang') or (request.get_json(silent=True) or {}).get('lang') or 'ru')
    # Казахский исторически кодировался в проекте и как kz, и как kk.
    # Внутри движка единственный код — kk, приводим на границе.
    lang = 'kk' if lang == 'kz' else lang
    return lang if lang in LANGS else 'ru'


def _err(message: str, code: int = 400, kind: str = 'bad_request'):
    return jsonify({'success': False, 'error': kind, 'message': message}), code


def _rate_limited(kind: str, limit: int) -> tuple[bool, int]:
    """Простой почасовой лимит по журналу задач.

    Считаем по той же таблице, в которую и так пишем: отдельное хранилище
    ради счётчика — лишняя система, которая может разойтись с реальностью.
    Точность «примерно за час» здесь достаточна, а вот незаметно
    разошедшийся счётчик был бы хуже отсутствия лимита.
    """
    user = current_user()
    if not user:
        return True, 0
    since = datetime.utcnow() - timedelta(hours=1)
    used = db.session.query(Job).filter(
        Job.owner_id == user.id, Job.kind == kind, Job.created_at >= since
    ).count()
    return used >= limit, max(0, limit - used)


def _own_draft(public_id: str) -> Draft | None:
    """Черновик текущего пользователя.

    Проверка владения — единственный барьер к чужим документам: в договорах
    лежат ИИН, адреса и суммы. Поэтому не «найти и потом проверить», а
    выбрать сразу по владельцу.
    """
    user = current_user()
    if not user:
        return None
    return db.session.query(Draft).filter_by(public_id=public_id, owner_id=user.id).first()


def _tree_of(draft: Draft) -> DocTree:
    version = draft.head()
    if version is None:
        raise LookupError('у документа нет ни одной версии')
    return DocTree(**version.tree_json)


def _save_version(draft: Draft, tree: DocTree, summary: str, by: str) -> DraftVersion:
    draft.current_version += 1
    version = DraftVersion(
        draft_id=draft.id,
        no=draft.current_version,
        tree_json=tree.model_dump(mode='json'),
        summary=summary,
        created_by=by,
    )
    db.session.add(version)
    draft.updated_at = datetime.utcnow()
    return version


# ───────────────────────────────── каталог ─────────────────────────────────


@drafts_bp.route('/catalog')
def catalog():
    """Список типов документов. Открыт гостям: это витрина продукта."""
    kind = request.args.get('kind', 'contract')
    try:
        items = list_passports(kind=kind, lang=_lang())
    except CatalogError as e:
        log.error('каталог не читается: %s', e)
        return _err('Каталог типов документов повреждён', 500, 'catalog_error')

    families: dict[str, list] = {}
    for item in items:
        families.setdefault(item['family'], []).append(item)
    return jsonify({'success': True, 'types': items, 'families': families})


@drafts_bp.route('/passport/<type_id>')
def passport(type_id: str):
    """Паспорт типа: поля формы, разделы, существенные условия, риски."""
    lang = _lang()
    try:
        p = get_passport(type_id)
    except KeyError:
        return _err(f'Неизвестный тип документа: {type_id}', 404, 'not_found')

    def tr(t):
        return t.get(lang) if t else None

    return jsonify({
        'success': True,
        'passport': {
            **p.brief(lang),
            'parties': [{'role': tr(s.role), 'kinds': s.kinds} for s in p.parties],
            'fields': [{
                'name': f.name, 'label': tr(f.label), 'type': f.type, 'group': f.group,
                'required': f.required, 'hint': tr(f.hint), 'unit': f.unit,
                'party': f.party, 'placeholder': f.placeholder,
                'options': [{'value': o.value, 'label': tr(o.label)} for o in f.options],
            } for f in p.fields],
            'sections': [{
                'key': s.key, 'title': tr(s.title), 'required': s.required,
                'refs': [r.label() for r in s.refs],
            } for s in p.sections],
            'essential_terms': [{
                'key': t.key, 'label': tr(t.label), 'fields': t.fields,
                'section': t.section, 'basis': t.basis.label() if t.basis else None,
            } for t in p.essential_terms],
            'risks': [{'party': r.party, 'text': tr(r.text),
                       'mitigation': tr(r.mitigation)} for r in p.risks],
            'annexes': [{'key': a.key, 'title': tr(a.title), 'kind': a.kind,
                         'default': a.default} for a in p.annexes],
        },
    })


# ───────────────────────────── черновики ──────────────────────────────


@drafts_bp.route('', methods=['GET'])
@login_required
def list_drafts():
    user = current_user()
    q = db.session.query(Draft).filter_by(owner_id=user.id)
    kind = request.args.get('kind')
    if kind:
        q = q.filter_by(kind=kind)
    status = request.args.get('status')
    if status:
        q = q.filter_by(status=status)
    items = q.order_by(Draft.updated_at.desc()).limit(200).all()
    return jsonify({'success': True, 'drafts': [d.to_dict() for d in items]})


@drafts_bp.route('', methods=['POST'])
@login_required
def create_draft():
    """Создать документ по данным формы.

    Каркас собирается без обращения к модели, поэтому ответ приходит сразу:
    человек видит лист с реквизитами и оглавлением, пока содержательные
    разделы ещё не написаны.
    """
    data = request.get_json(silent=True) or {}
    type_id = data.get('type_id')
    if not type_id:
        return _err('Не указан тип документа')

    try:
        p = get_passport(type_id)
    except KeyError:
        return _err(f'Неизвестный тип документа: {type_id}', 404, 'not_found')

    lang = _lang()
    values = data.get('values') or {}
    if not isinstance(values, dict):
        return _err('Поле values должно быть объектом')

    tree = build_skeleton(p, values, lang)
    tree.issues = check(tree, p, values)

    user = current_user()
    draft = Draft(
        public_id=secrets.token_hex(8),
        kind=p.kind,
        type_id=type_id,
        owner_id=user.id,
        matter_id=data.get('matter_id'),
        title=data.get('title') or tree.meta.title,
        lang=lang,
        status='draft',
        values_json=values,
        current_version=0,
    )
    db.session.add(draft)
    db.session.flush()

    db.session.add(DraftVersion(
        draft_id=draft.id, no=0,
        tree_json=tree.model_dump(mode='json'),
        summary='каркас документа', created_by='system',
    ))
    db.session.commit()

    log_usage('drafts', 'create', details={'kind': p.kind, 'type': type_id, 'lang': lang})
    return jsonify({'success': True, 'draft': draft.to_dict(with_tree=True)}), 201


@drafts_bp.route('/<public_id>')
@login_required
def get_draft(public_id: str):
    draft = _own_draft(public_id)
    if not draft:
        return _err('Документ не найден', 404, 'not_found')
    return jsonify({'success': True, 'draft': draft.to_dict(with_tree=True)})


@drafts_bp.route('/<public_id>', methods=['PATCH'])
@login_required
def update_draft(public_id: str):
    """Правка полей самого черновика: название, статус, дело."""
    draft = _own_draft(public_id)
    if not draft:
        return _err('Документ не найден', 404, 'not_found')
    data = request.get_json(silent=True) or {}
    if 'title' in data:
        draft.title = (data['title'] or '').strip()[:500] or draft.title
    if 'status' in data and data['status'] in ('draft', 'review', 'agreed', 'signed', 'archived'):
        draft.status = data['status']
    if 'matter_id' in data:
        draft.matter_id = data['matter_id']
    db.session.commit()
    return jsonify({'success': True, 'draft': draft.to_dict()})


@drafts_bp.route('/<public_id>', methods=['DELETE'])
@login_required
def delete_draft(public_id: str):
    draft = _own_draft(public_id)
    if not draft:
        return _err('Документ не найден', 404, 'not_found')
    db.session.delete(draft)
    db.session.commit()
    return jsonify({'success': True})


# ───────────────────────────── генерация ──────────────────────────────


@drafts_bp.route('/<public_id>/generate', methods=['POST'])
@login_required
def generate(public_id: str):
    """Поставить генерацию в очередь. Возвращает задачу, а не документ."""
    draft = _own_draft(public_id)
    if not draft:
        return _err('Документ не найден', 404, 'not_found')

    running = db.session.query(Job).filter(
        Job.draft_id == draft.id, Job.status.in_(('queued', 'running'))
    ).first()
    if running:
        return jsonify({'success': True, 'job': running.to_dict(), 'already': True})

    limit = current_app.config.get('DRAFT_GENERATIONS_PER_HOUR', 20)
    over, left = _rate_limited('draft.generate', limit)
    if over:
        return _err(f'Достигнут предел в {limit} генераций в час. '
                    f'Попробуйте позже или продолжите править готовый документ.',
                    429, 'rate_limited')

    data = request.get_json(silent=True) or {}
    try:
        p = get_passport(draft.type_id)
    except KeyError:
        return _err('Тип документа больше не поддерживается', 410, 'gone')

    only = data.get('sections')  # перегенерация отдельных разделов
    total = len(only) if only else len(p.sections)

    job = jobs.enqueue(
        'draft.generate',
        {'draft_id': draft.id, 'sections': only, 'hint': (data.get('hint') or '')[:MAX_INSTRUCTION]},
        owner_id=draft.owner_id, draft_id=draft.id, total=total,
    )
    log_usage('drafts', 'generate', details={'type': draft.type_id, 'sections': total})
    return jsonify({'success': True, 'job': job.to_dict(), 'remaining': left - 1}), 202


@drafts_bp.route('/jobs/<job_id>')
@login_required
def job_status(job_id: str):
    job = jobs.get_job(job_id)
    user = current_user()
    if not job or (job.owner_id and job.owner_id != user.id):
        return _err('Задача не найдена', 404, 'not_found')
    return jsonify({'success': True, 'job': job.to_dict()})


@drafts_bp.route('/jobs/<job_id>/events')
@login_required
def job_events(job_id: str):
    """Поток прогресса генерации.

    Опрос базы, а не подписка: единственный внешний источник событий здесь —
    воркер, который пишет прогресс в ту же таблицу. Раз в секунду — достаточно
    для раздела, который пишется десятки секунд, и не нагружает базу.
    """
    job = jobs.get_job(job_id)
    user = current_user()
    if not job or (job.owner_id and job.owner_id != user.id):
        return _err('Задача не найдена', 404, 'not_found')

    app = current_app._get_current_object()
    user_id = user.id
    deadline = time.time() + 900  # генерация дольше пятнадцати минут — уже сбой

    def stream():
        last = None
        with app.app_context():
            while time.time() < deadline:
                j = jobs.get_job(job_id)
                if j is None or (j.owner_id and j.owner_id != user_id):
                    break
                payload = json.dumps(j.to_dict(), ensure_ascii=False)
                if payload != last:
                    yield f'data: {payload}\n\n'
                    last = payload
                if j.status in ('done', 'failed', 'cancelled'):
                    break
                db.session.remove()  # иначе сессия отдаёт закешированную строку
                time.sleep(1.0)
            else:
                yield 'event: timeout\ndata: {}\n\n'

    return Response(stream(), mimetype='text/event-stream', headers={
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',  # nginx иначе копит поток в буфере
        'Connection': 'keep-alive',
    })


# ─────────────────────────── правка промптом ───────────────────────────


@drafts_bp.route('/<public_id>/turns', methods=['GET'])
@login_required
def list_turns(public_id: str):
    draft = _own_draft(public_id)
    if not draft:
        return _err('Документ не найден', 404, 'not_found')
    items = draft.turns.order_by(DraftTurn.created_at).all()
    return jsonify({'success': True, 'turns': [t.to_dict() for t in items]})


@drafts_bp.route('/<public_id>/turns', methods=['POST'])
@login_required
def add_turn(public_id: str):
    """Изменить документ текстовым указанием.

    Модель возвращает не новый документ, а список операций над деревом. Что не
    применилось — возвращается пользователю списком отказов: молча
    проигнорированная правка хуже видимой ошибки, потому что человек уверен,
    что договор изменён.
    """
    draft = _own_draft(public_id)
    if not draft:
        return _err('Документ не найден', 404, 'not_found')

    instruction = ((request.get_json(silent=True) or {}).get('text') or '').strip()
    if not instruction:
        return _err('Пустое указание')
    if len(instruction) > MAX_INSTRUCTION:
        return _err(f'Указание длиннее {MAX_INSTRUCTION} символов')

    provider = current_app.config.get('LLM_PROVIDER')
    if provider is None:
        return _err('Модель недоступна, попробуйте позже', 503, 'llm_unavailable')

    from docengine.generate import GenerationError, apply_instruction

    tree = _tree_of(draft)
    version_from = draft.current_version

    db.session.add(DraftTurn(draft_id=draft.id, role='user', text=instruction,
                             version_from=version_from))
    db.session.commit()

    try:
        ops, reply = apply_instruction(provider, tree, instruction, draft.lang)
    except GenerationError as e:
        log.error('правка не разобрана, документ %s: %s', public_id, e)
        return _err('Не удалось разобрать ответ модели. Переформулируйте указание.',
                    502, 'llm_error')

    report = apply_ops(tree, ops)
    if report.applied == 0:
        db.session.add(DraftTurn(
            draft_id=draft.id, role='assistant', text=reply or 'Изменений не внесено.',
            ops_json=[o.model_dump(mode='json') for o in ops],
            rejected_json=[{'op': r.op.op, 'detail': r.detail} for r in report.rejected],
            version_from=version_from, version_to=version_from,
        ))
        db.session.commit()
        return jsonify({
            'success': True, 'applied': 0, 'reply': reply,
            'rejected': [{'op': r.op.op, 'detail': r.detail} for r in report.rejected],
            'draft': draft.to_dict(with_tree=True),
        })

    try:
        p = get_passport(draft.type_id)
        report.tree.issues = check(report.tree, p, draft.values_json or {})
    except KeyError:
        pass

    _save_version(draft, report.tree, report.summary(), by='llm')
    db.session.add(DraftTurn(
        draft_id=draft.id, role='assistant', text=reply or report.summary(),
        ops_json=[o.model_dump(mode='json') for o in ops],
        rejected_json=[{'op': r.op.op, 'detail': r.detail} for r in report.rejected],
        version_from=version_from, version_to=draft.current_version,
    ))
    db.session.commit()

    log_usage('drafts', 'edit', details={'type': draft.type_id, 'applied': report.applied})
    return jsonify({
        'success': True,
        'applied': report.applied,
        'reply': reply or report.summary(),
        'summary': report.summary(),
        'rejected': [{'op': r.op.op, 'detail': r.detail} for r in report.rejected],
        'changes': [c.model_dump(mode='json') for c in diff(tree, report.tree)],
        'draft': draft.to_dict(with_tree=True),
    })


@drafts_bp.route('/<public_id>/clauses/<clause_no>', methods=['PUT'])
@login_required
def edit_clause(public_id: str, clause_no: str):
    """Ручная правка пункта.

    Правленный человеком пункт помечается защищённым: перегенерация раздела
    его не затирает. Юрист, поправивший формулировку, не должен обнаружить её
    исчезнувшей после следующего обращения к модели.
    """
    draft = _own_draft(public_id)
    if not draft:
        return _err('Документ не найден', 404, 'not_found')

    text = ((request.get_json(silent=True) or {}).get('text') or '').strip()
    if not text:
        return _err('Пустой текст пункта')

    tree = _tree_of(draft)
    clause = tree.clause_by_no(clause_no)
    if clause is None:
        return _err(f'Пункт {clause_no} не найден', 404, 'not_found')

    clause.text = text
    clause.locked = True
    _save_version(draft, tree, f'пункт {clause_no} исправлен вручную', by='user')
    db.session.commit()
    return jsonify({'success': True, 'draft': draft.to_dict(with_tree=True)})


# ────────────────────────────── версии ───────────────────────────────


@drafts_bp.route('/<public_id>/versions')
@login_required
def list_versions(public_id: str):
    draft = _own_draft(public_id)
    if not draft:
        return _err('Документ не найден', 404, 'not_found')
    items = draft.versions.order_by(DraftVersion.no.desc()).all()
    return jsonify({'success': True, 'versions': [v.to_dict() for v in items],
                    'current': draft.current_version})


@drafts_bp.route('/<public_id>/versions/<int:no>')
@login_required
def get_version(public_id: str, no: int):
    draft = _own_draft(public_id)
    if not draft:
        return _err('Документ не найден', 404, 'not_found')
    v = draft.versions.filter_by(no=no).first()
    if not v:
        return _err('Версия не найдена', 404, 'not_found')

    out = v.to_dict(with_tree=True)
    against = request.args.get('diff')
    if against is not None and against.isdigit():
        other = draft.versions.filter_by(no=int(against)).first()
        if other:
            out['changes'] = [c.model_dump(mode='json')
                              for c in diff(DocTree(**other.tree_json), DocTree(**v.tree_json))]
    return jsonify({'success': True, 'version': out})


@drafts_bp.route('/<public_id>/revert', methods=['POST'])
@login_required
def revert(public_id: str):
    """Откат к версии.

    Откат не удаляет историю, а добавляет новую версию с прежним содержимым:
    так виден и сам факт отката, и то, к чему вернулись.
    """
    draft = _own_draft(public_id)
    if not draft:
        return _err('Документ не найден', 404, 'not_found')
    no = (request.get_json(silent=True) or {}).get('version')
    if not isinstance(no, int):
        return _err('Не указан номер версии')
    v = draft.versions.filter_by(no=no).first()
    if not v:
        return _err('Версия не найдена', 404, 'not_found')

    _save_version(draft, DocTree(**v.tree_json), f'возврат к версии {no}', by='user')
    db.session.commit()
    return jsonify({'success': True, 'draft': draft.to_dict(with_tree=True)})


# ────────────────────────────── экспорт ───────────────────────────────


@drafts_bp.route('/<public_id>/preview')
@login_required
def preview(public_id: str):
    """HTML документа для предпросмотра на экране: тот же, что идёт в PDF."""
    draft = _own_draft(public_id)
    if not draft:
        return _err('Документ не найден', 404, 'not_found')
    from docengine.render import to_html

    return jsonify({'success': True, 'html': to_html(_tree_of(draft))})


@drafts_bp.route('/<public_id>/export')
@login_required
def export(public_id: str):
    draft = _own_draft(public_id)
    if not draft:
        return _err('Документ не найден', 404, 'not_found')

    fmt = (request.args.get('format') or 'docx').lower()
    if fmt not in ('docx', 'pdf', 'xlsx'):
        return _err('Поддерживаются форматы docx, pdf и xlsx')

    from docengine.render import to_docx, to_pdf, to_xlsx

    tree = _tree_of(draft)
    if fmt == 'xlsx' and not tree.tables and not any(a.table for a in tree.annexes):
        return _err('В документе нет таблиц для выгрузки в Excel', 409, 'no_tables')

    try:
        if fmt == 'docx':
            blob, filename = to_docx(tree)
            mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        elif fmt == 'pdf':
            blob, filename = to_pdf(tree)
            mime = 'application/pdf'
        else:
            blob, filename = to_xlsx(tree, request.args.get('table'))
            mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    except ImportError as e:
        log.error('экспорт %s недоступен: %s', fmt, e)
        return _err(f'Формат {fmt.upper()} на сервере недоступен', 503, 'export_unavailable')
    except Exception as e:
        log.exception('экспорт %s документа %s', fmt, public_id)
        return _err(f'Не удалось собрать файл: {e}', 500, 'export_error')

    log_usage('drafts', 'export', details={'type': draft.type_id, 'format': fmt, 'size': len(blob)})
    # Файл отдаётся из памяти: договор содержит персональные данные,
    # и оставлять его копию на диске сервера незачем.
    return send_file(io.BytesIO(blob), mimetype=mime, as_attachment=True,
                     download_name=filename)
