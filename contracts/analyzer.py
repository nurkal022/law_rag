from typing import Dict, Optional
from config import Config
from llm_providers.base import LLMProvider


class ContractAnalyzer:
    """Анализатор договоров — проверка рисков и соответствия законодательству РК"""

    def __init__(self, provider: LLMProvider = None, retriever=None):
        self.provider = provider
        self.retriever = retriever

    def analyze(self, text: str, contract_type: str = None) -> dict:
        """Analyze contract text for risks, missing clauses, and compliance"""
        if not self.provider:
            return {'success': False, 'error': 'LLM провайдер не настроен'}

        if not text or len(text.strip()) < 50:
            return {'success': False, 'error': 'Текст договора слишком короткий для анализа'}

        # Truncate very long contracts
        analysis_text = text[:8000] if len(text) > 8000 else text

        # Get legal context from RAG if available
        legal_context = ""
        if self.retriever:
            try:
                search_query = f"договор {contract_type or ''} требования обязательные условия законодательство РК"
                results = self.retriever.hybrid_search(search_query, top_k=3)
                if results:
                    legal_context = "\n\nРЕЛЕВАНТНЫЕ НОРМЫ ЗАКОНОДАТЕЛЬСТВА РК:\n"
                    for r in results:
                        legal_context += f"[{r.get('title', '')}]: {r.get('content', '')[:500]}\n\n"
            except Exception as e:
                print(f"RAG search error in analyzer: {e}")

        type_hint = f"\nТип договора (предположительно): {contract_type}" if contract_type else ""

        system_prompt = f"""Вы — опытный юрист-аналитик, специализирующийся на договорном праве Республики Казахстан.

ЗАДАЧА: Проведите комплексный анализ предоставленного договора.
{type_hint}
{legal_context}

Ответьте СТРОГО в формате JSON (без markdown, без ```json, просто чистый JSON):
{{
    "contract_type_detected": "тип договора (sale/lease/services/employment/loan/supply/construction/nda/agency/other)",
    "overall_score": число от 0 до 100,
    "summary": "краткое описание договора в 1-2 предложениях",
    "risks": [
        {{
            "severity": "high/medium/low",
            "title": "название риска",
            "description": "описание проблемы",
            "recommendation": "как исправить"
        }}
    ],
    "missing_clauses": [
        {{
            "clause": "название пропущенного пункта",
            "importance": "critical/recommended/optional",
            "reason": "почему нужен этот пункт"
        }}
    ],
    "compliance": [
        {{
            "law": "ссылка на закон/статью",
            "status": "compliant/warning/violation",
            "note": "пояснение"
        }}
    ],
    "recommendations": [
        {{
            "priority": "high/medium/low",
            "title": "заголовок",
            "description": "что нужно сделать"
        }}
    ],
    "strengths": ["список сильных сторон договора"]
}}"""

        user_message = f"Проанализируйте следующий договор:\n\n{analysis_text}"

        try:
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ]

            response = self.provider.chat_completion(
                messages=messages,
                model=Config.LLM_MODEL,
                temperature=0.1,
                max_tokens=Config.MAX_TOKENS
            )

            content = response['content']

            # Parse JSON response
            import json
            # Try to extract JSON from response
            try:
                # Remove markdown code blocks if present
                if '```json' in content:
                    content = content.split('```json')[1].split('```')[0]
                elif '```' in content:
                    content = content.split('```')[1].split('```')[0]
                analysis = json.loads(content.strip())
            except json.JSONDecodeError:
                # If JSON parsing fails, return raw text
                analysis = {
                    'overall_score': 50,
                    'summary': content[:500],
                    'risks': [],
                    'missing_clauses': [],
                    'compliance': [],
                    'recommendations': [{'priority': 'medium', 'title': 'Ручная проверка', 'description': 'Не удалось провести структурированный анализ. Рекомендуется ручная проверка.'}],
                    'strengths': [],
                    'raw_analysis': content
                }

            return {
                'success': True,
                'analysis': analysis,
                'metadata': {
                    'analyzed_at': __import__('datetime').datetime.utcnow().isoformat(),
                    'text_length': len(text),
                    'model': response.get('model', Config.LLM_MODEL)
                }
            }
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def extract_text_from_file(self, file_storage) -> str:
        """Extract text from uploaded file (PDF, DOCX, TXT)"""
        filename = file_storage.filename.lower()

        if filename.endswith('.txt'):
            return file_storage.read().decode('utf-8', errors='ignore')

        elif filename.endswith('.pdf'):
            import pdfplumber
            import tempfile, os
            # Save to temp file for pdfplumber
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
