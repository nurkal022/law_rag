from typing import List, Dict, Optional, Tuple
import json
import re
from config import Config
from llm_providers.factory import LLMProviderFactory
from llm_providers.base import LLMProvider

# Единое нейтральное сообщение для пользователя при любой недоступности/ошибке
# LLM-сервиса. Без внутренних деталей (провайдер, порты, ссылки на админку).
_SERVICE_UNAVAILABLE_MESSAGE = (
    "Извините, сервис временно не работает. "
    "Пожалуйста, попробуйте повторить запрос через несколько минут."
)


# Identity-вопросы обрабатываем хардкод-ответом, чтобы:
# 1) модель не подмешивала самопредставление случайно в обычные ответы
# 2) гарантированно скрыть базовую модель (Gemma/GPT-OSS)
# 3) сэкономить токены и время
_IDENTITY_PATTERNS = [
    r"\bкто\s+(ты|вы|тебя|вас)\b",
    r"\b(как\s+)?(тебя|вас|твое|ваше)\s+(зов|имя)",
    r"\bкак\s+(тебя|вас)\s+зовут\b",
    r"\bкто\s+(тебя|вас|тебя|тебе)\s+(созда|сдела|разработ)",
    r"\b(какая|какую|что\s+за)\s+(ты|это|за)?\s*модел",
    r"\bна\s+какой\s+модел",
    r"\bwho\s+are\s+you\b",
    r"\bwhat'?s?\s+your\s+(name|model)",
    r"\bsen\s+kim",  # каз. "ты кто"
    r"\bкімсің\b",  # каз.
]

_IDENTITY_RE = re.compile("|".join(_IDENTITY_PATTERNS), re.IGNORECASE)


_KK_LETTERS = frozenset('әғқңөұүһі')
# Частые казахские слова без особых букв — для вопроса, набранного русской раскладкой.
_KK_WORDS = frozenset(('болады', 'керек', 'туралы', 'бойынша', 'беру', 'алу', 'неге', 'жыл'))
LANG_NAMES = {'ru': 'русский', 'kk': 'казахский', 'en': 'английский'}


def detect_language(query: str) -> str:
    """Язык вопроса: 'kk', 'en' или 'ru'.

    Раньше язык угадывала сама модель по блоку примеров в промпте, и слабая
    модель промахивалась: на русский вопрос о континентальном праве отвечала
    по-казахски. Определить язык на сервере и назвать его модели прямо —
    надёжнее и короче на шестьдесят строк промпта.
    """
    text = (query or '').lower()
    letters = [c for c in text if c.isalpha()]
    if not letters:
        return 'ru'
    if any(c in _KK_LETTERS for c in letters):
        return 'kk'
    if any(w in _KK_WORDS for w in re.findall(r'[а-яё]+', text)):
        return 'kk'
    latin = sum(1 for c in letters if 'a' <= c <= 'z')
    return 'en' if latin / len(letters) >= 0.6 else 'ru'


NO_CONTEXT_NOTE = ('Подходящих фрагментов не найдено — отвечайте по общим сведениям о '
                   'законодательстве РК, как описано в правиле 4.')


