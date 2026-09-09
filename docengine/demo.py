"""
Демонстрационное заполнение конструктора.

Показать составление документа, не набирая полтора десятка полей руками, —
обычная нужда на показе. Значения полей берутся из паспорта (`example`), а
реквизиты сторон — отсюда: их форма собирает по общему правилу
`party<i>_<attr>`, и в паспорте каждого договора они повторялись бы слово
в слово.

Данные правдоподобные, но вымышленные: несуществующие БИН/ИИН и адреса,
организации, которых нет в реестре. Документ, составленный по ним, годится
для показа, а не для подписи.
"""
from __future__ import annotations

from .passport import Passport

# Стороны: первая — ТОО, вторая — ИП. Такой пары хватает всем договорам
# каталога: там, где вторая сторона обязана быть гражданином (трудовой
# договор), вид стороны переопределяется ниже по kinds паспорта.
_LEGAL = {
    'kind': 'legal',
    'name': {'ru': 'ТОО «Алатау Логистик»', 'kk': '«Алатау Логистик» ЖШС', 'en': 'Alatau Logistics LLP'},
    'id_no': '051140004321',
    'address': {
        'ru': 'г. Алматы, ул. Тимирязева, 42, офис 305',
        'kk': 'Алматы қ., Тимирязев к-сі, 42, 305-кеңсе',
        'en': '42 Timiryazev St, office 305, Almaty',
    },
    'phone': '+7 727 350 41 20',
    'email': 'office@alatau-logistic.kz',
    'bank': {'ru': 'АО «Народный Банк Казахстана»', 'kk': '«Қазақстан Халық Банкі» АҚ', 'en': 'Halyk Bank JSC'},
    'iban': 'KZ756010111000012345',
    'bik': 'HSBKKZKX',
    'signatory': {'ru': 'Сериков Данияр Маратович', 'kk': 'Сериков Данияр Маратұлы', 'en': 'Daniyar Serikov'},
    'signatory_role': {'ru': 'директор', 'kk': 'директор', 'en': 'director'},
    'basis': {'ru': 'устава', 'kk': 'жарғы', 'en': 'the charter'},
}

_IP = {
    'kind': 'ip',
    'name': {'ru': 'ИП Досаев А.К.', 'kk': 'ЖК Досаев А.Қ.', 'en': 'Sole trader A. Dosayev'},
    'id_no': '870312300145',
    'address': {
        'ru': 'г. Астана, пр. Кабанбай батыра, 17, кв. 88',
        'kk': 'Астана қ., Қабанбай батыр д-лы, 17, 88-пәтер',
        'en': '17 Kabanbai Batyr Ave, apt 88, Astana',
    },
    'phone': '+7 701 224 88 30',
    'email': 'dosayev@mail.kz',
    'bank': {'ru': 'АО «Kaspi Bank»', 'kk': '«Kaspi Bank» АҚ', 'en': 'Kaspi Bank JSC'},
    'iban': 'KZ049470398765432101',
    'bik': 'CASPKZKA',
    'signatory': {'ru': 'Досаев Арман Кайратович', 'kk': 'Досаев Арман Қайратұлы', 'en': 'Arman Dosayev'},
    'signatory_role': {'ru': 'индивидуальный предприниматель', 'kk': 'жеке кәсіпкер', 'en': 'sole trader'},
    'basis': {'ru': 'свидетельства о регистрации', 'kk': 'тіркеу туралы куәлік', 'en': 'the registration certificate'},
}

_INDIVIDUAL = {
    'kind': 'individual',
    'name': {'ru': 'Нурланова Айгуль Ерлановна', 'kk': 'Нұрланова Айгүл Ерланқызы', 'en': 'Aigul Nurlanova'},
    'id_no': '920715400287',
    'address': {
        'ru': 'г. Алматы, мкр. Самал-2, д. 33, кв. 14',
        'kk': 'Алматы қ., Самал-2 ы/а, 33-үй, 14-пәтер',
        'en': '33 Samal-2, apt 14, Almaty',
    },
    'phone': '+7 705 611 09 47',
    'email': 'a.nurlanova@gmail.com',
    'bank': {'ru': 'АО «Kaspi Bank»', 'kk': '«Kaspi Bank» АҚ', 'en': 'Kaspi Bank JSC'},
    'iban': 'KZ938562030004567890',
    'bik': 'CASPKZKA',
    'signatory': '',
    'signatory_role': '',
    'basis': '',
}

_BY_KIND = {'legal': _LEGAL, 'ip': _IP, 'individual': _INDIVIDUAL}


def _tr(value, lang: str) -> str:
    """Значение на нужном языке: строка — как есть, словарь — по ключу."""
    if isinstance(value, dict):
        return str(value.get(lang) or value.get('ru') or '')
    return str(value or '')


def demo_values(passport: Passport, lang: str = 'ru') -> dict[str, str]:
    """Значения формы для показа: примеры полей плюс реквизиты сторон."""
    lang = lang if lang in ('ru', 'kk', 'en') else 'ru'
    values: dict[str, str] = {}

    for field in passport.fields:
        if field.example is None:
            continue
        values[field.name] = field.example.get(lang) or ''

    for idx, spec in enumerate(passport.parties):
        # Вид стороны — первый допустимый по паспорту: у трудового договора
        # работник может быть только гражданином, и подставлять туда ТОО нельзя.
        kinds = spec.kinds or ['legal']
        preferred = ['legal', 'ip', 'individual'] if idx == 0 else ['ip', 'individual', 'legal']
        kind = next((k for k in preferred if k in kinds), kinds[0])
        party = _BY_KIND.get(kind, _LEGAL)
        for attr, value in party.items():
            values[f'party{idx}_{attr}'] = _tr(value, lang)

    return values
