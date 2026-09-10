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
