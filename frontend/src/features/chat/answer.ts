import { actCode } from '../legal/cite'

/**
 * Ответ консультанта, каким его отдаёт /api/chat, и его разбор для ленты.
 *
 * Модель ссылается на фрагменты корпуса метками «[Источник 2]»; человеку
 * нужна не метка, а координата нормы — «ГК РК 178». Здесь метки заменяются
 * чипами с координатой источника под этим номером, а сами источники
 * получают короткий код акта по названию документа.
 */

export interface ApiSource {
  id: number
  title: string
  article?: string
  preview: string
  filename?: string
}

export interface ChatReply {
  answer: string
  sources: ApiSource[]
}

export interface HistoryItem {
  id: number
  user_query: string
  ai_response: string
  sources: ApiSource[]
  created_at: string | null
}

/** Кусок ответа: строка текста либо правовая координата. */
export type Seg = string | { cite: string }

export interface Source {
  code: string
  doc: string
  excerpt: string
}

export interface Answer {
  segs: Seg[]
  sources: Source[]
}

/** «ГК РК 178» — код акта и номер статьи, если сервер его нашёл. */
export function sourceCode(s: ApiSource): string {
  const act = actCode(s.title)
  return s.article ? `${act} ${s.article}` : act
}

const MARK = /\[\s*Источник[иа]?\s*([\d\s,и]+?)\s*(?:[:;,][^\]]*)?\]/gi

export function parseAnswer(text: string, sources: ApiSource[]): Answer {
  const byId = new Map(sources.map((s) => [s.id, s]))
  const segs: Seg[] = []
  let last = 0
  // Жирный markdown в нормативном тексте — шум: убираем маркеры, слова оставляем.
  const clean = (text || '').replace(/\*\*/g, '')
  for (const m of clean.matchAll(MARK)) {
    const before = clean.slice(last, m.index)
    if (before) segs.push(before)
    const ids = (m[1].match(/\d+/g) ?? []).map(Number)
    const seen = new Set<string>()
    for (const id of ids) {
      const src = byId.get(id)
      if (!src) continue
      const code = sourceCode(src)
      if (seen.has(code)) continue
      seen.add(code)
      segs.push({ cite: code })
    }
    last = (m.index ?? 0) + m[0].length
  }
  const tail = clean.slice(last)
  if (tail) segs.push(tail)

  // В списке источников каждый документ+статья — один раз
  const out: Source[] = []
  const codes = new Set<string>()
  for (const s of sources) {
    const code = sourceCode(s)
    if (codes.has(code)) continue
    codes.add(code)
    out.push({ code, doc: s.title, excerpt: (s.preview || '').replace(/\s+/g, ' ').trim() })
  }
  return { segs, sources: out }
}

export type DateGroup = 'today' | 'week' | 'earlier'

/** Группа в боковой колонке по дате записи; серверное время — UTC без пояса. */
export function dateGroup(iso: string | null): DateGroup {
  if (!iso) return 'earlier'
  const at = new Date(/[zZ]|[+-]\d\d:\d\d$/.test(iso) ? iso : iso + 'Z')
  const now = new Date()
  const sameDay = at.toDateString() === now.toDateString()
  if (sameDay) return 'today'
  return now.getTime() - at.getTime() < 7 * 24 * 3600 * 1000 ? 'week' : 'earlier'
}