def build_system_prompt(query: str, context: Optional[str], lang: Optional[str] = None) -> str:
    """Системный промпт консультанта.

    Строгая редакция 09.09 («только по контексту, иначе — "в базе не нашлось
    нормы"») на gpt-4o-mini отказывала на «права человека» как на вопрос не о
    праве и резала ответы до одного предложения: 33 из 79 ответов за месяц —
    короче двухсот символов. Здесь другой баланс: контекст — основа и
    единственный источник номеров статей, недостающее — из знаний о праве РК
    с пометкой, отказ — только вопросам, к праву не относящимся.
    """
    lang = lang or detect_language(query)
    return f"""Вы — консультант по законодательству Республики Казахстан. Вы отвечаете на любые вопросы о праве: о нормах законов и кодексов, правах и обязанностях, процедурах и сроках, государственных органах и судах, договорах, налогах и бизнесе, а также на общие и учебные вопросы о праве и правовой системе (устройство государства, теория права, сравнение правовых семей, история права).

КАК ОТВЕЧАТЬ
1. По существу с первого предложения: сначала краткий прямой ответ, затем объяснение с опорой на нормы, затем, если уместно, практическая часть — что сделать, куда обратиться, какие сроки. Обычный объём — от четырёх до двенадцати предложений; одним предложением можно ответить только на простой фактический вопрос.
2. Основа ответа — фрагменты из блока КОНТЕКСТ. Это выдержки из действующих актов РК, и они главнее ваших общих представлений о праве: если ваши знания расходятся с текстом нормы, верен текст. Каждое утверждение, взятое из фрагмента, снабжайте ссылкой на него: [Источник 1], [Источник 2]. Номер статьи берите только из текста фрагмента — каждый начинается с заголовка «Статья N. Название».
3. Норма редко сформулирована словами вопроса: на «можно ли уволить беременную» отвечает статья «Ограничение возможности расторжения трудового договора». Прежде чем решить, что ответа в контексте нет, соотнесите вопрос со смыслом каждого фрагмента.
4. Если фрагменты отвечают на вопрос лишь частично или не отвечают вовсе — всё равно дайте полный ответ, опираясь на свои знания о законодательстве Казахстана. Такую часть начинайте словами «По общим сведениям о законодательстве РК:», называйте акт (например, Трудовой кодекс РК), но не указывайте номер статьи, которого нет в контексте — посоветуйте сверить его в официальной редакции акта. Норму другой страны за казахстанскую не выдавайте никогда.
5. Никогда не отвечайте «в базе не нашлось нормы», «не могу ответить» или «вопрос не связан с правом» на вопрос, который хоть как-то касается права, закона, государства, прав и обязанностей человека. Не отвечать по существу можно только на вопрос, к праву не относящийся вовсе (погода, рецепты, программирование, спорт): одним предложением скажите, что консультируете по праву Казахстана, и предложите задать правовой вопрос. На приветствие или вопрос «что ты умеешь» ответьте коротко и дружелюбно и перечислите, с чем можете помочь.
6. Различайте общее правило и исключение из него: не выдавайте норму о частном случае за общее правило. Если вопрос описывает конкретную жизненную ситуацию, в конце одной фразой порекомендуйте обратиться к юристу — без назиданий.
7. Не представляйтесь и не рассказывайте о себе, если об этом не спросили.

ФОРМАТ
Обычный текст без markdown: без заголовков, без **жирного**, без таблиц. Абзацы отделяйте пустой строкой. Перечисление — с новой строки, каждый пункт начинайте с «— » или «1) ».

ЯЗЫК
Язык ответа: {LANG_NAMES[lang]} — язык последнего вопроса. Весь ответ от первого до последнего слова на этом языке; фрагменты контекста на русском — переводите нужное, названия актов и латинские термины можно оставлять как есть.

КОНТЕКСТ (выдержки из актов РК)
{context or NO_CONTEXT_NOTE}"""



_ARTICLE_RE = re.compile(r'Статья\s+(\d+(?:-\d+)*)')


def source_article(content: str) -> str:
    """Номер статьи из текста фрагмента: «Статья 43-1. …» → «43-1»; нет — пустая строка."""
    m = _ARTICLE_RE.search(content or '')
    return m.group(1) if m else ''


def _identity_answer(query: str) -> str | None:
    """Возвращает фиксированный ответ для identity-вопросов или None."""
    if not _IDENTITY_RE.search(query):
        return None
    q_lower = query.lower()
    kz_chars = "әғқңөұүһі"
    if any(c in q_lower for c in kz_chars) or "kim" in q_lower:
        return ("Мен — LawVision, әл-Фараби атындағы ҚазҰУ-дың 306-зертханасы құрған, "
                "Қазақстан Республикасының құқық мәселелері бойынша AI-ассистент.")
    if any(c in q_lower for c in "abcdefghijklmnopqrstuvwxyz") and not any(0x0400 <= ord(c) <= 0x04FF for c in query):
        return ("I am LawVision, an AI assistant for the law of Kazakhstan, "
                "created by Lab 306 of Al-Farabi KazNU.")
    return ("Я — LawVision, AI-ассистент по праву Казахстана, "
            "созданный лабораторией 306 КазНУ им. аль-Фараби.")

