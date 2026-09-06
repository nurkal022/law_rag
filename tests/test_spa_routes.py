"""
Отдача одностраничного приложения.

Проверка существует потому, что сломано это было незаметно: сборка
фронтенда лежала на диске, но ни один маршрут её не отдавал, а адреса
продукта занимали прежние страницы на шаблонах. Открывший /contracts
попадал на прежний экран и не имел способа узнать, что есть другой.
"""

import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


@pytest.fixture(scope='module')
def rules():
    """Карта адресов приложения без его запуска: поднимать всё ради имён дорого."""
    import re

    source = open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                               'app.py'), encoding='utf-8').read()
    paths = re.search(r'SPA_PATHS = \[(.*?)\]', source, re.S)
    assert paths, 'список адресов приложения не найден в app.py'
    return re.findall(r"'([^']+)'", paths.group(1))


PRODUCT_PATHS = ('/', '/about', '/chat', '/contracts', '/laws', '/workspace', '/matters')


@pytest.mark.parametrize('path', PRODUCT_PATHS)
def test_product_path_belongs_to_the_app(rules, path):
    assert path in rules, f'адрес {path} не отдаётся приложением'


def test_nested_paths_are_covered(rules):
    """Внутренние адреса — документ, конструктор — тоже принадлежат приложению."""
    for prefix in ('/chat', '/contracts', '/laws', '/workspace'):
        assert f'{prefix}/<path:rest>' in rules, f'{prefix} без вложенных адресов'


def test_legacy_pages_moved_aside():
    """Прежние страницы не удалены, но адреса продукта больше не занимают."""
    source = open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                               'app.py'), encoding='utf-8').read()
    for route in ("@app.route('/contracts')", "@app.route('/law-generator')",
                  "@app.route('/about')"):
        assert route not in source, f'прежний маршрут {route} снова занимает адрес продукта'
    for route in ("@app.route('/legacy/contracts')", "@app.route('/legacy/law-generator')"):
        assert route in source, f'прежняя страница потеряна: {route}'


def test_login_redirect_targets_still_exist():
    """Вход перенаправляет по именам точек входа: их нельзя потерять при переносе."""
    source = open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                               'app.py'), encoding='utf-8').read()
    assert "endpoint='index'" in source
    assert "endpoint='chat_page'" in source
