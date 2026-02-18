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
            api_key: API ключ (deprecated, для обратной совместимости)
        """
        if provider:
            self.provider = provider
        else:
            # Используем провайдер из конфигурации (локальные провайдеры)
            self.provider = LLMProviderFactory.get_current_provider()
            
            # Если передан api_key (старый способ), предупреждаем
            if api_key:
                print("⚠️  Использование api_key устарело. Используйте локальные провайдеры (Ollama/Fine-tuned)")
        
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
        
        # Подготавливаем контекст
        has_context = bool(search_results)
        context = self._prepare_context(search_results) if has_context else "Релевантные документы не найдены в базе данных."
        sources = self._prepare_sources_list(search_results) if has_context else []
        
        # Формируем системный промпт
        if has_context:
            system_prompt = f"""Вы - AI-ассистент по юридическим вопросам Казахстана. Ваша задача - предоставлять точные и полезные ответы на основе предоставленных юридических документов.

ИНСТРУКЦИИ:
1. В первую очередь используйте информацию из предоставленного контекста документов
2. Если в контексте недостаточно информации для полного ответа, дополните ответ своими знаниями о законодательстве Казахстана
3. Всегда указывайте источники из документов, используя номера [Источник 1], [Источник 2] и т.д., если используете информацию из контекста
4. Если используете свои знания (не из контекста), укажите это явно: "На основе общих знаний о законодательстве РК..."
5. Предоставляйте конкретные ссылки на статьи, пункты или разделы документов, когда это возможно
6. Отвечайте на русском языке
7. Будьте точными и избегайте домыслов
8. Если вопрос требует юридической консультации, рекомендуйте обратиться к квалифицированному юристу

КОНТЕКСТ ИЗ ДОКУМЕНТОВ:
{context}

При ответе обязательно указывайте номера источников в квадратных скобках, если используете информацию из контекста, например [Источник 1], [Источник 2]."""
        else:
            # Если контекста нет, модель отвечает из своих знаний
            system_prompt = """Вы - AI-ассистент по юридическим вопросам Казахстана. Ваша задача - предоставлять точные и полезные ответы на юридические вопросы.

ИНСТРУКЦИИ:
1. Отвечайте на основе ваших знаний о законодательстве Республики Казахстан
2. Укажите, что ответ основан на общих знаниях о законодательстве РК
3. Будьте точными и информативными
4. Если вы не уверены в ответе, честно об этом скажите
5. Отвечайте на русском языке
6. Если вопрос требует конкретной информации из документов, которые не были найдены, укажите это
7. Если вопрос требует юридической консультации, рекомендуйте обратиться к квалифицированному юристу

ВАЖНО: В базе документов не найдено релевантной информации для данного запроса, поэтому отвечайте на основе своих знаний о законодательстве Казахстана."""

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
            if has_context and search_results:
                confidence = min(0.9, len(search_results) * 0.15 + 
                               sum(r.get('final_score', r.get('similarity_score', 0)) 
                                   for r in search_results) / len(search_results))
            else:
                # Если отвечаем из памяти модели, confidence ниже
                confidence = 0.6  # Средняя уверенность для ответов из памяти модели
            
            return {
                'answer': answer,
                'sources': sources,
                'confidence': confidence,
                'model_used': response.get('model', Config.LLM_MODEL),
                'tokens_used': response.get('usage', {}).get('total_tokens', 0) if response.get('usage') else 0,
                'used_model_knowledge': not has_context  # Флаг, что использовались знания модели
            }
            
        except Exception as e:
            error_msg = str(e)
            print(f"Ошибка при генерации ответа: {e}")
            
            # Определяем тип ошибки и формируем понятное сообщение
            if "неверный api ключ" in error_msg.lower() or "invalid_api_key" in error_msg.lower() or "401" in error_msg:
                user_message = """⚠️ **Проблема с подключением к LLM провайдеру**

**Решения для локальной работы:**
1. Для Ollama: убедитесь, что Ollama запущена (`ollama serve`)
2. Для Fine-tuned: убедитесь, что API запущен на http://localhost:8000
3. Проверьте настройки в `/admin` → Настройки моделей LLM

**Быстрый старт:**
```bash
# Для Ollama
ollama serve
ollama pull gpt-oss:20b

# Для Fine-tuned API
cd /home/kaznu2025/fine_tune_llm_2222
./api_manager.sh start
```"""
            elif "лимит" in error_msg.lower() or "rate limit" in error_msg.lower() or "429" in error_msg:
                user_message = """⚠️ **Превышен лимит запросов**

**Решения:**
1. Подождите несколько минут и попробуйте снова
2. Для Ollama: лимитов нет, проверьте что сервер запущен
3. Для Fine-tuned: проверьте статус API сервера"""
            elif "connection" in error_msg.lower() or "недоступен" in error_msg.lower():
                user_message = f"""⚠️ **Провайдер недоступен**

**Ошибка:** {error_msg}

