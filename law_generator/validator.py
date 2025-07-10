"""
Валидатор данных для генерации законопроектов
"""

from typing import Dict, List, Any, Tuple
import re
from dataclasses import fields


class DataValidator:
    """Валидация данных для генерации законопроектов"""
    
    def __init__(self):
        self.required_fields = {
            'title_ru', 'title_kz', 'initiator', 'initiator_type',
            'problem_description', 'goals', 'target_audience',
            'constitutional_basis', 'budget_impact', 'business_impact',
            'citizen_impact', 'administrative_burden', 'corruption_risks',
            'social_consequences'
        }
        
        self.field_validators = {
            'title_ru': self._validate_title,
            'title_kz': self._validate_title,
            'initiator': self._validate_initiator,
            'initiator_type': self._validate_initiator_type,
            'problem_description': self._validate_long_text,
            'goals': self._validate_goals,
            'target_audience': self._validate_short_text,
            'constitutional_basis': self._validate_legal_text,
            'budget_impact': self._validate_long_text,
            'business_impact': self._validate_long_text,
            'citizen_impact': self._validate_long_text,
            'administrative_burden': self._validate_long_text,
            'corruption_risks': self._validate_long_text,
            'social_consequences': self._validate_long_text
        }
        
        self.initiator_types = ['депутат', 'правительство', 'министерство']
    
    def validate_project_data(self, data) -> Dict[str, Any]:
        """Основная функция валидации данных проекта"""
        
        errors = []
        warnings = []
        missing_required = []
        suggestions = []
        
        # Проверка обязательных полей
        for field_name in self.required_fields:
            field_value = getattr(data, field_name, None)
            
            if not field_value or (isinstance(field_value, str) and not field_value.strip()):
                missing_required.append(field_name)
                continue
            
            # Валидация конкретного поля
            if field_name in self.field_validators:
                validation_result = self.field_validators[field_name](field_value)
                if not validation_result['is_valid']:
                    errors.extend(validation_result['errors'])
                warnings.extend(validation_result.get('warnings', []))
        
        # Проверка связанных полей
        consistency_check = self._check_data_consistency(data)
        errors.extend(consistency_check['errors'])
        warnings.extend(consistency_check['warnings'])
        
        # Генерация предложений по улучшению
        suggestions = self._generate_suggestions(data, missing_required, errors)
        
        is_valid = len(errors) == 0 and len(missing_required) == 0
        
        return {
            'is_valid': is_valid,
            'errors': errors,
            'warnings': warnings,
            'missing_required': missing_required,
            'suggestions': suggestions,
            'completeness_score': self._calculate_completeness_score(data)
        }
    
    def _validate_title(self, title: str) -> Dict[str, Any]:
        """Валидация названия законопроекта"""
        errors = []
        warnings = []
        
        if len(title.strip()) < 10:
            errors.append("Название слишком короткое (минимум 10 символов)")
        
        if len(title) > 200:
            errors.append("Название слишком длинное (максимум 200 символов)")
        
        if not title[0].isupper():
            warnings.append("Название должно начинаться с заглавной буквы")
        
        # Проверка на типичные формулировки
        law_keywords = ['закон', 'кодекс', 'положение', 'порядок', 'правила']
        if not any(keyword in title.lower() for keyword in law_keywords):
            warnings.append("Рекомендуется включить тип нормативного акта в название")
        
        return {
            'is_valid': len(errors) == 0,
            'errors': errors,
            'warnings': warnings
        }
    
    def _validate_initiator(self, initiator: str) -> Dict[str, Any]:
        """Валидация инициатора"""
        errors = []
        warnings = []
        
        if len(initiator.strip()) < 5:
            errors.append("Имя инициатора слишком короткое")
        
        if len(initiator) > 100:
            errors.append("Имя инициатора слишком длинное")
        
        return {
            'is_valid': len(errors) == 0,
            'errors': errors,
            'warnings': warnings
        }
    
    def _validate_initiator_type(self, initiator_type: str) -> Dict[str, Any]:
        """Валидация типа инициатора"""
        errors = []
        
        if initiator_type not in self.initiator_types:
            errors.append(f"Недопустимый тип инициатора. Допустимые: {', '.join(self.initiator_types)}")
        
        return {
            'is_valid': len(errors) == 0,
            'errors': errors,
            'warnings': []
        }
    
    def _validate_goals(self, goals: List[str]) -> Dict[str, Any]:
        """Валидация целей законопроекта"""
        errors = []
        warnings = []
        
        if isinstance(goals, str):
            # Если цели переданы как строка, разбиваем их
            goals = [goal.strip() for goal in goals.split(',') if goal.strip()]
        
        if not goals or len(goals) == 0:
            errors.append("Необходимо указать хотя бы одну цель")
            return {'is_valid': False, 'errors': errors, 'warnings': warnings}
        
        if len(goals) > 10:
            warnings.append("Слишком много целей (рекомендуется не более 10)")
        
        for i, goal in enumerate(goals):
            if len(goal.strip()) < 10:
                errors.append(f"Цель {i+1} слишком короткая (минимум 10 символов)")
            
            if len(goal) > 200:
                warnings.append(f"Цель {i+1} очень длинная (рекомендуется до 200 символов)")
        
        return {
            'is_valid': len(errors) == 0,
            'errors': errors,
            'warnings': warnings
        }
    
    def _validate_short_text(self, text: str) -> Dict[str, Any]:
        """Валидация коротких текстовых полей"""
        errors = []
        warnings = []
        
        if len(text.strip()) < 5:
            errors.append("Текст слишком короткий (минимум 5 символов)")
        
        if len(text) > 500:
            warnings.append("Текст длинный (рекомендуется до 500 символов)")
        
        return {
            'is_valid': len(errors) == 0,
            'errors': errors,
            'warnings': warnings
        }
    
    def _validate_long_text(self, text: str) -> Dict[str, Any]:
        """Валидация длинных текстовых полей"""
        errors = []
        warnings = []
        
        if len(text.strip()) < 20:
            errors.append("Описание слишком короткое (минимум 20 символов)")
        
        if len(text) > 5000:
            warnings.append("Описание очень длинное (рекомендуется до 5000 символов)")
        
        # Проверка на информативность
        words = text.split()
        if len(words) < 10:
            warnings.append("Описание содержит мало информации (рекомендуется минимум 10 слов)")
        
        return {
            'is_valid': len(errors) == 0,
            'errors': errors,
            'warnings': warnings
        }
    
    def _validate_legal_text(self, text: str) -> Dict[str, Any]:
        """Валидация правовых текстов с проверкой ссылок"""
        errors = []
        warnings = []
        
        # Базовая валидация как длинный текст
        base_validation = self._validate_long_text(text)
        errors.extend(base_validation['errors'])
        warnings.extend(base_validation['warnings'])
        
        # Проверка ссылок на законодательство
        constitution_refs = re.findall(r'статья?\s*\d+.*?конституции?', text, re.IGNORECASE)
        law_refs = re.findall(r'закон.*?["\«].*?["\»]', text, re.IGNORECASE)
        
        if not constitution_refs and 'конституци' in text.lower():
            warnings.append("Рекомендуется указать конкретные статьи Конституции")
        
        if not law_refs and 'закон' in text.lower():
            warnings.append("Рекомендуется точно указать названия законов в кавычках")
        
        return {
            'is_valid': len(errors) == 0,
            'errors': errors,
            'warnings': warnings
        }
    
    def _check_data_consistency(self, data) -> Dict[str, Any]:
        """Проверка согласованности данных"""
        errors = []
        warnings = []
        
        # Проверка соответствия названий на русском и казахском
        if hasattr(data, 'title_ru') and hasattr(data, 'title_kz'):
            if data.title_ru and data.title_kz:
                ru_words = len(data.title_ru.split())
                kz_words = len(data.title_kz.split())
                
                if abs(ru_words - kz_words) > max(ru_words, kz_words) * 0.5:
                    warnings.append("Значительное различие в длине названий на русском и казахском языках")
        
        # Проверка соответствия целей и проблемы
        if hasattr(data, 'goals') and hasattr(data, 'problem_description'):
            if data.goals and data.problem_description:
                goals_text = ' '.join(data.goals) if isinstance(data.goals, list) else data.goals
                if len(goals_text) > len(data.problem_description) * 2:
                    warnings.append("Цели значительно объемнее описания проблемы")
        
        # Проверка экономического обоснования
        if hasattr(data, 'budget_impact') and hasattr(data, 'cost_estimates'):
            if data.budget_impact and 'затрат' in data.budget_impact.lower():
                if not data.cost_estimates or len(data.cost_estimates) == 0:
                    warnings.append("Указано влияние на бюджет, но не приведены конкретные оценки затрат")
        
        return {
            'errors': errors,
            'warnings': warnings
        }
    
    def _generate_suggestions(self, data, missing_required: List[str], errors: List[str]) -> List[str]:
        """Генерация предложений по улучшению данных"""
        suggestions = []
        
        # Предложения по отсутствующим полям
        field_suggestions = {
            'title_kz': "Добавьте перевод названия на казахский язык",
            'international_experience': "Рассмотрите добавление анализа зарубежного опыта",
            'cost_estimates': "Укажите конкретные финансовые оценки",
            'funding_sources': "Определите источники финансирования",
            'implementation_timeline': "Укажите сроки реализации законопроекта"
        }
        
        for field in missing_required:
            if field in field_suggestions:
                suggestions.append(field_suggestions[field])
        
        # Предложения по улучшению качества
        if hasattr(data, 'problem_description') and data.problem_description:
            if len(data.problem_description.split()) < 50:
                suggestions.append("Расширьте описание проблемы для более полного обоснования")
        
        if hasattr(data, 'goals') and data.goals:
            goals_list = data.goals if isinstance(data.goals, list) else [data.goals]
            if len(goals_list) < 3:
                suggestions.append("Рассмотрите добавление дополнительных целей для комплексного решения")
        
        if hasattr(data, 'new_terms') and (not data.new_terms or len(data.new_terms) == 0):
            suggestions.append("Рассмотрите добавление глоссария новых терминов")
        
        return suggestions
    
    def _calculate_completeness_score(self, data) -> float:
        """Расчет процента заполненности данных"""
        total_fields = 0
        filled_fields = 0
        
        # Подсчитываем все поля
        for field in fields(data):
            total_fields += 1
            value = getattr(data, field.name)
            
            if value is not None:
                if isinstance(value, str) and value.strip():
                    filled_fields += 1
                elif isinstance(value, list) and len(value) > 0:
                    filled_fields += 1
                elif isinstance(value, dict) and len(value) > 0:
                    filled_fields += 1
                elif not isinstance(value, (str, list, dict)):
                    filled_fields += 1
        
        return round((filled_fields / total_fields) * 100, 1) if total_fields > 0 else 0.0
    
    def get_validation_help(self, field_name: str) -> Dict[str, str]:
        """Получение справки по валидации конкретного поля"""
        help_texts = {
            'title_ru': "Название должно быть информативным, содержать тип НПА (закон, кодекс и т.д.), 10-200 символов",
            'title_kz': "Точный перевод названия на казахский язык с сохранением правовой терминологии",
            'initiator': "Полное название органа или ФИО депутата, инициирующего законопроект",
            'initiator_type': "Тип инициатора: депутат, правительство или министерство",
            'problem_description': "Подробное описание проблемы, требующей правового регулирования (минимум 20 символов)",
            'goals': "Конкретные, измеримые цели законопроекта (список через запятую)",
            'target_audience': "Категории лиц, на которых распространяется действие закона",
            'constitutional_basis': "Ссылки на статьи Конституции РК, обосновывающие право на принятие закона",
            'budget_impact': "Анализ влияния на доходы и расходы государственного бюджета",
            'business_impact': "Описание влияния на предпринимательскую деятельность",
            'citizen_impact': "Анализ влияния на права и обязанности граждан",
            'corruption_risks': "Анализ потенциальных коррупционных рисков и способов их минимизации"
        }
        
        return {
            'description': help_texts.get(field_name, "Справка не найдена"),
            'required': field_name in self.required_fields
        } 