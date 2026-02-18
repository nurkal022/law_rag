# 📊 Мониторинг системы Law RAG

## Быстрый статус

### Однократная проверка

```bash
./monitor_system_once.sh
```

### Непрерывный мониторинг

```bash
# Вариант 1: Используя watch (рекомендуется)
watch -n 5 ./monitor_system_once.sh

# Вариант 2: Используя цикл
while true; do
    clear
    ./monitor_system_once.sh
    sleep 5
done
```

## Что проверяет скрипт

### 1. Flask приложение
- ✅ Статус порта 5003
- ✅ Доступность API
- ✅ Статистика базы данных (документы, чанки, embeddings)
- ✅ Использование ресурсов процесса

### 2. Fine-tuned API сервер
- ✅ Статус порта 8000
- ✅ Состояние модели (загружена/загружается)
- ✅ Доступность CUDA
- ✅ Использование ресурсов процесса

### 3. Ollama
- ✅ Статус порта 11434
- ✅ Доступность API
- ✅ Список доступных моделей
- ✅ Использование ресурсов процесса

### 4. База данных
- ✅ Существование файла БД
- ✅ Размер базы данных
- ✅ Количество документов и чанков

### 5. Системные ресурсы
- ✅ Использование CPU
- ✅ Использование памяти
- ✅ Свободное место на диске

### 6. GPU (если доступна)
- ✅ Название GPU
- ✅ Использование GPU (%)
- ✅ Использование памяти GPU

## Примеры использования

### Проверка перед презентацией

```bash
./monitor_system_once.sh
```

### Мониторинг во время работы

```bash
watch -n 5 ./monitor_system_once.sh
```

### Проверка конкретного компонента

```bash
# Flask приложение
curl http://localhost:5003/api/admin/stats

# Fine-tuned API
curl http://localhost:8000/health

# Ollama
curl http://localhost:11434/api/tags
```

## Интерпретация статуса

### ✅ Зеленый - Все работает
- Компонент запущен и отвечает на запросы
- Можно использовать

### ⚠️ Желтый - Предупреждение
- Компонент запущен, но есть проблемы
- Модель может загружаться
- API может не отвечать

### ✗ Красный - Ошибка
- Компонент не запущен
- Порт закрыт
- Файл не найден

## Автоматический мониторинг

### Добавление в cron (проверка каждые 5 минут)

```bash
crontab -e
```

Добавьте строку:
```
*/5 * * * * /home/kaznu2025/law_rag/monitor_system_once.sh >> /var/log/law_rag_monitor.log 2>&1
```

### Мониторинг с уведомлениями

Создайте скрипт `monitor_with_alerts.sh`:

```bash
#!/bin/bash
status=$(./monitor_system_once.sh)

if echo "$status" | grep -q "✗"; then
    # Отправить уведомление (email, telegram и т.д.)
    echo "ALERT: Some components are down!" | mail -s "Law RAG Alert" your@email.com
fi
```

## Логирование

### Сохранение логов мониторинга

```bash
# Однократная проверка с сохранением
./monitor_system_once.sh | tee -a monitor.log

# Непрерывный мониторинг с логированием
watch -n 5 './monitor_system_once.sh | tee -a monitor.log'
```

## Интеграция с системами мониторинга

### Prometheus метрики

Можно расширить скрипт для экспорта метрик в формате Prometheus:

```bash
# Пример метрик
echo "# HELP flask_status Flask application status"
echo "# TYPE flask_status gauge"
echo "flask_status $(check_port 5003 && echo 1 || echo 0)"
```

### Grafana дашборд

Используйте метрики для создания дашборда в Grafana.

## Troubleshooting

### Скрипт не запускается

```bash
chmod +x monitor_system.sh monitor_system_once.sh
```

### Порт не определяется

Убедитесь, что `timeout` доступен:
```bash
which timeout || sudo apt install coreutils
```

### Python не найден

Убедитесь, что Python3 установлен:
```bash
which python3 || sudo apt install python3
```

