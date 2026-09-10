"""Реестр актов и формулировки ТЗ — данные, которые обязаны быть согласованы с корпусом."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from conformity import wording  # noqa: E402
from conformity.registry import TIER_COUNT, load_registry  # noqa: E402
from scripts.load_legal_docs import DOC_META  # noqa: E402


def test_exactly_four_levels_with_the_wording_from_the_spec():
    assert wording.LEVELS == (0, 1, 2, 3)
    assert wording.wording(0) == 'признаков противоречия в рамках автоматизированного анализа не выявлено'
    assert wording.wording(1) == 'норма требует экспертной проверки'
    assert wording.wording(2) == 'обнаружено возможное противоречие'
    assert wording.wording(3) == 'выявлен высокий риск несоответствия'
    assert wording.wording(3, 'kk') and wording.wording(3, 'en').startswith('a high risk')


def test_every_corpus_document_is_in_the_registry_with_a_valid_tier():
    reg = load_registry()
    for filename in DOC_META:
        act = reg.act(filename)
        assert act is not None, filename
        assert 1 <= act.tier <= TIER_COUNT
        assert act.code
    assert reg.act('k2600000000.01-07-2026.rus.txt').tier == 1
    assert reg.act('k950001000_.01-01-2023.rus.pdf').retired is True
    assert reg.act('k1500000414.20-01-2026.rus.pdf').code == 'ТК РК'


def test_tiers_are_named_in_three_languages():
    reg = load_registry()
    assert reg.tier_title(1, 'ru').startswith('Конституция')
    assert reg.tier_title(7, 'ru') == 'Нормативные постановления Курултая'
    assert reg.tier_title(11, 'kk') and reg.tier_title(11, 'en')
