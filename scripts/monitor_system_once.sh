#!/bin/bash
# Скрипт для однократного вывода статуса системы (без цикла)

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Функция для проверки доступности порта
check_port() {
    local port=$1
    if timeout 1 bash -c "echo > /dev/tcp/localhost/$port" 2>/dev/null; then
        return 0
    else
        return 1
    fi
}

echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║          Law RAG System Status                              ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Flask приложение
echo -e "${BLUE}🌐 Flask приложение:${NC}"
if check_port 5003; then
    echo -e "  ${GREEN}✓${NC} Работает (http://localhost:5003)"
else
    echo -e "  ${RED}✗${NC} Не запущено"
fi

# Fine-tuned API
echo -e "${BLUE}🤖 Fine-tuned API:${NC}"
if check_port 8000; then
    health=$(curl -s http://localhost:8000/health 2>/dev/null)
    if [ -n "$health" ]; then
        model_loaded=$(echo $health | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('model_loaded', False))" 2>/dev/null)
        if [ "$model_loaded" = "True" ]; then
            echo -e "  ${GREEN}✓${NC} Работает (модель загружена)"
        else
            echo -e "  ${YELLOW}⚠${NC}  Работает (модель загружается...)"
        fi
    else
        echo -e "  ${YELLOW}⚠${NC}  Работает (health недоступен)"
    fi
else
    echo -e "  ${RED}✗${NC} Не запущено"
fi

# Ollama
echo -e "${BLUE}🦙 Ollama:${NC}"
if check_port 11434; then
    echo -e "  ${GREEN}✓${NC} Работает (http://localhost:11434)"
else
    echo -e "  ${RED}✗${NC} Не запущена"
fi

# База данных
echo -e "${BLUE}💾 База данных:${NC}"
if [ -f "database/law_database.db" ]; then
    db_size=$(stat -f%z "database/law_database.db" 2>/dev/null || stat -c%s "database/law_database.db" 2>/dev/null)
    if [ -n "$db_size" ]; then
        db_size_mb=$((db_size / 1024 / 1024))
        echo -e "  ${GREEN}✓${NC} Существует (${db_size_mb}MB)"
    else
        echo -e "  ${GREEN}✓${NC} Существует"
    fi
else
    echo -e "  ${RED}✗${NC} Не найдена"
fi

# GPU
if command -v nvidia-smi > /dev/null 2>&1; then
    echo -e "${BLUE}🎮 GPU:${NC}"
    gpu_info=$(nvidia-smi --query-gpu=name,utilization.gpu,memory.used,memory.total --format=csv,noheader,nounits 2>/dev/null | head -1)
    if [ -n "$gpu_info" ]; then
        gpu_name=$(echo $gpu_info | cut -d',' -f1 | xargs)
        gpu_util=$(echo $gpu_info | cut -d',' -f2 | xargs)
        gpu_mem_used=$(echo $gpu_info | cut -d',' -f3 | xargs)
        gpu_mem_total=$(echo $gpu_info | cut -d',' -f4 | xargs)
        echo -e "  ${GREEN}✓${NC} $gpu_name (${gpu_util}% использования, ${gpu_mem_used}MB/${gpu_mem_total}MB)"
    fi
fi

echo ""

