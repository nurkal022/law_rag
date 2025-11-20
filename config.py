import os
from dotenv import load_dotenv

load_dotenv()

# Отключаем предупреждения tokenizers о параллелизме
os.environ['TOKENIZERS_PARALLELISM'] = 'false'

class Config:
    # LLM Provider настройки
    LLM_PROVIDER_TYPE = os.getenv('LLM_PROVIDER_TYPE', 'openai')  # 'openai' или 'ollama'
    LLM_MODEL = os.getenv('LLM_MODEL', 'gpt-4o')  # Модель по умолчанию (можно использовать gpt-5-mini, gpt-4o-mini и др.)
    
    # OpenAI настройки
    OPENAI_API_KEY = os.getenv('OPENAI_API_KEY', '')
    
    # Ollama настройки
    OLLAMA_BASE_URL = os.getenv('OLLAMA_BASE_URL', 'http://localhost:11434')
    
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
    
    # RAG настройки
    MAX_TOKENS = 4000  # Максимум токенов для GPT
    TEMPERATURE = 0.1  # Температура для более точных ответов
    TOP_K_RESULTS = 5  # Количество релевантных чанков для контекста
    
    # Embeddings
    EMBEDDING_MODEL = 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2'
    EMBEDDING_MODEL_OFFLINE = 'all-MiniLM-L6-v2'  # Альтернативная модель
    EMBEDDING_DIMENSION = 384
    
    # Flask настройки
    SECRET_KEY = os.getenv('SECRET_KEY', 'law-rag-secret-key')
    DEBUG = os.getenv('DEBUG', 'True').lower() == 'true'
    
    # Директории
    DOCUMENTS_DIR = 'current'
    STATIC_DIR = 'static'
    TEMPLATES_DIR = 'templates' 