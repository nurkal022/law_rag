# 🏛️ ИИ Система - Правовые инструменты Казахстана

[![Python 3.8+](https://img.shields.io/badge/python-3.8+-blue.svg)](https://www.python.org/downloads/)
[![Flask](https://img.shields.io/badge/flask-2.3+-green.svg)](https://flask.palletsprojects.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![AI Powered](https://img.shields.io/badge/AI-Powered-purple.svg)](https://openai.com/)

**ИИ Система** - это современная платформа для работы с правовыми документами Республики Казахстан, использующая технологии искусственного интеллекта для поиска, анализа и консультирования по вопросам законодательства.

![Dashboard Screenshot](screenshots/dashboard.png)

## 🌟 Возможности

### 🤖 Активные инструменты
- **Юридический Консультант** - AI-помощник с точными ссылками на источники в документах
- **Интеллектуальный поиск** - Семантический и гибридный поиск по правовым документам
- **Чат-интерфейс** - Интуитивное взаимодействие с историей диалогов

### 🔧 В разработке
- **Анализ договоров** - Автоматическая проверка соответствия законодательству
- **Генератор документов** - Создание типовых правовых документов
- **Правовой календарь** - Отслеживание сроков и изменений в законодательстве
- **Правовая аналитика** - Анализ тенденций и статистика применения норм права

## 🛠️ Технологический стек

- **Backend**: Python 3.8+, Flask 2.3+
- **AI/ML**: OpenAI GPT-4, Sentence Transformers, scikit-learn
- **Database**: SQLite3 с векторным поиском
- **Frontend**: Bootstrap 5, Vanilla JavaScript
- **Embedding Model**: Multilingual MiniLM-L12-v2

## 🚀 Быстрый старт

### Требования
- Python 3.8 или выше
- 2GB свободной оперативной памяти
- OpenAI API ключ или Ollama (опционально для полной функциональности)
- Fine-tuned модель (опционально, для простого чата)

### Установка

1. **Клонируйте репозиторий**
```bash
git clone https://github.com/your-username/lawrag.git
cd lawrag
```

2. **Создайте виртуальное окружение**
```bash
python -m venv venv
source .venv/bin/activate  # Linux/Mac
# или
.venv\Scripts\activate     # Windows
```

3. **Установите зависимости**
```bash
pip install -r requirements.txt
```

4. **Настройте переменные окружения**
```bash
# Создайте файл .env
echo "OPENAI_API_KEY=your_openai_api_key_here" > .env
echo "SECRET_KEY=your_secret_key_here" >> .env
```

5. **Подготовьте документы**
```bash
# Создайте папку для документов
mkdir current
# Поместите ваши .txt документы в папку current/
```

6. **Запустите приложение**

**Вариант 1: Автоматический запуск (рекомендуется)**
```bash
chmod +x scripts/start_system.sh scripts/stop_system.sh
./scripts/start_system.sh
```

Скрипт автоматически:
- ✅ Проверит виртуальное окружение
- ✅ Установит зависимости при необходимости
- ✅ Запустит Fine-tuned API сервер (если доступен)
- ✅ Запустит Flask приложение

**Вариант 2: Ручной запуск**
```bash
python app.py
```

7. **Откройте в браузере**
- Дашборд: http://localhost:5003
- Чат с поиском по документам: http://localhost:5003/chat
- Простой чат (с fine-tuned моделью): http://localhost:5003/chat-simple
- Админ панель: http://localhost:5003/admin

📖 **Подробная инструкция**: См. [START_SYSTEM.md](START_SYSTEM.md)

## 📖 Документация

### Структура проекта
```
lawrag/
├── app.py                 # Основное Flask приложение
├── config.py             # Конфигурация системы
├── requirements.txt      # Python зависимости
├── 
├── database/
│   └── models.py         # Модели базы данных
├── 
├── embeddings/
│   └── processor.py      # Обработка документов и создание embeddings
├── 
├── rag/
│   ├── retriever.py      # Поиск релевантных документов
│   └── generator.py      # Генерация ответов с помощью GPT
├── 
├── templates/
│   ├── base.html         # Базовый шаблон
│   ├── index.html        # Дашборд
│   ├── chat.html         # Чат-интерфейс
│   └── admin.html        # Админ панель
└── 
└── current/              # Папка с документами (создается пользователем)
```

### API Endpoints

#### Основные
- `GET /` - Дашборд с инструментами
- `GET /chat` - Чат-интерфейс с поиском по документам
- `GET /admin` - Панель администратора

#### API
- `POST /api/chat` - Отправка запроса в чат
- `GET /api/history` - История чата текущей сессии
- `GET /api/stats` - Статистика системы
- `POST /api/search` - Поиск документов

#### Администрирование
- `POST /api/admin/process_documents` - Обработка документов
- `POST /api/admin/update_embeddings` - Обновление векторных представлений
- `POST /api/admin/auto_setup` - Автоматическая настройка системы
- `POST /api/admin/clear_history` - Очистка истории чата

### Конфигурация

Основные параметры в `config.py`:

```python
# Обработка документов
CHUNK_SIZE = 1000          # Размер чанка в символах
CHUNK_OVERLAP = 200        # Перекрытие между чанками

# Настройки ИИ системы
MAX_TOKENS = 4000          # Максимум токенов для GPT
TEMPERATURE = 0.1          # Температура для точности ответов
TOP_K_RESULTS = 5          # Количество релевантных документов

# Модель embeddings
EMBEDDING_MODEL = 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2'
```

## 🔧 Работа в офлайн режиме

Система поддерживает работу без интернета:
- Автоматически переключается на поиск по ключевым словам
- Использует локально кэшированные модели
- Сохраняет полную функциональность интерфейса

## 🤝 Вклад в проект

Мы приветствуем вклад в развитие проекта! 

1. Форкните репозиторий
2. Создайте ветку для новой функции (`git checkout -b feature/AmazingFeature`)
3. Зафиксируйте изменения (`git commit -m 'Add some AmazingFeature'`)
4. Отправьте в ветку (`git push origin feature/AmazingFeature`)
5. Откройте Pull Request

### Правила разработки
- Следуйте PEP 8 для Python кода
- Добавляйте docstrings для новых функций
- Тестируйте изменения перед отправкой PR
- Обновляйте документацию при необходимости

## 📋 Roadmap

### v1.1 (В планах)
- [ ] Анализ договоров с выделением ключевых пунктов
- [ ] Экспорт результатов поиска в PDF/Word
- [ ] Улучшенная система тегирования документов

### v1.2 (Планируется)
- [ ] Многопользовательский режим
- [ ] Интеграция с внешними правовыми базами
- [ ] REST API для интеграции с другими системами

### v2.0 (Будущее)
- [ ] Мобильное приложение
- [ ] Система уведомлений об изменениях в законодательстве
- [ ] Машинное обучение для улучшения качества ответов

## ⚠️ Важные замечания

- **Не является юридической консультацией**: Система предоставляет информационную поддержку, но не заменяет профессиональную юридическую консультацию
- **Конфиденциальность**: Не загружайте конфиденциальные документы в публичные версии
- **Точность**: Всегда проверяйте полученную информацию с первоисточниками

## 📄 Лицензия

Этот проект лицензирован под MIT License - см. файл [LICENSE](LICENSE) для деталей.

## 👥 Авторы

- **Нурлыхан** - *Основной разработчик* - [GitHub](https://github.com/your-username)

## 🙏 Благодарности

- [OpenAI](https://openai.com/) за GPT API
- [Sentence Transformers](https://www.sbert.net/) за multilingual embeddings
- [Flask](https://flask.palletsprojects.com/) за веб-фреймворк
- [Bootstrap](https://getbootstrap.com/) за UI компоненты

## 📞 Поддержка

Если у вас есть вопросы или проблемы:
1. Проверьте [Issues](https://github.com/your-username/lawrag/issues)
2. Создайте новый Issue с детальным описанием
3. Обратитесь к документации выше

---

<div align="center">

**⭐ Поставьте звезду, если проект вам полезен!**

Made with ❤️ for Kazakhstan legal community

</div> 