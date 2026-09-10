import numpy as np
from typing import List, Dict, Tuple
from database.models import DatabaseManager
from config import Config
from embeddings.client import EmbeddingClient

def active_chunks():
    """Фрагменты действующих актов: утративший силу документ в поиске не участвует."""
    from database.models import Document, DocumentChunk, db
    return db.session.query(DocumentChunk).join(Document).filter(Document.retired_at.is_(None))


class DocumentRetriever:
    def __init__(self, db_manager: DatabaseManager):
        self.db_manager = db_manager

        # Эмбеддинги и rerank — на централизованном сервисе (BGE-M3)
        self.embedding_model = EmbeddingClient()
        if self.embedding_model.is_available():
            print(f"✅ Retriever: сервис эмбеддингов доступен {Config.EMBEDDING_MODEL} @ {Config.EMBEDDING_BASE_URL}")
        else:
            print(f"⚠️  Retriever: сервис эмбеддингов недоступен {Config.EMBEDDING_BASE_URL}")

    def search_similar_chunks(self, query: str, top_k: int = 5) -> List[Dict]:
        """Семантический поиск с использованием pgvector"""
        if not self.embedding_model:
            return []

        try:
            query_embedding = self.embedding_model.encode(query).tolist()

            from database.models import DocumentChunk, Document, db

            results = active_chunks().filter(
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
        """Поиск по словам запроса — полнотекстовый, с русской морфологией.

        Всю нормализацию делает словарь PostgreSQL: приводит словоформы к
        основе («беременную» и «беременными» → «беремен»), отбрасывает знаки
        препинания и служебные слова («ли», «с», «можно»).

        Раньше здесь сравнивались строки: запрос делился по пробелам и слова
        искались как есть. На вопросе «Можно ли уволить беременную женщину?»
        это давало статьи Земельного кодекса по слову «можно», а нужную норму
        Трудового кодекса не находило вовсе — и мусор вытеснял из контекста
        настоящие статьи. Семантический поиск такие вопросы тоже не спасал:
        нужная статья не попадала даже в первую полусотню, потому что весь
        её текст сводится к одному вектору, и одна норма в длинной статье в
        нём растворяется. Поиск по словам берёт ровно этот случай на себя.
        """
        top_k = top_k or Config.TOP_K_RESULTS

        try:
            from database.models import db

            # Термы запроса объединяются через OR: требовать все слова сразу
            # бессмысленно — формулировка вопроса почти никогда не совпадает
            # с формулировкой нормы. Ранг тем выше, чем больше слов совпало.
            sql = db.text("""
                WITH q AS (
                    SELECT array_to_string(
                        tsvector_to_array(to_tsvector('russian', :query)), ' | '
                    )::tsquery AS tq
                )
                SELECT c.id, c.document_id, c.chunk_index, c.content,
                       c.start_position, c.end_position,
                       d.filename, d.title,
                       ts_rank(to_tsvector('russian', c.content), q.tq) AS rank
                FROM document_chunks c
                JOIN documents d ON d.id = c.document_id, q
                WHERE to_tsvector('russian', c.content) @@ q.tq AND d.retired_at IS NULL
                ORDER BY rank DESC
                LIMIT :limit
            """)
            rows = db.session.execute(sql, {'query': query, 'limit': top_k}).mappings().all()
        except Exception as e:
            # Поиск по словам дополняет семантический, а не заменяет его:
            # его отказ не должен ронять ответ целиком.
            print(f"Ошибка полнотекстового поиска: {e}")
            return []

        # ts_rank живёт в своём масштабе (сотые доли), а косинусная близость —
        # в своём (десятые). Смешивать их напрямую нельзя: найденное только по
        # словам осело бы в самом низу общего списка и до ответа не дошло.
        # Приводим к долям от лучшего совпадения — тогда обе оценки сравнимы.
        best = max((float(r['rank']) for r in rows), default=0.0)

        results = []
        for row in rows:
            content = row['content']
            results.append({
                'id': row['id'],
                'document_id': row['document_id'],
                'chunk_index': row['chunk_index'],
                'content': content,
                'full_content': content,
                'preview': content[:200] + '...' if len(content) > 200 else content,
                'start_position': row['start_position'],
                'end_position': row['end_position'],
                'filename': row['filename'],
                'title': row['title'],
                'keyword_score': float(row['rank']) / best if best else 0.0,
            })

        return results

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

        # Rerank: переупорядочиваем кандидатов кросс-энкодером BGE-M3 по
        # релевантности к запросу. Берём с запасом (до top_k*4), reranker
        # сам поднимает самые релевантные наверх. При недоступности — fallback
        # на исходный порядок по final_score.
        if Config.USE_RERANK and len(final_results) > 1:
            candidates = final_results[:top_k * 4]
            ranked = self.embedding_model.rerank(
                query, [c['content'] for c in candidates]
            )
            if ranked:
                reordered = []
                for r in ranked:
                    c = candidates[r['index']]
                    c['rerank_score'] = r['relevance_score']
                    reordered.append(c)
                final_results = reordered

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

    def hybrid_search_many(self, queries: List[str], top_k: int = None) -> List[Dict]:
        """Поиск по нескольким формулировкам одного вопроса с слиянием выдач.

        Исходный вопрос и его пересказы языком кодексов (см. rag/expand.py)
        ищутся по отдельности, а выдачи сливаются взаимными рангами (RRF):
        фрагмент, попавший в несколько выдач, поднимается выше, и масштаб
        оценок разных запросов не имеет значения. Для одного запроса — это
        обычный hybrid_search.
        """
        top_k = top_k or Config.TOP_K_RESULTS
        queries = list(dict.fromkeys(q.strip() for q in queries if q and q.strip()))
        if not queries:
            return []
        if len(queries) == 1:
            return self.hybrid_search(queries[0], top_k)[:top_k]

        best: Dict[int, Dict] = {}
        fused: Dict[int, float] = {}
        for q in queries:
            for rank, r in enumerate(self.hybrid_search(q, top_k), 1):
                cid = r['id']
                fused[cid] = fused.get(cid, 0.0) + 1.0 / (60 + rank)
                if cid not in best or r.get('final_score', 0) > best[cid].get('final_score', 0):
                    best[cid] = r
        # sorted стабилен: при равной сумме порядок — как фрагменты встретились впервые
        order = sorted(best, key=lambda cid: -fused[cid])
        return [best[cid] for cid in order[:top_k]]

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
