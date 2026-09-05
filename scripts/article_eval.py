#!/usr/bin/env python3
"""
Прогон каверзных юридических вопросов через работающее приложение (полный RAG-путь)
для статьи: собираем ответы модели, чтобы оценить их корректность.
"""
import sys, os, json, time
import requests

# Вопросы выбраны там, где LLM в праве РК типично ошибается: точные цифры,
# ставки, сроки, пороги, недавние изменения, «ловушки» с неверной посылкой.
QUESTIONS = [
    "Какая ставка налога для самозанятых в Казахстане в 2025 году и как зарегистрироваться?",
    "Сколько дней ежегодного оплачиваемого трудового отпуска положено работнику в Казахстане?",
    "Какой размер минимальной заработной платы в Казахстане в 2025 году?",
    "В течение какого срока работодатель обязан выплатить расчёт при увольнении работника?",
    "Какой штраф за превышение скорости на 40 км/ч в Казахстане?",
    "С какого возраста наступает уголовная ответственность в Казахстане?",
    "Какой срок исковой давности по трудовым спорам в Казахстане?",
    "Можно ли расторгнуть брак в Казахстане, если есть несовершеннолетние дети, через ЗАГС?",
    "Какой размер госпошлины при подаче иска в суд на сумму 5 000 000 тенге?",
    "Сколько составляет налоговый вычет по индивидуальному подоходному налогу в 2025 году?",
    "В течение скольких дней нужно зарегистрировать новорождённого ребёнка в Казахстане?",
    "Какой максимальный срок испытания при приёме на работу по Трудовому кодексу РК?",
]

BASE = os.getenv("APP_URL", "http://localhost:5003")


def ask(q):
    r = requests.post(f"{BASE}/api/chat", json={"query": q, "use_rag": True}, timeout=120)
    d = r.json()
    return {
        "question": q,
        "answer": d.get("answer", ""),
        "sources_count": d.get("search_results_count"),
        "confidence": d.get("confidence"),
        "error": d.get("error"),
        "sources": [s.get("title") for s in (d.get("sources") or [])][:3],
    }


def main():
    out = []
    for i, q in enumerate(QUESTIONS, 1):
        print(f"[{i}/{len(QUESTIONS)}] {q[:60]}...", flush=True)
        try:
            out.append(ask(q))
        except Exception as e:
            out.append({"question": q, "answer": "", "error": str(e)})
        time.sleep(1)
    path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                        "exports", "article_eval_raw.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print("Сохранено:", path)


if __name__ == "__main__":
    main()
