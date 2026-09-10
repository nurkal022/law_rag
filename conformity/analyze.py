"""
Анализ одной нормы против Конституции 2026.

Два слоя и два прохода. Механический слой (словарь институтов, перенумерация)
даёт точные находки без модели. Модель получает норму, ближайшие статьи
Конституции, относящиеся к норме изменения и справку об институтах — и отвечает
JSON. Код требует опоры (цитата из нормы + статья или изменение), иначе понижает
уровень до нуля; для уровней 2–3 второй проход другой моделью может только
подтвердить или понизить. Итоговую формулировку ТЗ здесь не пишут: её ставит
conformity/wording.py по уровню.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import List, Optional

import numpy as np

from .changes import ChangeSet, mechanical_findings, strip_footnotes
from .constitution import Article, ConstitutionIndex
from .finding import Finding
from .wording import CATEGORIES


@dataclass
class AnalyzeConfig:
    triage_model: str
    verify_model: str
    top_articles: int = 4
    verify_from_level: int = 2
    max_norm_chars: int = 3500
    max_article_chars: int = 1800


@dataclass
class Norm:
    chunk_id: int
    document_id: int
    act_title: str
    article_no: str
    article_title: str
    text: str
    vector: Optional[np.ndarray] = None


TRIAGE_SYSTEM = (
    'Вы — помощник юриста-конституционалиста. Задача: предварительный автоматизированный анализ нормы '
    'действующего акта на предмет возможного несоответствия Конституции Республики Казахстан 2026 года.\n'
    'Опирайтесь только на приведённые статьи Конституции, перечисленные изменения и справку. Не утверждайте '
    'неконституционность как факт и не пишите итоговую формулировку — её ставит система по уровню.\n\n'
    'УРОВНИ. 0 — признаков противоречия нет (значение по умолчанию). 1 — расхождение вероятно, но нужно чтение '
    'смежных норм. 2 — норма опирается на орган, полномочие или процедуру, которые в Конституции 2026 устроены '
    'иначе. 3 — норма прямо утверждает то, что Конституция 2026 исключила или запрещает.\n'
    'Уровень 1–3 допустим только при опоре: quote_norm — дословный фрагмент проверяемой нормы, и хотя бы одна '
    'статья Конституции 2026 из приведённых (constitution_articles) или изменение (change_ids). Без опоры — 0.\n\n'
    'НЕ считается противоречием: норма детализирует или развивает Конституцию; норма о том же предмете без '
    'расхождения; норма не упоминает новые институты; орган, не названный в справке, — он существует, '
    'отсутствие в справке не означает упразднения.\n\n'
    'КАТЕГОРИИ: terminology — упомянут орган из списка отсутствующих; competence — полномочие закреплено за '
    'другим органом или иначе; rights — норма сужает право или гарантию Конституции 2026; procedure — порядок, '
    'срок, процедура расходятся; reference — ссылка на статью Конституции, которой нет или она изменилась; '
    'none — без замечаний.\n\n'
    'ОТВЕТ — только JSON: {"level": 0-3, "category": "...", "constitution_articles": [номера], '
    '"change_ids": ["..."], "quote_norm": "дословно из нормы или пусто", '
    '"explanation": "2-4 предложения по-русски: что именно расходится и почему", '
    '"recommendation": "одно предложение: что сделать"}'
)

VERIFY_SYSTEM = (
    'Вы проверяете вывод первого прохода автоматизированного анализа нормы на соответствие Конституции '
    'Республики Казахстан 2026 года. Вы можете подтвердить уровень или понизить его; повышать нельзя.\n'
    'Понизьте, если: цитата не содержится в норме; названная статья Конституции не о том предмете; вывод '
    'опирается на «упразднение» органа, которого нет в списке отсутствующих (такой орган существует); норма '
    'лишь детализирует Конституцию; расхождение построено на домысле, а не на тексте.\n'
    'ОТВЕТ — только JSON: {"keep": true|false, "level": 0-3, "reason": "одно предложение"}'
)


def facts(cs: ChangeSet) -> str:
    present = '; '.join(cs.present_institutions)
    absent = '; '.join(cs.absent_institutions)
    return (
        'СПРАВКА. Конституция Республики Казахстан 2026 года принята на референдуме 15.03.2026, в силе с '
        '01.07.2026; Конституция 1995 года прекратила действие (ст. 94). По ст. 96 акты, действующие на день '
        'вступления в силу, применяются в части, не противоречащей Конституции.\n'
        f'Органы и институты, предусмотренные Конституцией 2026: {present}.\n'
        f'Органы, которых в Конституции 2026 НЕТ (названы только в переходных положениях): {absent}.\n'
        'Любой орган, не названный в этой справке, считать существующим.'
    )


def _json(content: str) -> dict:
    try:
        data = json.loads(content)
    except (TypeError, ValueError):
        m = re.search(r'\{.*\}', content or '', re.S)
        data = json.loads(m.group(0)) if m else {}
    return data if isinstance(data, dict) else {}


def _tokens(resp: dict) -> int:
    return int(((resp or {}).get('usage') or {}).get('total_tokens') or 0)


def _norm_ws(s: str) -> str:
    return re.sub(r'[\s«»"\'`]+', ' ', (s or '')).strip().lower()


def enforce_support(f: Finding, norm_text: str, index: ConstitutionIndex, cs: ChangeSet) -> Finding:
    """Правила, которые модели не доверяются: диапазон уровня, известные категории,
    существующие статьи и изменения, обязательная опора для уровня выше нуля."""
    try:
        level = int(f.level) if f.level is not None else 0
    except (TypeError, ValueError):
        level = 0
    f.level = min(3, max(0, level))
    f.category = f.category if f.category in CATEGORIES else 'none'
    f.constitution_articles = sorted({int(a) for a in f.constitution_articles
                                      if str(a).isdigit() and index.article(int(a)) is not None})
    f.change_ids = [c for c in f.change_ids if cs.by_id(c) is not None]
    if f.level == 0:
        return f
    quote = _norm_ws(f.quote_norm)
    body = _norm_ws(strip_footnotes(norm_text))
    quoted = bool(quote) and (quote[:60] in body)
    supported = bool(f.constitution_articles or f.change_ids)
    if not (quoted and supported):
        f.level = 0
        f.category = 'none'
        f.explanation = (f.explanation + ' ' if f.explanation else '') + \
            '(Понижено системой: нет опоры — дословной цитаты нормы вместе со статьёй Конституции или изменением.)'
        f.recommendation = ''
    return f


def _context_articles(norm: Norm, index: ConstitutionIndex, cs: ChangeSet, mech: List[Finding],
                      changes: List, cfg: AnalyzeConfig) -> List[Article]:
    nos: List[int] = []
    if norm.vector is not None:
        nos += [a.no for a, _ in index.nearest(norm.vector, cfg.top_articles)]
    for f in mech:
        nos += f.constitution_articles
    for c in changes:
        nos += c.new_articles
    seen, out = set(), []
    for n in nos:
        a = index.article(n)
        if a is not None and n not in seen:
            seen.add(n)
            out.append(a)
    return out[:cfg.top_articles + 3]


def _triage_user(norm: Norm, articles: List[Article], changes: List, cs: ChangeSet, cfg: AnalyzeConfig) -> str:
    parts = [facts(cs)]
    if changes:
        parts.append('ИЗМЕНЕНИЯ КОНСТИТУЦИИ, относящиеся к норме:\n' + '\n'.join(
            f'[{c.id}] {c.title}. Было (ст. {", ".join(map(str, c.old_articles)) or "—"}): «{c.old_quote}». '
            f'Стало (ст. {", ".join(map(str, c.new_articles)) or "—"}): «{c.new_quote}».'
            for c in changes))
    parts.append('СТАТЬИ КОНСТИТУЦИИ 2026 (ближайшие по смыслу и названные в изменениях):\n' + '\n\n'.join(
        f'Статья {a.no} (раздел {a.section_no}, {a.section_title}):\n{a.text[:cfg.max_article_chars]}'
        for a in articles))
    parts.append(f'ПРОВЕРЯЕМАЯ НОРМА ({norm.act_title}; {norm.article_title}):\n{norm.text[:cfg.max_norm_chars]}')
    return '\n\n'.join(parts)


def _verify(f: Finding, norm: Norm, index: ConstitutionIndex, cs: ChangeSet, provider, cfg: AnalyzeConfig) -> Finding:
    arts = '\n\n'.join(f'Статья {n}:\n{index.texts.get(n, "")[:cfg.max_article_chars]}' for n in f.constitution_articles)
    user = (f'{facts(cs)}\n\nПРОВЕРЯЕМАЯ НОРМА ({norm.act_title}; {norm.article_title}):\n'
            f'{norm.text[:cfg.max_norm_chars]}\n\nВЫВОД ПЕРВОГО ПРОХОДА:\n'
            + json.dumps({'level': f.level, 'category': f.category, 'constitution_articles': f.constitution_articles,
                          'change_ids': f.change_ids, 'quote_norm': f.quote_norm, 'explanation': f.explanation},
                         ensure_ascii=False)
            + f'\n\nСТАТЬИ КОНСТИТУЦИИ 2026, на которые он ссылается:\n{arts}')
    resp = provider.chat_completion(
        messages=[{'role': 'system', 'content': VERIFY_SYSTEM}, {'role': 'user', 'content': user}],
        model=cfg.verify_model, temperature=0.0, max_tokens=400, response_format={'type': 'json_object'})
    data = _json(resp.get('content', ''))
    f.tokens += _tokens(resp)
    f.method = 'model+verified'
    keep = bool(data.get('keep', True))
    try:
        proposed = int(data.get('level', f.level))
    except (TypeError, ValueError):
        proposed = f.level
    if keep:
        f.level = min(f.level, max(0, proposed))
    else:
        # «не подтверждаю» без явного уровня ниже — сомнение, а не опровержение: уровень 1
        f.level = min(proposed, 1) if proposed < f.level else 1
    reason = str(data.get('reason') or '').strip()
    if reason:
        f.explanation = (f.explanation + '\n\nПроверка: ' + reason).strip()
    if f.level == 0:
        f.category = 'none'
    return f


def analyze_norm(norm: Norm, index: ConstitutionIndex, cs: ChangeSet, provider, cfg: AnalyzeConfig) -> Finding:
    mech = mechanical_findings(norm.text, cs)
    changes = list(cs.hinted(norm.text))
    for f in mech:
        for cid in f.change_ids:
            c = cs.by_id(cid)
            if c and c not in changes:
                changes.append(c)
    articles = _context_articles(norm, index, cs, mech, changes, cfg)

    try:
        resp = provider.chat_completion(
            messages=[{'role': 'system', 'content': TRIAGE_SYSTEM},
                      {'role': 'user', 'content': _triage_user(norm, articles, changes, cs, cfg)}],
            model=cfg.triage_model, temperature=0.0, max_tokens=700, response_format={'type': 'json_object'})
        data = _json(resp.get('content', ''))
        model_f = Finding(
            level=data.get('level', 0), category=str(data.get('category') or 'none'), method='model',
            constitution_articles=list(data.get('constitution_articles') or []),
            change_ids=[str(c) for c in (data.get('change_ids') or [])],
            quote_norm=str(data.get('quote_norm') or '').strip(),
            explanation=str(data.get('explanation') or '').strip(),
            recommendation=str(data.get('recommendation') or '').strip(),
            model=str(resp.get('model') or cfg.triage_model), tokens=_tokens(resp),
        )
        model_f = enforce_support(model_f, norm.text, index, cs)
        if (model_f.level or 0) >= cfg.verify_from_level:
            model_f = _verify(model_f, norm, index, cs, provider, cfg)
    except Exception as e:  # noqa: BLE001 — сбой модели фиксируем в находке, прогон идёт дальше
        model_f = Finding(level=None, category='none', method='model', error=str(e)[:300], model=cfg.triage_model)

    # Слияние: уровень — максимум слоёв. Если модель упала, а словарь нашёл, норма
    # получает уровень словаря, а ошибка остаётся в находке для повторного прохода.
    result = model_f
    for f in mech:
        result = result.merge(f)
    return result
