import { useEffect, useState } from 'react'
import { api } from './api'

/**
 * Кто вошёл — для шапки и всего, что показывает имя.
 *
 * Один запрос на всё приложение: ответ кэшируется на уровне модуля, и шапка
 * не ходит за ним заново при каждом переходе между разделами. Ошибка сети
 * даёт «гость», а не сломанную шапку: имя — удобство, не условие работы.
 */

export interface MeUser {
  id: number
  email: string
  full_name: string | null
}

export interface Me {
  authenticated: boolean
  user: MeUser | null
  /** Сколько вопросов гостю можно задать без входа — правило сервера, не текста. */
  guest_limit?: number
}

const GUEST: Me = { authenticated: false, user: null }

let cache: Me | null = null
let inflight: Promise<Me> | null = null

function load(): Promise<Me> {
  if (cache) return Promise.resolve(cache)
  if (!inflight) {
    inflight = api
      .get<Me>('/api/auth/me')
      .then((me) => {
        cache = me
        return me
      })
      .catch(() => GUEST)
      .finally(() => {
        inflight = null
      })
  }
  return inflight
}

/** Забыть, кто вошёл: после входа, регистрации и выхода шапка спрашивает заново. */
export function resetMe(): void {
  cache = null
}

/** null — ответ ещё не пришёл; шапка в этот момент ничего не обещает. */
export function useMe(): Me | null {
  const [me, setMe] = useState<Me | null>(cache)
  useEffect(() => {
    let alive = true
    void load().then((m) => {
      if (alive) setMe(m)
    })
    return () => {
      alive = false
    }
  }, [])
  return me
}
