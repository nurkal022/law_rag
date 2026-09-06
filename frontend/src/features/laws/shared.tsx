import { NavLink } from '../../shared/nav'
import { useT } from '../../i18n'
import type { Dict } from '../../i18n'

/**
 * Подразделы законопроектов.
 *
 * Каталога здесь нет: тип документа один — пакет к внесению в Мажилис, — и
 * витрина из единственной карточки была бы лишним шагом между «хочу
 * законопроект» и формой.
 */

const dict: Dict = {
  mine: { ru: 'Мои законопроекты', kz: 'Менің заң жобаларым', en: 'My draft laws' },
  create: { ru: 'Новый законопроект', kz: 'Жаңа заң жобасы', en: 'New draft law' },
}

export function LawTabs() {
  const t = useT(dict)
  const cls = ({ isActive }: { isActive: boolean }) =>
    ['tabs__item', isActive ? 'tabs__item--on' : ''].filter(Boolean).join(' ')
  return (
    <div className="tabs ct-subnav" role="navigation">
      <NavLink to="/laws" end className={cls}>
        {t('mine')}
      </NavLink>
      <NavLink to="/laws/new" className={cls}>
        {t('create')}
      </NavLink>
    </div>
  )
}
