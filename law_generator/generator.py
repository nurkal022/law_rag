from typing import Dict, List, Optional, Any
from datetime import datetime, date
import json
import uuid
from dataclasses import dataclass
from .templates import DocumentTemplates
from .validator import DataValidator
from llm_providers.base import LLMProvider
from llm_providers.factory import LLMProviderFactory
from config import Config


@dataclass
class LawProjectData:
    """Структура данных для генерации законопроекта"""
    # Основная информация
    title_kz: str = ""
    title_ru: str = ""
    initiator: str = ""
    initiator_type: str = ""  # "депутат", "правительство", "министерство"
    problem_description: str = ""
    goals: List[str] = None
    target_audience: str = ""
    
    # Настройки генерации
    generation_language: str = "bilingual"  # "ru", "kz", "bilingual"
    
    # Правовое обоснование
    current_legislation_gaps: str = ""
    international_experience: str = ""
    constitutional_basis: str = ""
    hierarchy_compliance: str = ""
    
    # Финансово-экономическое обоснование
    budget_impact: str = ""
    cost_estimates: Dict[str, float] = None
    funding_sources: List[str] = None
    economic_benefits: str = ""
    
    # Регулирующее воздействие
    business_impact: str = ""
    citizen_impact: str = ""
    administrative_burden: str = ""
    implementation_complexity: str = ""
    
    # Основной текст закона
    law_structure: List[Dict] = None  # главы, статьи, пункты
    preamble: str = ""
    final_provisions: str = ""
    transitional_provisions: str = ""
    
    # Сравнительная таблица (для изменений)
    changes_table: List[Dict] = None
    
    # Дополнительная информация
    corruption_risks: str = ""
    social_consequences: str = ""
    new_terms: Dict[str, str] = None
    implementation_timeline: str = ""
    
    def __post_init__(self):
        if self.goals is None:
            self.goals = []
        if self.cost_estimates is None:
            self.cost_estimates = {}
        if self.funding_sources is None:
            self.funding_sources = []
        if self.law_structure is None:
            self.law_structure = []
        if self.changes_table is None:
            self.changes_table = []
        if self.new_terms is None:
            self.new_terms = {}


