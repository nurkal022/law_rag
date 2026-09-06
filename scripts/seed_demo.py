#!/usr/bin/env python3
"""
Наполнение базы для просмотра интерфейса без обращения к модели.

Кладёт пользователя и готовый договор поставки: разделы, пункты со ссылками
на нормы, спецификацию таблицей, историю версий и диалог правки. Нужно, чтобы
смотреть на экраны в том виде, в каком их увидит юрист, а не на пустые
заглушки.

    DATABASE_URL=sqlite:////tmp/tura-demo.db python scripts/seed_demo.py
"""

import os
import secrets
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DOCENGINE_INLINE_WORKER', '0')

EMAIL = 'demo@tura.kz'
PASSWORD = 'demo12345'

VALUES = {
    'party0_name': 'ТОО «Альфа Трейд»', 'party0_id_no': '123456789012',
    'party0_address': 'г. Астана, ул. Достык, 12, офис 400',
    'party0_bank': 'АО «Халык Банк»', 'party0_iban': 'KZ123456789012345678',
    'party0_bik': 'HSBKKZKX', 'party0_signatory': 'Ахметов А. А.',
    'party0_signatory_role': 'директор', 'party0_basis': 'устава',
    'party1_name': 'ТОО «Бета Снаб»', 'party1_id_no': '210987654321',
    'party1_address': 'г. Алматы, пр. Абая, 45',
    'party1_bank': 'АО «Kaspi Bank»', 'party1_iban': 'KZ987654321098765432',
    'party1_bik': 'CASPKZKA', 'party1_signatory': 'Досаев Д. Д.',
    'party1_signatory_role': 'директор', 'party1_basis': 'устава',
    'city': 'Астана',
}

# Пункты написаны от руки в том виде, в каком их должна возвращать модель:
# без собственной нумерации, со ссылками на нормы.
SECTIONS = {
    'subject': [
        ('Поставщик обязуется передать в собственность Покупателя офисную мебель '
         '(далее — Товар) в наименовании, количестве и по ценам, указанным в '
         'Спецификации (Приложение № 1), являющейся неотъемлемой частью настоящего '
         'Договора, а Покупатель обязуется принять Товар и оплатить его.',
         [('ГК РК', '458'), ('ГК РК', '407')]),
        ('Наименование, количество, ассортимент и комплектность Товара определяются '
         'Спецификацией. Условие о наименовании и количестве Товара является '
         'существенным условием настоящего Договора.', [('ГК РК', '407', 'п. 2')]),
        ('Поставщик гарантирует, что Товар принадлежит ему на праве собственности, '
         'не заложен, не арестован, не является предметом требований третьих лиц.', []),
    ],
    'price': [
        ('Общая стоимость Товара составляет 4 500 000 (четыре миллиона пятьсот тысяч) '
         'тенге, включая НДС.', [('ГК РК', '438')]),
        ('Покупатель производит оплату в течение 10 (десяти) банковских дней с даты '
         'подписания сторонами накладной на отпуск запасов на сторону.', []),
        ('Обязательство Покупателя по оплате считается исполненным с момента '
         'зачисления денежных средств на банковский счёт Поставщика.', []),
    ],
    'delivery': [
        ('Поставка Товара осуществляется в течение 30 (тридцати) календарных дней с '
         'даты подписания настоящего Договора.', [('ГК РК', '459')]),
        ('Доставка производится силами и за счёт Поставщика по адресу: '
         'г. Алматы, пр. Абая, 45.', []),
        ('Право собственности на Товар и риск случайной гибели переходят к Покупателю '
         'с момента передачи Товара и подписания накладной.', [('ГК РК', '410')]),
    ],
    'liability': [
        ('За нарушение сроков поставки Поставщик уплачивает Покупателю пеню в размере '
         '0,1% от стоимости непоставленного Товара за каждый день просрочки, но не '
         'более 10% от общей стоимости Договора.', [('ГК РК', '293')]),
        ('За нарушение сроков оплаты Покупатель уплачивает Поставщику пеню в размере '
         '0,1% от неоплаченной суммы за каждый день просрочки.', [('ГК РК', '353')]),
        ('Уплата пени не освобождает стороны от исполнения обязательств в натуре.', []),
    ],
}

