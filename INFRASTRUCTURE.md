# LawVision — Инфраструктура и подключение к домену

## Схема работы

```
Пользователь (браузер)
        │
        ▼
   lawvision.kz (DNS → Cloudflare)
        │
        ▼
   Cloudflare Edge (SSL/TLS termination)
        │  HTTPS → HTTP
        ▼
   Cloudflare Tunnel (cloudflared)
        │  протокол: http2, порт 443/TCP
        ▼
   localhost:5003 (Flask app)
```

## Компоненты

### 1. Домен — lawvision.kz
- **Регистратор:** ps.kz
- **Nameservers:** Cloudflare (`ed.ns.cloudflare.com`, `molly.ns.cloudflare.com`)
- **DNS:** управляется через Cloudflare Dashboard
- **SSL:** Full mode (Cloudflare терминирует HTTPS, шлёт HTTP в туннель)

### 2. Cloudflare Tunnel
Безопасный туннель от локального компьютера к Cloudflare Edge. Не требует статического IP, проброса портов или открытых портов на роутере.

- **Tunnel ID:** `e27b47b9-e65b-4a82-8017-34928b52a58b`
- **Протокол:** `http2` (TCP/443) — стандартный `h2mux` на порту 7844 заблокирован провайдером
- **Binary:** `/home/kaznu2025/.local/bin/cloudflared` (установлен без sudo)

**Конфигурация** — `~/.cloudflared/config.yml`:
```yaml
tunnel: e27b47b9-e65b-4a82-8017-34928b52a58b
credentials-file: /home/kaznu2025/.cloudflared/e27b47b9-e65b-4a82-8017-34928b52a58b.json
protocol: http2

ingress:
  - hostname: lawvision.kz
    service: http://localhost:5003
  - service: http_status:404
```

**Credentials** — `~/.cloudflared/<tunnel-id>.json` (секретный файл, не коммитить!)

### 3. Flask-приложение
- **Порт:** 5003
- **Bind:** 0.0.0.0 (слушает все интерфейсы)
- **Рабочая директория:** `/home/kaznu2025/PycharmProjects/llm-law/law_rag`
- **Python:** `venv/bin/python`
- **Конфигурация:** `.env` файл (SECRET_KEY, ADMIN_USERNAME, ADMIN_PASSWORD, DEBUG)

## Автозапуск (systemd user services)

Оба сервиса работают от пользователя `kaznu2025` без sudo.
Для работы без входа в систему включён `loginctl enable-linger kaznu2025`.

### lawvision.service
```ini
# ~/.config/systemd/user/lawvision.service
[Unit]
Description=LawVision App (lawvision.kz)
After=network-online.target

[Service]
WorkingDirectory=/home/kaznu2025/PycharmProjects/llm-law/law_rag
ExecStart=/home/kaznu2025/PycharmProjects/llm-law/law_rag/venv/bin/python app.py
Restart=always
RestartSec=10
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=default.target
```

### cloudflared.service
```ini
# ~/.config/systemd/user/cloudflared.service
[Unit]
Description=Cloudflare Tunnel (lawvision.kz)
After=network-online.target

[Service]
ExecStart=/home/kaznu2025/.local/bin/cloudflared tunnel run lawvision
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
```

## Команды управления

```bash
# Статус сервисов
systemctl --user status lawvision.service
systemctl --user status cloudflared.service

# Перезапуск
systemctl --user restart lawvision.service
systemctl --user restart cloudflared.service

# Логи
journalctl --user -u lawvision.service -f
journalctl --user -u cloudflared.service -f

# Остановить/запустить
systemctl --user stop lawvision.service
systemctl --user start lawvision.service

# Включить/выключить автозапуск
systemctl --user enable lawvision.service
systemctl --user disable lawvision.service
```

## Обновление кода удалённо

```bash
# На сервере:
cd /home/kaznu2025/PycharmProjects/llm-law/law_rag
git pull origin server-local
systemctl --user restart lawvision.service
```

## Бэкапы

- **Скрипт:** `scripts/backup.sh`
- **Cron:** ежедневно в 03:00
- **Хранение:** `database/backups/` (30 дней)
- **Что бэкапится:** SQLite база данных

## Безопасность

- **Админ-панель:** `/admin/login` — защищена логином/паролем (Flask session)
- **Админ скрыт:** нет ссылки в навигации, доступ только по прямому URL
- **SSL:** Cloudflare Full mode — трафик шифруется от браузера до Cloudflare
- **IP анонимизация:** SHA-256 хеширование IP для аналитики посещений
- **Секреты:** `.env` файл (не в git)

## Решение проблем

| Проблема | Решение |
|----------|---------|
| Error 1033 (Tunnel error) | `systemctl --user restart cloudflared.service` |
| Порт 7844 заблокирован | Использовать `protocol: http2` в config.yml |
| Сайт не открывается локально | `systemctl --user restart lawvision.service` |
| DNS не резолвится | Проверить nameservers на ps.kz → Cloudflare |
| После обновления кода ничего не изменилось | `systemctl --user restart lawvision.service` |
