"""Результат анализа одной нормы. Общий для механического слоя и модели."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class Finding:
    level: Optional[int] = 0          # 0..3; None — норма не разобрана (ошибка модели)
    category: str = 'none'            # см. wording.CATEGORIES
    method: str = ''                  # dictionary | model | model+verified | dictionary+model | …
    constitution_articles: List[int] = field(default_factory=list)
    change_ids: List[str] = field(default_factory=list)
    quote_norm: str = ''
    explanation: str = ''
    recommendation: str = ''
    model: str = ''
    tokens: int = 0
    error: str = ''

    def merge(self, other: 'Finding') -> 'Finding':
        """Две находки по одной норме: уровень — максимум, остальное — объединение.

        Объяснения склеиваются абзацами: читателю важно видеть и что нашёл словарь,
        и что увидела модель, а не только более строгий из двух выводов.
        """
        hi, lo = (self, other) if (self.level or 0) >= (other.level or 0) else (other, self)
        methods = {m for f in (self, other) for m in f.method.split('+') if m}
        # Объяснение «признаков не выявлено» рядом с находкой словаря читается как спор
        # двух слоёв; в итоге остаётся только то, что нашло замечание.
        explanations = [hi.explanation] + ([lo.explanation] if (lo.level or 0) >= 1 else [])
        return Finding(
            level=hi.level,
            category=hi.category if hi.category != 'none' else lo.category,
            method='+'.join(sorted(methods)),
            constitution_articles=sorted(set(self.constitution_articles) | set(other.constitution_articles)),
            change_ids=sorted(set(self.change_ids) | set(other.change_ids)),
            quote_norm=hi.quote_norm or lo.quote_norm,
            explanation='\n\n'.join(x for x in explanations if x),
            recommendation=hi.recommendation or lo.recommendation,
            model=self.model or other.model,
            tokens=self.tokens + other.tokens,
            error=self.error or other.error,
        )
