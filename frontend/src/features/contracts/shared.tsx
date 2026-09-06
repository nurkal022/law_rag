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
  soon: { ru: 'скоро', kz: 'жақында', en: 'soon' },
}

/** Проверка чужого текста ещё не сделана — так и пишем, а не прячем пункт. */
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
      <button type="button" className="tabs__item ct-subnav__soon" disabled title={t('soon')}>
        {t('review')} <span className="ct-soon">{t('soon')}</span>
      </button>
    </div>
  )
}
