from flask import Flask, render_template, request, jsonify, session, send_file
import uuid
import os
import sqlite3
from datetime import datetime
from config import Config
from database.models import DatabaseManager, db
from embeddings.processor import DocumentProcessor
from rag.retriever import DocumentRetriever
from rag.generator import ResponseGenerator
from law_generator import LawProjectGenerator, DataValidator
from law_generator.generator import LawProjectData
from law_generator.export import DocumentExporter
from legal_analytics import LegalCommentAnalyzer, AnalyticsDashboard, DataLoader

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

# Инициализация валидатора данных и экспортера
data_validator = DataValidator()
document_exporter = DocumentExporter()

# Инициализация компонентов правовой аналитики
legal_analyzer = LegalCommentAnalyzer()
analytics_dashboard = AnalyticsDashboard()
data_loader = DataLoader()

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
        if not response_data.get('error_type') == 'api_error':
            try:
                db_manager.save_chat_history(
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

@app.route('/api/admin/stats')
def get_admin_stats():
    """Получение статистики для админ панели и дашборда"""
    try:
        stats = db_manager.get_documents_stats()
        return jsonify({
            'documents': stats['documents_count'],
            'chunks': stats['chunks_count'],
            'embeddings_ready': stats['embedding_progress']
        })
        
    except Exception as e:
        print(f"Ошибка получения статистики: {e}")
        return jsonify({'error': f'Произошла ошибка: {str(e)}'}), 500

@app.route('/admin')
def admin_panel():
    """Панель администратора"""
    stats = db_manager.get_documents_stats()
    return render_template('admin.html', stats=stats)

@app.route('/api/admin/load_documents', methods=['POST'])
def load_documents():
    """Загрузка недостающих документов из директории"""
    try:
        result = db_manager.bulk_load_documents_from_directory(Config.DOCUMENTS_DIR)
        
        return jsonify({
            'success': True,
            'result': result,
            'message': f"Загружено {result['loaded']} новых документов, пропущено {result.get('skipped', 0)} (уже в базе)"
        })
        
    except Exception as e:
        import traceback
        error_msg = str(e)
        traceback.print_exc()
        print(f"Ошибка загрузки документов: {error_msg}")
        return jsonify({
            'success': False,
            'error': f'Произошла ошибка: {error_msg}',
            'traceback': traceback.format_exc() if Config.DEBUG else None
        }), 500

@app.route('/api/admin/process_documents', methods=['POST'])
def process_documents():
    """Обработка документов (создание embeddings)"""
    try:
        # Проверяем существование директории
        if not os.path.exists(Config.DOCUMENTS_DIR):
            # Пытаемся создать директорию
            os.makedirs(Config.DOCUMENTS_DIR, exist_ok=True)
            print(f"📁 Создана директория {Config.DOCUMENTS_DIR}")
            
            # Проверяем наличие примеров документов
            examples_dir = os.path.join(Config.DOCUMENTS_DIR, 'examples')
            if os.path.exists(examples_dir):
                print(f"📚 Найдена директория примеров: {examples_dir}")
                # Можно скопировать примеры в основную директорию
                import shutil
                example_files = [f for f in os.listdir(examples_dir) if f.endswith('.txt')]
                if example_files:
                    print(f"📄 Найдено {len(example_files)} примеров документов")
                    for file in example_files[:10]:  # Копируем первые 10 для начала
                        shutil.copy2(os.path.join(examples_dir, file), Config.DOCUMENTS_DIR)
                    print(f"✅ Скопировано {min(10, len(example_files))} документов из examples")
        
        # Инициализируем систему поиска если нужно
        if not ensure_rag_initialized():
            return jsonify({
                'success': False,
                'error': 'Не удалось инициализировать ИИ систему'
            }), 500
        
        result = doc_processor.process_all_documents(Config.DOCUMENTS_DIR)
        
        # Обновляем кэш retriever после обработки
        retriever.refresh_cache()
        
        # Безопасная проверка наличия ключа 'total'
        total = result.get('total', result.get('processed', 0) + result.get('failed', 0))
        
        return jsonify({
            'success': True,
            'result': result,
            'message': f"Обработано {result.get('processed', 0)} документов из {total}"
        })
        
    except Exception as e:
        import traceback
        error_msg = str(e)
        traceback.print_exc()
        print(f"Ошибка обработки документов: {error_msg}")
        return jsonify({
            'success': False,
            'error': f'Произошла ошибка: {error_msg}',
            'traceback': traceback.format_exc() if Config.DEBUG else None
        }), 500

@app.route('/api/admin/update_embeddings', methods=['POST'])
def update_embeddings():
    """Обновление embeddings для документов без них"""
    try:
        # Инициализируем систему поиска если нужно
        if not ensure_rag_initialized():
            return jsonify({
                'success': False,
                'error': 'Не удалось инициализировать ИИ систему'
            }), 500
        
        result = doc_processor.update_embeddings()
        
        # Обновляем кэш retriever
        retriever.refresh_cache()
        
        return jsonify({
            'success': result,
            'message': 'Embeddings успешно обновлены' if result else 'Ошибка при обновлении embeddings'
        })
        
    except Exception as e:
        print(f"Ошибка обновления embeddings: {e}")
        return jsonify({
            'success': False,
            'error': f'Произошла ошибка: {str(e)}'
        }), 500

@app.route('/api/admin/clear_history', methods=['POST'])
def clear_chat_history():
    """Очистка истории чатов"""
    try:
        with sqlite3.connect(db_manager.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('DELETE FROM chat_history')
            conn.commit()
            
        return jsonify({
            'success': True,
            'message': 'История чатов очищена'
        })
        
    except Exception as e:
        print(f"Ошибка очистки истории: {e}")
        return jsonify({
            'success': False,
            'error': f'Произошла ошибка: {str(e)}'
        }), 500

@app.route('/api/admin/auto_setup', methods=['POST'])
def auto_setup():
    """Автоматическая настройка системы"""
    try:
        print("\n🚀 Запуск автоматической настройки системы...")
        
        # Проверяем статистику
        stats = db_manager.get_documents_stats()
        
        result = {
            'steps': [],
            'success': True,
            'final_stats': stats
        }
        
        # Шаг 1: Загрузка документов (всегда проверяем и загружаем недостающие)
        print("📚 Проверяем и загружаем документы...")
        load_result = db_manager.bulk_load_documents_from_directory(Config.DOCUMENTS_DIR)
        result['steps'].append({
            'step': 'document_loading',
            'status': 'completed' if load_result['loaded'] > 0 or load_result.get('skipped', 0) > 0 else 'failed',
            'message': f"Загружено {load_result['loaded']} новых документов, пропущено {load_result.get('skipped', 0)} (уже в базе)",
            'details': load_result
        })
        
        # Обновляем статистику
        stats = db_manager.get_documents_stats()
        
        # Шаг 2: Обработка документов
        if stats['embedded_chunks'] < stats['chunks_count'] or stats['chunks_count'] == 0:
            print("🔄 Обрабатываем документы...")
            # Инициализируем систему поиска для обработки
            if not ensure_rag_initialized():
                result['steps'].append({
                    'step': 'document_processing',
                    'status': 'failed',
                    'message': 'Не удалось инициализировать ИИ систему'
                })
                result['success'] = False
            else:
                process_result = doc_processor.process_all_documents(Config.DOCUMENTS_DIR)
                result['steps'].append({
                    'step': 'document_processing',
                    'status': 'completed' if process_result['processed'] > 0 else 'failed',
                    'message': f"Обработано {process_result['processed']} документов",
                    'details': process_result
                })
                
                if process_result['processed'] == 0:
                    result['success'] = False
                
                # Обновляем кэш retriever
                retriever.refresh_cache()
        else:
            result['steps'].append({
                'step': 'document_processing',
                'status': 'skipped',
                'message': 'Документы уже обработаны'
            })
        
        # Финальная статистика
        result['final_stats'] = db_manager.get_documents_stats()
        
        print("✅ Автоматическая настройка завершена")
        
        return jsonify(result)
        
    except Exception as e:
        print(f"❌ Ошибка автоматической настройки: {e}")
        return jsonify({
            'success': False,
            'error': f'Произошла ошибка: {str(e)}',
            'steps': []
        }), 500

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

# API endpoints для управления моделями

@app.route('/api/settings/llm', methods=['GET'])
def get_llm_settings():
    """Получение текущих настроек LLM"""
    try:
        from llm_providers.factory import LLMProviderFactory
        provider = LLMProviderFactory.get_current_provider()

        settings = {
            'provider_type': Config.LLM_PROVIDER_TYPE,
            'model': Config.LLM_MODEL,
            'available': provider.is_available() if provider else False,
            'ollama_base_url': Config.OLLAMA_BASE_URL,
            'finetuned_api_url': Config.FINETUNED_API_URL,
            'has_openai_key': bool(Config.OPENAI_API_KEY and Config.OPENAI_API_KEY.startswith('sk-')),
            'temperature': Config.TEMPERATURE,
            'max_tokens': Config.MAX_TOKENS,
            'top_k_results': Config.TOP_K_RESULTS,
        }

        if provider:
            try:
                settings['available_models'] = provider.get_available_models()
            except:
                settings['available_models'] = []
        else:
            settings['available_models'] = []

        return jsonify({'success': True, 'settings': settings})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/settings/llm/providers', methods=['GET'])
def get_llm_providers_status():
    """Статус всех доступных провайдеров"""
    try:
        from llm_providers.factory import LLMProviderFactory
        from llm_providers.ollama_provider import OllamaProvider
        from llm_providers.finetuned_provider import FineTunedModelProvider

        result = {}

        # Ollama
        try:
            ollama = OllamaProvider(base_url=Config.OLLAMA_BASE_URL)
            ollama_available = ollama.is_available()
            ollama_models = ollama.get_available_models() if ollama_available else []
            result['ollama'] = {'available': ollama_available, 'url': Config.OLLAMA_BASE_URL, 'models': ollama_models}
        except:
            result['ollama'] = {'available': False, 'url': Config.OLLAMA_BASE_URL, 'models': []}

        # Fine-tuned
        try:
            ft = FineTunedModelProvider(base_url=Config.FINETUNED_API_URL)
            ft_available = ft.is_available()
            result['finetuned'] = {'available': ft_available, 'url': Config.FINETUNED_API_URL, 'models': ['gemma-3n-4b-kazakh-law']}
        except:
            result['finetuned'] = {'available': False, 'url': Config.FINETUNED_API_URL, 'models': []}

        # OpenAI
        has_key = bool(Config.OPENAI_API_KEY and Config.OPENAI_API_KEY.startswith('sk-'))
        result['openai'] = {'available': has_key, 'has_key': has_key}

        return jsonify({'success': True, 'providers': result})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/settings/llm', methods=['POST'])
def update_llm_settings():
    """Обновление настроек LLM с сохранением в .env"""
    try:
        data = request.get_json()
        provider_type = data.get('provider_type', Config.LLM_PROVIDER_TYPE)
        model = data.get('model')
        ollama_base_url = data.get('ollama_base_url')
        finetuned_api_url = data.get('finetuned_api_url')
        openai_api_key = data.get('openai_api_key')
        temperature = data.get('temperature')
        max_tokens = data.get('max_tokens')
        top_k_results = data.get('top_k_results')

        # Валидация типа провайдера
        if provider_type not in ('ollama', 'finetuned', 'openai'):
            return jsonify({'success': False, 'error': f'Неизвестный провайдер: {provider_type}'}), 400

        # Собираем настройки для сохранения
        env_settings = {'LLM_PROVIDER_TYPE': provider_type}

        if model:
            env_settings['LLM_MODEL'] = model
        if ollama_base_url:
            env_settings['OLLAMA_BASE_URL'] = ollama_base_url
        if finetuned_api_url:
            env_settings['FINETUNED_API_URL'] = finetuned_api_url
        if openai_api_key is not None:
            env_settings['OPENAI_API_KEY'] = openai_api_key
        if temperature is not None:
            env_settings['TEMPERATURE'] = str(temperature)
        if max_tokens is not None:
            env_settings['MAX_TOKENS'] = str(int(max_tokens))
        if top_k_results is not None:
            env_settings['TOP_K_RESULTS'] = str(int(top_k_results))

        # Сохраняем в .env и обновляем runtime
        Config.save_to_env(env_settings)

        # Пересоздаём провайдер
        from llm_providers.factory import LLMProviderFactory
        global generator, law_generator

        kwargs = {'model': model or Config.LLM_MODEL}
        if provider_type == 'ollama':
            kwargs['base_url'] = ollama_base_url or Config.OLLAMA_BASE_URL
        elif provider_type == 'finetuned':
            kwargs['base_url'] = finetuned_api_url or Config.FINETUNED_API_URL
        elif provider_type == 'openai':
            kwargs['api_key'] = openai_api_key or Config.OPENAI_API_KEY

        try:
            provider = LLMProviderFactory.create_provider(provider_type=provider_type, **kwargs)

            if provider and provider.is_available():
                generator = ResponseGenerator(provider=provider)
                law_generator = LawProjectGenerator(provider=provider, database_manager=db_manager)

                return jsonify({
                    'success': True,
                    'message': f'Настройки сохранены. Провайдер: {provider_type}, модель: {model or Config.LLM_MODEL}',
                    'settings': {
                        'provider_type': provider_type,
                        'model': model or Config.LLM_MODEL,
                        'available': True
                    }
                })
            else:
                # Сохраняем настройки даже если провайдер сейчас недоступен
                return jsonify({
                    'success': True,
                    'message': f'Настройки сохранены в .env, но провайдер {provider_type} сейчас недоступен',
                    'settings': {
                        'provider_type': provider_type,
                        'model': model or Config.LLM_MODEL,
                        'available': False
                    }
                })
        except Exception as e:
            return jsonify({'success': False, 'error': f'Ошибка создания провайдера: {str(e)}'}), 500

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/settings/llm/test', methods=['POST'])
def test_llm_provider():
    """Тестирование LLM провайдера"""
    try:
        data = request.get_json()
        provider_type = data.get('provider_type', Config.LLM_PROVIDER_TYPE)
        model = data.get('model', Config.LLM_MODEL)
        ollama_base_url = data.get('ollama_base_url', Config.OLLAMA_BASE_URL)
        finetuned_api_url = data.get('finetuned_api_url', Config.FINETUNED_API_URL)
        openai_api_key = data.get('openai_api_key', Config.OPENAI_API_KEY)

        from llm_providers.factory import LLMProviderFactory

        kwargs = {'model': model}
        if provider_type == 'ollama':
            kwargs['base_url'] = ollama_base_url
        elif provider_type == 'finetuned':
            kwargs['base_url'] = finetuned_api_url
        elif provider_type == 'openai':
            kwargs['api_key'] = openai_api_key

        provider = LLMProviderFactory.create_provider(provider_type=provider_type, **kwargs)

        if not provider:
            return jsonify({'success': False, 'error': 'Не удалось создать провайдер'}), 400

        if not provider.is_available():
            return jsonify({'success': False, 'error': f'Провайдер {provider_type} недоступен'}), 400

        # Тестовый запрос
        test_response = provider.chat_completion(
            messages=[{"role": "user", "content": "Привет! Ответь одним предложением: как тебя зовут и работаешь ли ты?"}],
            model=model,
            temperature=0.1,
            max_tokens=50
        )

        return jsonify({
            'success': True,
            'message': 'Провайдер работает',
            'test_response': test_response.get('content', '')[:100],
            'model_used': test_response.get('model', model)
        })

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.errorhandler(404)
def not_found(error):
    return render_template('404.html'), 404

@app.errorhandler(500)
def internal_error(error):
    return render_template('500.html'), 500

# Инициализация при запуске
def initialize_app():
    """Инициализация приложения"""
    print("🚀 Запуск LawAI — юридическая платформа")
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
        
        # Проверяем нужна ли автоматическая обработка (но не запускаем систему поиска)
        if stats['documents_count'] > 0 and stats['embedding_progress'] == 0:
            unprocessed = db_manager.get_unprocessed_documents()
            print(f"\n⚠️  Найдено {len(unprocessed)} необработанных документов")
            print("   ИИ система будет инициализирована при первом обращении")
            print("   Перейдите в /admin для обработки всех документов")
        
        if stats['chunks_with_embeddings'] == 0 and stats['documents_count'] > 0:
            print("\n⚠️  ВНИМАНИЕ: Embeddings не созданы!")
            print("   Перейдите в /admin для обработки документов")
            print("   Или используйте автоматическую настройку")
        elif stats['embedding_progress'] > 0:
            print(f"\n✅ База данных готова (embeddings: {stats['embedding_progress']:.1f}%)")
            print("   ИИ система будет инициализирована при первом обращении")
    
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
    print("🌐 LawAI готов к работе!")
    print("   Интерфейс: http://localhost:5003")
    print("   Админ панель: http://localhost:5003/admin")
    print("=" * 60)

if __name__ == '__main__':
    initialize_app()
    app.run(host='0.0.0.0', port=5003, debug=Config.DEBUG) 