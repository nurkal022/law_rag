from flask import Flask, render_template, request, jsonify, session
import uuid
import os
import sqlite3
from datetime import datetime
from config import Config
from database.models import DatabaseManager
from embeddings.processor import DocumentProcessor
from rag.retriever import DocumentRetriever
from rag.generator import ResponseGenerator

# Инициализация Flask приложения
app = Flask(__name__)
app.config.from_object(Config)

# Инициализация компонентов RAG системы
db_manager = DatabaseManager(Config.DATABASE_PATH)
doc_processor = DocumentProcessor(db_manager)
retriever = DocumentRetriever(db_manager)

# Проверяем наличие API ключа
if not Config.OPENAI_API_KEY:
    print("ВНИМАНИЕ: OpenAI API ключ не установлен!")
    print("Добавьте OPENAI_API_KEY в переменные окружения или файл .env")
    generator = None
else:
    generator = ResponseGenerator(Config.OPENAI_API_KEY)

@app.route('/')
def index():
    """Главная страница - дашборд с инструментами"""
    return render_template('index.html')

@app.route('/chat')
def chat_page():
    """Страница чата с RAG системой"""
    # Создаем новую сессию если её нет
    if 'session_id' not in session:
        session['session_id'] = str(uuid.uuid4())
    
    # Получаем статистику базы данных
    stats = db_manager.get_documents_stats()
    
    return render_template('chat.html', stats=stats)

@app.route('/api/chat', methods=['POST'])
def chat():
    """API для обработки чат-запросов"""
    try:
        data = request.get_json()
        user_query = data.get('query', '').strip()
        
        if not user_query:
            return jsonify({'error': 'Пустой запрос'}), 400
        
        if not generator:
            return jsonify({
                'error': 'OpenAI API ключ не настроен. Пожалуйста, добавьте OPENAI_API_KEY в переменные окружения.'
            }), 500
        
        # Получаем ID сессии
        session_id = session.get('session_id', str(uuid.uuid4()))
        session['session_id'] = session_id
        
        # Поиск релевантных документов
        search_results = retriever.hybrid_search(user_query, Config.TOP_K_RESULTS)
        formatted_results = retriever.format_search_results(search_results)
        
        # Получаем историю разговора
        conversation_history = db_manager.get_chat_history(session_id, limit=5)
        
        # Генерируем ответ
        response_data = generator.generate_response(
            user_query, 
            formatted_results, 
            conversation_history
        )
        
        # Сохраняем в историю
        db_manager.save_chat_history(
            session_id, 
            user_query, 
            response_data['answer'],
            response_data['sources']
        )
        
        return jsonify({
            'answer': response_data['answer'],
            'sources': response_data['sources'],
            'confidence': response_data['confidence'],
            'query_validation': generator.validate_legal_query(user_query) if generator else None,
            'search_results_count': len(formatted_results),
            'session_id': session_id
        })
        
    except Exception as e:
        print(f"Ошибка в чате: {e}")
        return jsonify({'error': f'Произошла ошибка: {str(e)}'}), 500

@app.route('/api/search', methods=['POST'])
def search_documents():
    """API для поиска документов без генерации ответа"""
    try:
        data = request.get_json()
        query = data.get('query', '').strip()
        
        if not query:
            return jsonify({'error': 'Пустой запрос'}), 400
        
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

@app.route('/api/admin/process_documents', methods=['POST'])
def process_documents():
    """Обработка документов (создание embeddings)"""
    try:
        result = doc_processor.process_all_documents(Config.DOCUMENTS_DIR)
        
        # Обновляем кэш retriever после обработки
        retriever.refresh_cache()
        
        return jsonify({
            'success': True,
            'result': result,
            'message': f"Обработано {result['processed']} документов из {result['total']}"
        })
        
    except Exception as e:
        print(f"Ошибка обработки документов: {e}")
        return jsonify({
            'success': False,
            'error': f'Произошла ошибка: {str(e)}'
        }), 500

