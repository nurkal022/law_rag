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
        
        # Конвертируем формат сообщений для Ollama.
        # Gemma 2/3/4 не поддерживает role="system" — склеиваем системный промпт
        # в первое user-сообщение, иначе модель его молча игнорирует.
        is_gemma = model.lower().startswith("gemma")
        ollama_messages = []
        if is_gemma:
            system_text = "\n\n".join(m["content"] for m in messages if m["role"] == "system")
            for msg in messages:
                if msg["role"] == "system":
                    continue
                if msg["role"] == "user" and system_text and not ollama_messages:
                    ollama_messages.append({
                        "role": "user",
                        "content": f"{system_text}\n\nВопрос: {msg['content']}",
                    })
                    system_text = ""
                else:
                    ollama_messages.append({"role": msg["role"], "content": msg["content"]})
        else:
            for msg in messages:
                ollama_messages.append({"role": msg["role"], "content": msg["content"]})

        # Reasoning-модели (gpt-oss и пр.) генерируют thinking-токены, которые
        # не идут в content. Для нашего use case (юридический ответ) thinking
        # не нужен и съедает num_predict — отключаем.
        request_payload = {
            "model": model,
            "messages": ollama_messages,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens,
                **kwargs.get('options', {})
            },
            "stream": False,
            "think": False,
            "keep_alive": "10m",
        }

        try:
            response = requests.post(
                f"{self.base_url}/api/chat",
                json=request_payload,
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
            body = ''
            try:
                body = e.response.text[:500] if e.response is not None else ''
            except Exception:
                pass
            raise Exception(f"Ошибка Ollama API: {str(e)} | body: {body}")
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

