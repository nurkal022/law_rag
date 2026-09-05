import json
import re
from datetime import datetime
from typing import Dict, Optional
from config import Config
from llm_providers.base import LLMProvider


# Допустимые значения, которые модель должна возвращать (для нормализации/валидации)
_SEVERITY = {"high", "medium", "low"}
_IMPORTANCE = {"critical", "recommended", "optional"}
_COMPLIANCE_STATUS = {"compliant", "warning", "violation"}

_LANG_INSTRUCTION = {
    "ru": "Отвечай на русском языке.",
    "kk": "Жауапты қазақ тілінде бер.",
    "en": "Respond in English.",
}


class ContractAnalyzer:
    """Анализатор договоров — проверка рисков и соответствия законодательству РК.

    Улучшенная версия: выбор языка ответа (ru/kk/en), анализ с точки зрения
    конкретной стороны (perspective), устойчивый разбор JSON, расширенный
    юридический контекст из RAG и нормализация результата.
    """

    MAX_TEXT_CHARS = 14000  # больше, чем раньше (8000) — bge-m3/Gemma тянут длиннее

    def __init__(self, provider: LLMProvider = None, retriever=None):
        self.provider = provider
        self.retriever = retriever

    # ─────────────────────────── public ───────────────────────────

    def analyze(self, text: str, contract_type: str = None,
                language: str = "ru", perspective: str = None) -> dict:
        """Анализ текста договора на риски, пропущенные пункты и соответствие праву РК.

        Args:
            text: текст договора
            contract_type: предполагаемый тип (sale/lease/...), опционально
            language: язык ответа — 'ru' | 'kk' | 'en'
            perspective: чьи интересы защищать — свободный текст
                (напр. "заказчик", "арендатор") либо None для нейтрального анализа
        """
        if not self.provider:
            return self._err('Извините, сервис временно не работает. Попробуйте позже.')

        if not text or len(text.strip()) < 50:
            return self._err('Текст договора слишком короткий для анализа', code='too_short')

        analysis_text = text[:self.MAX_TEXT_CHARS]
        language = language if language in _LANG_INSTRUCTION else "ru"

        legal_context = self._legal_context(contract_type)
        system_prompt = self._build_prompt(contract_type, language, perspective, legal_context)
        user_message = f"Проанализируйте следующий договор:\n\n{analysis_text}"

        try:
            response = self.provider.chat_completion(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
                model=Config.LLM_MODEL,
                temperature=0.1,
                max_tokens=Config.MAX_TOKENS,
            )
            content = response.get('content', '')
            analysis = self._parse_analysis(content)
            analysis = self._normalize(analysis)

            return {
                'success': True,
                'analysis': analysis,
                'metadata': {
                    'analyzed_at': datetime.utcnow().isoformat(),
                    'text_length': len(text),
                    'truncated': len(text) > self.MAX_TEXT_CHARS,
                    'language': language,
                    'perspective': perspective,
                    'model': response.get('model', Config.LLM_MODEL),
                },
            }
        except Exception as e:
            print(f"Ошибка анализа договора: {e}")
            return self._err('Извините, сервис временно не работает. Попробуйте позже.')

    # ─────────────────────────── internals ───────────────────────────

    def _err(self, msg: str, code: str = 'service_unavailable') -> dict:
        return {'success': False, 'error': msg, 'error_code': code}

    def _legal_context(self, contract_type: str) -> str:
        """Подтягивает релевантные нормы РК из RAG. Берём больше фрагментов (5)
        и длиннее, чем раньше — анализ договора требует широкого контекста."""
        if not self.retriever:
            return ""
        try:
            query = (f"договор {contract_type or ''} обязательные условия "
                     f"существенные условия ответственность сторон расторжение "
                     f"законодательство Республики Казахстан")
            results = self.retriever.hybrid_search(query, top_k=5)
            if not results:
                return ""
            parts = ["\n\nРЕЛЕВАНТНЫЕ НОРМЫ ЗАКОНОДАТЕЛЬСТВА РК (опирайтесь на них):"]
            for r in results:
                title = r.get('title', '')
                snippet = (r.get('content', '') or '')[:600]
                parts.append(f"[{title}]: {snippet}")
            return "\n\n".join(parts)
        except Exception as e:
            print(f"RAG search error in analyzer: {e}")
            return ""

    def _build_prompt(self, contract_type, language, perspective, legal_context) -> str:
        type_hint = (f"\nТип договора (предположительно): {contract_type}"
                     if contract_type else "")
        perspective_hint = ""
        if perspective:
            perspective_hint = (
                f"\nВАЖНО: анализируйте договор с точки зрения защиты интересов "
                f"стороны «{perspective}». Особо отмечайте пункты, невыгодные для неё, "
                f"и риски именно для этой стороны.")
        lang_hint = _LANG_INSTRUCTION[language]

        return f"""Вы — опытный юрист-аналитик, специализирующийся на договорном праве Республики Казахстан.

ЗАДАЧА: Проведите комплексный анализ предоставленного договора. {lang_hint}
{type_hint}{perspective_hint}
{legal_context}

Правила оценки overall_score (0–100):
- 80–100: договор юридически грамотен, существенные условия на месте, рисков мало;
- 50–79: рабочий договор, но есть заметные пробелы или невыгодные/рискованные пункты;
- 0–49: серьёзные нарушения, отсутствуют существенные условия, высокие риски.

Ответьте СТРОГО в формате JSON (без markdown, без ```json, просто чистый JSON):
{{
    "contract_type_detected": "тип договора (sale/lease/services/employment/loan/supply/construction/nda/agency/other)",
    "overall_score": число от 0 до 100,
    "risk_level": "high/medium/low (общий уровень риска)",
    "summary": "краткое описание договора в 1-2 предложениях",
    "parties": ["роли сторон, как они названы в договоре"],
    "risks": [
        {{"severity": "high/medium/low", "title": "название риска", "description": "описание проблемы", "clause_reference": "пункт договора, если определимо", "recommendation": "как исправить"}}
    ],
    "missing_clauses": [
        {{"clause": "название пропущенного пункта", "importance": "critical/recommended/optional", "reason": "почему нужен этот пункт"}}
    ],
    "compliance": [
        {{"law": "ссылка на закон/статью РК", "status": "compliant/warning/violation", "note": "пояснение"}}
    ],
    "recommendations": [
        {{"priority": "high/medium/low", "title": "заголовок", "description": "что нужно сделать"}}
    ],
    "strengths": ["список сильных сторон договора"]
}}"""

    def _parse_analysis(self, content: str) -> dict:
        """Устойчивый разбор JSON из ответа модели.
        Пробует: чистый JSON → блок ```json``` → первую {...}-скобочную группу.
        При неудаче возвращает структуру-заглушку с сырым текстом."""
        candidates = []
        stripped = content.strip()
        candidates.append(stripped)

        if '```json' in content:
            candidates.append(content.split('```json', 1)[1].split('```', 1)[0])
        elif '```' in content:
            candidates.append(content.split('```', 1)[1].split('```', 1)[0])

        # Жадно вырезаем от первой { до последней }
        first, last = content.find('{'), content.rfind('}')
        if first != -1 and last != -1 and last > first:
            candidates.append(content[first:last + 1])

        for cand in candidates:
            try:
                obj = json.loads(cand.strip())
                if isinstance(obj, dict):
                    return obj
            except (json.JSONDecodeError, ValueError):
                continue

        return {
            'overall_score': 50,
            'risk_level': 'medium',
            'summary': content[:500],
            'parties': [],
            'risks': [],
            'missing_clauses': [],
            'compliance': [],
            'recommendations': [{
                'priority': 'medium',
                'title': 'Ручная проверка',
                'description': 'Не удалось провести структурированный анализ. Рекомендуется ручная проверка.',
            }],
            'strengths': [],
            'raw_analysis': content,
        }

    def _normalize(self, a: dict) -> dict:
        """Приводит результат к ожидаемой форме: гарантирует наличие ключей,
        чинит типы, ограничивает overall_score в [0,100], нормализует enum'ы."""
        a.setdefault('contract_type_detected', 'other')
        a.setdefault('summary', '')
        for key in ('risks', 'missing_clauses', 'compliance', 'recommendations',
                    'strengths', 'parties'):
            if not isinstance(a.get(key), list):
                a[key] = []

        # overall_score → int в [0,100]
        try:
            score = int(round(float(a.get('overall_score', 50))))
        except (TypeError, ValueError):
            score = 50
        a['overall_score'] = max(0, min(100, score))

        # risk_level: если не задан/некорректен — выводим из score
        rl = str(a.get('risk_level', '')).lower()
        if rl not in _SEVERITY:
            a['risk_level'] = 'low' if a['overall_score'] >= 80 else (
                'medium' if a['overall_score'] >= 50 else 'high')

        # Нормализация enum-полей внутри списков
        for r in a['risks']:
            if isinstance(r, dict) and str(r.get('severity', '')).lower() not in _SEVERITY:
                r['severity'] = 'medium'
        for m in a['missing_clauses']:
            if isinstance(m, dict) and str(m.get('importance', '')).lower() not in _IMPORTANCE:
                m['importance'] = 'recommended'
        for c in a['compliance']:
            if isinstance(c, dict) and str(c.get('status', '')).lower() not in _COMPLIANCE_STATUS:
                c['status'] = 'warning'

        # Сводка по количеству рисков — удобно для счётчиков на стороне клиента
        a['risk_counts'] = {
            'high': sum(1 for r in a['risks'] if isinstance(r, dict) and r.get('severity') == 'high'),
            'medium': sum(1 for r in a['risks'] if isinstance(r, dict) and r.get('severity') == 'medium'),
            'low': sum(1 for r in a['risks'] if isinstance(r, dict) and r.get('severity') == 'low'),
        }
        return a

    # ─────────────────────────── file extraction ───────────────────────────

    def extract_text_from_file(self, file_storage) -> str:
        """Extract text from uploaded file (PDF, DOCX, TXT)"""
        filename = (file_storage.filename or '').lower()

        if filename.endswith('.txt'):
            return file_storage.read().decode('utf-8', errors='ignore')

        elif filename.endswith('.pdf'):
            import pdfplumber
            import tempfile, os
            with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp:
                file_storage.save(tmp)
                tmp_path = tmp.name
            try:
                text_parts = []
                with pdfplumber.open(tmp_path) as pdf:
                    for page in pdf.pages:
                        page_text = page.extract_text()
                        if page_text:
                            text_parts.append(page_text)
                return '\n'.join(text_parts)
            finally:
                os.unlink(tmp_path)

        elif filename.endswith('.docx'):
            try:
                import zipfile
                import xml.etree.ElementTree as ET
                import tempfile, os
                with tempfile.NamedTemporaryFile(delete=False, suffix='.docx') as tmp:
                    file_storage.save(tmp)
                    tmp_path = tmp.name
                try:
                    with zipfile.ZipFile(tmp_path) as z:
                        with z.open('word/document.xml') as f:
                            tree = ET.parse(f)
                            root = tree.getroot()
                            ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
                            paragraphs = root.findall('.//w:p', ns)
                            texts = []
                            for p in paragraphs:
                                runs = p.findall('.//w:t', ns)
                                para_text = ''.join(r.text or '' for r in runs)
                                if para_text.strip():
                                    texts.append(para_text)
                            return '\n'.join(texts)
                finally:
                    os.unlink(tmp_path)
            except Exception as e:
                return f"Ошибка чтения DOCX: {e}"

        return ""
