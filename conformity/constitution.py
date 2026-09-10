"""
Статьи Конституции 2026 с векторами — в памяти.

Их 96, векторы уже посчитаны при загрузке корпуса, поэтому ближайшие статьи к
норме ищутся numpy, а не запросом к pgvector: нет ни сети, ни зависимости от
PostgreSQL в тестах, и порядок результата воспроизводим.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

import numpy as np

_SECTION = re.compile(r'^Раздел\s+([IVX]+)\.?\s*(.*)$')
_ARTICLE = re.compile(r'^Статья\s+(\d+)\.?\s*(.*)$')


@dataclass
class Article:
    no: int
    section_no: str
    section_title: str
    text: str
    vector: Optional[np.ndarray] = None


def parse_chunk(content: str) -> Optional[Article]:
    """Чанк загрузчика: «Раздел N. Название» / «Статья N.» / тело."""
    section_no, section_title, no, body = '', '', None, []
    for line in content.split('\n'):
        line = line.strip()
        if no is None:
            m = _SECTION.match(line)
            if m:
                section_no, section_title = m.group(1), m.group(2).strip()
                continue
            m = _ARTICLE.match(line)
            if m:
                no = int(m.group(1))
                if m.group(2).strip():
                    body.append(m.group(2).strip())
                continue
            continue
        body.append(line)
    if no is None:
        return None
    return Article(no=no, section_no=section_no, section_title=section_title, text='\n'.join(body).strip())


class ConstitutionIndex:
    def __init__(self, articles: List[Article]):
        self.articles = sorted(articles, key=lambda a: a.no)
        self._by_no = {a.no: a for a in self.articles}
        with_vec = [a for a in self.articles if a.vector is not None]
        self._vec_articles = with_vec
        if with_vec:
            m = np.array([a.vector for a in with_vec], dtype=np.float32)
            norms = np.linalg.norm(m, axis=1, keepdims=True)
            norms[norms == 0] = 1.0
            self._matrix = m / norms
        else:
            self._matrix = np.zeros((0, 0), dtype=np.float32)

    @classmethod
    def from_document(cls, document_id: int) -> 'ConstitutionIndex':
        from database.models import DocumentChunk
        rows = DocumentChunk.query.filter_by(document_id=document_id).order_by(DocumentChunk.chunk_index).all()
        articles = []
        for row in rows:
            a = parse_chunk(row.content)
            if a is None:
                continue
            a.vector = row.get_embedding()
            articles.append(a)
        if not articles:
            raise ValueError(f'в документе {document_id} не найдено ни одной статьи')
        return cls(articles)

    def article(self, no: int) -> Optional[Article]:
        return self._by_no.get(no)

    @property
    def texts(self) -> Dict[int, str]:
        return {a.no: a.text for a in self.articles}

    def nearest(self, vector: np.ndarray, k: int = 4) -> List[Tuple[Article, float]]:
        if not len(self._vec_articles):
            return []
        v = np.asarray(vector, dtype=np.float32)
        n = np.linalg.norm(v)
        v = v / n if n else v
        sims = self._matrix @ v
        order = np.argsort(-sims)[:k]
        return [(self._vec_articles[i], float(sims[i])) for i in order]

    def sections(self) -> List[dict]:
        out: List[dict] = []
        for a in self.articles:
            if not out or out[-1]['no'] != a.section_no:
                out.append({'no': a.section_no, 'title': a.section_title, 'articles': []})
            out[-1]['articles'].append(a.no)
        return out
