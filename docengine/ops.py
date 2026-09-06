"""
Правка документа операциями.

Когда пользователь пишет «добавь пункт о штрафе за просрочку», модель не
переписывает договор целиком, а возвращает список операций над деревом.
Так модель не может незаметно потерять половину документа, а человек видит
ровно то, что изменилось: пункт за пунктом, с возможностью откатить.

Операция, которая не находит цель, не применяется молча: она возвращается
как отказ. Тихо проглоченная правка хуже видимой ошибки — пользователь
уверен, что договор изменён, а он прежний.
"""

from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

from .schema import Clause, DocTree, Ref, Section, Table, renumber

OpName = Literal[
    'replace_clause',
    'insert_clause',
    'delete_clause',
    'replace_section',
    'insert_section',
    'delete_section',
    'rename_section',
    'set_requisite',
    'set_preamble',
    'set_table',
]


class Op(BaseModel):
    """Одна правка.

    Поля намеренно плоские и почти все необязательные: так модели проще
    попасть в схему с первого раза, чем в размеченное объединение типов.
    Осмысленность набора полей проверяет уже применение.
    """

    op: OpName
    no: Optional[str] = Field(default=None, description='Номер цели: «4.2» для пункта, «4» для раздела')
    key: Optional[str] = Field(default=None, description='Ключ раздела из паспорта; альтернатива номеру')
    after: Optional[str] = Field(default=None, description='Вставить после этого номера; пусто — в конец')
    title: Optional[str] = None
    text: Optional[str] = None
    refs: list[Ref] = Field(default_factory=list)
    clauses: list[Clause] = Field(default_factory=list)
    table: Optional[Table] = None
    path: Optional[str] = Field(
        default=None,
        description='Для set_requisite: city, date, number, parties.0.bank',
    )
    value: Any = None
    reason: Optional[str] = Field(default=None, description='Зачем правка; показывается в истории')


class OpResult(BaseModel):
    op: Op
    applied: bool
    detail: str = ''


class ApplyReport(BaseModel):
    tree: DocTree
    results: list[OpResult]

    @property
    def applied(self) -> int:
        return sum(1 for r in self.results if r.applied)

    @property
    def rejected(self) -> list[OpResult]:
        return [r for r in self.results if not r.applied]

    def summary(self) -> str:
        """Строка для истории версий: «изменено 3 пункта, добавлен раздел»."""
        counts: dict[str, int] = {}
        for r in self.results:
            if r.applied:
                counts[r.op.op] = counts.get(r.op.op, 0) + 1
        words = {
            'replace_clause': 'изменён пункт',
            'insert_clause': 'добавлен пункт',
            'delete_clause': 'удалён пункт',
            'replace_section': 'переписан раздел',
            'insert_section': 'добавлен раздел',
            'delete_section': 'удалён раздел',
            'rename_section': 'переименован раздел',
            'set_requisite': 'уточнены реквизиты',
            'set_preamble': 'изменена преамбула',
            'set_table': 'обновлена таблица',
        }
        parts = [f'{words.get(k, k)}: {v}' if v > 1 else words.get(k, k) for k, v in counts.items()]
        return '; '.join(parts) if parts else 'без изменений'


# ------------------------------------------------------------------ поиск


def _find_section(tree: DocTree, op: Op) -> Optional[Section]:
    if op.key:
        s = tree.section_by_key(op.key)
        if s:
            return s
    if op.no:
        # Номер раздела — «4»; для пункта «4.2» берём раздел до точки.
        head = op.no.split('.')[0]
        return tree.section_by_no(head)
    return None


def _find_clause(tree: DocTree, no: str) -> tuple[Optional[Section], Optional[Clause], Optional[Clause]]:
    """Возвращает (раздел, пункт, родитель) — родитель непуст для подпункта."""
    for s, c, parent in tree.walk_clauses():
        if c.no == no:
            return s, c, parent
    return None, None, None


# --------------------------------------------------------------- операции


