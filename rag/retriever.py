import numpy as np
import torch
from typing import List, Dict, Tuple
from sentence_transformers import SentenceTransformer
from database.models import DatabaseManager
from config import Config

class DocumentRetriever:
    def __init__(self, db_manager: DatabaseManager):
        self.db_manager = db_manager
        self.embedding_model = None
        self._chunks_cache = None
        self.device = self._get_device()

        # Пытаемся загрузить модель embeddings
        # Офлайн режим: используем только локальный кеш
        import os
        os.environ['HF_HUB_OFFLINE'] = '1'
        os.environ['TRANSFORMERS_OFFLINE'] = '1'

        try:
            self.embedding_model = SentenceTransformer(
                Config.EMBEDDING_MODEL,
                device=self.device,
                local_files_only=True  # Только локальные файлы
            )
            print(f"✅ Retriever: Модель загружена {Config.EMBEDDING_MODEL}")
            print(f"   📱 Устройство: {self.device}")
        except Exception as e:
            try:
                self.embedding_model = SentenceTransformer(
                    Config.EMBEDDING_MODEL_OFFLINE,
                    device=self.device,
                    local_files_only=True  # Только локальные файлы
                )
                print(f"✅ Retriever: Альтернативная модель загружена {Config.EMBEDDING_MODEL_OFFLINE}")
                print(f"   📱 Устройство: {self.device}")
            except Exception as e2:
                print(f"⚠️  Retriever: Работаем без семантического поиска")
                self.embedding_model = None

    def _get_device(self) -> str:
        """Определяет устройство для вычислений (CPU или GPU)"""
        use_gpu = Config.USE_GPU_FOR_EMBEDDINGS

        if use_gpu == 'false':
            return 'cpu'
        elif use_gpu == 'true' or use_gpu == 'auto':
            if torch.cuda.is_available():
                # Проверяем совместимость GPU с PyTorch
                try:
                    test_tensor = torch.zeros(1, device='cuda')
                    del test_tensor
                    return 'cuda'
                except RuntimeError as e:
                    if "no kernel image" in str(e) or "not compatible" in str(e):
                        print("⚠️  Retriever: GPU не совместим с PyTorch, используется CPU")
                        return 'cpu'
                    raise
            else:
                if use_gpu == 'true':
                    print("⚠️  Retriever: GPU запрошен, но недоступен. Используется CPU.")
                return 'cpu'
        else:
            return 'cpu'

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

    def search_similar_chunks(self, query: str, top_k: int = 5) -> List[Dict]:
        """Семантический поиск с использованием pgvector"""
        if not self.embedding_model:
            return []

        try:
            query_embedding = self.embedding_model.encode(query).tolist()

            from database.models import DocumentChunk, Document, db

            results = db.session.query(DocumentChunk).join(Document).filter(
                DocumentChunk.embedding.isnot(None)
            ).order_by(
                DocumentChunk.embedding.cosine_distance(query_embedding)
            ).limit(top_k).all()

            search_results = []
            for chunk in results:
                # Calculate similarity score (1 - cosine_distance)
                chunk_emb = chunk.get_embedding()
                if chunk_emb is not None:
                    query_np = np.array(query_embedding, dtype=np.float32)
                    similarity = np.dot(query_np, chunk_emb) / (np.linalg.norm(query_np) * np.linalg.norm(chunk_emb))
                else:
                    similarity = 0.0

                search_results.append({
                    'id': chunk.id,
                    'document_id': chunk.document_id,
                    'chunk_index': chunk.chunk_index,
                    'content': chunk.content,
                    'start_position': chunk.start_position,
                    'end_position': chunk.end_position,
                    'filename': chunk.document.filename if chunk.document else 'unknown',
                    'title': chunk.document.title if chunk.document else 'unknown',
                    'similarity_score': float(similarity),
                    'full_content': chunk.content,
                    'preview': chunk.content[:200] + '...' if len(chunk.content) > 200 else chunk.content
                })

            return search_results

        except Exception as e:
            print(f"Ошибка семантического поиска: {e}")
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

        # Семантический поиск (берём больше для дедупликации)
        semantic_results = self.search_similar_chunks(query, top_k * 3)

        # Поиск по ключевым словам
        keyword_results = self.search_by_keywords(query, top_k * 2)

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

        # Дедупликация: убираем перекрывающиеся чанки из одного документа
        deduplicated = []
        for result in final_results:
            is_duplicate = False
            doc_key = result.get('filename', '') or result.get('title', '')
            r_start = result.get('start_position', 0)
            r_end = result.get('end_position', 0)

            for kept in deduplicated:
                kept_key = kept.get('filename', '') or kept.get('title', '')
                if doc_key != kept_key:
                    continue
                k_start = kept.get('start_position', 0)
                k_end = kept.get('end_position', 0)
                # Проверяем перекрытие позиций (>50% overlap)
                overlap_start = max(r_start, k_start)
                overlap_end = min(r_end, k_end)
                overlap_len = max(0, overlap_end - overlap_start)
                min_chunk_len = min(r_end - r_start, k_end - k_start) or 1
                if overlap_len / min_chunk_len > 0.5:
                    is_duplicate = True
                    break

            if not is_duplicate:
                deduplicated.append(result)

        return deduplicated[:top_k]

    def get_document_context(self, chunk_id: int, context_size: int = 2) -> Dict:
        """Получение контекста вокруг найденного чанка (соседние чанки)"""
        try:
            chunk = self.db_manager.get_chunk_by_id(chunk_id)
            if not chunk:
                return {}

            from database.models import DocumentChunk, db

            context_chunks = db.session.query(DocumentChunk).filter(
                DocumentChunk.document_id == chunk['document_id'],
                DocumentChunk.chunk_index.between(
                    max(0, chunk['chunk_index'] - context_size),
                    chunk['chunk_index'] + context_size
                )
            ).order_by(DocumentChunk.chunk_index).all()

            return {
                'main_chunk': chunk,
                'context_chunks': [
                    {
                        'chunk_index': c.chunk_index,
                        'content': c.content,
                        'start_position': c.start_position,
                        'end_position': c.end_position
                    }
                    for c in context_chunks
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
