/**
 * Контракт с документным движком (docengine/schema.py, blueprints/drafts).
 *
 * Здесь важно одно расхождение, на котором легко ошибиться: в дереве документа
 * ссылка на норму — объект Ref с признаком verified, а в паспорте типа те же
 * ссылки приходят уже свёрнутыми в строку («ГК РК ст. 546»). Поэтому два разных
 * типа, а не один.
 */

/* ----------------------------- дерево документа ----------------------------- */

export interface Ref {
  act: string
  article: string
  note?: string | null
  /** Норма найдена в корпусе. Невыверенную не выдаём за проверенную. */
  verified: boolean
}

export interface Clause {
  no: string
  text: string
  refs: Ref[]
  subclauses: Clause[]
  /** Пункт правлен человеком: перегенерация раздела его не затирает. */
  locked: boolean
}

export interface Section {
  no: string
  key?: string | null
  title: string
  clauses: Clause[]
  /** Место в оглавлении занято, содержимого ещё нет. */
  pending: boolean
}

export interface Column {
  key: string
  title: string
  width?: number | null
  numeric?: boolean
}

export interface DocTable {
  id: string
  title: string
  columns: Column[]
  rows: string[][]
  total_row?: string[] | null
  note?: string | null
}

export type PartyKind = 'legal' | 'individual' | 'ip'

export interface Party {
  role: string
  name: string
  kind: PartyKind
  id_no: string
  address: string
  phone: string
  email: string
  bank: string
  iban: string
  bik: string
  signatory: string
  signatory_role: string
  basis: string
}

export interface Requisites {
  number: string
  city: string
  /** ISO-дата YYYY-MM-DD. */
  date: string
  parties: Party[]
}

export interface Annex {
  no: string
  title: string
  kind: 'sections' | 'table'
  sections: Section[]
  table?: DocTable | null
}

export interface Meta {
  kind: 'contract' | 'law_project'
  type_id: string
  lang: string
  title: string
  subtitle?: string | null
  form?: string | null
  legal_basis: Ref[]
}

export type IssueLevel = 'error' | 'warning' | 'info'

export interface Issue {
  level: IssueLevel
  code: string
  message: string
  section_key?: string | null
  clause_no?: string | null
}

export interface DocTree {
  meta: Meta
  requisites: Requisites
  preamble: string
  sections: Section[]
  tables: DocTable[]
  annexes: Annex[]
  issues: Issue[]
}

/* --------------------------------- каталог --------------------------------- */

/** Семейства из паспортов; неизвестное семейство экран не роняет. */
export type Family =
  | 'sale'
  | 'lease'
  | 'works'
  | 'services'
  | 'finance'
  | 'labour'
  | 'ip'
  | 'corporate'
  | 'family'
  | string

export interface CatalogType {
  id: string
  name: string
  family: Family
  summary: string
  form: string
  /** Уже свёрнутые подписи норм: «ГК РК ст. 546, п. 2». */
  legal_basis: string[]
  caveat: string | null
  sections_count: number
  /** Проверен практикующим юристом. false показываем прямо. */
  reviewed: boolean
}

export interface CatalogResponse {
  types: CatalogType[]
  families: Record<string, CatalogType[]>
}

/* --------------------------------- паспорт --------------------------------- */

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'money'
  | 'date'
  | 'select'
  | 'iin'
  | 'bin'
  | 'iin_bin'

export interface FieldOption {
  value: string
  label: string
}

export interface PassportField {
  name: string
  label: string
  type: FieldType
  /** parties | subject | terms | extra */
  group: string
  required: boolean
  hint: string | null
  unit: string | null
  /** Индекс стороны, к которой относится поле; null — общее поле договора. */
  party: number | null
  placeholder: string | null
  options: FieldOption[]
}

export interface PartySpec {
  role: string
  kinds: PartyKind[]
}

export interface SectionSpec {
  key: string
  title: string
  required: boolean
  refs: string[]
}

export interface EssentialTerm {
  key: string
  label: string
  /** Поля формы, любое из которых закрывает условие. */
  fields: string[]
  section: string | null
  basis: string | null
}

export interface RiskItem {
  /** Индекс стороны: 0 или 1. */
  party: number
  text: string
  mitigation: string | null
}

export interface AnnexSpec {
  key: string
  title: string
  kind: 'sections' | 'table'
  default: boolean
}

export interface Passport {
  id: string
  name: string
  family: Family
  summary: string
  form: string
  legal_basis: string[]
  caveat: string | null
  sections_count: number
  reviewed: boolean
  parties: PartySpec[]
  fields: PassportField[]
  sections: SectionSpec[]
  essential_terms: EssentialTerm[]
  risks: RiskItem[]
  annexes: AnnexSpec[]
}

/* -------------------------------- черновики -------------------------------- */

export type DraftStatus = 'draft' | 'review' | 'agreed' | 'signed' | 'archived'

export interface Draft {
  id: string
  kind: 'contract' | 'law_project'
  type_id: string
  title: string
  lang: string
  status: DraftStatus
  matter_id: number | null
  version: number
  versions_count: number
  created_at: string | null
  updated_at: string | null
  /** Приходят только при with_tree: одиночный документ, но не список. */
  values?: Record<string, unknown>
  tree?: DocTree | null
}

export interface Job {
  id: string
  kind: string
  status: 'queued' | 'running' | 'done' | 'failed' | 'cancelled'
  progress: { done: number; total: number; label: string }
  error: string | null
  result: unknown
  created_at: string | null
  finished_at: string | null
}

export interface Rejected {
  op: string
  detail: string
}

export interface Change {
  kind: 'added' | 'removed' | 'changed'
  no: string
  title: string
  before: string
  after: string
}

export interface Turn {
  id: number
  role: 'user' | 'assistant'
  text: string
  ops: unknown[]
  rejected: Rejected[]
  version_from: number | null
  version_to: number | null
  created_at: string | null
}

export interface VersionInfo {
  no: number
  summary: string
  created_by: 'llm' | 'user' | 'system' | string
  created_at: string | null
}

export interface VersionFull extends VersionInfo {
  tree: DocTree
  changes?: Change[]
}

/* ------------------------------ ответы маршрутов ------------------------------ */

export interface DraftResponse {
  draft: Draft
}
export interface DraftsResponse {
  drafts: Draft[]
}
export interface PassportResponse {
  passport: Passport
}
export interface JobResponse {
  job: Job
  already?: boolean
}
export interface TurnsResponse {
  turns: Turn[]
}
export interface TurnResponse {
  applied: number
  reply: string
  summary?: string
  rejected: Rejected[]
  changes?: Change[]
  draft: Draft
}
export interface VersionsResponse {
  versions: VersionInfo[]
  current: number
}
export interface VersionResponse {
  version: VersionFull
}
