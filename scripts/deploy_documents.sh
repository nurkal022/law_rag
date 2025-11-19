#!/bin/bash
# Скрипт для развертывания документов на сервере

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🚀 Развертывание документов на сервере"
echo "========================================"

# Создаем директорию current если её нет
CURRENT_DIR="$PROJECT_DIR/current"
EXAMPLES_DIR="$CURRENT_DIR/examples"

if [ ! -d "$CURRENT_DIR" ]; then
    echo "📁 Создаем директорию current..."
    mkdir -p "$CURRENT_DIR"
fi

if [ ! -d "$EXAMPLES_DIR" ]; then
    echo "📁 Создаем директорию current/examples..."
    mkdir -p "$EXAMPLES_DIR"
fi

# Проверяем наличие примеров документов
if [ -d "$EXAMPLES_DIR" ] && [ "$(ls -A $EXAMPLES_DIR/*.txt 2>/dev/null | wc -l)" -gt 0 ]; then
    echo "✅ Найдены примеры документов в $EXAMPLES_DIR"
    COUNT=$(ls -1 "$EXAMPLES_DIR"/*.txt 2>/dev/null | wc -l)
    echo "   Количество файлов: $COUNT"
    
    # Копируем примеры в основную директорию
    echo "📄 Копируем документы из examples в current..."
    cp "$EXAMPLES_DIR"/*.txt "$CURRENT_DIR/" 2>/dev/null || true
    
    COPIED=$(ls -1 "$CURRENT_DIR"/*.txt 2>/dev/null | wc -l)
    echo "✅ Скопировано $COPIED документов в $CURRENT_DIR"
else
    echo "⚠️  Примеры документов не найдены в $EXAMPLES_DIR"
    echo "   Создайте файлы .txt в директории current/examples/"
fi

# Проверяем итоговое количество документов
FINAL_COUNT=$(ls -1 "$CURRENT_DIR"/*.txt 2>/dev/null | wc -l)
echo ""
echo "📊 Итоговая статистика:"
echo "   Документов в current/: $FINAL_COUNT"

if [ "$FINAL_COUNT" -eq 0 ]; then
    echo ""
    echo "⚠️  ВНИМАНИЕ: Нет документов для обработки!"
    echo "   Добавьте файлы .txt в директорию: $CURRENT_DIR"
    echo "   Или скопируйте из examples: cp current/examples/*.txt current/"
else
    echo "✅ Готово к обработке через админ-панель"
fi

