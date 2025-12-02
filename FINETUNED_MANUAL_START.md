# Ручной запуск Fine-tuned модели

## Проблема: Требуется авторизация HuggingFace

Модель `google/gemma-3-4b-it` является закрытой (gated) и требует авторизации.

## Шаг 1: Получение доступа к модели

1. Перейдите на https://huggingface.co/google/gemma-3-4b-it
2. Нажмите "Access repository" и примите лицензию
3. Дождитесь одобрения (обычно мгновенно)

## Шаг 2: Создание токена HuggingFace

1. Перейдите на https://huggingface.co/settings/tokens
2. Создайте новый токен с правами "Read"
3. Скопируйте токен

## Шаг 3: Авторизация в терминале

```bash
cd /home/kaznu2025/PycharmProjects/llm-law/fine_tune_llm_2222
source venv/bin/activate

# Вариант 1: Через huggingface-cli
pip install huggingface_hub
huggingface-cli login
# Вставьте ваш токен

# Вариант 2: Через переменную окружения
export HF_TOKEN="ваш_токен_здесь"
```

## Шаг 4: Запуск API сервера

```bash
cd /home/kaznu2025/PycharmProjects/llm-law/fine_tune_llm_2222
source venv/bin/activate
./api_manager.sh start
```

Или напрямую:

```bash
cd /home/kaznu2025/PycharmProjects/llm-law/fine_tune_llm_2222
source venv/bin/activate
python api_server.py
```

## Шаг 5: Проверка

```bash
curl http://localhost:8000/health
```

Должен вернуть: `{"status":"healthy",...}`

## Альтернатива: Использовать только Ollama

Если не хотите настраивать Fine-tuned модель, система работает с Ollama:

1. В `/admin` выберите провайдер "Ollama"
2. Модель `gpt-oss:20b` уже настроена
3. Чат с поиском по документам работает через Ollama

## Проверка логов

```bash
cat /home/kaznu2025/PycharmProjects/llm-law/fine_tune_llm_2222/api_server.log
```

## Остановка сервера

```bash
cd /home/kaznu2025/PycharmProjects/llm-law/fine_tune_llm_2222
./api_manager.sh stop
```