**Решения:**
1. Для Ollama: проверьте что `ollama serve` запущен
2. Для Fine-tuned: проверьте что API запущен на {Config.FINETUNED_API_URL}
3. Проверьте настройки в `/admin` → Настройки моделей LLM"""
            else:
                user_message = f"Извините, произошла ошибка при генерации ответа: {error_msg}\n\nПроверьте настройки LLM провайдера в `/admin`"
            
            return {
                'answer': user_message,
                'sources': sources,
                'confidence': 0.0,
                'error': error_msg,
                'error_type': 'api_error'
            }
    
    def generate_response_without_rag(self, user_query: str, 
                                      conversation_history: List[Dict] = None) -> Dict:
        """Генерация ответа без использования RAG (чистый чат с моделью)"""
        
        # Проверяем, является ли провайдер fine-tuned моделью
        # Fine-tuned модель работает напрямую с вопросом без системного промпта
        is_finetuned = hasattr(self.provider, '__class__') and 'FineTuned' in self.provider.__class__.__name__
        
        if is_finetuned:
            # Для fine-tuned модели используем только вопрос пользователя
            # История разговора не поддерживается API
            messages = [{"role": "user", "content": user_query}]
        else:
            # Системный промпт для режима без RAG (для обычных моделей)
            system_prompt = """Вы - AI-ассистент по юридическим вопросам Казахстана. Ваша задача - предоставлять полезные и информативные ответы на вопросы пользователей.

ИНСТРУКЦИИ:
1. Отвечайте на основе ваших знаний о законодательстве Республики Казахстан
2. Будьте точными, информативными и полезными
3. Если вы не уверены в ответе, честно об этом скажите
4. Отвечайте на русском языке
5. Если вопрос требует конкретной информации из документов, укажите, что для точного ответа нужен доступ к актуальным документам
6. Если вопрос требует юридической консультации, рекомендуйте обратиться к квалифицированному юристу
7. Можете отвечать на общие вопросы о законодательстве, правах граждан, процедурах и т.д.

ВАЖНО: Вы работаете в режиме общего чата без доступа к базе документов. Отвечайте на основе своих знаний о законодательстве Казахстана."""
            
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
            # Для fine-tuned модели используем меньший max_tokens (API ограничивает до 1024)
            max_tokens = 512 if is_finetuned else Config.MAX_TOKENS
            temperature = 0.75 if is_finetuned else Config.TEMPERATURE
            
            response = self.provider.chat_completion(
                messages=messages,
                model=Config.LLM_MODEL,
                temperature=temperature,
                max_tokens=max_tokens,
                top_p=0.92 if is_finetuned else 0.9,
                frequency_penalty=0.1 if not is_finetuned else None,
                presence_penalty=0.1 if not is_finetuned else None
            )
            
            answer = response['content']
            
            return {
                'answer': answer,
                'sources': [],  # Нет источников в режиме без RAG
                'confidence': 0.7,  # Средняя уверенность для ответов из памяти модели
                'model_used': response.get('model', Config.LLM_MODEL),
                'tokens_used': response.get('usage', {}).get('total_tokens', 0) if response.get('usage') else 0,
                'used_model_knowledge': True,  # Всегда используем знания модели
                'rag_mode': False  # Флаг режима без RAG
            }
            
        except Exception as e:
            error_msg = str(e)
            print(f"Ошибка при генерации ответа (без RAG): {e}")
            
            # Определяем тип ошибки и формируем понятное сообщение
            if "неверный api ключ" in error_msg.lower() or "invalid_api_key" in error_msg.lower() or "401" in error_msg:
                user_message = """⚠️ **Проблема с подключением к LLM провайдеру**

**Решения для локальной работы:**
1. Для Ollama: убедитесь, что Ollama запущена (`ollama serve`)
2. Для Fine-tuned: убедитесь, что API запущен на http://localhost:8000
3. Проверьте настройки в `/admin` → Настройки моделей LLM

**Быстрый старт:**
```bash
# Для Ollama
ollama serve
ollama pull gpt-oss:20b

# Для Fine-tuned API
cd /home/kaznu2025/fine_tune_llm_2222
./api_manager.sh start
```"""
            elif "лимит" in error_msg.lower() or "rate limit" in error_msg.lower() or "429" in error_msg:
                user_message = """⚠️ **Превышен лимит запросов**

**Решения:**
1. Подождите несколько минут и попробуйте снова
2. Для Ollama: лимитов нет, проверьте что сервер запущен
3. Для Fine-tuned: проверьте статус API сервера"""
            elif "connection" in error_msg.lower() or "недоступен" in error_msg.lower():
                user_message = f"""⚠️ **Провайдер недоступен**

**Ошибка:** {error_msg}

**Решения:**
1. Для Ollama: проверьте что `ollama serve` запущен
2. Для Fine-tuned: проверьте что API запущен на {Config.FINETUNED_API_URL}
3. Проверьте настройки в `/admin` → Настройки моделей LLM"""
            else:
                user_message = f"Извините, произошла ошибка при генерации ответа: {error_msg}\n\nПроверьте настройки LLM провайдера в `/admin`"
            
            return {
                'answer': user_message,
                'sources': [],
                'confidence': 0.0,
                'error': error_msg,
                'error_type': 'api_error',
                'rag_mode': False
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
            error_msg = str(e)
            print(f"Ошибка при валидации запроса: {e}")
            
            # Если ошибка API ключа, возвращаем базовую валидацию без вызова API
            if "неверный api ключ" in error_msg.lower() or "invalid_api_key" in error_msg.lower() or "401" in error_msg:
                return {
                    "is_legal": True,
                    "category": "общий",
                    "complexity": "средний",
                    "needs_specialist": False,
                    "recommendations": ["⚠️ LLM провайдер недоступен. Проверьте настройки Ollama или Fine-tuned модели в /admin"]
                }
            
            return {
                "is_legal": True,
                "category": "общий",
                "complexity": "средний",
                "needs_specialist": False,
                "recommendations": []
            } 