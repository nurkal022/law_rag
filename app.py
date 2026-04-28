from flask import Flask, render_template, request, jsonify, session, send_file, redirect, url_for
import uuid
import os
import json as _json
import io
import hashlib
from datetime import datetime
from functools import wraps
from config import Config
from database.models import DatabaseManager, db
from embeddings.processor import DocumentProcessor
from rag.retriever import DocumentRetriever
from rag.generator import ResponseGenerator
from law_generator import LawProjectGenerator, DataValidator
from law_generator.generator import LawProjectData
from law_generator.export import DocumentExporter
from legal_analytics import LegalCommentAnalyzer, AnalyticsDashboard, DataLoader
from contracts import ContractGenerator, ContractAnalyzer, ContractTemplates

# Инициализация Flask приложения
app = Flask(__name__)
app.config.from_object(Config)

# Инициализация компонентов RAG системы
db_manager = DatabaseManager()
db_manager.init_app(app)

# Глобальные переменные для ленивой загрузки RAG
doc_processor = None
retriever = None
rag_initialized = False
rag_initializing = False

# Инициализация генераторов с поддержкой провайдеров
generator = None
law_generator = None

try:
    from llm_providers.factory import LLMProviderFactory
    provider = LLMProviderFactory.get_current_provider()
    if provider:
        generator = ResponseGenerator(provider=provider)
        law_generator = LawProjectGenerator(provider=provider, database_manager=db_manager)
        print(f"✅ LLM провайдер инициализирован: {Config.LLM_PROVIDER_TYPE}")
        
        # Проверяем доступность провайдера
        if not provider.is_available():
            print(f"⚠️  ВНИМАНИЕ: Ollama недоступна!")
            print("   Убедитесь, что Ollama запущена: ollama serve")
            print("   Или установите модель: ollama pull gpt-oss:20b")
    else:
        print("⚠️  ВНИМАНИЕ: LLM провайдер не настроен!")
        print("   Убедитесь, что Ollama запущена на http://localhost:11434")
        print("   Установите модель: ollama pull gpt-oss:20b")
        print("   Установите LLM_PROVIDER_TYPE=ollama в .env")
except Exception as e:
    print(f"⚠️  Ошибка инициализации LLM провайдера: {e}")
    print("   Проверьте настройки в config.py или переменные окружения")

# Инициализация модуля договоров
contract_templates = ContractTemplates()
contract_generator = None
contract_analyzer = None
try:
    if provider:
        contract_generator = ContractGenerator(provider=provider)
        contract_analyzer = ContractAnalyzer(provider=provider)
        print("✅ Модуль договоров инициализирован")
except Exception as e:
    print(f"⚠️  Ошибка инициализации модуля договоров: {e}")

# Инициализация валидатора данных и экспортера
data_validator = DataValidator()
document_exporter = DocumentExporter()

# Инициализация компонентов правовой аналитики
legal_analyzer = LegalCommentAnalyzer()
analytics_dashboard = AnalyticsDashboard()
data_loader = DataLoader()

_PAGE_PATHS = {'/', '/chat', '/chat-simple', '/tools', '/about', '/law-generator', '/legal-analytics'}

# User-Agent подстроки внутренних клиентов (Docker healthcheck, мониторинг).
# Такие запросы не учитываются в page_visits.
_INTERNAL_UA_SUBSTRINGS = ('curl/', 'wget/', 'kube-probe', 'healthcheck')


@app.route('/healthz')
def healthz():
    """Лёгкий health-check для Docker/K8s. Не пишется в page_visits."""
    return 'ok', 200


@app.before_request
def track_visit():
    """Запись посещений публичных страниц"""
    if request.method != 'GET':
        return
    if request.path not in _PAGE_PATHS:
        return
    try:
        ua = request.headers.get('User-Agent', '')
        ua_lower = ua.lower()
        # Пропускаем healthcheck'и и боты-мониторы — не должны раздувать статистику
        if any(s in ua_lower for s in _INTERNAL_UA_SUBSTRINGS):
            return
        ip = request.headers.get('CF-Connecting-IP') or \
             request.headers.get('X-Forwarded-For', request.remote_addr).split(',')[0].strip()
        ip_hash = hashlib.sha256(ip.encode()).hexdigest()
        referer = request.headers.get('Referer', '')
        # Определяем тип устройства
        if any(k in ua_lower for k in ('mobile', 'android', 'iphone')):
            device = 'mobile'
        elif any(k in ua_lower for k in ('tablet', 'ipad')):
            device = 'tablet'
        else:
            device = 'desktop'
        db_manager.record_visit(request.path, ip_hash, ua, referer or None, device)
    except Exception:
        pass


