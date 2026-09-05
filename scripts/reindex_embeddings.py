#!/usr/bin/env python3
"""
Переиндексация всех чанков через централизованный сервис эмбеддингов (BGE-M3).

Пересоздаёт эмбеддинги для всех чанков в БД (или только для тех, у кого их нет —
с флагом --missing-only). Запускать ПОСЛЕ scripts/migrate_embeddings_1024.py.

Использование:
    python scripts/reindex_embeddings.py              # все чанки
    python scripts/reindex_embeddings.py --missing-only
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import Config
from embeddings.client import EmbeddingClient


def main():
    missing_only = '--missing-only' in sys.argv

    print("=" * 60)
    print("🔁 Переиндексация эмбеддингов через BGE-M3")
    print("=" * 60)
    print(f"   Сервис: {Config.EMBEDDING_MODEL} @ {Config.EMBEDDING_BASE_URL}")
    print(f"   Режим: {'только без эмбеддингов' if missing_only else 'все чанки'}")

    client = EmbeddingClient()
    if not client.is_available():
        print(f"❌ Сервис эмбеддингов недоступен: {Config.EMBEDDING_BASE_URL}")
        sys.exit(1)

    # Поднимаем Flask-контекст ради SQLAlchemy-сессии
    from app import app
    from database.models import DocumentChunk, db

    with app.app_context():
        q = DocumentChunk.query
        if missing_only:
            q = q.filter(DocumentChunk.embedding.is_(None))
        chunks = q.order_by(DocumentChunk.id).all()
        total = len(chunks)
        print(f"   Чанков к обработке: {total}")
        if total == 0:
            print("✅ Нечего переиндексировать.")
            return

        batch_size = 64
        done = 0
        for i in range(0, total, batch_size):
            batch = chunks[i:i + batch_size]
            texts = [c.content for c in batch]
            try:
                vectors = client.encode(texts)
            except Exception as e:
                print(f"❌ Ошибка эмбеддинга пакета {i}-{i+len(batch)}: {e}")
                db.session.rollback()
                sys.exit(1)

            for chunk, vec in zip(batch, vectors):
                chunk.set_embedding(vec)
            db.session.commit()

            done += len(batch)
            pct = done / total * 100
            print(f"   ✅ {done}/{total} ({pct:.1f}%)")

        print("\n" + "=" * 60)
        print(f"✅ Переиндексация завершена: {done} чанков")
        print("=" * 60)


if __name__ == "__main__":
    main()
