from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import json
import numpy as np
from typing import List, Dict, Optional, Tuple
import os
import glob
from config import Config

# Инициализация SQLAlchemy
db = SQLAlchemy()

class Document(db.Model):
    """Модель документа"""
    __tablename__ = 'documents'
    
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(255), unique=True, nullable=False, index=True)
    title = db.Column(db.Text)
    content = db.Column(db.Text, nullable=False)
    file_size = db.Column(db.Integer)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Связь с чанками
    chunks = db.relationship('DocumentChunk', backref='document', lazy='dynamic', cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'filename': self.filename,
            'title': self.title,
            'content': self.content,
            'file_size': self.file_size,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'chunks_count': self.chunks.count()
        }

class DocumentChunk(db.Model):
    """Модель чанка документа"""
    __tablename__ = 'document_chunks'
    
    id = db.Column(db.Integer, primary_key=True)
    document_id = db.Column(db.Integer, db.ForeignKey('documents.id'), nullable=False, index=True)
    chunk_index = db.Column(db.Integer, nullable=False)
    content = db.Column(db.Text, nullable=False)
    start_position = db.Column(db.Integer, nullable=False)
    end_position = db.Column(db.Integer, nullable=False)
    chunk_size = db.Column(db.Integer, nullable=False)
    embedding = db.Column(db.LargeBinary)  # Для хранения numpy array как BLOB
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Уникальность по документу и индексу чанка
    __table_args__ = (db.UniqueConstraint('document_id', 'chunk_index'),)
    
    def to_dict(self):
        return {
            'id': self.id,
            'document_id': self.document_id,
            'chunk_index': self.chunk_index,
            'content': self.content,
            'start_position': self.start_position,
            'end_position': self.end_position,
            'chunk_size': self.chunk_size,
            'has_embedding': self.embedding is not None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'document_filename': self.document.filename if self.document else None,
            'document_title': self.document.title if self.document else None
        }
    
    def get_embedding(self) -> Optional[np.ndarray]:
        """Получение embedding как numpy array"""
        if self.embedding:
            return np.frombuffer(self.embedding, dtype=np.float32)
        return None
    
    def set_embedding(self, embedding: np.ndarray):
        """Установка embedding из numpy array"""
        if embedding is not None:
            self.embedding = embedding.astype(np.float32).tobytes()
        else:
            self.embedding = None

class ChatHistory(db.Model):
    """Модель истории чата"""
    __tablename__ = 'chat_history'
    
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.String(255), nullable=False, index=True)
    user_query = db.Column(db.Text, nullable=False)
    ai_response = db.Column(db.Text, nullable=False)
    sources = db.Column(db.Text)  # JSON массив источников
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'session_id': self.session_id,
            'user_query': self.user_query,
            'ai_response': self.ai_response,
            'sources': json.loads(self.sources) if self.sources else [],
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class LawProject(db.Model):
    """Модель законопроекта"""
    __tablename__ = 'law_projects'
    
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.String(255), unique=True, nullable=False, index=True)
    title_ru = db.Column(db.Text, nullable=False)
    title_kz = db.Column(db.Text)
    initiator = db.Column(db.String(255), nullable=False)
    initiator_type = db.Column(db.String(100), nullable=False)
    status = db.Column(db.String(50), default='draft', index=True)
    data_json = db.Column(db.Text)  # JSON с полными данными проекта
    sections_json = db.Column(db.Text)  # JSON с сгенерированными разделами
    metadata_json = db.Column(db.Text)  # JSON с метаданными
    generation_date = db.Column(db.DateTime, default=datetime.utcnow)
    last_modified = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completeness_score = db.Column(db.Float, default=0.0)
    validation_status = db.Column(db.String(50), default='pending')
    
    # Связь с версиями
    versions = db.relationship('LawProjectVersion', backref='project', lazy='dynamic', cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'project_id': self.project_id,
            'title_ru': self.title_ru,
            'title_kz': self.title_kz,
            'initiator': self.initiator,
            'initiator_type': self.initiator_type,
            'status': self.status,
            'data': json.loads(self.data_json) if self.data_json else {},
            'sections': json.loads(self.sections_json) if self.sections_json else {},
            'metadata': json.loads(self.metadata_json) if self.metadata_json else {},
            'generation_date': self.generation_date.isoformat() if self.generation_date else None,
            'last_modified': self.last_modified.isoformat() if self.last_modified else None,
            'completeness_score': self.completeness_score,
            'validation_status': self.validation_status,
            'versions_count': self.versions.count()
        }