def initialize_rag_system():
    """Инициализация системы поиска по документам по требованию"""
    global doc_processor, retriever, rag_initialized, rag_initializing
    
    if rag_initialized or rag_initializing:
        return True
    
    try:
        rag_initializing = True
        print("🔄 Инициализация ИИ системы поиска по документам...")
        
        with app.app_context():
            doc_processor = DocumentProcessor(db_manager)
            retriever = DocumentRetriever(db_manager)
        
        rag_initialized = True
        rag_initializing = False
        # Expose to blueprint via app context
        app.doc_processor = doc_processor
        app.retriever = retriever
        print("✅ ИИ система успешно инициализирована")
        return True

    except Exception as e:
        rag_initializing = False
        print(f"❌ Ошибка инициализации ИИ системы: {e}")
        return False

def ensure_rag_initialized():
    """Проверка и инициализация системы поиска по документам если необходимо"""
    if not rag_initialized:
        return initialize_rag_system()
    return True


# Регистрация admin blueprint (после определения всех shared функций)
from blueprints.admin import admin_bp
app.register_blueprint(admin_bp)

# Expose shared objects to blueprint via current_app
app.db_manager = db_manager
app.doc_processor = doc_processor  # None until RAG initialized; updated in initialize_rag_system
app.retriever = retriever           # None until RAG initialized; updated in initialize_rag_system
app.generator = generator
app.ensure_rag_initialized = ensure_rag_initialized


# Автоматическая инициализация RAG при старте приложения в фоне.
# Пользователю не нужно нажимать «Запустить» — embeddings загружаются
# параллельно с web-сервером и обычно готовы через 5-15 секунд.
# RAG_AUTOINIT=0 в env отключает (для тестов / dev).
if os.getenv('RAG_AUTOINIT', '1') == '1':
    import threading
    def _bg_rag_init():
        try:
            initialize_rag_system()
        except Exception as e:
            print(f"⚠️  Фоновая инициализация RAG не удалась: {e}")
    threading.Thread(target=_bg_rag_init, daemon=True, name='rag-autoinit').start()


@app.route('/')
def index():
    """Главная страница - дашборд с инструментами"""
    return render_template('index.html')

@app.route('/chat')
def chat_page():
    """Страница чата с поиском по документам"""
    # Создаем новую сессию если её нет
    if 'session_id' not in session:
        session['session_id'] = str(uuid.uuid4())
    
    # Получаем статистику базы данных
    stats = db_manager.get_documents_stats()
    
    return render_template('chat.html', stats=stats, use_rag=True)

@app.route('/chat-simple')
def chat_simple_page():
    """Страница простого чата без поиска по документам"""
    # Создаем новую сессию если её нет
    if 'session_id' not in session:
        session['session_id'] = str(uuid.uuid4())
    
    return render_template('chat_simple.html', use_rag=False)

@app.route('/tools')
def tools_page():
    """Страница инструментов"""
    return render_template('tools.html')

@app.route('/about')
def about_page():
    """Страница о платформе"""
    return render_template('about.html')

@app.route('/api/chat/upload', methods=['POST'])
def chat_upload():
    """Загрузка PDF или DOCX файла для анализа в чате"""
    if 'file' not in request.files:
        return jsonify({'error': 'Файл не прикреплён'}), 400

    file = request.files['file']
    if not file.filename:
        return jsonify({'error': 'Пустое имя файла'}), 400

    filename = file.filename.lower()
    extracted_text = ''

    try:
        if filename.endswith('.pdf'):
            import pdfplumber
            import tempfile, os
            with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp:
                file.save(tmp.name)
                tmp_path = tmp.name
            try:
                with pdfplumber.open(tmp_path) as pdf:
                    pages = []
                    for page in pdf.pages[:30]:  # max 30 страниц
                        text = page.extract_text()
                        if text:
                            pages.append(text)
                    extracted_text = '\n\n'.join(pages)
            finally:
                os.unlink(tmp_path)

        elif filename.endswith('.docx'):
            from docx import Document
            import tempfile, os
            with tempfile.NamedTemporaryFile(delete=False, suffix='.docx') as tmp:
                file.save(tmp.name)
                tmp_path = tmp.name
            try:
                doc = Document(tmp_path)
                paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
                extracted_text = '\n'.join(paragraphs)
            finally:
                os.unlink(tmp_path)

        else:
            return jsonify({'error': 'Поддерживаются только PDF и DOCX файлы'}), 400

        if not extracted_text.strip():
            return jsonify({'error': 'Не удалось извлечь текст из документа'}), 400

        # Ограничиваем длину до ~8000 символов
        if len(extracted_text) > 8000:
            extracted_text = extracted_text[:8000] + '\n\n[...текст обрезан, показаны первые 8000 символов]'

        return jsonify({
            'success': True,
            'text': extracted_text,
            'filename': file.filename,
            'length': len(extracted_text)
        })

    except Exception as e:
        return jsonify({'error': f'Ошибка при чтении файла: {str(e)}'}), 500


