#!/usr/bin/env python3
"""
Проверка доступности централизованного сервиса эмбеддингов (BGE-M3).

Раньше скрипт предзагружал локальные модели sentence-transformers. Теперь
эмбеддинги считаются на сервере с GPU, поэтому достаточно убедиться, что
сервис отвечает и возвращает векторы ожидаемой размерности.
"""

import sys
import os

# Добавляем корень проекта в путь
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import Config
from embeddings.client import EmbeddingClient


def check_embedding_service():
    print("=" * 60)
    print("🔌 Проверка сервиса эмбеддингов")
    print("=" * 60)
    print(f"   URL:    {Config.EMBEDDING_BASE_URL}")
    print(f"   Модель: {Config.EMBEDDING_MODEL}")
    print(f"   Ожид. размерность: {Config.EMBEDDING_DIMENSION}")
    print()

    client = EmbeddingClient()

    if not client.is_available():
        print(f"❌ Сервис недоступен по адресу {Config.EMBEDDING_BASE_URL}")
        print("   Проверьте, запущен ли контейнер embeddings и доступен ли порт.")
        return False

    print("✅ Сервис отвечает. Тестовый запрос...")
    vec = client.encode("Тестовый текст для проверки модели")
    dim = len(vec)
    print(f"   📊 Размерность эмбеддинга: {dim}")

    if dim != Config.EMBEDDING_DIMENSION:
        print(f"   ⚠️  ВНИМАНИЕ: размерность {dim} ≠ EMBEDDING_DIMENSION={Config.EMBEDDING_DIMENSION}")
        print("      Колонка БД Vector(...) должна совпадать — иначе вставка упадёт.")
        return False

    # Проверяем rerank, если включён
    if Config.USE_RERANK:
        ranked = client.rerank("столица", ["Астана — столица Казахстана", "просто текст"])
        if ranked:
            print(f"   ✅ Rerank работает (топ-результат index={ranked[0]['index']}, "
                  f"score={ranked[0]['relevance_score']:.3f})")
        else:
            print("   ⚠️  Rerank недоступен — поиск будет работать без переранжирования")

    print("\n" + "=" * 60)
    print("✅ Сервис эмбеддингов готов к работе")
    print("=" * 60)
    return True


if __name__ == "__main__":
    try:
        ok = check_embedding_service()
        sys.exit(0 if ok else 1)
    except KeyboardInterrupt:
        print("\n\n⚠️  Прервано пользователем")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Критическая ошибка: {e}")
        sys.exit(1)