def _op_replace_clause(tree: DocTree, op: Op) -> tuple[bool, str]:
    if not op.no:
        return False, 'не указан номер пункта'
    _s, clause, _p = _find_clause(tree, op.no)
    if clause is None:
        return False, f'пункт {op.no} не найден'
    if clause.locked:
        return False, f'пункт {op.no} правил человек и он защищён от перезаписи'
    if op.text is None:
        return False, 'нет нового текста пункта'
    clause.text = op.text
    if op.refs:
        clause.refs = list(op.refs)
    return True, f'пункт {op.no} изменён'


def _op_insert_clause(tree: DocTree, op: Op) -> tuple[bool, str]:
    if op.text is None and not op.clauses:
        return False, 'нет текста добавляемого пункта'
    new = list(op.clauses) if op.clauses else [Clause(text=op.text or '', refs=list(op.refs))]

    if op.after and '.' in op.after:
        # Вставка после конкретного пункта, внутрь его раздела.
        section, clause, parent = _find_clause(tree, op.after)
        if clause is None or section is None:
            return False, f'пункт {op.after} не найден'
        host = parent.subclauses if parent else section.clauses
        idx = host.index(clause) + 1
        host[idx:idx] = new
        return True, f'пункт добавлен после {op.after}'

    section = _find_section(tree, op)
    if section is None:
        return False, 'не найден раздел для нового пункта'
    section.clauses.extend(new)
    return True, f'пункт добавлен в раздел «{section.title}»'


def _op_delete_clause(tree: DocTree, op: Op) -> tuple[bool, str]:
    if not op.no:
        return False, 'не указан номер пункта'
    section, clause, parent = _find_clause(tree, op.no)
    if clause is None or section is None:
        return False, f'пункт {op.no} не найден'
    host = parent.subclauses if parent else section.clauses
    host.remove(clause)
    return True, f'пункт {op.no} удалён'


def _op_replace_section(tree: DocTree, op: Op) -> tuple[bool, str]:
    section = _find_section(tree, op)
    if section is None:
        return False, 'раздел не найден'
    if op.title:
        section.title = op.title
    if op.clauses:
        # Пункты, правленные человеком, переживают перегенерацию раздела.
        kept = [c for c in section.clauses if c.locked]
        section.clauses = list(op.clauses) + kept
    section.pending = False
    return True, f'раздел «{section.title}» переписан'


def _op_insert_section(tree: DocTree, op: Op) -> tuple[bool, str]:
    if not op.title:
        return False, 'у нового раздела нет заголовка'
    section = Section(title=op.title, key=op.key, clauses=list(op.clauses))
    if op.after:
        anchor = tree.section_by_no(op.after.split('.')[0])
        if anchor is None:
            return False, f'раздел {op.after} не найден'
        tree.sections.insert(tree.sections.index(anchor) + 1, section)
    else:
        tree.sections.append(section)
    return True, f'добавлен раздел «{op.title}»'


def _op_delete_section(tree: DocTree, op: Op) -> tuple[bool, str]:
    section = _find_section(tree, op)
    if section is None:
        return False, 'раздел не найден'
    tree.sections.remove(section)
    return True, f'раздел «{section.title}» удалён'


def _op_rename_section(tree: DocTree, op: Op) -> tuple[bool, str]:
    section = _find_section(tree, op)
    if section is None:
        return False, 'раздел не найден'
    if not op.title:
        return False, 'нет нового заголовка'
    section.title = op.title
    return True, f'раздел переименован: «{op.title}»'


def _op_set_requisite(tree: DocTree, op: Op) -> tuple[bool, str]:
    if not op.path:
        return False, 'не указано, какой реквизит менять'
    parts = op.path.split('.')
    if parts[0] == 'parties':
        if len(parts) != 3 or not parts[1].isdigit():
            return False, f'неверный путь реквизита: {op.path}'
        idx = int(parts[1])
        if idx >= len(tree.requisites.parties):
            return False, f'стороны {idx + 1} нет в договоре'
        party = tree.requisites.parties[idx]
        if not hasattr(party, parts[2]):
            return False, f'у стороны нет реквизита «{parts[2]}»'
        setattr(party, parts[2], str(op.value or ''))
        return True, f'реквизит стороны {idx + 1} обновлён'
    if len(parts) == 1 and hasattr(tree.requisites, parts[0]):
        setattr(tree.requisites, parts[0], str(op.value or ''))
        return True, f'реквизит «{parts[0]}» обновлён'
    return False, f'неизвестный реквизит: {op.path}'