@app.route('/api/chat', methods=['POST'])
def chat():
    """API для обработки чат-запросов"""
    try:
        data = request.get_json()
        user_query = data.get('query', '').strip()
        use_rag = data.get('use_rag', True)  # По умолчанию используем поиск по документам
        
        if not user_query:
            return jsonify({
                'error': 'Пустой запрос',
                'answer': 'Пожалуйста, введите ваш вопрос.'
            }), 400
        
        if not generator:
            error_msg = """⚠️ **LLM провайдер не настроен**

**Решения для локальной работы:**
1. Убедитесь, что Ollama запущена (`ollama serve`)
2. Установите модель: `ollama pull gpt-oss:20b`
3. Настройте в `/admin` → Настройки моделей LLM

**Быстрый старт:**
```bash
ollama serve
ollama pull gpt-oss:20b
```"""
            return jsonify({
                'error': 'LLM провайдер не настроен',
                'answer': error_msg,
                'error_type': 'config_error'
            }), 500
        
        # Получаем ID сессии
        session_id = session.get('session_id', str(uuid.uuid4()))
        session['session_id'] = session_id
        
        # Если режим поиска по документам включен, проверяем инициализацию
        if use_rag:
            # Проверяем инициализацию системы поиска по документам
            if not ensure_rag_initialized():
                error_msg = """⚠️ **ИИ система не инициализирована**

Пожалуйста, сначала инициализируйте систему:
1. Перейдите в `/admin`
2. Нажмите "Инициализировать систему поиска" или "Автоматическая настройка"
3. Дождитесь завершения обработки документов

Или переключитесь в режим "Простой чат" для общения без поиска по документам."""
                return jsonify({
                    'error': 'ИИ система не инициализирована',
                    'answer': error_msg,
                    'error_type': 'rag_not_initialized'
                }), 503
            
            # Проверяем наличие документов с embeddings
            stats = db_manager.get_documents_stats()
            if stats.get('chunks_with_embeddings', 0) == 0:
                error_msg = """⚠️ **Документы не обработаны**

Документы загружены, но embeddings еще не созданы.

**Решения:**
1. Перейдите в `/admin`
2. Нажмите "Обработать все документы" для создания embeddings
3. Или используйте "Автоматическая настройка"
4. Или переключитесь в режим "Чистый чат" для общения без поиска по документам

После обработки документов чат будет работать."""
                return jsonify({
                    'error': 'Документы не обработаны',
                    'answer': error_msg,
                    'error_type': 'no_embeddings',
                    'stats': stats
                }), 503
            
            # Поиск релевантных документов
            try:
                search_results = retriever.hybrid_search(user_query, Config.TOP_K_RESULTS)
                formatted_results = retriever.format_search_results(search_results)
            except Exception as e:
                print(f"Ошибка при поиске документов: {e}")
                error_msg = f"Ошибка при поиске документов: {str(e)}"
                return jsonify({
                    'error': error_msg,
                    'answer': error_msg,
                    'error_type': 'search_error'
                }), 500
        else:
            # Режим без поиска по документам - не ищем документы
            formatted_results = []
        
        # Получаем историю разговора
        conversation_history = db_manager.get_chat_history(session_id, limit=5)
        
        # Генерируем ответ
        try:
            if use_rag:
                response_data = generator.generate_response(
                    user_query, 
                    formatted_results, 
                    conversation_history
                )
            else:
                # Режим без поиска по документам - используем основной провайдер (Ollama)
                if not generator:
                    raise Exception("LLM провайдер не настроен")
                response_data = generator.generate_response_without_rag(
                    user_query,
                    conversation_history
                )
                response_data['model_type'] = 'ollama'
        except Exception as e:
            print(f"Ошибка при генерации ответа: {e}")
            error_msg = f"Ошибка при генерации ответа: {str(e)}"
            return jsonify({
                'error': error_msg,
                'answer': error_msg,
                'error_type': 'generation_error',
                'sources': formatted_results,
                'search_results_count': len(formatted_results)
            }), 500
        
        # Сохраняем в историю только если нет критической ошибки
        chat_history_id = None
        if not response_data.get('error_type') == 'api_error':
            try:
                chat_history_id = db_manager.save_chat_history(
                    session_id,
                    user_query,
                    response_data['answer'],
                    response_data['sources']
                )
            except Exception as e:
                print(f"Ошибка сохранения истории: {e}")

        return jsonify({
            'answer': response_data['answer'],
            'sources': response_data['sources'],
            'confidence': response_data['confidence'],
            'query_validation': generator.validate_legal_query(user_query) if generator else None,
            'search_results_count': len(formatted_results),
            'session_id': session_id,
            'chat_history_id': chat_history_id,
            'error': response_data.get('error'),
            'error_type': response_data.get('error_type'),
            'model_type': response_data.get('model_type', 'default')
        })
        
    except Exception as e:
        import traceback
        print(f"Ошибка в чате: {e}")
        traceback.print_exc()
        return jsonify({
            'error': f'Произошла ошибка: {str(e)}',
            'answer': f'⚠️ Произошла неожиданная ошибка: {str(e)}\n\nПожалуйста, проверьте логи сервера или обратитесь к администратору.',
            'error_type': 'unexpected_error'
        }), 500

