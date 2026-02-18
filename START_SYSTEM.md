# 🚀 Инструкция по запуску системы Law RAG

## Быстрый старт

### Вариант 1: Автоматический запуск (рекомендуется)

```bash
cd /home/kaznu2025/law_rag
chmod +x start_system.sh stop_system.sh
./start_system.sh
```

Скрипт автоматически:
- ✅ Проверит виртуальное окружение
- ✅ Установит зависимости при необходимости
- ✅ Запустит Fine-tuned API сервер (если доступен)
- ✅ Запустит Flask приложение

### Вариант 2: Ручной запуск

#### 1. Активация виртуального окружения

```bash
cd /home/kaznu2025/law_rag
source venv/bin/activate
```

#### 2. Установка зависимостей (если еще не установлены)

```bash
pip install -r requirements.txt
```

#### 3. Запуск Fine-tuned API сервера (опционально)

Если у вас есть fine-tuned модель:

```bash
cd /home/kaznu2025/fine_tune_llm_2222
./api_manager.sh start
```

Проверка статуса:
```bash
./api_manager.sh status
curl http://localhost:8000/health
```

#### 4. Запуск Flask приложения

```bash
cd /home/kaznu2025/law_rag
python app.py
```

## Доступ к системе

После запуска система будет доступна по адресам:

- **Главная страница**: http://localhost:5003
- **RAG чат** (с поиском по документам): http://localhost:5003/chat
- **Простой чат** (с fine-tuned моделью): http://localhost:5003/chat-simple
- **Админ панель**: http://localhost:5003/admin

## Остановка системы

### Автоматическая остановка

```bash
cd /home/kaznu2025/law_rag
./stop_system.sh
```

### Ручная остановка

1. Остановите Flask приложение: нажмите `Ctrl+C` в терминале где запущено приложение
2. Остановите Fine-tuned API сервер:
   ```bash
   cd /home/kaznu2025/fine_tune_llm_2222
   ./api_manager.sh stop
   ```

## Проверка работы

### Проверка Flask приложения

```bash
curl http://localhost:5003/api/admin/stats
```

### Проверка Fine-tuned API

```bash
curl http://localhost:8000/health
```

### Тест простого чата с fine-tuned моделью

```bash
curl -X POST "http://localhost:5003/api/chat" \
  -H "Content-Type: application/json" \
  -d '{"query": "Что такое недоимка?", "use_rag": false}'
```

## Настройка провайдеров LLM

### OpenAI

Создайте `.env` файл:
```bash
LLM_PROVIDER_TYPE=openai
OPENAI_API_KEY=your-api-key-here
LLM_MODEL=gpt-4o
```

### Ollama

Создайте `.env` файл:
```bash
LLM_PROVIDER_TYPE=ollama
LLM_MODEL=gpt-oss:20b
OLLAMA_BASE_URL=http://localhost:11434
```

### Fine-tuned модель

Создайте `.env` файл:
```bash
FINETUNED_API_URL=http://localhost:8000
```

Или настройте через админ панель: http://localhost:5003/admin

## Режимы работы

### 1. RAG чат (`/chat`)

- Использует поиск по документам
- Находит релевантные фрагменты из базы документов
- Использует обычные LLM провайдеры (OpenAI/Ollama)
- Показывает источники ответов

### 2. Простой чат (`/chat-simple`)

- **Приоритет**: Fine-tuned модель (если доступна)
- **Fallback**: Обычные LLM провайдеры (Ollama/OpenAI)
- Работает без поиска по документам
- Использует знания модели

## Устранение проблем

### Flask приложение не запускается

1. Проверьте виртуальное окружение:
   ```bash
   source venv/bin/activate
   ```

2. Установите зависимости:
   ```bash
   pip install -r requirements.txt
   ```

3. Проверьте порт:
   ```bash
   lsof -i :5003
   ```

### Fine-tuned API не запускается

1. Проверьте логи:
   ```bash
   cd /home/kaznu2025/fine_tune_llm_2222
   tail -f api_server.log
   ```

2. Проверьте наличие модели:
   ```bash
   ls -la final_model_gemma3n_4b/
   ```

3. Проверьте GPU:
   ```bash
   nvidia-smi
   ```

### Простой чат не использует fine-tuned модель

1. Проверьте доступность API:
   ```bash
   curl http://localhost:8000/health
   ```

2. Проверьте логи Flask приложения на наличие ошибок

3. Убедитесь, что `FINETUNED_API_URL` настроен правильно в `.env` или админ панели

## Автозапуск при загрузке системы

### Fine-tuned API сервер (systemd)

```bash
cd /home/kaznu2025/fine_tune_llm_2222
sudo ./api_manager.sh install-systemd
sudo systemctl enable gemma-api
sudo systemctl start gemma-api
```

### Flask приложение (systemd)

Создайте файл `/etc/systemd/system/law-rag.service`:

```ini
[Unit]
Description=Law RAG Flask Application
After=network.target

[Service]
Type=simple
User=your_username
WorkingDirectory=/home/kaznu2025/law_rag
Environment="PATH=/home/kaznu2025/law_rag/venv/bin"
ExecStart=/home/kaznu2025/law_rag/venv/bin/python app.py
Restart=always

[Install]
WantedBy=multi-user.target
```

Активируйте:
```bash
sudo systemctl enable law-rag
sudo systemctl start law-rag
```

## Мониторинг

### Логи Flask приложения

Логи выводятся в консоль при запуске `python app.py`

### Логи Fine-tuned API

```bash
cd /home/kaznu2025/fine_tune_llm_2222
tail -f api_server.log
```

### Статус системы

```bash
# Flask приложение
curl http://localhost:5003/api/admin/stats

# Fine-tuned API
cd /home/kaznu2025/fine_tune_llm_2222
./api_manager.sh status
```

## Производительность

- **RAG чат**: Зависит от LLM провайдера и размера базы документов
- **Простой чат с fine-tuned**: ~2-5 секунд на ответ (зависит от GPU)
- **Простой чат без fine-tuned**: Зависит от LLM провайдера

## Безопасность

⚠️ **Важно**: Это development сервер. Для production используйте:
- Gunicorn или uWSGI для Flask
- Nginx как reverse proxy
- HTTPS
- Firewall правила

