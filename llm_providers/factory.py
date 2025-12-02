from typing import Optional
from .base import LLMProvider
from .openai_provider import OpenAIProvider
from .ollama_provider import OllamaProvider
from .finetuned_provider import FineTunedModelProvider
from config import Config

class LLMProviderFactory:
    """Фабрика для создания провайдеров LLM"""
    
    @staticmethod
    def create_provider(provider_type: str = None, **kwargs) -> Optional[LLMProvider]:
        """
        Создает провайдер LLM (локальные провайдеры)
        
        Args:
            provider_type: Тип провайдера ('ollama' или 'finetuned' для локальной работы)
            **kwargs: Дополнительные параметры для провайдера
            
        Returns:
            Экземпляр провайдера или None
        """
        provider_type = provider_type or Config.LLM_PROVIDER_TYPE
        
        # OpenAI провайдер (deprecated для локальной конфигурации)
        if provider_type == 'openai':
            api_key = kwargs.get('api_key') or Config.OPENAI_API_KEY
            model = kwargs.get('model') or Config.LLM_MODEL
            if not api_key:
                print("⚠️  OpenAI провайдер требует API ключ. Используйте локальные провайдеры (Ollama/Fine-tuned)")
                return None
            return OpenAIProvider(api_key=api_key, default_model=model)
        
        # Ollama провайдер (основной локальный провайдер)
        elif provider_type == 'ollama':
            base_url = kwargs.get('base_url') or Config.OLLAMA_BASE_URL
            model = kwargs.get('model') or Config.LLM_MODEL
            return OllamaProvider(base_url=base_url, default_model=model)
        
        # Fine-tuned провайдер (альтернативный локальный провайдер)
        elif provider_type == 'finetuned':
            base_url = kwargs.get('base_url') or Config.FINETUNED_API_URL
            return FineTunedModelProvider(base_url=base_url)
        
        else:
            raise ValueError(f"Неизвестный тип провайдера: {provider_type}. Используйте 'ollama' или 'finetuned' для локальной работы")
    
    @staticmethod
    def get_current_provider() -> Optional[LLMProvider]:
        """Получает текущий провайдер из конфигурации"""
        return LLMProviderFactory.create_provider()