@app.route('/api/search', methods=['POST'])
def search_documents():
    """API для поиска документов без генерации ответа"""
    try:
        data = request.get_json()
        query = data.get('query', '').strip()
        
        if not query:
            return jsonify({'error': 'Пустой запрос'}), 400
        
        # Проверяем инициализацию системы поиска по документам
        if not ensure_rag_initialized():
            return jsonify({
                'error': 'ИИ система не инициализирована. Пожалуйста, сначала инициализируйте систему.'
            }), 503
        
        # Поиск документов
        search_results = retriever.hybrid_search(query, top_k=10)
        formatted_results = retriever.format_search_results(search_results)
        
        return jsonify({
            'results': formatted_results,
            'total_found': len(formatted_results),
            'query': query
        })
        
    except Exception as e:
        print(f"Ошибка поиска: {e}")
        return jsonify({'error': f'Произошла ошибка: {str(e)}'}), 500

@app.route('/api/document/<int:chunk_id>')
def get_document_chunk(chunk_id):
    """Получение подробной информации о чанке документа"""
    try:
        chunk = db_manager.get_chunk_by_id(chunk_id)
        if not chunk:
            return jsonify({'error': 'Чанк не найден'}), 404
        
        # Проверяем инициализацию системы поиска по документам
        if not ensure_rag_initialized():
            return jsonify({
                'error': 'ИИ система не инициализирована. Пожалуйста, сначала инициализируйте систему.'
            }), 503
        
        # Получаем контекст (соседние чанки)
        context = retriever.get_document_context(chunk_id, context_size=2)
        
        return jsonify({
            'chunk': chunk,
            'context': context
        })
        
    except Exception as e:
        print(f"Ошибка получения чанка: {e}")
        return jsonify({'error': f'Произошла ошибка: {str(e)}'}), 500

@app.route('/api/history')
def chat_history():
    """Получение истории чата для текущей сессии"""
    try:
        session_id = session.get('session_id')
        if not session_id:
            return jsonify({'history': []})
        
        history = db_manager.get_chat_history(session_id, limit=20)
        return jsonify({'history': history})
        
    except Exception as e:
        print(f"Ошибка получения истории: {e}")
        return jsonify({'error': f'Произошла ошибка: {str(e)}'}), 500

@app.route('/api/stats')
def get_stats():
    """Получение статистики системы"""
    try:
        stats = db_manager.get_documents_stats()
        return jsonify(stats)
        
    except Exception as e:
        print(f"Ошибка получения статистики: {e}")
        return jsonify({'error': f'Произошла ошибка: {str(e)}'}), 500

@app.route('/api/rag/initialize', methods=['POST'])
def initialize_rag():
    """Инициализация системы поиска по документам"""
    global rag_initialized, rag_initializing
    
    try:
        if rag_initialized:
            return jsonify({
                'success': True,
                'message': 'ИИ система уже инициализирована',
                'initialized': True
            })
        
        if rag_initializing:
            return jsonify({
                'success': False,
                'message': 'ИИ система уже инициализируется',
                'initializing': True
            }), 202
        
        # Инициализируем систему поиска по документам
        success = initialize_rag_system()
        
        if success:
            return jsonify({
                'success': True,
                'message': 'ИИ система успешно инициализирована',
                'initialized': True
            })
        else:
            return jsonify({
                'success': False,
                'message': 'Ошибка инициализации ИИ системы',
                'initialized': False
            }), 500
            
    except Exception as e:
        print(f"Ошибка инициализации системы поиска: {e}")
        return jsonify({
            'success': False,
            'message': f'Произошла ошибка: {str(e)}',
            'initialized': False
        }), 500

@app.route('/api/rag/status')
def rag_status():
    """Получение статуса системы поиска по документам"""
    return jsonify({
        'initialized': rag_initialized,
        'initializing': rag_initializing,
        'ready': rag_initialized and not rag_initializing
    })

# Маршруты для генерации законопроектов

@app.route('/law-generator')
def law_generator_page():
    """Страница генератора законопроектов"""
    if not law_generator:
        return render_template('error.html', 
                             error="LLM провайдер не настроен. Настройте Ollama в /admin"), 500
    
    # Получаем вопросы для сбора данных
    questions = law_generator.get_data_collection_questions()
    
    # Получаем статистику законопроектов
    law_stats = db_manager.get_law_projects_stats()
    
    return render_template('law_generator.html', 
                         questions=questions, 
                         law_stats=law_stats)

