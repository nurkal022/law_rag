import { useState } from 'react'
import type { ReactNode } from 'react'
import { useT } from '../../i18n'
import type { Dict } from '../../i18n'
import { Sheet } from './Sheet'
import type { DocTree } from './types'

/**
 * Правая колонка конструктора: лист документа и панели под ним.
 *
 * Одна для договора и законопроекта — раскладка у них общая (ct-split), и
 * поведение на узком экране тоже: там лист уходит под форму, и до кнопки
 * «Далее» пришлось бы пролистать все пустые разделы. Поэтому на телефоне
 * колонка свёрнута в одну строку со счётчиком и раскрывается по нажатию;
 * на широком экране кнопки нет, лист всегда рядом с формой (см. drafts.css).
 */

const dict: Dict = {
  show: { ru: 'Показать лист', kz: 'Парақты көрсету', en: 'Show the sheet' },
  hide: { ru: 'Скрыть лист', kz: 'Парақты жасыру', en: 'Hide the sheet' },
  sections: { ru: 'Разделов', kz: 'Бөлімдер', en: 'Sections' },
}

export function BuilderAside({
  tree,
  head,
  children,
}: {
  tree: DocTree
  /** Плашка над листом: подсказка, что лист собирается по мере ввода. */
  head?: ReactNode
  /** Панели под листом: существенные условия, риски. */
  children?: ReactNode
}) {
  const t = useT(dict)
  const [open, setOpen] = useState(false)

  return (
    <aside className={['ct-split__aside', open ? 'ct-split__aside--open' : ''].filter(Boolean).join(' ')}>
      <button
        type="button"
        className="ct-split__fold"
        aria-expanded={open}
        aria-controls="builder-sheet"
        onClick={() => setOpen((o) => !o)}
      >
        <span>{open ? t('hide') : t('show')}</span>
        <span className="tabular">
          {t('sections')}: {tree.sections.length}
        </span>
      </button>

      <div className="ct-split__body" id="builder-sheet">
        <div className="ct-paper">
          <Sheet tree={tree} head={head} />
        </div>
        {children}
      </div>
    </aside>
  )
}
