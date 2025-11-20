import requests
from typing import List, Dict, Optional
from .base import LLMProvider

class FineTunedModelProvider(LLMProvider):
    """Провайдер для fine-tuned модели через API"""
    
    def __init__(self, base_url: str = "http://localhost:8000"):
        """
        Инициализация провайдера для fine-tuned модели
        
        Args:
            base_url: URL API сервера (по умолчанию http://localhost:8000)
        """
        self.base_url = base_url.rstrip('/')
    
    def chat_completion(self, messages: List[Dict[str, str]], 
                      model: str = None,
                      temperature: float = 0.75,
                      max_tokens: int = 512,
                      **kwargs) -> Dict:
        """Выполняет запрос к fine-tuned модели API"""
        
        # Извлекаем последнее сообщение пользователя из истории
        # Fine-tuned модель работает с одним вопросом, не с историей диалога
        user_query = None
        for msg in reversed(messages):
            if msg.get("role") == "user":
                user_query = msg.get("content", "")
                break
        
        if not user_query:
            raise ValueError("Не найдено сообщение пользователя")
        
        try:
            # Формируем запрос к API
            response = requests.post(
                f"{self.base_url}/ask",
                json={
                    "question": user_query,
                    "max_tokens": min(max_tokens, 1024),  # API ограничивает до 1024
                    "temperature": temperature,
                    "top_p": kwargs.get('top_p', 0.92)
                },
                timeout=300  # 5 минут таймаут для больших моделей
            )
            
            response.raise_for_status()
            data = response.json()
            
            return {
                'content': data.get('answer', '').strip(),
                'model': 'gemma-3n-4b-kazakh-law',
                'usage': {
                    'prompt_tokens': 0,  # API не возвращает эту информацию
                    'completion_tokens': data.get('tokens_used', 0),
                    'total_tokens': data.get('tokens_used', 0)
                } if 'tokens_used' in data else None
            }
        except requests.exceptions.RequestException as e:
            raise Exception(f"Ошибка Fine-tuned Model API: {str(e)}")
        except Exception as e:
            raise Exception(f"Ошибка при обработке ответа Fine-tuned Model: {str(e)}")
    
    def is_available(self) -> bool:
        """Проверяет доступность API сервера"""
        try:
            response = requests.get(f"{self.base_url}/health", timeout=5)
            if response.status_code == 200:
                data = response.json()
                return data.get('model_loaded', False)
            return False
        except:
            return False
    
    def get_available_models(self) -> List[str]:
        """Возвращает список доступных моделей"""
        return ['gemma-3n-4b-kazakh-law']