@app.route('/api/law-generator/validate', methods=['POST'])
def validate_law_data():
    """Валидация данных для генерации законопроекта"""
    try:
        data = request.get_json()
        
        # Создаем объект данных
        law_data = LawProjectData(**data)
        
        # Валидируем данные
        validation_result = data_validator.validate_project_data(law_data)
        
        return jsonify(validation_result)
        
    except Exception as e:
        return jsonify({
            'is_valid': False,
            'error': f'Ошибка валидации: {str(e)}'
        }), 400

@app.route('/api/law-generator/generate', methods=['POST'])
def generate_law_project():
    """Генерация полного законопроекта"""
    try:
        if not law_generator:
            return jsonify({
                'success': False,
                'error': 'Генератор законопроектов не доступен'
            }), 500
        
        data = request.get_json()
        
        # Создаем объект данных
        law_data = LawProjectData(**data)
        
        # Генерируем полный документ
        generation_result = law_generator.generate_full_document(law_data)
        
        if generation_result['success']:
            # Сохраняем в базу данных
            db_manager.save_law_project(
                generation_result['project_id'],
                data,
                generation_result['sections'],
                generation_result['metadata']
            )
        
        return jsonify(generation_result)
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Ошибка генерации: {str(e)}'
        }), 500

@app.route('/api/law-generator/session', methods=['POST', 'PUT'])
def manage_generation_session():
    """Управление сессией генерации"""
    try:
        if request.method == 'POST':
            # Создание новой сессии
            session_id = str(uuid.uuid4())
            data = request.get_json() or {}
            
            success = db_manager.save_generation_session(
                session_id,
                current_step=data.get('current_step', 1),
                collected_data=data.get('collected_data', {}),
                validation_results=data.get('validation_results', {})
            )
            
            if success:
                return jsonify({
                    'success': True,
                    'session_id': session_id
                })
            else:
                return jsonify({
                    'success': False,
                    'error': 'Ошибка создания сессии'
                }), 500
                
        elif request.method == 'PUT':
            # Обновление существующей сессии
            data = request.get_json()
            session_id = data.get('session_id')
            
            if not session_id:
                return jsonify({
                    'success': False,
                    'error': 'Отсутствует session_id'
                }), 400
            
            success = db_manager.save_generation_session(
                session_id,
                current_step=data.get('current_step'),
                collected_data=data.get('collected_data'),
                validation_results=data.get('validation_results')
            )
            
            return jsonify({'success': success})
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Ошибка управления сессией: {str(e)}'
        }), 500

@app.route('/api/law-generator/session/<session_id>')
def get_generation_session(session_id):
    """Получение данных сессии генерации"""
    try:
        session_data = db_manager.get_generation_session(session_id)
        
        if session_data:
            return jsonify({
                'success': True,
                'session': session_data
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Сессия не найдена'
            }), 404
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Ошибка получения сессии: {str(e)}'
        }), 500

@app.route('/api/law-projects')
def get_law_projects():
    """Получение списка законопроектов"""
    try:
        status = request.args.get('status')
        limit = int(request.args.get('limit', 50))
        
        projects = db_manager.get_law_projects_list(status=status, limit=limit)
        law_stats = db_manager.get_law_projects_stats()
        
        return jsonify({
            'success': True,
            'projects': projects,
            'stats': law_stats
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Ошибка получения списка: {str(e)}'
        }), 500

@app.route('/api/law-projects/<project_id>')
def get_law_project(project_id):
    """Получение конкретного законопроекта"""
    try:
        project = db_manager.get_law_project(project_id)
        
        if project:
            return jsonify({
                'success': True,
                'project': project
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Проект не найден'
            }), 404
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Ошибка получения проекта: {str(e)}'
        }), 500

@app.route('/api/law-projects/<project_id>/export')
def export_law_project(project_id):
    """Экспорт законопроекта в различных форматах"""
    try:
        project = db_manager.get_law_project(project_id)
        
        if not project:
            return jsonify({
                'success': False,
                'error': 'Проект не найден'
            }), 404
        
        # Получаем формат из параметров запроса
        format_type = request.args.get('format', 'txt')
        
        # Экспортируем проект
        export_result = document_exporter.export_project(project, format_type)
        
        if export_result['success']:
            # Определяем MIME тип
            mime_types = {
                'txt': 'text/plain',
                'json': 'application/json',
                'html': 'text/html',
                'pdf': 'application/pdf'
            }
            
            # Возвращаем файл для скачивания
            return send_file(
                export_result['file_path'],
                as_attachment=True,
                download_name=export_result['filename'],
                mimetype=mime_types.get(format_type, 'application/octet-stream')
            )
        else:
            return jsonify(export_result), 400
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Ошибка экспорта: {str(e)}'
        }), 500

