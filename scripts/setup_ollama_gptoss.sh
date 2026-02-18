#!/bin/bash
# Скрипт для настройки Ollama с моделью gpt-oss:20b

echo "🚀 Настройка Ollama с моделью gpt-oss:20b"
echo "=========================================="

# Проверяем, запущена ли Ollama
if ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "⚠️  Ollama не запущена!"
    echo "Запустите Ollama:"
    echo "  ollama serve"
    echo ""
    exit 1
fi

echo "✅ Ollama запущена"

# Проверяем наличие модели
if ollama list | grep -q "gpt-oss:20b"; then
    echo "✅ Модель gpt-oss:20b найдена"
else
    echo "📥 Модель gpt-oss:20b не найдена, скачиваем..."
    ollama pull gpt-oss:20b
fi

# Тестируем модель
echo ""
echo "🧪 Тестируем модель..."
TEST_RESPONSE=$(curl -s http://localhost:11434/api/generate -d '{"model": "gpt-oss:20b", "prompt": "Привет", "stream": false}' | python3 -c "import sys, json; print(json.load(sys.stdin).get('response', '')[:50])" 2>/dev/null)

if [ -n "$TEST_RESPONSE" ]; then
    echo "✅ Модель работает! Ответ: $TEST_RESPONSE"
else
    echo "❌ Ошибка при тестировании модели"
    exit 1
fi

# Создаем или обновляем .env файл
ENV_FILE=".env"
if [ ! -f "$ENV_FILE" ]; then
    echo "📝 Создаем .env файл..."
    touch "$ENV_FILE"
fi

# Обновляем настройки
echo ""
echo "⚙️  Настраиваем переменные окружения..."

# Проверяем и обновляем LLM_PROVIDER_TYPE
if grep -q "LLM_PROVIDER_TYPE" "$ENV_FILE"; then
    sed -i 's/^LLM_PROVIDER_TYPE=.*/LLM_PROVIDER_TYPE=ollama/' "$ENV_FILE"
else
    echo "LLM_PROVIDER_TYPE=ollama" >> "$ENV_FILE"
fi

# Проверяем и обновляем LLM_MODEL
if grep -q "LLM_MODEL" "$ENV_FILE"; then
    sed -i 's/^LLM_MODEL=.*/LLM_MODEL=gpt-oss:20b/' "$ENV_FILE"
else
    echo "LLM_MODEL=gpt-oss:20b" >> "$ENV_FILE"
fi

# Проверяем и обновляем OLLAMA_BASE_URL
if grep -q "OLLAMA_BASE_URL" "$ENV_FILE"; then
    sed -i 's|^OLLAMA_BASE_URL=.*|OLLAMA_BASE_URL=http://localhost:11434|' "$ENV_FILE"
else
    echo "OLLAMA_BASE_URL=http://localhost:11434" >> "$ENV_FILE"
fi

echo "✅ Настройки сохранены в .env"
echo ""
echo "📋 Текущие настройки:"
grep -E "LLM_PROVIDER_TYPE|LLM_MODEL|OLLAMA_BASE_URL" "$ENV_FILE" || echo "  (используются значения по умолчанию)"
echo ""
echo "✅ Готово! Перезапустите приложение для применения изменений:"
echo "  python app.py"
echo ""
echo "💡 Или настройте через веб-интерфейс:"
echo "  http://localhost:5003/admin → Настройки моделей LLM"

