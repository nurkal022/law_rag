/**
 * Единственная точка обращения к серверу.
 *
 * Модули не зовут fetch напрямую по трём причинам. Во-первых, сессия хранится
 * в cookie, а fetch по умолчанию их не шлёт — забытый credentials даёт 401 на
 * ровном месте. Во-вторых, ответы бэкенда однообразны ({success, error,
 * message}), и разбирать их в каждом экране заново — это разошедшаяся
 * обработка ошибок. В-третьих, 401 здесь становится отдельным опознаваемым
 * состоянием, а не «что-то сломалось»: экран показывает «нужен вход», а не
 * белый лист.
 */

export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }

  /** Гость: сессии нет или она истекла. Экран показывает приглашение войти. */
  get unauthorized() {
    return this.status === 401
  }

  /** Сервер недоступен целиком: бэкенд не поднят, сеть отвалилась. */
  get offline() {
    return this.status === 0
  }
}

const BASE = '/api'

/** Путь к API: относительные пути дописываются к /api, абсолютные — как есть. */
function url(path: string) {
  if (path.startsWith('http') || path.startsWith('/api')) return path
  return BASE + (path.startsWith('/') ? path : '/' + path)
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(url(path), {
      method,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        // Flask отдаёт 401 JSON вместо редиректа на /login, когда видит XHR
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'network', 'Сервер недоступен')
  }

  const text = await res.text()
  let data: unknown = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = null
    }
  }

  const payload = (data ?? {}) as Record<string, unknown>

  if (!res.ok || payload.success === false) {
    const code = typeof payload.error === 'string' ? payload.error : `http_${res.status}`
    const message =
      typeof payload.message === 'string' && payload.message
        ? payload.message
        : `Запрос не выполнен (${res.status})`
    throw new ApiError(res.status, code, message)
  }

  return payload as T
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body ?? {}),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body ?? {}),
  del: <T>(path: string) => request<T>('DELETE', path),
}

/**
 * Подписка на поток событий сервера. Возвращает функцию отписки — вызывать её
 * обязательно: незакрытый EventSource продолжает переподключаться после ухода
 * со страницы и держит на сервере поток, который никто не читает.
 *
 * onError получает признак «поток закрыт окончательно»: браузер сам
 * переподключается, и различать разрыв связи от завершения задачи должен
 * вызывающий код.
 */
export function sse<T>(
  path: string,
  onMessage: (data: T) => void,
  onError?: (e: Event) => void,
): () => void {
  const es = new EventSource(url(path), { withCredentials: true })

  es.onmessage = (e) => {
    if (!e.data) return
    try {
      onMessage(JSON.parse(e.data) as T)
    } catch {
      // Полупринятое событие: следующее придёт целиком, ронять поток незачем
    }
  }
  es.onerror = (e) => {
    onError?.(e)
  }

  return () => es.close()
}

/**
 * Скачивание файла.
 *
 * Обычная ссылка не годится: экспорт закрыт сессией, а <a download> с чужого
 * источника уходит без cookie и приносит страницу входа вместо документа.
 * Поэтому файл забирается запросом и отдаётся браузеру как blob.
 */
export async function download(path: string, filename?: string): Promise<void> {
  let res: Response
  try {
    res = await fetch(url(path), {
      credentials: 'include',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    })
  } catch {
    throw new ApiError(0, 'network', 'Сервер недоступен')
  }

  if (!res.ok) {
    // Ошибка приходит JSON-ом даже там, где успех — это файл
    let message = `Не удалось скачать файл (${res.status})`
    let code = `http_${res.status}`
    try {
      const data = (await res.json()) as Record<string, unknown>
      if (typeof data.message === 'string') message = data.message
      if (typeof data.error === 'string') code = data.error
    } catch {
      // тело не JSON — остаётся общее сообщение
    }
    throw new ApiError(res.status, code, message)
  }

  const blob = await res.blob()
  const name = filename || filenameFromHeader(res.headers.get('Content-Disposition')) || 'document'
  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Освобождаем не сразу: Safari успевает начать загрузку только после клика
  window.setTimeout(() => URL.revokeObjectURL(href), 10_000)
}

function filenameFromHeader(header: string | null): string | null {
  if (!header) return null
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header)
  if (star) return decodeURIComponent(star[1])
  const plain = /filename="?([^";]+)"?/i.exec(header)
  return plain ? plain[1] : null
}

/** Человеческое сообщение из любой ошибки: в catch прилетает unknown. */
export function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof ApiError) return e.message
  if (e instanceof Error && e.message) return e.message
  return fallback
}
