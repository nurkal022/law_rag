# Развёртывание Dalel (version4redisign) рядом со старым LawVision

Новая версия ставится **отдельным инстансом**: свой каталог, своя БД, свой порт,
свой systemd-юнит. Старый `lawvision.service` на порту 5003 продолжает работать
и ничем не затрагивается.

| | старый LawVision | Dalel (новая версия) |
|---|---|---|
| Каталог | `~/PycharmProjects/llm-law/law_rag` | `~/PycharmProjects/llm-law/dalel` |
| Ветка | как есть | `version4redisign` |
| Порт | 5003 | 5004 (`APP_PORT`) |
| Сервис | `lawvision.service` | `dalel.service` |
| БД | своя | отдельная база в том же PostgreSQL |

Порт берётся из переменной `APP_PORT` (по умолчанию 5003) — правка в `config.py`,
чтобы два инстанса не дрались за один порт.

## 1. Клонировать ветку в отдельный каталог

```bash
cd ~/PycharmProjects/llm-law
git clone -b version4redisign https://github.com/nurkal022/law_rag.git dalel
cd dalel
```

## 2. Python-окружение

```bash
python3 -m venv venv
venv/bin/pip install -r requirements.txt
```

## 3. Отдельная база

```bash
# в том же PostgreSQL, что и у старой версии
psql -U postgres -c "CREATE DATABASE dalel OWNER lawai;"
```

## 4. Файл `.env`

Скопировать секреты из старого инстанса и поменять то, что должно отличаться:

```bash
cp ~/PycharmProjects/llm-law/law_rag/.env .env
```

затем в `.env` выставить:

```
APP_PORT=5004
DATABASE_URL=postgresql://lawai:<пароль>@localhost:5433/dalel
DEBUG=False
SECRET_KEY=<новый случайный ключ>
```

`SECRET_KEY` обязательно свой — иначе сессии двух инстансов будут
взаимозаменяемы.

## 5. Собрать фронтенд

`static/app/` не хранится в git, собирается на месте:

```bash
cd frontend
npm ci
npm run build      # результат кладётся в ../static/app
cd ..
```

## 6. systemd-юнит

`~/.config/systemd/user/dalel.service`:

```ini
[Unit]
Description=Dalel (новая версия LawVision)
After=network-online.target

[Service]
WorkingDirectory=/home/kaznu2025/PycharmProjects/llm-law/dalel
ExecStart=/home/kaznu2025/PycharmProjects/llm-law/dalel/venv/bin/python app.py
Restart=always
RestartSec=10
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=default.target
```

```bash
systemctl --user daemon-reload
systemctl --user enable --now dalel.service
systemctl --user status dalel.service
curl -I http://localhost:5004/
```

## 7. Домен через Cloudflare Tunnel

В `~/.cloudflared/config.yml` добавить второй ingress **выше** правила-заглушки:

```yaml
ingress:
  - hostname: dalel.lawvision.kz
    service: http://localhost:5004
  - hostname: lawvision.kz
    service: http://localhost:5003
  - service: http_status:404
```

Завести DNS-запись и перезапустить туннель:

```bash
cloudflared tunnel route dns lawvision dalel.lawvision.kz
systemctl --user restart cloudflared.service
```

## Последующие обновления Dalel

```bash
cd ~/PycharmProjects/llm-law/dalel
git pull origin version4redisign
cd frontend && npm ci && npm run build && cd ..
systemctl --user restart dalel.service
```

## Проверка

- `journalctl --user -u dalel.service -f` — логи запуска
- `https://dalel.lawvision.kz` — главная; кнопка «Начать бесплатно» ведёт в `/chat`
- `https://lawvision.kz` — старая версия должна работать как раньше
