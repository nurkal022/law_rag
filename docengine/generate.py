"""
Генерация документа разделами.

Один вызов модели на весь договор даёт длинную простыню markdown: её нельзя
адресовать, нельзя проверить по составу и нельзя перегенерировать по частям.
Поэтому здесь каждый раздел — отдельный вызов со своим контекстом, своим
правовым поиском и своим разбором JSON. Раздел упал — упал один раздел,
остальной документ жив и помечен замечанием.

Контекст из корпуса ищется под каждый раздел отдельно: нормы про предмет
поставки и нормы про неустойку — разные нормы, и один общий запрос на весь
договор всегда находил что-то среднее, то есть ничего.
"""

from __future__ import annotations

import json
import re
from typing import Any, Callable, Optional

from pydantic import BaseModel, Field, ValidationError, model_validator

from .ops import Op
from .passport import Passport, SectionSpec
from .schema import Clause, DocTree, Issue, Section, renumber
from .skeleton import build_skeleton

try:  # config тянет dotenv; движок должен работать и без окружения приложения
    from config import Config

    _MODEL = Config.LLM_MODEL
    _MAX_TOKENS = Config.MAX_TOKENS
except Exception:  # pragma: no cover — только на голом окружении
    _MODEL = None
    _MAX_TOKENS = 4000


class GenerationError(RuntimeError):
    """Модель дважды не смогла вернуть JSON по схеме."""


class SectionResult(BaseModel):
    clauses: list[Clause] = Field(default_factory=list)
    notes: str = ''

    @model_validator(mode='after')
    def _not_empty(self):
        """Раздел без пунктов — это промах мимо схемы, а не пустой раздел.

        Модель, ответившая {"sections": [...]} вместо {"clauses": [...]},
        формально проходит валидацию и отдаёт пустой список. Проверять надо
        именно модель целиком, а не поле: когда ключа «clauses» в ответе нет
        вовсе — а это и есть основной случай промаха, — валидатор поля просто
        не вызывается, и ошибка проходит незамеченной.
        """
        if not self.clauses:
            raise ValueError('ни одного пункта: ожидался ключ "clauses" с непустым списком')
        return self


class InstructionResult(BaseModel):
    ops: list[Op] = Field(default_factory=list)
    reply: str = ''


LANG_NAME = {'ru': 'русском', 'kk': 'казахском', 'en': 'английском'}


# ------------------------------------------------------- разбор ответа

_FENCE = re.compile(r'```(?:json)?\s*(.*?)\s*```', re.DOTALL)


def extract_json(raw: str) -> dict:
    """Достаёт объект JSON из ответа модели.

    Модели упорно оборачивают ответ в ```json и предваряют его вежливой
    фразой, хотя их просили этого не делать. Дешевле разобрать, чем спорить:
    сначала как есть, потом содержимое ограждения, потом первый
    сбалансированный объект в тексте.
    """
    if not raw:
        raise ValueError('пустой ответ модели')
    text = raw.strip()
    try:
        data = json.loads(text)
        if isinstance(data, dict):
            return data
    except (ValueError, TypeError):
        pass

    for candidate in _FENCE.findall(text):
        try:
            data = json.loads(candidate)
            if isinstance(data, dict):
                return data
        except (ValueError, TypeError):
            continue

    chunk = _balanced_object(text)
    if chunk is not None:
        data = json.loads(chunk)
        if isinstance(data, dict):
            return data
    raise ValueError('в ответе нет объекта JSON')


def _balanced_object(text: str) -> Optional[str]:
    """Первый сбалансированный {...} в тексте, с учётом строк и экранирования."""
    start = text.find('{')
    if start < 0:
        return None
    depth = 0
    in_str = False
    esc = False
    for i in range(start, len(text)):
        ch = text[i]
        if in_str:
            if esc:
                esc = False
            elif ch == '\\':
                esc = True
            elif ch == '"':
                in_str = False
            continue
        if ch == '"':
            in_str = True
        elif ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                return text[start : i + 1]
    return None


RETRY_MESSAGE = (
    'Твой предыдущий ответ не разобрался как JSON. Верни ТОЛЬКО объект JSON '
    'по требуемой схеме, без пояснений, без markdown, без ``` — первый символ '
    'ответа «{», последний «}».'
)


