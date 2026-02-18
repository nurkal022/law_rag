import os
from dotenv import load_dotenv

load_dotenv()

# Отключаем предупреждения tokenizers о параллелизме
os.environ['TOKENIZERS_PARALLELISM'] = 'false'

class Config:
    # LLM Provider настройки
    LLM_PROVIDER_TYPE = os.getenv('LLM_PROVIDER_TYPE', 'ollama')
    LLM_MODEL = os.getenv('LLM_MODEL', 'gpt-oss:20b')

    # OpenAI настройки
    OPENAI_API_KEY = os.getenv('OPENAI_API_KEY', '')

    # Ollama настройки
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

    # База данных
    DATABASE_PATH = os.path.join(os.path.abspath(os.path.dirname(__file__)), 'database', 'law_database.db')
    SQLALCHEMY_DATABASE_URI = f'sqlite:///{DATABASE_PATH}'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_timeout': 20,
        'pool_recycle': -1,
        'pool_pre_ping': True
    }
    
    # Обработка документов
    CHUNK_SIZE = 1000  # Размер чанка в символах
    CHUNK_OVERLAP = 200  # Перекрытие между чанками
    
    # Настройки ИИ системы
    MAX_TOKENS = 4000  # Максимум токенов для LLM
    TEMPERATURE = 0.1  # Температура для более точных ответов
    TOP_K_RESULTS = 5  # Количество релевантных чанков для контекста
    
    # Embeddings
    EMBEDDING_MODEL = os.getenv('EMBEDDING_MODEL', 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2')
    EMBEDDING_MODEL_OFFLINE = os.getenv('EMBEDDING_MODEL_OFFLINE', 'all-MiniLM-L6-v2')  # Альтернативная модель
    EMBEDDING_DIMENSION = 384
    # Использование GPU для эмбеддингов
    # RTX 5090 (sm_120) пока не поддерживается PyTorch, используем CPU по умолчанию
    USE_GPU_FOR_EMBEDDINGS = os.getenv('USE_GPU_FOR_EMBEDDINGS', 'false').lower()  # 'auto', 'true', 'false'
    
    # Flask настройки
    SECRET_KEY = os.getenv('SECRET_KEY', 'lawai-secret-key')
    DEBUG = os.getenv('DEBUG', 'True').lower() == 'true'
    
    # Директории
    DOCUMENTS_DIR = 'current'
    STATIC_DIR = 'static'
    TEMPLATES_DIR = 'templates' 