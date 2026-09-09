# Законопроект: бриф → концепты → пакет — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Заменить четырёхшаговую форму законопроекта режимом «бриф → три концепта на выбор → пакет» и показать ход генерации содержательно: найденные нормы и лист, наполняющийся по разделам.

**Architecture:** Сервер получает модуль `docengine/brief.py` (сферы, схема концепта, сборка значений паспорта, уточнения, вызов модели через существующий `_ask_json`) и две ручки в `blueprints/drafts`; обработчик генерации пишет стадию, найденные нормы и частичное дерево в `Job.result_json`, который поток событий уже отдаёт. Клиент получает `BriefPage` вместо `WizardPage` на `/laws/new`, а страница документа учится подхватывать запущенную задачу, показывать строку стадии и анимировать свежие разделы. Паспорт остаётся источником правды: концепт и уточнения только заполняют его поля.

**Tech Stack:** Flask + SQLAlchemy + pydantic (сервер), pytest; React 19 + TypeScript + Vite (клиент), без тест-раннера — `tsc`, `lint-tokens`, сборка; проверка в браузере на проде `https://law.archeo.asia`.

**Spec:** `docs/superpowers/specs/2026-09-10-law-brief-concepts-design.md`

## Global Constraints

- Схема БД не меняется: новые данные живут в JSON-колонках (`Job.result_json`) и ответах ручек.
- Паспорт `law_project` — источник правды; сгенерированный документ ничем не отличается от созданного формой.
- Договоры новым режимом не трогаем; их конструктор и страница документа должны работать как прежде.
- Тесты пути очереди (`tests/test_api_drafts.py`, `_generate_in_background`) обязаны оставаться зелёными.
- Фронтенд: только токены дизайн-системы (`npm run check` = `tsc` + `lint-tokens`); литеральные цвета, кегли, тени запрещены; `--i` из разметки разрешён.
- Тексты интерфейса — ru/kk/en в словарях `Dict`; казахский в интерфейсе — `kz`, в документах — `kk` (`docLang`).
- Комментарии в коде — по-русски, объясняют «почему», а не «что».
- Коммиты завершаются строкой `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Деплой: фронтенд — `npm run build` → `rsync static/app/` (без `__devlogin.html`) в `~/dalel/static/app/` на 95.141.135.244; бэкенд — `git pull` + `docker compose -f docker-compose.demo.yml build app && up -d app`.

## Файлы

| Файл | Ответственность |
|---|---|
| `docengine/catalog/laws/law_project.yaml` | + поле `key_provisions` с примером |
| `docengine/brief.py` (новый) | сферы, `Concept`, `BriefResult`, `to_values`, уточнения, пример брифа, `propose_concepts` |
| `docengine/generate.py` | `_retrieve_chunks`, `_context_text`, `found_norms`; `_retrieve` — обёртка |
| `docengine/jobs.py` | `progress(done, total, label, meta=None)` |
| `docengine/tasks.py` | стадии, найденные нормы, частичное дерево в `meta` |
| `blueprints/drafts/routes.py` | `GET /brief/domains`, `POST /brief`, `job` в `GET /<id>` |
| `tests/test_brief_module.py` (новый) | модуль концептов без HTTP |
| `tests/test_api_brief.py` (новый) | ручки брифа по HTTP |
| `tests/test_api_drafts.py` | прогресс с содержанием, `job` в ответе документа |
| `frontend/src/features/legal/cite.ts` | `normCode(title, article)` |
| `frontend/src/features/chat/answer.ts` | `sourceCode` через `normCode` |
| `frontend/src/features/drafts/types.ts` | `Draft.job`, `FoundNorm`, `BuildMeta` |
| `frontend/src/features/drafts/doc.tsx` | `useSectionBuild.attach`, `onPartial`, стадии; `useDraftDoc.setTree` |
| `frontend/src/features/drafts/BuildStage.tsx` (новый) | строка стадии с чипами норм |
| `frontend/src/features/drafts/Sheet.tsx` | `freshKeys`, `--i` на пунктах |
| `frontend/src/features/drafts/drafts.css` | каскад, занятый раздел оглавления, строка стадии |
| `frontend/src/features/laws/DocumentPage.tsx`, `frontend/src/features/contracts/DocumentPage.tsx` | подхват задачи, `BuildStage`, частичное дерево |
| `frontend/src/features/laws/concepts.ts` (новый) | типы ответа брифа, сборка значений, стадии ожидания |
| `frontend/src/features/laws/BriefPage.tsx` (новый) | экран брифа, ожидание, переключение на концепты, создание пакета |
| `frontend/src/features/laws/ConceptsScreen.tsx` (новый) | карточки, выбор, правка, смешивание, уточнения |
| `frontend/src/features/laws/laws.css` | стили `lb-*`, удаление стилей мастера |
| `frontend/src/app/routes.tsx` | `/laws/new` → `BriefPage` |
| `frontend/src/features/laws/WizardPage.tsx` | удаляется |

---

### Task 1: Поле «Ключевые положения» и справочник сфер

**Files:**
- Modify: `docengine/catalog/laws/law_project.yaml`
- Create: `docengine/brief.py`
- Test: `tests/test_brief_module.py`

**Interfaces:**
- Produces: `docengine.brief.DOMAINS: list[dict]` (`key`, `label: {ru,kk,en}`, `corpus: list[str]`, `ministry: {ru,kk,en}`), `domain(key) -> dict | None`, `domains_payload(lang) -> list[{key,label}]`, `example_brief(lang) -> {domain, text}`, `CORPUS_TITLES: frozenset[str]`.

- [ ] **Step 1: Написать падающие тесты**

```python
# tests/test_brief_module.py
"""
Модуль концептов законопроекта: сферы, схема концепта, сборка значений формы.

Без HTTP и без модели: здесь проверяется логика, которая не должна зависеть
от того, как её вызвали. Модель подменяется записывающей заглушкой.
"""

import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from docengine import brief  # noqa: E402
from docengine.passport import get_passport, load_catalog  # noqa: E402


@pytest.fixture(scope='module')
def catalog():
    return load_catalog()


def test_law_passport_has_key_provisions_field(catalog):
    """Новеллы концепта должны попасть в генерацию под человеческой подписью."""
    p = get_passport('law_project')
    f = next(f for f in p.fields if f.name == 'key_provisions')
    assert f.type == 'textarea'
    assert f.group == 'subject'
    assert not f.required
    assert f.example and '\n' in f.example.get('ru'), 'пример — по одному положению в строке'


def test_every_domain_points_at_real_corpus_titles():
    for d in brief.DOMAINS:
        for title in d['corpus']:
            assert title in brief.CORPUS_TITLES, f'{d["key"]}: «{title}» нет в корпусе'


def test_every_corpus_document_belongs_to_some_domain():
    covered = {t for d in brief.DOMAINS for t in d['corpus']}
    assert brief.CORPUS_TITLES <= covered, sorted(brief.CORPUS_TITLES - covered)


def test_domain_lookup_and_payload_language():
    assert brief.domain('labor')['corpus'] == ['Трудовой кодекс РК']
    assert brief.domain('nope') is None
    ru = {d['key']: d['label'] for d in brief.domains_payload('ru')}
    kk = {d['key']: d['label'] for d in brief.domains_payload('kk')}
    assert ru['labor'] != kk['labor']
    assert set(ru) == {d['key'] for d in brief.DOMAINS}


def test_example_brief_uses_a_known_domain_and_real_text():
    ex = brief.example_brief('ru')
    assert brief.domain(ex['domain']) is not None
    assert len(ex['text']) > 80
    assert brief.example_brief('kk')['text'] != ex['text']
```

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `python3 -m pytest tests/test_brief_module.py -q`
Expected: `ImportError: cannot import name 'brief'` (модуля нет).

- [ ] **Step 3: Добавить поле в паспорт**

```bash
python3 - <<'PY'
p='docengine/catalog/laws/law_project.yaml'
s=open(p,encoding='utf-8').read()
marker='  - name: target_audience\n'
assert s.count(marker)==1
field='''  - name: key_provisions
    label: {ru: Ключевые положения, kk: Негізгі ережелер, en: Key provisions}
    type: textarea
    group: subject
    hint:
      ru: По одному положению в строке — что именно закон вводит или меняет
    example:
      ru: |-
        Реестр операторов цифровых платформ юридической помощи ведёт Министерство юстиции
        Консультант платформы — юрист с высшим образованием и стажем не менее двух лет
        Оператор платформы отвечает за вред от некачественной консультации солидарно с консультантом
        Персональные данные обратившихся обрабатываются только для оказания помощи и удаляются по её завершении
      kk: |-
        Заң көмегінің цифрлық платформалары операторларының тізілімін Әділет министрлігі жүргізеді
        Платформа кеңесшісі — жоғары білімі және кемінде екі жыл өтілі бар заңгер
        Платформа операторы сапасыз кеңестен келген зиян үшін кеңесшімен бірге ортақ жауап береді
        Өтініш білдірушілердің дербес деректері көмек көрсету үшін ғана өңделеді және ол аяқталғанда жойылады
'''
s=s.replace(marker, field+marker, 1)
open(p,'w',encoding='utf-8').write(s)
print('поле добавлено')
PY
```

- [ ] **Step 4: Создать модуль со справочником сфер**

```python
# docengine/brief.py
"""
Концепты законопроекта по брифу.

Человек даёт контекст — пару фраз, файлы, сферу, — а модель предлагает три
разных законопроекта целиком. Выбранный концепт становится значениями формы
паспорта: дальше документ составляется тем же обработчиком, что и из формы,
и ничем от неё не отличается.

Сфера нужна поиску: корпус — двадцать актов, и запрос «ответственность за
некачественную консультацию» без подсказки, в каком кодексе искать, приносит
уголовную ответственность вместо гражданской. Фильтра по документам у
поисковика нет, поэтому названия актов сферы просто входят в текст запроса.
"""
from __future__ import annotations

# Названия документов корпуса — как в scripts/load_legal_docs.py и таблице
# documents. Проверяется тестом: сфера, указывающая на несуществующий акт,
# молча ничего не находит.
CORPUS_TITLES = frozenset({
    'Конституция Республики Казахстан',
    'Гражданский кодекс РК (Общая часть)',
    'Гражданский кодекс РК (Особенная часть)',
    'Земельный кодекс РК',
    'Кодекс РК «О браке (супружестве) и семье»',
    'Уголовный кодекс РК',
    'Уголовно-процессуальный кодекс РК',
    'Кодекс РК об административных правонарушениях',
    'Предпринимательский кодекс РК',
    'Гражданский процессуальный кодекс РК',
    'Трудовой кодекс РК',
    'Административный процедурно-процессуальный кодекс РК',
    'Экологический кодекс РК',
    'Бюджетный кодекс РК',
    'Налоговый кодекс РК',
    'Закон РК «О правовых актах»',
    'Закон РК «О нормативных правовых актах»',
    'Конституционный закон РК «О судебной системе и статусе судей»',
    'Конституционный закон РК «О Конституционном Суде»',
    'Конституционный закон РК «О прокуратуре»',
})

DOMAINS: list[dict] = [
    {
        'key': 'civil',
        'label': {'ru': 'Гражданское право и договоры', 'kk': 'Азаматтық құқық және шарттар', 'en': 'Civil law and contracts'},
        'corpus': ['Гражданский кодекс РК (Общая часть)', 'Гражданский кодекс РК (Особенная часть)', 'Гражданский процессуальный кодекс РК'],
        'ministry': {'ru': 'Министерство юстиции Республики Казахстан', 'kk': 'Қазақстан Республикасының Әділет министрлігі', 'en': 'Ministry of Justice of the Republic of Kazakhstan'},
    },
    {
        'key': 'labor',
        'label': {'ru': 'Труд и занятость', 'kk': 'Еңбек және жұмыспен қамту', 'en': 'Labour and employment'},
        'corpus': ['Трудовой кодекс РК'],
        'ministry': {'ru': 'Министерство труда и социальной защиты населения Республики Казахстан', 'kk': 'Қазақстан Республикасының Еңбек және халықты әлеуметтік қорғау министрлігі', 'en': 'Ministry of Labour and Social Protection of the Republic of Kazakhstan'},
    },
    {
        'key': 'tax_budget',
        'label': {'ru': 'Налоги и бюджет', 'kk': 'Салықтар және бюджет', 'en': 'Taxes and budget'},
        'corpus': ['Налоговый кодекс РК', 'Бюджетный кодекс РК'],
        'ministry': {'ru': 'Министерство финансов Республики Казахстан', 'kk': 'Қазақстан Республикасының Қаржы министрлігі', 'en': 'Ministry of Finance of the Republic of Kazakhstan'},
    },
    {
        'key': 'business',
        'label': {'ru': 'Предпринимательство', 'kk': 'Кәсіпкерлік', 'en': 'Entrepreneurship'},
        'corpus': ['Предпринимательский кодекс РК'],
        'ministry': {'ru': 'Министерство национальной экономики Республики Казахстан', 'kk': 'Қазақстан Республикасының Ұлттық экономика министрлігі', 'en': 'Ministry of National Economy of the Republic of Kazakhstan'},
    },
    {
        'key': 'admin',
        'label': {'ru': 'Административные процедуры и ответственность', 'kk': 'Әкімшілік рәсімдер және жауапкершілік', 'en': 'Administrative procedure and liability'},
        'corpus': ['Административный процедурно-процессуальный кодекс РК', 'Кодекс РК об административных правонарушениях'],
        'ministry': {'ru': 'Министерство юстиции Республики Казахстан', 'kk': 'Қазақстан Республикасының Әділет министрлігі', 'en': 'Ministry of Justice of the Republic of Kazakhstan'},
    },
    {
        'key': 'criminal',
        'label': {'ru': 'Уголовное право и процесс', 'kk': 'Қылмыстық құқық және процесс', 'en': 'Criminal law and procedure'},
        'corpus': ['Уголовный кодекс РК', 'Уголовно-процессуальный кодекс РК'],
        'ministry': {'ru': 'Министерство внутренних дел Республики Казахстан', 'kk': 'Қазақстан Республикасының Ішкі істер министрлігі', 'en': 'Ministry of Internal Affairs of the Republic of Kazakhstan'},
    },
    {
        'key': 'family',
        'label': {'ru': 'Семья и брак', 'kk': 'Отбасы және неке', 'en': 'Family and marriage'},
        'corpus': ['Кодекс РК «О браке (супружестве) и семье»'],
        'ministry': {'ru': 'Министерство просвещения Республики Казахстан', 'kk': 'Қазақстан Республикасының Оқу-ағарту министрлігі', 'en': 'Ministry of Education of the Republic of Kazakhstan'},
    },
    {
        'key': 'land_eco',
        'label': {'ru': 'Земля и экология', 'kk': 'Жер және экология', 'en': 'Land and environment'},
        'corpus': ['Земельный кодекс РК', 'Экологический кодекс РК'],
        'ministry': {'ru': 'Министерство экологии и природных ресурсов Республики Казахстан', 'kk': 'Қазақстан Республикасының Экология және табиғи ресурстар министрлігі', 'en': 'Ministry of Ecology and Natural Resources of the Republic of Kazakhstan'},
    },
    {
        'key': 'justice',
        'label': {'ru': 'Судебная система и правовые акты', 'kk': 'Сот жүйесі және құқықтық актілер', 'en': 'Judiciary and legal acts'},
        'corpus': [
            'Конституционный закон РК «О судебной системе и статусе судей»',
            'Конституционный закон РК «О Конституционном Суде»',
            'Конституционный закон РК «О прокуратуре»',
            'Закон РК «О правовых актах»',
            'Закон РК «О нормативных правовых актах»',
        ],
        'ministry': {'ru': 'Министерство юстиции Республики Казахстан', 'kk': 'Қазақстан Республикасының Әділет министрлігі', 'en': 'Ministry of Justice of the Republic of Kazakhstan'},
    },
    {
        'key': 'constitution',
        'label': {'ru': 'Конституционные основы', 'kk': 'Конституциялық негіздер', 'en': 'Constitutional foundations'},
        'corpus': ['Конституция Республики Казахстан'],
        'ministry': {'ru': 'Министерство юстиции Республики Казахстан', 'kk': 'Қазақстан Республикасының Әділет министрлігі', 'en': 'Ministry of Justice of the Republic of Kazakhstan'},
    },
]

