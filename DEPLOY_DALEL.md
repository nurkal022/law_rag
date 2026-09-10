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
# расширение pgvector ставится в каждую базу отдельно — без него приложение
# падает на старте с «type "vector" does not exist»
psql -U postgres -d dalel -c "CREATE EXTENSION IF NOT EXISTS vector;"
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

# Модель и эмбеддинги. Старый инстанс живёт на ollama; новая версия ходит в
# OpenAI-совместимый API. Рабочий вариант со стенда — OpenAI:
LLM_PROVIDER_TYPE=openai
LLM_MODEL=gpt-4o-mini            # генерация документов и договоров
CHAT_LLM_MODEL=gpt-5-mini        # консультант: рассуждающая модель, иначе отказывает на «права человека»
LLM_REASONING_EFFORT=low         # для gpt-5*: minimal быстрее, low точнее
OPENAI_API_KEY=<ключ>
EMBEDDING_BASE_URL=https://api.openai.com/v1
EMBEDDING_API_KEY=<тот же ключ>
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_SEND_DIMENSIONS=true   # схема БД — vector(1024), OpenAI усекает вектор
USE_RERANK=false                 # у OpenAI нет /v1/rerank
TRANSCRIPTION_MODEL=gpt-4o-transcribe
```

Если на сервере есть vLLM с bge-m3 — вместо блока OpenAI укажите его
`EMBEDDING_BASE_URL`/`LOCAL_LLM_BASE_URL`, оставьте `EMBEDDING_SEND_DIMENSIONS`
выключенным и `USE_RERANK=true`.

`SECRET_KEY` обязательно свой — иначе сессии двух инстансов будут
взаимозаменяемы.

## 5. Собрать фронтенд

`static/app/` не хранится в git. Сборке нужен Node 20+ (Vite 8); если на сервере
он старше — собирайте на своей машине и заливайте результат:

```bash
# на сервере, если Node ≥ 20
cd frontend && npm ci && npm run build && cd ..   # результат — в ../static/app

# иначе — локально
cd frontend && npm run build && cd ..
rsync -az --delete --exclude '__devlogin.html' static/app/ \
      kaznu2025@<сервер>:~/PycharmProjects/llm-law/dalel/static/app/
```

`__devlogin.html` — помощник разработчика с паролем в разметке; на сервер
он попадать не должен.

## 5а. Загрузить корпус

Новая база пуста. Кодексы лежат в `docs/`, индексация — двумя скриптами
(эмбеддинги считаются через выбранного провайдера; на 6 тыс. чанков через
OpenAI уходит около трёх минут):

```bash
venv/bin/python scripts/load_legal_docs.py
venv/bin/python scripts/reindex_embeddings.py
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
