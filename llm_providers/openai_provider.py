import openai
from typing import List, Dict, Optional
from .base import LLMProvider

class OpenAIProvider(LLMProvider):
    """Провайдер для OpenAI API и OpenAI-совместимых серверов (vLLM и др.)"""

    def __init__(self, api_key: str, default_model: str = "gpt-4o", base_url: str = None):
        """
        Инициализация OpenAI(-совместимого) провайдера

        Args:
            api_key: API ключ. Для облачного OpenAI обязателен; для локального
                vLLM ключ не проверяется, но SDK требует непустую строку.
            default_model: Модель по умолчанию
            base_url: URL OpenAI-совместимого эндпоинта (напр. http://localhost:8000/v1).
                Если не задан — используется облачный OpenAI.
        """
        if not api_key:
            raise ValueError("OpenAI API ключ обязателен")

        client_kwargs = {'api_key': api_key}
        if base_url:
            client_kwargs['base_url'] = base_url
        self.client = openai.OpenAI(**client_kwargs)
        self.default_model = default_model
        self.api_key = api_key
        self.base_url = base_url
    
    def chat_completion(self, messages: List[Dict[str, str]], 
                      model: str = None,
                      temperature: float = 0.7,
                      max_tokens: int = 2000,
                      **kwargs) -> Dict:
        """Выполняет запрос к OpenAI API"""
        model = model or self.default_model
        
        try:
            response = self.client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                **kwargs
            )
            
            return {
                'content': response.choices[0].message.content.strip(),
                'model': response.model,
                'usage': {
                    'prompt_tokens': response.usage.prompt_tokens if response.usage else 0,
                    'completion_tokens': response.usage.completion_tokens if response.usage else 0,
                    'total_tokens': response.usage.total_tokens if response.usage else 0
                } if response.usage else None
            }
        except openai.AuthenticationError as e:
            raise Exception(f"Неверный API ключ OpenAI. Проверьте правильность ключа в настройках или переключитесь на Ollama для локальных моделей.")
        except openai.RateLimitError as e:
            raise Exception(f"Превышен лимит запросов к OpenAI API. Попробуйте позже или переключитесь на Ollama.")
        except openai.APIError as e:
            error_code = getattr(e, 'status_code', None)
            if error_code == 401:
                raise Exception(f"Неверный API ключ OpenAI. Проверьте настройки или используйте Ollama для локальных моделей.")
            elif error_code == 429:
                raise Exception(f"Превышен лимит запросов. Попробуйте позже или переключитесь на Ollama.")
            else:
                raise Exception(f"Ошибка OpenAI API (код {error_code}): {str(e)}")
        except Exception as e:
            error_str = str(e)
            if "401" in error_str or "invalid_api_key" in error_str.lower() or "incorrect api key" in error_str.lower():
                raise Exception(f"Неверный API ключ OpenAI. Проверьте настройки в /admin или переключитесь на Ollama для локальных моделей.")
            raise Exception(f"Ошибка OpenAI API: {str(e)}")
    
    def is_available(self) -> bool:
        """Проверяет доступность OpenAI API"""
        try:
            # Простая проверка - пытаемся получить список моделей
            self.client.models.list()
            return True
        except:
            return False
    
    def get_available_models(self) -> List[str]:
        """Возвращает список доступных моделей"""
        # Локальный OpenAI-совместимый сервер (vLLM): отдаёт свои модели
        # (gemma4 и т.п.) — берём их как есть, без фильтра по "gpt".
        if self.base_url:
            try:
                models = self.client.models.list()
                return [m.id for m in models.data]
            except Exception:
                return [self.default_model]
        try:
            models = self.client.models.list()
            # Фильтруем только chat модели
            chat_models = [
                model.id for model in models.data 
                if 'gpt' in model.id.lower() and 'instruct' not in model.id.lower()
            ]
            # Сортируем по популярности (актуальные модели 2024-2025)
            preferred_order = [
                'gpt-5-mini', 'gpt-5', 'gpt-4o', 'gpt-4o-mini', 
                'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'
            ]
            sorted_models = []
            for preferred in preferred_order:
                for model in chat_models:
                    if preferred in model and model not in sorted_models:
                        sorted_models.append(model)
            # Добавляем остальные
            for model in chat_models:
                if model not in sorted_models:
                    sorted_models.append(model)
            return sorted_models[:15]  # Ограничиваем до 15 моделей
        except:
            # Возвращаем список по умолчанию если API недоступен (актуальные модели)
            return [
                'gpt-5-mini', 'gpt-5', 'gpt-4o', 'gpt-4o-mini', 
                'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'
            ]

