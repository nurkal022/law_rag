import { createContext, useCallback, useContext, useMemo } from 'react'
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

/** Путь без языкового префикса: /kk/chat → /chat, /en → /. */
export function stripLang(path: string): string {
  if (path === '/kk' || path === '/en') return '/'
  if (path.startsWith('/kk/') || path.startsWith('/en/')) return path.slice(3)
  return path
}

/** Путь с префиксом нужного языка: (/chat, kz) → /kk/chat. Русский без префикса. */
export function withLang(path: string, lang: Lang): string {
  const clean = stripLang(path)
  if (lang === 'ru') return clean
  const prefix = lang === 'kz' ? '/kk' : '/en'
  return clean === '/' ? prefix : prefix + clean
}

/**
 * Язык — производная от адреса, а не отдельное состояние: иначе он теряется
 * при перезагрузке, а на казахскую версию невозможно дать ссылку.
 * Значения поставляет Root, который живёт внутри маршрутизатора.
 */
export function LangProvider({
  lang,
  setLang,
  children,
}: Ctx & { children: ReactNode }) {
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
