#!/usr/bin/env python3
"""
Фоновый воркер документного движка.

Запускается отдельным процессом рядом с веб-сервером:

    python scripts/worker.py

Разбирает очередь задач: генерацию документов, перегенерацию разделов.
Остановка по Ctrl+C. Задача, прерванная на середине, возвращается в очередь
через десять минут молчания и берётся заново.
"""

import logging
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Веб-процесс не должен поднимать второй воркер внутри себя, когда работает этот.
os.environ.setdefault('DOCENGINE_INLINE_WORKER', '0')

logging.basicConfig(
    level=os.getenv('LOG_LEVEL', 'INFO'),
    format='%(asctime)s %(levelname)-7s %(name)s: %(message)s',
)

from app import app  # noqa: E402
from docengine import tasks  # noqa: E402,F401  регистрирует обработчики
from docengine.jobs import worker_loop  # noqa: E402

if __name__ == '__main__':
    logging.getLogger('docengine').info('воркер запущен')
    try:
        worker_loop(app)
    except KeyboardInterrupt:
        logging.getLogger('docengine').info('воркер остановлен')
