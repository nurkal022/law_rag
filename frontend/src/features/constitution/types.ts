/** Ответы /api/constitution/*. Поля в точности как отдаёт blueprints/constitution/routes.py. */
export type ApiLang = 'ru' | 'kk' | 'en'
export type Tri = Record<ApiLang, string>

export interface Counts {
  '0': number
  '1': number
  '2': number
  '3': number
  errors: number
}

export interface Run {
  id: string
  status: 'running' | 'done' | 'failed'
  triage_model: string
  verify_model: string
  norms_total: number
  norms_done: number
  counts: Counts
  tokens_used: number
  started_at: string | null
  finished_at: string | null
}

export interface WalkAct {
  document_id: number
  code: string
  title: string
  tier: number
  position: number
  norms_total: number
  norms_done: number
  counts: Counts
  tokens: number
  started_at: string | null
  finished_at: string | null
}

export interface TierAct {
  document_id: number
  code: string
  title: string
  norms: number
  done: number
  counts: Counts
  worst: number
}

export interface Tier {
  tier: number
  title: Tri
  acts: TierAct[]
}

export interface ArticleCell {
  no: number
  norms: number
  worst: number
}

export interface Section {
  no: string
  title: string
  articles: ArticleCell[]
}

export interface Change {
  id: string
  kind: 'institution' | 'new' | 'removed' | 'procedure' | 'reference'
  title: string
  summary: string
  old_articles: number[]
  new_articles: number[]
  old_quote?: string
  new_quote?: string
  norms: number
}

export interface Overview {
  run: Run | null
  walk: WalkAct[]
  tiers: Tier[]
  constitution: { document_id: number; sections: Section[] } | null
  changes: Change[]
  current: { document_id: number; code: string; article_no: string } | null
}

export interface ActMeta {
  document_id: number
  title: string
  code: string
  tier: number | null
  adilet: string
  edition: string
  url: string
  norms: number
  counts: Counts
  started_at: string | null
  finished_at: string | null
}

export interface ArticleStrip {
  chunk_id: number
  article_no: string
  title: string
  level: number | null
  category: string
  finding_id: number | null
}

export interface Finding {
  id: number
  document_id: number
  chunk_id: number
  article_no: string
  article_title: string
  level: number | null
  category: string
  method: string
  constitution_articles: number[]
  change_ids: string[]
  quote_norm: string
  explanation: string
  recommendation: string
  model: string
  tokens: number
  error: string
  wording: Tri | null
  category_label: Tri
}

export interface ActResponse {
  run: Run
  act: ActMeta
  articles: ArticleStrip[]
  wording: Record<'0' | '1' | '2' | '3', Tri>
  findings: Finding[]
}

export interface ConstArticle {
  no: number
  section: { no: string; title: string }
  text: string
}

export interface FindingDetail extends Finding {
  norm_text: string
  act: ActMeta | null
  articles: ConstArticle[]
  changes: Change[]
}

export interface ArticleResponse {
  article: ConstArticle & {
    was: Change[]
    norms: (Finding & { act: ActMeta | null })[]
  }
}
