import type { CSSProperties } from 'react'
import { Body, Caption, H2, Mono } from '../../shared/ui'
import { Link } from '../../shared/nav'
import { useLang, useT } from '../../i18n'
import { dict } from './dict'
import { articleLabel, levelClass } from './levels'
import type { Section } from './types'

/**
 * 96 статей по 11 разделам. Насыщенность ячейки — сколько норм её касаются
 * (относительно самой «нагруженной» статьи), обводка — наихудший уровень.
 */
export function ConstitutionMap({ sections }: { sections: Section[] }) {
  const t = useT(dict)
  const { lang } = useLang()
  const max = Math.max(1, ...sections.flatMap((s) => s.articles.map((a) => a.norms)))
  let idx = 0
  return (
    <section className="cn-block">
      <div className="cn-block__head">
        <H2>{t('mapHead')}</H2>
        <Body tone="mute" className="cn-block__lead">{t('mapLead')}</Body>
      </div>
      <div className="cmap">
        {sections.map((s) => (
          <div key={s.no} className="cmap__row">
            <div className="cmap__sec">
              <Mono>{s.no}</Mono>
              <Caption tone="mute">{s.title}</Caption>
            </div>
            <div className="cmap__cells">
              {s.articles.map((a) => {
                const i = idx++
                return (
                  <Link
                    key={a.no}
                    to={`/constitution/articles/${a.no}`}
                    className={`cmap__cell ${levelClass(a.worst)}`}
                    style={{ '--w': a.norms / max, '--i': i % 12 } as CSSProperties}
                    title={`${articleLabel(a.no, lang, t('mapArticle'))} · ${a.norms}`}
                    aria-label={`${articleLabel(a.no, lang, t('mapArticle'))}, ${a.norms}`}
                  >
                    <span className="cmap__fill" aria-hidden="true" />
                    <span className="cmap__no">{a.no}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
