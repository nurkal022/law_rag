import type { StatusKind } from '../../shared/ui'
import type { Lang } from '../../i18n'
import type { ApiLang, Counts } from './types'

/** Уровень риска → вид статуса дизайн-системы. 1 — «note» на --ochre-ink, остальные как везде. */
export function levelKind(level: number | null | undefined): StatusKind {
  if (level === 3) return 'err'
  if (level === 2) return 'warn'
  if (level === 1) return 'note'
  return 'idle'
}

/** Класс для цвета штриха или ячейки: lv--0 … lv--3, lv--x — не разобрано. */
export function levelClass(level: number | null | undefined): string {
  return `lv--${level === null || level === undefined ? 'x' : level}`
}

export const LEVELS_DESC = [3, 2, 1, 0] as const

/** Сколько норм с уровнем выше нуля. */
export function flagged(counts: Counts | undefined): number {
  if (!counts) return 0
  return (counts['1'] ?? 0) + (counts['2'] ?? 0) + (counts['3'] ?? 0)
}

/** Язык интерфейса → код языка в ответах API: казахский там kk, а не kz. */
export function apiLang(lang: Lang): ApiLang {
  return lang === 'kz' ? 'kk' : lang
}
