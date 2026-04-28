FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    HF_HOME=/app/.cache/huggingface \
    SENTENCE_TRANSFORMERS_HOME=/app/.cache/sentence_transformers

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        libpq-dev \
        poppler-utils \
        curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --upgrade pip \
    && pip install --index-url https://download.pytorch.org/whl/cpu torch==2.7.0 torchvision==0.22.0 \
    && pip install -r requirements.txt

COPY . .

RUN mkdir -p exports docs database/backups .cache/huggingface .cache/sentence_transformers

# NLTK данные на этапе build, чтобы рантайм не делал сетевые вызовы
RUN python -m nltk.downloader -d /usr/local/share/nltk_data \
        punkt punkt_tab stopwords averaged_perceptron_tagger || true
ENV NLTK_DATA=/usr/local/share/nltk_data

EXPOSE 5003

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -fsS http://localhost:5003/healthz || exit 1

CMD ["gunicorn", \
     "--bind", "0.0.0.0:5003", \
     "--workers", "2", \
     "--worker-class", "sync", \
     "--timeout", "300", \
     "--graceful-timeout", "30", \
     "--keep-alive", "5", \
     "--max-requests", "500", \
     "--max-requests-jitter", "50", \
     "--access-logfile", "-", \
     "--error-logfile", "-", \
     "app:app"]
