"""Документ в PDF — печать того же HTML, что показан в предпросмотре."""

from __future__ import annotations

from ..schema import DocTree
from .html import to_html
from .naming import filename


class WeasyPrintMissing(RuntimeError):
    pass


def to_pdf(tree: DocTree) -> tuple[bytes, str]:
    """WeasyPrint импортируем внутри функции.

    Он тянет системные библиотеки (pango, cairo), которых на машине
    разработчика может не быть; из-за этого весь пакет render не должен
    падать при импорте — HTML/DOCX/XLSX обязаны работать и без него.
    """
    try:
        from weasyprint import HTML  # noqa: PLC0415
    except (ImportError, OSError) as exc:  # OSError — библиотека есть, а pango нет
        raise WeasyPrintMissing(
            'WeasyPrint не установлен (или не найдены его системные библиотеки '
            'pango/cairo). Установите: pip install weasyprint, '
            'на macOS дополнительно brew install pango. '
            'Выгрузка в DOCX доступна без него.'
        ) from exc

    pdf = HTML(string=to_html(tree, standalone=True)).write_pdf()
    return pdf, filename(tree, 'pdf')
