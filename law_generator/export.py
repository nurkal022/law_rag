"""
Модуль экспорта законопроектов в различные форматы
"""

import os
import json
from typing import Dict, Any, Optional
from datetime import datetime
import tempfile
from io import StringIO, BytesIO
import markdown
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.cidfonts import UnicodeCIDFont


class DocumentExporter:
    """Экспорт законопроектов в различные форматы"""
    
    def __init__(self):
        self.supported_formats = ['txt', 'json', 'html', 'pdf']
    
    def export_project(self, project_data: Dict[str, Any], format_type: str = 'txt') -> Dict[str, Any]:
        """Экспорт проекта в указанный формат"""
        
        if format_type not in self.supported_formats:
            return {
                'success': False,
                'error': f'Неподдерживаемый формат. Доступные: {", ".join(self.supported_formats)}'
            }
        
        try:
            if format_type == 'txt':
                return self._export_to_text(project_data)
            elif format_type == 'json':
                return self._export_to_json(project_data)
            elif format_type == 'html':
                return self._export_to_html(project_data)
            elif format_type == 'pdf':
                return self._export_to_pdf(project_data)
            else:
                return {
                    'success': False,
                    'error': 'Формат не реализован'
                }
                
        except Exception as e:
            return {
                'success': False,
                'error': f'Ошибка экспорта: {str(e)}'
            }
    
    def _export_to_text(self, project_data: Dict[str, Any]) -> Dict[str, Any]:
        """Экспорт в текстовый формат"""
        
        output = StringIO()
        
        # Заголовок документа
        output.write("=" * 80 + "\n")
        output.write("ЗАКОНОПРОЕКТ РЕСПУБЛИКИ КАЗАХСТАН\n")
        output.write("=" * 80 + "\n\n")
        
        # Основная информация
        output.write(f"Название (рус): {project_data.get('title_ru', 'Не указано')}\n")
        output.write(f"Название (каз): {project_data.get('title_kz', 'Не указано')}\n")
        output.write(f"Инициатор: {project_data.get('initiator', 'Не указан')}\n")
        output.write(f"Дата генерации: {project_data.get('generation_date', datetime.now().isoformat())}\n")
        output.write(f"ID проекта: {project_data.get('project_id', 'Не указан')}\n\n")
        
        # Разделы документа
        sections = project_data.get('sections', {})
        if sections:
            section_titles = {
                'title_page': '1. ТИТУЛЬНЫЙ ЛИСТ',
                'annotation': '2. АННОТАЦИЯ',
                'explanatory_note': '3. ПОЯСНИТЕЛЬНАЯ ЗАПИСКА',
                'main_text': '4. ОСНОВНОЙ ТЕКСТ ЗАКОНА',
                'comparison_table': '5. СРАВНИТЕЛЬНАЯ ТАБЛИЦА',
                'financial_justification': '6. ФИНАНСОВО-ЭКОНОМИЧЕСКОЕ ОБОСНОВАНИЕ',
                'regulatory_impact': '7. ОЦЕНКА РЕГУЛИРУЮЩЕГО ВОЗДЕЙСТВИЯ (ОРВ)',
                'compliance_act': '8. АКТ СООТВЕТСТВИЯ',
                'anticorruption_review': '9. АНТИКОРРУПЦИОННАЯ ЭКСПЕРТИЗА',
                'impact_forecast': '10. ПРОГНОЗ СОЦИАЛЬНО-ЭКОНОМИЧЕСКИХ ПОСЛЕДСТВИЙ',
                'glossary': '11. ГЛОССАРИЙ ТЕРМИНОВ',
                'machine_readable': '12. МАШИНОЧИТАЕМОЕ ПРИЛОЖЕНИЕ',
                'audit_log': '13. АУДИТ-ЛОГ ВЕРСИЙ'
            }
            
            for section_key, section_data in sections.items():
                title = section_titles.get(section_key, section_key.upper())
                output.write("=" * 80 + "\n")
                output.write(f"{title}\n")
                output.write("=" * 80 + "\n\n")
                
                if isinstance(section_data, dict):
                    content = section_data.get('content', '')
                    if content:
                        output.write(f"{content}\n\n")
                    
                    # Дополнительная информация
                    for key, value in section_data.items():
                        if key != 'content' and value:
                            output.write(f"{key.upper()}: {value}\n")
                    
                    output.write("\n")
                else:
                    output.write(f"{section_data}\n\n")
        
        # Метаданные
        metadata = project_data.get('metadata', {})
        if metadata:
            output.write("=" * 80 + "\n")
            output.write("МЕТАДАННЫЕ\n")
            output.write("=" * 80 + "\n\n")
            for key, value in metadata.items():
                output.write(f"{key}: {value}\n")
        
        content = output.getvalue()
        output.close()
        
        # Создаем временный файл
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False, encoding='utf-8') as f:
            f.write(content)
            temp_path = f.name
        
        return {
            'success': True,
            'format': 'txt',
            'content': content,
            'file_path': temp_path,
            'filename': f"law_project_{project_data.get('project_id', 'unknown')}.txt",
            'size': len(content.encode('utf-8'))
        }
    
    def _export_to_json(self, project_data: Dict[str, Any]) -> Dict[str, Any]:
        """Экспорт в JSON формат"""
        
        # Структурируем данные для JSON
        json_data = {
            'project_info': {
                'project_id': project_data.get('project_id'),
                'title_ru': project_data.get('title_ru'),
                'title_kz': project_data.get('title_kz'),
                'initiator': project_data.get('initiator'),
                'generation_date': project_data.get('generation_date'),
                'status': project_data.get('status', 'generated')
            },
            'sections': project_data.get('sections', {}),
            'metadata': project_data.get('metadata', {}),
            'data': project_data.get('data', {}),
            'export_info': {
                'export_date': datetime.now().isoformat(),
                'export_format': 'json',
                'version': '1.0'
            }
        }
        
        content = json.dumps(json_data, ensure_ascii=False, indent=2)
        
        # Создаем временный файл
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False, encoding='utf-8') as f:
            f.write(content)
            temp_path = f.name
        
        return {
            'success': True,
            'format': 'json',
            'content': content,
            'file_path': temp_path,
            'filename': f"law_project_{project_data.get('project_id', 'unknown')}.json",
            'size': len(content.encode('utf-8'))
        }
    
    def _export_to_html(self, project_data: Dict[str, Any]) -> Dict[str, Any]:
        """Экспорт в HTML формат"""
        
        html_content = f"""
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Законопроект - {project_data.get('title_ru', 'Без названия')}</title>
    <style>
        body {{
            font-family: 'Times New Roman', Times, serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            color: #333;
        }}
        .header {{
            text-align: center;
            border-bottom: 2px solid #000;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }}
        .section {{
            margin-bottom: 40px;
            page-break-inside: avoid;
        }}
        .section-title {{
            font-size: 1.2em;
            font-weight: bold;
            margin-bottom: 15px;
            padding: 10px;
            background-color: #f5f5f5;
            border-left: 4px solid #007bff;
        }}
        .content {{
            white-space: pre-wrap;
            margin-bottom: 15px;
        }}
        .metadata {{
            background-color: #f8f9fa;
            padding: 15px;
            border-radius: 5px;
            margin-top: 30px;
        }}
        .bilingual {{
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 20px;
        }}
        .lang-block {{
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 5px;
        }}
        .lang-label {{
            font-weight: bold;
            color: #007bff;
            margin-bottom: 5px;
        }}
        @media print {{
            body {{ margin: 0; }}
            .section {{ page-break-inside: avoid; }}
        }}
    </style>
</head>
<body>
    <div class="header">
        <h1>ЗАКОНОПРОЕКТ РЕСПУБЛИКИ КАЗАХСТАН</h1>
        <div class="bilingual">
            <div class="lang-block">
                <div class="lang-label">Русский:</div>
                <div>{project_data.get('title_ru', 'Не указано')}</div>
            </div>
            <div class="lang-block">
                <div class="lang-label">Қазақша:</div>
                <div>{project_data.get('title_kz', 'Көрсетілмеген')}</div>
            </div>
        </div>
        <p><strong>Инициатор:</strong> {project_data.get('initiator', 'Не указан')}</p>
        <p><strong>Дата генерации:</strong> {project_data.get('generation_date', datetime.now().strftime('%d.%m.%Y %H:%M'))}</p>
        <p><strong>ID проекта:</strong> {project_data.get('project_id', 'Не указан')}</p>
    </div>
"""
        
        # Добавляем разделы
        sections = project_data.get('sections', {})
        if sections:
            section_titles = {
                'title_page': '1. Титульный лист',
                'annotation': '2. Аннотация',
                'explanatory_note': '3. Пояснительная записка',
                'main_text': '4. Основной текст закона',
                'comparison_table': '5. Сравнительная таблица',
                'financial_justification': '6. Финансово-экономическое обоснование',
                'regulatory_impact': '7. Оценка регулирующего воздействия (ОРВ)',
                'compliance_act': '8. Акт соответствия',
                'anticorruption_review': '9. Антикоррупционная экспертиза',
                'impact_forecast': '10. Прогноз социально-экономических последствий',
                'glossary': '11. Глоссарий терминов',
                'machine_readable': '12. Машиночитаемое приложение',
                'audit_log': '13. Аудит-лог версий'
            }
            
            for section_key, section_data in sections.items():
                title = section_titles.get(section_key, section_key.replace('_', ' ').title())
                
                html_content += f"""
    <div class="section">
        <div class="section-title">{title}</div>
"""
                
                if isinstance(section_data, dict):
                    content = section_data.get('content', '')
                    if content:
                        # Экранируем HTML символы
                        escaped_content = content.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
                        html_content += f'        <div class="content">{escaped_content}</div>\n'
                    
                    # Казахская версия
                    kz_version = section_data.get('kz_version', '')
                    if kz_version:
                        escaped_kz = kz_version.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
                        html_content += f"""
        <div class="bilingual">
            <div class="lang-block">
                <div class="lang-label">Русская версия:</div>
                <div class="content">{escaped_content}</div>
            </div>
            <div class="lang-block">
                <div class="lang-label">Қазақша нұсқасы:</div>
                <div class="content">{escaped_kz}</div>
            </div>
        </div>
"""
                    
                    # Дополнительная информация
                    for key, value in section_data.items():
                        if key not in ['content', 'kz_version'] and value:
                            html_content += f'        <p><strong>{key.replace("_", " ").title()}:</strong> {value}</p>\n'
                
                else:
                    escaped_section = str(section_data).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
                    html_content += f'        <div class="content">{escaped_section}</div>\n'
                
                html_content += "    </div>\n"
        
        # Метаданные
        metadata = project_data.get('metadata', {})
        if metadata:
            html_content += """
    <div class="metadata">
        <h3>Метаданные</h3>
"""
            for key, value in metadata.items():
                html_content += f"        <p><strong>{key.replace('_', ' ').title()}:</strong> {value}</p>\n"
            html_content += "    </div>\n"
        
        html_content += """
</body>
</html>
"""
        
        # Создаем временный файл
        with tempfile.NamedTemporaryFile(mode='w', suffix='.html', delete=False, encoding='utf-8') as f:
            f.write(html_content)
            temp_path = f.name
        
        return {
            'success': True,
            'format': 'html',
            'content': html_content,
            'file_path': temp_path,
            'filename': f"law_project_{project_data.get('project_id', 'unknown')}.html",
            'size': len(html_content.encode('utf-8'))
        }
    
    def _export_to_pdf(self, project_data: Dict[str, Any]) -> Dict[str, Any]:
        """Экспорт в PDF формат с использованием ReportLab"""
        
        try:
            # Регистрируем шрифты с поддержкой кириллицы
            self._use_builtin_fonts = False
            self._register_cyrillic_fonts()
            
            # Создаем временный PDF файл
            with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as pdf_file:
                pdf_temp_path = pdf_file.name
            
            # Создаем PDF документ
            doc = SimpleDocTemplate(
                pdf_temp_path,
                pagesize=A4,
                rightMargin=2*cm,
                leftMargin=2*cm,
                topMargin=2.5*cm,
                bottomMargin=2*cm
            )
            
            # Получаем стили
            styles = getSampleStyleSheet()
            
            # Выбираем шрифты в зависимости от доступности
            if hasattr(self, '_use_builtin_fonts') and self._use_builtin_fonts:
                # Используем встроенные шрифты (только латиница, но не будет ошибок)
                title_font = 'Helvetica-Bold'
                heading_font = 'Helvetica-Bold'
                normal_font = 'Helvetica'
            else:
                # Используем зарегистрированные шрифты с кириллицей
                title_font = 'DejaVuSans-Bold'
                heading_font = 'DejaVuSans-Bold'
                normal_font = 'DejaVuSans'
            
            # Кастомные стили с поддержкой кириллицы
            title_style = ParagraphStyle(
                'CustomTitle',
                parent=styles['Title'],
                fontSize=16,
                spaceAfter=20,
                alignment=TA_CENTER,
                fontName=title_font
            )
            
            heading_style = ParagraphStyle(
                'CustomHeading',
                parent=styles['Heading1'],
                fontSize=14,
                spaceAfter=12,
                spaceBefore=18,
                fontName=heading_font
            )
            
            normal_style = ParagraphStyle(
                'CustomNormal',
                parent=styles['Normal'],
                fontSize=12,
                spaceAfter=6,
                alignment=TA_JUSTIFY,
                fontName=normal_font
            )
            
            # Собираем содержимое документа
            story = []
            
            # Создаем профессиональный титульный лист
            story.extend(self._create_title_page(project_data, title_style, heading_style, normal_style))
            
            # Новая страница после титульного листа
            story.append(PageBreak())
            
            # Оглавление
            story.extend(self._create_table_of_contents(project_data, heading_style, normal_style))
            story.append(PageBreak())
            
            # Добавляем разделы
            sections = project_data.get('sections', {})
            generation_language = project_data.get('generation_language', 'bilingual')
            
            if sections:
                section_titles = {
                    'title_page': '1. Титульный лист',
                    'annotation': '2. Аннотация',
                    'explanatory_note': '3. Пояснительная записка',
                    'main_text': '4. Основной текст закона',
                    'comparison_table': '5. Сравнительная таблица',
                    'financial_justification': '6. Финансово-экономическое обоснование',
                    'regulatory_impact': '7. Оценка регулирующего воздействия (ОРВ)',
                    'compliance_act': '8. Акт соответствия',
                    'anticorruption_review': '9. Антикоррупционная экспертиза',
                    'impact_forecast': '10. Прогноз социально-экономических последствий',
                    'glossary': '11. Глоссарий терминов',
                    'machine_readable': '12. Машиночитаемое приложение',
                    'audit_log': '13. Аудит-лог версий'
                }
                
                for section_key, section_data in sections.items():
                    # Пропускаем титульный лист
                    if section_key == 'title_page':
                        continue
                        
                    title = section_titles.get(section_key, section_key.replace('_', ' ').title())
                    
                    # Заголовок раздела
                    title_encoded = self._encode_for_pdf(title)
                    story.append(Paragraph(title_encoded, heading_style))
                    story.append(Spacer(1, 12))
                    
                    # Добавляем содержимое с учетом языка
                    story.extend(self._format_section_content(section_data, generation_language, normal_style))
                    
                    story.append(Spacer(1, 20))
            
            # Метаданные
            metadata = project_data.get('metadata', {})
            if metadata:
                story.append(PageBreak())
                metadata_header = self._encode_for_pdf("Метаданные")
                story.append(Paragraph(metadata_header, heading_style))
                for key, value in metadata.items():
                    meta_text = self._encode_for_pdf(f"<b>{key.replace('_', ' ').title()}:</b> {value}")
                    story.append(Paragraph(meta_text, normal_style))
            
            # Строим PDF
            doc.build(story)
            
            # Получаем размер файла
            file_size = os.path.getsize(pdf_temp_path)
            
            return {
                'success': True,
                'format': 'pdf',
                'file_path': pdf_temp_path,
                'filename': f"law_project_{project_data.get('project_id', 'unknown')}.pdf",
                'size': file_size,
                'content_type': 'application/pdf'
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f'Ошибка создания PDF: {str(e)}'
            }
    
    def _register_cyrillic_fonts(self):
        """Регистрация шрифтов с поддержкой кириллицы"""
        try:
            # Попробуем зарегистрировать DejaVu Sans (обычно доступен в системе)
            system_fonts = [
                # macOS пути
                '/System/Library/Fonts/Arial.ttf',
                '/System/Library/Fonts/Helvetica.ttc',
                '/Library/Fonts/Arial.ttf',
                # Ubuntu/Debian пути  
                '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
                '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
                '/usr/share/fonts/TTF/DejaVuSans.ttf',
                '/usr/share/fonts/TTF/DejaVuSans-Bold.ttf',
                # Windows пути
                'C:/Windows/Fonts/arial.ttf',
                'C:/Windows/Fonts/arialbd.ttf',
            ]
            
            # Ищем доступные шрифты
            available_fonts = []
            for font_path in system_fonts:
                if os.path.exists(font_path):
                    available_fonts.append(font_path)
            
            # Регистрируем первые найденные шрифты
            if available_fonts:
                # Регистрируем обычный шрифт
                normal_font = available_fonts[0]
                pdfmetrics.registerFont(TTFont('DejaVuSans', normal_font))
                
                # Ищем жирный шрифт
                bold_font = None
                for font in available_fonts:
                    if 'bold' in font.lower() or 'bd' in font.lower():
                        bold_font = font
                        break
                
                if bold_font:
                    pdfmetrics.registerFont(TTFont('DejaVuSans-Bold', bold_font))
                else:
                    # Если жирный не найден, используем обычный
                    pdfmetrics.registerFont(TTFont('DejaVuSans-Bold', normal_font))
                    
                print(f"✅ Зарегистрированы шрифты: {normal_font}")
                
            else:
                # Fallback - используем встроенные шрифты с основной латиницей
                print("⚠️ Системные шрифты не найдены, используем встроенные")
                # Обновляем стили для использования встроенных шрифтов
                self._use_builtin_fonts = True
                
        except Exception as e:
            print(f"⚠️ Ошибка регистрации шрифтов: {e}")
            self._use_builtin_fonts = True

    def _process_markdown_to_text(self, text: str) -> str:
        """Обработка markdown в обычный текст для PDF"""
        if not text:
            return ''
        
        try:
            # Конвертируем markdown в HTML и затем в текст
            md = markdown.Markdown(extensions=['extra'])
            html_text = md.convert(text)
            
            # Простая очистка HTML тегов
            import re
            # Убираем HTML теги
            clean_text = re.sub('<[^<]+?>', '', html_text)
            # Декодируем HTML entities
            clean_text = clean_text.replace('&lt;', '<').replace('&gt;', '>').replace('&amp;', '&')
            
            return clean_text
        except:
            return text
    
    def _create_title_page(self, project_data: Dict[str, Any], title_style, heading_style, normal_style) -> list:
        """Создание профессионального титульного листа"""
        
        # Стиль для центрированного заголовка страны
        country_style = ParagraphStyle(
            'CountryTitle',
            parent=title_style,
            fontSize=14,
            alignment=TA_CENTER,
            spaceAfter=6
        )
        
        # Стиль для подзаголовков
        subtitle_style = ParagraphStyle(
            'Subtitle',
            parent=normal_style,
            fontSize=12,
            alignment=TA_CENTER,
            spaceAfter=12
        )
        
        # Стиль для названия документа
        doc_title_style = ParagraphStyle(
            'DocTitle',
            parent=title_style,
            fontSize=18,
            alignment=TA_CENTER,
            spaceAfter=24,
            spaceBefore=24
        )
        
        story = []
        
        # Шапка документа
        country_text = self._encode_for_pdf("РЕСПУБЛИКА КАЗАХСТАН")
        story.append(Paragraph(country_text, country_style))
        
        parliament_text = self._encode_for_pdf("ПАРЛАМЕНТ РЕСПУБЛИКИ КАЗАХСТАН")
        story.append(Paragraph(parliament_text, subtitle_style))
        
        story.append(Spacer(1, 30))
        
        # Тип документа
        doc_type_text = self._encode_for_pdf("ПРОЕКТ ЗАКОНА РЕСПУБЛИКИ КАЗАХСТАН")
        story.append(Paragraph(doc_type_text, heading_style))
        
        story.append(Spacer(1, 40))
        
        # Название на русском языке
        if project_data.get('title_ru'):
            title_ru = f'"{project_data.get("title_ru")}"'
            title_ru_encoded = self._encode_for_pdf(title_ru)
            story.append(Paragraph(title_ru_encoded, doc_title_style))
        
        # Название на казахском языке  
        if project_data.get('title_kz'):
            title_kz = f'"{project_data.get("title_kz")}"'
            title_kz_encoded = self._encode_for_pdf(title_kz)
            story.append(Paragraph(title_kz_encoded, doc_title_style))
        
        story.append(Spacer(1, 60))
        
        # Информационный блок
        info_style = ParagraphStyle(
            'InfoBlock',
            parent=normal_style,
            fontSize=11,
            alignment=TA_LEFT,
            spaceAfter=6
        )
        
        if project_data.get('initiator'):
            initiator_text = self._encode_for_pdf(f"Инициатор: {project_data.get('initiator')}")
            story.append(Paragraph(initiator_text, info_style))
        
        date_text = self._encode_for_pdf(f"Дата подготовки: {project_data.get('generation_date', datetime.now().strftime('%d.%m.%Y'))}")
        story.append(Paragraph(date_text, info_style))
        
        id_text = self._encode_for_pdf(f"Регистрационный номер: {project_data.get('project_id', 'Не присвоен')}")
        story.append(Paragraph(id_text, info_style))
        
        # Определяем язык документа
        generation_language = project_data.get('generation_language', 'bilingual')
        if generation_language == 'ru':
            lang_text = "Язык документа: Русский"
        elif generation_language == 'kz':
            lang_text = "Тіл: Қазақша"
        else:
            lang_text = "Язык документа: Двуязычный / Тіл: Қостілді"
        
        lang_encoded = self._encode_for_pdf(lang_text)
        story.append(Paragraph(lang_encoded, info_style))
        
        story.append(Spacer(1, 80))
        
        # Место и год
        city_style = ParagraphStyle(
            'CityYear',
            parent=normal_style,
            fontSize=12,
            alignment=TA_CENTER,
            spaceAfter=6
        )
        
        city_text = self._encode_for_pdf("г. Астана")
        story.append(Paragraph(city_text, city_style))
        
        year_text = self._encode_for_pdf(str(datetime.now().year))
        story.append(Paragraph(year_text, city_style))
        
        return story

    def _create_table_of_contents(self, project_data: Dict[str, Any], heading_style, normal_style) -> list:
        """Создание оглавления документа"""
        
        toc_title_style = ParagraphStyle(
            'TOCTitle',
            parent=heading_style,
            fontSize=16,
            alignment=TA_CENTER,
            spaceAfter=20,
            spaceBefore=10
        )
        
        toc_item_style = ParagraphStyle(
            'TOCItem',
            parent=normal_style,
            fontSize=11,
            spaceAfter=6,
            leftIndent=20
        )
        
        story = []
        
        # Заголовок оглавления
        toc_header = self._encode_for_pdf("СОДЕРЖАНИЕ")
        story.append(Paragraph(toc_header, toc_title_style))
        story.append(Spacer(1, 10))
        
        # Разделы
        sections = project_data.get('sections', {})
        section_titles = {
            'annotation': '1. Аннотация',
            'explanatory_note': '2. Пояснительная записка',
            'main_text': '3. Основной текст закона',
            'comparison_table': '4. Сравнительная таблица',
            'financial_justification': '5. Финансово-экономическое обоснование',
            'regulatory_impact': '6. Оценка регулирующего воздействия (ОРВ)',
            'compliance_act': '7. Акт соответствия',
            'anticorruption_review': '8. Антикоррупционная экспертиза',
            'impact_forecast': '9. Прогноз социально-экономических последствий',
            'glossary': '10. Глоссарий терминов',
            'machine_readable': '11. Машиночитаемое приложение',
            'audit_log': '12. Аудит-лог версий'
        }
        
        for section_key in section_titles.keys():
            if section_key in sections and sections[section_key]:
                title = section_titles[section_key]
                toc_line = self._encode_for_pdf(f"{title} ............................ стр.")
                story.append(Paragraph(toc_line, toc_item_style))
        
        # Метаданные
        metadata = project_data.get('metadata', {})
        if metadata:
            meta_line = self._encode_for_pdf("13. Метаданные ............................ стр.")
            story.append(Paragraph(meta_line, toc_item_style))
        
        return story

    def _format_section_content(self, section_data, generation_language: str, normal_style) -> list:
        """Форматирование содержимого раздела с учетом языка"""
        
        story = []
        
        # Стиль для языковых заголовков
        lang_header_style = ParagraphStyle(
            'LangHeader',
            parent=normal_style,
            fontSize=12,
            spaceBefore=12,
            spaceAfter=6,
            textColor='#333333'
        )
        
        if isinstance(section_data, dict):
            content = section_data.get('content', '')
            kz_version = section_data.get('kz_version', '')
            
            # В зависимости от выбранного языка форматируем по-разному
            if generation_language == 'ru':
                # Только русский текст
                if content:
                    story.extend(self._add_text_paragraphs(content, normal_style))
                    
            elif generation_language == 'kz':
                # Только казахский текст
                if kz_version:
                    story.extend(self._add_text_paragraphs(kz_version, normal_style))
                elif content:
                    # Fallback на русский если казахского нет
                    story.extend(self._add_text_paragraphs(content, normal_style))
                    
            else:
                # Двуязычный документ - четкое разделение
                if content:
                    # Русская версия
                    ru_header = self._encode_for_pdf("<b>Версия на русском языке</b>")
                    story.append(Paragraph(ru_header, lang_header_style))
                    story.extend(self._add_text_paragraphs(content, normal_style))
                    
                if kz_version:
                    # Казахская версия
                    story.append(Spacer(1, 12))
                    kz_header = self._encode_for_pdf("<b>Қазақша нұсқасы</b>")
                    story.append(Paragraph(kz_header, lang_header_style))
                    story.extend(self._add_text_paragraphs(kz_version, normal_style))
        else:
            # Простой текстовый контент
            content = str(section_data) if section_data else ''
            if content:
                story.extend(self._add_text_paragraphs(content, normal_style))
        
        return story

    def _add_text_paragraphs(self, text: str, normal_style) -> list:
        """Добавление текстовых параграфов"""
        
        story = []
        if not text:
            return story
            
        # Обрабатываем markdown в обычный текст
        text_content = self._process_markdown_to_text(text)
        
        # Разбиваем на параграфы
        paragraphs = text_content.split('\n\n')
        for para in paragraphs:
            if para.strip():
                # Проверяем на списки
                if para.strip().startswith(('1.', '2.', '3.', '•', '-')):
                    # Стиль для списков
                    list_style = ParagraphStyle(
                        'ListItem',
                        parent=normal_style,
                        leftIndent=20,
                        spaceAfter=3
                    )
                    para_encoded = self._encode_for_pdf(para.strip())
                    story.append(Paragraph(para_encoded, list_style))
                else:
                    para_encoded = self._encode_for_pdf(para.strip())
                    story.append(Paragraph(para_encoded, normal_style))
                    
        return story

    def _encode_for_pdf(self, text: str) -> str:
        """Кодирование текста для корректного отображения в PDF"""
        if not text:
            return ''
        
        try:
            # Если используем встроенные шрифты, заменяем кириллицу на транслитерацию
            if hasattr(self, '_use_builtin_fonts') and self._use_builtin_fonts:
                # Простая транслитерация для основных кириллических символов
                cyrillic_map = {
                    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh',
                    'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
                    'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'ts',
                    'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
                    'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'YO', 'Ж': 'ZH',
                    'З': 'Z', 'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M', 'Н': 'N', 'О': 'O',
                    'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U', 'Ф': 'F', 'Х': 'H', 'Ц': 'TS',
                    'Ч': 'CH', 'Ш': 'SH', 'Щ': 'SCH', 'Ъ': '', 'Ы': 'Y', 'Ь': '', 'Э': 'E', 'Ю': 'YU', 'Я': 'YA',
                    # Казахские символы
                    'ә': 'ae', 'ғ': 'gh', 'қ': 'q', 'ң': 'ng', 'ө': 'oe', 'ұ': 'u', 'ү': 'ue', 'һ': 'h', 'і': 'i',
                    'Ә': 'AE', 'Ғ': 'GH', 'Қ': 'Q', 'Ң': 'NG', 'Ө': 'OE', 'Ұ': 'U', 'Ү': 'UE', 'Һ': 'H', 'І': 'I'
                }
                
                result = ''
                for char in text:
                    result += cyrillic_map.get(char, char)
                return result
            else:
                # Если зарегистрированы шрифты с поддержкой Unicode, возвращаем текст как есть
                return text
                
        except Exception as e:
            # В случае ошибки возвращаем исходный текст
            return text

    def cleanup_temp_file(self, file_path: str) -> bool:
        """Удаление временного файла"""
        try:
            if os.path.exists(file_path):
                os.unlink(file_path)
                return True
            return False
        except Exception as e:
            print(f"Ошибка удаления временного файла {file_path}: {e}")
            return False
    
    def get_supported_formats(self) -> Dict[str, str]:
        """Получение списка поддерживаемых форматов"""
        return {
            'txt': 'Текстовый документ (.txt)',
            'json': 'JSON файл (.json)',
            'html': 'HTML документ (.html)',
            'pdf': 'PDF документ (.pdf)'
        } 