import { useEffect } from 'react'
import { Body, Caption, Display, Empty, H2, Label, Mono, Status, UIText } from '../../shared/ui'
import { useCountUpInt } from '../../shared/motion'
import { useLang, useT } from '../../i18n'
import { api } from '../../shared/api'
import { ListSkeleton, LoadFailure, useLoader } from '../drafts/shared'
import { Arcs } from './Arcs'
import { Changes } from './Changes'
import { ConstitutionMap } from './ConstitutionMap'
import { IsoMap } from './IsoMap'
import { Pyramid } from './Pyramid'
import { Replay } from './Replay'
import { Sankey } from './Sankey'
import { Walk } from './Walk'
import { dict } from './dict'
import type { Overview, Viz } from './types'
import '../drafts/drafts.css'
import './constitution.css'
import './constitution.motion.css'

function Figure({ value, label, tone }: { value: number; label: string; tone?: 'err' | 'warn' | 'note' | 'ok' }) {
  const shown = useCountUpInt(value)
  return (
    <div className="cn-figure">
      <span className={['cn-figure__value', tone ? `cn-figure__value--${tone}` : ''].filter(Boolean).join(' ')}>{shown}</span>
      <Caption tone="mute" className="cn-figure__label">{label}</Caption>
    </div>
  )
}

export function OverviewPage() {
  const t = useT(dict)
  const { lang } = useLang()
  const locale = lang === 'kz' ? 'kk-KZ' : lang === 'en' ? 'en-US' : 'ru-RU'
  const { data, error, loading, reload } = useLoader<Overview>(() => api.get<Overview>('/constitution/overview'), [])
  // Данные визуализаций — вторым запросом: семь тысяч уровней норм обзору-списку не нужны
  const viz = useLoader<Viz>(() => api.get<Viz>('/constitution/viz'), [])
  const status = data?.run?.status

  // Идущий прогон: обзор обновляется сам, раз в двадцать секунд — чаще незачем, акт разбирается минутами
  useEffect(() => {
    if (status !== 'running') return
    const id = window.setInterval(() => { reload(); viz.reload() }, 20_000)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  const run = data?.run ?? null
  const counts = run?.counts

  return (
    <div className="page cn">
      <div className="page__head">
        <div className="page__title">
          <Display>{t('title')}</Display>
          <Body tone="mute" className="cn-lead">{t('lead')}</Body>
        </div>
      </div>
      <Caption tone="mute" className="cn-disclaimer">{t('disclaimer')}</Caption>

      {loading ? (
        <ListSkeleton rows={8} />
      ) : error ? (
        <div className="ct-state"><LoadFailure error={error} onRetry={reload} /></div>
      ) : !data || !run ? (
        <div className="ct-state"><Empty title={t('noRunTitle')}>{t('noRunBody')}</Empty></div>
      ) : (
        <>
          <div className="cn-figures">
            <Figure value={data.walk.filter((a) => a.finished_at).length} label={t('figActs')} />
            <Figure value={run.norms_done} label={t('figNorms')} />
            <Figure value={counts?.['3'] ?? 0} label={t('figHigh')} tone="err" />
            <Figure value={counts?.['2'] ?? 0} label={t('figPossible')} tone="warn" />
            <Figure value={counts?.['1'] ?? 0} label={t('figReview')} tone="note" />
            <Figure value={counts?.['0'] ?? 0} label={t('figClean')} />
          </div>

          {viz.data?.run && viz.data.acts.length ? <Replay viz={viz.data} /> : null}
          <Walk data={data} />
          {viz.data?.run && viz.data.findings.length ? <Arcs viz={viz.data} /> : null}
          <Pyramid data={data} />
          {data.constitution ? (
            <>
              <IsoMap sections={data.constitution.sections} />
              <div className="cn-narrow-only"><ConstitutionMap sections={data.constitution.sections} /></div>
            </>
          ) : null}
          {viz.data?.run && viz.data.findings.length ? <Sankey viz={viz.data} changes={data.changes} /> : null}
          <Changes changes={data.changes} />

          <section className="cn-block cn-method">
            <H2>{t('methodHead')}</H2>
            <dl className="cn-method__grid">
              <dt><Label>{t('methodRun')}</Label></dt>
              <dd>
                <Status kind={run.status === 'done' ? 'ok' : 'warn'}>{run.status === 'done' ? t('done') : t('running')}</Status>{' '}
                <UIText tone="mute">
                  {run.started_at ? new Date(run.started_at).toLocaleString(locale, { dateStyle: 'long', timeStyle: 'short' }) : ''}
                  {run.finished_at ? ` — ${new Date(run.finished_at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}` : ''}
                </UIText>
              </dd>
              <dt><Label>{t('methodModels')}</Label></dt>
              <dd><Mono>{run.triage_model}</Mono> <UIText tone="mute">→</UIText> <Mono>{run.verify_model}</Mono></dd>
              <dt><Label>{t('methodTokens')}</Label></dt>
              <dd><UIText className="tabular">{run.tokens_used.toLocaleString('ru-RU')}</UIText></dd>
            </dl>
            <Caption tone="mute">{t('disclaimer')}</Caption>
          </section>
        </>
      )}
    </div>
  )
}
