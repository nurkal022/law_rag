#!/usr/bin/env python3
"""
Скрипт для подготовки примеров документов для git
Более надежная версия на Python
"""

import os
import shutil
from pathlib import Path

EXAMPLES_DIR = Path("current/examples")
SOURCE_DIR = Path("current")

def main():
    print("📚 Подготовка примеров документов для git...")
    
    # Создаем директорию для примеров
    EXAMPLES_DIR.mkdir(parents=True, exist_ok=True)
    
    # Очищаем директорию если она не пустая
    if any(EXAMPLES_DIR.iterdir()):
        print("Очистка директории примеров...")
        for file in EXAMPLES_DIR.glob("*.txt"):
            file.unlink()
    
    # Ключевые слова для поиска разных типов документов
    keywords = {
        "бюджет": 3,
        "постановление": 3,
        "указ": 2,
        "решение": 3,
        "комментарий": 2
    }
    
    copied = []
    
    # Ищем и копируем документы
    for keyword, count in keywords.items():
        found = 0
        for file in SOURCE_DIR.glob("*.txt"):
            if keyword.lower() in file.name.lower() and file.name not in copied:
                try:
                    shutil.copy2(file, EXAMPLES_DIR / file.name)
                    copied.append(file.name)
                    print(f"  ✓ {file.name[:70]}...")
                    found += 1
                    if found >= count:
                        break
                except Exception as e:
                    print(f"  ✗ Ошибка копирования {file.name}: {e}")
    
    # Подсчитываем результат
    total = len(list(EXAMPLES_DIR.glob("*.txt")))
    
    print(f"\n✅ Готово! Скопировано {total} документов в {EXAMPLES_DIR}")
    print(f"\n📝 Следующие шаги:")
    print(f"1. Проверьте содержимое: ls -la {EXAMPLES_DIR}")
    print(f"2. Добавьте в git: git add {EXAMPLES_DIR}")
    print(f"3. Закоммитьте: git commit -m 'Add example documents for deployment'")

if __name__ == "__main__":
    main()