EXAMPLE_BRIEF = {
    'domain': 'civil',
    'text': {
        'ru': 'Юридическую помощь всё чаще оказывают через онлайн-платформы, но их статус '
              'законом не определён: нет требований к квалификации консультантов, '
              'ответственности оператора за качество совета и правил обработки персональных '
              'данных обратившихся. Нужен закон, который даст платформам статус, введёт '
              'реестр операторов и защитит граждан.',
        'kk': 'Заң көмегі көбіне онлайн-платформалар арқылы көрсетіледі, бірақ олардың мәртебесі '
              'заңмен айқындалмаған: кеңесшілердің біліктілігіне талап, оператордың кеңес сапасы '
              'үшін жауапкершілігі және дербес деректерді өңдеу қағидалары жоқ. Платформаларға '
              'мәртебе беретін, операторлар тізілімін енгізетін және азаматтарды қорғайтын заң қажет.',
        'en': 'Legal help is increasingly delivered through online platforms whose status is '
              'undefined in law: no qualification requirements for advisers, no operator '
              'liability for the quality of advice, no rules on the personal data of those who '
              'seek help. A law is needed to give platforms a status, introduce a register of '
              'operators and protect citizens.',
    },
}


def _lang(lang: str) -> str:
    return lang if lang in ('ru', 'kk', 'en') else 'ru'


def domain(key: str) -> dict | None:
    return next((d for d in DOMAINS if d['key'] == key), None)


def domains_payload(lang: str) -> list[dict]:
    lang = _lang(lang)
    return [{'key': d['key'], 'label': d['label'][lang]} for d in DOMAINS]


def example_brief(lang: str) -> dict:
    lang = _lang(lang)
    return {'domain': EXAMPLE_BRIEF['domain'], 'text': EXAMPLE_BRIEF['text'][lang]}
```

- [ ] **Step 5: Прогнать тесты**

Run: `python3 -m pytest tests/test_brief_module.py -q`
Expected: `5 passed`.

Run: `python3 -m pytest tests/test_demo_values.py -q`
Expected: все зелёные — новое поле необязательное и с примером, кнопка «Заполнить примером» его подхватит.

- [ ] **Step 6: Закоммитить**

```bash
git add docengine/catalog/laws/law_project.yaml docengine/brief.py tests/test_brief_module.py
git commit -m "$(cat <<'EOF'
feat(brief): поле «Ключевые положения» и справочник сфер законопроекта

Сфера направляет поиск по корпусу — без неё запрос про ответственность
за консультацию приносит уголовные нормы вместо гражданских. Названия
актов сферы проверяются тестом против корпуса. Ключевые новеллы концепта
получают своё поле в паспорте, чтобы попадать в разделы под подписью.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Схема концепта, значения формы и уточнения

**Files:**
- Modify: `docengine/brief.py`
- Test: `tests/test_brief_module.py`

**Interfaces:**
- Consumes: `docengine.passport.Passport`, `docengine.schema.Ref`.
- Produces: `Concept(BaseModel)` с полями `title_ru, title_kz, summary, problem_description, goals: list[str], target_audience, current_legislation_gaps, constitutional_basis, key_provisions: list[str], refs: list[Ref]` и методом `to_values(passport) -> dict[str, str]`; `BriefResult(BaseModel)` с `concepts: list[Concept]` (2–3 штуки); `clarifications_payload(passport, lang, domain_key) -> dict`; `BUDGET_CHIPS`, `TIMELINE_CHIPS`.

- [ ] **Step 1: Написать падающие тесты**

Дописать в `tests/test_brief_module.py`:

```python
# ------------------------------------------------------------ концепт → форма


def _concept(**over):
    base = dict(
        title_ru='О цифровых платформах оказания юридической помощи',
        title_kz='Заң көмегін көрсетудің цифрлық платформалары туралы',
        summary='Статус платформ, реестр операторов, защита данных.',
        problem_description='Платформы работают вне правового поля.',
        goals=['Закрепить статус платформ', 'Ввести реестр операторов'],
        target_audience='Граждане, операторы платформ',
        current_legislation_gaps='Закон об адвокатской деятельности не знает платформ.',
        constitutional_basis='Статья 13 Конституции РК',
        key_provisions=['Реестр ведёт Минюст', 'Оператор отвечает солидарно'],
        refs=[{'act': 'Конституция РК', 'article': '13', 'note': None}],
    )
    base.update(over)
    return brief.Concept(**base)


def test_concept_lists_become_one_item_per_line(catalog):
    values = _concept().to_values(get_passport('law_project'))
    assert values['goals'] == 'Закрепить статус платформ\nВвести реестр операторов'
    assert values['key_provisions'] == 'Реестр ведёт Минюст\nОператор отвечает солидарно'
    assert values['title_ru'].startswith('О цифровых')


def test_concept_values_contain_only_passport_fields(catalog):
    """summary и refs — для карточки, не для формы: в паспорте таких полей нет."""
    values = _concept().to_values(get_passport('law_project'))
    names = {f.name for f in get_passport('law_project').fields}
    assert set(values) <= names
    assert 'summary' not in values and 'refs' not in values


def test_concept_refs_are_never_marked_verified():
    c = _concept(refs=[{'act': 'ГК РК', 'article': '178', 'note': None, 'verified': True}])
    assert all(not r.verified for r in c.refs), 'ссылка из ответа модели не выверена по корпусу'


def test_brief_result_needs_at_least_two_concepts_and_keeps_three():
    one = {'concepts': [_concept().model_dump()]}
    with pytest.raises(Exception):
        brief.BriefResult(**one)
    four = {'concepts': [_concept(title_ru=f'О законе № {i}').model_dump() for i in range(4)]}
    assert len(brief.BriefResult(**four).concepts) == 3


# --------------------------------------------------------------- уточнения


def test_clarifications_cover_the_required_fields_the_concept_lacks(catalog):
    p = get_passport('law_project')
    c = brief.clarifications_payload(p, 'ru', 'labor')
    covered = set(_concept().to_values(p)) | set(c)
    required = {f.name for f in p.fields if f.required}
    assert required <= covered, sorted(required - covered)


def test_clarification_options_come_from_the_passport(catalog):
    c = brief.clarifications_payload(get_passport('law_project'), 'ru', 'labor')
    assert c['initiator_type']['kind'] == 'options'
    assert {o['value'] for o in c['initiator_type']['options']} == {'deputy', 'government', 'ministry'}


def test_initiator_suggestions_follow_the_domain(catalog):
    labor = brief.clarifications_payload(get_passport('law_project'), 'ru', 'labor')['initiator']
    tax = brief.clarifications_payload(get_passport('law_project'), 'ru', 'tax_budget')['initiator']
    assert labor['kind'] == 'text'
    assert 'труда' in labor['suggestions'][0]
    assert 'финансов' in tax['suggestions'][0]
    assert labor['suggestions'][1:] == tax['suggestions'][1:], 'общие подсказки одинаковы для всех сфер'


def test_budget_and_timeline_chips_expand_into_real_sentences(catalog):
    c = brief.clarifications_payload(get_passport('law_project'), 'ru', 'civil')
    budget = {ch['key']: ch for ch in c['budget_impact']['chips']}
    assert budget['none']['value'].startswith('Принятие закона не требует')
    assert len(budget['funding']['value']) > 60
    timeline = {ch['key']: ch['value'] for ch in c['implementation_timeline']['chips']}
    assert 'десяти' in timeline['ten_days']
    kk = brief.clarifications_payload(get_passport('law_project'), 'kk', 'civil')
    assert kk['budget_impact']['chips'][0]['label'] != c['budget_impact']['chips'][0]['label']
```

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `python3 -m pytest tests/test_brief_module.py -q`
Expected: падения с `AttributeError: module 'docengine.brief' has no attribute 'Concept'`.

- [ ] **Step 3: Реализовать схему и уточнения**

Дописать в `docengine/brief.py` (после `example_brief`):

```python
from pydantic import BaseModel, Field, field_validator  # noqa: E402  (импорт вверху файла)

from .passport import Passport  # noqa: E402
from .schema import Ref  # noqa: E402


class Concept(BaseModel):
    """Один вариант законопроекта — то, что помещается в карточку."""

    title_ru: str
    title_kz: str = ''
    summary: str = ''
    problem_description: str
    goals: list[str] = Field(default_factory=list)
    target_audience: str = ''
    current_legislation_gaps: str = ''
    constitutional_basis: str = ''
    key_provisions: list[str] = Field(default_factory=list)
    refs: list[Ref] = Field(default_factory=list)

    @field_validator('refs')
    @classmethod
    def _unverified(cls, refs: list[Ref]) -> list[Ref]:
        # Модель охотно ставит verified=true; выверка — дело проверки по корпусу.
        for r in refs:
            r.verified = False
        return refs

    def to_values(self, passport: Passport) -> dict[str, str]:
        """Поля формы паспорта. Списки — по одному пункту в строке, как просит паспорт."""
        raw = {
            'title_ru': self.title_ru,
            'title_kz': self.title_kz,
            'problem_description': self.problem_description,
            'goals': '\n'.join(g.strip() for g in self.goals if g.strip()),
            'target_audience': self.target_audience,
            'current_legislation_gaps': self.current_legislation_gaps,
            'constitutional_basis': self.constitutional_basis,
            'key_provisions': '\n'.join(k.strip() for k in self.key_provisions if k.strip()),
        }
        known = {f.name for f in passport.fields}
        return {k: v.strip() for k, v in raw.items() if k in known and v and v.strip()}


class BriefResult(BaseModel):
    concepts: list[Concept]

    @field_validator('concepts')
    @classmethod
    def _two_to_three(cls, concepts: list[Concept]) -> list[Concept]:
        # Один вариант — не выбор; больше трёх — не помещается в экран и в внимание.
        if len(concepts) < 2:
            raise ValueError('нужно не меньше двух вариантов')
        return concepts[:3]


# Уточнения — поля паспорта, которых в концепте нет: их проще выбрать, чем
# сочинять. Чипы разворачиваются в готовые абзацы, чтобы форма прошла проверку
# обязательных полей без набора текста.
TIMELINE_CHIPS = [
    {
        'key': 'ten_days',
        'label': {'ru': 'Через 10 дней', 'kk': '10 күннен кейін', 'en': 'After 10 days'},
        'value': {
            'ru': 'По истечении десяти календарных дней после дня первого официального опубликования',
            'kk': 'Алғашқы ресми жарияланған күнінен кейін күнтізбелік он күн өткен соң',
            'en': 'Ten calendar days after the date of first official publication',
        },
    },
    {
        'key': 'six_months',
        'label': {'ru': 'Через 6 месяцев', 'kk': '6 айдан кейін', 'en': 'After 6 months'},
        'value': {
            'ru': 'По истечении шести месяцев после дня первого официального опубликования',
            'kk': 'Алғашқы ресми жарияланған күнінен кейін алты ай өткен соң',
            'en': 'Six months after the date of first official publication',
        },
    },
    {
        'key': 'next_year',
        'label': {'ru': 'С 1 января', 'kk': '1 қаңтардан', 'en': 'From 1 January'},
        'value': {
            'ru': 'С 1 января года, следующего за годом первого официального опубликования',
            'kk': 'Алғашқы ресми жарияланған жылдан кейінгі жылдың 1 қаңтарынан бастап',
            'en': 'From 1 January of the year following the year of first official publication',
        },
    },
]

BUDGET_CHIPS = [
    {
        'key': 'none',
        'label': {'ru': 'Без дополнительных расходов', 'kk': 'Қосымша шығыссыз', 'en': 'No additional expenditure'},
        'value': {
            'ru': 'Принятие закона не требует дополнительных расходов республиканского и местных бюджетов: '
                  'возлагаемые функции исполняются в пределах штатной численности и бюджетных средств, '
                  'предусмотренных уполномоченным органам на текущий год.',
            'kk': 'Заңның қабылдануы республикалық және жергілікті бюджеттерден қосымша шығыстарды талап '
                  'етпейді: жүктелетін функциялар уәкілетті органдарға ағымдағы жылға көзделген штат саны '
                  'мен бюджет қаражаты шегінде орындалады.',
            'en': 'The law requires no additional expenditure from the republican or local budgets: the '
                  'functions assigned are performed within existing staffing and the funds allocated to '
                  'the authorised bodies for the current year.',
        },
    },
    {
        'key': 'within',
        'label': {'ru': 'В пределах утверждённого бюджета', 'kk': 'Бекітілген бюджет шегінде', 'en': 'Within the approved budget'},
        'value': {
            'ru': 'Реализация закона обеспечивается перераспределением средств в пределах бюджетных '
                  'программ уполномоченного органа, утверждённых на плановый период; дополнительных '
                  'ассигнований не требуется. Ожидается экономия за счёт сокращения дублирующих процедур.',
            'kk': 'Заңды іске асыру уәкілетті органның жоспарлы кезеңге бекітілген бюджеттік бағдарламалары '
                  'шегінде қаражатты қайта бөлумен қамтамасыз етіледі; қосымша қаржы бөлу талап етілмейді.',
            'en': 'The law is implemented by reallocating funds within the authorised body’s budget '
                  'programmes approved for the planning period; no additional appropriations are required.',
        },
    },
    {
        'key': 'funding',
        'label': {'ru': 'Требуется финансирование', 'kk': 'Қаржыландыру қажет', 'en': 'Funding required'},
        'value': {
            'ru': 'Реализация закона потребует дополнительных расходов республиканского бюджета на создание '
                  'и сопровождение информационной системы и администрирование новых процедур. Объём '
                  'расходов и источники финансирования подлежат уточнению при формировании республиканского '
                  'бюджета на плановый период с учётом заключения уполномоченного органа по бюджетному '
                  'планированию.',
            'kk': 'Заңды іске асыру ақпараттық жүйені құруға және сүйемелдеуге, жаңа рәсімдерді әкімшілендіруге '
                  'республикалық бюджеттен қосымша шығыстарды талап етеді. Шығыстар көлемі мен қаржыландыру '
                  'көздері жоспарлы кезеңге республикалық бюджетті қалыптастыру кезінде нақтыланады.',
            'en': 'Implementing the law will require additional republican budget expenditure for building '
                  'and maintaining an information system and administering the new procedures. The amount '
                  'and funding sources are to be specified when the republican budget for the planning '
                  'period is drawn up.',
        },
    },
]

GENERIC_INITIATORS = {
    'ru': ['Правительство Республики Казахстан', 'Депутаты Мажилиса Парламента Республики Казахстан'],
    'kk': ['Қазақстан Республикасының Үкіметі', 'Қазақстан Республикасы Парламенті Мәжілісінің депутаттары'],
    'en': ['Government of the Republic of Kazakhstan', 'Members of the Mazhilis of the Parliament of the Republic of Kazakhstan'],
}


def _chips(chips: list[dict], lang: str) -> list[dict]:
    return [{'key': c['key'], 'label': c['label'][lang], 'value': c['value'][lang]} for c in chips]


def clarifications_payload(passport: Passport, lang: str, domain_key: str) -> dict:
    """Что спросить после выбора концепта, чтобы форма была полной."""
    lang = _lang(lang)
    fields = {f.name: f for f in passport.fields}
    out: dict = {}

    if 'initiator_type' in fields:
        out['initiator_type'] = {
            'kind': 'options',
            'options': [{'value': o.value, 'label': o.label.get(lang)} for o in fields['initiator_type'].options],
        }
    if 'initiator' in fields:
        d = domain(domain_key)
        first = [d['ministry'][lang]] if d else []
        out['initiator'] = {'kind': 'text', 'suggestions': first + GENERIC_INITIATORS[lang]}
    if 'implementation_timeline' in fields:
        out['implementation_timeline'] = {'kind': 'chips', 'chips': _chips(TIMELINE_CHIPS, lang)}
    if 'budget_impact' in fields:
        out['budget_impact'] = {'kind': 'chips', 'chips': _chips(BUDGET_CHIPS, lang)}
    return out
```

Импорты `pydantic`, `Passport`, `Ref` перенести в начало файла (после докстринга), убрав пометки `noqa`.

- [ ] **Step 4: Прогнать тесты**

