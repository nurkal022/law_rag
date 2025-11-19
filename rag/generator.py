from typing import List, Dict, Tuple
import json
from config import Config
from llm_providers.factory import LLMProviderFactory
from llm_providers.base import LLMProvider

class ResponseGenerator:
    def __init__(self, provider: LLMProvider = None, api_key: str = None):
        """
        Инициализация генератора ответов
        
        Args:
            provider: Провайдер LLM (если None, создается из конфигурации)
            api_key: API ключ (для обратной совместимости с OpenAI)
        """
        if provider:
            self.provider = provider
        else:
            # Если передан api_key, используем OpenAI
            if api_key:
                from llm_providers.openai_provider import OpenAIProvider
                self.provider = OpenAIProvider(api_key=api_key, default_model=Config.LLM_MODEL)
            else:
                # Иначе используем провайдер из конфигурации
                self.provider = LLMProviderFactory.get_current_provider()
        
        if not self.provider:
            raise ValueError("Не удалось инициализировать LLM провайдер. Проверьте настройки.")
        
    def _prepare_context(self, search_results: List[Dict]) -> str:
        """Подготовка контекста из найденных документов"""
        if not search_results:
            return "Релевантные документы не найдены."
        
        context_parts = []
        for i, result in enumerate(search_results, 1):
            source_info = f"[Источник {i}: {result['title']}, позиция {result['start_position']}-{result['end_position']}]"
            content = result['full_content']
            
            context_parts.append(f"{source_info}\n{content}\n")
        
        return "\n".join(context_parts)
    
    def _prepare_sources_list(self, search_results: List[Dict]) -> List[Dict]:
        """Подготовка списка источников для ответа"""
        sources = []
        for i, result in enumerate(search_results, 1):
            sources.append({
                'id': i,
                'title': result['title'],
                'filename': result['filename'],
                'position': f"{result['start_position']}-{result['end_position']}",
                'chunk_index': result['chunk_index'],
                'similarity_score': result.get('final_score', result.get('similarity_score', 0)),
                'preview': result['preview']
            })
        return sources
    
    def generate_response(self, user_query: str, search_results: List[Dict], 
                         conversation_history: List[Dict] = None) -> Dict:
        """Генерация ответа на основе найденных документов"""
        
        if not search_results:
            return {
                'answer': "Извините, я не смог найти релевантную информацию в документах для ответа на ваш вопрос. Попробуйте переформулировать запрос или задать более конкретный вопрос.",
                'sources': [],
                'confidence': 0.0
            }
        
        # Подготавливаем контекст
        context = self._prepare_context(search_results)
        sources = self._prepare_sources_list(search_results)
        
        # Формируем системный промпт
        system_prompt = f"""Вы - AI-ассистент по юридическим вопросам Казахстана. Ваша задача - предоставлять точные и полезные ответы на основе предоставленных юридических документов.

ИНСТРУКЦИИ:
1. Отвечайте ТОЛЬКО на основе предоставленного контекста из документов
2. Если информации недостаточно, четко об этом скажите
3. Всегда указывайте источники, используя номера [Источник 1], [Источник 2] и т.д.
4. Предоставляйте конкретные ссылки на статьи, пункты или разделы документов
5. Отвечайте на русском языке
6. Будьте точными и избегайте домыслов
7. Если вопрос требует юридической консультации, рекомендуйте обратиться к квалифицированному юристу

КОНТЕКСТ ИЗ ДОКУМЕНТОВ:
{context}

При ответе обязательно указывайте номера источников в квадратных скобках, например [Источник 1], [Источник 2]."""

        # Подготавливаем историю разговора
        messages = [{"role": "system", "content": system_prompt}]
        
        if conversation_history:
            for msg in conversation_history[-5:]:  # Последние 5 сообщений
                messages.extend([
                    {"role": "user", "content": msg['user_query']},
                    {"role": "assistant", "content": msg['ai_response']}
                ])
        
        # Добавляем текущий запрос
        messages.append({"role": "user", "content": user_query})
        
        try:
            # Вызываем LLM через провайдер
            response = self.provider.chat_completion(
                messages=messages,
                model=Config.LLM_MODEL,
                temperature=Config.TEMPERATURE,
                max_tokens=Config.MAX_TOKENS,
                top_p=0.9,
                frequency_penalty=0.1,
                presence_penalty=0.1
            )
            
            answer = response['content']
            
            # Вычисляем уверенность на основе количества и качества источников
            confidence = min(0.9, len(search_results) * 0.15 + 
                           sum(r.get('final_score', r.get('similarity_score', 0)) 
                               for r in search_results) / len(search_results))
            
            return {
                'answer': answer,
                'sources': sources,
                'confidence': confidence,
                'model_used': response.get('model', Config.LLM_MODEL),
                'tokens_used': response.get('usage', {}).get('total_tokens', 0) if response.get('usage') else 0
            }
            
        except Exception as e:
            print(f"Ошибка при генерации ответа: {e}")
            return {
                'answer': f"Извините, произошла ошибка при генерации ответа: {str(e)}",
                'sources': sources,
                'confidence': 0.0,
                'error': str(e)
            }
    
    def generate_summary(self, search_results: List[Dict], topic: str = None) -> str:
        """Генерация краткого резюме по найденным документам"""
        if not search_results:
            return "Документы не найдены для создания резюме."
        
        context = self._prepare_context(search_results)
        
        topic_part = f" по теме '{topic}'" if topic else ""
        
        prompt = f"""На основе следующих юридических документов создайте краткое и структурированное резюме{topic_part}:

{context}

Резюме должно быть:
- Кратким (не более 300 слов)
- Структурированным (используйте списки и заголовки)
- Точным (только факты из документов)
- На русском языке

Включите ссылки на источники [Источник 1], [Источник 2] и т.д."""

        try:
            response = self.provider.chat_completion(
                messages=[{"role": "user", "content": prompt}],
                model=Config.LLM_MODEL,
                temperature=0.3,
                max_tokens=800
            )
            
            return response['content']
            
        except Exception as e:
            return f"Ошибка при создании резюме: {str(e)}"
    
    def extract_key_points(self, text: str) -> List[str]:
        """Извлечение ключевых пунктов из текста документа"""
        prompt = f"""Извлеките ключевые пункты из следующего юридического текста:

{text[:2000]}  # Ограничиваем длину

Представьте результат в виде списка из 5-10 самых важных пунктов. Каждый пункт должен быть:
- Конкретным и информативным
- Не более 100 символов
- На русском языке

Формат: просто список без нумерации."""

        try:
            response = self.provider.chat_completion(
                messages=[{"role": "user", "content": prompt}],
                model=Config.LLM_MODEL,
                temperature=0.2,
                max_tokens=600
            )
            
            content = response['content']
            # Разбиваем на строки и очищаем
            points = [line.strip() for line in content.split('\n') if line.strip()]
            return points[:10]  # Максимум 10 пунктов
            
        except Exception as e:
            print(f"Ошибка при извлечении ключевых пунктов: {e}")
            return []
    
    def validate_legal_query(self, query: str) -> Dict:
        """Валидация и категоризация юридического запроса"""
        prompt = f"""Проанализируйте следующий запрос и определите:

Запрос: "{query}"

1. Является ли это юридическим вопросом? (да/нет)
2. Категория вопроса (если применимо): гражданское право, уголовное право, административное право, трудовое право, налоговое право, другое
3. Уровень сложности: простой, средний, сложный
4. Нужна ли консультация специалиста? (да/нет)

Ответьте в формате JSON:
{{
    "is_legal": true/false,
    "category": "категория",
    "complexity": "уровень",
    "needs_specialist": true/false,
    "recommendations": ["список рекомендаций"]
}}"""

        try:
            response = self.provider.chat_completion(
                messages=[{"role": "user", "content": prompt}],
                model=Config.LLM_MODEL,
                temperature=0.1,
                max_tokens=400
            )
            
            content = response['content']
            
            # Пытаемся распарсить JSON
            try:
                return json.loads(content)
            except json.JSONDecodeError:
                # Если не удалось распарсить, возвращаем базовую структуру
                return {
                    "is_legal": True,
                    "category": "общий",
                    "complexity": "средний",
                    "needs_specialist": False,
                    "recommendations": ["Проконсультируйтесь с юристом для получения персональной консультации"]
                }
                
        except Exception as e:
            print(f"Ошибка при валидации запроса: {e}")
            return {
                "is_legal": True,
                "category": "общий",
                "complexity": "средний",
                "needs_specialist": False,
                "recommendations": []
            } 