class LawProjectGenerator:
    """Генератор законопроектов для Республики Казахстан"""
    
    def __init__(self, provider: LLMProvider = None, api_key: str = None, database_manager=None):
        """
        Инициализация генератора законопроектов
        
        Args:
            provider: Провайдер LLM (если None, создается из конфигурации)
            api_key: API ключ (для обратной совместимости с OpenAI)
            database_manager: Менеджер базы данных
        """
        if provider:
            self.provider = provider
        else:
            # Если передан api_key, используем OpenAI
            if api_key:
                from llm_providers.openai_provider import OpenAIProvider
                self.provider = OpenAIProvider(api_key=api_key, default_model=Config.LLM_MODEL)
            else:
                # Иначе используем провайдер из конфигурации
                self.provider = LLMProviderFactory.get_current_provider()
        
        if not self.provider:
            raise ValueError("Не удалось инициализировать LLM провайдер. Проверьте настройки.")
        
        self.db = database_manager
        self.templates = DocumentTemplates()
        self.validator = DataValidator()
        
    def generate_full_document(self, data: LawProjectData) -> Dict[str, Any]:
        """Генерация полного документа законопроекта"""
        
        # Валидация входных данных
        validation_result = self.validator.validate_project_data(data)
        if not validation_result["is_valid"]:
            return {
                "success": False,
                "error": "Ошибка валидации данных",
                "validation_errors": validation_result["errors"],
                "missing_fields": validation_result["missing_required"],
                "suggestions": validation_result["suggestions"]
            }
        
        project_id = str(uuid.uuid4())
        generation_date = datetime.now()
        
        try:
            # Генерируем все 13 разделов
            sections = {}
            
            # 1. Титульный лист
            sections["title_page"] = self._generate_title_page(data, project_id, generation_date)
            
            # 2. Аннотация
            sections["annotation"] = self._generate_annotation(data)
            
            # 3. Пояснительная записка
            sections["explanatory_note"] = self._generate_explanatory_note(data)
            
            # 4. Основной текст закона
            sections["main_text"] = self._generate_main_law_text(data)
            
            # 5. Сравнительная таблица
            sections["comparison_table"] = self._generate_comparison_table(data)
            
            # 6. Финансово-экономическое обоснование
            sections["financial_justification"] = self._generate_financial_justification(data)
            
            # 7. Оценка регулирующего воздействия
            sections["regulatory_impact"] = self._generate_regulatory_impact_assessment(data)
            
            # 8. Акт соответствия
            sections["compliance_act"] = self._generate_compliance_act(data)
            
            # 9. Антикоррупционная экспертиза
            sections["anticorruption_review"] = self._generate_anticorruption_review(data)
            
            # 10. Прогноз социально-экономических последствий
            sections["impact_forecast"] = self._generate_impact_forecast(data)
            
            # 11. Глоссарий терминов
            sections["glossary"] = self._generate_glossary(data)
            
            # 12. Машиночитаемое приложение
            sections["machine_readable"] = self._generate_machine_readable_appendix(data, project_id)
            
            # 13. Аудит-лог версий
            sections["audit_log"] = self._generate_audit_log(project_id, generation_date)
            
            # Сохраняем в базу данных если доступна
            if self.db:
                self._save_project_to_db(project_id, data, sections)
            
            return {
                "success": True,
                "project_id": project_id,
                "generation_date": generation_date.isoformat(),
                "sections": sections,
                "metadata": {
                    "title_ru": data.title_ru,
                    "title_kz": data.title_kz,
                    "initiator": data.initiator,
                    "total_sections": 13
                }
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": f"Ошибка генерации документа: {str(e)}",
                "project_id": project_id
            }
    
    def _generate_title_page(self, data: LawProjectData, project_id: str, date: datetime) -> Dict[str, str]:
        """Генерация титульного листа"""
        
        # Определяем основной язык для генерации
        primary_language = "русском" if data.generation_language == "ru" else "казахском" if data.generation_language == "kz" else "двуязычном"
        
        prompt = f"""Создайте профессиональный титульный лист для законопроекта Республики Казахстан на {primary_language} языке:

ДАННЫЕ ПРОЕКТА:
- Название (русский): {data.title_ru}
- Название (казахский): {data.title_kz}
- Инициатор: {data.initiator} ({data.initiator_type})
- Дата: {date.strftime('%d.%m.%Y')}
- ID проекта: {project_id}
- Язык документа: {data.generation_language}

ТРЕБОВАНИЯ К ТИТУЛЬНОМУ ЛИСТУ:
1. Официальные реквизиты Республики Казахстан
2. Полное наименование законопроекта
3. Информация об инициаторе
4. Дата и регистрационный номер
5. Соответствие государственным стандартам оформления

Создайте структурированный титульный лист с правильным форматированием."""
        
        try:
            response = self.provider.chat_completion(
                messages=[{"role": "user", "content": prompt}],
                model=Config.LLM_MODEL,
                temperature=0.3,
                max_tokens=1000
            )
            
            content = response['content']
            
            return {
                "content": content,
                "kz_version": self._translate_to_kazakh(content),
                "metadata": {
                    "project_id": project_id,
                    "generation_date": date.isoformat(),
                    "initiator": data.initiator
                }
            }
            
        except Exception as e:
            return {"content": f"Ошибка генерации титульного листа: {str(e)}"}
    
    def _generate_annotation(self, data: LawProjectData) -> Dict[str, str]:
        """Генерация аннотации (1 страница)"""
        
        goals_text = ", ".join(data.goals) if data.goals else "не указаны"
        
        prompt = f"""Создайте краткую аннотацию (не более 1 страницы) для законопроекта:

НАЗВАНИЕ: {data.title_ru}
ПРОБЛЕМА: {data.problem_description}
ЦЕЛИ: {goals_text}
ЦЕЛЕВАЯ АУДИТОРИЯ: {data.target_audience}

Аннотация должна быть:
- Краткой и понятной для широкой аудитории
- Содержать суть проблемы и предлагаемого решения
- Указывать ключевые изменения
- Подходить для парламентских бюллетеней и СМИ
- Не более 300 слов"""
        
        try:
            response = self.provider.chat_completion(
                messages=[{"role": "user", "content": prompt}],
                model=Config.LLM_MODEL,
                temperature=0.4,
                max_tokens=800
            )
            
            content = response['content']
            
            return {
                "content": content,
                "word_count": len(content.split()),
                "target_audience": data.target_audience
            }
            
        except Exception as e:
            return {"content": f"Ошибка генерации аннотации: {str(e)}"}
    
    def _generate_explanatory_note(self, data: LawProjectData) -> Dict[str, str]:
        """Генерация пояснительной записки"""
        
        prompt = f"""Создайте развернутую пояснительную записку для законопроекта согласно ст. 18 Закона РК "О нормативных правовых актах":

ДАННЫЕ:
- Название: {data.title_ru}
- Проблема: {data.problem_description}
- Цели: {', '.join(data.goals) if data.goals else 'не указаны'}
- Пробелы в текущем законодательстве: {data.current_legislation_gaps}
- Зарубежный опыт: {data.international_experience}

СТРУКТУРА ПОЯСНИТЕЛЬНОЙ ЗАПИСКИ:
1. Обоснование необходимости правового регулирования
2. Цели и ожидаемые результаты (с KPI)
3. Анализ текущего правового поля и выявленных коллизий
4. Сравнительный анализ зарубежного опыта
5. Ожидаемые социально-экономические последствия

Используйте официальный стиль, ссылки на действующее законодательство РК."""
        
        try:
            response = self.provider.chat_completion(
                messages=[{"role": "user", "content": prompt}],
                model=Config.LLM_MODEL,
                temperature=0.3,
                max_tokens=2000
            )
            
            content = response['content']
            
            return {
                "content": content,
                "sections": ["обоснование", "цели", "анализ", "зарубежный_опыт", "последствия"],
                "compliance": "Ст. 18 Закона РК 'О нормативных правовых актах'"
            }
            
        except Exception as e:
            return {"content": f"Ошибка генерации пояснительной записки: {str(e)}"}
    
    def _generate_main_law_text(self, data: LawProjectData) -> Dict[str, Any]:
        """Генерация основного текста закона"""
        
        structure_text = ""
        if data.law_structure:
            structure_text = "\n".join([f"Глава {i+1}: {chapter.get('title', '')}" 
                                      for i, chapter in enumerate(data.law_structure)])
        
        prompt = f"""Создайте основной текст закона Республики Казахстан:

НАЗВАНИЕ: {data.title_ru}
СТРУКТУРА: {structure_text}
ПРЕАМБУЛА: {data.preamble}
ЗАКЛЮЧИТЕЛЬНЫЕ ПОЛОЖЕНИЯ: {data.final_provisions}
ПЕРЕХОДНЫЕ ПОЛОЖЕНИЯ: {data.transitional_provisions}

Требования:
- Соответствие ГОСТ 2.105-2019
- Соответствие Методике юридической техники Минюста РК
- Четкая структура: главы, статьи, пункты
- Двуязычная параллель (рус ↔ каз)
- Корректная юридическая терминология
- Ссылки на действующее законодательство РК

Создайте полный текст закона с правильной нумерацией статей."""
        
        try:
            response = self.provider.chat_completion(
                messages=[{"role": "user", "content": prompt}],
                model=Config.LLM_MODEL,
                temperature=0.2,
                max_tokens=3000
            )
            
            content = response['content']
            
            return {
                "content": content,
                "kz_version": self._translate_to_kazakh(content),
                "structure": data.law_structure,
                "compliance": ["ГОСТ 2.105-2019", "Методика юртехники Минюста РК"],
                "article_count": content.count("Статья")
            }
            
        except Exception as e:
            return {"content": f"Ошибка генерации основного текста: {str(e)}"}
    
    def _generate_comparison_table(self, data: LawProjectData) -> Dict[str, Any]:
        """Генерация сравнительной таблицы изменений"""
        
        if not data.changes_table:
            return {
                "content": "Сравнительная таблица не требуется - новый закон",
                "is_new_law": True
            }
        
        prompt = f"""Создайте сравнительную таблицу изменений в формате Комитета законодательства Мажилиса:

ИЗМЕНЕНИЯ: {json.dumps(data.changes_table, ensure_ascii=False, indent=2)}

Формат таблицы:
| Действующая норма | Предлагаемая норма | Обоснование изменения |

Для каждого изменения укажите:
- Точную ссылку на статью/пункт действующего закона
- Предлагаемую редакцию
- Краткое обоснование необходимости изменения"""
        
        try:
            response = self.provider.chat_completion(
                messages=[{"role": "user", "content": prompt}],
                model=Config.LLM_MODEL,
                temperature=0.3,
                max_tokens=2000
            )
            
            content = response['content']
            
            return {
                "content": content,
                "changes_count": len(data.changes_table),
                "format": "3-колоночная таблица Мажилиса",
                "is_new_law": False
            }
            
        except Exception as e:
            return {"content": f"Ошибка генерации сравнительной таблицы: {str(e)}"}
    
    def _generate_financial_justification(self, data: LawProjectData) -> Dict[str, Any]:
        """Генерация финансово-экономического обоснования"""
        
        cost_text = ""
        if data.cost_estimates:
            cost_text = "\n".join([f"{category}: {amount:,.2f} тенге" 
                                 for category, amount in data.cost_estimates.items()])
        
        funding_text = ", ".join(data.funding_sources) if data.funding_sources else "не указаны"
        
        prompt = f"""Создайте финансово-экономическое обоснование для рассмотрения Минфином и Счетным комитетом:

ДАННЫЕ:
- Влияние на бюджет: {data.budget_impact}
- Оценки затрат: {cost_text}
- Источники финансирования: {funding_text}
- Экономические выгоды: {data.economic_benefits}

ТРЕБОВАНИЯ:
- Расчет бюджетных затрат/доходов (три сценария: оптимистичный, реалистичный, пессимистичный)
- Конкретные источники финансирования
- Обоснование экономической эффективности
- Расчет окупаемости (если применимо)
- Влияние на макроэкономические показатели

Создайте подробное экономическое обоснование с конкретными цифрами."""
        
        try:
            response = self.provider.chat_completion(
                messages=[{"role": "user", "content": prompt}],
                model=Config.LLM_MODEL,
                temperature=0.3,
                max_tokens=2000
            )
            
            content = response['content']
            
            return {
                "content": content,
                "cost_estimates": data.cost_estimates,
                "funding_sources": data.funding_sources,
                "scenarios": ["оптимистичный", "реалистичный", "пессимистичный"],
                "reviewers": ["Минфин РК", "Счетный комитет РК"]
            }
            
        except Exception as e:
            return {"content": f"Ошибка генерации финансового обоснования: {str(e)}"}
    
    def _generate_regulatory_impact_assessment(self, data: LawProjectData) -> Dict[str, Any]:
        """Генерация оценки регулирующего воздействия (ОРВ)"""
        
        prompt = f"""Создайте оценку регулирующего воздействия согласно Приказу МНЭ РК № 142:

ДАННЫЕ:
- Влияние на бизнес: {data.business_impact}
- Влияние на граждан: {data.citizen_impact}
- Административная нагрузка: {data.administrative_burden}
- Сложность реализации: {data.implementation_complexity}

СТРУКТУРА ОРВ:
1. Качественная оценка воздействия
2. Количественная оценка (где возможно)
3. Влияние на бизнес-процессы
4. Влияние на социальную сферу
5. Административные расходы
6. Альтернативные варианты регулирования
7. Мониторинг эффективности

Используйте методологию МНЭ РК для ОРВ."""
        
        try:
            response = self.provider.chat_completion(
                messages=[{"role": "user", "content": prompt}],
                model=Config.LLM_MODEL,
                temperature=0.3,
                max_tokens=2000
            )
            
            content = response['content']
            
            return {
                "content": content,
                "methodology": "Приказ МНЭ РК № 142 об ОРВ",
                "assessment_types": ["качественная", "количественная"],
                "impact_areas": ["бизнес", "граждане", "администрация"]
            }
            
        except Exception as e:
            return {"content": f"Ошибка генерации ОРВ: {str(e)}"}
    
    def _generate_compliance_act(self, data: LawProjectData) -> Dict[str, Any]:
        """Генерация акта соответствия"""
        
        prompt = f"""Создайте акт соответствия для юридической экспертизы Минюста РК:

ДАННЫЕ:
- Название закона: {data.title_ru}
- Конституционная основа: {data.constitutional_basis}
- Соответствие иерархии НПА: {data.hierarchy_compliance}

ЧЕК-ЛИСТ СООТВЕТСТВИЯ:
□ Соответствие Конституции РК
□ Соответствие международным договорам РК
□ Соответствие иерархии нормативных правовых актов
□ Соответствие принципам права
□ Отсутствие противоречий с действующим законодательством
□ Соблюдение правил юридической техники
□ Правильность терминологии

Для каждого пункта укажите:
- Статус соответствия (соответствует/не соответствует/требует доработки)
- Обоснование
- Ссылки на конкретные нормы"""
        
        try:
            response = self.provider.chat_completion(
                messages=[{"role": "user", "content": prompt}],
                model=Config.LLM_MODEL,
                temperature=0.2,
                max_tokens=1500
            )
            
            content = response['content']
            
            return {
                "content": content,
                "checklist_items": 7,
                "reviewer": "Министерство юстиции РК",
                "compliance_areas": ["Конституция", "международные договоры", "иерархия НПА"]
            }
            
        except Exception as e:
            return {"content": f"Ошибка генерации акта соответствия: {str(e)}"}
    
    def _generate_anticorruption_review(self, data: LawProjectData) -> Dict[str, Any]:
        """Генерация антикоррупционной экспертизы"""
        
        prompt = f"""Проведите антикоррупционную экспертизу согласно ст. 10-1 Закона РК "О НПА":

ДАННЫЕ:
- Название: {data.title_ru}
- Коррупционные риски: {data.corruption_risks}

АНАЛИЗ КОРРУПЦИОГЕННЫХ ФАКТОРОВ:
1. Широта дискреционных полномочий
2. Определение компетенции по формуле "вправе"
3. Выборочное изменение объема прав
4. Чрезмерная свобода подзаконного нормотворчества
5. Принятие нормативного правового акта за пределами компетенции
6. Отсутствие или неполнота административных процедур
7. Отсутствие контроля за деятельностью субъектов права

Для каждого фактора:
- Наличие/отсутствие в проекте
- Степень риска (высокий/средний/низкий)
- Способы устранения
- Рекомендации по доработке"""
        
        try:
            response = self.provider.chat_completion(
                messages=[{"role": "user", "content": prompt}],
                model=Config.LLM_MODEL,
                temperature=0.2,
                max_tokens=1500
            )
            
            content = response['content']
            
            return {
                "content": content,
                "legal_basis": "Ст. 10-1 Закона РК 'О НПА'",
                "risk_factors": 7,
                "overall_risk": "требует анализа"
            }
            
        except Exception as e:
            return {"content": f"Ошибка антикоррупционной экспертизы: {str(e)}"}
    
    def _generate_impact_forecast(self, data: LawProjectData) -> Dict[str, Any]:
        """Генерация прогноза социально-экономических последствий"""
        
        prompt = f"""Создайте прогноз социально-экономических последствий:

ДАННЫЕ:
- Социальные последствия: {data.social_consequences}
- Экономические выгоды: {data.economic_benefits}
- Временные рамки реализации: {data.implementation_timeline}

СТРУКТУРА ПРОГНОЗА:
1. SWOT-анализ:
   - Strengths (Сильные стороны)
   - Weaknesses (Слабые стороны)  
   - Opportunities (Возможности)
   - Threats (Угрозы)

2. Ключевые показатели "до/после":
   - Социальные индикаторы
   - Экономические показатели
   - Показатели эффективности

3. Временные горизонты:
   - Краткосрочные эффекты (1 год)
   - Среднесрочные эффекты (3 года)
   - Долгосрочные эффекты (5+ лет)

Используйте конкретные метрики и измеримые показатели."""
        
        try:
            response = self.provider.chat_completion(
                messages=[{"role": "user", "content": prompt}],
                model=Config.LLM_MODEL,
                temperature=0.3,
                max_tokens=1800
            )
            
            content = response['content']
            
            return {
                "content": content,
                "analysis_method": "SWOT + показатели до/после",
                "time_horizons": ["1 год", "3 года", "5+ лет"],
                "target_committees": "профильные комитеты парламента"
            }
            
        except Exception as e:
            return {"content": f"Ошибка генерации прогноза: {str(e)}"}
    
    def _generate_glossary(self, data: LawProjectData) -> Dict[str, Any]:
        """Генерация глоссария терминов"""
        
        terms_text = ""
        if data.new_terms:
            terms_text = "\n".join([f"{term}: {definition}" 
                                  for term, definition in data.new_terms.items()])
        
        prompt = f"""Создайте глоссарий терминов для обеспечения единообразной терминологии:

НОВЫЕ/УТОЧНЕННЫЕ ТЕРМИНЫ: {terms_text}

ТРЕБОВАНИЯ:
- Двуязычные определения (казахский + русский)
- Точные и однозначные формулировки
- Соответствие существующей правовой терминологии РК
- Избежание синонимии и многозначности
- Алфавитный порядок

Для каждого термина укажите:
1. Термин на казахском языке
2. Термин на русском языке  
3. Определение на казахском языке
4. Определение на русском языке
5. Источник или обоснование (если есть)"""
        
        try:
            response = self.provider.chat_completion(
                messages=[{"role": "user", "content": prompt}],
                model=Config.LLM_MODEL,
                temperature=0.2,
                max_tokens=1200
            )
            
            content = response['content']
            
            return {
                "content": content,
                "terms_count": len(data.new_terms) if data.new_terms else 0,
                "languages": ["казахский", "русский"],
                "purpose": "единообразие терминологии в системе права"
            }
            
        except Exception as e:
            return {"content": f"Ошибка генерации глоссария: {str(e)}"}
    
    def _generate_machine_readable_appendix(self, data: LawProjectData, project_id: str) -> Dict[str, Any]:
        """Генерация машиночитаемого приложения"""
        
        # Создаем структурированные метаданные в формате Akoma Ntoso-XML и JSON-LD
        metadata = {
            "@context": "https://www.akomantoso.org/",
            "@type": "Bill",
            "identifier": project_id,
            "title": {
                "ru": data.title_ru,
                "kz": data.title_kz
            },
            "date": datetime.now().isoformat(),
            "initiator": data.initiator,
            "status": "draft",
            "articles": [],
            "amendments": data.changes_table if data.changes_table else [],
            "uuid_map": {}
        }
        
        # Добавляем UUID для каждой нормы
        if data.law_structure:
            for i, chapter in enumerate(data.law_structure):
                chapter_uuid = str(uuid.uuid4())
                metadata["uuid_map"][f"chapter_{i+1}"] = chapter_uuid
                
                if "articles" in chapter:
                    for j, article in enumerate(chapter["articles"]):
                        article_uuid = str(uuid.uuid4())
                        metadata["uuid_map"][f"article_{i+1}_{j+1}"] = article_uuid
        
        xml_content = self._generate_akoma_ntoso_xml(metadata)
        json_content = json.dumps(metadata, ensure_ascii=False, indent=2)
        
        return {
            "xml_format": xml_content,
            "json_format": json_content,
            "metadata": metadata,
            "integration_systems": ["E-Parliament", "Adilet", "Documentolog"],
            "standards": ["Akoma Ntoso-XML", "JSON-LD"],
            "uuid_count": len(metadata["uuid_map"])
        }
    
    def _generate_audit_log(self, project_id: str, date: datetime) -> Dict[str, Any]:
        """Генерация аудит-лога версий"""
        
        audit_entry = {
            "version": "1.0.0",
            "date": date.isoformat(),
            "author": "Law Generator System",
            "description": "Первоначальная генерация законопроекта",
            "changes": [
                "Создание всех 13 разделов документа",
                "Инициализация структуры законопроекта",
                "Генерация машиночитаемых метаданных"
            ],
            "validation_status": "passed",
            "project_id": project_id
        }
        
        audit_log = {
            "project_id": project_id,
            "versions": [audit_entry],
            "creation_date": date.isoformat(),
            "last_modified": date.isoformat(),
            "total_versions": 1
        }
        
        return {
            "content": self._format_audit_log_table(audit_log),
            "structured_data": audit_log,
            "purpose": "прозрачность и прослеживаемость изменений"
        }
    
    def _format_audit_log_table(self, audit_log: Dict) -> str:
        """Форматирование аудит-лога в виде таблицы"""
        
        table = "| Версия | Дата | Автор | Описание изменений |\n"
        table += "|--------|------|-------|-------------------|\n"
        
        for version in audit_log["versions"]:
            changes_text = "; ".join(version["changes"])
            table += f"| {version['version']} | {version['date'][:10]} | {version['author']} | {changes_text} |\n"
        
        return table
    
    def _generate_akoma_ntoso_xml(self, metadata: Dict) -> str:
        """Генерация XML в формате Akoma Ntoso"""
        
        xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<akomaNtoso xmlns="http://www.akomantoso.org/2.0">
    <bill>
        <meta>
            <identification>
                <FRBRWork>
                    <FRBRthis value="{metadata['identifier']}"/>
                    <FRBRuri value="/kz/bill/{metadata['identifier']}"/>
                    <FRBRdate date="{metadata['date'][:10]}"/>
                    <FRBRauthor href="#initiator"/>
                </FRBRWork>
            </identification>
            <publication date="{metadata['date'][:10]}" name="draft"/>
        </meta>
        <preface>
            <docTitle>
                <docLangTitle xml:lang="ru">{metadata['title']['ru']}</docLangTitle>
                <docLangTitle xml:lang="kk">{metadata['title']['kz']}</docLangTitle>
            </docTitle>
            <docAuthor>{metadata['initiator']}</docAuthor>
        </preface>
        <body>
            <!-- Структура закона будет здесь -->
        </body>
    </bill>