class LawProjectVersion(db.Model):
    """Модель версии законопроекта (для аудит-лога)"""
    __tablename__ = 'law_project_versions'
    
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.String(255), db.ForeignKey('law_projects.project_id'), nullable=False, index=True)
    version = db.Column(db.String(50), nullable=False)
    author = db.Column(db.String(255))
    description = db.Column(db.Text)
    changes_json = db.Column(db.Text)  # JSON с описанием изменений
    sections_json = db.Column(db.Text)  # JSON с разделами этой версии
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'project_id': self.project_id,
            'version': self.version,
            'author': self.author,
            'description': self.description,
            'changes': json.loads(self.changes_json) if self.changes_json else {},
            'sections': json.loads(self.sections_json) if self.sections_json else {},
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class LawGenerationSession(db.Model):
    """Модель сессии генерации (отслеживание процесса заполнения)"""
    __tablename__ = 'law_generation_sessions'
    
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.String(255), unique=True, nullable=False, index=True)
    project_id = db.Column(db.String(255))
    current_step = db.Column(db.Integer, default=1)
    collected_data = db.Column(db.Text)  # JSON с собранными данными
    validation_results = db.Column(db.Text)  # JSON с результатами валидации
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    status = db.Column(db.String(50), default='active')
    
    def to_dict(self):
        return {
            'id': self.id,
            'session_id': self.session_id,
            'project_id': self.project_id,
            'current_step': self.current_step,
            'collected_data': json.loads(self.collected_data) if self.collected_data else {},
            'validation_results': json.loads(self.validation_results) if self.validation_results else {},
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'status': self.status
        }

