from typing import Dict, List, Optional
from config import Config
from llm_providers.base import LLMProvider

class ContractGenerator:
    """Генератор договоров по законодательству РК"""

    def __init__(self, provider: LLMProvider = None, retriever=None):
        self.provider = provider
        self.retriever = retriever
        from .templates import ContractTemplates
        self.templates = ContractTemplates()

    def generate(self, contract_type: str, data: dict, language: str = 'ru') -> dict:
        """Generate a contract using LLM"""
        type_info = self.templates.get_type_info(contract_type)
        if not type_info:
            return {'success': False, 'error': f'Неизвестный тип договора: {contract_type}'}

        prompt_template = self.templates.get_prompt_template(contract_type, language)
        sections = self.templates.get_sections(contract_type)

        # Build context from RAG if available
        legal_context = ""
        if self.retriever:
            try:
                search_query = f"{type_info['name_ru']} договор законодательство Казахстан {type_info.get('legal_basis', '')}"
                results = self.retriever.hybrid_search(search_query, top_k=3)
                if results:
                    legal_context = "\n\nРЕЛЕВАНТНЫЕ НОРМЫ ЗАКОНОДАТЕЛЬСТВА РК:\n"
                    for r in results:
                        legal_context += f"[{r.get('title', '')}]: {r.get('content', '')[:500]}\n\n"
            except Exception as e:
                print(f"RAG search error: {e}")

        # Build system prompt
        lang_instruction = {
            'ru': 'Составьте договор на русском языке.',
            'kz': 'Шартты қазақ тілінде жасаңыз.',
            'en': 'Draft the contract in English.'
        }.get(language, 'Составьте договор на русском языке.')

        system_prompt = f"""Вы — опытный юрист, специализирующийся на договорном праве Республики Казахстан.
{lang_instruction}

ЗАДАЧА: Составьте полный текст договора типа "{type_info['name_ru']}" на основе предоставленных данных.

ПРАВОВАЯ ОСНОВА: {type_info.get('legal_basis', 'Гражданский кодекс РК')}

СТРУКТУРА ДОГОВОРА (обязательные разделы):
{chr(10).join(f'{i+1}. {s}' for i, s in enumerate(sections))}

ТРЕБОВАНИЯ:
1. Используйте правильную юридическую терминологию РК
2. Ссылайтесь на конкретные статьи ГК РК или ТК РК где применимо
3. Включите все обязательные разделы
4. Формулируйте чётко, однозначно, юридически корректно
5. Добавьте стандартные правовые оговорки (форс-мажор, разрешение споров)
{legal_context}"""

        # Build user message with contract data
        user_data_text = "ДАННЫЕ ДЛЯ ДОГОВОРА:\n"
        fields = self.templates.get_fields(contract_type)
        for field in fields:
            value = data.get(field['name'], '')
            if value:
                user_data_text += f"- {field['label_ru']}: {value}\n"

        # Additional instructions from user
        additional = data.get('additional_terms', '')
        if additional:
            user_data_text += f"\nДОПОЛНИТЕЛЬНЫЕ УСЛОВИЯ:\n{additional}\n"

        user_data_text += "\nСоставьте полный текст договора со всеми разделами."

        try:
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_data_text}
            ]

            response = self.provider.chat_completion(
                messages=messages,
                model=Config.LLM_MODEL,
                temperature=0.2,
                max_tokens=Config.MAX_TOKENS
            )

            contract_text = response['content']

            return {
                'success': True,
                'contract_text': contract_text,
                'contract_type': contract_type,
                'type_name': type_info[f'name_{language}'] if f'name_{language}' in type_info else type_info['name_ru'],
                'sections': sections,
                'legal_basis': type_info.get('legal_basis', ''),
                'language': language,
                'metadata': {
                    'generated_at': __import__('datetime').datetime.utcnow().isoformat(),
                    'model': response.get('model', Config.LLM_MODEL),
                    'tokens_used': response.get('usage', {}).get('total_tokens', 0) if response.get('usage') else 0
                }
            }
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def get_available_types(self) -> list:
        return self.templates.get_all_types()