SPEC = {
    'id': 'specification',
    'title': 'Спецификация Товара',
    'columns': [
        {'key': 'no', 'title': '№'},
        {'key': 'name', 'title': 'Наименование'},
        {'key': 'qty', 'title': 'Количество', 'numeric': True},
        {'key': 'price', 'title': 'Цена за единицу, тг', 'numeric': True},
        {'key': 'sum', 'title': 'Сумма, тг', 'numeric': True},
    ],
    'rows': [
        ['1', 'Стол офисный 140×70', '30', '45 000', '1 350 000'],
        ['2', 'Кресло руководителя', '12', '85 000', '1 020 000'],
        ['3', 'Кресло офисное', '48', '32 000', '1 536 000'],
        ['4', 'Шкаф для документов', '10', '59 400', '594 000'],
    ],
    'total_row': ['', 'Итого', '100', '', '4 500 000'],
}


def main() -> int:
    from app import app
    from database.models import Draft, DraftTurn, DraftVersion, User, db
    from docengine.check import check
    from docengine.passport import get_passport
    from docengine.schema import Clause, Ref, Table, renumber
    from docengine.skeleton import build_skeleton

    with app.app_context():
        db.create_all()

        user = db.session.query(User).filter_by(email=EMAIL).first()
        if user is None:
            user = User(email=EMAIL, full_name='Демонстрационный юрист')
            user.set_password(PASSWORD)
            db.session.add(user)
            db.session.commit()

        passport = get_passport('supply')
        tree = build_skeleton(passport, VALUES, 'ru')

        for key, clauses in SECTIONS.items():
            section = tree.section_by_key(key)
            if section is None:
                continue
            section.clauses = [
                Clause(text=text, refs=[Ref(act=r[0], article=r[1],
                                            note=r[2] if len(r) > 2 else None)
                                        for r in refs])
                for text, refs in clauses
            ]
            section.pending = False

        tree.tables = [Table(**SPEC)]
        renumber(tree)
        tree.issues = check(tree, passport, VALUES)

        draft = Draft(
            public_id='demo0001supply01',
            kind='contract', type_id='supply', owner_id=user.id,
            title='Договор поставки офисной мебели', lang='ru', status='draft',
            values_json=VALUES, current_version=1,
        )
        old = db.session.query(Draft).filter_by(public_id=draft.public_id).first()
        if old:
            db.session.delete(old)
            db.session.commit()

        db.session.add(draft)
        db.session.flush()

        skeleton = build_skeleton(passport, VALUES, 'ru')
        db.session.add(DraftVersion(draft_id=draft.id, no=0,
                                    tree_json=skeleton.model_dump(mode='json'),
                                    summary='каркас документа', created_by='system'))
        db.session.add(DraftVersion(draft_id=draft.id, no=1,
                                    tree_json=tree.model_dump(mode='json'),
                                    summary='составлен документ', created_by='llm'))
        db.session.add(DraftTurn(draft_id=draft.id, role='user',
                                 text='Добавь пеню за просрочку поставки',
                                 version_from=0, version_to=0))
        db.session.add(DraftTurn(
            draft_id=draft.id, role='assistant',
            text='Добавил пункт о пене 0,1% за день просрочки с потолком 10% '
                 'от стоимости договора и симметричный пункт для просрочки оплаты.',
            ops_json=[{'op': 'insert_clause', 'key': 'liability'}],
            version_from=0, version_to=1))
        db.session.commit()

        print(f'Пользователь: {EMAIL} / {PASSWORD}')
        print(f'Договор:      /contracts/{draft.public_id}')
        print(f'Разделов:     {sum(1 for s in tree.sections if not s.pending)} '
              f'из {len(tree.sections)}')
        print(f'Замечаний:    {len(tree.issues)}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
