import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Body, H2 } from '../../shared/ui'
import { useLang, useT, withLang } from '../../i18n'
import { citeCode } from '../legal/cite'
import { dict } from './dict'
import { levelClass } from './levels'
import type { Viz } from './types'

/**
 * Дуги «Конституция ↔ акты». Сверху 96 статей по разделам, снизу акты; каждая
 * дуга — связь находки со статьёй, цвет — уровень. Наведение на статью или акт
 * оставляет только их дуги.
 */

const W = 1000
const H = 420
const TOP = 96
const BOTTOM = 336
const MARGIN = 28
const SECTION_GAP = 9

interface Link {
  article: number
  act: number
  level: number
  count: number
}

export function Arcs({ viz }: { viz: Viz }) {
  const t = useT(dict)
  const { lang } = useLang()
  const navigate = useNavigate()
  const [focus, setFocus] = useState<{ article?: number; act?: number } | null>(null)

  const model = useMemo(() => {
    const articles = viz.articles
    const sections: string[] = []
    for (const a of articles) if (!sections.includes(a.section)) sections.push(a.section)
    const gaps = Math.max(0, sections.length - 1)
    const step = (W - 2 * MARGIN - gaps * SECTION_GAP) / Math.max(1, articles.length - 1)
    const ax = new Map<number, number>()
    let x = MARGIN
    let prev = ''
    articles.forEach((a, i) => {
      if (i > 0 && a.section !== prev) x += SECTION_GAP
      ax.set(a.no, x)
      x += step
      prev = a.section
    })
    const acts = viz.acts
    const dx = new Map<number, number>()
    acts.forEach((a, i) => dx.set(a.document_id, MARGIN + ((W - 2 * MARGIN) * (i + 0.5)) / acts.length))
    const agg = new Map<string, Link>()
    for (const f of viz.findings) {
      for (const no of f.a) {
        if (!ax.has(no) || !dx.has(f.d)) continue
        const key = `${no}-${f.d}`
        const l = agg.get(key)
        if (l) {
          l.count += 1
          l.level = Math.max(l.level, f.l)
        } else agg.set(key, { article: no, act: f.d, level: f.l, count: 1 })
      }
    }
    const links = [...agg.values()].sort((p, q) => p.level - q.level || p.count - q.count)
    const perArticle = new Map<number, number>()
    const worst = new Map<number, number>()
    for (const l of links) {
      perArticle.set(l.article, (perArticle.get(l.article) ?? 0) + l.count)
      worst.set(l.article, Math.max(worst.get(l.article) ?? 0, l.level))
    }
    // Подписи разделов — по центру их статей
    const sectionSpans = sections.map((s) => {
      const xs = articles.filter((a) => a.section === s).map((a) => ax.get(a.no) ?? 0)
      return { s, x0: Math.min(...xs), x1: Math.max(...xs), title: articles.find((a) => a.section === s)?.title ?? '' }
    })
    return { ax, dx, links, perArticle, worst, sectionSpans }
  }, [viz])

  const filtered = focus !== null
  const on = (l: Link) => (focus?.article !== undefined && l.article === focus.article) || (focus?.act !== undefined && l.act === focus.act)

  return (
    <section className="cn-block">
      <div className="cn-block__head">
        <H2>{t('arcsHead')}</H2>
        <Body tone="mute" className="cn-block__lead">{t('arcsLead')}</Body>
      </div>
      <svg className={['arcs', filtered ? 'arcs--filtered' : ''].filter(Boolean).join(' ')} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('arcsHead')}>
        {model.sectionSpans.map((s) => (
          <g key={s.s} className="arcs__section">
            <line x1={s.x0} x2={s.x1} y1={TOP - 44} y2={TOP - 44} className="arcs__bracket" />
            <text x={(s.x0 + s.x1) / 2} y={TOP - 50} textAnchor="middle" className="arcs__roman">{s.s}</text>
          </g>
        ))}
        {model.links.map((l, i) => {
          const x1 = model.ax.get(l.article) ?? 0
          const x2 = model.dx.get(l.act) ?? 0
          const mid = (TOP + BOTTOM) / 2
          return (
            <path
              key={`${l.article}-${l.act}`}
              className={['arc', levelClass(l.level), on(l) ? 'arc--on' : ''].filter(Boolean).join(' ')}
              d={`M ${x1} ${TOP} C ${x1} ${mid} ${x2} ${mid} ${x2} ${BOTTOM}`}
              pathLength={1}
              style={{ '--i': Math.min(i, 120), strokeWidth: 0.7 + Math.log2(l.count + 1) * 0.55 } as React.CSSProperties}
            />
          )
        })}
        {viz.articles.map((a, i) => {
          const x = model.ax.get(a.no) ?? 0
          const n = model.perArticle.get(a.no) ?? 0
          const isOn = focus?.article === a.no
          const labelY = TOP - (i % 2 ? 30 : 18)   // соседние номера — в два ряда, иначе наезжают
          return (
            <g
              key={a.no}
              className={['arcs__art', n ? 'arcs__art--linked' : '', isOn ? 'arcs__art--on' : ''].filter(Boolean).join(' ')}
              onMouseEnter={() => setFocus({ article: a.no })}
              onMouseLeave={() => setFocus(null)}
              onClick={() => navigate(withLang(`/constitution/articles/${a.no}`, lang))}
            >
              <rect x={x - 4} y={TOP - 14} width={8} height={14} className={`arcs__tick ${levelClass(model.worst.get(a.no) ?? 0)}`} rx={0} />
              {n >= 4 || isOn ? <text x={x} y={labelY} textAnchor="middle" className="arcs__no">{a.no}</text> : null}
              <title>{`${t('mapArticle')} ${a.no} · ${a.title} · ${n}`}</title>
            </g>
          )
        })}
        {viz.acts.map((a) => {
          const x = model.dx.get(a.document_id) ?? 0
          const isOn = focus?.act === a.document_id
          return (
            <g
              key={a.document_id}
              className={['arcs__act', isOn ? 'arcs__act--on' : ''].filter(Boolean).join(' ')}
              onMouseEnter={() => setFocus({ act: a.document_id })}
              onMouseLeave={() => setFocus(null)}
              onClick={() => navigate(withLang(`/constitution/acts/${a.document_id}`, lang))}
            >
              <rect x={x - 14} y={BOTTOM} width={28} height={6} className="arcs__base" />
              <text transform={`translate(${x} ${BOTTOM + 16}) rotate(28)`} className="arcs__code">{citeCode(a.code, lang)}</text>
              <title>{a.title}</title>
            </g>
          )
        })}
      </svg>
    </section>
  )
}
