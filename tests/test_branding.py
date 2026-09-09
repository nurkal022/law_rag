"""
Система называется Dalel; страницы входа и регистрации — первое, что видит
новый человек, и на них старое имя держалось дольше всего. Проверяем файлы
шаблонов, а не отрисовку: имени в разметке быть не должно вовсе, в каком бы
блоке оно ни стояло. Имена файлов с логотипом (LogoLawVision.png) — не текст.
"""

import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

USER_FACING = [
    'templates/base.html',
    'templates/auth/_layout.html',
    'templates/auth/login.html',
    'templates/auth/register.html',
]


def _text(rel):
    with open(os.path.join(ROOT, rel), encoding='utf-8') as f:
        return f.read()


def test_auth_pages_carry_the_current_brand():
    for rel in USER_FACING:
        stale = re.findall(r'(?<!Logo)LawVision', _text(rel))
        assert not stale, f'{rel}: старое имя системы встречается {len(stale)} раз'


def test_auth_pages_name_the_system():
    assert 'Dalel' in _text('templates/auth/login.html')
    assert 'Dalel' in _text('templates/auth/register.html')
    assert 'DALEL' in _text('templates/auth/_layout.html')
