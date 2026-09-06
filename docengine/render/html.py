"""Лист документа в HTML.

Один и тот же шаблон обслуживает предпросмотр в браузере и печать в PDF:
если бы у них были разные шаблоны, «как на экране, так и в файле» держалось бы
на честном слове. Отличается только обвязка — см. параметр standalone.
"""

from __future__ import annotations

from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

from ..schema import DocTree

_TEMPLATES = Path(__file__).parent

# Стили держим здесь, а не в шаблоне: их же отдаём фронту одним куском
# (DOC_CSS) для встраивания предпросмотра, где обвязки standalone нет.
DOC_CSS = """
.doc-sheet {
  font-family: "Times New Roman", Times, serif;
  font-size: 12pt;
  line-height: 1.45;
  text-align: justify;
  color: #000;
  background: #fff;
  box-sizing: border-box;
}
.doc-sheet h1, .doc-sheet h2 { font-family: inherit; }
.doc-head { text-align: center; margin-bottom: 1.2em; }
.doc-head h1 { font-size: 14pt; font-weight: bold; text-transform: uppercase; margin: 0 0 .3em; text-align: center; }
.doc-head .subtitle { font-size: 12pt; margin: 0 0 .6em; text-align: center; }
.place-date { display: flex; justify-content: space-between; margin: 1.2em 0 .4em; }
.preamble { text-indent: 1.25cm; margin: 0 0 1em; }
.section { margin-top: 1em; }
.section h2 { font-size: 12pt; font-weight: bold; text-align: center; margin: 1.1em 0 .5em; page-break-after: avoid; }
.clause { margin: 0 0 .45em; text-indent: 1.25cm; }
.clause--sub { margin-left: 1.25cm; }
.clause-no { font-weight: normal; }
.pending { font-style: italic; color: #666; }
.ref { white-space: nowrap; border-bottom: 1px dotted #666; cursor: pointer; }
.ref--unverified { border-bottom-style: dashed; color: #8a5a00; }
.doc-table { width: 100%; border-collapse: collapse; margin: 1em 0; font-size: 11pt; page-break-inside: auto; }
.doc-table caption { font-weight: bold; text-align: left; margin-bottom: .4em; }
.doc-table th, .doc-table td { border: 1px solid #000; padding: 4px 6px; text-align: left; vertical-align: top; }
.doc-table th { font-weight: bold; background: #eee; text-align: center; }
.doc-table .num { text-align: right; }
.doc-table tr.total td { font-weight: bold; }
.table-note { font-size: 10pt; font-style: italic; }
.signatures { margin-top: 2em; page-break-inside: avoid; }
.parties { display: flex; gap: 8mm; }
.party { flex: 1 1 0; text-align: left; font-size: 11pt; }
.party p { margin: 0 0 .2em; }
.party-role { font-weight: bold; text-transform: uppercase; }
.party-name { font-weight: bold; }
.sign-line { margin-top: 1.2em !important; }
.basis { font-size: 10pt; }
.annex { page-break-before: always; margin-top: 2em; }
.annex-label { text-align: right; font-size: 11pt; }
.annex-title { text-align: center; font-size: 13pt; text-transform: uppercase; }
"""

_MONTHS_RU = (
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
)


def fmt_date(iso: str) -> str:
    """ISO-дату показываем как «7 сентября 2026 года» — так пишут в договорах.

    Если строка пришла не в ISO (пользователь ввёл руками), отдаём как есть:
    портить введённое хуже, чем показать нестандартный формат.
    """
    if not iso:
        return ''
    parts = iso.split('-')
    if len(parts) != 3:
        return iso
    try:
        y, m, d = int(parts[0]), int(parts[1]), int(parts[2])
        return f'«{d}» {_MONTHS_RU[m - 1]} {y} года'
    except (ValueError, IndexError):
        return iso


_env = Environment(
    loader=FileSystemLoader(str(_TEMPLATES)),
    autoescape=select_autoescape(['html']),
    trim_blocks=True,
    lstrip_blocks=True,
)


def to_html(tree: DocTree, *, standalone: bool = False) -> str:
    """standalone=False — только лист (для встраивания), True — страница со стилями."""
    tpl = _env.get_template('contract.html')
    return tpl.render(
        tree=tree,
        standalone=standalone,
        css=DOC_CSS,
        fmt_date=fmt_date,
        sig_heading='РЕКВИЗИТЫ И ПОДПИСИ СТОРОН',
    )