class ResponseGenerator:
    def __init__(self, provider: LLMProvider = None, api_key: str = None):
        """
        Инициализация генератора ответов
        
        Args:
            provider: Провайдер LLM (если None, создается из конфигурации)
            api_key: API ключ (deprecated, для обратной совместимости)
        """
        if provider:
            self.provider = provider
        else:
            # Используем провайдер из конфигурации (локальные провайдеры)
            self.provider = LLMProviderFactory.get_current_provider()
            
            # Если передан api_key (старый способ), предупреждаем
            if api_key:
                print("⚠️  Использование api_key устарело. Используйте локальные провайдеры (Ollama/Fine-tuned)")
        
        if not self.provider:
            raise ValueError("Не удалось инициализировать LLM провайдер. Проверьте настройки.")

    def is_available(self) -> bool:
        """Доступен ли текущий LLM-провайдер (делегирует провайдеру)."""
        return bool(self.provider) and self.provider.is_available()

    def _prepare_context(self, search_results: List[Dict]) -> str:
        """Подготовка контекста из найденных документов"""
        if not search_results:
            return "Релевантные документы не найдены."
        
        context_parts = []
        for i, result in enumerate(search_results, 1):
            source_info = f"[Источник {i}: {result['title']}, позиция {result['start_position']}-{result['end_position']}]"
            content = result['full_content']
            
            context_parts.append(f"{source_info}\n{content}\n")
        
        return "\n".join(context_parts)
    
    def _prepare_sources_list(self, search_results: List[Dict]) -> List[Dict]:
        """Подготовка списка источников для ответа"""
        sources = []
        for i, result in enumerate(search_results, 1):
            sources.append({
                'id': i,
                # Номер статьи — отдельным полем: интерфейс собирает из него
                # чип «ГК РК 178», а в 200 символах предпросмотра его может не быть.
                'article': source_article(result.get('full_content') or result.get('content') or ''),
                'title': result['title'],
                'filename': result['filename'],
                'position': f"{result['start_position']}-{result['end_position']}",
                'chunk_index': result['chunk_index'],
                'similarity_score': result.get('final_score', result.get('similarity_score', 0)),
                'preview': result['preview']
            })
        return sources
    
    def generate_response(self, user_query: str, search_results: List[Dict],
                         conversation_history: List[Dict] = None) -> Dict:
        """Генерация ответа на основе найденных документов"""

        # Identity-вопросы («кто ты», «какая модель», «кто создал»)
        # обрабатываем хардкод-ответом — не отправляем в LLM, чтобы исключить
        # утечку базовой модели и подмешивание самопредставления в обычные ответы.
        identity = _identity_answer(user_query)
        if identity:
            return {
                'answer': identity,
                'sources': [],
                'confidence': 1.0,
                'model_used': 'lawvision-identity',
                'tokens_used': 0,
                'used_model_knowledge': False,
            }

        # Контекст и промпт. Без найденных фрагментов промпт тот же — модель
        # отвечает по общим сведениям о праве РК с пометкой об этом.
        has_context = bool(search_results)
        context = self._prepare_context(search_results) if has_context else None
        sources = self._prepare_sources_list(search_results) if has_context else []

        system_prompt = build_system_prompt(user_query, context)

        # Подготавливаем историю разговора
        messages = [{"role": "system", "content": system_prompt}]

        # Для коротких/неоднозначных запросов историю не подмешиваем —
        # иначе модель отвечает на прошлый вопрос вместо текущего
        # (например, "в казахстане" → ответ берётся из предыдущего обсуждения).
        is_ambiguous = len(user_query.strip()) < 15 or len(user_query.split()) <= 2

        if conversation_history and not is_ambiguous:
            for msg in conversation_history[-5:]:  # Последние 5 сообщений
                messages.extend([
                    {"role": "user", "content": msg['user_query']},
                    {"role": "assistant", "content": msg['ai_response']}
                ])

        # Добавляем текущий запрос
        messages.append({"role": "user", "content": user_query})
        
        try:
            # Вызываем LLM через провайдер
            response = self.provider.chat_completion(
                messages=messages,
                model=Config.CHAT_LLM_MODEL,
                temperature=Config.TEMPERATURE,
                max_tokens=Config.MAX_TOKENS,
                top_p=0.9,
                frequency_penalty=0.1,
                presence_penalty=0.1
            )
            
            answer = response['content']
            
            # Вычисляем уверенность на основе количества и качества источников
            if has_context and search_results:
                confidence = min(0.9, len(search_results) * 0.15 + 
                               sum(r.get('final_score', r.get('similarity_score', 0)) 
                                   for r in search_results) / len(search_results))
            else:
                # Если отвечаем из памяти модели, confidence ниже
                confidence = 0.6  # Средняя уверенность для ответов из памяти модели
            
            return {
                'answer': answer,
                'sources': sources,
                'confidence': confidence,
                'model_used': response.get('model', Config.CHAT_LLM_MODEL),
                'tokens_used': response.get('usage', {}).get('total_tokens', 0) if response.get('usage') else 0,
                'used_model_knowledge': not has_context  # Флаг, что использовались знания модели
            }
            
        except Exception as e:
            error_msg = str(e)
            print(f"Ошибка при генерации ответа: {e}")

            # Пользователю — нейтральное сообщение без внутренних деталей.
            # Технический текст ошибки остаётся в поле 'error' (для логов/админки).
            return {
                'answer': _SERVICE_UNAVAILABLE_MESSAGE,
                'sources': sources,
                'confidence': 0.0,
                'error': error_msg,
                'error_type': 'api_error'
            }
    
    def generate_response_without_rag(self, user_query: str, 
                                      conversation_history: List[Dict] = None) -> Dict:
        """Генерация ответа без использования RAG (чистый чат с моделью)"""
        
        # Проверяем, является ли провайдер fine-tuned моделью
        # Fine-tuned модель работает напрямую с вопросом без системного промпта
        is_finetuned = hasattr(self.provider, '__class__') and 'FineTuned' in self.provider.__class__.__name__
        
        if is_finetuned:
            # Для fine-tuned модели используем только вопрос пользователя
            # История разговора не поддерживается API
            messages = [{"role": "user", "content": user_query}]
        else:
            # Без поиска по документам — тот же промпт консультанта без блока контекста:
            # отвечать по общим сведениям о праве РК, а не отказываться.
            system_prompt = build_system_prompt(user_query, None)
            
            # Подготавливаем историю разговора
            messages = [{"role": "system", "content": system_prompt}]
            
            if conversation_history:
                for msg in conversation_history[-5:]:  # Последние 5 сообщений
                    messages.extend([
                        {"role": "user", "content": msg['user_query']},
                        {"role": "assistant", "content": msg['ai_response']}
                    ])
            
            # Добавляем текущий запрос
            messages.append({"role": "user", "content": user_query})
        
        try:
            # Вызываем LLM через провайдер
            # Для fine-tuned модели используем меньший max_tokens (API ограничивает до 1024)
            max_tokens = 512 if is_finetuned else Config.MAX_TOKENS
            temperature = 0.75 if is_finetuned else Config.TEMPERATURE
            
            response = self.provider.chat_completion(
                messages=messages,
                model=Config.CHAT_LLM_MODEL,
                temperature=temperature,
                max_tokens=max_tokens,
                top_p=0.92 if is_finetuned else 0.9,
                frequency_penalty=0.1 if not is_finetuned else None,
                presence_penalty=0.1 if not is_finetuned else None
            )
            
            answer = response['content']
            
            return {
                'answer': answer,
                'sources': [],  # Нет источников в режиме без RAG
                'confidence': 0.7,  # Средняя уверенность для ответов из памяти модели
                'model_used': response.get('model', Config.CHAT_LLM_MODEL),
                'tokens_used': response.get('usage', {}).get('total_tokens', 0) if response.get('usage') else 0,
                'used_model_knowledge': True,  # Всегда используем знания модели
                'rag_mode': False  # Флаг режима без RAG
            }
            
        except Exception as e:
            error_msg = str(e)
            print(f"Ошибка при генерации ответа (без RAG): {e}")

            return {
                'answer': _SERVICE_UNAVAILABLE_MESSAGE,
                'sources': [],
                'confidence': 0.0,
                'error': error_msg,
                'error_type': 'api_error',
                'rag_mode': False
            }
    
    def generate_summary(self, search_results: List[Dict], topic: str = None) -> str:
        """Генерация краткого резюме по найденным документам"""
        if not search_results:
            return "Документы не найдены для создания резюме."
        
        context = self._prepare_context(search_results)
        
        topic_part = f" по теме '{topic}'" if topic else ""
        
        prompt = f"""На основе следующих юридических документов создайте краткое и структурированное резюме{topic_part}:

{context}

Резюме должно быть:
- Кратким (не более 300 слов)
- Структурированным (используйте списки и заголовки)
- Точным (только факты из документов)
- На том языке, на котором задан запрос

Включите ссылки на источники [Источник 1], [Источник 2] и т.д."""

        try:
            response = self.provider.chat_completion(
                messages=[{"role": "user", "content": prompt}],
                model=Config.LLM_MODEL,
                temperature=0.3,
                max_tokens=800
            )
            
            return response['content']
            
        except Exception as e:
            return f"Ошибка при создании резюме: {str(e)}"
    
    def extract_key_points(self, text: str) -> List[str]:
        """Извлечение ключевых пунктов из текста документа"""
        prompt = f"""Извлеките ключевые пункты из следующего юридического текста:

{text[:2000]}  # Ограничиваем длину

Представьте результат в виде списка из 5-10 самых важных пунктов. Каждый пункт должен быть:
- Конкретным и информативным
- Не более 100 символов
- На том языке, на котором задан запрос

Формат: просто список без нумерации."""

        try:
            response = self.provider.chat_completion(
                messages=[{"role": "user", "content": prompt}],
                model=Config.LLM_MODEL,
                temperature=0.2,
                max_tokens=600
            )
            
            content = response['content']
            # Разбиваем на строки и очищаем
            points = [line.strip() for line in content.split('\n') if line.strip()]
            return points[:10]  # Максимум 10 пунктов
            
        except Exception as e:
            print(f"Ошибка при извлечении ключевых пунктов: {e}")
            return []
    
    def validate_legal_query(self, query: str) -> Dict:
        """Валидация и категоризация юридического запроса"""
        prompt = f"""Проанализируйте следующий запрос и определите:

Запрос: "{query}"

1. Является ли это юридическим вопросом? (да/нет)
2. Категория вопроса (если применимо): гражданское право, уголовное право, административное право, трудовое право, налоговое право, другое
3. Уровень сложности: простой, средний, сложный
4. Нужна ли консультация специалиста? (да/нет)

Ответьте в формате JSON:
{{
    "is_legal": true/false,
    "category": "категория",
    "complexity": "уровень",
    "needs_specialist": true/false,
    "recommendations": ["список рекомендаций"]
}}"""

        try:
            response = self.provider.chat_completion(
                messages=[{"role": "user", "content": prompt}],
                model=Config.LLM_MODEL,
                temperature=0.1,
                max_tokens=400
            )
            
            content = response['content']
            
            # Пытаемся распарсить JSON
            try:
                return json.loads(content)
            except json.JSONDecodeError:
                # Если не удалось распарсить, возвращаем базовую структуру
                return {
                    "is_legal": True,
                    "category": "общий",
                    "complexity": "средний",
                    "needs_specialist": False,
                    "recommendations": ["Проконсультируйтесь с юристом для получения персональной консультации"]
                }
                
        except Exception as e:
            error_msg = str(e)
            print(f"Ошибка при валидации запроса: {e}")
            
            # Если ошибка API ключа, возвращаем базовую валидацию без вызова API
            if "неверный api ключ" in error_msg.lower() or "invalid_api_key" in error_msg.lower() or "401" in error_msg:
                return {
                    "is_legal": True,
                    "category": "общий",
                    "complexity": "средний",
                    "needs_specialist": False,
                    "recommendations": ["⚠️ LLM провайдер недоступен. Проверьте настройки Ollama или Fine-tuned модели в /admin"]
                }
            
            return {
                "is_legal": True,
                "category": "общий",
                "complexity": "средний",
                "needs_specialist": False,
                "recommendations": []
            } 