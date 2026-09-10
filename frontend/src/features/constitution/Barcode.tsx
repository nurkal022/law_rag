import type { CSSProperties } from 'react'
import { useLang } from '../../i18n'
import { apiLang, levelClass } from './levels'
import type { ArticleStrip, Tri } from './types'

/**
 * Один штрих на статью в порядке акта. Ширина — от числа статей, высота фиксирована;
 * SVG растягивается по ширине контейнера (preserveAspectRatio="none").
 */
export function Barcode({ articles, wording, onPick }: {
  articles: ArticleStrip[]
  wording: Record<number, Tri>
  onPick: (findingId: number) => void
}) {
  const { lang } = useLang()
  const al = apiLang(lang)
  const n = Math.max(1, articles.length)
  const W = 1000
  const H = 36
  const w = W / n
  const gap = n > 400 ? 0 : Math.min(1, w * 0.25)
  return (
    <svg className="bc" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`${articles.length}`}>
      {articles.map((a, i) => {
        const level = a.level ?? null
        const label = `${a.title || a.article_no}${level && wording[level] ? ` · ${wording[level][al]}` : ''}`
        return (
          <rect
            key={a.chunk_id}
            className={`bc__bar ${levelClass(level)} ${a.finding_id ? 'bc__bar--link' : ''}`}
            x={i * w}
            y={0}
            width={Math.max(0.6, w - gap)}
            height={H}
            style={{ '--i': i % 60 } as CSSProperties}
            onClick={() => a.finding_id && onPick(a.finding_id)}
          >
            <title>{label}</title>
          </rect>
        )
      })}
    </svg>
  )
}
