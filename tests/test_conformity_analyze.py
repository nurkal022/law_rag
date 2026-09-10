"""
Модель подменена: проверяем правила вокруг неё — опора обязательна, второй проход
может только понизить уровень, механический слой сливается с модельным.
"""
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from conformity.analyze import AnalyzeConfig, Norm, analyze_norm, facts  # noqa: E402
from conformity.changes import load_changes  # noqa: E402
from conformity.constitution import Article, ConstitutionIndex  # noqa: E402

CS = load_changes()
CFG = AnalyzeConfig(triage_model='triage-x', verify_model='verify-x', top_articles=2)
INDEX = ConstitutionIndex([
    Article(5, 'I', 'Основы', 'Порядок действия международных договоров определяется законами.', np.array([1.0, 0.0])),
    Article(52, 'IV', 'Курултай', 'Курултай – высший представительный орган.', np.array([0.0, 1.0])),
    Article(80, 'VIII', 'Правосудие', 'Судья не может быть привлечён без согласия Курултая.', np.array([0.5, 0.5])),
])


class FakeProvider:
    def __init__(self, *answers):
        self.answers = list(answers)
        self.calls = []

    def chat_completion(self, messages, model=None, **kwargs):
        self.calls.append({'model': model, 'messages': messages})
        a = self.answers.pop(0)
        if isinstance(a, Exception):
            raise a
        return {'content': json.dumps(a, ensure_ascii=False), 'model': model, 'usage': {'total_tokens': 100}}


def norm(text, vec=(1.0, 0.0)):
    return Norm(chunk_id=7, document_id=3, act_title='Закон РК «О правовых актах»', article_no='6',
                article_title='Статья 6. Международные договоры', text=text, vector=np.array(vec))


TREATY = 'Статья 6. Международные договоры\nМеждународные договоры, ратифицированные Республикой Казахстан, имеют приоритет перед ее законами.'


def test_supported_finding_is_verified_and_kept():
    p = FakeProvider(
        {'level': 3, 'category': 'competence', 'constitution_articles': [5], 'change_ids': ['treaties_priority'],
         'quote_norm': 'имеют приоритет перед ее законами', 'explanation': 'Приоритет исключён.', 'recommendation': 'Пересмотреть.'},
        {'keep': True, 'level': 3, 'reason': 'подтверждено'},
    )
    f = analyze_norm(norm(TREATY), INDEX, CS, p, CFG)
    assert f.level == 3 and f.method == 'model+verified' and f.constitution_articles == [5]
    assert [c['model'] for c in p.calls] == ['triage-x', 'verify-x']
    # первому проходу подали и статьи, и изменение о договорах, и справку об институтах
    user = p.calls[0]['messages'][1]['content']
    assert 'treaties_priority' in user and 'Статья 5' in user and 'Высший Судебный Совет' in user


def test_level_without_a_quote_is_downgraded_and_not_verified():
    p = FakeProvider({'level': 2, 'category': 'rights', 'constitution_articles': [5], 'change_ids': [],
                      'quote_norm': '', 'explanation': 'Может быть.', 'recommendation': ''})
    f = analyze_norm(norm(TREATY), INDEX, CS, p, CFG)
    assert f.level == 0 and f.category == 'none' and len(p.calls) == 1
    assert 'нет опоры' in f.explanation


def test_quote_not_from_the_norm_is_downgraded():
    p = FakeProvider({'level': 2, 'category': 'procedure', 'constitution_articles': [5], 'change_ids': [],
                      'quote_norm': 'этого текста в норме нет', 'explanation': 'x', 'recommendation': ''})
    assert analyze_norm(norm(TREATY), INDEX, CS, p, CFG).level == 0


