"""
Демонстрационное заполнение конструктора.

Показать генерацию, не набирая пятнадцать полей руками, — обычная нужда на
показе. Значения живут в паспорте рядом с описанием полей: иначе они
разойдутся с формой при первом же изменении состава полей.
"""

import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from docengine.demo import demo_values  # noqa: E402
from docengine.passport import get_passport, load_catalog  # noqa: E402


@pytest.fixture(scope='module')
def catalog():
    return load_catalog()


def test_law_project_demo_fills_every_required_field(catalog):
    p = get_passport('law_project')
    values = demo_values(p, 'ru')

    missing = [f.name for f in p.fields if f.required and not str(values.get(f.name, '')).strip()]
    assert missing == [], f'без примера остались обязательные поля: {missing}'


def test_demo_select_values_are_real_options(catalog):
    """В select нельзя подставить текст: форма покажет пустой выбор."""
    p = get_passport('law_project')
    values = demo_values(p, 'ru')

    for f in p.fields:
        if f.type != 'select' or f.name not in values:
            continue
        allowed = {o.value for o in f.options}
        assert values[f.name] in allowed, f'{f.name}: «{values[f.name]}» нет среди вариантов'


@pytest.mark.parametrize('type_id', [
    'lease', 'sale', 'supply', 'services', 'employment', 'loan', 'nda', 'agency', 'construction',
])
def test_every_contract_has_a_complete_demo(catalog, type_id):
    p = get_passport(type_id)
    values = demo_values(p, 'ru')

    missing = [f.name for f in p.fields if f.required and not str(values.get(f.name, '')).strip()]
    assert missing == [], f'{type_id}: без примера остались обязательные поля: {missing}'


@pytest.mark.parametrize('type_id', ['lease', 'employment'])
def test_contract_demo_fills_both_parties(catalog, type_id):
    """Договор без реквизитов сторон не составится: преамбула соберётся пустой."""
    p = get_passport(type_id)
    values = demo_values(p, 'ru')

    for idx in range(len(p.parties)):
        assert values.get(f'party{idx}_name', '').strip(), f'{type_id}: сторона {idx} без наименования'
        assert values.get(f'party{idx}_id_no', '').strip(), f'{type_id}: сторона {idx} без БИН/ИИН'
        assert values.get(f'party{idx}_kind') in {'legal', 'individual', 'ip'}


def test_demo_speaks_the_requested_language(catalog):
    """Свободный текст переключается на язык интерфейса.

    Название на русском (`title_ru`) при этом остаётся русским: это реквизит
    документа, а не подпись в интерфейсе.
    """
    p = get_passport('law_project')
    ru = demo_values(p, 'ru')
    kk = demo_values(p, 'kk')

    assert ru['problem_description'] != kk['problem_description']
    assert ru['title_ru'] == kk['title_ru']


def test_demo_values_are_plausible_not_placeholders(catalog):
    """Смысл кнопки — показать генерацию на правдоподобных данных.

    «Тест», «xxx» и «lorem» в форме дают такой же документ, и показывать его
    стыдно; проверяем, что примеры выглядят как настоящее дело.
    """
    junk = ('тест', 'test', 'xxx', 'lorem', 'пример', 'образец', 'demo')
    for type_id in ('law_project', 'lease', 'employment'):
        for name, value in demo_values(get_passport(type_id), 'ru').items():
            low = str(value).lower()
            assert not any(j in low for j in junk), f'{type_id}.{name}: «{value}»'
