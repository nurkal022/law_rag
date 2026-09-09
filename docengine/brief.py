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

from pydantic import BaseModel, Field, field_validator

from .passport import Passport
from .schema import Ref

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
        # Один вариант — не выбор; больше трёх — не помещается ни в экран, ни во внимание.
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
