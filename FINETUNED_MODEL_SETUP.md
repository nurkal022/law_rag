# Интеграция Fine-tuned модели в простой чат

## Описание

Fine-tuned модель Gemma 3N 4B, обученная на юридических документах РК, интегрирована в режим простого чата (`/chat-simple`).

## Быстрый старт

### 1. Запуск API сервера fine-tuned модели

```bash
cd /home/kaznu2025/fine_tune_llm_2222
./api_manager.sh start
```

Проверка статуса:
```bash
./api_manager.sh status
```

Проверка здоровья API:
```bash
curl http://localhost:8000/health
```

### 2. Использование в простом чате

1. Откройте простой чат: http://localhost:5003/chat-simple
2. Задайте вопрос
3. Система автоматически использует fine-tuned модель если API доступен
4. Если API недоступен, используется fallback на обычный провайдер (Ollama/OpenAI)

## Настройка

### URL API сервера

По умолчанию используется `http://localhost:8000`. 

Для изменения создайте/отредактируйте `.env`:

```bash
FINETUNED_API_URL=http://localhost:8000
```

### Автозапуск API сервера (systemd)

```bash
cd /home/kaznu2025/fine_tune_llm_2222
sudo ./api_manager.sh install-systemd
sudo systemctl start gemma-api
sudo systemctl enable gemma-api
```

## Как это работает

1. **Простой чат** (`/chat-simple`) автоматически пытается использовать fine-tuned модель
2. Если API доступен и модель загружена → используется fine-tuned модель
3. Если API недоступен → fallback на обычный провайдер (Ollama/OpenAI)
4. Пользователь видит индикацию какой модели используется

## Проверка работы

### Тест API напрямую

```bash
curl -X POST "http://localhost:8000/ask" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Что такое недоимка согласно Налоговому кодексу РК?",
    "max_tokens": 512,
    "temperature": 0.75
  }'
```

### Тест через простой чат

1. Откройте http://localhost:5003/chat-simple
2. Задайте вопрос
3. Проверьте, что ответ приходит от fine-tuned модели

## Устранение проблем

### API сервер не запускается

```bash
cd /home/kaznu2025/fine_tune_llm_2222
./api_manager.sh logs
```

### Модель не загружается

Проверьте наличие модели:
```bash
ls -la /home/kaznu2025/fine_tune_llm_2222/final_model_gemma3n_4b/
```

### Порт 8000 занят

Измените порт в `api_server.py` или используйте другой порт и обновите `FINETUNED_API_URL` в `.env`.

### Fallback на обычный провайдер

Если fine-tuned модель недоступна, система автоматически использует:
- Ollama (если настроена)
- OpenAI (если настроена)

## Особенности

- Fine-tuned модель работает только в простом чате (`/chat-simple`)
- RAG чат (`/chat`) использует обычные провайдеры
- Fine-tuned модель не поддерживает историю диалога (каждый запрос независим)
- Автоматический fallback при недоступности API