def test_verifier_can_lower_but_not_raise():
    p = FakeProvider(
        {'level': 2, 'category': 'competence', 'constitution_articles': [5], 'change_ids': [],
         'quote_norm': 'имеют приоритет перед ее законами', 'explanation': 'x', 'recommendation': ''},
        {'keep': False, 'level': 3, 'reason': 'вверх нельзя'},
    )
    f = analyze_norm(norm(TREATY), INDEX, CS, p, CFG)
    assert f.level == 0  # keep=False без уровня ниже заявленного — опровержение
    p2 = FakeProvider(
        {'level': 2, 'category': 'competence', 'constitution_articles': [5], 'change_ids': [],
         'quote_norm': 'имеют приоритет перед ее законами', 'explanation': 'x', 'recommendation': ''},
        {'keep': False, 'level': 0, 'reason': 'норма детализирует'},
    )
    assert analyze_norm(norm(TREATY), INDEX, CS, p2, CFG).level == 0


def test_level_one_is_verified_too_and_verifier_sees_the_change_register():
    p = FakeProvider(
        {'level': 1, 'category': 'competence', 'constitution_articles': [5], 'change_ids': ['treaties_priority'],
         'quote_norm': 'имеют приоритет перед ее законами', 'explanation': 'x', 'recommendation': ''},
        {'keep': True, 'level': 1, 'reason': 'ok'},
    )
    f = analyze_norm(norm(TREATY), INDEX, CS, p, CFG)
    assert f.level == 1 and f.method == 'model+verified' and len(p.calls) == 2
    assert 'Было' in p.calls[1]['messages'][1]['content'] and 'приоритет' in p.calls[1]['messages'][1]['content']


def test_claim_that_an_existing_body_is_abolished_is_downgraded():
    p = FakeProvider({'level': 2, 'category': 'competence', 'constitution_articles': [80], 'change_ids': [],
                      'quote_norm': 'имеют приоритет перед ее законами',
                      'explanation': 'Конституционный Суд упразднён, его функции переданы другим органам.', 'recommendation': 'x'})
    f = analyze_norm(norm(TREATY), INDEX, CS, p, CFG)
    assert f.level == 0 and 'Конституционный Суд' in f.explanation and len(p.calls) == 1


def test_merge_keeps_dictionary_names_and_drops_model_silence():
    p = FakeProvider({'level': 0, 'category': 'none', 'constitution_articles': [], 'change_ids': [],
                      'quote_norm': '', 'explanation': 'Норма не содержит элементов противоречия.', 'recommendation': ''})
    text = 'Статья 27. Судья не может быть привлечен без согласия Сената Парламента. Парламентом утверждается бюджет.'
    f = analyze_norm(norm(text, (0.0, 1.0)), INDEX, CS, p, CFG)
    assert f.method == 'dictionary+model'
    assert 'Парламент, Сенат' in f.explanation and 'Парламентом' not in f.explanation
    assert 'не содержит элементов' not in f.explanation


def test_dictionary_and_model_layers_merge():
    p = FakeProvider({'level': 0, 'category': 'none', 'constitution_articles': [], 'change_ids': [],
                      'quote_norm': '', 'explanation': 'Не выявлено.', 'recommendation': ''})
    text = 'Статья 27. Судья не может быть привлечен к ответственности без согласия Сената Парламента.'
    f = analyze_norm(norm(text, (0.0, 1.0)), INDEX, CS, p, CFG)
    assert f.level == 2 and f.category == 'terminology' and f.method == 'dictionary+model'
    assert 'kurultai' in f.change_ids and 52 in f.constitution_articles


def test_provider_failure_is_recorded_not_raised():
    p = FakeProvider(RuntimeError('quota'))
    f = analyze_norm(norm(TREATY), INDEX, CS, p, CFG)
    assert f.level is None and 'quota' in f.error


def test_unknown_articles_and_categories_are_dropped():
    p = FakeProvider({'level': 1, 'category': 'weird', 'constitution_articles': [5, 999], 'change_ids': ['nope', 'treaties_priority'],
                      'quote_norm': 'имеют приоритет', 'explanation': 'x', 'recommendation': ''},
                     {'keep': True, 'level': 1, 'reason': 'ok'})
    f = analyze_norm(norm(TREATY), INDEX, CS, p, CFG)
    assert f.level == 1 and f.category == 'none' and f.constitution_articles == [5] and f.change_ids == ['treaties_priority']


def test_facts_name_present_and_absent_institutions():
    text = facts(CS)
    assert 'Высший Судебный Совет' in text and 'Мажилис' in text and 'ст. 96' in text
