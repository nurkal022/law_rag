"""Табличные части в XLSX.

Спецификацию и график платежей контрагент считает в Excel, а не читает в PDF,
поэтому числовые колонки уезжают числами, а не строками — иначе формулы по
выгрузке не построишь.
"""

from __future__ import annotations

import io
import re

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

from ..schema import DocTree, Table
from .naming import filename

_HEADER_FILL = PatternFill('solid', fgColor='DCE6F1')
_THIN = Side(style='thin', color='808080')
_BORDER = Border(left=_THIN, right=_THIN, top=_THIN, bottom=_THIN)
_NUM_FORMAT = '#,##0.00'

_FORBIDDEN = re.compile(r'[\\/*?:\[\]]')


def _sheet_title(title: str, used: set[str]) -> str:
    """Excel: не длиннее 31 символа, без \\/*?:[] и без повторов."""
    name = _FORBIDDEN.sub(' ', title).strip() or 'Таблица'
    name = name[:31]
    if name not in used:
        used.add(name)
        return name
    for i in range(2, 100):
        suffix = f' ({i})'
        candidate = name[: 31 - len(suffix)] + suffix
        if candidate not in used:
            used.add(candidate)
            return candidate
    used.add(name)
    return name


def _as_number(value: str):
    """Числа приходят строкой из формы: «1 200,50», «1200.5», «120 000 ₸».

    Приводим к float, только если после чистки не осталось лишнего —
    иначе «по договорённости» превратилось бы в мусорное число.
    """
    if value is None:
        return None
    s = str(value).strip().replace(' ', '').replace(' ', '').replace(',', '.')
    if not s:
        return None
    if re.fullmatch(r'-?\d+(\.\d+)?', s):
        num = float(s)
        return int(num) if num.is_integer() else num
    return None


def _write_table(ws, t: Table) -> None:
    widths = [len(c.title) for c in t.columns]

    for ci, col in enumerate(t.columns, start=1):
        cell = ws.cell(row=1, column=ci, value=col.title)
        cell.font = Font(bold=True)
        cell.fill = _HEADER_FILL
        cell.border = _BORDER
        cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)

    body = list(t.rows) + ([t.total_row] if t.total_row else [])
    for ri, row in enumerate(body, start=2):
        is_total = t.total_row is not None and ri == len(body) + 1
        for ci, col in enumerate(t.columns, start=1):
            raw = row[ci - 1] if ci - 1 < len(row) else ''
            number = _as_number(raw) if col.numeric else None
            cell = ws.cell(row=ri, column=ci, value=number if number is not None else raw)
            cell.border = _BORDER
            if col.numeric:
                cell.alignment = Alignment(horizontal='right')
                if number is not None:
                    cell.number_format = _NUM_FORMAT
            else:
                cell.alignment = Alignment(vertical='top', wrap_text=True)
            if is_total:
                cell.font = Font(bold=True)
            widths[ci - 1] = max(widths[ci - 1], len(str(raw)))

    for ci, width in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(ci)].width = min(max(width + 2, 10), 60)
    ws.freeze_panes = 'A2'

    if t.note:
        ws.cell(row=len(body) + 3, column=1, value=t.note).font = Font(italic=True)


def _all_tables(tree: DocTree) -> list[Table]:
    """Таблица приложения часто тот же объект, что и таблица договора,
    поэтому собираем по id — иначе спецификация уехала бы на два листа."""
    tables: list[Table] = []
    seen: set[str] = set()
    for t in list(tree.tables) + [a.table for a in tree.annexes if a.table is not None]:
        if t.id in seen:
            continue
        seen.add(t.id)
        tables.append(t)
    return tables


def to_xlsx(tree: DocTree, table_id: str | None = None) -> tuple[bytes, str]:
    """Каждая таблица — на своём листе; table_id выгружает только одну."""
    tables = _all_tables(tree)
    if table_id is not None:
        tables = [t for t in tables if t.id == table_id]
        if not tables:
            raise ValueError(f'Таблица «{table_id}» в документе не найдена')

    wb = Workbook()
    wb.remove(wb.active)
    used: set[str] = set()
    for t in tables:
        ws = wb.create_sheet(_sheet_title(t.title or t.id, used))
        _write_table(ws, t)

    if not wb.sheetnames:
        # Пустая книга не открывается — оставляем лист с пояснением.
        ws = wb.create_sheet('Таблиц нет')
        ws['A1'] = 'В документе нет табличных частей'

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue(), filename(tree, 'xlsx')
