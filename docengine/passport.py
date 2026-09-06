"""
Паспорт типа документа.

Паспорт — это данные, а не код: YAML в docengine/catalog. Из одного файла
строится форма на экране, промпт для модели и проверка готового документа.
Юрист правит паспорт без программиста, и правка сразу видна во всех трёх
местах, — иначе форма, промпт и проверка неизбежно расходятся.
"""

from __future__ import annotations

import functools
from pathlib import Path
from typing import Literal, Optional

import yaml
from pydantic import BaseModel, Field

from .schema import Ref

CATALOG_DIR = Path(__file__).parent / 'catalog'

FieldType = Literal['text', 'textarea', 'number', 'money', 'date', 'select', 'iin', 'bin', 'iin_bin']


class Trans(BaseModel):
    """Строка на трёх языках. Казахский и английский необязательны."""

    ru: str
    kk: str = ''
    en: str = ''

    def get(self, lang: str) -> str:
        return getattr(self, lang, '') or self.ru


class Option(BaseModel):
    value: str
    label: Trans


class Field_(BaseModel):
    """Поле формы конструктора."""

    name: str
    label: Trans
    type: FieldType = 'text'
    group: str = Field(default='terms', description='Группа формы: parties, subject, terms, extra')
    required: bool = False
    hint: Optional[Trans] = None
    options: list[Option] = Field(default_factory=list)
    placeholder: Optional[str] = None
    # К какой стороне относится поле: 0 или 1. Пусто — общее поле договора.
    party: Optional[int] = None
    unit: Optional[str] = Field(default=None, description='тенге, дней, %, м²')


class SectionSpec(BaseModel):
    """Раздел документа: что в нём должно быть и на чём он основан."""

    key: str
    title: Trans
    required: bool = True
    guidance: Trans = Field(description='Что модель обязана раскрыть в этом разделе')
    refs: list[Ref] = Field(default_factory=list)


class EssentialTerm(BaseModel):
    """Существенное условие: без него договор считается незаключённым (ст. 393 ГК РК)."""

    key: str
    label: Trans
    # Поля формы, любое из которых закрывает это условие.
    fields: list[str] = Field(default_factory=list)
    section: Optional[str] = Field(default=None, description='Раздел, который обязан его содержать')
    basis: Optional[Ref] = None


class Risk(BaseModel):
    """Типичный риск для одной из сторон. Показывается в предпросмотре."""

    party: int = Field(description='Индекс стороны: 0 или 1')
    text: Trans
    mitigation: Optional[Trans] = None


class AnnexSpec(BaseModel):
    key: str
    title: Trans
    kind: Literal['sections', 'table'] = 'sections'
    columns: list[Trans] = Field(default_factory=list)
    default: bool = Field(default=False, description='Предлагать по умолчанию')


class PartySpec(BaseModel):
    """Роль стороны в этом типе договора: Продавец и Покупатель, а не «Сторона 1»."""

    role: Trans
    kinds: list[Literal['legal', 'individual', 'ip']] = Field(
        default_factory=lambda: ['legal', 'individual', 'ip']
    )


class Passport(BaseModel):
    id: str
    kind: Literal['contract', 'law_project'] = 'contract'
    name: Trans
    family: str = Field(description='Семейство: sale, lease, works, services, finance, labour, ip, corporate, family')
    summary: Trans
    legal_basis: list[Ref] = Field(default_factory=list)
    form: Trans = Field(description='Форма сделки: простая письменная, нотариальная, с госрегистрацией')
    # Честная оговорка: например, у агентского договора нет своей главы в ГК РК.
    caveat: Optional[Trans] = None
    parties: list[PartySpec]
    fields: list[Field_] = Field(default_factory=list)
    sections: list[SectionSpec]
    essential_terms: list[EssentialTerm] = Field(default_factory=list)
    risks: list[Risk] = Field(default_factory=list)
    annexes: list[AnnexSpec] = Field(default_factory=list)
    # Проверен практикующим юристом. Пока false — интерфейс говорит об этом прямо.
    reviewed: bool = False

    def field(self, name: str) -> Optional[Field_]:
        for f in self.fields:
            if f.name == name:
                return f
        return None

    def section(self, key: str) -> Optional[SectionSpec]:
        for s in self.sections:
            if s.key == key:
                return s
        return None

    def brief(self, lang: str = 'ru') -> dict:
        """Короткая карточка для каталога: без полей и разделов."""
        return {
            'id': self.id,
            'name': self.name.get(lang),
            'family': self.family,
            'summary': self.summary.get(lang),
            'form': self.form.get(lang),
            'legal_basis': [r.label() for r in self.legal_basis],
            'caveat': self.caveat.get(lang) if self.caveat else None,
            'sections_count': len(self.sections),
            'reviewed': self.reviewed,
        }


# --------------------------------------------------------------- загрузка

COMMON_PARTY_FIELDS = ('name', 'id_no', 'address', 'bank', 'iban', 'bik', 'signatory', 'signatory_role', 'basis')


class CatalogError(RuntimeError):
    pass


@functools.lru_cache(maxsize=1)
def load_catalog() -> dict[str, Passport]:
    """Читает все паспорта с диска. Ошибка в одном файле роняет загрузку целиком.

    Умолчание «пропустить битый файл» здесь опаснее падения: тип договора
    молча исчез бы из каталога, и это заметили бы не сразу.
    """
    out: dict[str, Passport] = {}
    for path in sorted(CATALOG_DIR.rglob('*.yaml')):
        raw = yaml.safe_load(path.read_text(encoding='utf-8'))
        if not raw:
            continue
        try:
            p = Passport(**raw)
        except Exception as e:
            raise CatalogError(f'{path.name}: {e}') from e
        if p.id in out:
            raise CatalogError(f'{path.name}: тип «{p.id}» уже определён')
        if len(p.parties) < 2:
            raise CatalogError(f'{path.name}: у договора должно быть минимум две стороны')
        for term in p.essential_terms:
            for fname in term.fields:
                if p.field(fname) is None:
                    raise CatalogError(
                        f'{path.name}: существенное условие «{term.key}» ссылается '
                        f'на несуществующее поле «{fname}»'
                    )
            if term.section and p.section(term.section) is None:
                raise CatalogError(
                    f'{path.name}: существенное условие «{term.key}» ссылается '
                    f'на несуществующий раздел «{term.section}»'
                )
        out[p.id] = p
    return out


def get_passport(type_id: str) -> Passport:
    catalog = load_catalog()
    if type_id not in catalog:
        raise KeyError(f'Неизвестный тип документа: {type_id}')
    return catalog[type_id]


def list_passports(kind: str = 'contract', lang: str = 'ru') -> list[dict]:
    return [p.brief(lang) for p in load_catalog().values() if p.kind == kind]