def _ask_json(
    provider,
    messages: list[dict],
    model_cls,
    *,
    temperature: float = 0.2,
    max_tokens: Optional[int] = None,
    what: str = 'ответ',
):
    """Спрашивает модель и валидирует ответ по pydantic-схеме.

    Ровно одна повторная попытка: если модель промахнулась мимо схемы дважды,
    третья попытка её не исправит, а пользователь ждёт. Лучше честная ошибка
    с текстом ответа, чем бесконечный цикл.
    """
    convo = list(messages)
    last_raw = ''
    for attempt in (1, 2):
        resp = provider.chat_completion(
            messages=convo,
            model=_MODEL,
            temperature=temperature,
            max_tokens=max_tokens or _MAX_TOKENS,
        )
        last_raw = (resp or {}).get('content', '') if isinstance(resp, dict) else str(resp)
        try:
            return model_cls(**extract_json(last_raw)), last_raw
        except (ValueError, TypeError, ValidationError) as e:
            if attempt == 2:
                raise GenerationError(
                    f'Модель не вернула корректный JSON ({what}): {e}. Ответ: {last_raw[:1500]}'
                ) from e
            convo = convo + [
                {'role': 'assistant', 'content': last_raw},
                {'role': 'user', 'content': RETRY_MESSAGE},
            ]
    raise GenerationError(f'Модель не вернула корректный JSON ({what}). Ответ: {last_raw[:1500]}')



_LEADING_NO = re.compile(r'^\s*(?:\d{1,2}(?:\.\d{1,2}){0,3}\.?|[а-яa-z]\))\s+')


def strip_own_numbering(clause: Clause) -> Clause:
    """Срезает номер, который модель приписала себе сама.

    Модель просят не нумеровать пункты — нумерация принадлежит документу и
    проставляется единым проходом после всех правок. Просьбу она выполняет не
    всегда, и тогда в листе выходит «1.1. 1.1. Поставщик обязуется…».
    Срезаем только ведущий номер: числа внутри текста, вроде сроков и сумм,
    трогать нельзя.
    """
    text = (clause.text or '').lstrip()
    stripped = _LEADING_NO.sub('', text, count=1)
    # Пункт, состоящий из одного номера, оставляем как есть: срезать нечего,
    # а пустой текст потерялся бы при отборе непустых.
    if stripped.strip():
        clause.text = stripped.strip()
    for sub in clause.subclauses:
        strip_own_numbering(sub)
    return clause


# --------------------------------------------------------- вспомогательное


def _values_block(passport: Passport, values: dict, lang: str) -> str:
    """Заполненные поля формы человеческими подписями из паспорта."""
    lines: list[str] = []
    seen: set[str] = set()
    for f in passport.fields:
        v = values.get(f.name)
        seen.add(f.name)
        if v in (None, '', []):
            continue
        unit = f' {f.unit}' if f.unit else ''
        lines.append(f'- {f.label.get(lang)}: {v}{unit}')
    # Поля, которых нет в паспорте (свободные условия, импорт), тоже важны.
    for k, v in values.items():
        if k in seen or k in ('lang', 'language') or v in (None, '', []):
            continue
        lines.append(f'- {k}: {v}')
    return '\n'.join(lines) or '(поля формы не заполнены)'


def _parties_block(tree: DocTree) -> str:
    return '\n'.join(
        f'- {p.role}: {p.name or "(не указано)"}'
        f'{", " + p.id_no if p.id_no else ""} ({p.kind})'
        for p in tree.requisites.parties
    )


def _done_block(tree: DocTree, upto_key: Optional[str] = None, limit: int = 240) -> str:
    """Сжатая выжимка уже готовых разделов.

    Модель обязана видеть, что уже сказано: иначе термины расходятся
    («Товар» в одном разделе, «Продукция» в другом) и обязанность
    дублируется в двух местах с разными сроками.
    """
    out: list[str] = []
    for s in tree.sections:
        if upto_key and s.key == upto_key:
            break
        if s.pending or not s.clauses:
            continue
        body = '; '.join((c.text or '')[:limit] for c in s.clauses[:8])
        out.append(f'{s.no}. {s.title}: {body}')
    return '\n'.join(out) or '(разделов ещё нет — это первый)'


def _tree_outline(tree: DocTree, limit: int = 600) -> str:
    """Компактное дерево для правки: номера, заголовки, тексты."""
    out: list[str] = [f'Документ: {tree.meta.title}']
    if tree.preamble:
        out.append(f'Преамбула: {tree.preamble[:limit]}')
    for s in tree.sections:
        out.append(f'{s.no}. {s.title}' + (' [не сгенерирован]' if s.pending else ''))
        for c in s.clauses:
            lock = ' [защищён]' if c.locked else ''
            out.append(f'  {c.no}. {(c.text or "")[:limit]}{lock}')
            for sub in c.subclauses:
                out.append(f'    {sub.no}. {(sub.text or "")[:limit]}')
    return '\n'.join(out)


