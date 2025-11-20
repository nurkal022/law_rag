import requests
from typing import List, Dict, Optional
from .base import LLMProvider

class OllamaProvider(LLMProvider):
    """Провайдер для Ollama (локальные модели)"""
    
    def __init__(self, base_url: str = "http://localhost:11434", default_model: str = "llama3.2"):
        """
        Инициализация Ollama провайдера
        
        Args:
            base_url: URL Ollama сервера (по умолчанию http://localhost:11434)
            default_model: Модель по умолчанию
        """
        self.base_url = base_url.rstrip('/')
        self.default_model = default_model
    
    def chat_completion(self, messages: List[Dict[str, str]], 
                      model: str = None,
                      temperature: float = 0.7,
                      max_tokens: int = 2000,
                      **kwargs) -> Dict:
        """Выполняет запрос к Ollama API"""
        model = model or self.default_model
        
        # Конвертируем формат сообщений для Ollama
        # Ollama использует формат с полем "content" и "role"
        ollama_messages = []
        for msg in messages:
            ollama_messages.append({
                "role": msg["role"],
                "content": msg["content"]
            })
        
        try:
            response = requests.post(
                f"{self.base_url}/api/chat",
                json={
                    "model": model,
                    "messages": ollama_messages,
                    "options": {
                        "temperature": temperature,
                        "num_predict": max_tokens,
                        **kwargs.get('options', {})
                    },
                    "stream": False
                },
                timeout=300  # 5 минут таймаут для больших моделей
            )
            
            response.raise_for_status()
            data = response.json()
            
            return {
                'content': data.get('message', {}).get('content', '').strip(),
                'model': data.get('model', model),
                'usage': {
                    'prompt_tokens': data.get('prompt_eval_count', 0),
                    'completion_tokens': data.get('eval_count', 0),
                    'total_tokens': data.get('prompt_eval_count', 0) + data.get('eval_count', 0)
                } if 'prompt_eval_count' in data else None
            }
        except requests.exceptions.RequestException as e:
            raise Exception(f"Ошибка Ollama API: {str(e)}")
        except Exception as e:
            raise Exception(f"Ошибка при обработке ответа Ollama: {str(e)}")
    
    def is_available(self) -> bool:
        """Проверяет доступность Ollama сервера"""
        try:
            response = requests.get(f"{self.base_url}/api/tags", timeout=5)
            return response.status_code == 200
        except:
            return False
    
    def get_available_models(self) -> List[str]:
        """Возвращает список доступных моделей Ollama"""
        try:
            response = requests.get(f"{self.base_url}/api/tags", timeout=10)
            response.raise_for_status()
            data = response.json()
            models = [model['name'] for model in data.get('models', [])]
            return models
        except:
            # Возвращаем список популярных моделей по умолчанию
            return [
                'llama3.2', 'llama3.1', 'llama3', 
                'mistral', 'mixtral', 
                'qwen2.5', 'qwen2',
                'phi3', 'gemma2'
            ]

