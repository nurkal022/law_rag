#!/bin/bash
# Скрипт для подготовки примеров документов для git
# Простая версия без сложных проверок

EXAMPLES_DIR="current/examples"
SOURCE_DIR="current"

echo "📚 Подготовка примеров документов для git..."

# Очищаем директорию примеров если она существует
if [ -d "$EXAMPLES_DIR" ]; then
    rm -rf "$EXAMPLES_DIR"/*
fi

# Создаем директорию для примеров
mkdir -p "$EXAMPLES_DIR"

echo "Копирование документов..."

# Копируем первые N файлов каждого типа
# Бюджетные документы
find "$SOURCE_DIR" -maxdepth 1 -name "*бюджет*.txt" -type f | head -3 | while IFS= read -r file; do
    if [ -f "$file" ]; then
        cp "$file" "$EXAMPLES_DIR/" 2>/dev/null && echo "  ✓ $(basename "$file")"
    fi
done

# Постановления
find "$SOURCE_DIR" -maxdepth 1 -name "*Постановление*.txt" -type f | head -3 | while IFS= read -r file; do
    if [ -f "$file" ]; then
        cp "$file" "$EXAMPLES_DIR/" 2>/dev/null && echo "  ✓ $(basename "$file")"
    fi
done

# Указы
find "$SOURCE_DIR" -maxdepth 1 -name "*Указ*.txt" -type f | head -2 | while IFS= read -r file; do
    if [ -f "$file" ]; then
        cp "$file" "$EXAMPLES_DIR/" 2>/dev/null && echo "  ✓ $(basename "$file")"
    fi
done

# Решения
find "$SOURCE_DIR" -maxdepth 1 -name "*Решение*.txt" -type f | head -3 | while IFS= read -r file; do
    if [ -f "$file" ]; then
        cp "$file" "$EXAMPLES_DIR/" 2>/dev/null && echo "  ✓ $(basename "$file")"
    fi
done

# Комментарии
find "$SOURCE_DIR" -maxdepth 1 -name "*Комментарий*.txt" -type f | head -2 | while IFS= read -r file; do
    if [ -f "$file" ]; then
        cp "$file" "$EXAMPLES_DIR/" 2>/dev/null && echo "  ✓ $(basename "$file")"
    fi
done

# Подсчитываем количество
total_count=$(find "$EXAMPLES_DIR" -name "*.txt" -type f 2>/dev/null | wc -l | tr -d ' ')

echo ""
echo "✅ Готово! Скопировано $total_count документов в $EXAMPLES_DIR"
echo ""
echo "📝 Следующие шаги:"
echo "1. Проверьте содержимое: ls -la $EXAMPLES_DIR"
echo "2. Добавьте в git: git add $EXAMPLES_DIR"
echo "3. Закоммитьте: git commit -m 'Add example documents for deployment'"
