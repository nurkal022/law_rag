import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Body, H2 } from '../../shared/ui'
import { useLang, useT, withLang } from '../../i18n'
import { citeCode } from '../legal/cite'
import { dict } from './dict'
import type { Change, Viz } from './types'

/**
 * Поток изменений: изменения Конституции → акты → статьи 2026 года.
 * Толщина ленты — число норм с замечаниями; по лентам бегут частицы (SVG
 * animateMotion, без JavaScript). Раскладка своя: три колонки, узлы по величине.
 */

const W = 1000
const H = 600
const NODE_W = 12
const PADS = [26, 14, 12]   // зазоры между узлами по колонкам: слева подписи антиквой выше
const TOP_ARTICLES = 12
const OTHER = 'a:other'
const COLS = [30, 500, 940]

interface Node {
  id: string
  col: number
  label: string
  value: number
  y0: number
  y1: number
  kind?: Change['kind']
  href?: string
}

interface Flow {
  from: string
  to: string
  value: number
  kind?: Change['kind']
  sy0: number
  sy1: number
  ty0: number
  ty1: number
}

export function Sankey({ viz, changes }: { viz: Viz; changes: Change[] }) {
  const t = useT(dict)
  const { lang } = useLang()
  const navigate = useNavigate()
  const [focus, setFocus] = useState<string | null>(null)

  const model = useMemo(() => {
    const f01 = new Map<string, number>()
    const f12 = new Map<string, number>()
    // Статьи справа — только самые нагруженные, остальные одной лентой «прочие»
    const perArticle = new Map<number, number>()
    for (const f of viz.findings) if (f.c.length) for (const a of new Set(f.a)) perArticle.set(a, (perArticle.get(a) ?? 0) + 1)
    const top = new Set([...perArticle.entries()].sort((p, q) => q[1] - p[1]).slice(0, TOP_ARTICLES).map(([a]) => a))
    const artKey = (a: number) => (top.has(a) ? `a:${a}` : OTHER)
    for (const f of viz.findings) {
      if (!f.c.length) continue
      for (const c of new Set(f.c)) f01.set(`${c}|${f.d}`, (f01.get(`${c}|${f.d}`) ?? 0) + 1)
      for (const k of new Set([...new Set(f.a)].map(artKey))) f12.set(`${f.d}|${k}`, (f12.get(`${f.d}|${k}`) ?? 0) + 1)
    }
    const val = new Map<string, { in: number; out: number }>()
    const bump = (id: string, k: 'in' | 'out', v: number) => {
      const cur = val.get(id) ?? { in: 0, out: 0 }
      cur[k] += v
      val.set(id, cur)
    }
    for (const [k, v] of f01) {
      const [c, d] = k.split('|')
      bump(`c:${c}`, 'out', v)
      bump(`d:${d}`, 'in', v)
    }
    for (const [k, v] of f12) {
      const [d, a] = k.split('|')
      bump(`d:${d}`, 'out', v)
      bump(a, 'in', v)
    }
    const byId = new Map<string, Change>(changes.map((c) => [c.id, c]))
    const cols: Node[][] = [[], [], []]
    for (const c of changes) {
      const v = val.get(`c:${c.id}`)
      if (v && v.out) cols[0].push({ id: `c:${c.id}`, col: 0, label: c.short || c.title, value: v.out, y0: 0, y1: 0, kind: c.kind })
    }
    for (const a of viz.acts) {
      const v = val.get(`d:${a.document_id}`)
      if (v && (v.in || v.out)) cols[1].push({ id: `d:${a.document_id}`, col: 1, label: citeCode(a.code, lang), value: Math.max(v.in, v.out), y0: 0, y1: 0, href: `/constitution/acts/${a.document_id}` })
    }
    for (const a of viz.articles) {
      const v = val.get(`a:${a.no}`)
      if (v && v.in) cols[2].push({ id: `a:${a.no}`, col: 2, label: `${t('mapArticle')} ${a.no}`, value: v.in, y0: 0, y1: 0, href: `/constitution/articles/${a.no}` })
    }
    const other = val.get(OTHER)
    cols[0].sort((p, q) => q.value - p.value)
    cols[2].sort((p, q) => q.value - p.value)
    if (other && other.in) cols[2].push({ id: OTHER, col: 2, label: t('sankeyOther'), value: other.in, y0: 0, y1: 0 })
    const scale = Math.min(...cols.map((c, i) => (H - PADS[i] * Math.max(0, c.length - 1)) / Math.max(1, c.reduce((s, n) => s + n.value, 0))))
    cols.forEach((c, i) => {
      const used = c.reduce((s, n) => s + n.value * scale, 0) + PADS[i] * Math.max(0, c.length - 1)
      let y = (H - used) / 2
      for (const n of c) {
        n.y0 = y
        n.y1 = y + n.value * scale
        y = n.y1 + PADS[i]
      }
    })
    const nodes = new Map<string, Node>()
    for (const c of cols) for (const n of c) nodes.set(n.id, n)
    // Ленты: смещения по узлам накапливаются в порядке колонок
    const outOff = new Map<string, number>()
    const inOff = new Map<string, number>()
    const flows: Flow[] = []
    const place = (from: string, to: string, v: number, kind?: Change['kind']) => {
      const s = nodes.get(from)
      const d = nodes.get(to)
      if (!s || !d) return
      const so = outOff.get(from) ?? 0
      const io = inOff.get(to) ?? 0
      flows.push({ from, to, value: v, kind, sy0: s.y0 + so, sy1: s.y0 + so + v * scale, ty0: d.y0 + io, ty1: d.y0 + io + v * scale })
      outOff.set(from, so + v * scale)
      inOff.set(to, io + v * scale)
    }
    for (const src of cols[0]) {
      const cid = src.id.slice(2)
      const targets = [...f01].filter(([k]) => k.startsWith(`${cid}|`)).sort((p, q) => (nodes.get(`d:${p[0].split('|')[1]}`)?.y0 ?? 0) - (nodes.get(`d:${q[0].split('|')[1]}`)?.y0 ?? 0))
      for (const [k, v] of targets) place(src.id, `d:${k.split('|')[1]}`, v, byId.get(cid)?.kind)
    }
    for (const mid of cols[1]) {
      const did = mid.id.slice(2)
      const targets = [...f12].filter(([k]) => k.startsWith(`${did}|`)).sort((p, q) => (nodes.get(p[0].split('|')[1])?.y0 ?? 0) - (nodes.get(q[0].split('|')[1])?.y0 ?? 0))
      for (const [k, v] of targets) place(mid.id, k.split('|')[1], v, undefined)
    }
    return { cols, flows, nodes }
  }, [viz, changes, lang, t])

  const ribbon = (f: Flow) => {
    const s = model.nodes.get(f.from)!
    const d = model.nodes.get(f.to)!
    const x0 = COLS[s.col] + NODE_W
    const x1 = COLS[d.col]
    const mx = (x0 + x1) / 2
    return `M ${x0} ${f.sy0} C ${mx} ${f.sy0} ${mx} ${f.ty0} ${x1} ${f.ty0} L ${x1} ${f.ty1} C ${mx} ${f.ty1} ${mx} ${f.sy1} ${x0} ${f.sy1} Z`
  }
  const centre = (f: Flow) => {
    const s = model.nodes.get(f.from)!
    const d = model.nodes.get(f.to)!
    const x0 = COLS[s.col] + NODE_W
    const x1 = COLS[d.col]
    const mx = (x0 + x1) / 2
    const cy0 = (f.sy0 + f.sy1) / 2
    const cy1 = (f.ty0 + f.ty1) / 2
    return `M ${x0} ${cy0} C ${mx} ${cy0} ${mx} ${cy1} ${x1} ${cy1}`
  }

  const active = (f: Flow) => focus !== null && (f.from === focus || f.to === focus)
  let particles = 0

  return (
    <section className="cn-block">
      <div className="cn-block__head">
        <H2>{t('sankeyHead')}</H2>
        <Body tone="mute" className="cn-block__lead">{t('sankeyLead')}</Body>
      </div>
      <svg className={['sankey', focus ? 'sankey--filtered' : ''].filter(Boolean).join(' ')} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('sankeyHead')}>
        {model.flows.map((f, i) => (
          <path key={`${f.from}>${f.to}`} d={ribbon(f)} className={['sankey__flow', f.kind ? `sankey__flow--${f.kind}` : 'sankey__flow--act', active(f) ? 'sankey__flow--on' : ''].filter(Boolean).join(' ')} style={{ '--i': Math.min(i, 40) } as React.CSSProperties}>
            <title>{`${model.nodes.get(f.from)?.label} → ${model.nodes.get(f.to)?.label}: ${f.value}`}</title>
          </path>
        ))}
        {model.flows.map((f) => {
          if (f.value < 2 || particles >= 70) return null
          const n = Math.min(3, Math.ceil(f.value / 4))
          particles += n
          const d = centre(f)
          const dur = 4 + (f.value % 3)
          return Array.from({ length: n }, (_, k) => (
            <circle key={`${f.from}>${f.to}#${k}`} r={2.2} className="sankey__particle">
              <animateMotion dur={`${dur}s`} repeatCount="indefinite" begin={`${-(k * dur) / n}s`} path={d} />
            </circle>
          ))
        })}
        {[...model.nodes.values()].map((n) => (
          <g
            key={n.id}
            className={['sankey__node', focus === n.id ? 'sankey__node--on' : '', n.href ? 'sankey__node--link' : ''].filter(Boolean).join(' ')}
            onMouseEnter={() => setFocus(n.id)}
            onMouseLeave={() => setFocus(null)}
            onClick={() => n.href && navigate(withLang(n.href, lang))}
          >
            <rect x={COLS[n.col]} y={n.y0} width={NODE_W} height={Math.max(2, n.y1 - n.y0)} className={n.kind ? `sankey__bar sankey__bar--${n.kind}` : 'sankey__bar'} />
            <text
              x={n.col === 0 ? COLS[n.col] + NODE_W + 6 : n.col === 2 ? COLS[n.col] - 6 : COLS[n.col] + NODE_W + 6}
              y={(n.y0 + n.y1) / 2}
              dominantBaseline="middle"
              textAnchor={n.col === 2 ? 'end' : 'start'}
              className={n.col === 0 ? 'sankey__label sankey__label--serif' : 'sankey__label'}
            >
              {n.label}
              <tspan className="sankey__count"> {n.value}</tspan>
            </text>
            <title>{`${n.label}: ${n.value}`}</title>
          </g>
        ))}
      </svg>
    </section>
  )
}
