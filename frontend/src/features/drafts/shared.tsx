import { useEffect, useState } from 'react'
import { Button, Empty, Skeleton } from '../../shared/ui'
import { Link } from '../../shared/nav'
import { useT } from '../../i18n'
import type { Dict } from '../../i18n'
import { ApiError } from '../../shared/api'

/**
 * Состояния экранов, общие для договоров и законопроектов: «грузится»,
 * «сломалось», «нужен вход». Бэкенд может быть недоступен, сессия — истечь;
 * во всех этих случаях экран обязан объяснить, что произошло, а не показать
 * белый лист.
 */

const dict: Dict = {
  authTitle: { ru: 'Нужен вход', kz: 'Кіру қажет', en: 'Sign in required' },
  authBody: {
    ru: 'Документы хранятся в личном кабинете: в них персональные данные, поэтому доступ только после входа.',
    kz: 'Құжаттар жеке кабинетте сақталады: онда дербес деректер бар, сондықтан кіргеннен кейін ғана қолжетімді.',
    en: 'Documents live in your account: they contain personal data, so access requires signing in.',
  },
  signIn: { ru: 'Войти', kz: 'Кіру', en: 'Sign in' },
  offlineTitle: { ru: 'Сервер недоступен', kz: 'Сервер қолжетімсіз', en: 'Server unavailable' },
  offlineBody: {
    ru: 'Не удалось связаться с сервером. Проверьте подключение и повторите попытку.',
    kz: 'Серверге қосылу мүмкін болмады. Байланысты тексеріп, қайталап көріңіз.',
    en: 'Could not reach the server. Check your connection and try again.',
  },
  failTitle: { ru: 'Не загрузилось', kz: 'Жүктелмеді', en: 'Failed to load' },
  retry: { ru: 'Повторить', kz: 'Қайталау', en: 'Retry' },
}

/** Ошибка загрузки: вход, недоступный сервер и всё остальное — разные вещи. */
export function LoadFailure({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const t = useT(dict)
  const api = error instanceof ApiError ? error : null

  if (api?.unauthorized) {
    return (
      <Empty
        title={t('authTitle')}
        action={
          <Link to="/login" className="btn btn--primary">
            {t('signIn')}
          </Link>
        }
      >
        {t('authBody')}
      </Empty>
    )
  }

  const offline = api?.offline ?? true
  return (
    <Empty
      title={offline ? t('offlineTitle') : t('failTitle')}
      action={onRetry ? <Button onClick={onRetry}>{t('retry')}</Button> : undefined}
    >
      {offline ? t('offlineBody') : api?.message}
    </Empty>
  )
}

/** Заглушка списка на время загрузки: строки набора, а не спиннер. */
export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="ct-skeleton" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} height={i % 3 === 0 ? 18 : 12} width={`${100 - (i % 4) * 12}%`} />
      ))}
    </div>
  )
}

/**
 * Загрузка данных экрана. Отдельный хук, потому что во всех экранах
 * повторяется одно и то же: гонка ответов при быстрой смене адреса и
 * необходимость различать ошибку и пустоту.
 */
export function useLoader<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [loading, setLoading] = useState(true)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    load()
      .then((d) => {
        if (alive) setData(d)
      })
      .catch((e) => {
        if (alive) setError(e)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce])

  return { data, error, loading, reload: () => setNonce((n) => n + 1), setData }
}
