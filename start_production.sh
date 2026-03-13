#!/bin/bash
# Запуск LawVision в production режиме с Cloudflare Tunnel

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

echo "========================================"
echo " LawVision Production Start"
echo " URL: https://lawvision.kz"
echo "========================================"

# Активируем venv
source venv/bin/activate

# Offline mode (локальные модели)
export HF_HUB_OFFLINE=1
export TRANSFORMERS_OFFLINE=1
export TOKENIZERS_PARALLELISM=false

# Запускаем Flask в фоне
echo ">> Запуск Flask приложения на порту 5003..."
venv/bin/python3 app.py &
APP_PID=$!
echo "   Flask PID: $APP_PID"

# Ждём пока Flask поднимется
sleep 3

# Запускаем Cloudflare Tunnel
echo ">> Запуск Cloudflare Tunnel -> lawvision.kz..."
cloudflared tunnel run lawvision &
TUNNEL_PID=$!
echo "   Tunnel PID: $TUNNEL_PID"

echo ""
echo "========================================"
echo " Приложение доступно на https://lawvision.kz"
echo " Для остановки: Ctrl+C"
echo "========================================"

# Ждём завершения (Ctrl+C завершит оба процесса)
trap "echo 'Остановка...'; kill $APP_PID $TUNNEL_PID 2>/dev/null; exit 0" INT TERM
wait
