"""
Шаблоны документов для генерации законопроектов РК
"""

from typing import Dict, List
from datetime import datetime


class DocumentTemplates:
    """Шаблоны для различных разделов законопроекта"""
    
    def __init__(self):
        self.templates = {
            "title_page": self._get_title_page_template(),
            "annotation": self._get_annotation_template(),
            "explanatory_note": self._get_explanatory_template(),
            "main_text": self._get_main_text_template(),
            "comparison_table": self._get_comparison_template(),
            "financial": self._get_financial_template(),
            "regulatory_impact": self._get_regulatory_template(),
            "compliance": self._get_compliance_template(),
            "anticorruption": self._get_anticorruption_template(),
            "forecast": self._get_forecast_template(),
            "glossary": self._get_glossary_template(),
            "machine_readable": self._get_machine_readable_template(),
            "audit_log": self._get_audit_log_template()
        }
    
    def get_template(self, section_name: str) -> str:
        """Получить шаблон для конкретного раздела"""
        return self.templates.get(section_name, "")
    
    def _get_title_page_template(self) -> str:
        return """
РЕСПУБЛИКА КАЗАХСТАН
ПАРЛАМЕНТ РЕСПУБЛИКИ КАЗАХСТАН

ПРОЕКТ ЗАКОНА РЕСПУБЛИКИ КАЗАХСТАН

"{title_ru}"

"{title_kz}"

Инициатор: {initiator}
Дата подготовки: {date}
Регистрационный номер: {project_id}

г. Нур-Султан
{year}
"""

    def _get_annotation_template(self) -> str:
        return """
АННОТАЦИЯ

к проекту Закона Республики Казахстан "{title}"

Настоящий законопроект направлен на {main_purpose}.

Основная проблема: {problem}

Цели законопроекта: {goals}

Ключевые изменения: {changes}

Ожидаемые результаты: {results}

Целевая аудитория: {target_audience}
"""

    def _get_explanatory_template(self) -> str:
        return """
ПОЯСНИТЕЛЬНАЯ ЗАПИСКА
к проекту Закона Республики Казахстан "{title}"

1. ОБОСНОВАНИЕ НЕОБХОДИМОСТИ ПРАВОВОГО РЕГУЛИРОВАНИЯ

{necessity_justification}

2. ЦЕЛИ И ОЖИДАЕМЫЕ РЕЗУЛЬТАТЫ

{goals_and_results}

3. АНАЛИЗ ТЕКУЩЕГО ПРАВОВОГО ПОЛЯ

{current_legislation_analysis}

4. СРАВНИТЕЛЬНЫЙ АНАЛИЗ ЗАРУБЕЖНОГО ОПЫТА

{international_experience}

5. ОЖИДАЕМЫЕ СОЦИАЛЬНО-ЭКОНОМИЧЕСКИЕ ПОСЛЕДСТВИЯ

{expected_consequences}
"""

    def _get_main_text_template(self) -> str:
        return """
ЗАКОН РЕСПУБЛИКИ КАЗАХСТАН

"{title}"

{preamble}

Глава 1. ОБЩИЕ ПОЛОЖЕНИЯ

Статья 1. Основные понятия

В настоящем Законе используются следующие основные понятия:
{definitions}

Статья 2. Сфера применения Закона

{scope_of_application}

{additional_chapters}

Глава {final_chapter}. ЗАКЛЮЧИТЕЛЬНЫЕ И ПЕРЕХОДНЫЕ ПОЛОЖЕНИЯ

{final_provisions}

{transitional_provisions}

Президент
Республики Казахстан                          {president_name}
"""

    def _get_comparison_template(self) -> str:
        return """
СРАВНИТЕЛЬНАЯ ТАБЛИЦА
к проекту Закона Республики Казахстан "{title}"

| Действующая норма | Предлагаемая норма | Обоснование изменения |
|-------------------|--------------------|-----------------------|
{comparison_rows}
"""

    def _get_financial_template(self) -> str:
        return """
ФИНАНСОВО-ЭКОНОМИЧЕСКОЕ ОБОСНОВАНИЕ
к проекту Закона Республики Казахстан "{title}"

1. ВЛИЯНИЕ НА ГОСУДАРСТВЕННЫЙ БЮДЖЕТ

{budget_impact}

2. РАСЧЕТ ЗАТРАТ ПО СЦЕНАРИЯМ

2.1. Оптимистичный сценарий:
{optimistic_scenario}

2.2. Реалистичный сценарий:
{realistic_scenario}

2.3. Пессимистичный сценарий:
{pessimistic_scenario}

3. ИСТОЧНИКИ ФИНАНСИРОВАНИЯ

{funding_sources}

4. ЭКОНОМИЧЕСКАЯ ЭФФЕКТИВНОСТЬ

{economic_efficiency}

5. ОКУПАЕМОСТЬ

{payback_analysis}
"""

    def _get_regulatory_template(self) -> str:
        return """
ОЦЕНКА РЕГУЛИРУЮЩЕГО ВОЗДЕЙСТВИЯ (ОРВ)
к проекту Закона Республики Казахстан "{title}"

Подготовлено в соответствии с Приказом МНЭ РК № 142

1. КАЧЕСТВЕННАЯ ОЦЕНКА ВОЗДЕЙСТВИЯ

{qualitative_assessment}

2. КОЛИЧЕСТВЕННАЯ ОЦЕНКА ВОЗДЕЙСТВИЯ

{quantitative_assessment}

3. ВЛИЯНИЕ НА БИЗНЕС

{business_impact}

4. ВЛИЯНИЕ НА ГРАЖДАН

{citizen_impact}

5. АДМИНИСТРАТИВНЫЕ РАСХОДЫ

{administrative_costs}

6. АЛЬТЕРНАТИВНЫЕ ВАРИАНТЫ

{alternatives}

7. МОНИТОРИНГ ЭФФЕКТИВНОСТИ

{monitoring}
"""

    def _get_compliance_template(self) -> str:
        return """
АКТ СООТВЕТСТВИЯ
к проекту Закона Республики Казахстан "{title}"

ЧЕК-ЛИСТ СООТВЕТСТВИЯ:

□ Соответствие Конституции РК: {constitution_compliance}
□ Соответствие международным договорам: {international_compliance}
□ Соответствие иерархии НПА: {hierarchy_compliance}
□ Соответствие принципам права: {principles_compliance}
□ Отсутствие противоречий: {no_contradictions}
□ Правила юридической техники: {legal_technique}
□ Терминология: {terminology}

ЗАКЛЮЧЕНИЕ:
{conclusion}

Эксперт:                                      {expert_name}
Дата:                                         {date}
"""

    def _get_anticorruption_template(self) -> str:
        return """
АНТИКОРРУПЦИОННАЯ ЭКСПЕРТИЗА
к проекту Закона Республики Казахстан "{title}"

Проведена в соответствии со ст. 10-1 Закона РК "О НПА"

АНАЛИЗ КОРРУПЦИОГЕННЫХ ФАКТОРОВ:

1. Широта дискреционных полномочий: {discretionary_powers}
2. Компетенция по формуле "вправе": {competence_formula}
3. Выборочное изменение прав: {selective_rights}
4. Свобода подзаконного нормотворчества: {subordinate_regulations}
5. Превышение компетенции: {competence_excess}
6. Административные процедуры: {admin_procedures}
7. Контроль деятельности: {activity_control}

ОБЩЕЕ ЗАКЛЮЧЕНИЕ:
{overall_conclusion}

РЕКОМЕНДАЦИИ:
{recommendations}
"""

    def _get_forecast_template(self) -> str:
        return """
ПРОГНОЗ СОЦИАЛЬНО-ЭКОНОМИЧЕСКИХ ПОСЛЕДСТВИЙ
к проекту Закона Республики Казахстан "{title}"

1. SWOT-АНАЛИЗ

Сильные стороны (Strengths):
{strengths}

Слабые стороны (Weaknesses):
{weaknesses}

Возможности (Opportunities):
{opportunities}

Угрозы (Threats):
{threats}

2. КЛЮЧЕВЫЕ ПОКАЗАТЕЛИ "ДО/ПОСЛЕ"

{before_after_indicators}

3. ВРЕМЕННЫЕ ГОРИЗОНТЫ

Краткосрочные эффекты (1 год):
{short_term}

Среднесрочные эффекты (3 года):
{medium_term}

Долгосрочные эффекты (5+ лет):
{long_term}
"""

    def _get_glossary_template(self) -> str:
        return """
ГЛОССАРИЙ ТЕРМИНОВ
к проекту Закона Республики Казахстан "{title}"

{terms_list}

Примечание: Термины приведены в алфавитном порядке с указанием 
определений на казахском и русском языках.
"""

    def _get_machine_readable_template(self) -> str:
        return """
МАШИНОЧИТАЕМОЕ ПРИЛОЖЕНИЕ
к проекту Закона Республики Казахстан "{title}"

Формат: Akoma Ntoso-XML / JSON-LD
Назначение: Интеграция с E-Parliament, Adilet, Documentolog

XML-СТРУКТУРА:
{xml_content}

JSON-МЕТАДАННЫЕ:
{json_content}

UUID КАРТА НОРМ:
{uuid_map}
"""

    def _get_audit_log_template(self) -> str:
        return """
АУДИТ-ЛОГ ВЕРСИЙ
к проекту Закона Республики Казахстан "{title}"

| Версия | Дата | Автор | Описание изменений |
|--------|------|-------|-------------------|
{version_history}

Всего версий: {total_versions}
Создано: {creation_date}
Последнее изменение: {last_modified}
"""

    def format_template(self, template_name: str, **kwargs) -> str:
        """Форматирование шаблона с подстановкой значений"""
        template = self.get_template(template_name)
        if not template:
            return f"Шаблон {template_name} не найден"
        
        try:
            return template.format(**kwargs)
        except KeyError as e:
            return f"Отсутствует параметр для шаблона: {e}"
        except Exception as e:
            return f"Ошибка форматирования шаблона: {e}" 