@app.route('/api/law-projects/<project_id>/export/formats')
def get_export_formats(project_id):
    """Получение списка доступных форматов экспорта"""
    try:
        project = db_manager.get_law_project(project_id)
        
        if not project:
            return jsonify({
                'success': False,
                'error': 'Проект не найден'
            }), 404
        
        formats = document_exporter.get_supported_formats()
        
        return jsonify({
            'success': True,
            'formats': formats,
            'project_id': project_id
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Ошибка получения форматов: {str(e)}'
        }), 500

@app.route('/api/law-generator/help/<field_name>')
def get_field_help(field_name):
    """Получение справки по полю"""
    try:
        help_info = data_validator.get_validation_help(field_name)
        return jsonify({
            'success': True,
            'help': help_info
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Ошибка получения справки: {str(e)}'
        }), 500

# Маршруты для правовой аналитики

@app.route('/analytics-showcase')
def analytics_showcase():
    return render_template('analytics_showcase.html')


@app.route('/legal-analytics')
def legal_analytics_page():
    """Страница правовой аналитики"""
    return render_template('legal_analytics.html')

@app.route('/api/legal-analytics/upload', methods=['POST'])
def upload_analytics_data():
    """Загрузка данных для анализа"""
    try:
        if 'file' not in request.files:
            return jsonify({
                'success': False,
                'error': 'Файл не загружен'
            }), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({
                'success': False,
                'error': 'Файл не выбран'
            }), 400
        
        # Сохраняем временный файл
        import tempfile
        import os
        
        with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as tmp_file:
            file.save(tmp_file.name)
            temp_path = tmp_file.name
        
        try:
            # Загружаем данные из Excel
            projects = data_loader.load_from_excel(temp_path)
            
            if not projects:
                return jsonify({
                    'success': False,
                    'error': 'Не удалось загрузить данные из файла'
                }), 400
            
            # Анализируем данные
            analysis_results = legal_analyzer.analyze_projects(projects)
            
            # Генерируем дашборд
            dashboard_data = analytics_dashboard.generate_dashboard_data(analysis_results)
            
            # Конвертируем кортежи в сериализуемый формат
            serializable_data = convert_tuples_to_serializable(dashboard_data)
            
            return jsonify({
                'success': True,
                'message': f'Анализ завершен. Обработано {len(projects)} проектов',
                'dashboard_data': serializable_data,
                'projects_count': len(projects)
            })
            
        finally:
            # Удаляем временный файл
            if os.path.exists(temp_path):
                os.unlink(temp_path)
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Ошибка обработки файла: {str(e)}'
        }), 500

def convert_tuples_to_serializable(obj):
    """Конвертирует кортежи и другие несериализуемые объекты в сериализуемые"""
    if isinstance(obj, tuple):
        return list(obj)
    elif isinstance(obj, dict):
        return {k: convert_tuples_to_serializable(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_tuples_to_serializable(item) for item in obj]
    else:
        return obj

@app.route('/api/legal-analytics/demo')
def get_demo_analytics():
    """Получение демо-аналитики"""
    try:
        # Загружаем демо-данные
        projects = data_loader.load_demo_data()
        
        # Анализируем данные
        analysis_results = legal_analyzer.analyze_projects(projects)
        
        # Генерируем дашборд
        dashboard_data = analytics_dashboard.generate_dashboard_data(analysis_results)
        
        # Конвертируем кортежи в сериализуемый формат
        serializable_data = convert_tuples_to_serializable(dashboard_data)
        
        return jsonify({
            'success': True,
            'message': 'Демо-аналитика загружена',
            'dashboard_data': serializable_data,
            'projects_count': len(projects)
        })
        
    except Exception as e:
        print(f"Ошибка загрузки демо-данных: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': f'Ошибка загрузки демо-данных: {str(e)}'
        }), 500

