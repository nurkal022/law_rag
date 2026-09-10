import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { Body, Caption, Cite, H2, UIText } from '../../shared/ui'
import { useLang, useT, withLang } from '../../i18n'
import { citeCode } from '../legal/cite'
import { LevelBar } from './Bars'
import { dict } from './dict'
import { apiLang, flagged } from './levels'
import type { Overview, WalkAct } from './types'

/**
 * Как агент шёл по корпусу: линия времени по актам в порядке обхода.
 * Это демонстрация работы, поэтому у каждого акта видны время, объём и цена.
 */

function hhmm(iso: string | null, locale: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
}

function duration(a: WalkAct, min: string, sec: string): string {
  if (!a.started_at || !a.finished_at) return ''
  const s = Math.max(0, Math.round((Date.parse(a.finished_at) - Date.parse(a.started_at)) / 1000))
  return s >= 60 ? `${Math.floor(s / 60)} ${min} ${s % 60} ${sec}` : `${s} ${sec}`
}

export function Walk({ data }: { data: Overview }) {
  const t = useT(dict)
  const { lang } = useLang()
  const navigate = useNavigate()
  const locale = lang === 'kz' ? 'kk-KZ' : lang === 'en' ? 'en-US' : 'ru-RU'
  const al = apiLang(lang)
  const tierTitle = (tier: number) => data.tiers.find((x) => x.tier === tier)?.title[al] ?? ''

  return (
    <section className="cn-block">
      <div className="cn-block__head">
        <H2>{t('walkHead')}</H2>
        <Body tone="mute" className="cn-block__lead">{t('walkLead')}</Body>
      </div>
      <ol className="walk">
        {data.walk.map((a, i) => {
          const state = a.finished_at ? 'done' : a.started_at ? 'live' : 'wait'
          const isCurrent = data.current?.document_id === a.document_id && data.run?.status === 'running'
          const took = duration(a, t('unitMin'), t('unitSec'))
          return (
            <li key={a.document_id} className={`walk__item walk__item--${state} enter-item`} style={{ '--i': i } as CSSProperties}>
              <span className={`walk__dot ${isCurrent ? 'walk__dot--pulse' : ''}`} aria-hidden="true" />
              <div className="walk__body">
                <div className="walk__row">
                  <Cite code={citeCode(a.code, lang)} onClick={() => navigate(withLang(`/constitution/acts/${a.document_id}`, lang))} />
                  <UIText className="walk__title">{a.title}</UIText>
                  <Caption tone="mute">{tierTitle(a.tier)}</Caption>
                </div>
                <div className="walk__meta">
                  <Caption tone="mute" className="tabular">
                    {hhmm(a.started_at, locale)} → {hhmm(a.finished_at, locale)} {took ? `· ${took}` : ''}
                  </Caption>
                  <Caption tone="mute" className="tabular">{a.norms_done}/{a.norms_total} {t('walkNorms')}</Caption>
                  <Caption tone="mute" className="tabular">{a.tokens.toLocaleString('ru-RU')} {t('walkTokens')}</Caption>
                  {isCurrent && data.current ? (
                    <Caption tone="seal">{t('walkNow')}: {t('mapArticle').toLowerCase()} {data.current.article_no}</Caption>
                  ) : null}
                </div>
                <LevelBar counts={a.counts} total={a.norms_done} className="walk__bar" />
                <Caption tone="mute">{flagged(a.counts)} {t('walkFound')}</Caption>
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
