import type { CSSProperties } from 'react'
import { Body, Caption, H2, Label, UIText } from '../../shared/ui'
import { Link } from '../../shared/nav'
import { useLang, useT } from '../../i18n'
import { citeCode } from '../legal/cite'
import { LevelBar } from './Bars'
import { dict } from './dict'
import { apiLang } from './levels'
import type { Overview } from './types'

/**
 * Одиннадцать ярусов иерархии юридической силы, сверху вниз, ступенями:
 * ширина яруса растёт к основанию. Конституция — печать на вершине.
 * Пустой ярус нарисован пунктиром и честно подписан.
 */
export function Pyramid({ data }: { data: Overview }) {
  const t = useT(dict)
  const { lang } = useLang()
  const al = apiLang(lang)

  return (
    <section className="cn-block">
      <div className="cn-block__head">
        <H2>{t('pyrHead')}</H2>
        <Body tone="mute" className="cn-block__lead">{t('pyrLead')}</Body>
      </div>
      <ol className="pyr">
        {data.tiers.map((tier, i) => {
          const top = tier.tier === 1
          const empty = !top && tier.acts.length === 0
          const cls = ['pyr__tier', top ? 'pyr__tier--top' : '', empty ? 'pyr__tier--empty' : ''].filter(Boolean).join(' ')
          return (
            <li key={tier.tier} className={cls} style={{ '--i': i, '--step': i } as CSSProperties}>
              <div className="pyr__band">
                <div className="pyr__label">
                  <Label>{tier.tier}</Label>
                  <UIText>{tier.title[al]}</UIText>
                </div>
                {top ? (
                  <Caption>{t('constitutionRow')}</Caption>
                ) : empty ? (
                  <Caption tone="mute">{t('emptyTier')}</Caption>
                ) : (
                  <ul className="pyr__acts">
                    {tier.acts.map((a) => (
                      <li key={a.document_id}>
                        <Link to={`/constitution/acts/${a.document_id}`} className="pyr__act" title={a.title}>
                          <span className="pyr__code">{citeCode(a.code, lang)}</span>
                          <span className="pyr__title">{a.title}</span>
                          <LevelBar counts={a.counts} total={a.done || a.norms} />
                          <span className="pyr__n tabular t-caption">{a.norms}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
