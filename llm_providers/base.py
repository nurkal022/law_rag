from abc import ABC, abstractmethod
from typing import List, Dict, Optional

class LLMProvider(ABC):
    """Абстрактный базовый класс для провайдеров LLM"""
    
    @abstractmethod
    def chat_completion(self, messages: List[Dict[str, str]], 
                      model: str = None,
                      temperature: float = 0.7,
                      max_tokens: int = 2000,
                      **kwargs) -> Dict:
        """
        Выполняет запрос к LLM API
        
        Args:
            messages: Список сообщений в формате [{"role": "user", "content": "..."}]
            model: Название модели (опционально, если используется модель по умолчанию)
            temperature: Температура генерации
            max_tokens: Максимальное количество токенов
            **kwargs: Дополнительные параметры
            
        Returns:
            Dict с полями:
                - content: str - текст ответа
                - model: str - использованная модель
                - usage: Dict - информация об использовании токенов (опционально)
        """
        pass
    
    @abstractmethod
    def is_available(self) -> bool:
        """Проверяет доступность провайдера"""
        pass
    
    @abstractmethod
    def get_available_models(self) -> List[str]:
        """Возвращает список доступных моделей"""
        pass

