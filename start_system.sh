#!/bin/bash
# Скрипт для запуска всей системы Law RAG

set -e

echo "🚀 Запуск системы Law RAG"
echo "============================================================"

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Проверка виртуального окружения
if [ ! -d "venv" ]; then
    echo -e "${RED}❌ Виртуальное окружение не найдено!${NC}"
    echo "Создайте его: python3 -m venv venv"
    exit 1
fi

# Активация виртуального окружения
echo -e "${YELLOW}📦 Активация виртуального окружения...${NC}"
source venv/bin/activate

# Проверка зависимостей
if ! python3 -c "import flask" 2>/dev/null; then
    echo -e "${YELLOW}⚠️  Установка зависимостей...${NC}"
    pip install -r requirements.txt
fi

# Проверка и запуск Fine-tuned API сервера
FINETUNED_DIR="/home/kaznu2025/fine_tune_llm_2222"
if [ -d "$FINETUNED_DIR" ]; then
    echo ""
    echo -e "${YELLOW}🔧 Проверка Fine-tuned API сервера...${NC}"
    
    # Проверяем статус API сервера
    if curl -s http://localhost:8000/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Fine-tuned API сервер уже запущен${NC}"
    else
        echo -e "${YELLOW}📡 Запуск Fine-tuned API сервера...${NC}"
        cd "$FINETUNED_DIR"
        ./api_manager.sh start
        cd - > /dev/null
        
        # Ждем пока сервер запустится
        echo "⏳ Ожидание загрузки модели (это может занять несколько минут)..."
        for i in {1..60}; do
            if curl -s http://localhost:8000/health > /dev/null 2>&1; then
                echo -e "${GREEN}✅ Fine-tuned API сервер готов!${NC}"
                break
            fi
            if [ $i -eq 60 ]; then
                echo -e "${RED}⚠️  Fine-tuned API сервер не запустился за 5 минут${NC}"
                echo "   Продолжаем без fine-tuned модели..."
            else
                sleep 5
                echo -n "."
            fi
        done
        echo ""
    fi
else
    echo -e "${YELLOW}⚠️  Директория fine-tuned модели не найдена: $FINETUNED_DIR${NC}"
    echo "   Система будет работать без fine-tuned модели"
fi

# Запуск Flask приложения
echo ""
echo -e "${GREEN}🌐 Запуск Flask приложения...${NC}"
echo "============================================================"
echo ""
echo "Приложение будет доступно по адресам:"
echo "  - http://localhost:5003"
echo "  - http://localhost:5003/chat (RAG чат)"
echo "  - http://localhost:5003/chat-simple (Простой чат с fine-tuned моделью)"
echo "  - http://localhost:5003/admin (Админ панель)"
echo ""
echo "Для остановки нажмите Ctrl+C"
echo "============================================================"
echo ""

# Запуск Flask приложения
python app.py