Run: `python3 -m pytest tests/test_brief_module.py -q`
Expected: `13 passed`.

- [ ] **Step 5: Закоммитить**

```bash
git add docengine/brief.py tests/test_brief_module.py
git commit -m "$(cat <<'EOF'
feat(brief): схема концепта, значения формы и уточнения чипами

Концепт — то, что помещается в карточку; to_values превращает его в поля
паспорта, списки — по пункту в строке. Уточнения закрывают обязательные
поля, которых в концепте нет: тип и имя инициатора, срок введения, бюджет.
Чипы разворачиваются в готовые абзацы, чтобы форма проходила проверку без
набора текста.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Запрос концептов у модели

**Files:**
- Modify: `docengine/brief.py`, `docengine/generate.py`
- Test: `tests/test_brief_module.py`

**Interfaces:**
- Consumes: `docengine.generate._ask_json(provider, messages, model_cls, *, temperature, max_tokens, what)`, `GenerationError`; `retriever.hybrid_search(query, top_k) -> list[dict{title, content}]`.
- Produces: `docengine.generate._retrieve_chunks(retriever, query, top_k=4) -> list[dict{title, article, content}]`, `_context_text(chunks) -> str`, `found_norms(chunks) -> list[dict{title, article}]`; `docengine.brief.brief_query(text, domain_key, attachments) -> str`, `propose_concepts(provider, retriever, passport, *, text, domain_key, attachments, lang, avoid=()) -> BriefResult`. Прежний `_retrieve(retriever, query, top_k)` остаётся обёрткой над новыми функциями.

- [ ] **Step 1: Написать падающие тесты**

Дописать в `tests/test_brief_module.py`:

```python
# ------------------------------------------------------- запрос концептов

import json


class FakeProvider:
    """Отдаёт заготовленные ответы по очереди и запоминает, о чём спросили."""

    def __init__(self, *replies):
        self.replies = list(replies)
        self.calls = []

    def chat_completion(self, messages, **kw):
        self.calls.append(messages)
        return {'content': self.replies.pop(0) if self.replies else '{}'}


class FakeRetriever:
    def __init__(self):
        self.queries = []

    def hybrid_search(self, query, top_k=4):
        self.queries.append(query)
        return [
            {'title': 'Конституция Республики Казахстан',
             'content': 'Статья 13. Каждый имеет право на получение квалифицированной юридической помощи.'},
            {'title': 'Гражданский кодекс РК (Общая часть)',
             'content': 'Статья 178. Общий срок исковой давности устанавливается в три года.'},
        ]


def _two_concepts_json(**over):
    c = _concept(**over).model_dump(mode='json')
    d = _concept(title_ru='О реестре операторов юридических платформ').model_dump(mode='json')
    return json.dumps({'concepts': [c, d]}, ensure_ascii=False)


def test_concepts_come_from_the_model(catalog):
    provider = FakeProvider(_two_concepts_json())
    result = brief.propose_concepts(
        provider, FakeRetriever(), get_passport('law_project'),
        text='платформы юридической помощи', domain_key='civil', attachments=[], lang='ru',
    )
    assert len(result.concepts) == 2
    assert result.concepts[1].title_ru.startswith('О реестре')
    assert len(provider.calls) == 1


def test_brief_and_domain_documents_drive_the_corpus_search(catalog):
    retriever = FakeRetriever()
    brief.propose_concepts(
        FakeProvider(_two_concepts_json()), retriever, get_passport('law_project'),
        text='ответственность консультанта', domain_key='civil',
        attachments=[{'filename': 'записка.pdf', 'text': 'Обзор рынка онлайн-консультаций'}], lang='ru',
    )
    q = retriever.queries[0]
    assert 'Гражданский кодекс РК' in q
    assert 'ответственность консультанта' in q
    assert 'Обзор рынка' in q


def test_prompt_carries_brief_files_norms_and_avoid_list(catalog):
    provider = FakeProvider(_two_concepts_json())
    brief.propose_concepts(
        provider, FakeRetriever(), get_passport('law_project'),
        text='платформы', domain_key='civil',
        attachments=[{'filename': 'записка.pdf', 'text': 'текст записки'}], lang='ru',
        avoid=['О цифровых платформах оказания юридической помощи'],
    )
    prompt = ' '.join(m['content'] for m in provider.calls[0])
    assert 'платформы' in prompt
    assert 'записка.pdf' in prompt and 'текст записки' in prompt
    assert 'Статья 13' in prompt, 'нормы из корпуса должны быть перед глазами модели'
    assert 'О цифровых платформах оказания юридической помощи' in prompt
    assert 'не повторя' in prompt.lower()


def test_refs_outside_the_corpus_context_are_dropped(catalog):
    invented = _two_concepts_json(refs=[
        {'act': 'Конституция РК', 'article': '13', 'note': None},
        {'act': 'ГК РК', 'article': '999', 'note': None},
    ])
    result = brief.propose_concepts(
        FakeProvider(invented), FakeRetriever(), get_passport('law_project'),
        text='платформы', domain_key='civil', attachments=[], lang='ru',
    )
    articles = [r.article for r in result.concepts[0].refs]
    assert articles == ['13'], 'статья 999 в корпусе не найдена — ссылка выдумана'


def test_garbage_twice_raises_generation_error(catalog):
    from docengine.generate import GenerationError
    with pytest.raises(GenerationError):
        brief.propose_concepts(
            FakeProvider('мусор', 'снова мусор'), FakeRetriever(), get_passport('law_project'),
            text='платформы', domain_key='civil', attachments=[], lang='ru',
        )


def test_attachment_text_is_capped(catalog):
    provider = FakeProvider(_two_concepts_json())
    brief.propose_concepts(
        provider, FakeRetriever(), get_passport('law_project'),
        text='', domain_key='civil',
        attachments=[{'filename': 'big.pdf', 'text': 'x' * 20000}], lang='ru',
    )
    prompt = ' '.join(m['content'] for m in provider.calls[0])
    assert prompt.count('x') <= 8000 + 100


# ------------------------------------------------------------- generate.py


def test_retrieve_chunks_extract_article_numbers():
    from docengine.generate import _retrieve_chunks, found_norms
    chunks = _retrieve_chunks(FakeRetriever(), 'что угодно', top_k=2)
    assert [c['article'] for c in chunks] == ['13', '178']
    assert found_norms(chunks) == [
        {'title': 'Конституция Республики Казахстан', 'article': '13'},
        {'title': 'Гражданский кодекс РК (Общая часть)', 'article': '178'},
    ]


def test_retrieve_text_contract_is_unchanged():
    from docengine.generate import _retrieve
    text = _retrieve(FakeRetriever(), 'что угодно', top_k=2)
    assert text.startswith('[Конституция Республики Казахстан]\nСтатья 13.')
    assert _retrieve(None, 'что угодно') == ''
```

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `python3 -m pytest tests/test_brief_module.py -q`
Expected: падения с `AttributeError: ... 'propose_concepts'` и `ImportError: cannot import name '_retrieve_chunks'`.

- [ ] **Step 3: Разложить поиск норм на части в `generate.py`**

Заменить функцию `_retrieve` в `docengine/generate.py` (строка ~270) на:

```python
# Номер статьи из текста фрагмента. Близнец этой регулярки живёт в
# rag/generator.py: движок документов не тянет модуль чата ради трёх строк.
_ARTICLE_RE = re.compile(r'Статья\s+(\d+(?:-\d+)*)')


def _retrieve_chunks(retriever, query: str, top_k: int = 4) -> list[dict]:
    """Фрагменты корпуса под запрос: название акта, номер статьи, текст.

    Ошибка поиска не рушит генерацию — раздел пишется без норм, и это видно
    по пустому списку найденного.
    """
    if retriever is None:
        return []
    try:
        results = retriever.hybrid_search(query, top_k=top_k) or []
    except Exception:
        return []
    chunks: list[dict] = []
    for r in results:
        if not isinstance(r, dict):
            continue
        content = r.get('content') or ''
        if not content:
            continue
        m = _ARTICLE_RE.search(content)
        chunks.append({
            'title': r.get('title', ''),
            'article': m.group(1) if m else '',
            'content': content[:900],
        })
    return chunks


def _context_text(chunks: list[dict]) -> str:
    """Фрагменты — в блок промпта: заголовок акта в скобках, ниже текст."""
    return '\n\n'.join(f'[{c["title"]}]\n{c["content"]}' for c in chunks)


def found_norms(chunks: list[dict]) -> list[dict]:
    """Что нашлось — для строки хода генерации: акт и статья, без повторов."""
    out: list[dict] = []
    seen: set[tuple[str, str]] = set()
    for c in chunks:
        key = (c['title'], c['article'])
        if key in seen:
            continue
        seen.add(key)
        out.append({'title': c['title'], 'article': c['article']})
    return out


def _retrieve(retriever, query: str, top_k: int = 4) -> str:
    """Правовой контекст под конкретный раздел — прежний контракт, текстом."""
    return _context_text(_retrieve_chunks(retriever, query, top_k))
```

- [ ] **Step 4: Реализовать запрос концептов**

Дописать в `docengine/brief.py`:

```python
import re  # в начало файла

from .generate import _ask_json, _context_text, _retrieve_chunks  # в начало файла

BRIEF_TEXT_LIMIT = 4000
ATTACHMENT_LIMIT = 8000
ATTACHMENTS_LIMIT = 5

LANG_NAME = {'ru': 'русском', 'kk': 'казахском', 'en': 'английском'}

CONCEPTS_SCHEMA = (
    '{"concepts":[{"title_ru":"О …","title_kz":"… туралы","summary":"одна фраза сути",'
    '"problem_description":"…","goals":["…","…"],"target_audience":"…",'
    '"current_legislation_gaps":"…","constitutional_basis":"…",'
    '"key_provisions":["…","…","…"],"refs":[{"act":"ГК РК","article":"178","note":null}]}]}'
)


def _clip_attachments(attachments: list[dict]) -> list[dict]:
    out = []
    for a in (attachments or [])[:ATTACHMENTS_LIMIT]:
        text = str(a.get('text') or '')[:ATTACHMENT_LIMIT]
        if text.strip():
            out.append({'filename': str(a.get('filename') or 'файл'), 'text': text})
    return out


def brief_query(text: str, domain_key: str, attachments: list[dict]) -> str:
    """Запрос в корпус: акты сферы, бриф и начало каждого файла."""
    d = domain(domain_key)
    parts = [' '.join(d['corpus']) if d else '', (text or '')[:1000]]
    parts += [a['text'][:500] for a in _clip_attachments(attachments)]
    return ' '.join(p for p in parts if p).strip()


def _keep_only_context_refs(concepts: list[Concept], context: str) -> None:
    """Ссылка остаётся, если её статья есть среди найденных фрагментов.

    Модель охотно дописывает правдоподобные номера статей; выдуманная ссылка
    в карточке хуже отсутствующей — её примут за проверенную.
    """
    for c in concepts:
        c.refs = [r for r in c.refs if re.search(rf'Статья\s+{re.escape(r.article)}\b', context)]


def propose_concepts(
    provider,
    retriever,
    passport: Passport,
    *,
    text: str,
    domain_key: str,
    attachments: list[dict],
    lang: str,
    avoid: tuple[str, ...] | list[str] = (),
) -> BriefResult:
    """Три концепта законопроекта по брифу. Один вызов модели, строгий JSON."""
    lang = _lang(lang)
    text = (text or '')[:BRIEF_TEXT_LIMIT]
    files = _clip_attachments(attachments)
    d = domain(domain_key)

    chunks = _retrieve_chunks(retriever, brief_query(text, domain_key, files), top_k=12)
    context = _context_text(chunks)

    system = (
        'Ты — юрист-законопроектчик Республики Казахстан. По брифу предлагаешь три РАЗНЫХ '
        'концепции законопроекта: разные подходы к решению, а не перефразировки одного.\n'
        f'Тексты пиши на {LANG_NAME[lang]} языке; title_ru всегда на русском, title_kz — на казахском.\n'
        'Возвращай ТОЛЬКО JSON по схеме, без markdown и без ```:\n'
        f'{CONCEPTS_SCHEMA}\n'
        'Правила:\n'
        '- title_ru — как заголовок закона, начинается с «О …» или «Об …», без слова «проект».\n'
        '- Каждая концепция опирается на бриф и материалы; не выдумывай фактов, которых там нет.\n'
        '- goals — 2–4 цели, key_provisions — 3–5 новелл, каждая одним предложением.\n'
        '- refs — только нормы из блока НОРМЫ ИЗ КОРПУСА; нет подходящей — пустой список.\n'
        '- summary — одна фраза, по которой варианты различают с первого взгляда.'
    )
    user_parts = [
        f'СФЕРА: {d["label"]["ru"]} (акты: {", ".join(d["corpus"])})' if d else 'СФЕРА: не указана',
        f'БРИФ:\n{text.strip() or "— (сформулируй по сфере и материалам)"}',
    ]
    if files:
        user_parts.append('МАТЕРИАЛЫ:\n' + '\n\n'.join(f'--- {f["filename"]} ---\n{f["text"]}' for f in files))
    if avoid:
        user_parts.append('УЖЕ ПРЕДЛОЖЕНО (не повторять эти подходы):\n' + '\n'.join(f'- {t}' for t in avoid))
    user_parts.append('НОРМЫ ИЗ КОРПУСА:\n' + (context or '(ничего не найдено)'))
    user_parts.append('Верни только JSON по схеме.')

    result, _raw = _ask_json(
        provider,
        [{'role': 'system', 'content': system}, {'role': 'user', 'content': '\n\n'.join(user_parts)}],
        BriefResult,
        temperature=0.6,
        max_tokens=4000,
        what='концепты законопроекта',
    )
    _keep_only_context_refs(result.concepts, context)
    return result
```

- [ ] **Step 5: Прогнать тесты**

Run: `python3 -m pytest tests/test_brief_module.py tests/test_docengine.py tests/test_api_drafts.py -q`
Expected: все зелёные (`_retrieve` сохранил контракт — путь очереди не изменился).

- [ ] **Step 6: Закоммитить**

```bash
git add docengine/brief.py docengine/generate.py tests/test_brief_module.py
git commit -m "$(cat <<'EOF'
feat(brief): концепты законопроекта одним вызовом модели

Поиск по корпусу разложен на фрагменты с номерами статей и текст для
промпта: строке хода генерации нужны найденные нормы отдельно от текста.
Ссылки концепта остаются только на статьи из найденного — выдуманный номер
в карточке хуже пустого списка.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Ручки брифа и задача в ответе документа

**Files:**
- Modify: `blueprints/drafts/routes.py`
- Test: `tests/test_api_brief.py` (новый), `tests/test_api_drafts.py`

**Interfaces:**
- Consumes: `docengine.brief.domains_payload, example_brief, domain, propose_concepts, clarifications_payload`; `_lang`, `_err`, `current_user`, `log_usage`, `login_required`.
- Produces: `GET /api/drafts/brief/domains?lang=` → `{success, domains: [{key,label}], example: {domain, text}}`; `POST /api/drafts/brief` → `{success, concepts: [{…Concept, values}], clarifications}`; `GET /api/drafts/<id>` → поле `job` (незавершённая задача или `null`); `_usage_limited(action, limit) -> (over, left)`.

- [ ] **Step 1: Написать падающие тесты ручек брифа**

