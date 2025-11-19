#!/usr/bin/env python3
"""
Скрипт для развертывания документов на сервере
Копирует документы из current/examples в current/ для обработки
"""

import os
import shutil
from pathlib import Path

PROJECT_DIR = Path(__file__).parent.parent
CURRENT_DIR = PROJECT_DIR / "current"
EXAMPLES_DIR = CURRENT_DIR / "examples"

def main():
    print("🚀 Развертывание документов на сервере")
    print("=" * 50)
    
    # Создаем директории если их нет
    CURRENT_DIR.mkdir(exist_ok=True)
    EXAMPLES_DIR.mkdir(exist_ok=True)
    
    print(f"📁 Директория current: {CURRENT_DIR}")
    print(f"📁 Директория examples: {EXAMPLES_DIR}")
    
    # Проверяем наличие примеров
    example_files = list(EXAMPLES_DIR.glob("*.txt"))
    
    if not example_files:
        print(f"\n⚠️  Примеры документов не найдены в {EXAMPLES_DIR}")
        print("   Убедитесь, что файлы скопированы из git репозитория")
        return
    
    print(f"\n📚 Найдено {len(example_files)} примеров документов")
    
    # Копируем примеры в основную директорию
    copied = 0
    skipped = 0
    
    for file in example_files:
        dest = CURRENT_DIR / file.name
        if dest.exists():
            skipped += 1
            continue
        
        try:
            shutil.copy2(file, dest)
            copied += 1
            if copied % 20 == 0:
                print(f"  Скопировано {copied}/{len(example_files)}...")
        except Exception as e:
            print(f"  ✗ Ошибка копирования {file.name}: {e}")
    
    # Проверяем итоговое количество
    final_count = len(list(CURRENT_DIR.glob("*.txt")))
    total_size = sum(f.stat().st_size for f in CURRENT_DIR.glob("*.txt"))
    total_size_mb = total_size / (1024 * 1024)
    
    print(f"\n✅ Готово!")
    print(f"   Скопировано: {copied} документов")
    print(f"   Пропущено (уже есть): {skipped}")
    print(f"   Всего в current/: {final_count} документов")
    print(f"   Размер: {total_size_mb:.2f} MB")
    
    if final_count == 0:
        print(f"\n⚠️  ВНИМАНИЕ: Нет документов для обработки!")
        print(f"   Добавьте файлы .txt в директорию: {CURRENT_DIR}")
    else:
        print(f"\n📝 Следующие шаги:")
        print(f"1. Перейдите в админ-панель: /admin")
        print(f"2. Нажмите 'Обработать все документы'")
        print(f"3. Дождитесь завершения обработки")

if __name__ == "__main__":
    main()

