# Инструкция по развертыванию на сервере

## Подготовка к развертыванию

### 1. Подготовка документов

В репозитории уже включены примеры документов в `current/examples/`. Для продакшена:

**Вариант А: Использовать примеры (для тестирования)**
- Примеры уже включены в git
- Достаточно для демонстрации работы системы

**Вариант Б: Загрузить полный корпус документов**
```bash
# На сервере скопируйте документы в current/
scp -r /path/to/documents/* user@server:/path/to/app/current/

# Или используйте админ-панель для загрузки
```

### 2. Настройка переменных окружения

Скопируйте `env.example` в `.env` и заполните:

```bash
cp env.example .env
nano .env
```

Обязательные настройки:
- `LLM_PROVIDER_TYPE` - тип провайдера (openai/ollama)
- `LLM_MODEL` - модель для использования
- `OPENAI_API_KEY` - если используете OpenAI
- `OLLAMA_BASE_URL` - если используете Ollama

### 3. Установка зависимостей

```bash
# Создайте виртуальное окружение
python3 -m venv venv
source venv/bin/activate  # Linux/Mac
# или
venv\Scripts\activate  # Windows

# Установите зависимости
pip install -r requirements.txt
```

### 4. Инициализация базы данных

База данных создастся автоматически при первом запуске, но можно инициализировать вручную:

```bash
python -c "from database.models import DatabaseManager, db; from app import app; app.app_context().push(); db.create_all()"
```

### 5. Обработка документов

После запуска приложения:

1. Откройте админ-панель: `http://your-server:5003/admin`
2. Нажмите "Автоматическая настройка" или "Обработать все документы"
3. Дождитесь завершения обработки (создание embeddings)

Или через API:
```bash
curl -X POST http://localhost:5003/api/admin/auto_setup
```

### 6. Запуск приложения

**Разработка:**
```bash
python app.py
```

**Продакшен (с Gunicorn):**
```bash
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5003 app:app
```

**С systemd (Linux):**
Создайте файл `/etc/systemd/system/law-rag.service`:
```ini
[Unit]
Description=Law RAG System
After=network.target

[Service]
User=www-data
WorkingDirectory=/path/to/law_rag
Environment="PATH=/path/to/law_rag/venv/bin"
ExecStart=/path/to/law_rag/venv/bin/gunicorn -w 4 -b 0.0.0.0:5003 app:app

[Install]
WantedBy=multi-user.target
```

Затем:
```bash
sudo systemctl enable law-rag
sudo systemctl start law-rag
```

## Структура файлов в git

В git включены:
- ✅ Весь код приложения
- ✅ Примеры документов в `current/examples/`
- ✅ Конфигурационные файлы (env.example, requirements.txt)
- ✅ Документация

Исключены из git:
- ❌ Основная директория `current/` (кроме examples)
- ❌ База данных `database/*.db`
- ❌ Файлы `.env` с секретами
- ❌ Кэш и временные файлы

## Проверка развертывания

1. **Проверка статуса:**
```bash
curl http://localhost:5003/api/stats
```

2. **Проверка LLM провайдера:**
```bash
curl http://localhost:5003/api/settings/llm
```

3. **Тест чата:**
Откройте `http://your-server:5003/chat` и задайте вопрос

## Обновление документов

Для обновления документов на сервере:

1. Загрузите новые документы в `current/`
2. Откройте админ-панель `/admin`
3. Нажмите "Обработать все документы" или "Обновить embeddings"

## Резервное копирование

Важные данные для бэкапа:
- `database/law_database.db` - база данных с документами и embeddings
- `current/` - исходные документы
- `.env` - конфигурация

```bash
# Создание бэкапа
tar -czf backup-$(date +%Y%m%d).tar.gz database/ current/ .env
```

## Troubleshooting

**Проблема: Документы не обрабатываются**
- Проверьте права доступа к директории `current/`
- Убедитесь, что есть свободное место на диске
- Проверьте логи приложения

**Проблема: LLM не работает**
- Проверьте настройки в `.env`
- Для OpenAI: проверьте API ключ и баланс
- Для Ollama: убедитесь, что сервер запущен

**Проблема: Медленная работа**
- Увеличьте количество workers в Gunicorn
- Используйте более мощную модель для embeddings
- Рассмотрите использование GPU для Ollama

