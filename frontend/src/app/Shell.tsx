import { Outlet, useLocation } from 'react-router-dom'
import { NavLink, Link } from '../shared/nav'
import { LANGS, useLang, useT } from '../i18n'
import type { Dict } from '../i18n'
import './shell.css'

/**
 * Оболочка приложения.
 *
 * Навигация верхняя, как на обычном сайте. Левого рельса нет намеренно:
 * с ним у консультанта получались две колонки подряд — разделы и список
 * диалогов, — и экран читался как внутренняя панель, а не как чат. Теперь
 * каждый раздел распоряжается всей шириной и строит свою раскладку сам.
 */

const dict: Dict = {
  assistant: { ru: 'Консультант', kz: 'Кеңесші', en: 'Assistant' },
  documents: { ru: 'Документы', kz: 'Құжаттар', en: 'Documents' },
  contracts: { ru: 'Договоры', kz: 'Шарттар', en: 'Contracts' },
  laws: { ru: 'Законопроекты', kz: 'Заң жобалары', en: 'Draft laws' },
  analytics: { ru: 'Аналитика', kz: 'Талдау', en: 'Analytics' },
  sections: { ru: 'Разделы', kz: 'Бөлімдер', en: 'Sections' },
}

const sections = [
  { to: '/chat', key: 'assistant' },
  { to: '/workspace', key: 'documents' },
  { to: '/contracts', key: 'contracts' },
  { to: '/laws', key: 'laws' },
  { to: '/analytics', key: 'analytics' },
] as const

function Langs() {
  const { lang, setLang } = useLang()
  return (
    <div className="langs">
      {LANGS.map((l, i) => (
        <span key={l.id} className="row">
          {i > 0 ? <span className="langs__sep">·</span> : null}
          <button
            type="button"
            className={['langs__item', l.id === lang ? 'langs__item--on' : ''].filter(Boolean).join(' ')}
            onClick={() => setLang(l.id)}
            aria-current={l.id === lang ? 'true' : undefined}
          >
            {l.short}
          </button>
        </span>
      ))}
    </div>
  )
}

export function Shell() {
  const t = useT(dict)
  const location = useLocation()

  return (
    <div className="shell">
      <header className="hdr">
        <Link to="/" className="wordmark">
          DALEL
        </Link>

        <nav className="nav" aria-label={t('sections')}>
          {sections.map((s) => (
            <NavLink
              key={s.to}
              to={s.to}
              className={({ isActive }) =>
                ['nav__link', isActive ? 'nav__link--on' : ''].filter(Boolean).join(' ')
              }
            >
              {t(s.key)}
            </NavLink>
          ))}
        </nav>

        <div className="spacer" />
        <Langs />
        <span className="hdr__user">н. курманов</span>
      </header>

      {/* key по пути: содержимое проявляется заново, шапка остаётся на месте */}
      <main className="main" key={location.pathname}>
        <Outlet />
      </main>
    </div>
  )
}
