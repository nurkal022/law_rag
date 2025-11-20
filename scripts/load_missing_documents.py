#!/usr/bin/env python3
"""
Скрипт для загрузки недостающих документов в базу данных
"""

import sys
import os

# Добавляем корневую директорию проекта в путь
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Flask
from config import Config
from database.models import DatabaseManager, db

def main():
    print("🚀 Загрузка недостающих документов")
    print("=" * 50)
    
    # Создаем Flask приложение для контекста
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = Config.SQLALCHEMY_DATABASE_URI
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    
    db_manager = DatabaseManager()
    db_manager.init_app(app)
    
    with app.app_context():
        # Проверяем текущую статистику
        stats_before = db_manager.get_documents_stats()
        print(f"📊 Текущая статистика:")
        print(f"   Документов в базе: {stats_before['documents_count']}")
        print(f"   Чанков: {stats_before['chunks_count']}")
        print(f"   Embeddings: {stats_before['chunks_with_embeddings']} ({stats_before['embedding_progress']:.1f}%)")
        
        # Загружаем недостающие документы
        print(f"\n📚 Загружаем документы из {Config.DOCUMENTS_DIR}...")
        result = db_manager.bulk_load_documents_from_directory(Config.DOCUMENTS_DIR)
        
        print(f"\n✅ Результат:")
        print(f"   Загружено новых: {result['loaded']}")
        print(f"   Пропущено (уже в базе): {result.get('skipped', 0)}")
        if result['errors']:
            print(f"   Ошибок: {len(result['errors'])}")
            for error in result['errors'][:5]:  # Показываем первые 5 ошибок
                print(f"      - {error}")
        
        # Проверяем итоговую статистику
        stats_after = db_manager.get_documents_stats()
        print(f"\n📊 Итоговая статистика:")
        print(f"   Документов в базе: {stats_after['documents_count']}")
        print(f"   Чанков: {stats_after['chunks_count']}")
        print(f"   Embeddings: {stats_after['chunks_with_embeddings']} ({stats_after['embedding_progress']:.1f}%)")
        
        if result['loaded'] > 0:
            print(f"\n💡 Следующий шаг:")
            print(f"   Запустите обработку документов для создания embeddings:")
            print(f"   - Через админ-панель: http://localhost:5003/admin")
            print(f"   - Или через API: POST /api/admin/process_documents")

if __name__ == "__main__":
    main()

