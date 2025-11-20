#!/usr/bin/env python3
"""
Скрипт для сброса базы данных - удаление всех документов и чанков для перезагрузки
"""

import sqlite3
import os
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "database" / "law_database.db"

def main():
    print("🔄 Сброс базы данных...")
    
    if not DB_PATH.exists():
        print("✅ База данных не существует, ничего сбрасывать не нужно")
        return
    
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    
    try:
        # Подсчитываем текущие записи
        cursor.execute("SELECT COUNT(*) FROM documents")
        docs_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM document_chunks")
        chunks_count = cursor.fetchone()[0]
        
        print(f"Найдено документов: {docs_count}")
        print(f"Найдено чанков: {chunks_count}")
        
        if docs_count == 0 and chunks_count == 0:
            print("✅ База данных уже пустая")
            return
        
        # Удаляем все чанки
        print("\nУдаление чанков...")
        cursor.execute("DELETE FROM document_chunks")
        print(f"✅ Удалено {chunks_count} чанков")
        
        # Удаляем все документы
        print("\nУдаление документов...")
        cursor.execute("DELETE FROM documents")
        print(f"✅ Удалено {docs_count} документов")
        
        # Коммитим изменения
        conn.commit()
        
        print("\n✅ База данных успешно сброшена!")
        print("Теперь можно загрузить документы заново через админ-панель или скрипт загрузки")
        
    except Exception as e:
        conn.rollback()
        print(f"❌ Ошибка при сбросе базы данных: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    main()
