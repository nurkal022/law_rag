"""
Реестр изменений между двумя Конституциями и механический слой анализа.

Что здесь решается без модели — решается без модели: упоминание органа, которого
нет в Конституции 2026, и ссылка на номер статьи прежней Конституции находятся
регулярными выражениями с точной цитатой. Модель получает эти факты, а не
выводит их сама: в пробе она объявила упразднённым Высший Судебный Совет,
который в Конституции 2026 есть.
"""
from __future__ import annotations

import os
import re
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Dict, List, Optional

import yaml

from .finding import Finding

_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'changes.yaml')
TRANSITIONAL = {94, 95, 96}   # переходные положения: там прежние органы названы законно
_SENTENCE_SPLIT = re.compile(r'(?<=[.;!?])\s+(?=[А-ЯЁA-Z\d«(])')
_CONST_REF = re.compile(r'(?:стать[а-яё]{1,3}|ст\.)\s*(\d+)(?:\s*[-–]\s*\d+)?[^.;]{0,60}?Конституци[ияюей]', re.IGNORECASE)


@dataclass
class Change:
    id: str
    kind: str
    title: str
    summary: str
    old_articles: List[int]
    new_articles: List[int]
    old_quote: str = ''
    new_quote: str = ''
    absent_terms: List[re.Pattern] = field(default_factory=list)
    absent_names: List[str] = field(default_factory=list)
    present_terms: List[str] = field(default_factory=list)
    hint_terms: List[re.Pattern] = field(default_factory=list)
    level_hint: int = 1


@dataclass
class ChangeSet:
    changes: List[Change]
    article_map: Dict[int, List[int]]
    present_institutions: List[str]

    def by_id(self, change_id: str) -> Optional[Change]:
        return next((c for c in self.changes if c.id == change_id), None)

    @property
    def absent_institutions(self) -> List[str]:
        """Человекочитаемый список для справки модели и экрана."""
        return [name for c in self.changes for name in c.absent_names]

    def hinted(self, norm_text: str) -> List[Change]:
        text = strip_footnotes(norm_text)
        return [c for c in self.changes if any(p.search(text) for p in c.hint_terms)]


def strip_footnotes(text: str) -> str:
    """Без сносок, примечаний и ссылок на постановления КС: там прежние органы
    названы законно (история редакций), и это не расхождение нормы."""
    text = re.sub(r'Сноска\..*?(?=\n|$)', '', text)
    text = re.sub(r'Примечание\..*?(?=\n|$)', '', text)
    text = re.sub(r'См\. нормативн\w+ постановлени\w+.*?(?=\n|$)', '', text)
    return text


def _sentence(text: str, start: int, end: int) -> str:
    """Предложение вокруг совпадения, не длиннее 300 знаков."""
    left = max(text.rfind('. ', 0, start), text.rfind('\n', 0, start), text.rfind('; ', 0, start))
    left = left + 2 if left >= 0 else 0
    right_candidates = [i for i in (text.find('. ', end), text.find('\n', end), text.find('; ', end)) if i >= 0]
    right = min(right_candidates) + 1 if right_candidates else len(text)
    sent = text[left:right].strip()
    return sent if len(sent) <= 300 else text[max(start - 140, 0):end + 140].strip()


@lru_cache(maxsize=1)
def load_changes(path: str = _PATH) -> ChangeSet:
    with open(path, encoding='utf-8') as f:
        raw = yaml.safe_load(f) or {}
    changes = []
    for row in raw.get('changes') or []:
        changes.append(Change(
            id=row['id'], kind=row['kind'], title=row['title'].strip(), summary=' '.join(row['summary'].split()),
            old_articles=[int(a) for a in (row.get('old') or {}).get('articles', [])],
            new_articles=[int(a) for a in (row.get('new') or {}).get('articles', [])],
            old_quote=(row.get('old') or {}).get('quote', ''), new_quote=(row.get('new') or {}).get('quote', ''),
            absent_terms=[re.compile(p) for p in row.get('absent_terms') or []],
            absent_names=list(row.get('absent_names') or []),
            present_terms=list(row.get('present_terms') or []),
            hint_terms=[re.compile(p, re.IGNORECASE) for p in row.get('hint_terms') or []],
            level_hint=int(row.get('level_hint', 1)),
        ))
    article_map = {int(k): [int(x) for x in (v or [])] for k, v in (raw.get('article_map') or {}).items()}
    return ChangeSet(changes, article_map, list(raw.get('present_institutions') or []))


