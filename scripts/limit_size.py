#!/usr/bin/env python3
"""
Скрипт для ограничения размера документов в current/examples до 50 МБ
"""

import os
import random
from pathlib import Path

TARGET_DIR = Path("current/examples")
MAX_SIZE_MB = 50
MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024

def get_dir_size(directory):
    """Получить общий размер всех .txt файлов в директории"""
    total = 0
    for file in directory.glob("*.txt"):
        total += file.stat().st_size
    return total

def main():
    print(f"📚 Ограничение размера документов до {MAX_SIZE_MB} МБ...")
    
    # Получаем список всех .txt файлов с их размерами
    all_files = [(f, f.stat().st_size) for f in TARGET_DIR.glob("*.txt")]
    all_files.sort(key=lambda x: x[1], reverse=True)  # Сортируем по размеру (большие первыми)
    
    current_size = sum(size for _, size in all_files)
    current_size_mb = current_size / (1024 * 1024)
    
    print(f"Текущий размер: {current_size_mb:.2f} МБ ({len(all_files)} файлов)")
    
    if current_size <= MAX_SIZE_BYTES:
        print(f"✅ Размер уже в пределах лимита ({current_size_mb:.2f} МБ <= {MAX_SIZE_MB} МБ)")
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
    
    for file, size in all_files:
        filename_lower = file.name.lower()
        categorized = False
        for doc_type in files_by_type.keys():
            if doc_type != 'другое' and doc_type in filename_lower:
                files_by_type[doc_type].append((file, size))
                categorized = True
                break
        if not categorized:
            files_by_type['другое'].append((file, size))
    
    # Собираем файлы для сохранения
    files_to_keep = []
    current_kept_size = 0
    
    # Сначала добавляем небольшие файлы из каждой категории
    for doc_type, files in files_by_type.items():
        if not files:
            continue
        
        # Сортируем по размеру (маленькие первыми)
        files_sorted = sorted(files, key=lambda x: x[1])
        
        # Берем небольшие файлы из каждой категории
        for file, size in files_sorted:
            if current_kept_size + size <= MAX_SIZE_BYTES:
                files_to_keep.append((file, size))
                current_kept_size += size
            else:
                break
    
    # Если еще есть место, добавляем случайные файлы из оставшихся
    remaining_files = []
    files_to_keep_set = {f[0] for f in files_to_keep}
    for files in files_by_type.values():
        for file, size in files:
            if file not in files_to_keep_set:
                remaining_files.append((file, size))
    
    random.shuffle(remaining_files)
    for file, size in remaining_files:
        if current_kept_size + size <= MAX_SIZE_BYTES:
            files_to_keep.append((file, size))
            current_kept_size += size
    
    # Определяем файлы для удаления
    files_to_keep_set = {f[0] for f in files_to_keep}
    files_to_remove = [f for f, _ in all_files if f not in files_to_keep_set]
    
    print(f"\n📊 Планируется:")
    print(f"   Сохранить: {len(files_to_keep)} файлов ({current_kept_size / 1024 / 1024:.2f} МБ)")
    print(f"   Удалить: {len(files_to_remove)} файлов")
    
    if not files_to_remove:
        print("✅ Нечего удалять")
        return
    
    # Удаляем файлы
    print(f"\n🗑️  Удаление {len(files_to_remove)} документов...")
    
    removed = 0
    removed_size = 0
    for file in files_to_remove:
        try:
            size = file.stat().st_size
            file.unlink()
            removed += 1
            removed_size += size
            if removed % 20 == 0:
                print(f"  Удалено {removed}/{len(files_to_remove)}...")
        except Exception as e:
            print(f"  ✗ Ошибка удаления {file.name}: {e}")
    
    # Подсчитываем результат
    remaining = len(list(TARGET_DIR.glob("*.txt")))
    final_size = get_dir_size(TARGET_DIR)
    final_size_mb = final_size / (1024 * 1024)
    
    print(f"\n✅ Готово!")
    print(f"   Удалено: {removed} документов ({removed_size / 1024 / 1024:.2f} МБ)")
    print(f"   Осталось: {remaining} документов")
    print(f"   Финальный размер: {final_size_mb:.2f} МБ")
    
    if final_size_mb > MAX_SIZE_MB:
        print(f"\n⚠️  ВНИМАНИЕ: Размер все еще превышает лимит!")
        print(f"   Требуется дополнительное удаление файлов")
    else:
        print(f"\n📝 Обновите git:")
        print(f"   git add current/examples/")
        print(f"   git commit -m 'Limit documents size to {final_size_mb:.1f} MB ({remaining} files)'")

if __name__ == "__main__":
    main()

