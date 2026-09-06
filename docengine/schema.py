"""
Структура юридического документа.

Документ хранится деревом, а не строкой markdown. Это даёт три вещи, ради
которых всё и затевалось: пункт можно адресовать («перепиши 4.2»), состав
можно проверить (все ли существенные условия на месте), и один и тот же
документ рендерится в лист на экране, в DOCX, в PDF и в XLSX из одного
источника — поэтому «как на экране, так и в файле».

Схема служит одновременно контрактом для модели: генерация просит LLM
ответить строго в этом виде, а ответ валидируется до того, как попадёт в базу.
"""

from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

Lang = Literal['ru', 'kk', 'en']
Kind = Literal['contract', 'law_project']


class Ref(BaseModel):
    """Правовая координата: ссылка на норму.

    Хранится разобранной, а не строкой, чтобы интерфейс мог открыть норму из
    корпуса, а проверка — отличить существующую статью от выдуманной.
    """

    act: str = Field(description='Нормативный акт, например «ГК РК»')
    article: str = Field(description='Статья или диапазон, например «406» или «406–500»')
    note: Optional[str] = Field(default=None, description='Уточнение: пункт, часть')
    verified: bool = Field(
        default=False,
        description='Норма найдена в корпусе. Невыверенная ссылка не выдаётся за проверенную.',
    )

    def label(self) -> str:
        s = f'{self.act} ст. {self.article}'
        return f'{s}, {self.note}' if self.note else s


class Clause(BaseModel):
    """Пункт договора: «1.1», «4.2.3»."""

    no: str = Field(default='', description='Номер пункта; проставляется нумератором')
    text: str
    refs: list[Ref] = Field(default_factory=list)
    subclauses: list['Clause'] = Field(default_factory=list)
    # Пункт, добавленный человеком вручную, при перегенерации раздела не трогаем.
    locked: bool = False


class Section(BaseModel):
    """Раздел документа."""

    no: str = Field(default='', description='Номер раздела; проставляется нумератором')
    key: Optional[str] = Field(
        default=None,
        description='Устойчивый идентификатор из паспорта типа: subject, price, liability…',
    )
    title: str
    clauses: list[Clause] = Field(default_factory=list)
    # Раздел ещё не сгенерирован: место в оглавлении занято, содержимого нет.
    pending: bool = False


class Column(BaseModel):
    key: str
    title: str
    width: Optional[float] = Field(default=None, description='Доля ширины таблицы, 0…1')
    numeric: bool = False


class Table(BaseModel):
    """Табличная часть: спецификация, график платежей, сравнительная таблица."""

    id: str
    title: str
    columns: list[Column]
    rows: list[list[str]] = Field(default_factory=list)
    total_row: Optional[list[str]] = Field(default=None, description='Строка «Итого»')
    note: Optional[str] = None


class Party(BaseModel):
    """Сторона договора со всеми реквизитами для блока подписей."""

    role: str = Field(description='Роль по договору: Продавец, Арендодатель, Работник')
    name: str = ''
    kind: Literal['legal', 'individual', 'ip'] = 'legal'
    id_no: str = Field(default='', description='БИН для организации, ИИН для физлица')
    address: str = ''
    phone: str = ''
    email: str = ''
    bank: str = ''
    iban: str = ''
    bik: str = ''
    signatory: str = Field(default='', description='ФИО подписанта')
    signatory_role: str = Field(default='', description='Должность подписанта')
    basis: str = Field(default='', description='Действует на основании: устава, доверенности')


class Requisites(BaseModel):
    number: str = ''
    city: str = ''
    date: str = Field(default='', description='ISO-дата YYYY-MM-DD')
    parties: list[Party] = Field(default_factory=list)


class Annex(BaseModel):
    """Приложение к договору: акт, спецификация, график."""

    no: str = ''
    title: str
    kind: Literal['sections', 'table'] = 'sections'
    sections: list[Section] = Field(default_factory=list)
    table: Optional[Table] = None


class Meta(BaseModel):
    kind: Kind
    type_id: str
    lang: Lang = 'ru'
    title: str
    subtitle: Optional[str] = None
    # Юридическая форма сделки: письменная, нотариальная, с госрегистрацией.
    form: Optional[str] = None
    legal_basis: list[Ref] = Field(default_factory=list)


class Issue(BaseModel):
    """Замечание проверки: чего в документе не хватает."""

    level: Literal['error', 'warning', 'info'] = 'warning'
    code: str
    message: str
    section_key: Optional[str] = None
    clause_no: Optional[str] = None


class DocTree(BaseModel):
    """Документ целиком."""

    meta: Meta
    requisites: Requisites = Field(default_factory=Requisites)
    preamble: str = Field(
        default='',
        description='Вводный абзац: кто, на каком основании, заключили настоящий договор',
    )
    sections: list[Section] = Field(default_factory=list)
    tables: list[Table] = Field(default_factory=list)
    annexes: list[Annex] = Field(default_factory=list)
    issues: list[Issue] = Field(default_factory=list)

    # ---- удобные обходы ----

    def section_by_key(self, key: str) -> Optional[Section]:
        for s in self.sections:
            if s.key == key:
                return s
        return None

    def section_by_no(self, no: str) -> Optional[Section]:
        for s in self.sections:
            if s.no == no:
                return s
        return None

    def walk_clauses(self):
        """Все пункты подряд: (раздел, пункт, родитель-пункт или None)."""
        for s in self.sections:
            for c in s.clauses:
                yield s, c, None
                for sub in c.subclauses:
                    yield s, sub, c

    def clause_by_no(self, no: str) -> Optional[Clause]:
        for _s, c, _p in self.walk_clauses():
            if c.no == no:
                return c
        return None

    def plain_text(self) -> str:
        """Плоский текст: для анализатора, поиска и индексации."""
        out: list[str] = [self.meta.title]
        if self.preamble:
            out.append(self.preamble)
        for s in self.sections:
            out.append(f'{s.no}. {s.title}')
            for c in s.clauses:
                out.append(f'{c.no}. {c.text}')
                for sub in c.subclauses:
                    out.append(f'{sub.no}. {sub.text}')
        return '\n\n'.join(out)


Clause.model_rebuild()


# ---------------------------------------------------------------- нумерация


def renumber(tree: DocTree) -> DocTree:
    """Сквозная перенумерация после любой правки.

    Номера — не данные, а следствие порядка. Модель их выдумывает, человек
    вставляет пункт в середину, — поэтому после каждой операции номера
    считаются заново от начала: разделы 1…N, пункты N.1…, подпункты N.M.1…
    """
    for si, section in enumerate(tree.sections, start=1):
        section.no = str(si)
        for ci, clause in enumerate(section.clauses, start=1):
            clause.no = f'{si}.{ci}'
            for bi, sub in enumerate(clause.subclauses, start=1):
                sub.no = f'{si}.{ci}.{bi}'
    for ai, annex in enumerate(tree.annexes, start=1):
        annex.no = str(ai)
        for si, section in enumerate(annex.sections, start=1):
            section.no = str(si)
            for ci, clause in enumerate(section.clauses, start=1):
                clause.no = f'{si}.{ci}'
    return tree
