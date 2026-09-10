"""
Механический слой: словарь институтов и перенумерация статей дают точные находки
без модели. Словарь обязан сходиться с текстом Конституции 2026 — иначе история
с «упразднённым» Высшим Судебным Советом повторится.
"""
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from conformity.changes import load_changes, mechanical_findings, strip_footnotes, validate  # noqa: E402

CS = load_changes()

ARTICLES_2026 = {n: '' for n in range(1, 97)}
ARTICLES_2026.update({
    49: 'Вице-Президент Республики Казахстан назначается на должность Президентом с согласия Курултая.',
    52: 'Курултай Республики Казахстан – высший представительный орган.',
    70: 'Қазақстан Халық Кеңесі (Народный Совет Казахстана) – высший консультативный орган.',
    72: 'Конституционный Суд Республики Казахстан – независимый государственный орган.',
    83: 'Председатель Верховного Суда назначается по рекомендации Высшего Судебного Совета.',
    85: 'Уполномоченный по правам человека содействует восстановлению нарушенных прав.',
    86: 'Адвокатура в Республике Казахстан содействует реализации прав человека.',
    89: 'Местный исполнительный орган возглавляет аким. Маслихаты и Центральная избирательная комиссия.',
    91: 'Правительство, Премьер-Министр, Президент, Прокуратура, Верховный Суд, Высшая аудиторская палата, Национальный Банк, Совет Безопасности.',
    95: 'Парламент Республики Казахстан прекращает свои полномочия с 1 июля 2026 года.',
    96: 'Нормативные постановления Конституционного Совета и Конституционного Суда сохраняют силу.',
})


def test_registry_validates_against_the_2026_text():
    validate(CS, ARTICLES_2026)  # не падает: отсутствующие термины есть только в ст. 94–96


def test_validation_fails_when_an_absent_term_shows_up_in_a_live_article():
    broken = dict(ARTICLES_2026)
    broken[60] = 'Сенат утверждает кандидатуру'
    with pytest.raises(ValueError, match='Сенат'):
        validate(CS, broken)


def test_senate_consent_is_a_terminology_finding_with_the_kurultai_articles():
    norm = ('Статья 27. Неприкосновенность судей\n'
            'Судья не может быть привлечен к уголовной ответственности без согласия Сената Парламента.')
    found = mechanical_findings(norm, CS)
    assert len(found) == 1
    f = found[0]
    assert f.level == 2 and f.category == 'terminology' and f.method == 'dictionary'
    assert 'kurultai' in f.change_ids
    assert 52 in f.constitution_articles
    assert 'Сената Парламента' in f.quote_norm


def test_existing_bodies_are_not_flagged():
    norm = 'Статья 30. Председатель Верховного Суда назначается по рекомендации Высшего Судебного Совета.'
    assert mechanical_findings(norm, CS) == []


def test_term_only_in_a_footnote_is_level_one():
    norm = ('Статья 5. Порядок.\nПорядок определяется законом.\n'
            'Сноска. Статья 5 в редакции Закона РК, одобренного Мажилисом Парламента 01.01.2020.')
    found = mechanical_findings(norm, CS)
    assert [f.level for f in found] == [1]
    assert strip_footnotes(norm).count('Мажилис') == 0


def test_reference_to_a_renumbered_constitution_article():
    norm = 'Статья 10. Принципы правосудия применяются в соответствии со статьей 77 Конституции Республики Казахстан.'
    found = mechanical_findings(norm, CS)
    assert len(found) == 1 and found[0].category == 'reference' and found[0].level == 1
    assert sorted(found[0].constitution_articles) == [19, 78]


def test_reference_to_a_dropped_constitution_article():
    norm = 'Статья 3. Полномочия Сената установлены статьей 55 Конституции.'
    cats = {f.category: f for f in mechanical_findings(norm, CS)}
    assert cats['reference'].level == 2 and cats['reference'].constitution_articles == []
    assert 'terminology' in cats


def test_hints_attach_the_treaty_change_to_a_norm_about_treaty_priority():
    norm = 'Международные договоры, ратифицированные Республикой Казахстан, имеют приоритет перед ее законами.'
    assert 'treaties_priority' in [c.id for c in CS.hinted(norm)]


def test_long_enumeration_quote_is_cut_at_word_boundaries():
    words = ' '.join(f'слово{i}' for i in range(60))
    norm = f'Статья 1. Понятия: {words}, постановления Сената Парламента, {words}.'
    q = mechanical_findings(norm, CS)[0].quote_norm
    assert 'Сената Парламента' in q and q.startswith('…') and q.endswith('…')
    assert not q.lstrip('…').startswith('лово')  # не с обрывка слова