@app.route('/api/legal-analytics/export/<format_type>')
def export_analytics_report(format_type):
    """Экспорт отчета аналитики"""
    try:
        # Загружаем демо-данные для экспорта
        projects = data_loader.load_demo_data()
        analysis_results = legal_analyzer.analyze_projects(projects)
        dashboard_data = analytics_dashboard.generate_dashboard_data(analysis_results)
        
        # Экспортируем в нужном формате
        if format_type == 'html':
            content = analytics_dashboard.export_dashboard_data(dashboard_data, 'html')
            
            # Создаем временный файл
            import tempfile
            with tempfile.NamedTemporaryFile(mode='w', suffix='.html', delete=False, encoding='utf-8') as f:
                f.write(content)
                temp_path = f.name
            
            return send_file(
                temp_path,
                as_attachment=True,
                download_name=f'legal_analytics_report_{datetime.now().strftime("%Y%m%d")}.html',
                mimetype='text/html'
            )
        
        elif format_type == 'json':
            content = analytics_dashboard.export_dashboard_data(dashboard_data, 'json')
            
            import tempfile
            with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False, encoding='utf-8') as f:
                f.write(content)
                temp_path = f.name
            
            return send_file(
                temp_path,
                as_attachment=True,
                download_name=f'legal_analytics_report_{datetime.now().strftime("%Y%m%d")}.json',
                mimetype='application/json'
            )
        
        elif format_type == 'pdf':
            # Добавим поддержку PDF экспорта
            content = analytics_dashboard.export_dashboard_data(dashboard_data, 'pdf')
            
            import tempfile
            with tempfile.NamedTemporaryFile(mode='wb', suffix='.pdf', delete=False) as f:
                f.write(content)
                temp_path = f.name
            
            return send_file(
                temp_path,
                as_attachment=True,
                download_name=f'legal_analytics_report_{datetime.now().strftime("%Y%m%d")}.pdf',
                mimetype='application/pdf'
            )
        
        else:
            return jsonify({
                'success': False,
                'error': 'Неподдерживаемый формат экспорта'
            }), 400
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Ошибка экспорта: {str(e)}'
        }), 500

