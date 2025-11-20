import os
import re
import numpy as np
from typing import List, Dict, Tuple
from sentence_transformers import SentenceTransformer
import tiktoken
from config import Config
from database.models import DatabaseManager

class DocumentProcessor:
    def __init__(self, db_manager: DatabaseManager):
        self.db_manager = db_manager
        self.embedding_model = None
        
        # Пытаемся загрузить основную модель
        try:
            self.embedding_model = SentenceTransformer(Config.EMBEDDING_MODEL)
            print(f"✅ Модель эмбеддингов загружена: {Config.EMBEDDING_MODEL}")
        except Exception as e:
            print(f"❌ Ошибка загрузки основной модели: {e}")
            
            # Пытаемся загрузить альтернативную модель
            try:
                print("🔄 Пытаемся загрузить альтернативную модель...")
                self.embedding_model = SentenceTransformer(Config.EMBEDDING_MODEL_OFFLINE)
                print(f"✅ Альтернативная модель загружена: {Config.EMBEDDING_MODEL_OFFLINE}")
            except Exception as e2:
                print(f"❌ Ошибка загрузки альтернативной модели: {e2}")
                print("⚠️  Система будет работать без создания эмбеддингов")
                self.embedding_model = None
        self.tokenizer = tiktoken.get_encoding("cl100k_base")
        
    def clean_text(self, text: str) -> str:
        """Очистка и нормализация текста"""
        # Удаляем лишние пробелы и переносы строк
        text = re.sub(r'\s+', ' ', text)
        
        # Удаляем специальные символы, но оставляем знаки препинания
        text = re.sub(r'[^\w\s\.\,\;\:\!\?\-\(\)\[\]\"\'№§]', '', text)
        
        # Убираем множественные точки
        text = re.sub(r'\.{3,}', '...', text)
        
        return text.strip()
    
    def extract_title_from_filename(self, filename: str) -> str:
        """Извлечение читаемого названия из имени файла"""
        # Убираем расширение
        title = os.path.splitext(filename)[0]
        
        # Ищем паттерн "название Новый описание"
        if " Новый " in title:
            parts = title.split(" Новый ")
            return parts[0].strip()
        
        return title
    
    def split_into_chunks(self, text: str, chunk_size: int = None, overlap: int = None) -> List[Dict]:
        """Разбивка текста на чанки с учетом семантических границ"""
        chunk_size = chunk_size or Config.CHUNK_SIZE
        overlap = overlap or Config.CHUNK_OVERLAP
        
        # Очищаем текст
        cleaned_text = self.clean_text(text)
        
        chunks = []
        start = 0
        chunk_index = 0
        
        while start < len(cleaned_text):
            # Определяем конец чанка
            end = min(start + chunk_size, len(cleaned_text))
            
            # Если не достигли конца текста, пытаемся найти ближайшую границу предложения
            if end < len(cleaned_text):
                # Ищем ближайший конец предложения в пределах overlap
                sentence_end = cleaned_text.rfind('.', end - overlap, end)
                if sentence_end != -1 and sentence_end > start:
                    end = sentence_end + 1
                else:
                    # Если не нашли точку, ищем пробел
                    space_pos = cleaned_text.rfind(' ', end - overlap, end)
                    if space_pos != -1 and space_pos > start:
                        end = space_pos
            
            chunk_content = cleaned_text[start:end].strip()
            
            if chunk_content:  # Пропускаем пустые чанки
                chunks.append({
                    'index': chunk_index,
                    'content': chunk_content,
                    'start_position': start,
                    'end_position': end,
                    'size': len(chunk_content)
                })
                chunk_index += 1
            
            # Следующий чанк начинается с учетом overlap
            start = max(end - overlap, start + 1)
            
            # Защита от бесконечного цикла
            if start >= end:
                break
        
        return chunks
    
    def create_embeddings(self, texts: List[str]) -> np.ndarray:
        """Создание embeddings для списка текстов"""
        if not texts:
            return np.array([])
        
        if not self.embedding_model:
            print("⚠️  Модель эмбеддингов недоступна, пропускаем создание embeddings")
            return np.array([])
        
        try:
            embeddings = self.embedding_model.encode(texts, convert_to_tensor=False, show_progress_bar=True)
            return np.array(embeddings)
        except Exception as e:
            print(f"Ошибка при создании embeddings: {e}")
            return np.array([])
    
    def process_document(self, filepath: str) -> bool:
        """Обработка одного документа: загрузка, разбивка на чанки, создание embeddings"""
        try:
            # Читаем файл
            with open(filepath, 'r', encoding='utf-8') as file:
                content = file.read()
            
            if not content.strip():
                print(f"Файл {filepath} пуст, пропускаем")
                return False
            
            filename = os.path.basename(filepath)
            title = self.extract_title_from_filename(filename)
            
            print(f"Обрабатываем документ: {title}")
            
            # Сохраняем документ в базу
            document_id = self.db_manager.insert_document(filename, content, title)
            
            # Разбиваем на чанки
            chunks = self.split_into_chunks(content)
            
            if not chunks:
                print(f"Не удалось создать чанки для {filename}")
                return False
            
            print(f"Создано {len(chunks)} чанков")
            
            # Создаем embeddings для всех чанков сразу
            chunk_contents = [chunk['content'] for chunk in chunks]
            embeddings = self.create_embeddings(chunk_contents)
            
            if len(embeddings) == 0 and self.embedding_model:
                print(f"Не удалось создать embeddings для {filename}")
                return False
            elif len(embeddings) == 0:
                print(f"⚠️  Сохраняем документ {filename} без embeddings")
                embeddings = [None] * len(chunks)
            
            # Сохраняем чанки с embeddings в базу
            for i, chunk in enumerate(chunks):
                embedding = embeddings[i] if i < len(embeddings) else None
                self.db_manager.insert_chunk(
                    document_id=document_id,
                    chunk_index=chunk['index'],
                    content=chunk['content'],
                    start_pos=chunk['start_position'],
                    end_pos=chunk['end_position'],
                    embedding=embedding
                )
            
            print(f"Документ {title} успешно обработан")
            return True
            
        except Exception as e:
            print(f"Ошибка при обработке {filepath}: {e}")
            return False
    
    def process_all_documents(self, documents_dir: str) -> Dict:
        """Обработка всех документов в директории"""
        # Проверяем существование директории
        if not os.path.exists(documents_dir):
            print(f"Директория {documents_dir} не существует")
            # Пытаемся найти альтернативные пути
            alternatives = [
                os.path.join('current', 'examples'),
                'current/examples',
                'examples',
                os.path.join(os.path.dirname(os.path.dirname(__file__)), 'current', 'examples')
            ]
            
            for alt_path in alternatives:
                if os.path.exists(alt_path):
                    print(f"📁 Найдена альтернативная директория: {alt_path}")
                    documents_dir = alt_path
                    break
            else:
                return {
                    'processed': 0,
                    'failed': 0,
                    'total': 0,
                    'errors': [f'Директория {documents_dir} не существует и альтернативные пути не найдены']
                }
        
        # Сначала загружаем недостающие документы из директории
        print("📚 Проверяем и загружаем недостающие документы...")
        load_result = self.db_manager.bulk_load_documents_from_directory(documents_dir)
        if load_result['loaded'] > 0:
            print(f"✅ Загружено {load_result['loaded']} новых документов")
        if load_result.get('skipped', 0) > 0:
            print(f"⏭️  Пропущено {load_result['skipped']} документов (уже в базе)")
        
        # Получаем необработанные документы из базы
        unprocessed_docs = self.db_manager.get_unprocessed_documents()
        
        if not unprocessed_docs:
            print("Все документы уже обработаны")
            return {'processed': 0, 'failed': 0, 'total': 0, 'errors': []}
        
        print(f"📋 Найдено {len(unprocessed_docs)} документов для обработки")
        
        processed = 0
        failed = 0
        errors = []
        
        # Обрабатываем документы пакетами
        batch_size = 10
        for i in range(0, len(unprocessed_docs), batch_size):
            batch = unprocessed_docs[i:i + batch_size]
            
            print(f"🔄 Обрабатываем пакет {i//batch_size + 1}/{(len(unprocessed_docs) + batch_size - 1)//batch_size}")
            
            try:
                if self._process_documents_batch(batch):
                    processed += len(batch)
                    print(f"✅ Пакет {i//batch_size + 1} обработан успешно")
                else:
                    failed += len(batch)
                    errors.append(f"Ошибка обработки пакета {i//batch_size + 1}")
            except Exception as e:
                failed += len(batch)
                error_msg = f"Критическая ошибка в пакете {i//batch_size + 1}: {str(e)}"
                errors.append(error_msg)
                print(f"❌ {error_msg}")
        
        result = {
            'processed': processed,
            'failed': failed,
            'total': len(unprocessed_docs),
            'errors': errors
        }
        
        print(f"\n📊 Обработка завершена:")
        print(f"✅ Успешно: {processed}")
        print(f"❌ Ошибок: {failed}")
        print(f"📄 Всего: {len(unprocessed_docs)}")
        
        return result
    
    def _process_documents_batch(self, documents: List[Dict]) -> bool:
        """Обработка пакета документов"""
        try:
            all_chunks = []
            
            for doc in documents:
                print(f"  📄 Обрабатываем: {doc['title']}")
                
                # Разбиваем на чанки
                chunks = self.split_into_chunks(doc['content'])
                
                if not chunks:
                    print(f"    ⚠️  Не удалось создать чанки")
                    continue
                
                # Подготавливаем чанки для массовой вставки
                for chunk in chunks:
                    chunk_data = {
                        'document_id': doc['id'],
                        'chunk_index': chunk['index'],
                        'content': chunk['content'],
                        'start_position': chunk['start_position'],
                        'end_position': chunk['end_position'],
                        'chunk_size': chunk['size'],
                        'embedding': None  # Embeddings создадим отдельно
                    }
                    all_chunks.append(chunk_data)
                
                print(f"    ✅ Создано {len(chunks)} чанков")
            
            if all_chunks:
                # Массовая вставка чанков
                self.db_manager.bulk_insert_chunks(all_chunks)
                
                # Создаем embeddings для всех чанков пакета
                return self._create_embeddings_for_batch(all_chunks)
            
            return True
            
        except Exception as e:
            print(f"Ошибка в пакетной обработке: {e}")
            return False
    
    def _create_embeddings_for_batch(self, chunks_data: List[Dict]) -> bool:
        """Создание embeddings для пакета чанков"""
        try:
            print(f"  🧠 Создаем embeddings для {len(chunks_data)} чанков...")
            
            # Извлекаем тексты
            texts = [chunk['content'] for chunk in chunks_data]
            
            # Создаем embeddings
            embeddings = self.create_embeddings(texts)
            
            if len(embeddings) == 0 and self.embedding_model:
                print("  ❌ Не удалось создать embeddings")
                return False
            elif len(embeddings) == 0:
                print("  ⚠️  Модель недоступна, пропускаем создание embeddings")
                return True
            
            # Обновляем embeddings в базе данных через SQLAlchemy
            from database.models import DocumentChunk, db
            
            try:
                for i, chunk in enumerate(chunks_data):
                    if i < len(embeddings):
                        # Находим чанк в базе
                        db_chunk = DocumentChunk.query.filter_by(
                            document_id=chunk['document_id'],
                            chunk_index=chunk['chunk_index']
                        ).first()
                        
                        if db_chunk:
                            # Устанавливаем embedding
                            db_chunk.set_embedding(embeddings[i])
                
                # Сохраняем изменения
                db.session.commit()
                print(f"  ✅ Embeddings созданы и сохранены")
                return True
                
            except Exception as db_error:
                db.session.rollback()
                print(f"  ❌ Ошибка сохранения в базу: {db_error}")
                return False
            
        except Exception as e:
            print(f"  ❌ Ошибка создания embeddings: {e}")
            return False
    
    def update_embeddings(self) -> bool:
        """Обновление embeddings для чанков без них"""
        if not self.embedding_model:
            print("⚠️  Модель эмбеддингов недоступна, пропускаем обновление")
            return True
            
        try:
            # Получаем чанки без embeddings через SQLAlchemy
            from database.models import DocumentChunk, db
            
            chunks_without_embeddings = DocumentChunk.query.filter(
                DocumentChunk.embedding.is_(None)
            ).all()
            
            if not chunks_without_embeddings:
                print("Все чанки уже имеют embeddings")
                return True
            
            print(f"Создаем embeddings для {len(chunks_without_embeddings)} чанков")
            
            # Создаем embeddings
            contents = [chunk.content for chunk in chunks_without_embeddings]
            embeddings = self.create_embeddings(contents)
            
            if len(embeddings) == 0:
                print("Не удалось создать embeddings")
                return False
            
            # Обновляем базу данных
            try:
                for i, chunk in enumerate(chunks_without_embeddings):
                    if i < len(embeddings):
                        chunk.set_embedding(embeddings[i])
                
                db.session.commit()
                print("Embeddings успешно обновлены")
                return True
                
            except Exception as db_error:
                db.session.rollback()
                print(f"Ошибка сохранения embeddings: {db_error}")
                return False
            
        except Exception as e:
            print(f"Ошибка при обновлении embeddings: {e}")
            return False 