def validate(cs: ChangeSet, articles_2026: Dict[int, str]) -> None:
    """Словарь сходится с текстом 2026: отсутствующий термин не встречается в
    действующих статьях, а каждый «появившийся» — встречается хоть раз."""
    live = '\n'.join(t for n, t in articles_2026.items() if n not in TRANSITIONAL)
    whole = '\n'.join(articles_2026.values())
    for c in cs.changes:
        for p in c.absent_terms:
            m = p.search(live)
            if m:
                raise ValueError(f'{c.id}: термин «{m.group(0)}» есть в Конституции 2026 вне переходных положений')
        for term in c.present_terms:
            if term not in whole:
                raise ValueError(f'{c.id}: «{term}» не найден в тексте Конституции 2026')


def mechanical_findings(norm_text: str, cs: ChangeSet) -> List[Finding]:
    """Находки без модели: отсутствующие институты и ссылки на прежнюю нумерацию."""
    body = strip_footnotes(norm_text)
    out: List[Finding] = []

    # 1. Институты, которых нет в Конституции 2026
    for c in cs.changes:
        hits_body = [m for p in c.absent_terms for m in p.finditer(body)]
        hits_all = [m for p in c.absent_terms for m in p.finditer(norm_text)]
        if not hits_all:
            continue
        if hits_body:
            m = hits_body[0]
            names = c.absent_names or [p.pattern for p in c.absent_terms]
            terms = [name for p, name in zip(c.absent_terms, names) if p.search(body)]
            out.append(Finding(
                level=2, category='terminology', method='dictionary',
                constitution_articles=list(c.new_articles), change_ids=[c.id],
                quote_norm=_sentence(body, m.start(), m.end()),
                explanation=(f'Норма называет орган, которого нет в Конституции 2026 года: {", ".join(terms)}. '
                             f'{c.title}. Полномочие или процедура, связанные с этим органом, требуют '
                             f'переадресации по Конституции 2026 (ст. {", ".join(map(str, c.new_articles))}).'),
                recommendation='Заменить упоминание прежнего органа на предусмотренный Конституцией 2026 '
                               'либо исключить норму; проверить связанные процедуры.',
            ))
        else:
            m = hits_all[0]
            out.append(Finding(
                level=1, category='terminology', method='dictionary',
                constitution_articles=list(c.new_articles), change_ids=[c.id],
                quote_norm=_sentence(norm_text, m.start(), m.end()),
                explanation=(f'Орган, которого нет в Конституции 2026 года ({m.group(0)}), упомянут только в '
                             f'сноске или примечании к статье — в истории редакций, а не в самой норме.'),
                recommendation='Проверить, не осталось ли в тексте нормы отсылок к этому органу; сноску не править.',
            ))

    # 2. Ссылки на статьи Конституции по прежней нумерации
    seen = set()
    for m in _CONST_REF.finditer(body):
        old_no = int(m.group(1))
        if old_no in seen or old_no not in cs.article_map:
            continue
        seen.add(old_no)
        new_nos = cs.article_map[old_no]
        quote = _sentence(body, m.start(), m.end())
        if not new_nos:
            out.append(Finding(
                level=2, category='reference', method='dictionary', constitution_articles=[],
                change_ids=[c.id for c in cs.changes if old_no in c.old_articles],
                quote_norm=quote,
                explanation=(f'Норма ссылается на статью {old_no} Конституции 1995 года; в Конституции 2026 года '
                             f'положения с этим предметом нет.'),
                recommendation='Установить, на какое положение Конституции 2026 должна указывать ссылка, '
                               'или исключить её.',
            ))
        elif new_nos != [old_no]:
            out.append(Finding(
                level=1, category='reference', method='dictionary', constitution_articles=list(new_nos),
                change_ids=[c.id for c in cs.changes if old_no in c.old_articles],
                quote_norm=quote,
                explanation=(f'Норма ссылается на статью {old_no} Конституции по нумерации 1995 года; в Конституции '
                             f'2026 года тот же предмет — статья {" и ".join(map(str, new_nos))}.'),
                recommendation=f'Заменить ссылку на статью {" и ".join(map(str, new_nos))} Конституции 2026 '
                               f'после проверки содержания.',
            ))
    return out
