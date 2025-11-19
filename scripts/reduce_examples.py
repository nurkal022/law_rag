#!/usr/bin/env python3
"""
Скрипт для уменьшения количества примеров документов в 3 раза
"""

import os
import random
from pathlib import Path

TARGET_DIR = Path("current/examples")
TARGET_COUNT = 336  # ~1008 / 3

def main():
    print(f"📚 Уменьшение количества документов до ~{TARGET_COUNT}...")
    
    # Получаем список всех .txt файлов
    all_files = list(TARGET_DIR.glob("*.txt"))
    
    print(f"Текущее количество документов: {len(all_files)}")
    
    if len(all_files) <= TARGET_COUNT:
        print(f"✅ Уже достаточно документов ({len(all_files)} <= {TARGET_COUNT})")
        return
    
    # Группируем файлы по типам для сохранения разнообразия
    files_by_type = {
        'бюджет': [],
        'постановление': [],
        'указ': [],
        'решение': [],
        'комментарий': [],
        'закон': [],
        'приказ': [],
        'распоряжение': [],
        'положение': [],
        'инструкция': [],
        'другое': []
    }
    
    for file in all_files:
        filename_lower = file.name.lower()
        categorized = False
        for doc_type in files_by_type.keys():
            if doc_type != 'другое' and doc_type in filename_lower:
                files_by_type[doc_type].append(file)
                categorized = True
                break
        if not categorized:
            files_by_type['другое'].append(file)
    
    # Определяем сколько файлов оставить из каждой категории
    files_to_keep = []
    
    # Распределяем пропорционально, но минимум по несколько из каждой категории
    total_to_remove = len(all_files) - TARGET_COUNT
    
    for doc_type, files in files_by_type.items():
        if not files:
            continue
        
        # Оставляем пропорционально, но не меньше 10% от категории
        keep_count = max(
            int(len(files) * 0.33),  # Примерно треть от каждой категории
            min(5, len(files))  # Но минимум 5 или все если меньше
        )
        
        # Случайно выбираем файлы для сохранения
        random.shuffle(files)
        files_to_keep.extend(files[:keep_count])
        print(f"  {doc_type}: оставляем {keep_count} из {len(files)}")
    
    # Если все еще слишком много, случайно удаляем еще
    if len(files_to_keep) > TARGET_COUNT:
        random.shuffle(files_to_keep)
        files_to_keep = files_to_keep[:TARGET_COUNT]
    
    # Определяем файлы для удаления
    files_to_keep_set = set(files_to_keep)
    files_to_remove = [f for f in all_files if f not in files_to_keep_set]
    
    print(f"\nУдаление {len(files_to_remove)} документов...")
    
    removed = 0
    for file in files_to_remove:
        try:
            file.unlink()
            removed += 1
            if removed % 50 == 0:
                print(f"  Удалено {removed}/{len(files_to_remove)}...")
        except Exception as e:
            print(f"  ✗ Ошибка удаления {file.name}: {e}")
    
    # Подсчитываем результат
    remaining = len(list(TARGET_DIR.glob("*.txt")))
    total_size = sum(f.stat().st_size for f in TARGET_DIR.glob("*.txt"))
    total_size_mb = total_size / (1024 * 1024)
    
    print(f"\n✅ Готово!")
    print(f"   Удалено: {removed} документов")
    print(f"   Осталось: {remaining} документов")
    print(f"   Размер: {total_size_mb:.2f} MB")
    print(f"\n📝 Обновите git:")
    print(f"   git add current/examples/")
    print(f"   git commit -m 'Reduce test documents to ~{remaining} files'")

if __name__ == "__main__":
    main()

