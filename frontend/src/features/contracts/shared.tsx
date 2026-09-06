import { NavLink } from '../../shared/nav'
import { useT } from '../../i18n'
import type { Dict } from '../../i18n'

/**
 * Подразделы договоров. Всё остальное, что раньше жило здесь, — состояния
 * загрузки и хук загрузчика — общее с законопроектами и переехало в
 * features/drafts.
 */

const dict: Dict = {
  catalog: { ru: 'Каталог', kz: 'Каталог', en: 'Catalogue' },
  mine: { ru: 'Мои договоры', kz: 'Менің шарттарым', en: 'My contracts' },
  review: { ru: 'Проверить договор', kz: 'Шартты тексеру', en: 'Review a contract' },
}

export function ContractTabs() {
  const t = useT(dict)
  return (
    <div className="tabs ct-subnav" role="navigation">
      <NavLink
        to="/contracts"
        end
        className={({ isActive }) =>
          ['tabs__item', isActive ? 'tabs__item--on' : ''].filter(Boolean).join(' ')
        }
      >
        {t('catalog')}
      </NavLink>
      <NavLink
        to="/contracts/mine"
        className={({ isActive }) =>
          ['tabs__item', isActive ? 'tabs__item--on' : ''].filter(Boolean).join(' ')
        }
      >
        {t('mine')}
      </NavLink>
      <NavLink
        to="/contracts/review"
        className={({ isActive }) =>
          ['tabs__item', isActive ? 'tabs__item--on' : ''].filter(Boolean).join(' ')
        }
      >
        {t('review')}
      </NavLink>
    </div>
  )
}
