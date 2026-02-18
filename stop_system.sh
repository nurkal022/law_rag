#!/bin/bash
# Скрипт для остановки всей системы Law RAG

set -e

echo "🛑 Остановка системы Law RAG"
echo "============================================================"

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Остановка Flask приложения
echo -e "${YELLOW}🌐 Остановка Flask приложения...${NC}"
pkill -f "python.*app.py" || echo "Flask приложение не запущено"

# Остановка Fine-tuned API сервера
FINETUNED_DIR="/home/kaznu2025/fine_tune_llm_2222"
if [ -d "$FINETUNED_DIR" ]; then
    echo -e "${YELLOW}📡 Остановка Fine-tuned API сервера...${NC}"
    cd "$FINETUNED_DIR"
    ./api_manager.sh stop 2>/dev/null || echo "Fine-tuned API сервер не запущен"
    cd - > /dev/null
fi

echo -e "${GREEN}✅ Система остановлена${NC}"

