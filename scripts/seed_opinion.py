"""
Seed script: создаёт опросы и 1000 демо-голосов
Запуск: python scripts/seed_opinion.py
"""
import sys, os, random, hashlib
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app
from database.models import db, Poll, PollVote

# ── Опросы ──────────────────────────────────────────────────────────────
POLLS = [
    {
        "question": "Как вы оцениваете доступность юридической помощи в Казахстане?",
        "category": "Общее",
        "options": ["Очень доступна", "Скорее доступна", "Скорее недоступна", "Совсем недоступна"],
        # Реалистичное распределение: большинство считает недоступной
        "weights": [8, 22, 42, 28],
    },
    {
        "question": "Нужна ли реформа Трудового кодекса Республики Казахстан?",
        "category": "Трудовое право",
        "options": ["Да, срочно нужна", "Да, постепенная реформа", "Нет, достаточно действующего", "Затрудняюсь ответить"],
        "weights": [38, 35, 12, 15],
    },
    {
        "question": "Как часто вы сталкивались с нарушением своих трудовых прав?",
        "category": "Трудовое право",
        "options": ["Никогда", "Один-два раза", "Несколько раз", "Регулярно"],
        "weights": [22, 30, 31, 17],
    },
    {
        "question": "Насколько вы осведомлены о своих правах как потребителя?",
        "category": "Гражданское право",
        "options": ["Отлично знаю свои права", "Знаю основное", "Знаю мало", "Совсем не знаю"],
        "weights": [14, 36, 34, 16],
    },
    {
        "question": "Поддерживаете ли вы введение обязательной юридической грамотности в школах РК?",
        "category": "Общее",
        "options": ["Полностью поддерживаю", "Скорее поддерживаю", "Скорее против", "Против"],
        "weights": [55, 30, 9, 6],
    },
    {
        "question": "Что больше всего мешает гражданам обращаться за юридической помощью?",
        "category": "Общее",
        "options": ["Высокая стоимость услуг", "Незнание своих прав", "Бюрократия и сложность системы", "Недоверие к юристам", "Языковой барьер"],
        "weights": [40, 25, 20, 10, 5],
    },
    {
        "question": "Как вы оцениваете работу судебной системы Казахстана?",
        "category": "Общее",
        "options": ["Отлично", "Удовлетворительно", "Плохо", "Очень плохо"],
        "weights": [7, 28, 40, 25],
    },
    {
        "question": "Использовали ли вы когда-нибудь AI-помощника для получения юридической консультации?",
        "category": "Общее",
        "options": ["Да, регулярно использую", "Да, один-два раза", "Нет, но планирую", "Нет и не планирую"],
        "weights": [18, 27, 32, 23],
    },
]

# Распределение голосов: всего 1000, распределяем по опросам
VOTES_PER_POLL = [160, 145, 130, 105, 115, 100, 110, 135]

def rand_date(days_back=30):
    delta = random.randint(0, days_back * 24 * 60)
    return datetime.utcnow() - timedelta(minutes=delta)

def make_ip_hash(i):
    fake_ip = f"192.168.{random.randint(0,255)}.{random.randint(1,254)}"
    return hashlib.sha256(f"{fake_ip}-{i}".encode()).hexdigest()[:32]

def seed():
    with app.app_context():
        # Удаляем старые опросы если есть
        PollVote.query.delete()
        Poll.query.delete()
        db.session.commit()
        print("Старые данные удалены.")

        import json as _j
        total_votes = 0

        for i, poll_data in enumerate(POLLS):
            poll = Poll(
                question=poll_data["question"],
                category=poll_data["category"],
                options=_j.dumps(poll_data["options"], ensure_ascii=False),
                is_active=True,
            )
            db.session.add(poll)
            db.session.flush()  # получаем poll.id

            n_votes = VOTES_PER_POLL[i]
            weights = poll_data["weights"]
            n_opts = len(poll_data["options"])

            # Генерируем голоса по весам
            option_counts = []
            total_w = sum(weights)
            for w in weights:
                option_counts.append(round(n_votes * w / total_w))
            # Корректируем до точного n_votes
            diff = n_votes - sum(option_counts)
            option_counts[0] += diff

            ip_counter = i * 10000
            for opt_idx, count in enumerate(option_counts):
                for _ in range(count):
                    vote = PollVote(
                        poll_id=poll.id,
                        option_index=opt_idx,
                        ip_hash=make_ip_hash(ip_counter),
                        created_at=rand_date(30),
                    )
                    db.session.add(vote)
                    ip_counter += 1
                    total_votes += 1

            db.session.commit()
            print(f"  [{i+1}/{len(POLLS)}] '{poll_data['question'][:55]}...' — {n_votes} голосов")

        print(f"\nГотово: {len(POLLS)} опросов, {total_votes} голосов.")

if __name__ == '__main__':
    seed()
