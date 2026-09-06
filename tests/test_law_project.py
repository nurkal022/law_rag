"""
Законопроект на общем движке.

Проверяется главным образом то, что договорная модель не протекает в
нормативный акт: у закона нет сторон, и договорные формулировки в нём —
не косметический дефект, а ложь в тексте документа.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from docengine.check import check  # noqa: E402
from docengine.passport import get_passport  # noqa: E402
from docengine.skeleton import build_skeleton  # noqa: E402

VALUES = {
    'title_ru': 'О внесении изменений в Закон о государственных закупках',
    'initiator': 'Депутат Мажилиса Парламента РК',
    'initiator_type': 'deputy',
    'problem_description': 'Действующий порядок допускает необоснованное сужение круга участников.',
    'budget_impact': 'Дополнительных расходов не требуется.',
    'goals': 'Расширить конкуренцию',
}


def passport():
    return get_passport('law_project')


def test_title_is_the_law_name_not_the_type_name():
    """«О внесении изменений…», а не «Проект закона Республики Казахстан»."""
    tree = build_skeleton(passport(), VALUES, 'ru')
    assert tree.meta.title == VALUES['title_ru']


def test_untitled_project_falls_back_to_type_name():
    tree = build_skeleton(passport(), {}, 'ru')
    assert tree.meta.title == 'Проект закона Республики Казахстан'


def test_no_contract_preamble_in_a_law():
    """У закона нет контрагентов: «стороны заключили» здесь недопустимо."""
    tree = build_skeleton(passport(), VALUES, 'ru')
    assert tree.preamble == ''
    assert 'договор' not in tree.plain_text().lower()


def test_law_has_no_parties():
    tree = build_skeleton(passport(), VALUES, 'ru')
    assert tree.requisites.parties == []


def test_package_has_all_sections_pending():
    tree = build_skeleton(passport(), VALUES, 'ru')
    keys = [s.key for s in tree.sections]
    assert 'explanatory_note' in keys and 'financial' in keys and 'anticorruption' in keys
    assert all(s.pending for s in tree.sections)


def test_missing_financial_justification_is_an_error():
    """Финансовое обоснование — существенная часть пакета, а не пожелание."""
    p = passport()
    values = dict(VALUES)
    values.pop('budget_impact')
    tree = build_skeleton(p, values, 'ru')
    issues = check(tree, p, values)
    assert any(i.code == 'essential_term_missing' and i.level == 'error' for i in issues)


def test_full_data_leaves_no_blocking_errors():
    p = passport()
    tree = build_skeleton(p, VALUES, 'ru')
    issues = check(tree, p, VALUES)
    # Разделы ещё не сгенерированы — это info, а не препятствие.
    assert [i for i in issues if i.level == 'error'] == []


def test_law_renders_to_docx():
    from docengine.render import to_docx

    tree = build_skeleton(passport(), VALUES, 'ru')
    blob, filename = to_docx(tree)
    assert blob[:2] == b'PK'
    assert filename.endswith('.docx')
    assert filename.isascii()