@app.route('/api/legal-analytics/advanced-metrics')
def get_advanced_metrics():
    """Получение расширенных метрик аналитики"""
    try:
        # Загружаем демо-данные
        projects = data_loader.load_demo_data()
        
        # Анализируем проекты
        analysis_results = legal_analyzer.analyze_projects(projects)
        
        # Возвращаем только расширенные метрики
        advanced_metrics = {
            'emotion_analysis': analysis_results.get('emotion_analysis', {}),
            'temporal_analysis': analysis_results.get('temporal_analysis', {}),
            'geographic_analysis': analysis_results.get('geographic_analysis', {}),
            'network_analysis': analysis_results.get('network_analysis', {}),
            'controversy_analysis': analysis_results.get('controversy_analysis', {}),
            'quality_metrics': analysis_results.get('quality_metrics', {}),
            'predictive_insights': analysis_results.get('predictive_insights', {})
        }
        
        # Конвертируем кортежи в сериализуемый формат
        serializable_metrics = convert_tuples_to_serializable(advanced_metrics)
        
        return jsonify({
            'success': True,
            'data': serializable_metrics
        })
        
    except Exception as e:
        print(f"Ошибка получения расширенных метрик: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/legal-analytics/ml-insights')
def get_ml_insights():
    """Получение ML-инсайтов и предсказаний"""
    try:
        # Создаем ML-инсайты
        ml_insights = {
            'sentiment_prediction': {
                'next_week': 'Ожидается рост позитивных комментариев на 8%',
                'confidence': 82,
                'trend': 'positive'
            },
            'engagement_prediction': {
                'next_week': 'Прогнозируется увеличение активности на 12%',
                'confidence': 75,
                'trend': 'growing'
            },
            'topic_trends': {
                'emerging': ['AI регулирование', 'Защита данных'],
                'declining': ['Бумажный документооборот'],
                'stable': ['Государственные услуги']
            },
            'risk_alerts': [
                {
                    'type': 'high_controversy',
                    'message': 'Проект 15567336 показывает высокий уровень спорности',
                    'severity': 'high',
                    'recommendation': 'Требуется дополнительное разъяснение позиции'
                }
            ],
            'quality_recommendations': [
                'Увеличить время ответа на комментарии',
                'Привлечь больше экспертов к обсуждению',
                'Создать FAQ по часто задаваемым вопросам'
            ]
        }
        
        return jsonify({
            'success': True,
            'data': ml_insights
        })
        
    except Exception as e:
        print(f"Ошибка получения ML-инсайтов: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# ==================== Договоры ====================

@app.route('/contracts')
def contracts_page():
    """Страница анализа и генерации договоров"""
    types = contract_templates.get_all_types()
    return render_template('contracts.html', contract_types=types)

@app.route('/api/contracts/types')
def get_contract_types():
    """Список типов договоров"""
    return jsonify({'success': True, 'types': contract_templates.get_all_types()})

@app.route('/api/contracts/fields/<contract_type>')
def get_contract_fields(contract_type):
    """Поля формы для типа договора"""
    fields = contract_templates.get_fields(contract_type)
    if not fields:
        return jsonify({'success': False, 'error': 'Неизвестный тип договора'}), 404
    sections = contract_templates.get_sections(contract_type)
    type_info = contract_templates.get_type_info(contract_type)
    return jsonify({'success': True, 'fields': fields, 'sections': sections, 'type_info': type_info})

@app.route('/api/contracts/generate', methods=['POST'])
def generate_contract():
    """Генерация договора"""
    if not contract_generator:
        return jsonify({'success': False, 'error': 'Генератор договоров не инициализирован'}), 503
    data = request.get_json()
    contract_type = data.pop('contract_type', None)
    language = data.pop('language', 'ru')
    if not contract_type:
        return jsonify({'success': False, 'error': 'Не указан тип договора'}), 400
    if rag_initialized and retriever:
        contract_generator.retriever = retriever
    result = contract_generator.generate(contract_type, data, language)
    return jsonify(result)

@app.route('/api/contracts/analyze', methods=['POST'])
def analyze_contract():
    """Анализ договора"""
    if not contract_analyzer:
        return jsonify({'success': False, 'error': 'Анализатор договоров не инициализирован'}), 503
    text = ''
    contract_type = None
    if 'file' in request.files:
        file = request.files['file']
        if file.filename:
            text = contract_analyzer.extract_text_from_file(file)
            contract_type = request.form.get('contract_type')
    else:
        data = request.get_json() or {}
        text = data.get('text', '')
        contract_type = data.get('contract_type')
    if not text or len(text.strip()) < 50:
        return jsonify({'success': False, 'error': 'Текст договора слишком короткий или не удалось извлечь текст из файла'}), 400
    if rag_initialized and retriever:
        contract_analyzer.retriever = retriever
    result = contract_analyzer.analyze(text, contract_type)
    return jsonify(result)

@app.errorhandler(404)
def not_found(error):
    return render_template('404.html'), 404

@app.errorhandler(500)
def internal_error(error):
    return render_template('500.html'), 500

# Инициализация при запуске
def initialize_app():
    """Инициализация приложения"""
    print("🚀 Запуск LawVision — юридическая платформа")
    print("=" * 60)
    
    # Проверяем наличие документов
    if os.path.exists(Config.DOCUMENTS_DIR):
        doc_count = len([f for f in os.listdir(Config.DOCUMENTS_DIR) if f.endswith('.txt')])
        print(f"📁 Найдено {doc_count} документов в {Config.DOCUMENTS_DIR}")
    else:
        print(f"⚠️  Директория с документами {Config.DOCUMENTS_DIR} не найдена")
    
    # Проверяем базу данных (в контексте приложения)
    with app.app_context():
        stats = db_manager.get_documents_stats()
        print(f"🗄️  База данных: {stats['documents_count']} документов, {stats['chunks_count']} чанков")
        print(f"🧠 Embeddings: {stats['chunks_with_embeddings']} чанков ({stats['embedding_progress']:.1f}%)")
        
        # Автоматическая инициализация RAG системы
        if stats['chunks_with_embeddings'] > 0:
            print("\n🔄 Автоматическая инициализация ИИ системы...")
            initialize_rag_system()
        elif stats['documents_count'] > 0 and stats['chunks_count'] == 0:
            print("\n🔄 Обработка документов и инициализация ИИ системы...")
            initialize_rag_system()
            if doc_processor:
                result = doc_processor.process_all_documents(Config.DOCUMENTS_DIR)
                if result.get('processed', 0) > 0:
                    print(f"✅ Обработано {result['processed']} документов")

        # Обновляем stats после возможной обработки
        stats = db_manager.get_documents_stats()
        if stats['chunks_with_embeddings'] > 0:
            print(f"\n✅ База данных готова: {stats['documents_count']} документов, {stats['chunks_with_embeddings']} чанков с embeddings")
        elif stats['documents_count'] > 0:
            print("\n⚠️  Embeddings не созданы. Перейдите в /admin для обработки")
    
    # Проверяем статус LLM провайдера
    try:
        from llm_providers.factory import LLMProviderFactory
        provider = LLMProviderFactory.get_current_provider()
        if provider and provider.is_available():
            print(f"\n✅ LLM провайдер настроен: {Config.LLM_PROVIDER_TYPE} ({Config.LLM_MODEL})")
        else:
            print("\n⚠️  ВНИМАНИЕ: LLM провайдер не доступен!")
            print(f"   Тип: {Config.LLM_PROVIDER_TYPE}")
            print(f"   Убедитесь, что Ollama запущена на {Config.OLLAMA_BASE_URL}")
            print("   Запустите: ollama serve")
            print("   Установите модель: ollama pull gpt-oss:20b")
    except Exception as e:
        print(f"\n⚠️  Ошибка проверки LLM провайдера: {e}")
    
    print("=" * 60)
    print("🌐 LawVision готов к работе!")
    print("   Интерфейс: http://localhost:5003")
    print("   Админ панель: http://localhost:5003/admin")
    print("=" * 60)

if __name__ == '__main__':
    initialize_app()
    app.run(host='0.0.0.0', port=5003, debug=Config.DEBUG) 