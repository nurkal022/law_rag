#!/usr/bin/env python3
"""
Миграция колонки эмбеддингов под BGE-M3: vector(384) → vector(1024).

Старые 384-мерные векторы несовместимы с bge-m3, поэтому они обнуляются —
после миграции нужно запустить переиндексацию (scripts/reindex_embeddings.py).

Идемпотентно: если колонка уже vector(1024), ничего не делает.
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import psycopg2
from config import Config

TARGET_DIM = Config.EMBEDDING_DIMENSION  # 1024


def current_dim(cur) -> int:
    # atttypmod для vector(N) хранит N напрямую
    cur.execute(
        "SELECT atttypmod FROM pg_attribute "
        "WHERE attrelid='document_chunks'::regclass AND attname='embedding'"
    )
    row = cur.fetchone()
    return row[0] if row else None


def main():
    url = Config.DATABASE_URL
    print("=" * 60)
    print(f"🔧 Миграция embedding → vector({TARGET_DIM})")
    print("=" * 60)
    print(f"   DB: {url}")

    conn = psycopg2.connect(url)
    conn.autocommit = False
    cur = conn.cursor()

    dim = current_dim(cur)
    print(f"   Текущая размерность колонки: {dim}")

    if dim == TARGET_DIM:
        print("✅ Колонка уже нужной размерности — миграция не требуется.")
        conn.close()
        return

    cur.execute("SELECT count(*) FROM document_chunks WHERE embedding IS NOT NULL")
    with_emb = cur.fetchone()[0]
    print(f"   Чанков со старыми эмбеддингами (будут обнулены): {with_emb}")

    try:
        # Обнуляем старые векторы (другая размерность — несовместимы)
        cur.execute("UPDATE document_chunks SET embedding = NULL")
        # Меняем тип колонки. USING NULL::vector(N) — старых данных уже нет.
        cur.execute(f"ALTER TABLE document_chunks ALTER COLUMN embedding TYPE vector({TARGET_DIM})")
        conn.commit()
        print(f"✅ Колонка переведена в vector({TARGET_DIM}), старые эмбеддинги очищены.")
        print("➡️  Теперь запустите: python scripts/reindex_embeddings.py")
    except Exception as e:
        conn.rollback()
        print(f"❌ Ошибка миграции: {e}")
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