def _retrieve(retriever, query: str, top_k: int = 4) -> str:
    """Правовой контекст под конкретный раздел. Ошибка поиска не рушит генерацию."""
    if retriever is None:
        return ''
    try:
        results = retriever.hybrid_search(query, top_k=top_k) or []
    except Exception:
        return ''
    chunks = []
    for r in results:
        if not isinstance(r, dict):
            continue
        title = r.get('title', '')
        content = (r.get('content') or '')[:900]
        if content:
            chunks.append(f'[{title}]\n{content}')
    return '\n\n'.join(chunks)


SECTION_SCHEMA = (
    '{"clauses":[{"text":"текст пункта одним абзацем",'
    '"refs":[{"act":"ГК РК","article":"406","note":"п. 1"}],'
    '"subclauses":[{"text":"текст подпункта","refs":[]}]}],'
    '"notes":"короткое замечание для юриста или пустая строка"}'
)


def _section_query(passport: Passport, spec: SectionSpec, lang: str) -> str:
    """Запрос в корпус под один раздел: тема раздела + его правовая основа."""
    refs = ' '.join(r.label() for r in (spec.refs or passport.legal_basis))
    return f'{passport.name.get("ru")} {spec.title.get("ru")} {spec.guidance.get("ru")[:300]} {refs}'.strip()


# --------------------------------------------------------- один раздел


def generate_section(
    provider,
    passport: Passport,
    section_spec: SectionSpec,
    tree: DocTree,
    values: dict,
    lang: str = 'ru',
    legal_context: str = '',
    hint: str = '',
) -> list[Clause]:
    """Пункты одного раздела. Один вызов модели, строгий JSON на выходе.

    hint — указание юриста при перегенерации («разложи расходы по годам»).
    Это часть задания, а не пожелание: без него кнопки правки в интерфейсе
    ничего не меняют, и человек решает, что модель его не слышит.
    """
    lang = lang if lang in LANG_NAME else 'ru'
    spec_refs = section_spec.refs or passport.legal_basis
    refs_text = ', '.join(r.label() for r in spec_refs) or 'Гражданский кодекс РК'

    system = (
        'Ты — практикующий юрист Республики Казахстан, составляешь договоры.\n'
        f'Пиши на {LANG_NAME[lang]} языке, языком нормативного текста: точно, '
        'без вводных слов, без пояснений для читателя.\n'
        'Ты возвращаешь ТОЛЬКО JSON по схеме, без markdown и без ```:\n'
        f'{SECTION_SCHEMA}\n'
        'Правила:\n'
        '- Не проставляй номера пунктов: нумерация делается вне модели.\n'
        '- Каждый пункт — самостоятельное договорное условие одним абзацем.\n'
        '- refs указывай только на реально существующие нормы РК; сомневаешься — пустой список.\n'
        '- Не повторяй условия, уже изложенные в других разделах.\n'
        '- Не выдумывай значений, которых нет в данных формы: '
        'оставляй место как «____» или общую формулировку.'
    )

    user = (
        f'ТИП ДОГОВОРА: {passport.name.get(lang)}\n'
        f'ФОРМА СДЕЛКИ: {passport.form.get(lang)}\n'
        f'СТОРОНЫ:\n{_parties_block(tree)}\n\n'
        f'РАЗДЕЛ, КОТОРЫЙ НУЖНО НАПИСАТЬ: «{section_spec.title.get(lang)}»\n'
        f'ЧТО ОБЯЗАН РАСКРЫТЬ РАЗДЕЛ: {section_spec.guidance.get(lang)}\n'
        f'ПРАВОВАЯ ОСНОВА РАЗДЕЛА: {refs_text}\n\n'
        f'ДАННЫЕ ФОРМЫ:\n{_values_block(passport, values, lang)}\n\n'
        f'УЖЕ НАПИСАННЫЕ РАЗДЕЛЫ (для согласования терминов и во избежание повторов):\n'
        f'{_done_block(tree, upto_key=section_spec.key)}\n'
    )
    if legal_context:
        user += (
            '\nНОРМЫ ЗАКОНОДАТЕЛЬСТВА РК ИЗ КОРПУСА '
            '(опирайся на них, но не цитируй целиком):\n' + legal_context + '\n'
        )
    if hint.strip():
        user += f'\nУКАЗАНИЕ ЮРИСТА К ЭТОМУ РАЗДЕЛУ (обязательно к исполнению): {hint.strip()}\n'
    user += '\nВерни только JSON по схеме.'

    result, _raw = _ask_json(
        provider,
        [{'role': 'system', 'content': system}, {'role': 'user', 'content': user}],
        SectionResult,
        what=f'раздел «{section_spec.key}»',
    )
    # Пустые пункты не должны попадать в документ: пустая строка в листе
    # выглядит как потерянное условие.
    return [strip_own_numbering(c) for c in result.clauses if (c.text or '').strip()]


