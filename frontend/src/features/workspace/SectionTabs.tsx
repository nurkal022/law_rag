import { NavLink } from '../../shared/nav'
import { useT } from '../../i18n'
import type { Dict } from '../../i18n'

/**
 * Подразделы внутри «Документов». После отказа от левого рельса дела
 * потеряли точку входа — здесь они возвращаются на уровень ниже разделов,
 * тем же приёмом, что и вкладки: линия печати под активным.
 */
const dict: Dict = {
  documents: { ru: 'Документы', kz: 'Құжаттар', en: 'Documents' },
  matters: { ru: 'Дела', kz: 'Істер', en: 'Matters' },
}

export function SectionTabs() {
  const t = useT(dict)
  const items = [
    { to: '/workspace', label: t('documents') },
    { to: '/matters', label: t('matters') },
  ]
  return (
    <div className="tabs ws-subnav" role="navigation">
      {items.map((it) => (
        <NavLink
          key={it.to}
          to={it.to}
          end
          className={({ isActive }) =>
            ['tabs__item', isActive ? 'tabs__item--on' : ''].filter(Boolean).join(' ')
          }
        >
          {it.label}
        </NavLink>
      ))}
    </div>
  )
}
