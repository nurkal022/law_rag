"""
Каркас документа без единого обращения к модели.

Смысл отдельного шага в том, что пользователь заполнил форму — и лист уже
перед ним: шапка, город, дата, реквизиты обеих сторон, преамбула и оглавление
со всеми разделами. Ждать модель ради того, чтобы увидеть «1. Предмет
договора», незачем: состав разделов известен из паспорта, а реквизиты — из
формы. Разделы помечены pending, и генерация потом наполняет их по одному,
не меняя структуру. Так интерфейс отзывчив, а прогресс виден по местам,
которые уже нарисованы.
"""

from __future__ import annotations

import datetime as _dt
from typing import Any, Optional

from .passport import COMMON_PARTY_FIELDS, Passport
from .schema import DocTree, Meta, Party, Requisites, Section, renumber

# Реквизиты стороны, которые вообще имеет смысл искать в форме.
PARTY_ATTRS = tuple(COMMON_PARTY_FIELDS) + ('phone', 'email', 'kind')


def _first(values: dict, *keys: str) -> str:
    """Первое непустое значение из формы по списку синонимов ключа."""
    for k in keys:
        v = values.get(k)
        if v not in (None, ''):
            return str(v).strip()
    return ''


def _party_value(passport: Passport, values: dict, idx: int, attr: str) -> str:
    """Значение реквизита стороны idx.

    Имя поля в паспорте произвольно («seller_name», «p0_name», «name_0»),
    поэтому сначала спрашиваем паспорт: у поля есть party и суффикс. И только
    затем пробуем общепринятые ключи — форма может прийти и без паспорта
    (черновик, импорт, тест).
    """
    for f in passport.fields:
        if f.party == idx and (f.name == attr or f.name.endswith('_' + attr)):
            v = values.get(f.name)
            if v not in (None, ''):
                return str(v).strip()
    return _first(
        values,
        f'party{idx}_{attr}',
        f'p{idx}_{attr}',
        f'parties.{idx}.{attr}',
        f'{attr}_{idx}',
    )


def build_parties(passport: Passport, values: dict) -> list[Party]:
    """Стороны из формы: роли берём из паспорта, содержимое — из значений."""
    parties: list[Party] = []
    for idx, spec in enumerate(passport.parties):
        kind = _party_value(passport, values, idx, 'kind') or (spec.kinds[0] if spec.kinds else 'legal')
        if kind not in ('legal', 'individual', 'ip'):
            kind = 'legal'
        data: dict[str, Any] = {'role': spec.role.get(_lang_of(values)), 'kind': kind}
        for attr in PARTY_ATTRS:
            if attr == 'kind':
                continue
            data[attr] = _party_value(passport, values, idx, attr)
        parties.append(Party(**data))
    return parties


def _lang_of(values: dict) -> str:
    lang = values.get('lang') or values.get('language') or 'ru'
    return lang if lang in ('ru', 'kk', 'en') else 'ru'


# ------------------------------------------------------------- преамбула

# Формулировка зависит от того, кто заключает договор: у организации есть
# подписант и основание полномочий, у физлица — только имя и ИИН. Смешивать
# нельзя: «в лице директора» у гражданина выглядит как ошибка составителя.
_PREAMBLE_TAIL = {
    'ru': 'заключили настоящий договор о нижеследующем:',
    'kk': 'осы шартты төмендегілер туралы жасасты:',
    'en': 'have entered into this agreement as follows:',
}
_SIDES = {
    'ru': ['с одной стороны', 'с другой стороны', 'с третьей стороны', 'с четвёртой стороны'],
    'kk': ['бір тараптан', 'екінші тараптан', 'үшінші тараптан', 'төртінші тараптан'],
    'en': ['on the one hand', 'on the other hand', 'on the third hand', 'on the fourth hand'],
}
_NAMED = {
    'ru': ('именуемое в дальнейшем', 'именуемый в дальнейшем'),
    'kk': ('бұдан әрі', 'бұдан әрі'),
    'en': ('hereinafter referred to as', 'hereinafter referred to as'),
}
_ID_WORD = {'ru': ('БИН', 'ИИН'), 'kk': ('БСН', 'ЖСН'), 'en': ('BIN', 'IIN')}


