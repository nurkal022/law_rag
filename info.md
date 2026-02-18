# 🚀 Установка и управление API сервером

## Быстрая установка

### 1. Установка зависимостей

```bash
# Убедитесь, что виртуальное окружение активировано
source venv/bin/activate

# Установить зависимости API (fastapi, uvicorn)
pip install fastapi uvicorn pydantic requests

# Или обновить requirements.txt и установить все
pip install -r requirements.txt
```

### 2. Проверка модели

Убедитесь, что обученная модель находится в одном из мест:
- `./final_model_gemma3n_4b/`
- `./gemma3n-4b-kazakh-law-qlora/checkpoint-20275/`

---

## 📋 Управление API сервером

### Использование скрипта управления

```bash
# Запустить API сервер
./api_manager.sh start

# Остановить API сервер
./api_manager.sh stop

# Перезапустить API сервер
./api_manager.sh restart

# Проверить статус
./api_manager.sh status

# Просмотр логов в реальном времени
./api_manager.sh logs
```

### Ручной запуск (для тестирования)

```bash
./run_api_server.sh
```

---

## 🔧 Установка как systemd сервис (автозапуск)

### Шаг 1: Установка сервиса

```bash
sudo ./api_manager.sh install-systemd
```

### Шаг 2: Управление через systemctl

```bash
# Запустить сервис
sudo systemctl start gemma-api

# Остановить сервис
sudo systemctl stop gemma-api

# Перезапустить сервис
sudo systemctl restart gemma-api

# Проверить статус
sudo systemctl status gemma-api

# Включить автозапуск при загрузке системы
sudo systemctl enable gemma-api

# Отключить автозапуск
sudo systemctl disable gemma-api

# Просмотр логов
sudo journalctl -u gemma-api -f
```

### Настройка пользователя в systemd

Если нужно изменить пользователя в systemd сервисе:

1. Отредактируйте `gemma-api.service`:
   ```bash
   nano gemma-api.service
   ```

2. Замените `%i` на имя пользователя:
   ```
   User=ваш_пользователь
   Group=ваш_пользователь
   ```

3. Переустановите сервис:
   ```bash
   sudo ./api_manager.sh install-systemd
   ```

---

## 🌐 Использование API

### Проверка здоровья API

```bash
curl http://localhost:8000/health
```

### Задать вопрос

```bash
curl -X POST "http://localhost:8000/ask" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Что такое недоимка согласно Налоговому кодексу РК?",
    "max_tokens": 512,
    "temperature": 0.75
  }'
```

### Документация API

Откройте в браузере:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

---

## 🔌 Интеграция в ваш проект

### Python пример

```python
import requests

API_URL = "http://localhost:8000/ask"

def ask_question(question, max_tokens=512, temperature=0.75):
    response = requests.post(
        API_URL,
        json={
            "question": question,
            "max_tokens": max_tokens,
            "temperature": temperature
        }
    )
    return response.json()

# Использование
result = ask_question("Кто проводит налоговую проверку?")
print(result["answer"])
```

### JavaScript пример

```javascript
const API_URL = 'http://localhost:8000/ask';

async function askQuestion(question, maxTokens = 512) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      question: question,
      max_tokens: maxTokens,
      temperature: 0.75
    })
  });
  
  return await response.json();
}

// Использование
askQuestion('Как регулируется обращение взыскания на земельные участки?')
  .then(result => console.log(result.answer));
```

### PHP пример

```php
<?php
$apiUrl = 'http://localhost:8000/ask';

function askQuestion($question, $maxTokens = 512) {
    global $apiUrl;
    
    $data = [
        'question' => $question,
        'max_tokens' => $maxTokens,
        'temperature' => 0.75
    ];
    
    $ch = curl_init($apiUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json'
    ]);
    
    $response = curl_exec($ch);
    curl_close($ch);
    
    return json_decode($response, true);
}

// Использование
$result = askQuestion('Что такое недоимка?');
echo $result['answer'];
?>
```

---

## 🔒 Безопасность и production

### 1. Настройка firewall

```bash
# Разрешить доступ только с определенных IP
sudo ufw allow from YOUR_IP to any port 8000

# Или только локальный доступ
sudo ufw deny 8000
sudo ufw allow from 127.0.0.1 to any port 8000
```

### 2. Использование nginx как reverse proxy

Создайте `/etc/nginx/sites-available/gemma-api`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Таймауты для длинных запросов
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}
```

Активируйте:
```bash
sudo ln -s /etc/nginx/sites-available/gemma-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 3. Добавление аутентификации

Отредактируйте `api_server.py` и добавьте:

```python
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer()
API_TOKEN = "your-secret-token-here"

async def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if credentials.credentials != API_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    return credentials.credentials

@app.post("/ask", dependencies=[Depends(verify_token)])
async def ask_question(request: QuestionRequest):
    # ...
```

Использование:
```bash
curl -X POST "http://localhost:8000/ask" \
  -H "Authorization: Bearer your-secret-token-here" \
  -H "Content-Type: application/json" \
  -d '{"question": "Ваш вопрос"}'
```

---

## 📊 Мониторинг

### Проверка использования ресурсов

```bash
# CPU и память
./api_manager.sh status

# GPU использование
nvidia-smi

# Логи
./api_manager.sh logs
# или для systemd
sudo journalctl -u gemma-api -f
```

### Настройка лимитов ресурсов

В `gemma-api.service` раскомментируйте и настройте:

```ini
MemoryLimit=16G
CPUQuota=200%
```

---

## 🐛 Troubleshooting

### API сервер не запускается

1. Проверьте логи:
   ```bash
   ./api_manager.sh logs
   ```

2. Проверьте, что модель существует:
   ```bash
   ls -la final_model_gemma3n_4b/
   ```

3. Проверьте GPU:
   ```bash
   nvidia-smi
   ```

4. Проверьте порт:
   ```bash
   netstat -tuln | grep 8000
   ```

### Ошибка "CUDA out of memory"

1. Остановите другие процессы, использующие GPU
2. Уменьшите `max_tokens` в запросах
3. Перезапустите сервер

### Медленные ответы

1. Проверьте загрузку GPU: `nvidia-smi`
2. Убедитесь, что используется GPU, а не CPU
3. Уменьшите `max_tokens` в запросах

### Порт 8000 занят

Измените порт в `api_server.py` или при запуске:

```bash
python api_server.py --host 0.0.0.0 --port 8080
```

И обновите `api_manager.sh` и `gemma-api.service` соответственно.

---

## 📝 Примеры команд

### Полный цикл запуска

```bash
# 1. Установка зависимостей
source venv/bin/activate
pip install fastapi uvicorn pydantic requests

# 2. Запуск API
./api_manager.sh start

# 3. Проверка статуса
./api_manager.sh status

# 4. Тестирование
curl http://localhost:8000/health

# 5. Задать вопрос
curl -X POST "http://localhost:8000/ask" \
  -H "Content-Type: application/json" \
  -d '{"question": "Что такое недоимка?"}'

# 6. Просмотр логов
./api_manager.sh logs
```

### Установка как сервис

```bash
# 1. Установка systemd сервиса
sudo ./api_manager.sh install-systemd

# 2. Запуск и включение автозапуска
sudo systemctl start gemma-api
sudo systemctl enable gemma-api

# 3. Проверка
sudo systemctl status gemma-api

# 4. Логи
sudo journalctl -u gemma-api -f
```

---

## 🔗 Полезные ссылки

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Uvicorn Documentation](https://www.uvicorn.org/)
- [Systemd Service Management](https://www.freedesktop.org/software/systemd/man/systemd.service.html)

