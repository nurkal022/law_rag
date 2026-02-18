#!/bin/bash
# Скрипт для запуска всей системы Law RAG (локальная конфигурация)
# Использует только Ollama с моделью gpt-oss:20b

set -e  # Останавливаем выполнение при ошибке

# ============================================================
# ОФЛАЙН РЕЖИМ: Используем только локальные модели
# ============================================================
export HF_HUB_OFFLINE=1
export TRANSFORMERS_OFFLINE=1
export HF_DATASETS_OFFLINE=1
export HF_LOCAL_FILES_ONLY=true
# Отключаем проверку обновлений для sentence-transformers
export SENTENCE_TRANSFORMERS_HOME="$HOME/.cache/huggingface/hub"

echo "🚀 Запуск ИИ системы для юридических документов (локальная конфигурация)"
echo "============================================================"

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Проверка виртуального окружения
if [ ! -d "venv" ]; then
    echo -e "${YELLOW}📦 Создание виртуального окружения...${NC}"
    python3 -m venv venv
fi

# Активация виртуального окружения
echo -e "${YELLOW}📦 Активация виртуального окружения...${NC}"
source venv/bin/activate

# Проверка зависимостей
if ! venv/bin/python3 -c "import flask" 2>/dev/null; then
    echo -e "${YELLOW}⚠️  Установка зависимостей...${NC}"
    venv/bin/pip install -r requirements.txt
fi

# Проверка и предзагрузка модели эмбеддингов (офлайн режим)
echo ""
echo -e "${BLUE}🧠 Проверка модели эмбеддингов (офлайн режим)...${NC}"
if venv/bin/python3 -c "
import os
os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['TRANSFORMERS_OFFLINE'] = '1'
from sentence_transformers import SentenceTransformer
model = SentenceTransformer('sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2', local_files_only=True, device='cpu')
embedding = model.encode('тест')
print(f'OK: размерность {len(embedding)}')
" 2>/dev/null; then
    echo -e "${GREEN}✅ Модель эмбеддингов доступна (офлайн)${NC}"
else
    echo -e "${YELLOW}⚠️  Модель эмбеддингов не найдена в локальном кеше${NC}"
    echo -e "${YELLOW}   Для загрузки моделей нужен интернет (один раз)${NC}"
    echo -e "${YELLOW}   Система будет работать с поиском по ключевым словам${NC}"
fi

# Проверка Ollama (основной локальный провайдер)
echo ""
echo -e "${BLUE}🔍 Проверка Ollama...${NC}"
if command -v ollama &> /dev/null; then
    if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Ollama запущена${NC}"
        # Проверяем наличие модели gpt-oss:20b
        if ollama list 2>/dev/null | grep -q "gpt-oss:20b"; then
            echo -e "${GREEN}   ✅ Модель gpt-oss:20b найдена${NC}"
        else
            echo -e "${YELLOW}⚠️  Модель gpt-oss:20b не найдена. Установите модель:${NC}"
            echo "   ollama pull gpt-oss:20b"
            # Показываем общее количество моделей для информации
            MODEL_COUNT=$(ollama list 2>/dev/null | wc -l 2>/dev/null || echo "0")
            MODEL_COUNT=$(echo "$MODEL_COUNT" | tr -d '[:space:]')
            if [ -n "$MODEL_COUNT" ] && [ "$MODEL_COUNT" != "0" ] && [ "$MODEL_COUNT" != "1" ]; then
                echo -e "${BLUE}   (Всего моделей в Ollama: $((MODEL_COUNT - 1)))${NC}"
            fi
        fi
    else
        echo -e "${YELLOW}⚠️  Ollama не запущена. Запустите:${NC}"
        echo "   ollama serve"
        echo ""
        echo -e "${YELLOW}   Или установите Ollama: https://ollama.ai${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Ollama не установлена${NC}"
    echo "   Установите: https://ollama.ai"
fi

# Fine-tuned API больше не используется - только Ollama

# Запуск Flask приложения
echo ""
echo -e "${GREEN}🌐 Запуск Flask приложения...${NC}"
echo "============================================================"
echo ""
echo -e "${BLUE}Локальная конфигурация:${NC}"
echo "  ✅ Используется только Ollama с моделью gpt-oss:20b"
echo "  ✅ Работает без интернета (после загрузки моделей)"
echo "  ✅ Нет зависимости от облачных API"
echo ""
echo "Приложение будет доступно по адресам:"
echo "  - http://localhost:5003 (Главная страница)"
echo "  - http://localhost:5003/chat (Чат с поиском по документам)"
echo "  - http://localhost:5003/chat-simple (Простой чат без поиска)"
echo "  - http://localhost:5003/admin (Админ панель)"
echo ""
echo -e "${YELLOW}Настройка модели:${NC}"
echo "  - Используется Ollama с моделью gpt-oss:20b"
echo "  - Измените LLM_MODEL в .env для другой модели Ollama"
echo "  - Или настройте в /admin → Настройки моделей LLM"
echo ""
echo "Для остановки нажмите Ctrl+C"
echo "============================================================"
echo ""

# Запуск Flask приложения
venv/bin/python3 app.py

