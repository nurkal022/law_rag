import numpy as np
import sqlite3
from typing import List, Dict, Tuple
from sklearn.metrics.pairwise import cosine_similarity
from sentence_transformers import SentenceTransformer
from database.models import DatabaseManager
from config import Config

class DocumentRetriever:
    def __init__(self, db_manager: DatabaseManager):
        self.db_manager = db_manager
        self.embedding_model = None
        self._chunks_cache = None
        self._embeddings_cache = None
        
        # Пытаемся загрузить модель embeddings
        try:
            self.embedding_model = SentenceTransformer(Config.EMBEDDING_MODEL)
            print(f"✅ Retriever: Модель загружена {Config.EMBEDDING_MODEL}")
        except Exception as e:
            try:
                self.embedding_model = SentenceTransformer(Config.EMBEDDING_MODEL_OFFLINE)
                print(f"✅ Retriever: Альтернативная модель загружена {Config.EMBEDDING_MODEL_OFFLINE}")
            except Exception as e2:
                print(f"⚠️  Retriever: Работаем без семантического поиска")
                self.embedding_model = None
        
    def _load_chunks_and_embeddings(self) -> bool:
        """Загрузка всех чанков и embeddings в память для быстрого поиска"""
        try:
            chunks = self.db_manager.get_all_chunks_with_embeddings()
            
            if not chunks:
                print("Нет чанков с embeddings в базе данных")
                return False
            
            # Разделяем данные и embeddings
            self._chunks_cache = []
            embeddings_list = []
            
            for chunk in chunks:
                if chunk['embedding'] is not None:
                    self._chunks_cache.append({
                        'id': chunk['id'],
                        'content': chunk['content'],
                        'filename': chunk.get('document_filename') or chunk.get('filename', 'unknown.txt'),
                        'title': chunk.get('document_title') or chunk.get('title', 'Неизвестный документ'),
                        'chunk_index': chunk['chunk_index'],
                        'start_position': chunk['start_position'],
                        'end_position': chunk['end_position']
                    })
                    embeddings_list.append(chunk['embedding'])
            
            if embeddings_list:
                self._embeddings_cache = np.array(embeddings_list)
                print(f"Загружено {len(self._chunks_cache)} чанков с embeddings")
                return True
            else:
                print("Не найдено валидных embeddings")
                return False
                
        except Exception as e:
            print(f"Ошибка при загрузке чанков: {e}")
            return False
    
    def _load_chunks_for_keyword_search(self):
        """Загрузка чанков для поиска по ключевым словам (без embeddings)"""
        try:
            chunks = self.db_manager.get_all_chunks()
            
            if not chunks:
                print("Нет чанков в базе данных")
                self._chunks_cache = []
                return
            
            self._chunks_cache = []
            for chunk in chunks:
                self._chunks_cache.append({
                    'id': chunk['id'],
                    'content': chunk['content'],
                    'filename': chunk.get('document_filename') or chunk.get('filename', 'unknown.txt'),
                    'title': chunk.get('document_title') or chunk.get('title', 'Неизвестный документ'),
                    'chunk_index': chunk['chunk_index'],
                    'start_position': chunk['start_position'],
                    'end_position': chunk['end_position']
                })
                
            print(f"Загружено {len(self._chunks_cache)} чанков для поиска по ключевым словам")
                
        except Exception as e:
            print(f"Ошибка при загрузке чанков: {e}")
            self._chunks_cache = []

    def refresh_cache(self):
        """Обновление кэша чанков и embeddings"""
        self._chunks_cache = None
        self._embeddings_cache = None
        if self.embedding_model:
            self._load_chunks_and_embeddings()
        else:
            self._load_chunks_for_keyword_search()
    
    def search_similar_chunks(self, query: str, top_k: int = None) -> List[Dict]:
        """Поиск наиболее релевантных чанков для запроса"""
        top_k = top_k or Config.TOP_K_RESULTS
        
        if not self.embedding_model:
            print("⚠️  Семантический поиск недоступен, используем поиск по ключевым словам")
            return self.search_by_keywords(query, top_k)
        
        # Загружаем кэш если нужно
        if self._chunks_cache is None or self._embeddings_cache is None:
            if not self._load_chunks_and_embeddings():
                return []
        
        if len(self._chunks_cache) == 0:
            return []
        
        try:
            # Создаем embedding для запроса
            query_embedding = self.embedding_model.encode([query], convert_to_tensor=False)
            query_embedding = np.array(query_embedding)
            
            # Вычисляем сходство с помощью косинусного расстояния
            similarities = cosine_similarity(query_embedding, self._embeddings_cache)[0]
            
            # Получаем индексы топ-k наиболее похожих чанков
            top_indices = np.argsort(similarities)[::-1][:top_k]
            
            # Формируем результат
            results = []
            for idx in top_indices:
                chunk = self._chunks_cache[idx].copy()
                chunk['similarity_score'] = float(similarities[idx])
                results.append(chunk)
            
            # Фильтруем результаты с низким сходством (< 0.3)
            results = [r for r in results if r['similarity_score'] > 0.3]
            
            return results
            
        except Exception as e:
            print(f"Ошибка при поиске: {e}")
            return []
    
    def search_by_keywords(self, query: str, top_k: int = None) -> List[Dict]:
        """Дополнительный поиск по ключевым словам (для улучшения точности)"""
        top_k = top_k or Config.TOP_K_RESULTS
        
        # Для поиска по ключевым словам нам нужны только чанки, не embeddings
        if self._chunks_cache is None:
            self._load_chunks_for_keyword_search()
        
        query_words = set(query.lower().split())
        
        results = []
        for chunk in self._chunks_cache:
            content_words = set(chunk['content'].lower().split())
            
            # Подсчитываем пересечение слов
            intersection = query_words.intersection(content_words)
            if intersection:
                score = len(intersection) / len(query_words)
                chunk_copy = chunk.copy()
                chunk_copy['keyword_score'] = score
                chunk_copy['matched_words'] = list(intersection)
                results.append(chunk_copy)
        
        # Сортируем по количеству совпадений
        results = sorted(results, key=lambda x: x['keyword_score'], reverse=True)
        
        return results[:top_k]
    
    def hybrid_search(self, query: str, top_k: int = None) -> List[Dict]:
        """Гибридный поиск: комбинация семантического поиска и поиска по ключевым словам"""
        top_k = top_k or Config.TOP_K_RESULTS
        
        if not self.embedding_model:
            # Если модель недоступна, используем только поиск по ключевым словам
            print("⚠️  Используем только поиск по ключевым словам")
            return self.search_by_keywords(query, top_k)
        
        # Семантический поиск
        semantic_results = self.search_similar_chunks(query, top_k * 2)
        
        # Поиск по ключевым словам
        keyword_results = self.search_by_keywords(query, top_k)
        
        # Объединяем результаты и удаляем дубликаты
        combined_results = {}
        
        # Добавляем семантические результаты
        for result in semantic_results:
            chunk_id = result['id']
            combined_results[chunk_id] = result
            combined_results[chunk_id]['final_score'] = result['similarity_score']
        
        # Добавляем результаты по ключевым словам
        for result in keyword_results:
            chunk_id = result['id']
            if chunk_id in combined_results:
                # Если чанк уже есть, улучшаем его оценку
                combined_results[chunk_id]['final_score'] += result['keyword_score'] * 0.3
                combined_results[chunk_id]['matched_words'] = result.get('matched_words', [])
            else:
                # Добавляем новый чанк только по ключевым словам
                result['final_score'] = result['keyword_score'] * 0.5
                combined_results[chunk_id] = result
        
        # Сортируем по финальной оценке
        final_results = list(combined_results.values())
        final_results = sorted(final_results, key=lambda x: x['final_score'], reverse=True)
        
        return final_results[:top_k]
    
    def get_document_context(self, chunk_id: int, context_size: int = 2) -> Dict:
        """Получение контекста вокруг найденного чанка (соседние чанки)"""
        try:
            # Получаем информацию о чанке
            chunk = self.db_manager.get_chunk_by_id(chunk_id)
            if not chunk:
                return {}
            
            # Получаем соседние чанки из того же документа
            with sqlite3.connect(self.db_manager.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT chunk_index, content, start_position, end_position
                    FROM document_chunks 
                    WHERE document_id = ? 
                    AND chunk_index BETWEEN ? AND ?
                    ORDER BY chunk_index
                ''', (
                    chunk['document_id'], 
                    max(0, chunk['chunk_index'] - context_size),
                    chunk['chunk_index'] + context_size
                ))
                
                context_chunks = cursor.fetchall()
                
                return {
                    'main_chunk': chunk,
                    'context_chunks': [
                        {
                            'chunk_index': row[0],
                            'content': row[1],
                            'start_position': row[2],
                            'end_position': row[3]
                        }
                        for row in context_chunks
                    ]
                }
                
        except Exception as e:
            print(f"Ошибка при получении контекста: {e}")
            return {}
    
    def format_search_results(self, results: List[Dict]) -> List[Dict]:
        """Форматирование результатов поиска для удобного отображения"""
        formatted_results = []
        
        for result in results:
            # Обрезаем длинный контент для предварительного просмотра
            preview = result['content'][:300] + "..." if len(result['content']) > 300 else result['content']
            
            # Безопасно получаем позиции
            start_pos = result.get('start_position', 0)
            end_pos = result.get('end_position', len(result.get('content', '')))
            chunk_index = result.get('chunk_index', 0)
            
            formatted_result = {
                'chunk_id': result['id'],
                'title': result.get('title', 'Неизвестный документ'),
                'filename': result.get('filename', 'unknown.txt'),
                'preview': preview,
                'full_content': result['content'],
                'similarity_score': result.get('similarity_score', 0),
                'keyword_score': result.get('keyword_score', 0),
                'final_score': result.get('final_score', 0),
                'matched_words': result.get('matched_words', []),
                'chunk_position': f"Чанк {chunk_index} ({start_pos}-{end_pos})",
                'start_position': start_pos,
                'end_position': end_pos,
                'chunk_index': chunk_index,
                'source_reference': {
                    'document': result.get('title', 'Неизвестный документ'),
                    'filename': result.get('filename', 'unknown.txt'),
                    'position': f"позиция {start_pos}-{end_pos}",
                    'chunk_index': chunk_index
                }
            }
            
            formatted_results.append(formatted_result)
        
        return formatted_results 