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
        # Python с python.org на macOS не видит системные сертификаты — берём набор certifi, если он есть
        try:
            import certifi
            import ssl
            ctx = ssl.create_default_context(cafile=certifi.where())
        except ImportError:
            ctx = None
        with urllib.request.urlopen(req, timeout=60, context=ctx) as r:
            raw = r.read().decode('utf-8', errors='ignore')

    text = normalize(html_to_text(raw))
    check(text)
    with open(args.out, 'w', encoding='utf-8') as f:
        f.write(HEADER + text)
    print(f'записано {args.out}: {len(text):,} знаков')


if __name__ == '__main__':
    main()
