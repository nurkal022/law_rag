import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from '../../shared/nav'
import { Caption, Label, UIText } from '../../shared/ui'
import { LANGS, useLang, useT } from '../../i18n'
import type { Dict } from '../../i18n'
import './public.css'
import './public.chrome.css'
import './public.motion.css'

/**
 * Обвязка публичных страниц.
 *
 * Публичные страницы живут вне оболочки приложения — левого рельса здесь нет.
 * Вместо него лёгкая шапка (словесный знак, языки, вход) и подвал с разделами
 * и правовой информацией. Никаких карточек и иконок: линии и пространство.
 */

const dict: Dict = {
  skip: { ru: 'Перейти к содержанию', kz: 'Мазмұнға өту', en: 'Skip to content' },
  about: { ru: 'О проекте', kz: 'Жоба туралы', en: 'About' },
  login: { ru: 'Войти', kz: 'Кіру', en: 'Sign in' },
  start: { ru: 'Начать', kz: 'Бастау', en: 'Get started' },
  langAria: { ru: 'Язык интерфейса', kz: 'Интерфейс тілі', en: 'Interface language' },

  ftrTag: {
    ru: 'Правовая система Казахстана: ответ на вопрос — со ссылкой на действующую норму.',
    kz: 'Қазақстанның құқықтық жүйесі: сұраққа жауап — қолданыстағы нормаға сілтемемен.',
    en: 'A legal system for Kazakhstan: every answer carries a reference to the norm in force.',
  },

  colProduct: { ru: 'Продукт', kz: 'Өнім', en: 'Product' },
  navAssistant: { ru: 'Консультант', kz: 'Кеңесші', en: 'Assistant' },
  navContracts: { ru: 'Договоры', kz: 'Шарттар', en: 'Contracts' },
  navLaws: { ru: 'Законопроекты', kz: 'Заң жобалары', en: 'Draft laws' },
  navAnalytics: { ru: 'Аналитика', kz: 'Талдау', en: 'Analytics' },

  colCompany: { ru: 'Проект', kz: 'Жоба', en: 'Project' },
  navAbout: { ru: 'О проекте', kz: 'Жоба туралы', en: 'About' },
  navContacts: { ru: 'Контакты', kz: 'Байланыс', en: 'Contacts' },
  navRegister: { ru: 'Регистрация', kz: 'Тіркелу', en: 'Register' },

  colLegal: { ru: 'Правовое', kz: 'Құқықтық', en: 'Legal' },
  navTerms: { ru: 'Условия использования', kz: 'Пайдалану шарттары', en: 'Terms of use' },
  navPrivacy: { ru: 'Политика конфиденциальности', kz: 'Құпиялылық саясаты', en: 'Privacy policy' },
  navDisclaimer: { ru: 'Оговорка', kz: 'Ескертпе', en: 'Disclaimer' },

  disclaimer: {
    ru: 'Dalel готовит справку по действующим правовым актам Республики Казахстан и указывает источник каждого утверждения. Ответ системы не является юридической консультацией и не заменяет решение уполномоченного органа или суда. Перед применением сверяйтесь с официальной редакцией документа.',
    kz: 'Dalel Қазақстан Республикасының қолданыстағы құқықтық актілері бойынша анықтама дайындайды және әрбір тұжырымның дереккөзін көрсетеді. Жүйенің жауабы заң консультациясы болып саналмайды және уәкілетті органның не соттың шешімін алмастырмайды. Қолданар алдында құжаттың ресми редакциясымен салыстырыңыз.',
    en: 'Dalel prepares a summary from the legal acts of the Republic of Kazakhstan in force and names the source of every statement. Its answer is not legal advice and does not replace a decision of a competent authority or a court. Check the official wording of the document before relying on it.',
  },

  rights: {
    ru: '© 2026 Dalel. Республика Казахстан.',
    kz: '© 2026 Dalel. Қазақстан Республикасы.',
    en: '© 2026 Dalel. Republic of Kazakhstan.',
  },
  built: {
    ru: 'Данные обрабатываются на собственных серверах',
    kz: 'Деректер меншікті серверлерде өңделеді',
    en: 'Data is processed on our own servers',
  },
}

