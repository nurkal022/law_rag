import os
from dotenv import load_dotenv

load_dotenv()

# Отключаем предупреждения tokenizers о параллелизме
os.environ['TOKENIZERS_PARALLELISM'] = 'false'

class Config:
    # LLM Provider настройки
    # 'local' — централизованный OpenAI-совместимый сервис (vLLM на сервере с GPU)
    # 'openai' — облачный OpenAI; 'ollama' — устаревший локальный Ollama
    LLM_PROVIDER_TYPE = os.getenv('LLM_PROVIDER_TYPE', 'local')
    LLM_MODEL = os.getenv('LLM_MODEL', 'gemma4')

    # OpenAI настройки
    OPENAI_API_KEY = os.getenv('OPENAI_API_KEY', '')

    # Локальный централизованный LLM-сервис (OpenAI-совместимый, vLLM)
    # С самого сервера: http://localhost:8000/v1
    # С других машин в сети: http://10.1.17.61:8000/v1
    LOCAL_LLM_BASE_URL = os.getenv('LOCAL_LLM_BASE_URL', 'http://localhost:8000/v1')
    # API-ключ vLLM не проверяет, но OpenAI SDK требует непустую строку
    LOCAL_LLM_API_KEY = os.getenv('LOCAL_LLM_API_KEY', 'not-needed')

    # Ollama настройки (устарело)
    OLLAMA_BASE_URL = os.getenv('OLLAMA_BASE_URL', 'http://localhost:11434')

    # Fine-tuned модель настройки
    FINETUNED_API_URL = os.getenv('FINETUNED_API_URL', 'http://localhost:8000')

    @staticmethod
    def save_to_env(settings: dict):
        """Сохраняет настройки в .env файл и обновляет runtime-конфигурацию"""
        env_path = os.path.join(os.path.abspath(os.path.dirname(__file__)), '.env')

        # Читаем текущий .env
        lines = []
        if os.path.exists(env_path):
            with open(env_path, 'r') as f:
                lines = f.readlines()

        # Обновляем существующие ключи или добавляем новые
        updated_keys = set()
        for i, line in enumerate(lines):
            stripped = line.strip()
            if not stripped or stripped.startswith('#'):
                continue
            if '=' in stripped:
                key = stripped.split('=', 1)[0].strip()
                if key in settings:
                    lines[i] = f"{key}={settings[key]}\n"
                    updated_keys.add(key)

        # Добавляем новые ключи
        for key, val in settings.items():
            if key not in updated_keys:
                lines.append(f"{key}={val}\n")

        # Записываем
        with open(env_path, 'w') as f:
            f.writelines(lines)

        # Обновляем os.environ и Config атрибуты
        config_map = {
            'LLM_PROVIDER_TYPE': 'LLM_PROVIDER_TYPE',
            'LLM_MODEL': 'LLM_MODEL',
            'OPENAI_API_KEY': 'OPENAI_API_KEY',
            'LOCAL_LLM_BASE_URL': 'LOCAL_LLM_BASE_URL',
            'LOCAL_LLM_API_KEY': 'LOCAL_LLM_API_KEY',
            'OLLAMA_BASE_URL': 'OLLAMA_BASE_URL',
            'FINETUNED_API_URL': 'FINETUNED_API_URL',
            'TEMPERATURE': 'TEMPERATURE',
            'MAX_TOKENS': 'MAX_TOKENS',
            'TOP_K_RESULTS': 'TOP_K_RESULTS',
        }
        for key, val in settings.items():
            os.environ[key] = str(val)
            if key in config_map:
                attr = config_map[key]
                # Конвертируем типы
                if attr in ('TEMPERATURE',):
                    setattr(Config, attr, float(val))
                elif attr in ('MAX_TOKENS', 'TOP_K_RESULTS'):
                    setattr(Config, attr, int(val))
                else:
                    setattr(Config, attr, str(val))

    # База данных (PostgreSQL)
    DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://lawai:lawai_dev_2026@localhost:5433/lawai')
    SQLALCHEMY_DATABASE_URI = DATABASE_URL
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_size': 10,
        'pool_timeout': 30,
        'pool_recycle': 1800,
        'pool_pre_ping': True
    }
    
    # Обработка документов
    CHUNK_SIZE = 1000  # Размер чанка в символах
    CHUNK_OVERLAP = 200  # Перекрытие между чанками
    
    # Настройки ИИ системы
    MAX_TOKENS = 4000  # Максимум токенов для LLM
    TEMPERATURE = 0.1  # Температура для более точных ответов
    TOP_K_RESULTS = 5  # Количество релевантных чанков для контекста
    
    # Embeddings — централизованный сервис (OpenAI-совместимый, BGE-M3 на сервере с GPU)
    # С самого сервера: http://localhost:8002/v1; с других машин: http://10.1.17.61:8002/v1
    EMBEDDING_BASE_URL = os.getenv('EMBEDDING_BASE_URL', 'http://localhost:8002/v1')
    EMBEDDING_API_KEY = os.getenv('EMBEDDING_API_KEY', 'not-needed')
    EMBEDDING_MODEL = os.getenv('EMBEDDING_MODEL', 'bge-m3')
    EMBEDDING_DIMENSION = 1024  # BGE-M3 → 1024
    # Rerank того же сервиса (BGE-M3 умеет /v1/rerank) — переупорядочивает кандидатов
    EMBEDDING_RERANK_MODEL = os.getenv('EMBEDDING_RERANK_MODEL', 'bge-m3')
    USE_RERANK = os.getenv('USE_RERANK', 'true').lower() == 'true'
    
    # Flask настройки
    SECRET_KEY = os.getenv('SECRET_KEY', 'lawai-secret-key')
    DEBUG = os.getenv('DEBUG', 'True').lower() == 'true'

    # Администратор
    ADMIN_USERNAME = os.getenv('ADMIN_USERNAME', 'admin')
    ADMIN_PASSWORD = os.getenv('ADMIN_PASSWORD', 'changeme')
    
    # Директории
    DOCUMENTS_DIR = 'docs'
    STATIC_DIR = 'static'
    TEMPLATES_DIR = 'templates' 