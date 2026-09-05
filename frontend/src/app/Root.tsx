import { useCallback, useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { LangProvider, langFromPath, stripLang, withLang } from '../i18n'
import type { Lang } from '../i18n'
import { ToastHost } from '../shared/ui'

/**
 * Корневой слой, общий для всех маршрутов.
 *
 * Живёт внутри маршрутизатора, поэтому язык берётся из адреса, а не хранится
 * отдельным состоянием: иначе он теряется при перезагрузке, ссылку на казахскую
 * версию не отправить, а поисковик не увидит трёх версий страницы.
 */
export function Root() {
  const location = useLocation()
  const navigate = useNavigate()
  const lang = langFromPath(location.pathname)

  const setLang = useCallback(
    (next: Lang) => {
      navigate(withLang(stripLang(location.pathname), next) + location.search, { replace: true })
    },
    [navigate, location.pathname, location.search],
  )

  // Атрибут lang нужен и поисковику, и экранному диктору, и переносам слов.
  useEffect(() => {
    document.documentElement.lang = lang === 'kz' ? 'kk' : lang
  }, [lang])

  return (
    <LangProvider lang={lang} setLang={setLang}>
      <ToastHost>
        <Outlet />
      </ToastHost>
    </LangProvider>
  )
}
