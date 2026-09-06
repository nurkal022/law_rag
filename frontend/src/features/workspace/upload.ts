import { ApiError } from '../../shared/api'

/**
 * Отправка файла с показом хода.
 *
 * Не через fetch: он не сообщает, сколько байт уже ушло, а на двадцати
 * мегабайтах по мобильной сети молчащая кнопка неотличима от зависшей.
 * XMLHttpRequest даёт upload.onprogress — ради него он здесь и остался.
 *
 * Ошибку приводим к тому же ApiError, что и остальной api: экраны разбирают
 * коды (413, 415, 401) одинаково, где бы запрос ни был сделан.
 */
export function upload<T>(
  path: string,
  form: FormData,
  onProgress?: (percent: number) => void,
): Promise<T> & { abort: () => void } {
  const xhr = new XMLHttpRequest()

  const promise = new Promise<T>((resolve, reject) => {
    xhr.open('POST', path.startsWith('/api') ? path : `/api${path}`)
    xhr.withCredentials = true
    xhr.setRequestHeader('Accept', 'application/json')
    xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest')

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100))
    }

    xhr.onload = () => {
      let payload: Record<string, unknown> = {}
      try {
        payload = JSON.parse(xhr.responseText) as Record<string, unknown>
      } catch {
        payload = {}
      }
      if (xhr.status >= 200 && xhr.status < 300 && payload.success !== false) {
        resolve(payload as T)
        return
      }
      const code = typeof payload.error === 'string' ? payload.error : `http_${xhr.status}`
      const message =
        typeof payload.message === 'string' && payload.message
          ? payload.message
          : `Файл не принят (${xhr.status})`
      reject(new ApiError(xhr.status, code, message))
    }
    xhr.onerror = () => reject(new ApiError(0, 'network', 'Сервер недоступен'))
    xhr.onabort = () => reject(new ApiError(0, 'aborted', 'Загрузка отменена'))

    xhr.send(form)
  })

  return Object.assign(promise, { abort: () => xhr.abort() })
}
