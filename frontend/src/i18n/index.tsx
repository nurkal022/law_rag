import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

export type Lang = 'ru' | 'kz' | 'en'

export const LANGS: { id: Lang; short: string; prefix: string }[] = [
  { id: 'kz', short: 'ҚАЗ', prefix: '/kk' },
  { id: 'ru', short: 'РУС', prefix: '' },
  { id: 'en', short: 'ENG', prefix: '/en' },
]

/**
 * Словарь фичи. Каждый модуль объявляет свой — так параллельная работа над
 * разными экранами не упирается в один общий файл, а ключи лежат рядом с
 * местом употребления.
 */
export type Dict = Record<string, Record<Lang, string>>

interface Ctx {
  lang: Lang
  setLang: (l: Lang) => void
}

const LangCtx = createContext<Ctx>({ lang: 'ru', setLang: () => {} })

/** Язык из префикса пути: /kk/... → kz, /en/... → en, иначе ru. */
export function langFromPath(path: string): Lang {
  if (path === '/kk' || path.startsWith('/kk/')) return 'kz'
  if (path === '/en' || path.startsWith('/en/')) return 'en'
  return 'ru'
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() =>
    typeof window === 'undefined' ? 'ru' : langFromPath(window.location.pathname),
  )

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    if (typeof document !== 'undefined') {
      document.documentElement.lang = l === 'kz' ? 'kk' : l
    }
  }, [])

  const value = useMemo(() => ({ lang, setLang }), [lang, setLang])
  return <LangCtx.Provider value={value}>{children}</LangCtx.Provider>
}

export function useLang() {
  return useContext(LangCtx)
}

/**
 * Переводчик поверх словаря фичи.
 *
 *   const dict = { save: { ru: 'Сохранить', kz: 'Сақтау', en: 'Save' } }
 *   const t = useT(dict)
 *   <Button>{t('save')}</Button>
 */
export function useT<D extends Dict>(dict: D) {
  const { lang } = useLang()
  return useCallback(
    (key: keyof D & string) => {
      const entry = dict[key]
      if (!entry) return key
      return entry[lang] ?? entry.ru ?? key
    },
    [dict, lang],
  )
}