</akomaNtoso>"""
        
        return xml
    
    def _translate_to_kazakh(self, text: str) -> str:
        """Перевод текста на казахский язык"""
        
        if not text or len(text.strip()) == 0:
            return ""
        
        prompt = f"""Переведите следующий официальный правовой текст на казахский язык:

{text}

Требования:
- Используйте официальную юридическую терминологию Казахстана
- Сохраните структуру и форматирование
- Обеспечьте точность перевода правовых понятий
- Используйте принятые в РК стандарты перевода НПА"""
        
        try:
            response = self.provider.chat_completion(
                messages=[{"role": "user", "content": prompt}],
                model=Config.LLM_MODEL,
                temperature=0.2,
                max_tokens=len(text.split()) * 2  # Приблизительная оценка
            )
            
            return response['content']
            
        except Exception as e:
            return f"[Ошибка перевода: {str(e)}]"
    
    def _save_project_to_db(self, project_id: str, data: LawProjectData, sections: Dict):
        """Сохранение проекта в базу данных"""
        
        if not self.db:
            return
        
        try:
            # Здесь будет логика сохранения в базу данных
            # Пока просто логируем
            print(f"Сохранен законопроект {project_id} в базу данных")
            
        except Exception as e:
            print(f"Ошибка сохранения в БД: {e}")
    
    def get_data_collection_questions(self) -> List[Dict[str, Any]]:
        """Получение списка вопросов для сбора данных от пользователя"""
        
        return [
            {
                "id": "basic_info",
                "title": "Основная информация",
                "questions": [
                    {"field": "title_ru", "question": "Название законопроекта (на русском языке)", "type": "text", "required": True},
                    {"field": "title_kz", "question": "Название законопроекта (на казахском языке)", "type": "text", "required": True},
                    {"field": "initiator", "question": "Инициатор законопроекта", "type": "text", "required": True},
                    {"field": "initiator_type", "question": "Тип инициатора", "type": "select", "options": ["депутат", "правительство", "министерство"], "required": True}
                ]
            },
            {
                "id": "problem_analysis",
                "title": "Анализ проблемы",
                "questions": [
                    {"field": "problem_description", "question": "Описание проблемы, требующей правового регулирования", "type": "textarea", "required": True},
                    {"field": "current_legislation_gaps", "question": "Пробелы в действующем законодательстве", "type": "textarea", "required": True},
                    {"field": "target_audience", "question": "Целевая аудитория (кого касается закон)", "type": "text", "required": True}
                ]
            },
            {
                "id": "goals_objectives",
                "title": "Цели и задачи",
                "questions": [
                    {"field": "goals", "question": "Цели законопроекта (перечислите через запятую)", "type": "textarea", "required": True},
                    {"field": "international_experience", "question": "Релевантный зарубежный опыт", "type": "textarea", "required": False}
                ]
            },
            {
                "id": "legal_basis",
                "title": "Правовая основа",
                "questions": [
                    {"field": "constitutional_basis", "question": "Конституционная основа", "type": "textarea", "required": True},
                    {"field": "hierarchy_compliance", "question": "Соответствие иерархии НПА", "type": "textarea", "required": True}
                ]
            },
            {
                "id": "economic_impact",
                "title": "Экономическое воздействие",
                "questions": [
                    {"field": "budget_impact", "question": "Влияние на государственный бюджет", "type": "textarea", "required": True},
                    {"field": "economic_benefits", "question": "Ожидаемые экономические выгоды", "type": "textarea", "required": True},
                    {"field": "funding_sources", "question": "Источники финансирования (через запятую)", "type": "text", "required": False}
                ]
            },
            {
                "id": "regulatory_impact",
                "title": "Регулирующее воздействие",
                "questions": [
                    {"field": "business_impact", "question": "Влияние на бизнес", "type": "textarea", "required": True},
                    {"field": "citizen_impact", "question": "Влияние на граждан", "type": "textarea", "required": True},
                    {"field": "administrative_burden", "question": "Административная нагрузка", "type": "textarea", "required": True}
                ]
            },
            {
                "id": "risks_consequences",
                "title": "Риски и последствия",
                "questions": [
                    {"field": "corruption_risks", "question": "Потенциальные коррупционные риски", "type": "textarea", "required": True},
                    {"field": "social_consequences", "question": "Социальные последствия", "type": "textarea", "required": True},
                    {"field": "implementation_timeline", "question": "Сроки и этапы реализации", "type": "textarea", "required": False}
                ]
            }
        ] 