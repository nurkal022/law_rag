#!/usr/bin/env python3
"""
Живая проверка генерации: настоящая модель, настоящий документ, настоящий файл.

Не тест, а проверка сквозного пути. Тесты подставляют модель заглушкой и
поэтому не могут ответить на главный вопрос: получается ли на выходе документ,
который юрист согласится открыть.

    python scripts/smoke_generate.py --type supply
    python scripts/smoke_generate.py --type supply --sections subject,price

Обращается к модели по-настоящему и расходует квоту провайдера.
Результат складывает в /tmp/tura-smoke/.
"""

import argparse
import logging
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ.setdefault('DOCENGINE_INLINE_WORKER', '0')
os.environ.setdefault('DATABASE_URL', 'sqlite:////tmp/tura-smoke.db')

OUT = '/tmp/tura-smoke'

VALUES = {
    'supply': {
        'party0_name': 'ТОО «Альфа Трейд»', 'party0_id_no': '123456789012',
        'party0_address': 'г. Астана, ул. Достык, 12', 'party0_signatory': 'Ахметов А. А.',
        'party0_signatory_role': 'директор', 'party0_basis': 'устава',
        'party1_name': 'ТОО «Бета Снаб»', 'party1_id_no': '210987654321',
        'party1_address': 'г. Алматы, пр. Абая, 45', 'party1_signatory': 'Досаев Д. Д.',
        'party1_signatory_role': 'директор', 'party1_basis': 'устава',
        'city': 'Астана', 'goods': 'офисная мебель', 'total_price': '4 500 000',
        'delivery_term': '30 календарных дней', 'payment_term': '10 банковских дней',
    },
}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--type', default='supply', help='тип договора из каталога')
    parser.add_argument('--sections', default='', help='только эти разделы, через запятую')
    parser.add_argument('--lang', default='ru')
    args = parser.parse_args()

    logging.basicConfig(level='INFO', format='%(levelname)-7s %(name)s: %(message)s')
    os.makedirs(OUT, exist_ok=True)

    from llm_providers.factory import LLMProviderFactory

    from docengine.check import check
    from docengine.generate import generate_document
    from docengine.passport import get_passport
    from docengine.render import to_docx, to_html

    provider = LLMProviderFactory.get_current_provider()
    if provider is None:
        print('Провайдер модели не настроен.')
        return 2

    passport = get_passport(args.type)
    values = VALUES.get(args.type, {})
    only = [s.strip() for s in args.sections.split(',') if s.strip()]
    if only:
        passport = passport.model_copy(deep=True)
        passport.sections = [s for s in passport.sections if s.key in only]

    print(f'\nТип: {passport.name.get(args.lang)}')
    print(f'Разделов к генерации: {len(passport.sections)}\n')

    started = time.time()

    def progress(done, total, title):
        print(f'  [{done + 1 if done < total else total}/{total}] {title}')

    tree = generate_document(provider, passport, values, args.lang, progress=progress)
    spent = time.time() - started

    print(f'\nГотово за {spent:.0f} с')
    print(f'Разделов заполнено: {sum(1 for s in tree.sections if not s.pending)} '
          f'из {len(tree.sections)}')
    print(f'Пунктов: {sum(1 for _ in tree.walk_clauses())}')

    issues = check(tree, passport, values)
    errors = [i for i in issues if i.level == 'error']
    warnings = [i for i in issues if i.level == 'warning']
    print(f'Замечания: {len(errors)} ошибок, {len(warnings)} предупреждений')
    for i in errors[:5]:
        print(f'  ошибка: {i.message}')
    for i in warnings[:5]:
        print(f'  внимание: {i.message}')

    refs = [r for _s, c, _p in tree.walk_clauses() for r in c.refs]
    print(f'Ссылок на нормы: {len(refs)} (выверено: {sum(1 for r in refs if r.verified)})')

    html_path = os.path.join(OUT, f'{args.type}.html')
    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(to_html(tree, standalone=True))

    blob, name = to_docx(tree)
    docx_path = os.path.join(OUT, name)
    with open(docx_path, 'wb') as f:
        f.write(blob)

    print(f'\nЛист:  {html_path}')
    print(f'Word:  {docx_path} ({len(blob) // 1024} КБ)')

    print('\nПервые пункты:')
    for _s, c, parent in list(tree.walk_clauses())[:6]:
        if parent is None:
            print(f'  {c.no}. {c.text[:110]}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