```python
# tests/test_api_brief.py
"""
Ручки брифа законопроекта.

Проверка по HTTP через настоящий blueprint: контракт с интерфейсом — это
формы запроса и ответа, а не питоновские вызовы. Модель и корпус заменены
заглушками, всё остальное — настоящее.
"""

import json
import os
import sys

import pytest
from flask import Flask

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


LAW_PASSPORT = {
    'id': 'law_demo',
    'kind': 'law_project',
    'name': {'ru': 'Проект закона Республики Казахстан'},
    'family': 'legislation',
    'summary': {'ru': 'Для проверки API'},
    'form': {'ru': 'пакет'},
    'legal_basis': [{'act': 'Конституция РК', 'article': '61'}],
    'parties': [],
    'fields': [
        {'name': 'title_ru', 'label': {'ru': 'Название'}, 'group': 'subject', 'required': True},
        {'name': 'initiator', 'label': {'ru': 'Инициатор'}, 'group': 'subject', 'required': True},
        {'name': 'initiator_type', 'label': {'ru': 'Тип'}, 'type': 'select', 'group': 'subject', 'required': True,
         'options': [{'value': 'deputy', 'label': {'ru': 'Депутат'}}, {'value': 'ministry', 'label': {'ru': 'Министерство'}}]},
        {'name': 'problem_description', 'label': {'ru': 'Проблема'}, 'type': 'textarea', 'group': 'subject', 'required': True},
        {'name': 'goals', 'label': {'ru': 'Цели'}, 'type': 'textarea', 'group': 'subject', 'required': True},
        {'name': 'key_provisions', 'label': {'ru': 'Положения'}, 'type': 'textarea', 'group': 'subject'},
        {'name': 'budget_impact', 'label': {'ru': 'Бюджет'}, 'type': 'textarea', 'group': 'terms', 'required': True},
        {'name': 'implementation_timeline', 'label': {'ru': 'Срок'}, 'group': 'extra'},
    ],
    'sections': [
        {'key': 'annotation', 'title': {'ru': 'Аннотация'}, 'guidance': {'ru': 'Кратко'}},
    ],
    'essential_terms': [],
}


@pytest.fixture
def catalog(tmp_path, monkeypatch):
    import docengine.passport as pp

    (tmp_path / 'laws').mkdir()
    (tmp_path / 'laws' / 'law_demo.yaml').write_text(json.dumps(LAW_PASSPORT, ensure_ascii=False), encoding='utf-8')
    monkeypatch.setattr(pp, 'CATALOG_DIR', tmp_path)
    pp.load_catalog.cache_clear()
    yield
    pp.load_catalog.cache_clear()


@pytest.fixture
def app(catalog):
    from database.models import User, db

    application = Flask(__name__)
    application.config.update(
        SQLALCHEMY_DATABASE_URI='sqlite://',
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
        SECRET_KEY='test',
        TESTING=True,
        LLM_PROVIDER=None,
        RAG_RETRIEVER=None,
    )
    db.init_app(application)

    from blueprints.auth import auth_bp
    from blueprints.drafts import drafts_bp

    application.register_blueprint(auth_bp)
    application.register_blueprint(drafts_bp)

    with application.app_context():
        db.create_all()
        user = User(email='jurist@example.kz', full_name='Тестовый юрист')
        user.set_password('x')
        db.session.add(user)
        db.session.commit()
        application.config['TEST_USER_ID'] = user.id
    return application


@pytest.fixture
def guest(app):
    return app.test_client()


@pytest.fixture
def client(app):
    c = app.test_client()
    with c.session_transaction() as s:
        s['user_id'] = app.config['TEST_USER_ID']
    return c


class ScriptedProvider:
    def __init__(self, *payloads):
        self.payloads = list(payloads)
        self.calls = []

    def chat_completion(self, messages, **kw):
        self.calls.append(messages)
        p = self.payloads.pop(0) if self.payloads else {}
        return {'content': p if isinstance(p, str) else json.dumps(p, ensure_ascii=False), 'model': 'stub'}


class FakeRetriever:
    def hybrid_search(self, query, top_k=4):
        return [{'title': 'Конституция Республики Казахстан',
                 'content': 'Статья 13. Каждый имеет право на получение квалифицированной юридической помощи.'}]


def _concept(title='О цифровых платформах юридической помощи'):
    return {
        'title_ru': title, 'title_kz': 'Заң көмегінің цифрлық платформалары туралы',
        'summary': 'Статус, реестр, защита данных.',
        'problem_description': 'Платформы вне правового поля.',
        'goals': ['Закрепить статус', 'Ввести реестр'],
        'target_audience': 'Граждане', 'current_legislation_gaps': 'Нет норм о платформах.',
        'constitutional_basis': 'Статья 13 Конституции РК',
        'key_provisions': ['Реестр ведёт Минюст'],
        'refs': [{'act': 'Конституция РК', 'article': '13', 'note': None},
                 {'act': 'ГК РК', 'article': '999', 'note': None}],
    }


CONCEPTS = {'concepts': [_concept(), _concept('О реестре операторов юридических платформ'),
                         _concept('О квалификации онлайн-консультантов')]}

BRIEF = {'type_id': 'law_demo', 'lang': 'ru', 'text': 'платформы юридической помощи', 'domain': 'civil',
         'attachments': [{'filename': 'записка.pdf', 'text': 'Обзор рынка'}]}


def test_domains_are_public_and_carry_an_example(guest):
    r = guest.get('/api/drafts/brief/domains?lang=ru')

    assert r.status_code == 200
    body = r.get_json()
    keys = {d['key'] for d in body['domains']}
    assert 'civil' in keys and 'labor' in keys
    assert body['example']['domain'] in keys
    assert len(body['example']['text']) > 50


def test_brief_returns_three_concepts_with_form_values(app, client):
    app.config['LLM_PROVIDER'] = ScriptedProvider(CONCEPTS)
    app.config['RAG_RETRIEVER'] = FakeRetriever()

    r = client.post('/api/drafts/brief', json=BRIEF)

    assert r.status_code == 200, r.get_json()
    body = r.get_json()
    assert len(body['concepts']) == 3
    first = body['concepts'][0]
    assert first['values']['title_ru'].startswith('О цифровых')
    assert first['values']['goals'] == 'Закрепить статус\nВвести реестр'
    assert first['values']['key_provisions'] == 'Реестр ведёт Минюст'
    # Выдуманная ст. 999 отсеяна, ст. 13 из корпуса осталась
    assert [ref['article'] for ref in first['refs']] == ['13']
    assert body['clarifications']['initiator_type']['kind'] == 'options'
    assert body['clarifications']['budget_impact']['chips']


def test_concept_values_plus_clarifications_make_the_form_complete(app, client):
    """Смысл всего режима: выбранный концепт и чипы дают форму, которую сервер примет."""
    app.config['LLM_PROVIDER'] = ScriptedProvider(CONCEPTS)
    body = client.post('/api/drafts/brief', json=BRIEF).get_json()
    values = dict(body['concepts'][0]['values'])
    cl = body['clarifications']
    values['initiator_type'] = cl['initiator_type']['options'][0]['value']
    values['initiator'] = cl['initiator']['suggestions'][0]
    values['budget_impact'] = cl['budget_impact']['chips'][0]['value']
    values['implementation_timeline'] = cl['implementation_timeline']['chips'][0]['value']

    required = {f['name'] for f in LAW_PASSPORT['fields'] if f.get('required')}
    assert required <= {k for k, v in values.items() if v}

    created = client.post('/api/drafts', json={'type_id': 'law_demo', 'lang': 'ru', 'values': values})
    assert created.status_code == 201, created.get_json()


def test_brief_requires_login(guest):
    assert guest.post('/api/drafts/brief', json=BRIEF).status_code == 401


def test_brief_rejects_unknown_domain_and_empty_input(app, client):
    app.config['LLM_PROVIDER'] = ScriptedProvider(CONCEPTS)
    bad = client.post('/api/drafts/brief', json={**BRIEF, 'domain': 'space'})
    assert bad.status_code == 400 and bad.get_json()['error'] == 'unknown_domain'

    empty = client.post('/api/drafts/brief', json={'type_id': 'law_demo', 'lang': 'ru', 'text': '   ', 'domain': ''})
    assert empty.status_code == 400 and empty.get_json()['error'] == 'empty_brief'


def test_brief_without_text_but_with_domain_is_enough(app, client):
    app.config['LLM_PROVIDER'] = ScriptedProvider(CONCEPTS)
    r = client.post('/api/drafts/brief', json={'type_id': 'law_demo', 'lang': 'ru', 'text': '', 'domain': 'labor'})
    assert r.status_code == 200


def test_brief_reports_model_failure_honestly(app, client):
    app.config['LLM_PROVIDER'] = ScriptedProvider('мусор', 'снова мусор')
    r = client.post('/api/drafts/brief', json=BRIEF)

    assert r.status_code == 502
    assert r.get_json()['error'] == 'brief_failed'


def test_brief_without_provider_is_a_config_error(app, client):
    r = client.post('/api/drafts/brief', json=BRIEF)
    assert r.status_code == 503


def test_avoid_titles_reach_the_model(app, client):
    provider = ScriptedProvider(CONCEPTS)
    app.config['LLM_PROVIDER'] = provider
    client.post('/api/drafts/brief', json={**BRIEF, 'avoid': ['О первом варианте']})
    prompt = ' '.join(m['content'] for m in provider.calls[0])
    assert 'О первом варианте' in prompt


def test_brief_is_rate_limited_per_hour(app, client):
    app.config['LLM_PROVIDER'] = ScriptedProvider(CONCEPTS, CONCEPTS)
    app.config['DRAFT_BRIEFS_PER_HOUR'] = 1

    assert client.post('/api/drafts/brief', json=BRIEF).status_code == 200
    second = client.post('/api/drafts/brief', json=BRIEF)
    assert second.status_code == 429
    assert second.get_json()['error'] == 'rate_limited'
```

- [ ] **Step 2: Написать падающий тест на `job` в ответе документа**

Дописать в `tests/test_api_drafts.py` (после `_generate_in_background`):

```python
def test_document_response_carries_the_running_job(app, client):
    """Страница документа открывается сразу после запуска генерации и должна
    подхватить идущую задачу, а не ждать, пока человек нажмёт что-то ещё."""
    app.config['LLM_PROVIDER'] = ScriptedProvider(SECTION_PAYLOAD)
    public_id = _create(client).get_json()['draft']['id']

    assert client.get(f'/api/drafts/{public_id}').get_json()['draft']['job'] is None

    started = client.post(f'/api/drafts/{public_id}/generate', json={})
    assert started.status_code == 202
    job = client.get(f'/api/drafts/{public_id}').get_json()['draft']['job']
    assert job and job['id'] == started.get_json()['job']['id']
    assert job['status'] == 'queued'
```

- [ ] **Step 3: Убедиться, что тесты падают**

Run: `python3 -m pytest tests/test_api_brief.py tests/test_api_drafts.py -q -k "brief or domains or running_job"`
Expected: 404 на `/api/drafts/brief/...` и `KeyError: 'job'`.

- [ ] **Step 4: Реализовать ручки**

В `blueprints/drafts/routes.py`:

Импорты (рядом с `from docengine.demo import demo_values`):

```python
from database.models import Draft, DraftTurn, DraftVersion, Job, UsageEvent, db
from docengine.brief import clarifications_payload, domain, domains_payload, example_brief, propose_concepts
from docengine.generate import GenerationError
```

Помощник лимита (после `_rate_limited`):

```python
def _usage_limited(action: str, limit: int) -> tuple[bool, int]:
    """Почасовой лимит по журналу использования — для действий без задачи.

    Бриф — синхронный вызов модели, строки в очереди задач у него нет, а
    считать его всё равно надо: три концепта стоят как половина документа.
    """
    user = current_user()
    if not user:
        return True, 0
    since = datetime.utcnow() - timedelta(hours=1)
    used = db.session.query(UsageEvent).filter(
        UsageEvent.user_id == user.id, UsageEvent.module == 'drafts',
        UsageEvent.action == action, UsageEvent.created_at >= since,
    ).count()
    return used >= limit, max(0, limit - used)
```

Ручки (перед `# ───── черновики`, после `passport_demo`):

```python
@drafts_bp.route('/brief/domains')
def brief_domains():
    """Сферы для брифа и пример — публично: их видит и гость на экране."""
    lang = _lang()
    return jsonify({'success': True, 'domains': domains_payload(lang), 'example': example_brief(lang)})


@drafts_bp.route('/brief', methods=['POST'])
@login_required
def brief():
    """Три концепта законопроекта по брифу.

    Ответ — сразу и значениями формы паспорта: интерфейс не должен знать,
    как поля концепта раскладываются по паспорту, иначе это знание разойдётся
    с сервером при первом изменении.
    """
    data = request.get_json(silent=True) or {}
    type_id = data.get('type_id') or 'law_project'
    try:
        p = get_passport(type_id)
    except KeyError:
        return _err(f'Неизвестный тип документа: {type_id}', 404, 'not_found')

    lang = _lang()
    domain_key = str(data.get('domain') or '')
    if domain_key and domain(domain_key) is None:
        return _err('Неизвестная сфера', 400, 'unknown_domain')

    text = str(data.get('text') or '')
    attachments = [
        {'filename': str(a.get('filename') or 'файл'), 'text': str(a.get('text') or '')}
        for a in (data.get('attachments') or []) if isinstance(a, dict)
    ]
    if not text.strip() and not domain_key and not any(a['text'].strip() for a in attachments):
        return _err('Опишите закон или выберите сферу', 400, 'empty_brief')

    limit = current_app.config.get('DRAFT_BRIEFS_PER_HOUR', 30)
    over, left = _usage_limited('brief', limit)
    if over:
        return _err(f'Достигнут предел в {limit} запросов концептов в час. Попробуйте позже.',
                    429, 'rate_limited')

    provider = current_app.config.get('LLM_PROVIDER')
    if provider is None:
        return _err('LLM-провайдер не настроен', 503, 'not_configured')
    retriever = current_app.config.get('RAG_RETRIEVER')

    avoid = [str(t) for t in (data.get('avoid') or []) if str(t).strip()][:9]
    try:
        result = propose_concepts(
            provider, retriever, p,
            text=text, domain_key=domain_key, attachments=attachments, lang=lang, avoid=avoid,
        )
    except GenerationError as e:
        log.error('бриф %s: %s', type_id, e)
        return _err('Модель не смогла предложить варианты — попробуйте ещё раз', 502, 'brief_failed')

    log_usage('drafts', 'brief', details={'type': type_id, 'domain': domain_key, 'files': len(attachments)})
    return jsonify({
        'success': True,
        'concepts': [{**c.model_dump(mode='json'), 'values': c.to_values(p)} for c in result.concepts],
        'clarifications': clarifications_payload(p, lang, domain_key),
    })
```

`GET /<public_id>`:

```python
@drafts_bp.route('/<public_id>')
@login_required
def get_draft(public_id: str):
    draft = _own_draft(public_id)
    if not draft:
        return _err('Документ не найден', 404, 'not_found')
    payload = draft.to_dict(with_tree=True)
    # Незавершённая задача — страница документа подхватывает её сразу после
    # открытия, иначе генерация идёт, а экран об этом не знает.
    running = db.session.query(Job).filter(
        Job.draft_id == draft.id, Job.status.in_(('queued', 'running')),
    ).order_by(Job.created_at.desc()).first()
    payload['job'] = running.to_dict() if running else None
    return jsonify({'success': True, 'draft': payload})
```

- [ ] **Step 5: Прогнать тесты**

Run: `python3 -m pytest tests/ -q`
Expected: все зелёные (плюс 11 новых).

- [ ] **Step 6: Закоммитить**

```bash
git add blueprints/drafts/routes.py tests/test_api_brief.py tests/test_api_drafts.py
git commit -m "$(cat <<'EOF'
feat(drafts): ручки брифа и задача в ответе документа

POST /api/drafts/brief отдаёт три концепта уже значениями формы паспорта
и уточнения чипами; сферы и пример — публично. Лимит брифов — по журналу
использования: очереди у синхронного вызова нет. Ответ документа несёт
незавершённую задачу — страница подхватывает генерацию сразу после
открытия.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Ход генерации с содержанием

**Files:**
- Modify: `docengine/jobs.py:123-131`, `docengine/tasks.py`
- Test: `tests/test_api_drafts.py`

**Interfaces:**
- Consumes: `_retrieve_chunks`, `_context_text`, `found_norms` из Task 3.
- Produces: `progress(done, total, label='', meta=None)` в `jobs.run_once` — `meta` пишется в `Job.result_json`; обработчик шлёт `meta` вида `{'stage': 'retrieving'|'drafting'|'checking', 'section': key, 'found': [{title, article}], 'partial': <дерево>}`.

- [ ] **Step 1: Написать падающий тест**

Дописать в `tests/test_api_drafts.py`:

```python
def test_generation_reports_stages_found_norms_and_a_growing_tree(app, client):
    """Полторы минуты генерации должны что-то показывать: какие нормы найдены,
    какой раздел пишется, что уже готово. Всё это уходит в meta прогресса."""
    app.config['LLM_PROVIDER'] = ScriptedProvider(SECTION_PAYLOAD)
    app.config['RAG_RETRIEVER'] = FakeRetriever()
    public_id = _create(client).get_json()['draft']['id']
    started = client.post(f'/api/drafts/{public_id}/generate', json={})
    from database.models import Job, db
    from docengine.tasks import generate_draft
    with app.app_context():
        job = db.session.query(Job).filter_by(public_id=started.get_json()['job']['id']).one()
        payload = dict(job.payload_json or {})

    calls = []
    generate_draft(app, payload, lambda done, total, label, meta=None: calls.append((done, total, label, meta)))

    metas = [m for *_, m in calls if m]
    assert [m['stage'] for m in metas[:2]] == ['retrieving', 'drafting']
    assert metas[1]['section'] == 'subject'
    assert metas[1]['found'] == [{'title': 'ГК РК', 'article': '406'}]

    partials = [m['partial'] for m in metas if m.get('partial')]
    filled = [sum(1 for s in p['sections'] if not s['pending']) for p in partials]
    assert filled == [1, 2, 3], 'после каждого раздела дерево растёт на один раздел'
    assert partials[0]['sections'][0]['clauses'][0]['no'] == '1.1', 'частичное дерево уже пронумеровано'
    assert metas[-1] == {'stage': 'checking'}


