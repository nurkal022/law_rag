"""
Очередь фоновых задач на PostgreSQL.

Генерация договора — это десяток последовательных обращений к модели, то есть
минуты. Внутри HTTP-запроса такое не живёт: обратный прокси рвёт соединение по
таймауту, и работа пропадает вместе с ним, хотя модель её уже сделала.

Поэтому запрос только ставит задачу и отдаёт её идентификатор, а клиент
подписывается на поток прогресса. Обрыв связи больше ничего не стоит: задача
доделается, результат останется в базе.

Redis и Celery не берём: это две дополнительные системы ради очереди, которая
укладывается в одну таблицу. `FOR UPDATE SKIP LOCKED` гарантирует, что двое
воркеров не возьмут одну задачу, а задачи переживают перезапуск процесса.
"""

from __future__ import annotations

import logging
import secrets
import threading
import time
import traceback
from datetime import datetime, timedelta
from typing import Any, Callable, Optional

from sqlalchemy import text

log = logging.getLogger('docengine.jobs')

# Задача, чей воркер не подавал признаков жизни дольше этого срока, считается
# брошенной: процесс упал посреди работы. Её возвращают в очередь.
STALE_AFTER = timedelta(minutes=10)
MAX_ATTEMPTS = 3

_handlers: dict[str, Callable[[Any, dict, Callable[[int, int, str], None]], dict]] = {}


def handler(kind: str):
    """Регистрирует обработчик задачи данного вида."""

    def wrap(fn):
        _handlers[kind] = fn
        return fn

    return wrap


def new_id() -> str:
    return secrets.token_hex(8)


def enqueue(kind: str, payload: dict, *, owner_id: int | None = None,
            draft_id: int | None = None, total: int = 0) -> 'Job':
    from database.models import Job, db

    job = Job(
        public_id=new_id(),
        kind=kind,
        status='queued',
        owner_id=owner_id,
        draft_id=draft_id,
        payload_json=payload,
        progress_total=total,
    )
    db.session.add(job)
    db.session.commit()
    log.info('job queued %s kind=%s owner=%s', job.public_id, kind, owner_id)
    return job


def _claim(db) -> Optional['Job']:
    """Берёт одну задачу из очереди атомарно.

    SKIP LOCKED пропускает строки, уже захваченные другим воркером, вместо
    того чтобы ждать их освобождения. Без него два воркера выстроились бы в
    очередь на одну и ту же задачу.
    """
    from database.models import Job

    row = db.session.execute(text('''
        SELECT id FROM jobs
        WHERE status = 'queued'
           OR (status = 'running' AND heartbeat_at < :stale)
        ORDER BY created_at
        FOR UPDATE SKIP LOCKED
        LIMIT 1
    ''' ), {'stale': datetime.utcnow() - STALE_AFTER}).first()

    if row is None:
        db.session.rollback()
        return None

    job = db.session.get(Job, row[0])
    job.status = 'running'
    job.attempts = (job.attempts or 0) + 1
    job.started_at = job.started_at or datetime.utcnow()
    job.heartbeat_at = datetime.utcnow()
    db.session.commit()
    return job


def run_once(app) -> bool:
    """Один цикл воркера. Возвращает True, если задача была взята."""
    from database.models import Job, db

    with app.app_context():
        job = _claim(db)
        if job is None:
            return False

        job_id, kind, payload = job.public_id, job.kind, dict(job.payload_json or {})
        fn = _handlers.get(kind)

        if fn is None:
            job.status = 'failed'
            job.error = f'нет обработчика для задачи «{kind}»'
            job.finished_at = datetime.utcnow()
            db.session.commit()
            log.error('job %s: no handler for %s', job_id, kind)
            return True

        def progress(done: int, total: int, label: str = '', meta: dict | None = None) -> None:
            # Отдельная короткая транзакция: прогресс должен быть виден
            # клиенту немедленно, а не после завершения всей задачи.
            j = db.session.get(Job, job.id)
            if j is None:
                return
            j.progress_done, j.progress_total, j.progress_label = done, total, label
            # Содержание хода — стадия, найденные нормы, частичное дерево —
            # едет в result_json: колонка уже есть, поток событий её отдаёт,
            # а по завершении сюда ляжет итог задачи.
            if meta is not None:
                j.result_json = meta
            j.heartbeat_at = datetime.utcnow()
            db.session.commit()

        try:
            result = fn(app, payload, progress)
            j = db.session.get(Job, job.id)
            j.status = 'done'
            j.result_json = result
            j.finished_at = datetime.utcnow()
            j.progress_done = j.progress_total or j.progress_done
            db.session.commit()
            log.info('job %s done', job_id)
        except Exception as e:
            db.session.rollback()
            j = db.session.get(Job, job.id)
            retry = (j.attempts or 0) < MAX_ATTEMPTS
            j.status = 'queued' if retry else 'failed'
            j.error = f'{e}'
            if not retry:
                j.finished_at = datetime.utcnow()
            db.session.commit()
            log.error('job %s failed (attempt %s): %s\n%s',
                      job_id, j.attempts, e, traceback.format_exc())
        return True


def worker_loop(app, *, idle_sleep: float = 1.0, stop: threading.Event | None = None) -> None:
    """Бесконечный цикл разбора очереди."""
    log.info('worker started, handlers: %s', ', '.join(sorted(_handlers)))
    while not (stop and stop.is_set()):
        try:
            if not run_once(app):
                time.sleep(idle_sleep)
        except Exception as e:
            # Сбой самого цикла (например, обрыв соединения с базой) не должен
            # останавливать воркер: подождём и попробуем снова.
            log.error('worker loop error: %s', e)
            time.sleep(5)


def start_inline_worker(app) -> threading.Thread:
    """Воркер в потоке того же процесса — для разработки.

    В производственной среде воркер запускается отдельным процессом: иначе он
    делит с веб-сервером и память, и глобальную блокировку интерпретатора.
    """
    from database.models import db

    with app.app_context():
        dialect = db.engine.dialect.name
    if dialect != 'postgresql':
        # Разбор очереди держится на FOR UPDATE SKIP LOCKED — этого нет ни у
        # SQLite, ни у MySQL. Молчаливый запуск обернулся бы бесконечным
        # потоком ошибок в журнале вместо одной внятной строки.
        log.warning('очередь задач требует PostgreSQL, а подключена %s: '
                    'воркер не запущен, генерация документов недоступна', dialect)
        raise RuntimeError(f'очередь задач не работает на {dialect}')

    stop = threading.Event()
    t = threading.Thread(target=worker_loop, args=(app,), kwargs={'stop': stop}, daemon=True)
    t.start()
    app.extensions['docengine_worker'] = (t, stop)
    return t


def get_job(public_id: str):
    from database.models import Job, db

    return db.session.query(Job).filter_by(public_id=public_id).first()
