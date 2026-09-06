"""
Целостность каталога паспортов.

Паспорта правит юрист, а не программист, поэтому ошибка в YAML должна падать
здесь, а не всплывать в готовом договоре. Отдельная опасность — flow-запись
вида {ru: текст, с запятой}: запятая начинает новый ключ, лишние ключи
pydantic отбрасывает, и половина строки исчезает без единой жалобы.
"""

import os
import sys

import pytest
import yaml

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from docengine.passport import CATALOG_DIR, Passport, get_passport, load_catalog  # noqa: E402

TRANS_KEYS = {'ru', 'kk', 'en'}
CONTRACTS = ('sale', 'lease', 'services', 'employment', 'loan',
             'supply', 'construction', 'nda', 'agency')


def yaml_files():
    return sorted(CATALOG_DIR.rglob('*.yaml'))


def test_catalog_loads():
    catalog = load_catalog()
    assert len(catalog) >= 10


@pytest.mark.parametrize('type_id', CONTRACTS)
def test_every_contract_type_is_present(type_id):
    p = get_passport(type_id)
    assert p.kind == 'contract'
    assert len(p.parties) == 2
    assert p.sections and p.fields


def _walk(node, path=''):
    """Обходит разобранный YAML, выдавая (путь, словарь) для каждого словаря."""
    if isinstance(node, dict):
        yield path, node
        for k, v in node.items():
            yield from _walk(v, f'{path}.{k}' if path else str(k))
    elif isinstance(node, list):
        for i, v in enumerate(node):
            yield from _walk(v, f'{path}[{i}]')


@pytest.mark.parametrize('path', yaml_files(), ids=lambda p: p.name)
def test_no_comma_swallowed_translations(path):
    """Запятая в flow-записи молча съедает половину строки.

    {ru: Договор поставки, гл. 25} разбирается в два ключа: «ru» со значением
    «Договор поставки» и ключ «гл. 25» со значением None. Второй ключ pydantic
    отбрасывает — и текст теряется, не вызвав ни одной ошибки.
    """
    raw = yaml.safe_load(path.read_text(encoding='utf-8'))
    broken = []
    for where, node in _walk(raw):
        if 'ru' not in node:
            continue
        extra = set(node) - TRANS_KEYS
        empty = [k for k, v in node.items() if v is None]
        if extra and empty:
            broken.append(f'{where}: лишние ключи {sorted(extra)}')
    assert not broken, f'{path.name}: перевод разорван запятой — ' + '; '.join(broken)


@pytest.mark.parametrize('type_id', CONTRACTS)
def test_sections_have_real_guidance(type_id):
    """guidance — прямая инструкция модели; от неё качество зависит больше всего."""
    p = get_passport(type_id)
    for s in p.sections:
        text = s.guidance.get('ru')
        assert len(text) > 40, f'{type_id}/{s.key}: указание слишком короткое: {text!r}'


@pytest.mark.parametrize('type_id', CONTRACTS)
def test_essential_terms_point_at_real_fields(type_id):
    p = get_passport(type_id)
    for term in p.essential_terms:
        for name in term.fields:
            assert p.field(name), f'{type_id}: условие «{term.key}» ждёт поле «{name}»'
        if term.section:
            assert p.section(term.section)


@pytest.mark.parametrize('type_id', CONTRACTS)
def test_risks_reference_existing_parties(type_id):
    p = get_passport(type_id)
    for r in p.risks:
        assert 0 <= r.party < len(p.parties), f'{type_id}: риск указывает на сторону {r.party}'


@pytest.mark.parametrize('type_id', CONTRACTS)
def test_nothing_is_marked_reviewed_by_a_lawyer(type_id):
    """Флаг вправе снять только юрист, проверивший ссылки на нормы.

    Ссылки восстанавливались по памяти и по прежнему коду, где их тоже никто
    не сверял. Пока это так, интерфейс обязан говорить об этом прямо.
    """
    assert get_passport(type_id).reviewed is False


@pytest.mark.parametrize('type_id', CONTRACTS)
def test_skeleton_builds_for_every_type(type_id):
    """Каждый тип должен давать лист сразу, до обращения к модели."""
    from docengine.render import to_docx, to_html
    from docengine.skeleton import build_skeleton

    p = get_passport(type_id)
    tree = build_skeleton(p, {
        'party0_name': 'ТОО «Альфа»', 'party0_id_no': '123456789012',
        'party0_address': 'Астана', 'party1_name': 'ТОО «Бета»',
        'party1_id_no': '210987654321', 'party1_address': 'Алматы',
        'city': 'Астана',
    }, 'ru')
    assert len(tree.sections) == len(p.sections)
    assert tree.requisites.parties[0].role == p.parties[0].role.get('ru')
    assert 'ТОО «Альфа»' in to_html(tree)
    blob, name = to_docx(tree)
    assert blob[:2] == b'PK' and name.isascii()


def test_agency_states_it_has_no_chapter_in_the_code():
    """У агентского договора нет своей главы в ГК РК, и это должно быть сказано."""
    p = get_passport('agency')
    assert p.caveat is not None
    text = p.caveat.get('ru').lower()
    assert 'нет' in text and ('глав' in text or 'поимен' in text)