@app.route('/api/admin/update_embeddings', methods=['POST'])
def update_embeddings():
    """Обновление embeddings для документов без них"""
    try:
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
        
        # Шаг 1: Загрузка документов
        if stats['documents_count'] == 0:
            print("📚 Загружаем документы...")
            load_result = db_manager.bulk_load_documents_from_directory(Config.DOCUMENTS_DIR)
            result['steps'].append({
                'step': 'document_loading',
                'status': 'completed' if load_result['loaded'] > 0 else 'failed',
                'message': f"Загружено {load_result['loaded']} документов",
                'details': load_result
            })
        else:
            result['steps'].append({
                'step': 'document_loading',
                'status': 'skipped',
                'message': f"Документы уже загружены ({stats['documents_count']} шт.)"
            })
        
        # Обновляем статистику
        stats = db_manager.get_documents_stats()
        
        # Шаг 2: Обработка документов
        if stats['embedded_chunks'] < stats['chunks_count'] or stats['chunks_count'] == 0:
            print("🔄 Обрабатываем документы...")
            process_result = doc_processor.process_all_documents(Config.DOCUMENTS_DIR)
            result['steps'].append({
                'step': 'document_processing',
                'status': 'completed' if process_result['processed'] > 0 else 'failed',
                'message': f"Обработано {process_result['processed']} документов",
                'details': process_result
            })
            
            if process_result['processed'] == 0:
                result['success'] = False
        else:
            result['steps'].append({
                'step': 'document_processing',
                'status': 'skipped',
                'message': 'Документы уже обработаны'
            })
        
        # Обновляем кэш retriever
        retriever.refresh_cache()
        
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

@app.errorhandler(404)
def not_found(error):
    return render_template('404.html'), 404

@app.errorhandler(500)
def internal_error(error):
    return render_template('500.html'), 500

# Инициализация при запуске
def initialize_app():
    """Инициализация приложения"""
    print("🚀 Запуск RAG системы для юридических документов Казахстана")
    print("=" * 60)
    
    # Проверяем наличие документов
    if os.path.exists(Config.DOCUMENTS_DIR):
        doc_count = len([f for f in os.listdir(Config.DOCUMENTS_DIR) if f.endswith('.txt')])
        print(f"📁 Найдено {doc_count} документов в {Config.DOCUMENTS_DIR}")
    else:
        print(f"⚠️  Директория с документами {Config.DOCUMENTS_DIR} не найдена")
    
    # Проверяем базу данных
    stats = db_manager.get_documents_stats()
    print(f"🗄️  База данных: {stats['documents_count']} документов, {stats['chunks_count']} чанков")
    print(f"🧠 Embeddings: {stats['embedded_chunks']} чанков ({stats['embedding_progress']:.1f}%)")
    
    # Автоматическая настройка при первом запуске
    if stats['documents_count'] > 0 and stats['embedding_progress'] == 0:
        print("\n🔧 Начинаем автоматическую обработку документов...")
        try:
            # Обрабатываем первые 50 документов для быстрого старта
            unprocessed = db_manager.get_unprocessed_documents()[:50]
            if unprocessed:
                print(f"📋 Быстрая обработка {len(unprocessed)} документов...")
                doc_processor._process_documents_batch(unprocessed)
                retriever.refresh_cache()
                
                # Обновляем статистику
                stats = db_manager.get_documents_stats()
                print(f"✅ Быстрая обработка завершена: {stats['embedding_progress']:.1f}% готовности")
        except Exception as e:
            print(f"⚠️  Ошибка автоматической обработки: {e}")
    
    if stats['embedded_chunks'] == 0 and stats['documents_count'] > 0:
        print("\n⚠️  ВНИМАНИЕ: Embeddings не созданы!")
        print("   Перейдите в /admin для обработки документов")
        print("   Или используйте автоматическую настройку")
    
    if not Config.OPENAI_API_KEY:
        print("\n⚠️  ВНИМАНИЕ: OpenAI API ключ не установлен!")
        print("   Добавьте OPENAI_API_KEY в переменные окружения")
    
    print("=" * 60)
    print("🌐 Приложение готово к работе!")
    print("   Интерфейс: http://localhost:5001")
    print("   Админ панель: http://localhost:5001/admin")
    print("=" * 60)

if __name__ == '__main__':
    initialize_app()
    app.run(host='0.0.0.0', port=5001, debug=Config.DEBUG) 