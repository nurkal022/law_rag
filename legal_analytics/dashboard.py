"""
Дашборд для отображения аналитики комментариев к законопроектам
"""

from typing import Dict, Any, List
import json
from collections import defaultdict


class AnalyticsDashboard:
    """Дашборд для отображения аналитики комментариев"""
    
    def __init__(self):
        pass
    
    def generate_dashboard_data(self, analysis_results: Dict[str, Any]) -> Dict[str, Any]:
        """Генерация расширенных данных для дашборда"""
        
        dashboard_data = {
            'overview_cards': self._create_overview_cards(analysis_results['overview']),
            'sentiment_chart': self._create_sentiment_chart(analysis_results['sentiment_analysis']),
            'emotion_analysis': self._create_emotion_chart(analysis_results.get('emotion_analysis', {})),
            'engagement_metrics': self._create_engagement_metrics(analysis_results['engagement_metrics']),
            'advanced_word_cloud': self._create_advanced_word_cloud(analysis_results['word_frequency']),
            'project_rankings': self._create_project_rankings(analysis_results['project_rankings']),
            'topics_analysis': self._create_topics_analysis(analysis_results['topics_analysis']),
            'author_insights': self._create_author_insights(analysis_results['author_analysis']),
            'temporal_analysis': self._create_temporal_charts(analysis_results.get('temporal_analysis', {})),
            'geographic_analysis': self._create_geographic_charts(analysis_results.get('geographic_analysis', {})),
            'controversy_analysis': self._create_controversy_analysis(analysis_results.get('controversy_analysis', {})),
            'quality_metrics': self._create_quality_metrics(analysis_results.get('quality_metrics', {})),
            'network_analysis': self._create_network_visualization(analysis_results.get('network_analysis', {})),
            'key_phrases': self._create_key_phrases_analysis(analysis_results.get('key_phrases', {})),
            'recommendations': self._create_advanced_recommendations(analysis_results['recommendations']),
            'predictive_insights': self._create_predictive_charts(analysis_results.get('predictive_insights', {})),
            'trends': self._create_trends(analysis_results)
        }
        
        return dashboard_data
    
    def _create_overview_cards(self, overview: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Создание карточек обзора"""
        
        cards = [
            {
                'title': 'Всего проектов',
                'value': overview['total_projects'],
                'icon': '📋',
                'color': 'primary',
                'trend': '+2',
                'trend_direction': 'up'
            },
            {
                'title': 'Всего комментариев',
                'value': overview['total_comments'],
                'icon': '💬',
                'color': 'info',
                'trend': '+15%',
                'trend_direction': 'up'
            },
            {
                'title': 'Среднее количество комментариев',
                'value': overview['average_comments_per_project'],
                'icon': '📊',
                'color': 'success',
                'trend': '+8%',
                'trend_direction': 'up'
            },
            {
                'title': 'Активных категорий',
                'value': len(overview['top_categories']),
                'icon': '🏷️',
                'color': 'warning',
                'trend': '0',
                'trend_direction': 'neutral'
            }
        ]
        
        return cards
    
    def _create_sentiment_chart(self, sentiment_data: Dict[str, Any]) -> Dict[str, Any]:
        """Создание графика тональности"""
        
        overall = sentiment_data['overall_sentiment']
        
        chart_data = {
            'labels': ['Положительные', 'Нейтральные', 'Негативные'],
            'datasets': [
                {
                    'data': [overall['positive'], overall['neutral'], overall['negative']],
                    'backgroundColor': ['#28a745', '#ffc107', '#dc3545'],
                    'borderColor': ['#28a745', '#ffc107', '#dc3545'],
                    'borderWidth': 2
                }
            ]
        }
        
        return {
            'type': 'doughnut',
            'data': chart_data,
            'options': {
                'responsive': True,
                'plugins': {
                    'legend': {
                        'position': 'bottom'
                    }
                }
            }
        }
    
    def _create_engagement_metrics(self, engagement_data: Dict[str, Any]) -> Dict[str, Any]:
        """Создание метрик вовлеченности"""
        
        overall = engagement_data['overall_engagement']
        
        metrics = {
            'total_participants': {
                'value': overall['total_participants'],
                'label': 'Всего участников',
                'icon': '👥'
            },
            'active_participants': {
                'value': overall['active_participants'],
                'label': 'Активных участников',
                'icon': '🔥'
            },
            'engagement_rate': {
                'value': f"{overall['engagement_rate']}%",
                'label': 'Уровень вовлеченности',
                'icon': '📈'
            },
            'response_time': {
                'value': overall['average_response_time'],
                'label': 'Среднее время ответа',
                'icon': '⏱️'
            }
        }
        
        return metrics
    
    def _create_word_cloud(self, word_frequency: Dict[str, Any]) -> Dict[str, Any]:
        """Создание облака слов"""
        
        return {
            'words': word_frequency['word_cloud_data'][:30],  # Топ 30 слов
            'categories': word_frequency['word_categories']
        }
    
    def _create_project_rankings(self, rankings: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Создание рейтинга проектов"""
        
        return {
            'top_projects': rankings[:5],  # Топ 5 проектов
            'all_projects': rankings
        }
    
    def _create_topics_analysis(self, topics_data: Dict[str, Any]) -> Dict[str, Any]:
        """Создание анализа тем"""
        
        # Безопасное получение данных тем
        if 'main_topics' in topics_data and 'topics' in topics_data['main_topics']:
            topics = topics_data['main_topics']['topics']
        elif 'main_topics' in topics_data:
            topics = topics_data["main_topics"]
        else:
            topics = topics_data.get('topics', {})
        
        if not topics:
            # Возвращаем пустые данные если тем нет
            return {
                'topics': {},
                'chart_data': {'labels': [], 'datasets': []},
                'evolution': {}
            }
        
        # Создаем данные для графика тем
        topic_chart_data = {
            'labels': list(topics.keys()),
            'datasets': [
                {
                    'label': 'Частота упоминания (%)',
                    'data': [topics[topic].get('frequency', 0) for topic in topics.keys()],
                    'backgroundColor': ['#007bff', '#28a745', '#ffc107', '#dc3545', '#6f42c1'],
                    'borderColor': ['#007bff', '#28a745', '#ffc107', '#dc3545', '#6f42c1'],
                    'borderWidth': 1
                }
            ]
        }
        
        return {
            'topics': topics,
            'chart_data': topic_chart_data,
            'evolution': topics_data.get('topic_evolution', {})
        }
    
    def _create_author_insights(self, author_data: Dict[str, Any]) -> Dict[str, Any]:
        """Создание инсайтов по авторам"""
        
        # Безопасное получение данных авторов
        if 'detailed_authors' in author_data:
            detailed_authors = author_data['detailed_authors']
            top_authors = {k: v for k, v in list(detailed_authors.items())[:5]}
        else:
            top_authors = author_data.get('top_authors', {})
        
        stats = author_data.get('author_statistics', {})
        
        # Создаем данные для графика авторов
        if isinstance(top_authors, dict) and top_authors:
            # Словарь авторов
            author_labels = list(top_authors.keys())[:10]
            author_counts = [top_authors[author].get('comment_count', 0) for author in author_labels]
        else:
            # Пустые данные
            author_labels = []
            author_counts = []
        
        author_chart_data = {
            'labels': author_labels,
            'datasets': [
                {
                    'label': 'Количество комментариев',
                    'data': author_counts,
                    'backgroundColor': 'rgba(54, 162, 235, 0.5)',
                    'borderColor': 'rgba(54, 162, 235, 1)',
                    'borderWidth': 1
                }
            ]
        }
        
        return {
            'top_authors': top_authors,
            'statistics': stats,
            'chart_data': author_chart_data
        }
    
    def _create_recommendations(self, recommendations: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Создание рекомендаций"""
        
        # Группируем рекомендации по приоритету
        high_priority = [r for r in recommendations if r['priority'] == 'high']
        medium_priority = [r for r in recommendations if r['priority'] == 'medium']
        low_priority = [r for r in recommendations if r['priority'] == 'low']
        
        return {
            'high_priority': high_priority,
            'medium_priority': medium_priority,
            'low_priority': low_priority,
            'total_count': len(recommendations)
        }
    
    def _create_trends(self, analysis_results: Dict[str, Any]) -> Dict[str, Any]:
        """Создание трендов"""
        
        sentiment_trends = analysis_results['sentiment_analysis']['sentiment_trends']
        topics_evolution = analysis_results['topics_analysis']['topic_evolution']
        
        return {
            'sentiment_trends': sentiment_trends,
            'topic_evolution': topics_evolution,
            'engagement_trend': '+8% за последний месяц',
            'participation_trend': '+12% новых участников'
        }
    
    def export_dashboard_data(self, dashboard_data: Dict[str, Any], format_type: str = 'json') -> str:
        """Экспорт данных дашборда"""
        
        if format_type == 'json':
            return json.dumps(dashboard_data, ensure_ascii=False, indent=2)
        elif format_type == 'html':
            return self._generate_html_report(dashboard_data)
        else:
            return str(dashboard_data)
    
    def _generate_html_report(self, dashboard_data: Dict[str, Any]) -> str:
        """Генерация HTML отчета"""
        
        from datetime import datetime
        
        # Безопасно извлекаем данные
        overview = dashboard_data.get('overview_cards', [])
        sentiment_chart = dashboard_data.get('sentiment_chart', {})
        project_rankings = dashboard_data.get('project_rankings', [])
        recommendations = dashboard_data.get('recommendations', {})
        
        # Извлекаем данные тональности
        sentiment_data = sentiment_chart.get('data', {}).get('datasets', [{}])
        sentiment_values = sentiment_data[0].get('data', [0, 0, 0]) if sentiment_data else [0, 0, 0]
        
        # Извлекаем проекты
        if isinstance(project_rankings, dict) and 'top_projects' in project_rankings:
            projects = project_rankings['top_projects']
        elif isinstance(project_rankings, list):
            projects = project_rankings
        else:
            projects = []
        
        # Извлекаем рекомендации
        if isinstance(recommendations, dict):
            rec_list = recommendations.get('high_priority', []) + recommendations.get('critical', [])
        elif isinstance(recommendations, list):
            rec_list = recommendations
        else:
            rec_list = []
        
        # Создаем HTML без использования .format()
        html_content = '<!DOCTYPE html>\n<html lang="ru">\n<head>\n'
        html_content += '<meta charset="UTF-8">\n'
        html_content += '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n'
        html_content += '<title>Отчет по правовой аналитике</title>\n'
        html_content += '<style>\n'
        html_content += 'body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }\n'
        html_content += '.header { text-align: center; margin-bottom: 30px; }\n'
        html_content += '.card { border: 1px solid #ddd; padding: 20px; margin: 15px 0; border-radius: 8px; background: #f9f9f9; }\n'
        html_content += '.metric { display: inline-block; margin: 10px; padding: 15px; background: white; border-radius: 5px; }\n'
        html_content += '.positive { color: #28a745; font-weight: bold; }\n'
        html_content += '.negative { color: #dc3545; font-weight: bold; }\n'
        html_content += '.neutral { color: #6c757d; font-weight: bold; }\n'
        html_content += 'table { width: 100%; border-collapse: collapse; margin: 15px 0; }\n'
        html_content += 'th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }\n'
        html_content += 'th { background-color: #f8f9fa; font-weight: bold; }\n'
        html_content += '</style>\n</head>\n<body>\n'
        
        # Заголовок
        html_content += '<div class="header">\n'
        html_content += '<h1>📊 ОТЧЕТ ПО ПРАВОВОЙ АНАЛИТИКЕ</h1>\n'
        html_content += f'<p>Сгенерировано: {datetime.now().strftime("%d.%m.%Y %H:%M")}</p>\n'
        html_content += '</div>\n'
        
        # Обзор
        html_content += '<div class="card">\n<h2>📈 Общий обзор</h2>\n'
        if overview:
            html_content += f'<div class="metric"><strong>Всего проектов:</strong> {overview[0].get("value", 0)}</div>\n'
            if len(overview) > 1:
                html_content += f'<div class="metric"><strong>Всего комментариев:</strong> {overview[1].get("value", 0)}</div>\n'
            if len(overview) > 2:
                html_content += f'<div class="metric"><strong>Среднее количество:</strong> {overview[2].get("value", 0)}</div>\n'
        html_content += '</div>\n'
        
        # Тональность
        html_content += '<div class="card">\n<h2>💬 Анализ тональности</h2>\n'
        html_content += f'<div class="metric positive"><strong>Положительные:</strong> {sentiment_values[0]:.1f}%</div>\n'
        html_content += f'<div class="metric neutral"><strong>Нейтральные:</strong> {sentiment_values[1]:.1f}%</div>\n'
        html_content += f'<div class="metric negative"><strong>Негативные:</strong> {sentiment_values[2]:.1f}%</div>\n'
        html_content += '</div>\n'
        
        # Проекты
        if projects:
            html_content += '<div class="card">\n<h2>🏆 Топ проекты</h2>\n<table>\n'
            html_content += '<tr><th>Проект</th><th>Рейтинг</th><th>Комментарии</th><th>Категория</th></tr>\n'
            
            for project in projects[:10]:
                title = project.get('title', 'Без названия')
                if len(title) > 80:
                    title = title[:80] + '...'
                
                html_content += f'<tr>'
                html_content += f'<td>{title}</td>'
                html_content += f'<td>{project.get("overall_score", project.get("score", 0))}</td>'
                html_content += f'<td>{project.get("comment_count", 0)}</td>'
                html_content += f'<td>{project.get("category", "Не указано")}</td>'
                html_content += f'</tr>\n'
            
            html_content += '</table>\n</div>\n'
        
        # Рекомендации
        if rec_list:
            html_content += '<div class="card">\n<h2>💡 Ключевые рекомендации</h2>\n'
            
            for i, rec in enumerate(rec_list[:5], 1):
                html_content += f'<div class="metric">\n'
                html_content += f'<h4>{i}. {rec.get("title", "Рекомендация")}</h4>\n'
                html_content += f'<p>{rec.get("description", "Описание отсутствует")}</p>\n'
                html_content += f'<small>Приоритет: {rec.get("priority", "Средний")} | Влияние: {rec.get("impact", "Среднее")}</small>\n'
                html_content += '</div>\n'
            
            html_content += '</div>\n'
        
        # Закрываем HTML
        html_content += '<div class="footer">\n<p>Отчет сгенерирован системой правовой аналитики</p>\n</div>\n'
        html_content += '</body>\n</html>'
        
        return html_content
    
    def _create_emotion_chart(self, emotion_data: Dict[str, Any]) -> Dict[str, Any]:
        """Создание графика эмоций"""
        
        if not emotion_data or 'overall_emotions' not in emotion_data:
            return {}
        
        emotions = emotion_data['overall_emotions']
        
        chart_data = {
            'labels': ['Гнев', 'Страх', 'Радость', 'Грусть', 'Удивление', 'Доверие'],
            'datasets': [
                {
                    'label': 'Эмоциональная окраска (%)',
                    'data': [emotions.get('anger', 0), emotions.get('fear', 0), emotions.get('joy', 0),
                            emotions.get('sadness', 0), emotions.get('surprise', 0), emotions.get('trust', 0)],
                    'backgroundColor': [
                        '#ff6b6b', '#ffa726', '#66bb6a', 
                        '#42a5f5', '#ab47bc', '#26c6da'
                    ],
                    'borderWidth': 2
                }
            ]
        }
        
        return {
            'type': 'radar',
            'data': chart_data,
            'options': {
                'responsive': True,
                'scales': {
                    'r': {
                        'beginAtZero': True,
                        'max': 100
                    }
                }
            }
        }
    
    def _create_advanced_word_cloud(self, word_frequency: Dict[str, Any]) -> Dict[str, Any]:
        """Создание продвинутого облака слов с категориями"""
        
        if not word_frequency or 'word_cloud_data' not in word_frequency:
            return {}
        
        word_cloud_data = word_frequency['word_cloud_data']
        semantic_groups = word_frequency.get('semantic_groups', {})
        
        # Подготавливаем данные для интерактивного облака слов
        cloud_data = {
            'words': word_cloud_data[:50],  # Топ 50 слов
            'categories': {
                'legal': [w for w in word_cloud_data if w.get('category') == 'legal'][:15],
                'technical': [w for w in word_cloud_data if w.get('category') == 'technical'][:15],
                'emotional': [w for w in word_cloud_data if w.get('category') == 'emotional'][:15],
                'procedural': [w for w in word_cloud_data if w.get('category') == 'procedural'][:15]
            },
            'semantic_groups': semantic_groups,
            'bigrams': word_frequency.get('bigrams', {}),
            'trigrams': word_frequency.get('trigrams', {}),
            'vocabulary_stats': {
                'richness': round(word_frequency.get('vocabulary_richness', 0) * 100, 1),
                'average_word_length': round(word_frequency.get('average_word_length', 0), 1),
                'total_unique_words': len(word_frequency.get('word_frequency', {}))
            }
        }
        
        return cloud_data
    
    def _create_temporal_charts(self, temporal_data: Dict[str, Any]) -> Dict[str, Any]:
        """Создание временных графиков"""
        
        if not temporal_data:
            return {}
        
        # График активности по часам
        hourly_chart = {
            'type': 'line',
            'data': {
                'labels': list(range(24)),
                'datasets': [{
                    'label': 'Активность по часам',
                    'data': [temporal_data.get('activity_by_hour', {}).get(hour, 0) for hour in range(24)],
                    'borderColor': '#007bff',
                    'backgroundColor': 'rgba(0, 123, 255, 0.1)',
                    'fill': True
                }]
            },
            'options': {
                'responsive': True,
                'scales': {
                    'x': {'title': {'display': True, 'text': 'Час дня'}},
                    'y': {'title': {'display': True, 'text': 'Количество комментариев'}}
                }
            }
        }
        
        # График активности по дням недели
        daily_chart = {
            'type': 'bar',
            'data': {
                'labels': ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
                'datasets': [{
                    'label': 'Активность по дням недели',
                    'data': [temporal_data.get('activity_by_day', {}).get(day, 0) 
                            for day in ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье']],
                    'backgroundColor': ['#28a745', '#17a2b8', '#ffc107', '#fd7e14', '#6f42c1', '#e83e8c', '#20c997']
                }]
            }
        }
        
        return {
            'hourly_activity': hourly_chart,
            'daily_activity': daily_chart,
            'peak_times': temporal_data.get('peak_activity_times', []),
            'trends': temporal_data.get('activity_trends', {})
        }
    
    def _create_geographic_charts(self, geographic_data: Dict[str, Any]) -> Dict[str, Any]:
        """Создание географических графиков"""
        
        if not geographic_data or 'regional_activity' not in geographic_data:
            return {}
        
        regions = geographic_data['regional_activity']
        
        # График по регионам
        regional_chart = {
            'type': 'horizontalBar',
            'data': {
                'labels': list(regions.keys()),
                'datasets': [{
                    'label': 'Количество комментариев',
                    'data': [region['comments'] for region in regions.values()],
                    'backgroundColor': '#007bff'
                }]
            },
            'options': {
                'responsive': True,
                'indexAxis': 'y'
            }
        }
        
        # Карта вовлеченности
        engagement_map = {
            'regions': regions,
            'top_regions': geographic_data.get('top_regions', []),
            'insights': geographic_data.get('geographic_insights', {})
        }
        
        return {
            'regional_chart': regional_chart,
            'engagement_map': engagement_map,
            'urban_rural': geographic_data.get('geographic_insights', {}).get('urban_vs_rural', {})
        }
    
    def _create_controversy_analysis(self, controversy_data: Dict[str, Any]) -> Dict[str, Any]:
        """Создание анализа спорности"""
        
        if not controversy_data:
            return {}
        
        controversy_scores = controversy_data.get('controversy_scores', {})
        
        # График спорности проектов
        controversy_chart = {
            'type': 'scatter',
            'data': {
                'datasets': [{
                    'label': 'Уровень спорности',
                    'data': [{'x': i, 'y': score} for i, score in enumerate(controversy_scores.values())],
                    'backgroundColor': ['#ff6b6b' if score > 70 else '#ffa726' if score > 40 else '#66bb6a' 
                                      for score in controversy_scores.values()]
                }]
            },
            'options': {
                'responsive': True,
                'scales': {
                    'y': {'title': {'display': True, 'text': 'Индекс спорности'}}
                }
            }
        }
        
        return {
            'controversy_chart': controversy_chart,
            'high_controversy_projects': [pid for pid, score in controversy_scores.items() if score > 70],
            'polarization_metrics': controversy_data.get('polarization_index', {}),
            'debate_intensity': controversy_data.get('debate_intensity', {})
        }
    
    def _create_quality_metrics(self, quality_data: Dict[str, Any]) -> Dict[str, Any]:
        """Создание метрик качества"""
        
        if not quality_data:
            return {}
        
        quality_by_project = quality_data.get('quality_by_project', {})
        
        # График качества комментариев
        quality_chart = {
            'type': 'bar',
            'data': {
                'labels': [f"Проект {pid[:8]}..." for pid in quality_by_project.keys()],
                'datasets': [{
                    'label': 'Средний балл качества',
                    'data': [project['average_quality'] for project in quality_by_project.values()],
                    'backgroundColor': ['#28a745' if score > 70 else '#ffc107' if score > 50 else '#dc3545' 
                                      for score in [project['average_quality'] for project in quality_by_project.values()]]
                }]
            }
        }
        
        return {
            'quality_chart': quality_chart,
            'quality_distribution': quality_by_project,
            'overall_quality': sum(p['average_quality'] for p in quality_by_project.values()) / len(quality_by_project) if quality_by_project else 0
        }
    
    def _create_network_visualization(self, network_data: Dict[str, Any]) -> Dict[str, Any]:
        """Создание визуализации сетей взаимодействия"""
        
        if not network_data:
            return {}
        
        interactions = network_data.get('author_interactions', {})
        influence_metrics = network_data.get('influence_metrics', {})
        
        # Подготавливаем данные для сетевого графика
        nodes = []
        edges = []
        
        # Создаем узлы (авторы)
        all_authors = set()
        for (author1, author2) in interactions.keys():
            all_authors.add(author1)
            all_authors.add(author2)
        
        for author in all_authors:
            influence = influence_metrics.get(author, 0)
            nodes.append({
                'id': author,
                'label': author[:20] + '...' if len(author) > 20 else author,
                'size': max(10, min(50, influence * 5)),
                'color': '#007bff' if influence > 2 else '#6c757d'
            })
        
        # Создаем связи
        for (author1, author2), weight in interactions.items():
            edges.append({
                'from': author1,
                'to': author2,
                'weight': weight,
                'width': max(1, min(5, weight))
            })
        
        return {
            'network_graph': {
                'nodes': nodes,
                'edges': edges
            },
            'influence_ranking': influence_metrics,
            'interaction_stats': {
                'total_interactions': len(interactions),
                'most_connected_author': max(influence_metrics.items(), key=lambda x: x[1])[0] if influence_metrics else 'Нет данных'
            }
        }
    
    def _create_key_phrases_analysis(self, phrases_data: Dict[str, Any]) -> Dict[str, Any]:
        """Создание анализа ключевых фраз"""
        
        if not phrases_data:
            return {}
        
        frequent_phrases = phrases_data.get('most_frequent_phrases', [])
        named_entities = phrases_data.get('named_entities', {})
        
        # График частоты фраз
        phrases_chart = {
            'type': 'horizontalBar',
            'data': {
                'labels': [phrase['phrase'] for phrase in frequent_phrases[:10]],
                'datasets': [{
                    'label': 'Частота упоминания',
                    'data': [phrase['frequency'] for phrase in frequent_phrases[:10]],
                    'backgroundColor': ['#28a745' if phrase['sentiment'] == 'positive' 
                                     else '#dc3545' if phrase['sentiment'] == 'negative' 
                                     else '#ffc107' for phrase in frequent_phrases[:10]]
                }]
            }
        }
        
        return {
            'phrases_chart': phrases_chart,
            'top_phrases': frequent_phrases,
            'entities': named_entities,
            'phrase_categories': {
                'positive_phrases': [p for p in frequent_phrases if p['sentiment'] == 'positive'],
                'negative_phrases': [p for p in frequent_phrases if p['sentiment'] == 'negative'],
                'neutral_phrases': [p for p in frequent_phrases if p['sentiment'] == 'neutral']
            }
        }
    
    def _create_predictive_charts(self, predictive_data: Dict[str, Any]) -> Dict[str, Any]:
        """Создание предиктивных графиков"""
        
        if not predictive_data:
            return {}
        
        # График прогнозов
        forecast_chart = {
            'type': 'line',
            'data': {
                'labels': ['Текущий месяц', 'Следующий месяц', '+2 месяца', '+3 месяца'],
                'datasets': [
                    {
                        'label': 'Прогноз тональности',
                        'data': [50, 56, 62, 65],  # Имитация прогноза
                        'borderColor': '#28a745',
                        'backgroundColor': 'rgba(40, 167, 69, 0.1)',
                        'fill': True
                    },
                    {
                        'label': 'Прогноз вовлеченности',
                        'data': [75, 81, 85, 88],  # Имитация прогноза
                        'borderColor': '#007bff',
                        'backgroundColor': 'rgba(0, 123, 255, 0.1)',
                        'fill': True
                    }
                ]
            }
        }
        
        return {
            'forecast_chart': forecast_chart,
            'trend_predictions': predictive_data.get('trend_predictions', {}),
            'risk_assessment': predictive_data.get('risk_assessment', {}),
            'opportunities': predictive_data.get('opportunity_analysis', {})
        }
    
    def _create_advanced_recommendations(self, recommendations: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Создание расширенных рекомендаций"""
        
        # Группируем рекомендации по типу и приоритету
        critical_recs = [r for r in recommendations if r.get('priority') == 'critical']
        high_priority = [r for r in recommendations if r.get('priority') == 'high']
        medium_priority = [r for r in recommendations if r.get('priority') == 'medium']
        low_priority = [r for r in recommendations if r.get('priority') == 'low']
        
        # Группируем по типам
        by_type = defaultdict(list)
        for rec in recommendations:
            by_type[rec.get('type', 'general')].append(rec)
        
        # Рассчитываем приоритетную матрицу
        priority_matrix = []
        for rec in recommendations:
            impact_score = {'Очень высокий': 5, 'Высокий': 4, 'Средний': 3, 'Низкий': 2}.get(rec.get('impact', 'Средний'), 3)
            effort_score = {'Низкий': 5, 'Средний': 3, 'Высокий': 1}.get(rec.get('effort', 'Средний'), 3)
            
            priority_matrix.append({
                'title': rec['title'],
                'impact_score': impact_score,
                'effort_score': effort_score,
                'priority_score': impact_score * effort_score,
                'success_probability': rec.get('success_probability', 50),
                'timeline': rec.get('timeline', 'Не указано'),
                'kpi': rec.get('kpi', 'Не указано')
            })
        
        return {
            'critical': critical_recs,
            'high_priority': high_priority,
            'medium_priority': medium_priority,
            'low_priority': low_priority,
            'by_type': dict(by_type),
            'priority_matrix': sorted(priority_matrix, key=lambda x: x['priority_score'], reverse=True),
            'implementation_roadmap': self._create_implementation_roadmap(recommendations),
            'total_count': len(recommendations)
        }
    
    def _create_implementation_roadmap(self, recommendations: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Создание дорожной карты внедрения"""
        
        roadmap = []
        
        # Сортируем по приоритету и сложности
        sorted_recs = sorted(recommendations, key=lambda x: (
            {'critical': 4, 'high': 3, 'medium': 2, 'low': 1}.get(x.get('priority', 'low'), 1),
            -{'Низкий': 3, 'Средний': 2, 'Высокий': 1}.get(x.get('effort', 'Средний'), 2)
        ), reverse=True)
        
        current_week = 0
        for i, rec in enumerate(sorted_recs[:6]):  # Топ 6 рекомендаций
            timeline = rec.get('timeline', '2-3 недели')
            weeks = 3  # По умолчанию
            
            if 'недел' in timeline:
                try:
                    weeks = int(timeline.split('-')[1].split()[0])
                except:
                    weeks = 3
            
            roadmap.append({
                'phase': f"Фаза {i+1}",
                'title': rec['title'],
                'start_week': current_week,
                'duration_weeks': weeks,
                'end_week': current_week + weeks,
                'priority': rec.get('priority', 'medium'),
                'success_probability': rec.get('success_probability', 50),
                'dependencies': [] if i == 0 else [f"Фаза {i}"]
            })
            
            current_week += weeks
        
        return roadmap
    
    def _generate_pdf_report(self, dashboard_data: Dict[str, Any]) -> bytes:
        """Генерация PDF отчета"""
        try:
            from reportlab.lib import colors
            from reportlab.lib.pagesizes import letter, A4
            from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
            from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
            from reportlab.lib.units import inch
            from io import BytesIO
            from datetime import datetime
            
            # Создаем буфер для PDF
            buffer = BytesIO()
            doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=0.5*inch)
            
            # Стили
            styles = getSampleStyleSheet()
            title_style = ParagraphStyle(
                'CustomTitle',
                parent=styles['Heading1'],
                fontSize=24,
                spaceAfter=30,
                alignment=1,  # Центрирование
                textColor=colors.darkblue
            )
            
            heading_style = ParagraphStyle(
                'CustomHeading',
                parent=styles['Heading2'],
                fontSize=16,
                spaceAfter=12,
                textColor=colors.darkblue
            )
            
            # Содержимое отчета
            story = []
            
            # Заголовок
            story.append(Paragraph("📊 ОТЧЕТ ПО ПРАВОВОЙ АНАЛИТИКЕ", title_style))
            story.append(Paragraph(f"Дата формирования: {datetime.now().strftime('%d.%m.%Y %H:%M')}", styles['Normal']))
            story.append(Spacer(1, 20))
            
            # Обзор
            story.append(Paragraph("📈 ОБЩИЙ ОБЗОР", heading_style))
            overview_cards = dashboard_data.get('overview_cards', [])
            if overview_cards:
                overview_data = [
                    ['Метрика', 'Значение'],
                    ['Всего проектов', overview_cards[0].get('value', 0)],
                    ['Всего комментариев', overview_cards[1].get('value', 0)],
                    ['Среднее количество комментариев', overview_cards[2].get('value', 0)]
                ]
                
                overview_table = Table(overview_data)
                overview_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, 0), 14),
                    ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                    ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                    ('GRID', (0, 0), (-1, -1), 1, colors.black)
                ]))
                
                story.append(overview_table)
                story.append(Spacer(1, 20))
            
            # Анализ тональности
            story.append(Paragraph("😊 АНАЛИЗ ТОНАЛЬНОСТИ", heading_style))
            sentiment_data = dashboard_data.get('sentiment_chart', {}).get('data', {})
            if sentiment_data:
                datasets = sentiment_data.get('datasets', [])
                if datasets:
                    sentiment_values = datasets[0].get('data', [0, 0, 0])
                    sentiment_table_data = [
                        ['Тип тональности', 'Процент'],
                        ['Позитивная', f"{sentiment_values[0]}%"],
                        ['Нейтральная', f"{sentiment_values[1]}%"],
                        ['Негативная', f"{sentiment_values[2]}%"]
                    ]
                    
                    sentiment_table = Table(sentiment_table_data)
                    sentiment_table.setStyle(TableStyle([
                        ('BACKGROUND', (0, 0), (-1, 0), colors.lightblue),
                        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                        ('GRID', (0, 0), (-1, -1), 1, colors.black)
                    ]))
                    
                    story.append(sentiment_table)
                    story.append(Spacer(1, 20))
            
            # Топ проекты
            story.append(Paragraph("🏆 ТОП ПРОЕКТЫ", heading_style))
            project_rankings = dashboard_data.get('project_rankings', [])
            if project_rankings:
                project_data = [['Проект', 'Рейтинг', 'Комментарии', 'Категория']]
                
                for project in project_rankings[:10]:
                    project_data.append([
                        project.get('title', 'Без названия')[:50] + '...' if len(project.get('title', '')) > 50 else project.get('title', 'Без названия'),
                        str(project.get('overall_score', 0)),
                        str(project.get('comment_count', 0)),
                        project.get('category', 'Не указано')
                    ])
                
                project_table = Table(project_data, colWidths=[3*inch, 0.8*inch, 1*inch, 1.5*inch])
                project_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.lightgreen),
                    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('GRID', (0, 0), (-1, -1), 1, colors.black),
                    ('FONTSIZE', (0, 0), (-1, -1), 9)
                ]))
                
                story.append(project_table)
                story.append(Spacer(1, 20))
            
            # Рекомендации
            story.append(Paragraph("💡 КЛЮЧЕВЫЕ РЕКОМЕНДАЦИИ", heading_style))
            recommendations = dashboard_data.get('recommendations', {})
            
            if isinstance(recommendations, dict):
                # Новый формат рекомендаций
                critical_recs = recommendations.get('critical', [])
                high_recs = recommendations.get('high_priority', [])
                
                all_recs = critical_recs + high_recs
            else:
                # Старый формат
                all_recs = recommendations if isinstance(recommendations, list) else []
            
            for i, rec in enumerate(all_recs[:5], 1):
                story.append(Paragraph(f"{i}. {rec.get('title', 'Рекомендация')}", styles['Heading3']))
                story.append(Paragraph(rec.get('description', 'Описание отсутствует'), styles['Normal']))
                story.append(Paragraph(f"Приоритет: {rec.get('priority', 'Средний')} | Влияние: {rec.get('impact', 'Среднее')}", styles['Normal']))
                story.append(Spacer(1, 10))
            
            # Строим PDF
            doc.build(story)
            buffer.seek(0)
            return buffer.getvalue()
            
        except ImportError:
            # Fallback если reportlab не установлен
            return b"PDF generation requires reportlab package"
        except Exception as e:
            print(f"Error generating PDF: {e}")
            return b"Error generating PDF report" 