# ------------------------------------------------------- весь документ


def generate_document(
    provider,
    passport: Passport,
    values: dict,
    lang: str = 'ru',
    retriever=None,
    progress: Optional[Callable[[int, int, str], None]] = None,
) -> DocTree:
    """Каркас + разделы по очереди + перенумерация + проверка.

    Разделы генерируются последовательно, а не параллельно, именно потому,
    что каждый следующий видит предыдущие: договор должен быть связным
    текстом, а не набором независимо написанных кусков.
    """
    from .check import check  # импорт здесь: check ничего не знает о генерации

    lang = lang if lang in LANG_NAME else 'ru'
    tree = build_skeleton(passport, values, lang)
    total = len(passport.sections)

    for i, spec in enumerate(passport.sections):
        title = spec.title.get(lang)
        if progress:
            try:
                progress(i, total, title)
            except Exception:
                pass  # прогресс — украшение, он не вправе сорвать генерацию

        section = tree.section_by_key(spec.key)
        if section is None:  # каркас и паспорт разошлись — не должно случаться
            continue

        try:
            legal_context = _retrieve(retriever, _section_query(passport, spec, lang))
            clauses = generate_section(
                provider, passport, spec, tree, values, lang, legal_context
            )
        except Exception as e:
            # Падение одного раздела не должно стоить пользователю всего
            # документа: остальные разделы уже оплачены временем и токенами.
            tree.issues.append(
                Issue(
                    level='error',
                    code='section_failed',
                    message=f'Раздел «{title}» не сгенерирован: {e}',
                    section_key=spec.key,
                )
            )
            continue

        if clauses:
            section.clauses = clauses
            section.pending = False
        else:
            tree.issues.append(
                Issue(
                    level='warning',
                    code='section_empty',
                    message=f'Раздел «{title}» вернулся пустым.',
                    section_key=spec.key,
                )
            )

    if progress:
        try:
            progress(total, total, '')
        except Exception:
            pass

    renumber(tree)
    tree.issues.extend(check(tree, passport, values))
    return tree


# ----------------------------------------------------- правка промптом

OPS_SCHEMA = (
    '{"ops":[{"op":"replace_clause|insert_clause|delete_clause|replace_section|'
    'insert_section|delete_section|rename_section|set_requisite|set_preamble",'
    '"no":"4.2","key":"liability","after":"4.2","title":"...","text":"...",'
    '"refs":[{"act":"ГК РК","article":"353"}],"reason":"зачем"}],'
    '"reply":"одно-два предложения, что именно сделано"}'
)


def apply_instruction(provider, tree: DocTree, instruction: str, lang: str = 'ru') -> tuple[list[Op], str]:
    """Превращает просьбу человека в список операций над деревом.

    Модель не переписывает документ, а называет точечные правки: так видно,
    что изменилось, и ничего не пропадает молча. Применяет операции
    apply_ops — здесь только их получение.
    """
    lang = lang if lang in LANG_NAME else 'ru'
    system = (
        'Ты — юрист-редактор договоров по праву Республики Казахстан.\n'
        'Тебе дают текущий документ и просьбу пользователя. Ты НЕ переписываешь '
        'документ целиком, а возвращаешь список точечных операций над ним.\n'
        'Ты возвращаешь ТОЛЬКО JSON по схеме, без markdown и без ```:\n'
        f'{OPS_SCHEMA}\n'
        'Правила:\n'
        '- Номера в "no" и "after" бери из документа дословно.\n'
        '- Не проставляй номера в текстах: нумерация пересчитывается автоматически.\n'
        '- Пункты, помеченные [защищён], не изменяй.\n'
        '- Для set_requisite используй "path" (city, date, number, parties.0.bank) и "value".\n'
        '- Если просьбу выполнить нельзя, верни пустой ops и объясни это в reply.\n'
        f'- Тексты пиши на {LANG_NAME[lang]} языке.'
    )
    user = (
        f'ТЕКУЩИЙ ДОКУМЕНТ:\n{_tree_outline(tree)}\n\n'
        f'ПРОСЬБА ПОЛЬЗОВАТЕЛЯ:\n{instruction}\n\n'
        'Верни только JSON по схеме.'
    )
    result, _raw = _ask_json(
        provider,
        [{'role': 'system', 'content': system}, {'role': 'user', 'content': user}],
        InstructionResult,
        temperature=0.1,
        what='правка документа',
    )
    return result.ops, result.reply
