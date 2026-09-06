import type { Lang } from '../../i18n'

/**
 * Правовые координаты на трёх языках.
 *
 * Координата хранится в данных в русской канонической форме — «ГК РК 297» —
 * и переводится на язык интерфейса только при выводе. Иначе один и тот же
 * кодекс подписывается на лендинге «ГК РК», а в чате «ҚР АК», и читатель
 * решает, что это разные акты.
 *
 * Формы совпадают с теми, которыми пользуется features/chat/mock.ts.
 */
const ACTS: { ru: string; kz: string; en: string }[] = [
  { ru: 'Конституция РК', kz: 'ҚР Конституциясы', en: 'RK Constitution' },
  { ru: 'Договор о ЕАЭС', kz: 'ЕАЭО туралы шарт', en: 'EAEU Treaty' },
  { ru: 'ЗРК О ПА', kz: 'Құқықтық актілер туралы ҚР Заңы', en: 'RK Law on Legal Acts' },
  { ru: 'ЗРК О госзакупках', kz: 'Мемлекеттік сатып алу туралы ҚР Заңы', en: 'RK Public Procurement Law' },
  { ru: 'АППК РК', kz: 'ҚР ӘРПК', en: 'APPC RK' },
  { ru: 'КоАП РК', kz: 'ҚР ӘҚБтК', en: 'CAO RK' },
  { ru: 'ГПК РК', kz: 'ҚР АІЖК', en: 'CPC RK' },
  { ru: 'ГК РК', kz: 'ҚР АК', en: 'CC RK' },
  { ru: 'ТК РК', kz: 'ҚР ЕК', en: 'LC RK' },
  { ru: 'БК РК', kz: 'ҚР БК', en: 'BC RK' },
]

/**
 * «ГК РК 297» + kz → «ҚР АК 297». Номер статьи не трогаем: он одинаков
 * во всех редакциях. Незнакомый акт возвращается как есть.
 */
export function citeCode(code: string, lang: Lang): string {
  if (lang === 'ru') return code
  for (const act of ACTS) {
    if (code === act.ru) return act[lang]
    if (code.startsWith(act.ru + ' ')) return `${act[lang]} ${code.slice(act.ru.length + 1)}`
  }
  return code
}
