"""
Реестр актов корпуса: уровень иерархии юридической силы, код, источник.

Данные, а не код (conformity/acts.yaml): новый акт — файл в docs/ и строка здесь.
Уровни — одиннадцать ярусов из технического задания; ст. 10 ЗРК «О правовых
актах» даёт ту же лестницу с одним отличием — местом постановлений
законодательного органа; принят порядок ТЗ.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from typing import Dict, Optional

import yaml

TIER_COUNT = 11
_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'acts.yaml')


@dataclass(frozen=True)
class ActMeta:
    filename: str
    tier: int
    code: str
    adilet: str = ''
    edition: str = ''
    url: str = ''
    retired: bool = False


class Registry:
    def __init__(self, tiers: Dict[int, Dict[str, str]], acts: Dict[str, ActMeta]):
        self.tiers = tiers
        self.acts = acts

    def act(self, filename: str) -> Optional[ActMeta]:
        return self.acts.get(filename)

    def tier_title(self, tier: int, lang: str = 'ru') -> str:
        row = self.tiers.get(tier) or {}
        return row.get('kk' if lang == 'kz' else lang) or row.get('ru') or f'Уровень {tier}'


@lru_cache(maxsize=1)
def load_registry(path: str = _PATH) -> Registry:
    with open(path, encoding='utf-8') as f:
        raw = yaml.safe_load(f) or {}
    tiers = {int(k): dict(v) for k, v in (raw.get('tiers') or {}).items()}
    if sorted(tiers) != list(range(1, TIER_COUNT + 1)):
        raise ValueError(f'в acts.yaml должно быть ровно {TIER_COUNT} ярусов, есть {sorted(tiers)}')
    acts = {}
    for filename, row in (raw.get('acts') or {}).items():
        tier = int(row['tier'])
        if not 1 <= tier <= TIER_COUNT:
            raise ValueError(f'{filename}: ярус {tier} вне 1..{TIER_COUNT}')
        acts[filename] = ActMeta(
            filename=filename, tier=tier, code=str(row['code']),
            adilet=str(row.get('adilet', '')), edition=str(row.get('edition', '')),
            url=str(row.get('url', '')), retired=bool(row.get('retired', False)),
        )
    return Registry(tiers, acts)