function Langs() {
  const { lang, setLang } = useLang()
  const t = useT(dict)
  return (
    <div className="pub-langs" role="group" aria-label={t('langAria')}>
      {LANGS.map((l, i) => (
        <span key={l.id} className="row">
          {i > 0 ? <span className="pub-langs__sep" aria-hidden="true">·</span> : null}
          <button
            type="button"
            className={['pub-langs__item', l.id === lang ? 'pub-langs__item--on' : '']
              .filter(Boolean)
              .join(' ')}
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

/**
 * Шапка публичных страниц.
 *
 * В самом верху страницы нижней линии нет: шапка стоит на той же бумаге,
 * что и заголовок. Как только под неё уходит содержимое, линия проявляется —
 * деталь, которая объясняет, что страница прокручена, без всякой тени.
 */
export function PublicHeader() {
  const t = useT(dict)
  const [atTop, setAtTop] = useState(true)

  useEffect(() => {
    const onScroll = () => setAtTop(window.scrollY < 4)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className={['pub-hdr', atTop ? 'pub-hdr--top' : ''].filter(Boolean).join(' ')}>
      <div className="pub-wrap pub-hdr__in">
        <Link to="/" className="pub-wordmark" aria-label="DALEL">
          <Logo />
          <span>DALEL</span>
        </Link>
        <nav className="pub-hdr__nav" aria-label={t('colProduct')}>
          <Link to="/chat" className="pub-link">{t('navAssistant')}</Link>
          <Link to="/contracts" className="pub-link">{t('navContracts')}</Link>
          <Link to="/laws" className="pub-link">{t('navLaws')}</Link>
          <Link to="/about" className="pub-link">{t('about')}</Link>
        </nav>
        <div className="pub-hdr__spacer" />
        <Langs />
        <div className="pub-hdr__actions">
          <Link to="/login" className="pub-link">
            {t('login')}
          </Link>
          <Link to="/register" className="pub-cta">
            {t('start')}
          </Link>
        </div>
      </div>
    </header>
  )
}

/**
 * Знак TURA: раскрытая книга, сведённая к двум страницам и закладке.
 * Рисуется текущим цветом, поэтому одинаково живёт на бумаге и на индиго.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      className={['pub-logo', className ?? ''].filter(Boolean).join(' ')}
      viewBox="0 0 28 28"
      width="28"
      height="28"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="1.5" y="1.5" width="25" height="25" rx="7" fill="currentColor" opacity="0.12" />
      <path
        d="M7.5 9.2c2.4-.9 4.6-.6 6.5.9 1.9-1.5 4.1-1.8 6.5-.9v10.3c-2.4-.9-4.6-.6-6.5.9-1.9-1.5-4.1-1.8-6.5-.9z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M14 10.1v10.3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

export function PublicFooter() {
  const t = useT(dict)
  return (
    <footer className="pub-ftr">
      <div className="pub-wrap">
        <div className="pub-ftr__cols">
          <div className="pub-ftr__brand">
            <span className="pub-wordmark">
              <Logo />
              <span>DALEL</span>
            </span>
            <p className="t-body pub-ftr__tag">{t('ftrTag')}</p>
            <div className="pub-ftr__langs">
              <Langs />
            </div>
          </div>

          <nav className="pub-ftr__col" aria-label={t('colProduct')}>
            <Label className="pub-ftr__title">{t('colProduct')}</Label>
            <Link to="/chat" className="pub-link">{t('navAssistant')}</Link>
            <Link to="/contracts" className="pub-link">{t('navContracts')}</Link>
            <Link to="/laws" className="pub-link">{t('navLaws')}</Link>
            <Link to="/analytics" className="pub-link">{t('navAnalytics')}</Link>
          </nav>

          <nav className="pub-ftr__col" aria-label={t('colCompany')}>
            <Label className="pub-ftr__title">{t('colCompany')}</Label>
            <Link to="/about" className="pub-link">{t('navAbout')}</Link>
            <Link to="/about#contacts" className="pub-link">{t('navContacts')}</Link>
            <Link to="/register" className="pub-link">{t('navRegister')}</Link>
            <Link to="/login" className="pub-link">{t('login')}</Link>
          </nav>

          <nav className="pub-ftr__col" aria-label={t('colLegal')}>
            <Label className="pub-ftr__title">{t('colLegal')}</Label>
            <Link to="/about#terms" className="pub-link">{t('navTerms')}</Link>
            <Link to="/about#privacy" className="pub-link">{t('navPrivacy')}</Link>
            <Link to="/about#disclaimer" className="pub-link">{t('navDisclaimer')}</Link>
          </nav>
        </div>

        <p className="t-caption pub-ftr__disclaimer" id="disclaimer">
          {t('disclaimer')}
        </p>

        <div className="pub-ftr__legal">
          <Caption tone="mute">{t('rights')}</Caption>
          <span className="pub-hdr__spacer" />
          <Caption tone="mute">{t('built')}</Caption>
        </div>
      </div>
    </footer>
  )
}

/**
 * Каркас публичной страницы: шапка, содержание, подвал.
 * Вариант «home» включает витринное оформление обвязки — прозрачную шапку
 * над первым экраном и цветной подвал; см. home.css.
 */
export function PublicPage({ children, variant }: { children: ReactNode; variant?: 'home' }) {
  const t = useT(dict)
  return (
    <div className={['pub', variant === 'home' ? 'pub--home' : ''].filter(Boolean).join(' ')}>
      <a href="#content" className="pub-skip">
        <UIText>{t('skip')}</UIText>
      </a>
      <PublicHeader />
      <main className="pub__main" id="content">
        {children}
      </main>
      <PublicFooter />
    </div>
  )
}
