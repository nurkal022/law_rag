"""Имя файла для выгрузки.

Кириллица в имени скачиваемого файла ломается по дороге (Content-Disposition,
Windows-клиенты, почтовые вложения), поэтому заголовок транслитерируем.
"""

from __future__ import annotations

import re
from datetime import date

from ..schema import DocTree

# Транслитерация по КНБ/ГОСТ-подобной таблице: важна не обратимость,
# а узнаваемость имени человеком.
_TRANSLIT = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e',
    'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
    'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
    'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
    'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
    # казахские буквы
    'ә': 'a', 'ғ': 'g', 'қ': 'q', 'ң': 'n', 'ө': 'o', 'ұ': 'u', 'ү': 'u',
    'һ': 'h', 'і': 'i',
}


def translit(text: str) -> str:
    out: list[str] = []
    for ch in text:
        low = ch.lower()
        if low in _TRANSLIT:
            rep = _TRANSLIT[low]
            out.append(rep.capitalize() if ch.isupper() and rep else rep)
        else:
            out.append(ch)
    return ''.join(out)


def filename(tree: DocTree, ext: str) -> str:
    base = translit(tree.meta.title or 'document')
    base = re.sub(r'[^A-Za-z0-9]+', '_', base).strip('_')
    if not base:
        base = 'document'
    base = base[:80]
    stamp = tree.requisites.date or date.today().isoformat()
    if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', stamp):
        stamp = date.today().isoformat()
    return f'{base}_{stamp}.{ext}'
