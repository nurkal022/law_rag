import sqlite3
import json
import numpy as np
from typing import List, Dict, Optional, Tuple
from datetime import datetime
import os
import glob

class DatabaseManager:
    def __init__(self, db_path: str):
        self.db_path = db_path
        self.init_database()
    
    def init_database(self):
        """Инициализация базы данных с необходимыми таблицами"""
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            # Таблица документов
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS documents (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    filename TEXT UNIQUE NOT NULL,
                    title TEXT,
                    content TEXT NOT NULL,
                    file_size INTEGER,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            # Таблица чанков документов
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS document_chunks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    document_id INTEGER NOT NULL,
                    chunk_index INTEGER NOT NULL,
                    content TEXT NOT NULL,
                    start_position INTEGER NOT NULL,
                    end_position INTEGER NOT NULL,
                    chunk_size INTEGER NOT NULL,
                    embedding BLOB,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE CASCADE,
                    UNIQUE(document_id, chunk_index)
                )
            ''')
            
            # Таблица для истории чатов
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS chat_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT NOT NULL,
                    user_query TEXT NOT NULL,
                    ai_response TEXT NOT NULL,
                    sources TEXT, -- JSON массив источников
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            # Индексы для оптимизации поиска
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON document_chunks(document_id)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_chat_session ON chat_history(session_id)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_documents_filename ON documents(filename)')
            
            conn.commit()
            
        # Автоматическая загрузка документов при пустой базе
        self._auto_populate_if_empty()
    
    def _auto_populate_if_empty(self):
        """Автоматическая загрузка документов если база пустая"""
        stats = self.get_documents_stats()
        if stats['documents_count'] == 0:
            print("📝 База данных пустая, начинаем автоматическую загрузку документов...")
            self.bulk_load_documents_from_directory('current')
    
    def bulk_load_documents_from_directory(self, directory: str, limit: int = None):
        """Массовая загрузка документов из директории"""
        if not os.path.exists(directory):
            print(f"⚠️  Директория {directory} не найдена")
            return {'loaded': 0, 'errors': []}
        
        txt_files = glob.glob(os.path.join(directory, '*.txt'))
        
        if limit:
            txt_files = txt_files[:limit]
        
        if not txt_files:
            print(f"📁 В директории {directory} нет .txt файлов")
            return {'loaded': 0, 'errors': []}
        
        print(f"📚 Найдено {len(txt_files)} документов для загрузки")
        
        loaded = 0
        errors = []
        
        # Используем транзакцию для массовой вставки
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            for i, file_path in enumerate(txt_files):
                try:
                    filename = os.path.basename(file_path)
                    
                    # Читаем файл
                    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read().strip()
                    
                    if not content:
                        continue
                    
                    # Извлекаем заголовок из имени файла
                    title = self._extract_title_from_filename(filename)
                    
                    # Проверяем существование документа
                    cursor.execute('SELECT id FROM documents WHERE filename = ?', (filename,))
                    if cursor.fetchone():
                        continue  # Документ уже существует
                    
                    # Вставляем документ
                    cursor.execute('''
                        INSERT INTO documents (filename, title, content, file_size)
                        VALUES (?, ?, ?, ?)
                    ''', (filename, title, content, len(content)))
                    
                    loaded += 1
                    
                    if (i + 1) % 100 == 0:
                        print(f"  📄 Загружено {i + 1}/{len(txt_files)} документов...")
                        conn.commit()  # Промежуточный commit
                    
                except Exception as e:
                    error_msg = f"Ошибка загрузки {file_path}: {str(e)}"
                    errors.append(error_msg)
                    print(f"  ❌ {error_msg}")
            
            conn.commit()
        
        print(f"✅ Загружено {loaded} документов в базу данных")
        if errors:
            print(f"⚠️  Ошибок: {len(errors)}")
        
        return {'loaded': loaded, 'errors': errors}
    
    def _extract_title_from_filename(self, filename: str) -> str:
        """Извлечение читаемого названия из имени файла"""
        title = os.path.splitext(filename)[0]
        
        # Ищем паттерн "название Новый описание"
        if " Новый " in title:
            parts = title.split(" Новый ")
            return parts[0].strip()
        
        # Убираем лишние символы и делаем читаемым
        title = title.replace('_', ' ').replace('-', ' ')
        return title.strip()
    
    def get_unprocessed_documents(self) -> List[Dict]:
        """Получение документов без чанков (не обработанных)"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT d.id, d.filename, d.title, d.content
                FROM documents d
                LEFT JOIN document_chunks dc ON d.id = dc.document_id
                WHERE dc.document_id IS NULL
                ORDER BY d.created_at
            ''')
            
            documents = []
            for row in cursor.fetchall():
                documents.append({
                    'id': row[0],
                    'filename': row[1],
                    'title': row[2],
                    'content': row[3]
                })
            
            return documents
    
    def bulk_insert_chunks(self, chunks_data: List[Dict]):
        """Массовая вставка чанков"""
        if not chunks_data:
            return
        
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            # Подготавливаем данные для массовой вставки
            insert_data = []
            for chunk in chunks_data:
                embedding_blob = None
                if chunk.get('embedding') is not None:
                    embedding_blob = chunk['embedding'].tobytes()
                
                insert_data.append((
                    chunk['document_id'],
                    chunk['chunk_index'],
                    chunk['content'],
                    chunk['start_position'],
                    chunk['end_position'],
                    chunk['chunk_size'],
                    embedding_blob
                ))
            
            # Массовая вставка
            cursor.executemany('''
                INSERT OR REPLACE INTO document_chunks 
                (document_id, chunk_index, content, start_position, end_position, chunk_size, embedding)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', insert_data)
            
            conn.commit()
            print(f"💾 Сохранено {len(chunks_data)} чанков в базу данных")
    
    def insert_document(self, filename: str, content: str, title: str = None) -> int:
        """Добавление документа в базу данных"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            # Проверяем, существует ли документ
            cursor.execute('SELECT id FROM documents WHERE filename = ?', (filename,))
            existing = cursor.fetchone()
            
            if existing:
                # Обновляем существующий документ
                cursor.execute('''
                    UPDATE documents 
                    SET content = ?, title = ?, file_size = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE filename = ?
                ''', (content, title or filename, len(content), filename))
                document_id = existing[0]
                
                # Удаляем старые чанки
                cursor.execute('DELETE FROM document_chunks WHERE document_id = ?', (document_id,))
            else:
                # Вставляем новый документ
                cursor.execute('''
                    INSERT INTO documents (filename, title, content, file_size)
                    VALUES (?, ?, ?, ?)
                ''', (filename, title or filename, content, len(content)))
                document_id = cursor.lastrowid
            
            conn.commit()
            return document_id
    
    def insert_chunk(self, document_id: int, chunk_index: int, content: str, 
                    start_pos: int, end_pos: int, embedding: np.ndarray = None) -> int:
        """Добавление чанка документа"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            embedding_blob = None
            if embedding is not None:
                embedding_blob = embedding.tobytes()
            
            cursor.execute('''
                INSERT OR REPLACE INTO document_chunks 
                (document_id, chunk_index, content, start_position, end_position, chunk_size, embedding)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (document_id, chunk_index, content, start_pos, end_pos, len(content), embedding_blob))
            
            chunk_id = cursor.lastrowid
            conn.commit()
            return chunk_id
    
    def get_document_by_filename(self, filename: str) -> Optional[Dict]:
        """Получение документа по имени файла"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT id, filename, title, content, file_size, created_at, updated_at
                FROM documents WHERE filename = ?
            ''', (filename,))
            
            row = cursor.fetchone()
            if row:
                return {
                    'id': row[0],
                    'filename': row[1],
                    'title': row[2],
                    'content': row[3],
                    'file_size': row[4],
                    'created_at': row[5],
                    'updated_at': row[6]
                }
            return None
    
    def get_all_chunks(self) -> List[Dict]:
        """Получение всех чанков (без embeddings) для поиска по ключевым словам"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT dc.id, dc.document_id, dc.chunk_index, dc.content, 
                       dc.start_position, dc.end_position,
                       d.filename, d.title
                FROM document_chunks dc
                JOIN documents d ON dc.document_id = d.id
                ORDER BY d.filename, dc.chunk_index
            ''')
            
            chunks = []
            for row in cursor.fetchall():
                chunks.append({
                    'id': row[0],
                    'document_id': row[1],
                    'chunk_index': row[2],
                    'content': row[3],
                    'start_position': row[4],
                    'end_position': row[5],
                    'filename': row[6],
                    'title': row[7]
                })
            
            return chunks

    def get_all_chunks_with_embeddings(self) -> List[Dict]:
        """Получение всех чанков с embeddings для поиска"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT dc.id, dc.document_id, dc.chunk_index, dc.content, 
                       dc.start_position, dc.end_position, dc.embedding,
                       d.filename, d.title
                FROM document_chunks dc
                JOIN documents d ON dc.document_id = d.id
                WHERE dc.embedding IS NOT NULL
                ORDER BY d.filename, dc.chunk_index
            ''')
            
            chunks = []
            for row in cursor.fetchall():
                embedding = None
                if row[6]:  # embedding blob
                    embedding = np.frombuffer(row[6], dtype=np.float32)
                
                chunks.append({
                    'id': row[0],
                    'document_id': row[1],
                    'chunk_index': row[2],
                    'content': row[3],
                    'start_position': row[4],
                    'end_position': row[5],
                    'embedding': embedding,
                    'filename': row[7],
                    'title': row[8]
                })
            
            return chunks
    
    def get_chunk_by_id(self, chunk_id: int) -> Optional[Dict]:
        """Получение конкретного чанка по ID"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT dc.id, dc.document_id, dc.chunk_index, dc.content, 
                       dc.start_position, dc.end_position,
                       d.filename, d.title
                FROM document_chunks dc
                JOIN documents d ON dc.document_id = d.id
                WHERE dc.id = ?
            ''', (chunk_id,))
            
            row = cursor.fetchone()
            if row:
                return {
                    'id': row[0],
                    'document_id': row[1],
                    'chunk_index': row[2],
                    'content': row[3],
                    'start_position': row[4],
                    'end_position': row[5],
                    'filename': row[6],
                    'title': row[7]
                }
            return None
    
    def save_chat_history(self, session_id: str, user_query: str, 
                         ai_response: str, sources: List[Dict] = None):
        """Сохранение истории чата"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            sources_json = json.dumps(sources, ensure_ascii=False) if sources else None
            
            cursor.execute('''
                INSERT INTO chat_history (session_id, user_query, ai_response, sources)
                VALUES (?, ?, ?, ?)
            ''', (session_id, user_query, ai_response, sources_json))
            
            conn.commit()
    
    def get_chat_history(self, session_id: str, limit: int = 10) -> List[Dict]:
        """Получение истории чата для сессии"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT user_query, ai_response, sources, created_at
                FROM chat_history 
                WHERE session_id = ?
                ORDER BY created_at DESC
                LIMIT ?
            ''', (session_id, limit))
            
            history = []
            for row in cursor.fetchall():
                sources = json.loads(row[2]) if row[2] else []
                history.append({
                    'user_query': row[0],
                    'ai_response': row[1],
                    'sources': sources,
                    'created_at': row[3]
                })
            
            return list(reversed(history))  # Возвращаем в хронологическом порядке
    
    def get_documents_stats(self) -> Dict:
        """Получение статистики по документам"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            # Общее количество документов
            cursor.execute('SELECT COUNT(*) FROM documents')
            docs_count = cursor.fetchone()[0]
            
            # Общее количество чанков
            cursor.execute('SELECT COUNT(*) FROM document_chunks')
            chunks_count = cursor.fetchone()[0]
            
            # Количество чанков с embeddings
            cursor.execute('SELECT COUNT(*) FROM document_chunks WHERE embedding IS NOT NULL')
            embedded_chunks = cursor.fetchone()[0]
            
            return {
                'documents_count': docs_count,
                'chunks_count': chunks_count,
                'embedded_chunks': embedded_chunks,
                'embedding_progress': (embedded_chunks / chunks_count * 100) if chunks_count > 0 else 0
            } 