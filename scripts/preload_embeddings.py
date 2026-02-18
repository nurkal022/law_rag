#!/usr/bin/env python3
"""
Скрипт для предзагрузки модели эмбеддингов
Загружает модель локально, чтобы не качать при первом запуске приложения
"""

import sys
import os

# Добавляем текущую директорию в путь
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import os
# Офлайн режим
os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['TRANSFORMERS_OFFLINE'] = '1'

from sentence_transformers import SentenceTransformer
import torch
from config import Config

def get_device():
    """Определяет устройство для вычислений (CPU или GPU)"""
    use_gpu = Config.USE_GPU_FOR_EMBEDDINGS
    
    if use_gpu == 'false':
        return 'cpu'
    elif use_gpu == 'true':
        if torch.cuda.is_available():
            return 'cuda'
        else:
            print("⚠️  GPU запрошен, но недоступен. Используется CPU.")
            return 'cpu'
    else:  # 'auto'
        if torch.cuda.is_available():
            print(f"🚀 GPU обнаружен: {torch.cuda.get_device_name(0)}")
            return 'cuda'
        else:
            return 'cpu'

def preload_embedding_models():
    """Предзагрузка моделей эмбеддингов"""
    print("=" * 60)
    print("📥 Предзагрузка моделей эмбеддингов")
    print("=" * 60)
    
    device = get_device()
    print(f"📱 Используемое устройство: {device}")
    if device == 'cuda':
        print(f"   GPU: {torch.cuda.get_device_name(0)}")
        print(f"   Память GPU: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.2f} GB")
    print()
    
    models_to_load = [
        (Config.EMBEDDING_MODEL, "Основная модель"),
        (Config.EMBEDDING_MODEL_OFFLINE, "Запасная модель")
    ]
    
    for model_name, description in models_to_load:
        print(f"🔄 Загрузка {description}: {model_name}")
        try:
            print("   ⏳ Загрузка из локального кеша...")
            model = SentenceTransformer(model_name, device=device, local_files_only=True)
            
            # Тестируем модель на простом тексте
            test_text = "Тестовый текст для проверки модели"
            embedding = model.encode(test_text)
            
            print(f"   ✅ {description} успешно загружена!")
            print(f"   📊 Размерность эмбеддинга: {len(embedding)}")
            print(f"   💾 Модель сохранена локально в кеше")
            if device == 'cuda':
                print(f"   🚀 Модель использует GPU для ускорения")
            
        except Exception as e:
            print(f"   ❌ Ошибка загрузки {description}: {e}")
            print(f"   ⚠️  Продолжаем с другими моделями...")
    
    print("\n" + "=" * 60)
    print("✅ Предзагрузка завершена!")
    print("=" * 60)
    print("\n💡 Теперь модели будут загружаться мгновенно при запуске приложения")
    print("📁 Модели сохранены в: ~/.cache/huggingface/ или ~/.cache/torch/sentence_transformers/")

if __name__ == "__main__":
    try:
        preload_embedding_models()
    except KeyboardInterrupt:
        print("\n\n⚠️  Прервано пользователем")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Критическая ошибка: {e}")
        sys.exit(1)

