#!/bin/bash
# Скрипт для мониторинга всей системы Law RAG

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

# Функция для получения статуса процесса
get_process_status() {
    local process_name=$1
    local pid=$(pgrep -f "$process_name" | head -1)
    if [ -n "$pid" ]; then
        local cpu=$(ps -p $pid -o %cpu --no-headers 2>/dev/null | tr -d ' ')
        local mem=$(ps -p $pid -o %mem --no-headers 2>/dev/null | tr -d ' ')
        local runtime=$(ps -p $pid -o etime --no-headers 2>/dev/null | tr -d ' ')
        echo "$pid|$cpu|$mem|$runtime"
    else
        echo ""
    fi
}

# Функция для форматирования размера
format_size() {
    local size=$1
    if [ $size -lt 1024 ]; then
        echo "${size}B"
    elif [ $size -lt 1048576 ]; then
        echo "$(echo "scale=1; $size/1024" | bc)KB"
    else
        echo "$(echo "scale=1; $size/1048576" | bc)MB"
    fi
}

clear
echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║          Law RAG System Monitor                            ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# ============================================================================
# 1. Flask приложение
# ============================================================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🌐 Flask приложение (Law RAG)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if check_port 5003; then
    echo -e "  ${GREEN}✓${NC} Порт 5003: ${GREEN}открыт${NC}"
    
    # Проверка API
    if curl -s http://localhost:5003/api/admin/stats > /dev/null 2>&1; then
        echo -e "  ${GREEN}✓${NC} API: ${GREEN}доступен${NC}"
        
        # Получаем статистику
        stats=$(curl -s http://localhost:5003/api/admin/stats 2>/dev/null)
        if [ -n "$stats" ]; then
            docs=$(echo $stats | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('documents_count', 0))" 2>/dev/null)
            chunks=$(echo $stats | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('chunks_count', 0))" 2>/dev/null)
            embeddings=$(echo $stats | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('embedding_progress', 0))" 2>/dev/null)
            
            echo -e "  📊 Документы: ${CYAN}$docs${NC}"
            echo -e "  📊 Чанки: ${CYAN}$chunks${NC}"
            echo -e "  📊 Embeddings: ${CYAN}${embeddings}%${NC}"
        fi
    else
        echo -e "  ${YELLOW}⚠${NC}  API: ${YELLOW}не отвечает${NC}"
    fi
    
    # Статус процесса
    proc_info=$(get_process_status "python.*app.py")
    if [ -n "$proc_info" ]; then
        IFS='|' read -r pid cpu mem runtime <<< "$proc_info"
        echo -e "  🔹 PID: ${CYAN}$pid${NC}"
        echo -e "  🔹 CPU: ${CYAN}${cpu}%${NC}"
        echo -e "  🔹 Память: ${CYAN}${mem}%${NC}"
        echo -e "  🔹 Время работы: ${CYAN}$runtime${NC}"
    fi
else
    echo -e "  ${RED}✗${NC} Порт 5003: ${RED}закрыт${NC}"
    echo -e "  ${YELLOW}→${NC} Flask приложение не запущено"
fi

echo ""

# ============================================================================
# 2. Fine-tuned API сервер
# ============================================================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🤖 Fine-tuned API сервер${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if check_port 8000; then
    echo -e "  ${GREEN}✓${NC} Порт 8000: ${GREEN}открыт${NC}"
    
    # Проверка health endpoint
    health=$(curl -s http://localhost:8000/health 2>/dev/null)
    if [ -n "$health" ]; then
        model_loaded=$(echo $health | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('model_loaded', False))" 2>/dev/null)
        cuda_available=$(echo $health | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('cuda_available', False))" 2>/dev/null)
        device=$(echo $health | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('device', 'N/A'))" 2>/dev/null)
        
        if [ "$model_loaded" = "True" ]; then
            echo -e "  ${GREEN}✓${NC} Модель: ${GREEN}загружена${NC}"
        else
            echo -e "  ${YELLOW}⚠${NC}  Модель: ${YELLOW}загружается...${NC}"
        fi
        
        if [ "$cuda_available" = "True" ]; then
            echo -e "  ${GREEN}✓${NC} CUDA: ${GREEN}доступна${NC}"
            echo -e "  🔹 Устройство: ${CYAN}$device${NC}"
        else
            echo -e "  ${YELLOW}⚠${NC}  CUDA: ${YELLOW}недоступна${NC}"
        fi
    else
        echo -e "  ${YELLOW}⚠${NC}  Health endpoint: ${YELLOW}не отвечает${NC}"
    fi
    
    # Статус процесса
    proc_info=$(get_process_status "api_server.py")
    if [ -n "$proc_info" ]; then
        IFS='|' read -r pid cpu mem runtime <<< "$proc_info"
        echo -e "  🔹 PID: ${CYAN}$pid${NC}"
        echo -e "  🔹 CPU: ${CYAN}${cpu}%${NC}"
        echo -e "  🔹 Память: ${CYAN}${mem}%${NC}"
        echo -e "  🔹 Время работы: ${CYAN}$runtime${NC}"
    fi
else
    echo -e "  ${RED}✗${NC} Порт 8000: ${RED}закрыт${NC}"
    echo -e "  ${YELLOW}→${NC} Fine-tuned API сервер не запущен"
fi

echo ""

# ============================================================================
# 3. Ollama (если используется)
# ============================================================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🦙 Ollama${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if check_port 11434; then
    echo -e "  ${GREEN}✓${NC} Порт 11434: ${GREEN}открыт${NC}"
    
    # Проверка API
    ollama_tags=$(curl -s http://localhost:11434/api/tags 2>/dev/null)
    if [ -n "$ollama_tags" ]; then
        echo -e "  ${GREEN}✓${NC} API: ${GREEN}доступен${NC}"
        
        # Получаем список моделей
        models=$(echo $ollama_tags | python3 -c "import sys, json; d=json.load(sys.stdin); print(', '.join([m.get('name', '') for m in d.get('models', [])]))" 2>/dev/null)
        if [ -n "$models" ]; then
            echo -e "  🔹 Модели: ${CYAN}$models${NC}"
        fi
    else
        echo -e "  ${YELLOW}⚠${NC}  API: ${YELLOW}не отвечает${NC}"
    fi
    
    # Статус процесса
    proc_info=$(get_process_status "ollama")
    if [ -n "$proc_info" ]; then
        IFS='|' read -r pid cpu mem runtime <<< "$proc_info"
        echo -e "  🔹 PID: ${CYAN}$pid${NC}"
        echo -e "  🔹 CPU: ${CYAN}${cpu}%${NC}"
        echo -e "  🔹 Память: ${CYAN}${mem}%${NC}"
        echo -e "  🔹 Время работы: ${CYAN}$runtime${NC}"
    fi
else
    echo -e "  ${RED}✗${NC} Порт 11434: ${RED}закрыт${NC}"
    echo -e "  ${YELLOW}→${NC} Ollama не запущена"
fi

echo ""

# ============================================================================
# 4. База данных
# ============================================================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}💾 База данных${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

db_path="database/law_database.db"
if [ -f "$db_path" ]; then
    echo -e "  ${GREEN}✓${NC} Файл БД: ${GREEN}существует${NC}"
    
    # Размер базы данных
    db_size=$(stat -f%z "$db_path" 2>/dev/null || stat -c%s "$db_path" 2>/dev/null)
    if [ -n "$db_size" ]; then
        echo -e "  🔹 Размер: ${CYAN}$(format_size $db_size)${NC}"
    fi
    
    # Проверка доступности через SQLite
    if command -v sqlite3 > /dev/null 2>&1; then
        doc_count=$(sqlite3 "$db_path" "SELECT COUNT(*) FROM documents;" 2>/dev/null)
        chunk_count=$(sqlite3 "$db_path" "SELECT COUNT(*) FROM document_chunks;" 2>/dev/null)
        
        if [ -n "$doc_count" ]; then
            echo -e "  🔹 Документов: ${CYAN}$doc_count${NC}"
        fi
        if [ -n "$chunk_count" ]; then
            echo -e "  🔹 Чанков: ${CYAN}$chunk_count${NC}"
        fi
    fi
else
    echo -e "  ${RED}✗${NC} Файл БД: ${RED}не найден${NC}"
fi

echo ""

# ============================================================================
# 5. Системные ресурсы
# ============================================================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}💻 Системные ресурсы${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# CPU
if command -v top > /dev/null 2>&1; then
    cpu_usage=$(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1}')
    echo -e "  🔹 CPU: ${CYAN}${cpu_usage}%${NC}"
fi

# Память
if [ -f /proc/meminfo ]; then
    mem_total=$(grep MemTotal /proc/meminfo | awk '{print $2}')
    mem_available=$(grep MemAvailable /proc/meminfo | awk '{print $2}')
    if [ -n "$mem_total" ] && [ -n "$mem_available" ]; then
        mem_used=$((mem_total - mem_available))
        mem_percent=$((mem_used * 100 / mem_total))
        mem_total_gb=$((mem_total / 1024 / 1024))
        mem_used_gb=$((mem_used / 1024 / 1024))
        echo -e "  🔹 Память: ${CYAN}${mem_used_gb}GB / ${mem_total_gb}GB (${mem_percent}%)${NC}"
    fi
fi

# Диск
if command -v df > /dev/null 2>&1; then
    disk_usage=$(df -h . | tail -1 | awk '{print $5}')
    disk_available=$(df -h . | tail -1 | awk '{print $4}')
    echo -e "  🔹 Диск: ${CYAN}использовано ${disk_usage}, свободно ${disk_available}${NC}"
fi

echo ""

# ============================================================================
# 6. GPU (если доступна)
# ============================================================================
if command -v nvidia-smi > /dev/null 2>&1; then
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}🎮 GPU${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    gpu_info=$(nvidia-smi --query-gpu=name,utilization.gpu,memory.used,memory.total --format=csv,noheader,nounits 2>/dev/null | head -1)
    if [ -n "$gpu_info" ]; then
        gpu_name=$(echo $gpu_info | cut -d',' -f1 | xargs)
        gpu_util=$(echo $gpu_info | cut -d',' -f2 | xargs)
        gpu_mem_used=$(echo $gpu_info | cut -d',' -f3 | xargs)
        gpu_mem_total=$(echo $gpu_info | cut -d',' -f4 | xargs)
        
        echo -e "  ${GREEN}✓${NC} GPU: ${CYAN}$gpu_name${NC}"
        echo -e "  🔹 Использование: ${CYAN}${gpu_util}%${NC}"
        echo -e "  🔹 Память: ${CYAN}${gpu_mem_used}MB / ${gpu_mem_total}MB${NC}"
    else
        echo -e "  ${YELLOW}⚠${NC}  GPU: ${YELLOW}информация недоступна${NC}"
    fi
    echo ""
fi

# ============================================================================
# Итоговый статус
# ============================================================================
echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                    Итоговый статус                          ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"

flask_ok=false
finetuned_ok=false
db_ok=false

if check_port 5003; then
    flask_ok=true
fi

if check_port 8000; then
    finetuned_ok=true
fi

if [ -f "$db_path" ]; then
    db_ok=true
fi

echo ""
if [ "$flask_ok" = true ] && [ "$db_ok" = true ]; then
    echo -e "  ${GREEN}✓${NC} Основная система: ${GREEN}работает${NC}"
else
    echo -e "  ${RED}✗${NC} Основная система: ${RED}не работает${NC}"
fi

if [ "$finetuned_ok" = true ]; then
    echo -e "  ${GREEN}✓${NC} Fine-tuned модель: ${GREEN}доступна${NC}"
else
    echo -e "  ${YELLOW}⚠${NC}  Fine-tuned модель: ${YELLOW}недоступна${NC}"
fi

echo ""
echo -e "${CYAN}Обновление каждые 5 секунд... (Ctrl+C для выхода)${NC}"
echo ""

