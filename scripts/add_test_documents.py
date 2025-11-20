#!/usr/bin/env python3
"""
Скрипт для добавления ~1000 тестовых документов из базы данных в git
"""

import os
import shutil
from pathlib import Path
import random

SOURCE_DIR = Path("current")
TARGET_DIR = Path("current/examples")
TARGET_COUNT = 100  # Оптимальное количество для быстрой загрузки

def main():
    print(f"📚 Добавление ~{TARGET_COUNT} тестовых документов в git...")
    
    # Создаем директорию для примеров
    TARGET_DIR.mkdir(parents=True, exist_ok=True)
    
    # Получаем список всех .txt файлов
    all_files = list(SOURCE_DIR.glob("*.txt"))
    
    # Исключаем файлы, которые уже в examples
    existing_files = {f.name for f in TARGET_DIR.glob("*.txt")}
    available_files = [f for f in all_files if f.name not in existing_files]
    
    print(f"Найдено {len(all_files)} документов в базе")
    print(f"Уже в examples: {len(existing_files)}")
    print(f"Доступно для копирования: {len(available_files)}")
    
    if len(available_files) == 0:
        print("❌ Нет доступных документов для копирования")
        return
    
    # Выбираем случайные файлы (или все если их меньше целевого количества)
    if len(available_files) <= TARGET_COUNT:
        files_to_copy = available_files
        print(f"Доступно меньше {TARGET_COUNT} файлов, копируем все доступные")
    else:
        # Выбираем разнообразные документы
        files_to_copy = []
        
        # Сначала берем разные типы документов
        keywords_groups = {
            'бюджет': 150,
            'постановление': 150,
            'указ': 100,
            'решение': 200,
            'комментарий': 100,
            'закон': 50,
            'приказ': 50,
            'распоряжение': 50,
            'положение': 50,
            'инструкция': 50
        }
        
        remaining_files = available_files.copy()
        random.shuffle(remaining_files)
        
        # Распределяем по категориям (оптимальное распределение для 100 документов)
        keywords_groups_reduced = {
            'бюджет': 15,
            'постановление': 15,
            'указ': 10,
            'решение': 20,
            'комментарий': 10,
            'закон': 5,
            'приказ': 5,
            'распоряжение': 5,
            'положение': 5,
            'инструкция': 5
        }
        
        for keyword, count in keywords_groups_reduced.items():
            found = 0
            for file in remaining_files:
                if keyword.lower() in file.name.lower() and file not in files_to_copy:
                    files_to_copy.append(file)
                    found += 1
                    if found >= count:
                        break
        
        # Добираем до нужного количества случайными файлами
        remaining = [f for f in remaining_files if f not in files_to_copy]
        random.shuffle(remaining)
        needed = TARGET_COUNT - len(files_to_copy)
        files_to_copy.extend(remaining[:needed])
        
        print(f"Выбрано {len(files_to_copy)} документов разных типов")
    
    # Копируем файлы
    copied = 0
    failed = 0
    
    print("\nКопирование документов...")
    for i, file in enumerate(files_to_copy, 1):
        try:
            shutil.copy2(file, TARGET_DIR / file.name)
            copied += 1
            if i % 100 == 0:
                print(f"  Скопировано {i}/{len(files_to_copy)}...")
        except Exception as e:
            print(f"  ✗ Ошибка копирования {file.name}: {e}")
            failed += 1
    
    # Подсчитываем результат
    total = len(list(TARGET_DIR.glob("*.txt")))
    total_size = sum(f.stat().st_size for f in TARGET_DIR.glob("*.txt"))
    total_size_mb = total_size / (1024 * 1024)
    
    print(f"\n✅ Готово!")
    print(f"   Скопировано: {copied} документов")
    print(f"   Ошибок: {failed}")
    print(f"   Всего в examples: {total} документов")
    print(f"   Размер: {total_size_mb:.2f} MB")
    print(f"\n📝 Следующие шаги:")
    print(f"1. Проверьте: ls -la {TARGET_DIR} | head -20")
    print(f"2. Добавьте в git: git add {TARGET_DIR}")
    print(f"3. Закоммитьте: git commit -m 'Add ~{copied} test documents for deployment'")

if __name__ == "__main__":
    main()