class DatabaseManager:
    """Менеджер базы данных с SQLAlchemy ORM"""
    
    def __init__(self, app=None):
        self.app = app
        if app is not None:
            self.init_app(app)
    
    def init_app(self, app):
        """Инициализация с Flask приложением"""
        self.app = app
        db.init_app(app)
    
    def ensure_database_exists(self):
        """Создание базы данных если её нет"""
        if not hasattr(self, '_database_initialized'):
            with self.app.app_context():
                # Создаем директорию если её нет
                os.makedirs(os.path.dirname(Config.DATABASE_PATH), exist_ok=True)
                db.create_all()
                self._database_initialized = True
                # Проверяем нужно ли загружать документы
                self._auto_populate_if_empty()
    
    def _auto_populate_if_empty(self):
        """Автоматическая загрузка документов если база пустая"""
        try:
            # Прямой запрос без вызова ensure_database_exists
            documents_count = Document.query.count()
            if documents_count == 0:
                print("📝 База данных пустая, начинаем автоматическую загрузку документов...")
                self.bulk_load_documents_from_directory('current')
        except Exception as e:
            print(f"Не удалось проверить количество документов: {e}")
            # Попробуем загрузить документы в любом случае
            self.bulk_load_documents_from_directory('current')
    
    def bulk_load_documents_from_directory(self, directory: str, limit: int = None):
        """Массовая загрузка документов из директории"""
        if not os.path.exists(directory):
            print(f"⚠️  Директория {directory} не найдена")
            return {'loaded': 0, 'errors': [], 'skipped': 0}
        
        txt_files = glob.glob(os.path.join(directory, '*.txt'))
        
        if limit:
            txt_files = txt_files[:limit]
        
        if not txt_files:
            print(f"📁 В директории {directory} нет .txt файлов")
            return {'loaded': 0, 'errors': [], 'skipped': 0}
        
        print(f"📚 Найдено {len(txt_files)} документов в директории")
        
        # Получаем список уже загруженных документов для быстрой проверки
        existing_filenames = {doc.filename for doc in Document.query.all()}
        
        loaded = 0
        skipped = 0
        errors = []
        
        for i, file_path in enumerate(txt_files):
            try:
                filename = os.path.basename(file_path)
                
                # Проверяем существование документа
                if filename in existing_filenames:
                    skipped += 1
                    continue  # Документ уже существует
                
                # Читаем файл
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read().strip()
                
                if not content:
                    skipped += 1
                    continue
                
                # Извлекаем заголовок из имени файла
                title = self._extract_title_from_filename(filename)
                
                # Создаем документ
                document = Document(
                    filename=filename,
                    title=title,
                    content=content,
                    file_size=len(content)
                )
                
                db.session.add(document)
                existing_filenames.add(filename)  # Добавляем в кэш
                loaded += 1
                
                if (i + 1) % 100 == 0:
                    print(f"  📄 Обработано {i + 1}/{len(txt_files)} документов (загружено: {loaded}, пропущено: {skipped})...")
                    db.session.commit()  # Промежуточный commit
                
            except Exception as e:
                error_msg = f"Ошибка загрузки {file_path}: {str(e)}"
                errors.append(error_msg)
                print(f"  ❌ {error_msg}")
        
        try:
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            print(f"Ошибка при сохранении в базу: {e}")
        
        print(f"✅ Загружено {loaded} новых документов в базу данных")
        if skipped > 0:
            print(f"⏭️  Пропущено {skipped} документов (уже в базе)")
        if errors:
            print(f"⚠️  Ошибок: {len(errors)}")
        
        return {'loaded': loaded, 'errors': errors, 'skipped': skipped}
    
    def _extract_title_from_filename(self, filename: str) -> str:
        """Извлечение заголовка из имени файла"""
        # Убираем расширение и заменяем символы
        title = os.path.splitext(filename)[0]
        title = title.replace('_', ' ').replace('-', ' ')
        
        # Капитализируем первую букву каждого слова
        title = ' '.join(word.capitalize() for word in title.split())
        
        return title[:200]  # Ограничиваем длину
    
    def get_unprocessed_documents(self) -> List[Dict]:
        """Получение документов без чанков"""
        self.ensure_database_exists()
        
        documents = db.session.query(Document).outerjoin(DocumentChunk).filter(
            DocumentChunk.id.is_(None)
        ).all()
        
        return [doc.to_dict() for doc in documents]
    
    def bulk_insert_chunks(self, chunks_data: List[Dict]):
        """Массовая вставка чанков"""
        try:
            for chunk_data in chunks_data:
                chunk = DocumentChunk(
                    document_id=chunk_data['document_id'],
                    chunk_index=chunk_data['chunk_index'],
                    content=chunk_data['content'],
                    start_position=chunk_data['start_position'],
                    end_position=chunk_data['end_position'],
                    chunk_size=chunk_data['chunk_size']
                )
                
                if 'embedding' in chunk_data and chunk_data['embedding'] is not None:
                    chunk.set_embedding(chunk_data['embedding'])
                
                db.session.add(chunk)
                
                # Commit каждые 100 записей для оптимизации
                if len(chunks_data) > 100 and (chunks_data.index(chunk_data) + 1) % 100 == 0:
                    db.session.commit()
            
            db.session.commit()
            return True
            
        except Exception as e:
            db.session.rollback()
            print(f"Ошибка массовой вставки чанков: {e}")
            return False
    
    def insert_document(self, filename: str, content: str, title: str = None) -> int:
        """Вставка нового документа"""
        try:
            document = Document(
                filename=filename,
                title=title or self._extract_title_from_filename(filename),
                content=content,
                file_size=len(content)
            )
            
            db.session.add(document)
            db.session.commit()
            
            return document.id
            
        except Exception as e:
            db.session.rollback()
            print(f"Ошибка вставки документа: {e}")
            return None
    
    def insert_chunk(self, document_id: int, chunk_index: int, content: str, 
                    start_pos: int, end_pos: int, embedding: np.ndarray = None) -> int:
        """Вставка чанка документа"""
        try:
            chunk = DocumentChunk(
                document_id=document_id,
                chunk_index=chunk_index,
                content=content,
                start_position=start_pos,
                end_position=end_pos,
                chunk_size=len(content)
            )
            
            if embedding is not None:
                chunk.set_embedding(embedding)
            
            db.session.add(chunk)
            db.session.commit()
            
            return chunk.id
            
        except Exception as e:
            db.session.rollback()
            print(f"Ошибка вставки чанка: {e}")
            return None
    
    def get_document_by_filename(self, filename: str) -> Optional[Dict]:
        """Получение документа по имени файла"""
        document = Document.query.filter_by(filename=filename).first()
        return document.to_dict() if document else None
    
    def get_all_chunks(self) -> List[Dict]:
        """Получение всех чанков с информацией о документах"""
        chunks = db.session.query(DocumentChunk).join(Document).all()
        return [chunk.to_dict() for chunk in chunks]
    
    def get_all_chunks_with_embeddings(self) -> List[Dict]:
        """Получение чанков с embeddings"""
        chunks = db.session.query(DocumentChunk).filter(
            DocumentChunk.embedding.isnot(None)
        ).join(Document).all()
        
        result = []
        for chunk in chunks:
            chunk_dict = chunk.to_dict()
            chunk_dict['embedding'] = chunk.get_embedding()
            result.append(chunk_dict)
        
        return result
    
    def get_chunk_by_id(self, chunk_id: int) -> Optional[Dict]:
        """Получение чанка по ID с информацией о документе"""
        chunk = db.session.query(DocumentChunk).join(Document).filter(
            DocumentChunk.id == chunk_id
        ).first()
        
        return chunk.to_dict() if chunk else None
    
    def save_chat_history(self, session_id: str, user_query: str, 
                         ai_response: str, sources: List[Dict] = None):
        """Сохранение истории чата"""
        try:
            chat_entry = ChatHistory(
                session_id=session_id,
                user_query=user_query,
                ai_response=ai_response,
                sources=json.dumps(sources, ensure_ascii=False) if sources else None
            )
            
            db.session.add(chat_entry)
            db.session.commit()
            
        except Exception as e:
            db.session.rollback()
            print(f"Ошибка сохранения истории чата: {e}")
    
    def get_chat_history(self, session_id: str, limit: int = 10) -> List[Dict]:
        """Получение истории чата для сессии"""
        history = ChatHistory.query.filter_by(session_id=session_id).order_by(
            ChatHistory.created_at.desc()
        ).limit(limit).all()
        
        return [entry.to_dict() for entry in reversed(history)]
    
    def get_documents_stats(self) -> Dict:
        """Получение статистики по документам"""
        self.ensure_database_exists()
        
        documents_count = Document.query.count()
        chunks_count = DocumentChunk.query.count()
        chunks_with_embeddings = DocumentChunk.query.filter(
            DocumentChunk.embedding.isnot(None)
        ).count()
        
        embedding_progress = round(
            (chunks_with_embeddings / chunks_count * 100) if chunks_count > 0 else 0, 1
        )
        
        return {
            'documents_count': documents_count,
            'chunks_count': chunks_count,
            'chunks_with_embeddings': chunks_with_embeddings,
            'embedding_progress': embedding_progress
        }
    
    def save_law_project(self, project_id: str, data_dict: Dict, sections: Dict, metadata: Dict) -> bool:
        """Сохранение законопроекта"""
        try:
            # Проверяем существование проекта
            existing = LawProject.query.filter_by(project_id=project_id).first()
            
            if existing:
                # Обновляем существующий
                existing.data_json = json.dumps(data_dict, ensure_ascii=False)
                existing.sections_json = json.dumps(sections, ensure_ascii=False)
                existing.metadata_json = json.dumps(metadata, ensure_ascii=False)
                existing.last_modified = datetime.utcnow()
                existing.title_ru = data_dict.get('title_ru', existing.title_ru)
                existing.title_kz = data_dict.get('title_kz', existing.title_kz)
                existing.initiator = data_dict.get('initiator', existing.initiator)
                existing.initiator_type = data_dict.get('initiator_type', existing.initiator_type)
            else:
                # Создаем новый
                project = LawProject(
                    project_id=project_id,
                    title_ru=data_dict.get('title_ru', 'Без названия'),
                    title_kz=data_dict.get('title_kz'),
                    initiator=data_dict.get('initiator', 'Неизвестно'),
                    initiator_type=data_dict.get('initiator_type', 'other'),
                    data_json=json.dumps(data_dict, ensure_ascii=False),
                    sections_json=json.dumps(sections, ensure_ascii=False),
                    metadata_json=json.dumps(metadata, ensure_ascii=False)
                )
                db.session.add(project)
            
            db.session.commit()
            return True
            
        except Exception as e:
            db.session.rollback()
            print(f"Ошибка сохранения законопроекта: {e}")
            return False
    
    def get_law_project(self, project_id: str) -> Optional[Dict]:
        """Получение законопроекта по ID"""
        project = LawProject.query.filter_by(project_id=project_id).first()
        return project.to_dict() if project else None
    
    def get_law_projects_list(self, status: str = None, limit: int = 50) -> List[Dict]:
        """Получение списка законопроектов"""
        query = LawProject.query
        
        if status:
            query = query.filter_by(status=status)
        
        projects = query.order_by(LawProject.generation_date.desc()).limit(limit).all()
        return [project.to_dict() for project in projects]
    
    def save_generation_session(self, session_id: str, current_step: int = 1, 
                              collected_data: Dict = None, validation_results: Dict = None) -> bool:
        """Сохранение сессии генерации"""
        try:
            # Проверяем существование сессии
            existing = LawGenerationSession.query.filter_by(session_id=session_id).first()
            
            if existing:
                # Обновляем существующую
                existing.current_step = current_step
                if collected_data:
                    existing.collected_data = json.dumps(collected_data, ensure_ascii=False)
                if validation_results:
                    existing.validation_results = json.dumps(validation_results, ensure_ascii=False)
                existing.updated_at = datetime.utcnow()
            else:
                # Создаем новую
                session = LawGenerationSession(
                    session_id=session_id,
                    current_step=current_step,
                    collected_data=json.dumps(collected_data, ensure_ascii=False) if collected_data else None,
                    validation_results=json.dumps(validation_results, ensure_ascii=False) if validation_results else None
                )
                db.session.add(session)
            
            db.session.commit()
            return True
            
        except Exception as e:
            db.session.rollback()
            print(f"Ошибка сохранения сессии генерации: {e}")
            return False
    
    def get_generation_session(self, session_id: str) -> Optional[Dict]:
        """Получение сессии генерации"""
        session = LawGenerationSession.query.filter_by(session_id=session_id).first()
        return session.to_dict() if session else None
    
    def get_law_projects_stats(self) -> Dict:
        """Получение статистики по законопроектам"""
        total_projects = LawProject.query.count()
        recent_projects = LawProject.query.filter(
            LawProject.generation_date >= datetime.utcnow().replace(day=1)
        ).count()
        
        return {
            'total_projects': total_projects,
            'recent_projects': recent_projects
        } 