def _op_set_preamble(tree: DocTree, op: Op) -> tuple[bool, str]:
    if op.text is None:
        return False, 'нет текста преамбулы'
    tree.preamble = op.text
    return True, 'преамбула изменена'


def _op_set_table(tree: DocTree, op: Op) -> tuple[bool, str]:
    if op.table is None:
        return False, 'нет таблицы'
    for i, t in enumerate(tree.tables):
        if t.id == op.table.id:
            tree.tables[i] = op.table
            return True, f'таблица «{op.table.title}» обновлена'
    tree.tables.append(op.table)
    return True, f'добавлена таблица «{op.table.title}»'


_HANDLERS = {
    'replace_clause': _op_replace_clause,
    'insert_clause': _op_insert_clause,
    'delete_clause': _op_delete_clause,
    'replace_section': _op_replace_section,
    'insert_section': _op_insert_section,
    'delete_section': _op_delete_section,
    'rename_section': _op_rename_section,
    'set_requisite': _op_set_requisite,
    'set_preamble': _op_set_preamble,
    'set_table': _op_set_table,
}


def apply_ops(tree: DocTree, ops: list[Op]) -> ApplyReport:
    """Применяет операции к копии дерева и возвращает новое дерево с отчётом.

    Исходное дерево не меняется: версия остаётся неприкосновенной, новая
    строится рядом. Операции применяются по очереди — каждая видит результат
    предыдущей, — а перенумерация делается один раз в конце, иначе номера
    поехали бы прямо посреди списка правок.
    """
    draft = tree.model_copy(deep=True)
    results: list[OpResult] = []
    for op in ops:
        handler = _HANDLERS.get(op.op)
        if handler is None:
            results.append(OpResult(op=op, applied=False, detail=f'неизвестная операция: {op.op}'))
            continue
        try:
            ok, detail = handler(draft, op)
        except Exception as e:  # операция не должна ронять весь пакет правок
            ok, detail = False, f'ошибка применения: {e}'
        results.append(OpResult(op=op, applied=ok, detail=detail))
    renumber(draft)
    return ApplyReport(tree=draft, results=results)


# ------------------------------------------------------------------ диффы


class Change(BaseModel):
    kind: Literal['added', 'removed', 'changed']
    no: str
    title: str = ''
    before: str = ''
    after: str = ''


def diff(old: DocTree, new: DocTree) -> list[Change]:
    """Сравнение версий по пунктам, а не по строкам.

    Юрист читает изменения так же, как читает договор: «пункт 4.2 изменён»,
    «добавлен пункт 7.3». Построчный дифф на юридическом тексте бесполезен —
    одна правка формулировки перекраивает весь абзац.
    """

    def index(tree: DocTree) -> dict[str, tuple[str, str]]:
        out: dict[str, tuple[str, str]] = {}
        for s in tree.sections:
            for c in s.clauses:
                out[c.no] = (s.title, c.text)
                for sub in c.subclauses:
                    out[sub.no] = (s.title, sub.text)
        return out

    a, b = index(old), index(new)
    changes: list[Change] = []
    for no in sorted(set(a) | set(b), key=lambda x: [int(p) for p in x.split('.') if p.isdigit()]):
        if no in a and no not in b:
            changes.append(Change(kind='removed', no=no, title=a[no][0], before=a[no][1]))
        elif no in b and no not in a:
            changes.append(Change(kind='added', no=no, title=b[no][0], after=b[no][1]))
        elif a[no][1] != b[no][1]:
            changes.append(Change(kind='changed', no=no, title=b[no][0], before=a[no][1], after=b[no][1]))
    return changes
