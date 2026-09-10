import { useMemo } from 'react'
import { Body, H2 } from '../../shared/ui'
import { Link } from '../../shared/nav'
import { useLang, useT } from '../../i18n'
import { dict } from './dict'
import { articleLabel, levelClass } from './levels'
import type { Section } from './types'

/**
 * Рельеф Конституции: 96 статей изометрическими столбиками, 12 в ряду, по
 * порядку номеров. Высота — сколько норм касаются статьи, цвет — наихудший
 * уровень. Разделы отмечены чередованием плитки и римской цифрой.
 */

const COLS = 12
const TW = 64
const TH = 32
const MAX_H = 130
const W = 1000

export function IsoMap({ sections }: { sections: Section[] }) {
  const t = useT(dict)
  const { lang } = useLang()
  const tiles = useMemo(() => {
    const flat: { no: number; norms: number; worst: number; si: number; first: boolean; section: string; title: string }[] = []
    sections.forEach((s, si) => s.articles.forEach((a, ai) => flat.push({ no: a.no, norms: a.norms, worst: a.worst, si, first: ai === 0, section: s.no, title: s.title })))
    const max = Math.max(1, ...flat.map((a) => a.norms))
    const rows = Math.ceil(flat.length / COLS)
    const ox = W / 2 + ((rows - COLS) * TW) / 4
    const oy = 24 + MAX_H
    const out = flat.map((a, i) => {
      const c = i % COLS
      const r = Math.floor(i / COLS)
      const x = ox + ((c - r) * TW) / 2
      const y = oy + ((c + r) * TH) / 2
      const h = a.norms ? 6 + (a.norms / max) * MAX_H : 0
      return { ...a, c, r, x, y, h, depth: c + r }
    })
    out.sort((p, q) => p.depth - q.depth || p.r - q.r)
    const height = oy + ((COLS - 1 + rows - 1) * TH) / 2 + TH + 30
    return { out, height }
  }, [sections])

  return (
    <section className="cn-block cn-wide-only">
      <div className="cn-block__head">
        <H2>{t('isoHead')}</H2>
        <Body tone="mute" className="cn-block__lead">{t('isoLead')}</Body>
      </div>
      <svg className="iso" viewBox={`0 0 ${W} ${tiles.height}`} role="img" aria-label={t('isoHead')}>
        {tiles.out.map((a) => {
          const { x, y, h } = a
          const top = `${x},${y - h} ${x + TW / 2},${y - h + TH / 2} ${x},${y - h + TH} ${x - TW / 2},${y - h + TH / 2}`
          const left = `${x - TW / 2},${y + TH / 2 - h} ${x},${y + TH - h} ${x},${y + TH} ${x - TW / 2},${y + TH / 2}`
          const right = `${x + TW / 2},${y + TH / 2 - h} ${x},${y + TH - h} ${x},${y + TH} ${x + TW / 2},${y + TH / 2}`
          const base = `${x},${y} ${x + TW / 2},${y + TH / 2} ${x},${y + TH} ${x - TW / 2},${y + TH / 2}`
          return (
            <Link key={a.no} to={`/constitution/articles/${a.no}`} className="iso__link">
              <g className={['iso__tile', a.si % 2 ? 'iso__tile--alt' : '', a.norms ? levelClass(a.worst) : 'iso__tile--empty'].filter(Boolean).join(' ')} style={{ '--i': a.depth } as React.CSSProperties}>
                <polygon points={base} className="iso__base" />
                {h > 0 ? (
                  <g className="iso__bar">
                    <polygon points={left} className="iso__face iso__face--l" />
                    <polygon points={right} className="iso__face iso__face--r" />
                    <polygon points={top} className="iso__face iso__face--t" />
                  </g>
                ) : null}
                <text x={x} y={y - h + TH / 2 + 3} textAnchor="middle" className="iso__no">{a.no}</text>
                {a.first ? <text x={x - TW / 2 - 4} y={y + TH / 2 + 3} textAnchor="end" className="iso__roman">{a.section}</text> : null}
                <title>{`${articleLabel(a.no, lang, t('mapArticle'))} · ${a.title} · ${a.norms}`}</title>
              </g>
            </Link>
          )
        })}
      </svg>
    </section>
  )
}
