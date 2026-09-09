import type { Passport } from '../drafts/types'
import { normCode } from '../legal/cite'

/**
 * Ответ ручки брифа и его сборка в значения формы.
 *
 * Сервер уже раскладывает концепт по полям паспорта (`values`); клиент только
 * накладывает правки из карточки и выбранные уточнения. Так знание о том,
 * как поля концепта соответствуют паспорту, живёт в одном месте — на сервере.
 */

export interface BriefDomain {
  key: string
  label: string
}

export interface BriefAttachment {
  filename: string
  text: string
  length: number
}

export interface ConceptRef {
  act: string
  article: string
  note: string | null
  verified: boolean
}

export interface Concept {
  title_ru: string
  title_kz: string
  summary: string
  problem_description: string
  goals: string[]
  target_audience: string
  current_legislation_gaps: string
  constitutional_basis: string
  key_provisions: string[]
  refs: ConceptRef[]
  /** Поля паспорта, собранные сервером из концепта. */
  values: Record<string, string>
}

export interface ChipChoice {
  key: string
  label: string
  value: string
}

export interface Clarifications {
  initiator_type?: { kind: 'options'; options: { value: string; label: string }[] }
  initiator?: { kind: 'text'; suggestions: string[] }
  implementation_timeline?: { kind: 'chips'; chips: ChipChoice[] }
  budget_impact?: { kind: 'chips'; chips: ChipChoice[] }
}

export interface BriefResponse {
  concepts: Concept[]
  clarifications: Clarifications
}

export interface DomainsResponse {
  domains: BriefDomain[]
  example: { domain: string; text: string }
}

/** Стадии ожидания концептов — честные названия того, что делает сервер. */
export const THINK_STAGES = ['reading', 'searching', 'drafting'] as const
export type ThinkStage = (typeof THINK_STAGES)[number]

/** Значения формы: концепт сервера плюс правки и уточнения человека. */
export function conceptValues(concept: Concept, edits: Record<string, string>): Record<string, string> {
  const merged: Record<string, string> = { ...concept.values, ...edits }
  return Object.fromEntries(Object.entries(merged).filter(([, v]) => v && v.trim()))
}

/**
 * «Конституция РК 13» — код нормы концепта для чипа. Сервер отдаёт акт либо
 * сокращением от модели, либо полным названием документа корпуса — второе
 * сжимается до того же сокращения, что и в чате.
 */
export function refCode(ref: ConceptRef): string {
  return normCode(ref.act, ref.article || null)
}

/** Обязательные поля паспорта, которых в значениях ещё нет — подписями. */
export function missingRequired(passport: Passport, values: Record<string, string>): string[] {
  return passport.fields.filter((f) => f.required && !values[f.name]?.trim()).map((f) => f.label)
}
