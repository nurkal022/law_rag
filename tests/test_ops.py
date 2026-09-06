"""Правка дерева операциями: применение, отказы, перенумерация, дифф."""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from docengine.ops import Op, apply_ops, diff
from docengine.schema import Clause, DocTree, Meta, Party, Requisites, Section, renumber


def tree() -> DocTree:
    t = DocTree(
        meta=Meta(kind='contract', type_id='supply', title='Договор поставки'),
        requisites=Requisites(city='Астана', parties=[Party(role='Поставщик'), Party(role='Покупатель')]),
        sections=[
            Section(key='subject', title='Предмет договора', clauses=[Clause(text='Поставка товара.')]),
            Section(key='price', title='Цена и порядок расчётов',
                    clauses=[Clause(text='Цена 100 000 тенге.'), Clause(text='Оплата в течение 10 дней.')]),
            Section(key='liability', title='Ответственность сторон', clauses=[Clause(text='По закону.')]),
        ],
    )
    return renumber(t)


def test_replace_clause():
    r = apply_ops(tree(), [Op(op='replace_clause', no='2.2', text='Оплата в течение 5 дней.')])
    assert r.applied == 1
    assert r.tree.clause_by_no('2.2').text == 'Оплата в течение 5 дней.'


def test_original_tree_untouched():
    """Версия неприкосновенна: правки идут в копию."""
    t = tree()
    apply_ops(t, [Op(op='replace_clause', no='1.1', text='другое')])
    assert t.clause_by_no('1.1').text == 'Поставка товара.'


def test_insert_renumbers_following_clauses():
    r = apply_ops(tree(), [Op(op='insert_clause', after='2.1', text='Предоплата 30%.')])
    assert r.tree.clause_by_no('2.2').text == 'Предоплата 30%.'
    assert r.tree.clause_by_no('2.3').text == 'Оплата в течение 10 дней.'


def test_delete_renumbers():
    r = apply_ops(tree(), [Op(op='delete_clause', no='2.1')])
    assert r.tree.clause_by_no('2.1').text == 'Оплата в течение 10 дней.'
    assert r.tree.clause_by_no('2.2') is None


def test_insert_section_after_renumbers_sections():
    r = apply_ops(tree(), [Op(op='insert_section', after='1', title='Права и обязанности',
                              clauses=[Clause(text='Стороны обязуются.')])])
    assert [s.title for s in r.tree.sections][:3] == [
        'Предмет договора', 'Права и обязанности', 'Цена и порядок расчётов']
    assert r.tree.section_by_no('3').key == 'price'
    assert r.tree.clause_by_no('3.1').text == 'Цена 100 000 тенге.'


def test_missing_target_is_rejected_not_silent():
    """Ненайденная цель — видимый отказ, а не тихо пропущенная правка."""
    r = apply_ops(tree(), [Op(op='replace_clause', no='9.9', text='...')])
    assert r.applied == 0
    assert len(r.rejected) == 1
    assert '9.9' in r.rejected[0].detail


def test_locked_clause_survives_section_rewrite():
    t = tree()
    t.sections[1].clauses[0].locked = True
    r = apply_ops(t, [Op(op='replace_section', key='price', clauses=[Clause(text='Новая цена.')])])
    texts = [c.text for c in r.tree.section_by_key('price').clauses]
    assert 'Новая цена.' in texts and 'Цена 100 000 тенге.' in texts


def test_locked_clause_not_overwritten_directly():
    t = tree()
    t.sections[0].clauses[0].locked = True
    r = apply_ops(t, [Op(op='replace_clause', no='1.1', text='подмена')])
    assert r.applied == 0
    assert r.tree.clause_by_no('1.1').text == 'Поставка товара.'


def test_set_party_requisite():
    r = apply_ops(tree(), [Op(op='set_requisite', path='parties.1.bank', value='АО Халык Банк')])
    assert r.tree.requisites.parties[1].bank == 'АО Халык Банк'


def test_bad_requisite_path_rejected():
    r = apply_ops(tree(), [Op(op='set_requisite', path='parties.7.bank', value='х')])
    assert r.applied == 0


def test_unknown_op_rejected_without_crash():
    r = apply_ops(tree(), [Op.model_construct(op='drop_database')])
    assert r.applied == 0 and 'неизвестная' in r.rejected[0].detail


def test_batch_applies_in_order():
    r = apply_ops(tree(), [
        Op(op='insert_clause', key='liability', text='Пеня 0,1% за день просрочки.'),
        Op(op='replace_clause', no='3.1', text='Ответственность по ГК РК.'),
    ])
    assert r.applied == 2
    assert r.tree.clause_by_no('3.1').text == 'Ответственность по ГК РК.'
    assert r.tree.clause_by_no('3.2').text.startswith('Пеня')


def test_diff_reports_by_clause():
    old = tree()
    new = apply_ops(old, [
        Op(op='replace_clause', no='1.1', text='Поставка оборудования.'),
        Op(op='insert_clause', key='liability', text='Пеня.'),
    ]).tree
    ch = {c.no: c.kind for c in diff(old, new)}
    assert ch['1.1'] == 'changed'
    assert ch['3.2'] == 'added'


def test_summary_is_human_readable():
    r = apply_ops(tree(), [
        Op(op='replace_clause', no='1.1', text='a'),
        Op(op='replace_clause', no='2.1', text='b'),
    ])
    assert r.summary() == 'изменён пункт: 2'
