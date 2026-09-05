# LawVision API — документация для разработчиков

REST API для анализа и генерации договоров по законодательству Республики
Казахстан. Работает на базе ИИ-модели с поиском по актуальным кодексам РК (RAG).

- **Версия:** v1
- **Базовый URL:** `https://lawvision.kz/api/v1`
- **Формат:** JSON (UTF-8). Тела запросов и ответов — `application/json`,
  если не указано иное.

---

## Содержание

1. [Быстрый старт](#быстрый-старт)
2. [Аутентификация](#аутентификация)
3. [Эндпоинты](#эндпоинты)
   - [Анализ договора](#post-contractsanalyze)
   - [Генерация договора](#post-contractsgenerate)
   - [Справочник типов](#get-contractstypes)
   - [Поля типа договора](#get-contractsfieldscontract_type)
   - [Статистика ключа](#get-usage)
4. [Типы договоров](#типы-договоров)
5. [Обработка ошибок](#обработка-ошибок)
6. [Учёт запросов](#учёт-запросов)
7. [Ограничения и рекомендации](#ограничения-и-рекомендации)
8. [Примеры на языках](#примеры-на-разных-языках)

---

## Быстрый старт

1. Получите API-ключ у администратора (создаётся в панели управления).
   Ключ выглядит как `lv_xxxxxxxxxxxxxxxxxxxx` и **показывается один раз** —
   сохраните его в надёжном месте.
2. Передавайте ключ в каждом запросе в заголовке `Authorization`.
3. Сделайте первый вызов:

```bash
curl -X POST https://lawvision.kz/api/v1/contracts/analyze \
  -H "Authorization: Bearer lv_ВАШ_КЛЮЧ" \
  -H "Content-Type: application/json" \
  -d '{"text": "ДОГОВОР ОКАЗАНИЯ УСЛУГ. Исполнитель обязуется оказать услуги заказчику. Стоимость 500000 тенге."}'
```

---

## Аутентификация

Все эндпоинты требуют API-ключ. Передавайте его одним из способов:

```
Authorization: Bearer lv_ВАШ_КЛЮЧ
```
или
```
X-API-Key: lv_ВАШ_КЛЮЧ
```

Ключ нельзя восстановить — если он потерян или скомпрометирован, попросите
администратора отозвать старый и выпустить новый. Не публикуйте ключ в
клиентском коде (браузер, мобильное приложение) — вызывайте API со своего
сервера.

---

## Эндпоинты

### POST /contracts/analyze

Анализирует текст договора: находит риски, пропущенные пункты, проверяет
соответствие праву РК и даёт рекомендации.

**Тело запроса** (JSON):

| Поле | Тип | Обяз. | Описание |
|------|-----|:----:|----------|
| `text` | string | да* | Текст договора (мин. 50 символов) |
| `contract_type` | string | нет | Подсказка типа (см. [Типы](#типы-договоров)). Если не указан — модель определит сама |
| `language` | string | нет | Язык ответа: `ru` (по умолч.), `kk` (казахский), `en` |
| `perspective` | string | нет | Чьи интересы защищать, напр. `"заказчик"`, `"арендатор"`. Модель отметит невыгодные для этой стороны пункты |

\* Вместо `text` можно отправить файл: `multipart/form-data` с полем `file`
(PDF / DOCX / TXT) и теми же доп. полями в форме.

**Ответ** (200):

```json
{
  "success": true,
  "analysis": {
    "contract_type_detected": "services",
    "overall_score": 20,
    "risk_level": "high",
    "summary": "Договор оказания консультационных услуг с минимальным набором условий.",
    "parties": ["Исполнитель", "Заказчик"],
    "risks": [
      {
        "severity": "high",
        "title": "Не определён предмет договора",
        "description": "Не конкретизированы услуги, объём и результат.",
        "clause_reference": "п. 1",
        "recommendation": "Детально описать перечень и объём услуг."
      }
    ],
    "risk_counts": { "high": 2, "medium": 1, "low": 0 },
    "missing_clauses": [
      {
        "clause": "Ответственность сторон",
        "importance": "critical",
        "reason": "Без неё невозможно взыскать убытки."
      }
    ],
    "compliance": [
      {
        "law": "ГК РК, ст. 683",
        "status": "warning",
        "note": "Отсутствуют существенные условия договора возмездного оказания услуг."
      }
    ],
    "recommendations": [
      { "priority": "high", "title": "Добавить предмет", "description": "..." }
    ],
    "strengths": ["Указана цена договора"]
  },
  "metadata": {
    "analyzed_at": "2026-06-12T10:17:50.762Z",
    "text_length": 1234,
    "truncated": false,
    "language": "ru",
    "perspective": "заказчик",
    "model": "gemma4"
  }
}
```

**Описание полей `analysis`:**

| Поле | Тип | Значения |
|------|-----|----------|
| `contract_type_detected` | string | Определённый тип (см. [Типы](#типы-договоров)) |
| `overall_score` | int | 0–100. 80+ хорошо, 50–79 рабочий с пробелами, <50 серьёзные проблемы |
| `risk_level` | string | `high` / `medium` / `low` — общий уровень риска |
| `summary` | string | Краткое описание договора |
| `parties` | string[] | Роли сторон, как названы в договоре |
| `risks[]` | object[] | `severity` (high/medium/low), `title`, `description`, `clause_reference`, `recommendation` |
| `risk_counts` | object | Кол-во рисков по уровням: `{high, medium, low}` |
| `missing_clauses[]` | object[] | `clause`, `importance` (critical/recommended/optional), `reason` |
| `compliance[]` | object[] | `law`, `status` (compliant/warning/violation), `note` |
| `recommendations[]` | object[] | `priority` (high/medium/low), `title`, `description` |
| `strengths` | string[] | Сильные стороны договора |

> При сбое разбора JSON моделью может прийти поле `raw_analysis` с сырым
> текстом — обрабатывайте его как запасной вариант.

---

### POST /contracts/generate

Генерирует текст договора по параметрам.

**Тело запроса** (JSON):

| Поле | Тип | Обяз. | Описание |
|------|-----|:----:|----------|
| `contract_type` | string | да | Тип договора (см. [Типы](#типы-договоров)) |
| `language` | string | нет | Язык генерации: `ru` (по умолч.), `kk` (казахский), `en` |
| остальные поля | — | — | Значения полей из `/contracts/fields/{type}` (напр. `party1_name`, `city`, `contract_date` и др.) |

**Ответ** (200):

```json
{
  "success": true,
  "contract_text": "ДОГОВОР ОКАЗАНИЯ УСЛУГ\n\nг. Алматы ...",
  "contract_type": "services",
  "type_name": "Оказание услуг",
  "sections": ["Предмет договора", "Права и обязанности", "..."],
  "legal_basis": "ГК РК, глава 33",
  "language": "ru",
  "metadata": { "generated_at": "...", "model": "gemma4", "tokens_used": 2400 }
}
```

---

### GET /contracts/types

Справочник доступных типов договоров.

**Ответ** (200):

```json
{
  "success": true,
  "types": [
    {
      "id": "services",
      "name_ru": "Оказание услуг",
      "name_kz": "Қызмет көрсету",
      "name_en": "Services",
      "icon": "...",
      "description_ru": "...", "description_kz": "...", "description_en": "..."
    }
  ]
}
```

---

### GET /contracts/fields/{contract_type}

Поля и разделы конкретного типа — для построения форм на стороне клиента.

**Ответ** (200):

```json
{
  "success": true,
  "fields": [
    { "name": "party1_name", "label_ru": "Наименование/ФИО Стороны 1",
      "label_kz": "...", "label_en": "Party 1 Name", "type": "text", "required": true }
  ],
  "sections": ["Предмет договора", "..."],
  "type_info": { "id": "services", "name_ru": "Оказание услуг", "..." }
}
```

Неизвестный тип → `404` с `error_code: unknown_type`.

---

### GET /usage

Статистика по вашему ключу.

**Ответ** (200):

```json
{
  "success": true,
  "usage": {
    "name": "CRM партнёра",
    "key_prefix": "lv_a1b2c3",
    "request_count": 142,
    "last_used_at": "2026-06-12T10:17:50.762Z"
  }
}
```

---

## Типы договоров

| `id` | Название (RU) |
|------|---------------|
| `sale` | Купля-продажа |
| `lease` | Аренда |
| `services` | Оказание услуг |
| `employment` | Трудовой договор |
| `loan` | Займ |
| `supply` | Поставка |
| `construction` | Подряд |
| `nda` | Конфиденциальность |
| `agency` | Агентский договор |

Поле `contract_type_detected` в анализе может дополнительно вернуть `other`,
если тип не распознан.

---

## Обработка ошибок

Все ошибки возвращают JSON с `success: false`, текстом `error` и машинным
кодом `error_code`.

```json
{ "success": false, "error": "Неверный или отозванный API-ключ", "error_code": "invalid_api_key" }
```

| HTTP | `error_code` | Причина | Что делать |
|------|-------------|---------|------------|
| 401 | `missing_api_key` | Ключ не передан | Добавьте заголовок `Authorization` |
| 401 | `invalid_api_key` | Ключ неверен или отозван | Проверьте ключ / запросите новый |
| 400 | `too_short` | Текст договора короче 50 символов | Пришлите полный текст |
| 400 | `missing_type` | Не указан `contract_type` при генерации | Укажите тип |
| 404 | `unknown_type` | Неизвестный тип договора | Сверьтесь со справочником `/contracts/types` |
| 502 | `service_unavailable` | ИИ-сервис временно недоступен | Повторите запрос позже (с backoff) |
| 503 | `service_unavailable` | Модуль не инициализирован | Повторите позже |

**Рекомендация по ретраям:** на `502`/`503` повторяйте с экспоненциальной
задержкой (например, 2с → 4с → 8с, до 3 попыток). На `4xx` повтор бесполезен —
исправьте запрос.

---

## Учёт запросов

Каждый успешно аутентифицированный вызов увеличивает счётчик вашего ключа.
Лимита на число запросов нет. Текущее значение счётчика доступно через
[`GET /usage`](#get-usage) и видно администратору в панели управления.

---

## Ограничения и рекомендации

- **Размер текста для анализа:** до ~14 000 символов. Более длинные договоры
  усекаются (в ответе `metadata.truncated = true`). Для больших документов
  отправляйте ключевые разделы.
- **Время ответа:** анализ/генерация выполняются ИИ-моделью и могут занимать
  от нескольких секунд до ~1 минуты. Ставьте таймаут клиента ≥ 90 секунд.
- **Язык:** `ru` / `kk` (казахский) / `en` — единообразно для анализа и генерации.
- **Назначение:** результат носит справочный характер и не заменяет
  консультацию квалифицированного юриста.
- **Безопасность:** держите ключ на сервере, не в клиентском коде. Используйте
  HTTPS (по HTTP ключ передавать нельзя).

---

## Примеры на разных языках

### cURL — анализ с позиции стороны

```bash
curl -X POST https://lawvision.kz/api/v1/contracts/analyze \
  -H "Authorization: Bearer lv_ВАШ_КЛЮЧ" \
  -H "Content-Type: application/json" \
  -d '{
        "text": "ДОГОВОР АРЕНДЫ...",
        "contract_type": "lease",
        "language": "ru",
        "perspective": "арендатор"
      }'
```

### cURL — анализ файла (PDF/DOCX)

```bash
curl -X POST https://lawvision.kz/api/v1/contracts/analyze \
  -H "Authorization: Bearer lv_ВАШ_КЛЮЧ" \
  -F "file=@contract.pdf" \
  -F "contract_type=services" \
  -F "language=ru"
```

### Python (requests)

```python
import requests

API = "https://lawvision.kz/api/v1"
KEY = "lv_ВАШ_КЛЮЧ"
headers = {"Authorization": f"Bearer {KEY}"}

# Анализ текста
resp = requests.post(
    f"{API}/contracts/analyze",
    headers=headers,
    json={"text": open("contract.txt", encoding="utf-8").read(),
          "language": "ru", "perspective": "заказчик"},
    timeout=90,
)
data = resp.json()
if data["success"]:
    a = data["analysis"]
    print(f"Оценка: {a['overall_score']}/100, риск: {a['risk_level']}")
    for r in a["risks"]:
        print(f"  [{r['severity']}] {r['title']}")
else:
    print("Ошибка:", data["error_code"], data["error"])

# Анализ файла
with open("contract.pdf", "rb") as f:
    resp = requests.post(f"{API}/contracts/analyze", headers=headers,
                         files={"file": f}, data={"contract_type": "services"},
                         timeout=90)
```

### JavaScript (Node.js, fetch)

```javascript
const API = "https://lawvision.kz/api/v1";
const KEY = process.env.LAWVISION_API_KEY;  // храните в переменной окружения

async function analyze(text) {
  const res = await fetch(`${API}/contracts/analyze`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text, language: "ru" }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(`${data.error_code}: ${data.error}`);
  return data.analysis;
}

analyze("ДОГОВОР ПОСТАВКИ...").then(a =>
  console.log(`Оценка ${a.overall_score}, рисков: ${a.risk_counts.high} высоких`)
);
```

### PHP

```php
<?php
$ch = curl_init("https://lawvision.kz/api/v1/contracts/analyze");
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => [
        "Authorization: Bearer lv_ВАШ_КЛЮЧ",
        "Content-Type: application/json",
    ],
    CURLOPT_POSTFIELDS => json_encode([
        "text" => "ДОГОВОР ЗАЙМА...",
        "language" => "ru",
    ]),
    CURLOPT_TIMEOUT => 90,
]);
$data = json_decode(curl_exec($ch), true);
echo $data["success"] ? $data["analysis"]["overall_score"] : $data["error"];
```

---

_Вопросы по интеграции и выдача ключей — через администратора LawVision._
