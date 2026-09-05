"""
Клиент к централизованному embeddings-сервису (OpenAI-совместимый, BGE-M3).

Заменяет локальный SentenceTransformer: тот же интерфейс `.encode()`, но векторы
считаются на сервере с GPU (модель bge-m3, размерность 1024). Дополнительно
поддерживает `/v1/rerank` для переупорядочивания кандидатов по релевантности.

Важно: индексация и поиск должны идти ОДНОЙ моделью (bge-m3) — не меняйте её
после индексации корпуса, иначе всё нужно переиндексировать.
"""
import numpy as np
import requests
from typing import List, Union
from config import Config


class EmbeddingClient:
    """Тонкий клиент к OpenAI-совместимому эндпоинту эмбеддингов (vLLM/BGE-M3)."""

    # Жёсткий лимит символов на один вход. BGE-M3 принимает до 8192 токенов;
    # для кириллицы это ~12K символов с запасом. Аномально длинные чанки
    # (битая разбивка) обрезаются, чтобы сервис не отвечал 400.
    MAX_INPUT_CHARS = 12000

    def __init__(self, base_url: str = None, api_key: str = None,
                 model: str = None, rerank_model: str = None):
        self.base_url = (base_url or Config.EMBEDDING_BASE_URL).rstrip('/')
        self.api_key = api_key or Config.EMBEDDING_API_KEY or 'not-needed'
        self.model = model or Config.EMBEDDING_MODEL
        self.rerank_model = rerank_model or Config.EMBEDDING_RERANK_MODEL
        self._headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {self.api_key}',
        }

    def _clip(self, text: str) -> str:
        if len(text) > self.MAX_INPUT_CHARS:
            return text[:self.MAX_INPUT_CHARS]
        return text

    def encode(self, texts: Union[str, List[str]], convert_to_tensor: bool = False,
               show_progress_bar: bool = False, **kwargs) -> np.ndarray:
        """
        Создаёт эмбеддинги. Совместимо по сигнатуре с SentenceTransformer.encode():
          - строка на входе → одномерный вектор (np.ndarray shape [dim])
          - список строк → матрица (np.ndarray shape [n, dim])
        Аргументы convert_to_tensor/show_progress_bar принимаются для совместимости
        и игнорируются (вычисление идёт на сервере).
        """
        single = isinstance(texts, str)
        inputs = [texts] if single else list(texts)
        if not inputs:
            return np.array([])
        inputs = [self._clip(t) for t in inputs]

        # Батчим, чтобы не упереться в лимиты запроса на больших корпусах
        batch_size = 64
        vectors: List[List[float]] = []
        for i in range(0, len(inputs), batch_size):
            batch = inputs[i:i + batch_size]
            resp = requests.post(
                f"{self.base_url}/embeddings",
                headers=self._headers,
                json={"model": self.model, "input": batch},
                timeout=120,
            )
            resp.raise_for_status()
            data = resp.json()
            # vLLM сохраняет порядок, но сортируем по index на всякий случай
            items = sorted(data["data"], key=lambda d: d["index"])
            vectors.extend(item["embedding"] for item in items)

        arr = np.array(vectors, dtype=np.float32)
        return arr[0] if single else arr

    def rerank(self, query: str, documents: List[str], top_n: int = None) -> List[dict]:
        """
        Переупорядочивает документы по релевантности к запросу через /v1/rerank.

        Returns:
            Список dict'ов [{'index': int, 'relevance_score': float}, ...],
            отсортированный по убыванию релевантности. При ошибке/недоступности —
            пустой список (вызывающий код должен сделать fallback на исходный порядок).
        """
        if not documents:
            return []
        documents = [self._clip(d) for d in documents]
        payload = {"model": self.rerank_model, "query": self._clip(query), "documents": documents}
        if top_n is not None:
            payload["top_n"] = top_n
        try:
            resp = requests.post(
                f"{self.base_url}/rerank",
                headers=self._headers,
                json=payload,
                timeout=60,
            )
            resp.raise_for_status()
            results = resp.json().get("results", [])
            return [
                {"index": r["index"], "relevance_score": r.get("relevance_score", 0.0)}
                for r in sorted(results, key=lambda r: r.get("relevance_score", 0.0), reverse=True)
            ]
        except Exception as e:
            print(f"⚠️  Rerank недоступен ({e}); используем исходный порядок")
            return []

    def is_available(self) -> bool:
        """Проверяет доступность сервиса эмбеддингов."""
        try:
            resp = requests.get(f"{self.base_url}/models", headers=self._headers, timeout=5)
            return resp.status_code == 200
        except Exception:
            return False