def test_progress_callback_without_meta_is_still_accepted(app, client):
    """Прежние вызывающие передают три аргумента — обработчик не должен их ронять."""
    app.config['LLM_PROVIDER'] = ScriptedProvider(SECTION_PAYLOAD)
    public_id = _create(client).get_json()['draft']['id']
    tree = _generate_in_background(app, client, public_id)['tree']
    assert all(not s['pending'] for s in tree['sections'])
```

- [ ] **Step 2: Убедиться, что первый тест падает**

Run: `python3 -m pytest tests/test_api_drafts.py -q -k "stages_found or without_meta"`
Expected: первый падает — `metas` пуст (обработчик не шлёт meta); второй проходит уже сейчас.

Замечание: `_generate_in_background` передаёт `lambda *a: None` — он примет и четвёртый аргумент. Тест «без meta» охраняет совместимость сигнатуры на будущее.

- [ ] **Step 3: Научить очередь принимать meta**

В `docengine/jobs.py` заменить замыкание `progress`:

```python
        def progress(done: int, total: int, label: str = '', meta: dict | None = None) -> None:
            # Отдельная короткая транзакция: прогресс должен быть виден
            # клиенту немедленно, а не после завершения всей задачи.
            j = db.session.get(Job, job.id)
            if j is None:
                return
            j.progress_done, j.progress_total, j.progress_label = done, total, label
            # Содержание хода — стадия, найденные нормы, частичное дерево —
            # едет в result_json: колонка уже есть, поток событий её отдаёт,
            # а по завершении сюда ляжет итог задачи.
            if meta is not None:
                j.result_json = meta
            j.heartbeat_at = datetime.utcnow()
            db.session.commit()
```

- [ ] **Step 4: Слать стадии из обработчика**

В `docengine/tasks.py`:

```python
    from .generate import GenerationError, _context_text, _retrieve_chunks, _section_query, found_norms, generate_section
```

Цикл по разделам:

```python
        for i, spec in enumerate(specs):
            title = spec.title.get(draft.lang)
            section = tree.section_by_key(spec.key)
            if section is None:
                continue
            progress(i, total, title, {'stage': 'retrieving', 'section': spec.key})
            try:
                # Нормы под раздел достаём здесь, как и generate_document:
                # сама generate_section корпуса не знает и получает уже текст.
                chunks = _retrieve_chunks(retriever, _section_query(passport, spec, draft.lang))
                found = found_norms(chunks)
                progress(i, total, title, {'stage': 'drafting', 'section': spec.key, 'found': found})
                clauses = generate_section(
                    provider, passport, spec, tree, values, draft.lang,
                    legal_context=_context_text(chunks), hint=payload.get('hint') or '',
                )
                # Пункты, правленные человеком, переживают перегенерацию.
                kept = [c for c in section.clauses if c.locked]
                section.clauses = clauses + kept
                section.pending = False
                # Готовый раздел уходит на экран сразу, пронумерованным: лист
                # наполняется по мере работы, а не после всех разделов.
                renumber(tree)
                progress(i + 1, total, title, {
                    'stage': 'drafting', 'section': spec.key, 'found': found,
                    'partial': tree.model_dump(mode='json'),
                })
            except Exception as e:
                log.error('раздел «%s» документа %s не сгенерирован: %s',
                          spec.key, draft.public_id, e)
                failed.append(spec.key)
                tree.issues.append(Issue(
                    level='error', code='section_failed', section_key=spec.key,
                    message=f'Раздел «{title}» не удалось составить. '
                            f'Попробуйте сгенерировать его отдельно.',
                ))

        progress(total, total, 'проверка документа', {'stage': 'checking'})
```

Убрать прежнюю строку `progress(i, total, spec.title.get(draft.lang))` и прежнюю `progress(total, total, 'проверка документа')`.

- [ ] **Step 5: Прогнать тесты**

Run: `python3 -m pytest tests/ -q`
Expected: все зелёные.

- [ ] **Step 6: Закоммитить**

```bash
git add docengine/jobs.py docengine/tasks.py tests/test_api_drafts.py
git commit -m "$(cat <<'EOF'
feat(docengine): ход генерации несёт стадию, найденные нормы и частичное дерево

Полторы минуты составления показывали полосу с процентами. Обработчик
теперь пишет в result_json задачи стадию (поиск норм → написание →
проверка), найденные под раздел нормы и дерево с уже готовыми разделами —
поток событий отдаёт всё это без изменения схемы. Прежняя сигнатура
progress сохранена: meta необязателен.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Генерация на глазах — строка стадии, подхват задачи, каскад

**Files:**
- Modify: `frontend/src/features/legal/cite.ts`, `frontend/src/features/chat/answer.ts`, `frontend/src/features/drafts/types.ts`, `frontend/src/features/drafts/doc.tsx`, `frontend/src/features/drafts/Sheet.tsx`, `frontend/src/features/drafts/drafts.css`, `frontend/src/features/laws/DocumentPage.tsx`, `frontend/src/features/contracts/DocumentPage.tsx`
- Create: `frontend/src/features/drafts/BuildStage.tsx`

**Interfaces:**
- Consumes: `Job.result` из потока событий (Task 5: `{stage, section, found, partial}`), `draft.job` из `GET /drafts/<id>` (Task 4).
- Produces: `normCode(title, article?) -> string`; типы `FoundNorm`, `BuildMeta`; `Building` с `stage/sectionKey/found`; `useSectionBuild(draftId, onDone, onPartial?) -> { building, run, attach }`; `useDraftDoc(...).setTree(tree)`; `<BuildStage building sectionTitle? />`; `<Sheet freshKeys? />`.

Проверка здесь — типы, линтер и браузер: у фронтенда нет тест-раннера.

- [ ] **Step 1: Код нормы из названия и статьи**

В `frontend/src/features/legal/cite.ts` после `actCode`:

```ts
/** «ГК РК 178» из названия документа корпуса и номера статьи; без статьи — только акт. */
export function normCode(title: string, article?: string | null): string {
  const act = actCode(title)
  return article ? `${act} ${article}` : act
}
```

В `frontend/src/features/chat/answer.ts` заменить импорт и `sourceCode`:

```ts
import { normCode } from '../legal/cite'
// …
/** «ГК РК 178» — код акта и номер статьи, если сервер его нашёл. */
export function sourceCode(s: ApiSource): string {
  return normCode(s.title, s.article)
}
```

- [ ] **Step 2: Типы**

В `frontend/src/features/drafts/types.ts` после `DocTree`:

```ts
/** Норма, найденная под раздел: для строки хода генерации. */
export interface FoundNorm {
  title: string
  article: string
}

/** Содержание хода генерации в `Job.result`: стадия, раздел, нормы, частичное дерево. */
export interface BuildMeta {
  stage?: 'retrieving' | 'drafting' | 'checking'
  section?: string
  found?: FoundNorm[]
  partial?: DocTree
}
```

В интерфейс `Draft` добавить (после `title: string`):

```ts
  /** Незавершённая генерация по документу — страница подхватывает её при открытии. */
  job?: Job | null
```

- [ ] **Step 3: Хук составления — стадии, подхват, частичное дерево**

В `frontend/src/features/drafts/doc.tsx` заменить `Building` и `useSectionBuild` целиком:

```ts
export interface Building {
  done: number
  total: number
  label: string
  /** Разделы, которые сейчас пишутся: оглавление помечает их отдельно. */
  keys: string[]
  stage?: BuildMeta['stage']
  /** Раздел, над которым идёт работа сейчас. */
  sectionKey?: string
  /** Нормы, найденные под этот раздел. */
  found?: FoundNorm[]
}

/**
 * Запуск составления разделов и слежение за ходом.
 *
 * Поток событий закрывается в трёх случаях — успех, отказ, обрыв, — и во всех
 * трёх документ уже сохранён на сервере, поэтому экран просто перечитывает
 * его: держать человека в бесконечном ожидании хуже, чем показать частично
 * составленный пакет.
 *
 * Задача может быть запущена другим экраном (мастером брифа): `attach`
 * подхватывает её по объекту из ответа документа.
 */
export function useSectionBuild(
  draftId: string,
  onDone: () => void,
  onPartial?: (tree: DocTree) => void,
) {
  const t = useT(dict)
  const toast = useToast()
  const [building, setBuilding] = useState<Building | null>(null)
  const stopRef = useRef<(() => void) | null>(null)
  // Колбэки — в ref: они меняются на каждой перерисовке экрана, а подписка
  // на поток открывается один раз и должна звать свежие.
  const onPartialRef = useRef(onPartial)
  onPartialRef.current = onPartial
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => () => stopRef.current?.(), [])

  /** Слежение за задачей — и за только что запущенной, и за подхваченной. */
  const follow = useCallback(
    (jobId: string, keys: string[]) => {
      // Закрывалка держится в локальной переменной, а не только в ref:
      // необорванный EventSource продолжает переподключаться и держит на
      // сервере поток, который никто не читает.
      let stop: (() => void) | null = null
      const finish = () => {
        stop?.()
        stop = null
        stopRef.current = null
        setBuilding(null)
        onDoneRef.current()
      }
      stop = sse<Job>(
        `/drafts/jobs/${jobId}/events`,
        (j) => {
          const meta = (j.result ?? null) as BuildMeta | null
          setBuilding({
            done: j.progress.done,
            total: j.progress.total,
            label: j.progress.label,
            keys,
            stage: meta?.stage,
            sectionKey: meta?.section,
            found: meta?.found,
          })
          if (meta?.partial) onPartialRef.current?.(meta.partial)
          if (j.status === 'done' || j.status === 'failed' || j.status === 'cancelled') {
            if (j.status === 'failed' && j.error) toast(j.error, 'err')
            // Тишина после сборки читалась как «ничего не произошло»: полоса
            // хода исчезала, а лист под ней просто становился длиннее.
            if (j.status === 'done') toast(`${t('built')}: ${keys.length}`, 'ok')
            finish()
          }
        },
        finish,
      )
      stopRef.current = () => stop?.()
    },
    [t, toast],
  )

  const run = useCallback(
    async (keys: string[], hint?: string) => {
      if (!keys.length || stopRef.current) return
      setBuilding({ done: 0, total: keys.length, label: '', keys })
      try {
        const started = await api.post<JobResponse>(`/drafts/${draftId}/generate`, {
          sections: keys,
          ...(hint ? { hint } : {}),
        })
        follow(started.job.id, keys)
      } catch (e) {
        setBuilding(null)
        toast(errorMessage(e, t('errBuild')), 'err')
      }
    },
    [draftId, follow, t, toast],
  )

  /** Подхватить задачу, запущенную другим экраном. */
  const attach = useCallback(
    (job: Job, keys: string[]) => {
      if (stopRef.current) return
      setBuilding({ done: job.progress.done, total: job.progress.total, label: job.progress.label, keys })
      follow(job.id, keys)
    },
    [follow],
  )

  return { building, run, attach }
}
```

Импорты в начале `doc.tsx`: добавить `BuildMeta`, `DocTree`, `FoundNorm` в `import type {…} from './types'`.

В `useDraftDoc` добавить перед `return`:

```ts
  /** Подменить дерево на экране, не трогая сервер: частичный результат генерации. */
  const setTree = useCallback(
    (tree: DocTree) => {
      if (draft) setData({ draft: { ...draft, tree } })
    },
    [draft, setData],
  )
```

и включить `setTree` в возвращаемый объект хука.

- [ ] **Step 4: Строка стадии**

