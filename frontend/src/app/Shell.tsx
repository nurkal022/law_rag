import { Outlet, useLocation } from 'react-router-dom'
import { NavLink, Link } from '../shared/nav'
import { LANGS, useLang, useT } from '../i18n'
import type { Dict } from '../i18n'
import './shell.css'

const dict: Dict = {
  groupWork: { ru: 'Работа', kz: 'Жұмыс', en: 'Work' },
  groupCreate: { ru: 'Создание', kz: 'Құрастыру', en: 'Create' },
  documents: { ru: 'Мои документы', kz: 'Құжаттарым', en: 'My documents' },
  matters: { ru: 'Дела', kz: 'Істер', en: 'Matters' },
  assistant: { ru: 'Консультант', kz: 'Кеңесші', en: 'Assistant' },
  contracts: { ru: 'Договоры', kz: 'Шарттар', en: 'Contracts' },
  laws: { ru: 'Законопроекты', kz: 'Заң жобалары', en: 'Draft laws' },
  analytics: { ru: 'Аналитика', kz: 'Талдау', en: 'Analytics' },
}

const work = [
  { to: '/workspace', key: 'documents' },
  { to: '/matters', key: 'matters' },
  { to: '/chat', key: 'assistant' },
] as const

const create = [
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
          TURA
        </Link>
        <div className="spacer" />
        <Langs />
        <span className="hdr__user">н. курманов</span>
      </header>

      <div className="body">
        <nav className="rail" aria-label="Разделы">
          <div className="rail__group">{t('groupWork')}</div>
          {work.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                ['rail__link', isActive ? 'rail__link--on' : ''].filter(Boolean).join(' ')
              }
            >
              {t(item.key)}
            </NavLink>
          ))}

          <div className="rail__group">{t('groupCreate')}</div>
          {create.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                ['rail__link', isActive ? 'rail__link--on' : ''].filter(Boolean).join(' ')
              }
            >
              {t(item.key)}
            </NavLink>
          ))}
        </nav>

        <main className="main">
          {/* key по пути: при переходе содержимое проявляется заново,
              а рельс и шапка не мигают. */}
          <div key={location.pathname} className="swap">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