def party_phrase(party: Party, lang: str = 'ru') -> str:
    """Описание одной стороны для преамбулы."""
    lang = lang if lang in _PREAMBLE_TAIL else 'ru'
    name = party.name or '____________________'
    bin_word, iin_word = _ID_WORD[lang]
    neuter, masc = _NAMED[lang]
    parts: list[str] = []

    if party.kind == 'legal':
        parts.append(name)
        parts.append(f'{bin_word} {party.id_no or "____________"}')
        if party.signatory:
            role = party.signatory_role or ('директора' if lang == 'ru' else 'director')
            if lang == 'ru':
                parts.append(f'в лице {role} {party.signatory}')
                parts.append(f'действующего на основании {party.basis or "устава"}')
            elif lang == 'kk':
                parts.append(f'{role} {party.signatory} атынан')
                parts.append(f'{party.basis or "жарғы"} негізінде әрекет ететін')
            else:
                parts.append(f'represented by {role} {party.signatory}')
                parts.append(f'acting on the basis of the {party.basis or "charter"}')
        named = neuter
    elif party.kind == 'ip':
        if lang == 'ru':
            parts.append(f'индивидуальный предприниматель {name}')
        elif lang == 'kk':
            parts.append(f'жеке кәсіпкер {name}')
        else:
            parts.append(f'individual entrepreneur {name}')
        parts.append(f'{iin_word} {party.id_no or "____________"}')
        if lang == 'ru':
            parts.append(f'действующий на основании {party.basis or "свидетельства о государственной регистрации"}')
        named = masc
    else:
        parts.append(name)
        parts.append(f'{iin_word} {party.id_no or "____________"}')
        named = masc

    parts.append(f'{named} «{party.role}»')
    return ', '.join(p for p in parts if p)


def build_preamble(requisites: Requisites, lang: str = 'ru') -> str:
    """Стандартная вводная формула РК."""
    lang = lang if lang in _PREAMBLE_TAIL else 'ru'
    sides = _SIDES[lang]
    chunks: list[str] = []
    for i, party in enumerate(requisites.parties):
        side = sides[i] if i < len(sides) else sides[-1]
        chunks.append(f'{party_phrase(party, lang)}, {side}')
    joiner = ', и ' if lang == 'ru' else (', және ' if lang == 'kk' else ', and ')
    return joiner.join(chunks) + ', ' + _PREAMBLE_TAIL[lang]


# ---------------------------------------------------------------- каркас


def build_skeleton(passport: Passport, values: dict, lang: str = 'ru') -> DocTree:
    """Полный каркас документа: мета, реквизиты, преамбула, пустые разделы.

    Разделы создаются все и сразу с pending=True — оглавление не должно
    прыгать по мере генерации, иначе пользователь читает лист, который под
    ним перестраивается.
    """
    lang = lang if lang in ('ru', 'kk', 'en') else 'ru'
    values = dict(values or {})
    values.setdefault('lang', lang)

    meta = Meta(
        kind=passport.kind,
        type_id=passport.id,
        lang=lang,
        title=passport.name.get(lang),
        subtitle=passport.summary.get(lang) or None,
        form=passport.form.get(lang) or None,
        legal_basis=[r.model_copy(deep=True) for r in passport.legal_basis],
    )

    requisites = Requisites(
        number=_first(values, 'number', 'contract_number', 'doc_number'),
        city=_first(values, 'city', 'place', 'city_of_signing'),
        date=_first(values, 'date', 'contract_date', 'sign_date') or _dt.date.today().isoformat(),
        parties=build_parties(passport, values),
    )

    tree = DocTree(
        meta=meta,
        requisites=requisites,
        preamble=build_preamble(requisites, lang),
        sections=[
            Section(key=spec.key, title=spec.title.get(lang), clauses=[], pending=True)
            for spec in passport.sections
        ],
    )
    return renumber(tree)