```tsx
// frontend/src/features/drafts/BuildStage.tsx
import { Caption, Cite, Loading, UIText } from '../../shared/ui'
import { useLang, useT } from '../../i18n'
import type { Dict } from '../../i18n'
import { citeCode, normCode } from '../legal/cite'
import type { Building } from './doc'

/**
 * Строка хода генерации.
 *
 * Полоса с процентами говорила «идёт», но не «что». Здесь видно, какой раздел
 * пишется, какие нормы под него нашлись и на какой стадии работа — настоящие
 * данные из задачи, а не анимация ради анимации.
 */

const dict: Dict = {
  building: { ru: 'Составляю разделы', kz: 'Бөлімдерді жасап жатырмын', en: 'Drafting sections' },
  of: { ru: 'из', kz: '/', en: 'of' },
  retrieving: { ru: 'ищу нормы', kz: 'нормаларды іздеп жатырмын', en: 'looking up the norms' },
  drafting: { ru: 'пишу', kz: 'жазып жатырмын', en: 'writing' },
  checking: { ru: 'Проверяю ссылки и нумерацию', kz: 'Сілтемелер мен нөмірлеуді тексеріп жатырмын', en: 'Checking citations and numbering' },
  found: { ru: 'нашёл:', kz: 'табылды:', en: 'found:' },
}

export function BuildStage({ building, sectionTitle }: { building: Building; sectionTitle?: string }) {
  const t = useT(dict)
  const { lang } = useLang()
  const stage = building.stage ?? 'drafting'
  const current = Math.min(building.done + 1, building.total)

  return (
    <div className="ct-building" role="status" aria-live="polite">
      <Loading label={t('building')} />
      <div className="ct-building__line">
        <UIText tone="mute">
          {stage === 'checking'
            ? t('checking')
            : `${t('building')}: ${current} ${t('of')} ${building.total}${
                sectionTitle ? ` — ${sectionTitle}` : ''
              } · ${t(stage)}`}
        </UIText>
        {stage !== 'checking' && building.found?.length ? (
          <span className="ct-building__found">
            <Caption tone="mute" as="span">
              {t('found')}
            </Caption>
            {building.found.map((n) => (
              <Cite key={`${n.title}-${n.article}`} code={citeCode(normCode(n.title, n.article), lang)} />
            ))}
          </span>
        ) : null}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Свежие разделы в листе**

В `frontend/src/features/drafts/Sheet.tsx`:

`import type { CSSProperties, ReactNode } from 'react'`

`ClauseBody` получает проп `order?: number` и ставит его в `--i`:

```tsx
function ClauseBody({
  clause, lang, activeNo, onClauseClick, clauseSlot, level, order,
}: {
  clause: Clause
  lang: DocLang
  activeNo?: string | null
  onClauseClick?: (clause: Clause) => void
  clauseSlot?: (clause: Clause) => ReactNode
  level: number
  /** Порядок в свежем разделе — задержка каскада; без него анимации нет. */
  order?: number
}) {
  const interactive = Boolean(onClauseClick)
  const cls = [
    'sheet__clause',
    level > 0 ? 'sheet__clause--sub' : '',
    interactive ? 'sheet__clause--live' : '',
    activeNo === clause.no ? 'sheet__clause--on' : '',
    clause.locked ? 'sheet__clause--locked' : '',
  ]
    .filter(Boolean)
    .join(' ')
  const style = order === undefined ? undefined : ({ '--i': order } as CSSProperties)
  return (
    <div className={cls} id={`clause-${clause.no}`} style={style}>
```

`SectionBody` получает `fresh?: boolean`:

```tsx
function SectionBody({ section, lang, activeNo, onClauseClick, clauseSlot, fresh }: {
  section: Section
  lang: DocLang
  activeNo?: string | null
  onClauseClick?: (clause: Clause) => void
  clauseSlot?: (clause: Clause) => ReactNode
  /** Раздел только что пришёл готовым: пункты выезжают каскадом. */
  fresh?: boolean
}) {
  return (
    <section
      className={['sheet__section', fresh ? 'sheet__section--fresh' : ''].filter(Boolean).join(' ')}
      id={`section-${section.no}`}
    >
      <h3 className="sheet__section-title">
        <span className="sheet__no">{section.no}.</span> {section.title}
      </h3>
      {section.clauses.map((c, idx) => (
        <ClauseBody
          key={c.no || c.text.slice(0, 24)}
          clause={c}
          lang={lang}
          activeNo={activeNo}
          onClauseClick={onClauseClick}
          clauseSlot={clauseSlot}
          level={0}
          order={fresh ? idx : undefined}
        />
      ))}
      {/* Блок призрачных строк и visually-hidden подписи для ненаписанного раздела остаётся без изменений */}
    </section>
  )
}
```

`Sheet` получает `freshKeys?: ReadonlySet<string>` и передаёт `fresh={Boolean(s.key && freshKeys?.has(s.key))}` в `SectionBody` основного списка разделов (приложения — без изменений).

- [ ] **Step 6: Стили**

В `frontend/src/features/drafts/drafts.css` (перед `/* ---------- Узкие экраны ---------- */`):

```css
/* ---------- Ход генерации ----------
   Строка стадии с найденными нормами; свежий раздел выезжает каскадом, пункт
   за пунктом; идущий раздел в оглавлении пульсирует. Всё гасится при
   «меньше движения». */
.ct-building__line { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--s-2) var(--s-3); }
.ct-building__found { display: inline-flex; flex-wrap: wrap; align-items: baseline; gap: var(--s-2); }

.sheet__section--fresh .sheet__clause {
  animation: tura-unfold var(--motion-enter) both;
  animation-delay: calc(var(--i, 0) * var(--dur-1));
}
.ct-toc__link--busy .ct-toc__no { color: var(--seal); animation: tura-fade 1.4s ease-in-out infinite; }

@media (prefers-reduced-motion: reduce) {
  .sheet__section--fresh .sheet__clause,
  .ct-toc__link--busy .ct-toc__no { animation: none; }
}
```

- [ ] **Step 7: Страница документа законопроекта**

В `frontend/src/features/laws/DocumentPage.tsx`:

Импорты: `import { useEffect, useRef, useState } from 'react'` (если чего-то нет — добавить), `import { BuildStage } from '../drafts/BuildStage'`, `import type { DocTree } from '../drafts/types'` (в общий `import type`).

Заменить строки

```ts
  const { draft, error, loading, reload, setDraft, rename, setStatus, saveClause } = useDraftDoc(id)
  const tree = draft?.tree ?? null
  const grab = useExport(draft?.id)
  const { building, run } = useSectionBuild(draft?.id ?? '', reload)
```

на

```ts
  const { draft, error, loading, reload, setDraft, setTree, rename, setStatus, saveClause } = useDraftDoc(id)
  const tree = draft?.tree ?? null
  const grab = useExport(draft?.id)

  // Дерево на момент прихода частичного результата — чтобы понять, какие
  // разделы только что стали готовыми и должны выехать каскадом.
  const treeRef = useRef<DocTree | null>(null)
  treeRef.current = tree
  const [fresh, setFresh] = useState<Set<string>>(() => new Set())

  const { building, run, attach } = useSectionBuild(
    draft?.id ?? '',
    () => {
      reload()
      // Метки свежести снимаются после того, как последний каскад доиграл
      window.setTimeout(() => setFresh(new Set()), 1500)
    },
    (partial) => {
      const before = new Map((treeRef.current?.sections ?? []).map((s) => [s.key, s.pending]))
      setFresh((prev) => {
        const next = new Set(prev)
        for (const s of partial.sections) if (s.key && !s.pending && before.get(s.key)) next.add(s.key)
        return next
      })
      setTree(partial)
    },
  )

  // Генерацию мог запустить мастер брифа: страница открывается уже в ходе
  // работы и обязана её подхватить, а не ждать нажатия.
  useEffect(() => {
    if (!draft?.job || building) return
    const pending = (draft.tree?.sections ?? []).filter((s) => s.pending && s.key).map((s) => s.key as string)
    attach(draft.job, pending)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.job?.id])
```

В разметке:

- блок

```tsx
                {building ? (
                  <div className="ct-building">
                    <Loading />
                    <Caption tone="mute">
                      {t('building')}: {building.done}/{building.total} {building.label}
                    </Caption>
                  </div>
                ) : null}
```

заменить на

```tsx
                {building ? (
                  <BuildStage
                    building={building}
                    sectionTitle={tree.sections.find((s) => s.key === building.sectionKey)?.title}
                  />
                ) : null}
```

- у `<Sheet …>` добавить `freshKeys={fresh}`;
- ссылке оглавления: `className={['ct-toc__link', building?.sectionKey === s.key ? 'ct-toc__link--busy' : ''].filter(Boolean).join(' ')}`.

Если `Loading` после замены больше не используется в файле — убрать из импорта (`tsc` подскажет).

- [ ] **Step 8: Страница документа договора — то же самое**

В `frontend/src/features/contracts/DocumentPage.tsx` выполнить те же правки: импорт `BuildStage` и `DocTree`; деструктурировать `setTree` из `useDraftDoc`; `treeRef`, `fresh`, `useSectionBuild(draft?.id ?? '', onDone, onPartial)` с тем же кодом колбэков, что в шаге 7; `useEffect` подхвата `draft.job`; блок `.ct-building` (строка ~283) заменить на `<BuildStage building={building} sectionTitle={tree.sections.find((s) => s.key === building.sectionKey)?.title} />`; `<Sheet … freshKeys={fresh} />`. Оглавления с классом `ct-toc__link` в договорах — пометить так же, если оно есть.

- [ ] **Step 9: Проверить типы, линтер, сборку**

Run: `cd frontend && npm run check && npm run build`
Expected: `Дизайн-система цела…`, сборка без ошибок.

- [ ] **Step 10: Проверить в браузере на проде после выкладки статики**

```bash
cd /Users/nurlykhan/law_rag && sshpass -p "$DMZ_PASS" rsync -az --delete --exclude '__devlogin.html' \
  -e "ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null" static/app/ user@95.141.135.244:~/dalel/static/app/
```

(бэкенд Task 4–5 к этому моменту должен быть выкачен: `git pull` + пересборка образа — см. Task 9; иначе `job` и `meta` не придут.)

Открыть документ `uxcheck@dalel.test` → `/laws/<id>`, в оглавлении нажать «Переписать» у одного раздела. Ожидается: строка «Составляю разделы: 1 из 1 — … · ищу нормы», затем «нашёл: ГК РК …» чипами, затем пункты раздела появляются каскадом, оглавление пульсирует на этом разделе, затем «Разделы составлены: 1».

- [ ] **Step 11: Закоммитить**

```bash
git add frontend/src/features/legal/cite.ts frontend/src/features/chat/answer.ts frontend/src/features/drafts/types.ts \
  frontend/src/features/drafts/doc.tsx frontend/src/features/drafts/BuildStage.tsx frontend/src/features/drafts/Sheet.tsx \
  frontend/src/features/drafts/drafts.css frontend/src/features/laws/DocumentPage.tsx frontend/src/features/contracts/DocumentPage.tsx
git commit -m "$(cat <<'EOF'
feat(doc): генерация на глазах — стадия, найденные нормы, каскад разделов

Полоса с процентами говорила «идёт», но не «что». Строка стадии показывает
раздел, найденные под него нормы и этап работы; готовый раздел появляется
в листе сразу, пункты выезжают каскадом; страница подхватывает задачу,
запущенную другим экраном. Всё — настоящие данные из потока задачи.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Экран концептов

**Files:**
- Create: `frontend/src/features/laws/concepts.ts`, `frontend/src/features/laws/ConceptsScreen.tsx`
- Modify: `frontend/src/features/laws/laws.css`

**Interfaces:**
- Consumes: `BuilderAside`, `buildPreviewTree(passport, values, dl, 'law_project')`, `Passport`/`PassportField` из `drafts/types`, `Chip`, `Input`, `Textarea`, `Button`, `Cite`, `citeCode`.
- Produces: типы `Concept`, `Clarifications`, `BriefResponse`, `DomainsResponse`, `BriefAttachment`; `conceptValues(concept, edits) -> Record<string,string>`; `refCode(ref) -> string`; `THINK_STAGES`; `<ConceptsScreen result passport onMore moreBusy onSubmit submitBusy onBack />`.

- [ ] **Step 1: Типы и помощники**

```ts
// frontend/src/features/laws/concepts.ts
import type { Passport } from '../drafts/types'

/**
 * Ответ ручки брифа и его сборка в значения формы.
 *
 * Сервер уже раскладывает концепт по полям паспорта (`values`); клиент только
 * накладывает правки из карточки и выбранные уточнения. Так знание о том,
 * как поля концепта соответствуют паспорту, живёт в одном месте — на сервере.
 */

export interface BriefDomain {
  key: string
  label: string
}

export interface BriefAttachment {
  filename: string
  text: string
  length: number
}

export interface ConceptRef {
  act: string
  article: string
  note: string | null
  verified: boolean
}

export interface Concept {
  title_ru: string
  title_kz: string
  summary: string
  problem_description: string
  goals: string[]
  target_audience: string
  current_legislation_gaps: string
  constitutional_basis: string
  key_provisions: string[]
  refs: ConceptRef[]
  /** Поля паспорта, собранные сервером из концепта. */
  values: Record<string, string>
}

export interface ChipChoice {
  key: string
  label: string
  value: string
}

export interface Clarifications {
  initiator_type?: { kind: 'options'; options: { value: string; label: string }[] }
  initiator?: { kind: 'text'; suggestions: string[] }
  implementation_timeline?: { kind: 'chips'; chips: ChipChoice[] }
  budget_impact?: { kind: 'chips'; chips: ChipChoice[] }
}

export interface BriefResponse {
  concepts: Concept[]
  clarifications: Clarifications
}

export interface DomainsResponse {
  domains: BriefDomain[]
  example: { domain: string; text: string }
}

/** Стадии ожидания концептов — честные названия того, что делает сервер. */
export const THINK_STAGES = ['reading', 'searching', 'drafting'] as const
export type ThinkStage = (typeof THINK_STAGES)[number]

/** Значения формы: концепт сервера плюс правки и уточнения человека. */
export function conceptValues(concept: Concept, edits: Record<string, string>): Record<string, string> {
  const merged: Record<string, string> = { ...concept.values, ...edits }
  return Object.fromEntries(Object.entries(merged).filter(([, v]) => v && v.trim()))
}

/** «Конституция РК 13» — код нормы концепта для чипа. */
export function refCode(ref: ConceptRef): string {
  return ref.article ? `${ref.act} ${ref.article}` : ref.act
}

/** Обязательные поля паспорта, которых в значениях ещё нет — подписями. */
export function missingRequired(passport: Passport, values: Record<string, string>): string[] {
  return passport.fields.filter((f) => f.required && !values[f.name]?.trim()).map((f) => f.label)
}
```

- [ ] **Step 2: Экран концептов**

```tsx
// frontend/src/features/laws/ConceptsScreen.tsx
import { useMemo, useState } from 'react'
import { Body, Button, Caption, Chip, Cite, H3, Input, Label, Textarea, UIText, useToast } from '../../shared/ui'
import { useLang, useT } from '../../i18n'
import type { Dict } from '../../i18n'
import { citeCode } from '../legal/cite'
import { BuilderAside } from '../drafts/BuilderAside'
import { buildPreviewTree, docLang } from '../drafts/preview'
import type { Passport } from '../drafts/types'
import { conceptValues, missingRequired, refCode } from './concepts'
import type { BriefResponse, Concept } from './concepts'

/**
 * Три концепта на выбор, правка выбранного и уточнения чипами.
 *
 * Выбор вместо набора: человек читает три готовых законопроекта и берёт
 * один, а не сочиняет семнадцать полей. Всё, что не помещается в концепт —
 * инициатор, срок, бюджет, — спрашивается чипами, которые разворачиваются в
 * готовый текст. Лист справа собирается из выбранного, как в прежнем мастере.
 */

const dict: Dict = {
  title: { ru: 'Три варианта — выберите один', kz: 'Үш нұсқа — біреуін таңдаңыз', en: 'Three options — pick one' },
  lead: {
    ru: 'Каждый вариант — самостоятельный законопроект по вашему брифу. Выбранный можно править и дополнять целями из других.',
    kz: 'Әр нұсқа — сіздің бриф бойынша дербес заң жобасы. Таңдалғанды түзетуге және басқаларының мақсаттарымен толықтыруға болады.',
    en: 'Each option is a self-contained draft law for your brief. The chosen one can be edited and topped up with goals from the others.',
  },
  choose: { ru: 'Выбрать', kz: 'Таңдау', en: 'Choose' },
  chosen: { ru: 'Выбран', kz: 'Таңдалды', en: 'Chosen' },
  takeGoals: { ru: 'Добавить цели отсюда', kz: 'Осы жерден мақсаттар қосу', en: 'Add goals from here' },
  goals: { ru: 'Цели', kz: 'Мақсаттар', en: 'Goals' },
  provisions: { ru: 'Ключевые положения', kz: 'Негізгі ережелер', en: 'Key provisions' },
  basis: { ru: 'Правовая основа', kz: 'Құқықтық негіз', en: 'Legal basis' },
  refine: { ru: 'Уточнить выбранный вариант', kz: 'Таңдалған нұсқаны нақтылау', en: 'Refine the chosen option' },
  refineHint: {
    ru: 'Любую строку можно поправить — в пакет уйдёт то, что вы видите здесь.',
    kz: 'Кез келген жолды түзетуге болады — топтамаға осы жерде көргеніңіз кетеді.',
    en: 'Edit any line — what you see here goes into the package.',
  },
  clarify: { ru: 'Уточнения', kz: 'Нақтылаулар', en: 'Details' },
  clarifyHint: {
    ru: 'Без этого пакет не примут к рассмотрению — выберите или впишите своё.',
    kz: 'Бұларсыз топтама қарауға қабылданбайды — таңдаңыз немесе өзіңіздікін жазыңыз.',
    en: 'Required for submission — pick an option or type your own.',
  },
  initiatorType: { ru: 'Кто вносит', kz: 'Кім енгізеді', en: 'Initiated by' },
  initiator: { ru: 'Инициатор', kz: 'Бастамашы', en: 'Initiator' },
  timeline: { ru: 'Срок введения в действие', kz: 'Қолданысқа енгізу мерзімі', en: 'Entry into force' },
  ownTimeline: { ru: 'Свой срок', kz: 'Өз мерзімім', en: 'Custom' },
  budget: { ru: 'Влияние на бюджет', kz: 'Бюджетке әсері', en: 'Budget impact' },
  more: { ru: 'Ещё варианты', kz: 'Басқа нұсқалар', en: 'More options' },
  moreBusy: { ru: 'Думаю…', kz: 'Ойланып жатырмын…', en: 'Thinking…' },
  back: { ru: 'К брифу', kz: 'Брифке', en: 'Back to the brief' },
  submit: { ru: 'Составить пакет', kz: 'Топтама жасау', en: 'Draft the package' },
  submitBusy: { ru: 'Создаю…', kz: 'Жасап жатырмын…', en: 'Creating…' },
  missing: { ru: 'Не хватает:', kz: 'Жетіспейді:', en: 'Missing:' },
  sheetHint: {
    ru: 'Лист собран из выбранного варианта; разделы напишет модель после «Составить пакет»',
    kz: 'Парақ таңдалған нұсқадан жиналды; бөлімдерді модель «Топтама жасау» кейін жазады',
    en: 'The sheet is built from the chosen option; the model drafts the sections after “Draft the package”',
  },
  pickFirst: { ru: 'Сначала выберите вариант', kz: 'Алдымен нұсқаны таңдаңыз', en: 'Choose an option first' },
}

/** Поля концепта, которые человек правит на месте, — в порядке показа. */
const EDITABLE = [
  'title_ru', 'title_kz', 'problem_description', 'goals', 'key_provisions',
  'target_audience', 'current_legislation_gaps', 'constitutional_basis',
] as const

export function ConceptsScreen({
  result,
  passport,
  onMore,
  moreBusy,
  onSubmit,
  submitBusy,
  onBack,
}: {
  result: BriefResponse
  passport: Passport
  onMore: () => void
  moreBusy: boolean
  onSubmit: (values: Record<string, string>) => void
  submitBusy: boolean
  onBack: () => void
}) {
  const t = useT(dict)
  const toast = useToast()
  const { lang } = useLang()
  const dl = docLang(lang)

  const [selected, setSelected] = useState<number | null>(null)
  // Правки и уточнения — одной картой поверх значений концепта
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [timelinePick, setTimelinePick] = useState<string>('')
  const [budgetPick, setBudgetPick] = useState<string>('')

  const concept: Concept | null = selected === null ? null : result.concepts[selected] ?? null
  const values = useMemo(() => (concept ? conceptValues(concept, edits) : {}), [concept, edits])
  const fieldByName = useMemo(() => new Map(passport.fields.map((f) => [f.name, f])), [passport])
  const set = (name: string, v: string) => setEdits((prev) => ({ ...prev, [name]: v }))

  const select = (i: number) => {
    setSelected(i)
    // Новый выбор — новые правки: правки одного концепта к другому не относятся
    setEdits({})
    setTimelinePick('')
    setBudgetPick('')
  }

  const takeGoals = (from: Concept) => {
    if (!concept) return
    const current = (values.goals ?? '').split('\n').map((s) => s.trim()).filter(Boolean)
    const extra = from.goals.map((s) => s.trim()).filter((g) => g && !current.includes(g))
    set('goals', [...current, ...extra].join('\n'))
  }

  const submit = () => {
    if (!concept) {
      toast(t('pickFirst'), 'err')
      return
    }
    const missing = missingRequired(passport, values)
    if (missing.length) {
      toast(`${t('missing')} ${missing.join(', ')}`, 'err')
      return
    }
    onSubmit(values)
  }

  const cl = result.clarifications
  const tree = useMemo(
    () => (concept ? buildPreviewTree(passport, values, dl, 'law_project') : null),
    [concept, passport, values, dl],
  )

  return (
    <div className="ct-split">
      <div className="ct-split__form">
        <div className="lb-head">
          <H3>{t('title')}</H3>
          <Body tone="mute">{t('lead')}</Body>
        </div>

        <div className="lb-cards">
          {result.concepts.map((c, i) => {
            const on = selected === i
            const dim = selected !== null && !on
            return (
              <article
                key={c.title_ru}
                className={['lb-card', on ? 'lb-card--on' : '', dim ? 'lb-card--dim' : ''].filter(Boolean).join(' ')}
              >
                <H3>{c.title_ru}</H3>
                {c.summary ? <Body tone="ink2">{c.summary}</Body> : null}
                <Body>{c.problem_description}</Body>
                {c.goals.length ? (
                  <div>
                    <Label as="div">{t('goals')}</Label>
                    <ul className="lb-list">{c.goals.map((g) => <li key={g}><UIText>{g}</UIText></li>)}</ul>
                  </div>
                ) : null}
                {c.key_provisions.length ? (
                  <div>
                    <Label as="div">{t('provisions')}</Label>
                    <ul className="lb-list">{c.key_provisions.map((g) => <li key={g}><UIText>{g}</UIText></li>)}</ul>
                  </div>
                ) : null}
                {c.refs.length ? (
                  <div>
                    <Label as="div">{t('basis')}</Label>
                    <div className="lb-refs">
                      {c.refs.map((r) => <Cite key={refCode(r)} code={citeCode(refCode(r), lang)} />)}
                    </div>
                  </div>
                ) : null}
                <div className="lb-card__acts">
                  <Button variant={on ? 'primary' : 'secondary'} onClick={() => select(i)} disabled={on}>
                    {on ? t('chosen') : t('choose')}
                  </Button>
                  {dim ? (
                    <Button variant="ghost" onClick={() => takeGoals(c)}>
                      {t('takeGoals')}
                    </Button>
                  ) : null}
                </div>
              </article>
            )
          })}
        </div>

        {concept ? (
          <>
            <section className="ct-group">
              <div className="ct-group__head">
                <H3>{t('refine')}</H3>
                <Caption tone="mute">{t('refineHint')}</Caption>
              </div>
              {EDITABLE.map((name) => {
                const f = fieldByName.get(name)
                if (!f) return null
                const multiline = f.type === 'textarea' || name === 'goals' || name === 'key_provisions'
                return multiline ? (
                  <Textarea
                    key={name}
                    className="lb-field"
                    label={f.label}
                    hint={f.hint ?? undefined}
                    rows={name === 'goals' || name === 'key_provisions' ? 4 : 3}
                    value={values[name] ?? ''}
                    onChange={(e) => set(name, e.target.value)}
                  />
                ) : (
                  <Input
                    key={name}
                    className="lb-field"
                    label={f.label}
                    hint={f.hint ?? undefined}
                    value={values[name] ?? ''}
                    onChange={(e) => set(name, e.target.value)}
                  />
                )
              })}
            </section>

            <section className="ct-group">
              <div className="ct-group__head">
                <H3>{t('clarify')}</H3>
                <Caption tone="mute">{t('clarifyHint')}</Caption>
              </div>

              {cl.initiator_type ? (
                <div className="lb-field">
                  <Label as="div">{t('initiatorType')}</Label>
                  <div className="lb-chips">
                    {cl.initiator_type.options.map((o) => (
                      <Chip key={o.value} active={values.initiator_type === o.value} onClick={() => set('initiator_type', o.value)}>
                        {o.label}
                      </Chip>
                    ))}
                  </div>
                </div>
              ) : null}

              {cl.initiator ? (
                <div className="lb-field">
                  <Input label={t('initiator')} value={values.initiator ?? ''} onChange={(e) => set('initiator', e.target.value)} />
                  <div className="lb-chips">
                    {cl.initiator.suggestions.map((s) => (
                      <Chip key={s} active={values.initiator === s} onClick={() => set('initiator', s)}>
                        {s}
                      </Chip>
                    ))}
                  </div>
                </div>
              ) : null}

              {cl.implementation_timeline ? (
                <div className="lb-field">
                  <Label as="div">{t('timeline')}</Label>
                  <div className="lb-chips">
                    {cl.implementation_timeline.chips.map((ch) => (
                      <Chip
                        key={ch.key}
                        active={timelinePick === ch.key}
                        onClick={() => {
                          setTimelinePick(ch.key)
                          set('implementation_timeline', ch.value)
                        }}
                      >
                        {ch.label}
                      </Chip>
                    ))}
                    <Chip active={timelinePick === 'own'} onClick={() => setTimelinePick('own')}>
                      {t('ownTimeline')}
                    </Chip>
                  </div>
                  {timelinePick === 'own' ? (
                    <Input
                      className="lb-field"
                      label={t('timeline')}
                      value={values.implementation_timeline ?? ''}
                      onChange={(e) => set('implementation_timeline', e.target.value)}
                    />
                  ) : null}
                </div>
              ) : null}

              {cl.budget_impact ? (
                <div className="lb-field">
                  <Label as="div">{t('budget')}</Label>
                  <div className="lb-chips">
                    {cl.budget_impact.chips.map((ch) => (
                      <Chip
                        key={ch.key}
                        active={budgetPick === ch.key}
                        onClick={() => {
                          setBudgetPick(ch.key)
                          set('budget_impact', ch.value)
                        }}
                      >
                        {ch.label}
                      </Chip>
                    ))}
                  </div>
                  {budgetPick ? (
                    <Textarea
                      className="lb-field"
                      label={fieldByName.get('budget_impact')?.label ?? t('budget')}
                      rows={4}
                      value={values.budget_impact ?? ''}
                      onChange={(e) => set('budget_impact', e.target.value)}
                    />
                  ) : null}
                </div>
              ) : null}
            </section>
          </>
        ) : null}

        <div className="ct-actions lb-actions">
          <Button variant="ghost" onClick={onBack} disabled={submitBusy}>
            {t('back')}
          </Button>
          <Button variant="secondary" onClick={onMore} disabled={moreBusy || submitBusy}>
            {moreBusy ? t('moreBusy') : t('more')}
          </Button>
          <Button variant="primary" onClick={submit} disabled={!concept || submitBusy}>
            {submitBusy ? t('submitBusy') : t('submit')}
          </Button>
        </div>
      </div>

      {tree ? (
        <BuilderAside
          tree={tree}
          head={
            <Caption tone="mute" className="sheet__hint">
              {t('sheetHint')}
            </Caption>
          }
        />
      ) : null}
    </div>
  )
}
```

Если у `Textarea`/`Input` нет пропа `className` — обернуть в `<div className="lb-field">` вместо передачи класса.

- [ ] **Step 3: Стили**

В конец `frontend/src/features/laws/laws.css`:

```css
/* ---------- Бриф → концепты ----------
   Три карточки — три законопроекта: выбранная подчёркнута печатью, остальные
   притушены, но остаются под рукой, чтобы забрать из них цели. */
.lb-head { display: grid; gap: var(--s-2); margin-top: var(--s-5); }
.lb-brief { display: grid; gap: var(--s-5); margin-top: var(--s-5); }
.lb-domains, .lb-chips, .lb-refs { display: flex; flex-wrap: wrap; gap: var(--s-2); margin-top: var(--s-2); }
.lb-files { display: flex; flex-wrap: wrap; align-items: center; gap: var(--s-2); margin-top: var(--s-2); }
.lb-file {
  display: inline-flex;
  align-items: baseline;
  gap: var(--s-2);
  padding: var(--s-1) var(--s-3);
  border: var(--border);
  border-radius: var(--radius-pill);
}
.lb-actions { display: flex; flex-wrap: wrap; align-items: center; gap: var(--s-3); }

.lb-think { display: grid; gap: var(--s-3); padding: var(--s-8) 0; max-width: 60ch; }
.lb-think__stage {
  display: flex;
  align-items: baseline;
  gap: var(--s-3);
  color: var(--mute);
  transition: color var(--motion-state);
}
.lb-think__stage--on { color: var(--ink); }
.lb-think__stage--done { color: var(--ink-2); }
.lb-think__no { flex: none; color: var(--mute); }

.lb-cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--s-4); margin-top: var(--s-5); }
.lb-card {
  display: flex;
  flex-direction: column;
  gap: var(--s-3);
  padding: var(--s-5);
  border: var(--border);
  background: var(--paper);
  transition: border-color var(--motion), opacity var(--motion);
}
.lb-card--on { border-color: var(--seal); }
.lb-card--dim { opacity: 0.72; }
.lb-card__acts { margin-top: auto; display: flex; flex-wrap: wrap; gap: var(--s-2); padding-top: var(--s-2); }
.lb-list { margin: var(--s-1) 0 0; padding-left: var(--s-5); display: grid; gap: var(--s-1); }
.lb-field { margin-top: var(--s-4); }

@media (max-width: 1100px) { .lb-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 620px) { .lb-cards { grid-template-columns: minmax(0, 1fr); } }
```

- [ ] **Step 4: Проверить типы и линтер**

Run: `cd frontend && npm run check`
Expected: без ошибок (компонент пока никем не используется — это допустимо для экспортов).

- [ ] **Step 5: Закоммитить**

```bash
git add frontend/src/features/laws/concepts.ts frontend/src/features/laws/ConceptsScreen.tsx frontend/src/features/laws/laws.css
git commit -m "$(cat <<'EOF'
feat(laws): экран концептов — три варианта, правка, уточнения чипами

Выбор вместо набора: человек читает три готовых законопроекта и берёт
один; недостающее — инициатор, срок, бюджет — спрашивается чипами,
которые разворачиваются в готовый текст. Лист справа собирается из
выбранного, как в прежнем мастере.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Экран брифа и маршрут

**Files:**
- Create: `frontend/src/features/laws/BriefPage.tsx`
- Modify: `frontend/src/app/routes.tsx`

**Interfaces:**
- Consumes: `ConceptsScreen`, типы из `concepts.ts`, `upload()` из `features/workspace/upload`, `api`, `useLoader`, `LawTabs`, `BuilderAside`, `buildPreviewTree`.
- Produces: `BriefPage` на `/laws/new`; после «Составить пакет» — `POST /drafts` + `POST /drafts/<id>/generate` + переход на `/laws/<id>` (документ подхватывает задачу — Task 6).

- [ ] **Step 1: Страница брифа**

```tsx
// frontend/src/features/laws/BriefPage.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Body, Button, Caption, Chip, Display, Label, Loading, Mono, Textarea, UIText, useToast } from '../../shared/ui'
import { useLang, useT, withLang } from '../../i18n'
import type { Dict } from '../../i18n'
import { ApiError, api, errorMessage } from '../../shared/api'
import { upload } from '../workspace/upload'
import { BuilderAside } from '../drafts/BuilderAside'
import { ListSkeleton, LoadFailure, useLoader } from '../drafts/shared'
import { buildPreviewTree, docLang } from '../drafts/preview'
import type { DraftResponse, JobResponse, PassportResponse } from '../drafts/types'
import { LawTabs } from './shared'
import { ConceptsScreen } from './ConceptsScreen'
import { THINK_STAGES } from './concepts'
import type { BriefAttachment, BriefResponse, DomainsResponse } from './concepts'

/**
 * Новый законопроект: бриф → концепты → пакет.
 *
 * Вместо формы на семнадцать полей человек даёт контекст — пару фраз, файлы,
 * сферу — и выбирает один из трёх концептов, которые предлагает модель.
 * Выбранное становится значениями паспорта; пакет составляется тем же
 * обработчиком, что и раньше, и ничем не отличается от собранного формой.
 */

const dict: Dict = {
  title: { ru: 'Новый законопроект', kz: 'Жаңа заң жобасы', en: 'New draft law' },
  briefLabel: { ru: 'О чём закон', kz: 'Заң не туралы', en: 'What the law is about' },
  briefHint: {
    ru: 'Своими словами: какая проблема, кого касается, что должно измениться. Можно оставить пустым и выбрать только сферу.',
    kz: 'Өз сөзіңізбен: қандай мәселе, кімге қатысты, не өзгеруі керек. Бос қалдырып, тек сфераны таңдауға болады.',
    en: 'In your own words: the problem, who it affects, what should change. You may leave it empty and pick only the area.',
  },
  domain: { ru: 'Сфера', kz: 'Сфера', en: 'Area' },
  files: { ru: 'Материалы', kz: 'Материалдар', en: 'Materials' },
  filesHint: {
    ru: 'PDF или DOCX: аналитические записки, обзоры, прежние редакции. Текст извлекается сразу, файлы никуда не уходят.',
    kz: 'PDF немесе DOCX: талдамалық жазбалар, шолулар, бұрынғы редакциялар. Мәтін дереу алынады.',
    en: 'PDF or DOCX: analytical notes, reviews, earlier versions. Text is extracted at once; files are not stored.',
  },
  attach: { ru: 'Приложить файл', kz: 'Файл тіркеу', en: 'Attach a file' },
  uploading: { ru: 'Читаю файл…', kz: 'Файлды оқып жатырмын…', en: 'Reading the file…' },
  chars: { ru: 'знаков', kz: 'таңба', en: 'characters' },
  remove: { ru: 'Снять', kz: 'Алып тастау', en: 'Remove' },
  propose: { ru: 'Предложить варианты', kz: 'Нұсқалар ұсыну', en: 'Propose options' },
  example: { ru: 'Пример брифа', kz: 'Бриф үлгісі', en: 'Example brief' },
  exampleDone: {
    ru: 'Подставлен пример — можно менять или сразу просить варианты',
    kz: 'Үлгі қойылды — өзгертуге немесе бірден нұсқалар сұрауға болады',
    en: 'Example inserted — edit it or ask for options right away',
  },
  thinking: { ru: 'Готовлю варианты', kz: 'Нұсқаларды дайындап жатырмын', en: 'Preparing options' },
  reading: { ru: 'Читаю бриф и материалы', kz: 'Бриф пен материалдарды оқып жатырмын', en: 'Reading the brief and materials' },
  searching: { ru: 'Ищу нормы в корпусе', kz: 'Корпустан нормаларды іздеп жатырмын', en: 'Searching the corpus for norms' },
  drafting: { ru: 'Формулирую три варианта', kz: 'Үш нұсқаны тұжырымдап жатырмын', en: 'Formulating three options' },
  thinkNote: {
    ru: 'Обычно 10–20 секунд: модель читает найденные нормы и пишет три разных подхода.',
    kz: 'Әдетте 10–20 секунд: модель табылған нормаларды оқып, үш түрлі тәсіл жазады.',
    en: 'Usually 10–20 seconds: the model reads the norms found and writes three different approaches.',
  },
  errBrief: { ru: 'Не удалось получить варианты', kz: 'Нұсқаларды алу мүмкін болмады', en: 'Could not get the options' },
  errUpload: { ru: 'Файл не прочитан', kz: 'Файл оқылмады', en: 'The file could not be read' },
  errCreate: { ru: 'Не удалось создать пакет', kz: 'Топтама жасау мүмкін болмады', en: 'Could not create the package' },
  errGenerate: {
    ru: 'Пакет создан, но составление не запустилось — попробуйте на странице документа',
    kz: 'Топтама жасалды, бірақ құрастыру іске қосылмады — құжат бетінде қайта көріңіз',
    en: 'The package was created but drafting did not start — try from the document page',
  },
  sheetHint: {
    ru: 'Лист соберётся из выбранного варианта',
    kz: 'Парақ таңдалған нұсқадан жиналады',
    en: 'The sheet will be built from the chosen option',
  },
  caveat: { ru: 'Оговорка', kz: 'Ескертпе', en: 'Caveat' },
  notReviewed: { ru: 'Не вычитан юристом', kz: 'Заңгер тексермеген', en: 'Not reviewed by a lawyer' },
}

type Phase = 'brief' | 'thinking' | 'concepts'

const TYPE_ID = 'law_project'
const STAGE_MS = 4500

export function BriefPage() {
  const t = useT(dict)
  const toast = useToast()
  const navigate = useNavigate()
  const { lang } = useLang()
  const dl = docLang(lang)

  const passportLoad = useLoader<PassportResponse>(
    () => api.get<PassportResponse>(`/drafts/passport/${TYPE_ID}?lang=${dl}`),
    [dl],
  )
  const domainsLoad = useLoader<DomainsResponse>(
    () => api.get<DomainsResponse>(`/drafts/brief/domains?lang=${dl}`),
    [dl],
  )
  const passport = passportLoad.data?.passport ?? null
  const domains = domainsLoad.data?.domains ?? []

  const [phase, setPhase] = useState<Phase>('brief')
  const [text, setText] = useState('')
  const [domain, setDomain] = useState('')
  const [attachments, setAttachments] = useState<BriefAttachment[]>([])
  const [uploading, setUploading] = useState(0)
  const [result, setResult] = useState<BriefResponse | null>(null)
  const [moreBusy, setMoreBusy] = useState(false)
  const [submitBusy, setSubmitBusy] = useState(false)
  const [stage, setStage] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)

  // Стадии ожидания идут по времени: сервер отвечает одним куском, а человеку
  // нужно видеть, что работа идёт. Названия — то, что сервер действительно делает.
  useEffect(() => {
    if (phase !== 'thinking') {
      setStage(0)
      return
    }
    const timer = window.setInterval(() => setStage((s) => Math.min(s + 1, THINK_STAGES.length - 1)), STAGE_MS)
    return () => window.clearInterval(timer)
  }, [phase])

  const canAsk = Boolean(text.trim() || domain || attachments.some((a) => a.text.trim())) && uploading === 0

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return
    for (const f of Array.from(files)) {
      setUploading((n) => n + 1)
      try {
        const form = new FormData()
        form.append('file', f)
        const res = await upload<{ text: string; filename: string; length: number }>('/api/chat/upload', form)
        setAttachments((prev) => [...prev, { filename: res.filename || f.name, text: res.text, length: res.length ?? res.text.length }])
      } catch (e) {
        toast(`${f.name}: ${errorMessage(e, t('errUpload'))}`, 'err')
      } finally {
        setUploading((n) => n - 1)
      }
    }
  }

  const askConcepts = useCallback(
    async (avoid: string[] = []) => {
      const more = avoid.length > 0
      if (more) setMoreBusy(true)
      else setPhase('thinking')
      try {
        const res = await api.post<BriefResponse>('/drafts/brief', {
          type_id: TYPE_ID,
          lang: dl,
          text,
          domain,
          attachments: attachments.map(({ filename, text: body }) => ({ filename, text: body })),
          avoid,
        })
        setResult(res)
        setPhase('concepts')
      } catch (e) {
        if (e instanceof ApiError && e.unauthorized) {
          window.location.assign('/login?next=/laws/new')
          return
        }
        toast(errorMessage(e, t('errBrief')), 'err')
        if (!more) setPhase('brief')
      } finally {
        setMoreBusy(false)
      }
    },
    [dl, text, domain, attachments, t, toast],
  )

  const fillExample = () => {
    const ex = domainsLoad.data?.example
    if (!ex) return
    setText(ex.text)
    setDomain(ex.domain)
    toast(t('exampleDone'))
  }

  const submit = async (values: Record<string, string>) => {
    setSubmitBusy(true)
    let draftId = ''
    try {
      // Каркас приходит мгновенно: пакет существует ещё до того, как модель
      // напишет первый раздел, и не теряется при обрыве составления.
      const created = await api.post<DraftResponse>('/drafts', {
        type_id: TYPE_ID,
        lang: dl,
        values: { ...values, lang: dl },
        title: values.title_ru || undefined,
      })
      draftId = created.draft.id
    } catch (e) {
      setSubmitBusy(false)
      toast(errorMessage(e, t('errCreate')), 'err')
      return
    }
    try {
      await api.post<JobResponse>(`/drafts/${draftId}/generate`, {})
    } catch (e) {
      toast(errorMessage(e, t('errGenerate')), 'err')
    }
    // Ход генерации показывает страница документа: она подхватывает задачу
    // из ответа сервера, поэтому ждать здесь нечего.
    navigate(withLang(`/laws/${draftId}`, lang))
  }

  const emptyTree = useMemo(
    () => (passport ? buildPreviewTree(passport, { lang: dl }, dl, 'law_project') : null),
    [passport, dl],
  )

  if (passportLoad.loading || domainsLoad.loading) {
    return (
      <div className="page">
        <LawTabs />
        <ListSkeleton rows={8} />
      </div>
    )
  }
  if (passportLoad.error || !passport) {
    return (
      <div className="page">
        <LawTabs />
        <div className="ct-state">
          <LoadFailure error={passportLoad.error} onRetry={passportLoad.reload} />
        </div>
      </div>
    )
  }

  const domainLabel = domains.find((d) => d.key === domain)?.label

  return (
    <div className="page ct-builder">
      <div className="page__head">
        <div className="page__title">
          <Display>{t('title')}</Display>
          <Body tone="mute">{passport.summary}</Body>
        </div>
      </div>

      <LawTabs />

      {passport.reviewed ? null : (
        <div className="ct-flag ct-flag--warn">
          <span className="status status--warn">{t('notReviewed')}</span>
        </div>
      )}
      {passport.caveat ? (
        <details className="ct-caveat">
          <summary className="ct-caveat__head">
            <Label as="span">{t('caveat')}</Label>
          </summary>
          <Caption tone="ink2" className="ct-caveat__body">
            {passport.caveat}
          </Caption>
        </details>
      ) : null}

      {phase === 'concepts' && result ? (
        <ConceptsScreen
          result={result}
          passport={passport}
          onMore={() => askConcepts(result.concepts.map((c) => c.title_ru))}
          moreBusy={moreBusy}
          onSubmit={submit}
          submitBusy={submitBusy}
          onBack={() => setPhase('brief')}
        />
      ) : (
        <div className="ct-split">
          <div className="ct-split__form">
            {phase === 'thinking' ? (
              <div className="lb-think" role="status" aria-live="polite">
                <Loading label={t('thinking')} />
                {THINK_STAGES.map((s, i) => (
                  <div
                    key={s}
                    className={[
                      'lb-think__stage',
                      i === stage ? 'lb-think__stage--on' : i < stage ? 'lb-think__stage--done' : '',
                    ].filter(Boolean).join(' ')}
                  >
                    <span className="lb-think__no tabular">{i + 1}</span>
                    <UIText>
                      {t(s)}
                      {s === 'searching' && domainLabel ? ` — ${domainLabel}` : ''}
                    </UIText>
                  </div>
                ))}
                <Caption tone="mute">{t('thinkNote')}</Caption>
              </div>
            ) : (
              <div className="lb-brief">
                <Textarea
                  label={t('briefLabel')}
                  hint={t('briefHint')}
                  rows={6}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />

                <div>
                  <Label as="div">{t('domain')}</Label>
                  <div className="lb-domains">
                    {domains.map((d) => (
                      <Chip key={d.key} active={domain === d.key} onClick={() => setDomain(domain === d.key ? '' : d.key)}>
                        {d.label}
                      </Chip>
                    ))}
                  </div>
                </div>

                <div>
                  <Label as="div">{t('files')}</Label>
                  <div className="lb-files">
                    {attachments.map((a, i) => (
                      <span className="lb-file" key={`${a.filename}-${i}`}>
                        <Mono tone="ink2">{a.filename}</Mono>
                        <Caption tone="mute" as="span">
                          {a.length} {t('chars')}
                        </Caption>
                        <Button
                          variant="ghost"
                          aria-label={`${t('remove')} ${a.filename}`}
                          onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
                        >
                          {t('remove')}
                        </Button>
                      </span>
                    ))}
                    <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={uploading > 0}>
                      {uploading > 0 ? t('uploading') : t('attach')}
                    </Button>
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".pdf,.docx"
                      multiple
                      className="visually-hidden"
                      tabIndex={-1}
                      aria-hidden="true"
                      onChange={(e) => {
                        void addFiles(e.target.files)
                        e.target.value = ''
                      }}
                    />
                  </div>
                  <Caption tone="mute">{t('filesHint')}</Caption>
                </div>

                <div className="lb-actions">
                  <Button variant="primary" size="lg" disabled={!canAsk} onClick={() => askConcepts()}>
                    {t('propose')}
                  </Button>
                  <Button variant="ghost" onClick={fillExample}>
                    {t('example')}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {emptyTree ? (
            <BuilderAside
              tree={emptyTree}
              head={
                <Caption tone="mute" className="sheet__hint">
                  {t('sheetHint')}
                </Caption>
              }
            />
          ) : null}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Маршрут**

В `frontend/src/app/routes.tsx` заменить ленивый импорт мастера:

```ts
const LawWizardPage = lazy(() =>
  import('../features/laws/BriefPage').then((m) => ({ default: m.BriefPage })),
)
```

(имя переменной и строка маршрута `{ path: 'laws/new', element: <Deferred><LawWizardPage /></Deferred> }` не меняются — так правка минимальна).

- [ ] **Step 3: Проверить типы, линтер, сборку**

Run: `cd frontend && npm run check && npm run build`
Expected: без ошибок. Если `tsc` укажет на неиспользуемые импорты — убрать их.

- [ ] **Step 4: Проверить в браузере (локально нельзя — только прод после выкладки в Task 9)**

Сценарий: `/laws/new` под `uxcheck@dalel.test` → «Пример брифа» (текст и сфера подставились) → «Предложить варианты» → стадии ожидания сменяются → три карточки с чипами норм → «Выбрать» на второй → поправить цель → «Добавить цели отсюда» с первой → чипы: «Министерство», подсказка инициатора, «Через 6 месяцев», «Без дополнительных расходов» → лист справа обновляет заголовок → «Составить пакет» → страница документа со строкой стадии и каскадом → «Разделы составлены: 11».

- [ ] **Step 5: Закоммитить**

```bash
git add frontend/src/features/laws/BriefPage.tsx frontend/src/app/routes.tsx
git commit -m "$(cat <<'EOF'
feat(laws): бриф вместо формы — контекст, файлы, сфера, три варианта

Новый законопроект начинается с брифа: пара фраз, приложенные PDF/DOCX
(текст извлекается сразу), сфера из корпуса. Пока модель думает — честные
стадии того, что делает сервер. Дальше — экран концептов и создание
пакета; ход генерации показывает страница документа.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Убрать мастер, выкатить, проверить на проде

**Files:**
- Delete: `frontend/src/features/laws/WizardPage.tsx`
- Modify: `frontend/src/features/laws/laws.css`

- [ ] **Step 1: Удалить мастер и его стили**

```bash
git rm frontend/src/features/laws/WizardPage.tsx
```

В `frontend/src/features/laws/laws.css` удалить блоки правил, которыми пользовался только мастер: `.lw-steps`, `.lw-steps__list`, `.lw-steps__count`, `.lw-step`, `.lw-step:hover`, `.lw-step--done`, `.lw-step--on`, `.lw-step__no`, `.lw-step--on .lw-step__no`, `.lw-stage`, `.lw-block`, `.lw-block__head`, `.lw-actions`, `.lw-review`, `.lw-review__block`, `.lw-package*`, `.lw-gauge*`, `.lw-missing*`. Оставить `.lw-toc*` — ими пользуется страница документа.

Проверить, что классы больше никем не используются:

```bash
cd frontend/src && for c in lw-steps lw-step lw-stage lw-block lw-actions lw-review lw-package lw-gauge lw-missing; do echo -n "$c: "; grep -rl "$c" --include='*.tsx' . | wc -l; done
```

Expected: везде `0`.

- [ ] **Step 2: Проверить типы, линтер, сборку, тесты**

Run: `cd frontend && npm run check && npm run build && cd .. && python3 -m pytest tests/ -q`
Expected: всё зелёное.

- [ ] **Step 3: Закоммитить и запушить**

```bash
git add -A frontend/src/features/laws
git commit -m "$(cat <<'EOF'
chore(laws): мастер на четыре шага убран — его место занял бриф

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
git push origin version4redisign
```

- [ ] **Step 4: Выкатить на прод**

```bash
cd /Users/nurlykhan/law_rag
sshpass -p "$DMZ_PASS" rsync -az --delete --exclude '__devlogin.html' \
  -e "ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR" \
  static/app/ user@95.141.135.244:~/dalel/static/app/
sshpass -p "$DMZ_PASS" ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null user@95.141.135.244 \
  'cd ~/dalel && git pull -q origin version4redisign && docker compose -f docker-compose.demo.yml build app && docker compose -f docker-compose.demo.yml up -d app && sleep 30 && docker ps --filter name=dalel-app --format "{{.Names}} {{.Status}}" && curl -s -o /dev/null -w "healthz %{http_code}\n" http://localhost:5003/healthz'
```

Expected: `dalel-app Up … (healthy)`, `healthz 200`. Пересборка образа — несколько минут (кэш зависимостей сохраняется, пересобирается слой с кодом).

- [ ] **Step 5: Дымовая проверка ручек**

```bash
curl -s "https://law.archeo.asia/api/drafts/brief/domains?lang=ru" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d['domains']), 'сфер; пример:', d['example']['domain'])"
curl -s -o /dev/null -w "brief без входа: %{http_code}\n" -X POST https://law.archeo.asia/api/drafts/brief -H 'Content-Type: application/json' -d '{"domain":"civil"}'
```

Expected: `10 сфер; пример: civil`, `brief без входа: 401`.

- [ ] **Step 6: Сквозная проверка в браузере**

Под `uxcheck@dalel.test` пройти сценарий из Task 8, шаг 4. Отдельно убедиться:

- на `/contracts/new/lease` кнопка «Заполнить примером» и форма работают как прежде;
- на странице готового договора «Переписать раздел» показывает строку стадии и каскад;
- гостю `/laws/new` показывает бриф, а «Предложить варианты» уводит на вход.

- [ ] **Step 7: Обновить память проекта**

В `reference_dmz_demo.md` добавить: маршрут `/laws/new` — бриф, мастер удалён; ручки `/api/drafts/brief*`; `Job.result_json` во время работы несёт стадии — если появится другой потребитель `result`, учитывать это.
