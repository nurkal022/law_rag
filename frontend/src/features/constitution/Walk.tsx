import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { Body, Caption, H2, Label, UIText } from '../../shared/ui'
import { useLang, useT, withLang } from '../../i18n'
import { citeCode } from '../legal/cite'
import { dict } from './dict'
import { apiLang, articleLabel, flagged } from './levels'
import type { Overview, WalkAct } from './types'
import { reducedMotion } from './viz'

/**
 * Ход обхода как лента времени. Ширина полосы акта — сколько времени агент на нём
 * провёл, высота заливки внутри — доля норм с замечаниями по уровням. Сверху —
 * ярусы иерархии, по которым шёл обход; снизу — шкала часов прогона. По ленте
 * едет маркер агента: акт под ним раскрывается в карточку с деталями.
 */

const W = 1000
const LANE_Y = 64
const LANE_H = 88
const SCALE_Y = LANE_Y + LANE_H + 22
const H = SCALE_Y + 26
const GAP = 3
const SWEEP = 14_000

interface Seg {
  act: WalkAct
  x: number
  w: number
}

export function Walk({ data }: { data: Overview }) {
  const t = useT(dict)
  const { lang } = useLang()
  const navigate = useNavigate()
  const al = apiLang(lang)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [p, setP] = useState(reducedMotion() ? 1 : 0)
  const [pin, setPin] = useState<number | null>(null)
  const [armed, setArmed] = useState(reducedMotion())

  const model = useMemo(() => {
    const acts = data.walk.filter((a) => a.started_at)
    if (!acts.length) return null
    // Ширина полосы — число норм акта: лента показывает объём работы, а не время
    const total = Math.max(1, acts.reduce((s, a) => s + Math.max(1, a.norms_total), 0))
    let acc = 0
    const segs: Seg[] = acts.map((a) => {
      const n = Math.max(1, a.norms_total)
      const x = (W * acc) / total
      const w = Math.max(6, (W * n) / total - GAP)
      acc += n
      return { act: a, x, w }
    })
    // Ярусы: непрерывные отрезки актов одного уровня
    const tiers: { tier: number; x0: number; x1: number }[] = []
    for (const s of segs) {
      const last = tiers[tiers.length - 1]
      if (last && last.tier === s.act.tier) last.x1 = s.x + s.w
      else tiers.push({ tier: s.act.tier, x0: s.x, x1: s.x + s.w })
    }
    // Шкала: по тысяче норм
    const ticks: { x: number; label: string }[] = []
    for (let n = 0; n <= total; n += 1000) ticks.push({ x: (W * n) / total, label: n.toLocaleString('ru-RU') })
    return { segs, tiers, ticks, total }
  }, [data.walk])

  // Маркер едет по ленте, когда блок доехал до экрана
  useEffect(() => {
    if (armed) return
    const el = wrapRef.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setArmed(true)
      return
    }
    const io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) {
        setArmed(true)
        io.disconnect()
      }
    }, { threshold: 0.4 })
    io.observe(el)
    return () => io.disconnect()
  }, [armed])

  useEffect(() => {
    if (!armed || p >= 1 || reducedMotion()) return
    let raf = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / SWEEP)
      setP(1 - Math.pow(1 - k, 2))
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [armed])

  if (!model) return null

  const cursorX = W * p
  const under = pin ?? model.segs.findIndex((s) => cursorX >= s.x && cursorX <= s.x + s.w + GAP)
  const active = under >= 0 ? model.segs[under] : model.segs[model.segs.length - 1]
  // Накопленные счётчики до маркера
  let norms = 0
  let found = 0
  let tokens = 0
  for (const s of model.segs) {
    const k = cursorX >= s.x + s.w ? 1 : cursorX <= s.x ? 0 : (cursorX - s.x) / s.w
    norms += Math.round(s.act.norms_done * k)
    found += Math.round(flagged(s.act.counts) * k)
    tokens += Math.round(s.act.tokens * k)
  }
  const tierTitle = (tier: number) => data.tiers.find((x) => x.tier === tier)?.title[al] ?? ''
  const live = data.run?.status === 'running'

  return (
    <section className="cn-block" ref={wrapRef}>
      <div className="cn-block__head">
        <H2>{t('walkHead')}</H2>
        <Body tone="mute" className="cn-block__lead">{t('walkLead')}</Body>
      </div>

      <div className="tl__hud">
        <div className="tl__fig"><span className="tl__num">{norms.toLocaleString('ru-RU')}</span><Caption tone="mute">{t('figNorms')}</Caption></div>
        <div className="tl__fig"><span className="tl__num tl__num--warn">{found.toLocaleString('ru-RU')}</span><Caption tone="mute">{t('replayFindings')}</Caption></div>
        <div className="tl__fig"><span className="tl__num">{tokens.toLocaleString('ru-RU')}</span><Caption tone="mute">{t('walkTokens')}</Caption></div>
      </div>

      <svg className="tl" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('walkHead')}
           onMouseLeave={() => setPin(null)}>
        {/* ярусы */}
        {model.tiers.map((tr, i) => {
          const wide = tr.x1 - tr.x0 >= 150
          const atEnd = tr.x0 > W - 170
          return (
            <g key={i} className="tl__tier">
              <line x1={tr.x0} x2={tr.x1} y1={LANE_Y - 22} y2={LANE_Y - 22} className="tl__tier-line" />
              <text x={atEnd ? tr.x1 : tr.x0} y={LANE_Y - 30} textAnchor={atEnd ? 'end' : 'start'} className="tl__tier-label">
                {wide || atEnd ? `${tr.tier} · ${tierTitle(tr.tier)}` : String(tr.tier)}
              </text>
              <title>{`${tr.tier} · ${tierTitle(tr.tier)}`}</title>
            </g>
          )
        })}
        {/* полосы актов */}
        {model.segs.map((s, i) => {
          const c = s.act.counts
          const n = Math.max(1, s.act.norms_done)
          const h3 = (LANE_H * (c['3'] ?? 0)) / n
          const h2 = (LANE_H * (c['2'] ?? 0)) / n
          const h1 = (LANE_H * (c['1'] ?? 0)) / n
          // Слои замечаний — от нижней кромки, увеличены в 4 раза, чтобы 5 % не были невидимы
          const k = 4
          const y3 = LANE_Y + LANE_H - h3 * k
          const y2 = y3 - h2 * k
          const y1 = y2 - h1 * k
          const reached = cursorX >= s.x
          const isActive = active === s
          return (
            <g
              key={s.act.document_id}
              className={['tl__seg', reached ? 'tl__seg--on' : '', isActive ? 'tl__seg--active' : ''].filter(Boolean).join(' ')}
              style={{ '--i': i } as CSSProperties}
              onMouseEnter={() => setPin(i)}
              onClick={() => navigate(withLang(`/constitution/acts/${s.act.document_id}`, lang))}
            >
              <rect x={s.x} y={LANE_Y} width={s.w} height={LANE_H} className="tl__base" />
              <rect x={s.x} y={Math.max(LANE_Y, y1)} width={s.w} height={Math.min(LANE_H, h1 * k)} className="tl__layer lv--1" />
              <rect x={s.x} y={Math.max(LANE_Y, y2)} width={s.w} height={Math.min(LANE_H, h2 * k)} className="tl__layer lv--2" />
              <rect x={s.x} y={Math.max(LANE_Y, y3)} width={s.w} height={Math.min(LANE_H, h3 * k)} className="tl__layer lv--3" />
              {s.w > 34 ? (
                <text x={s.x + 4} y={LANE_Y + 13} className="tl__code">{citeCode(s.act.code, lang)}</text>
              ) : null}
              <title>{`${s.act.title} · ${s.act.norms_done} · ${flagged(s.act.counts)}`}</title>
            </g>
          )
        })}
        {/* шкала минут */}
        <line x1={0} x2={W} y1={SCALE_Y} y2={SCALE_Y} className="tl__axis" />
        {model.ticks.map((tk) => (
          <g key={tk.label}>
            <line x1={tk.x} x2={tk.x} y1={SCALE_Y} y2={SCALE_Y + 5} className="tl__axis" />
            <text x={tk.x} y={SCALE_Y + 18} textAnchor={tk.x === 0 ? 'start' : 'middle'} className="tl__tick">{tk.label}</text>
          </g>
        ))}
        {/* маркер агента */}
        <g className="tl__cursor" transform={`translate(${cursorX} 0)`}>
          <line x1={0} x2={0} y1={LANE_Y - 8} y2={SCALE_Y} className="tl__cursor-line" />
          <circle cx={0} cy={LANE_Y - 8} r={5} className={live && p >= 1 ? 'tl__cursor-dot tl__cursor-dot--pulse' : 'tl__cursor-dot'} />
        </g>
      </svg>

      {/* карточка активного акта */}
      <div className="tl__card" key={active.act.document_id}>
        <div className="tl__card-row">
          <Label>{citeCode(active.act.code, lang)}</Label>
          <UIText className="tl__card-title">{active.act.title}</UIText>
          <Caption tone="mute">{tierTitle(active.act.tier)}</Caption>
        </div>
        <div className="tl__card-row">
          <Caption tone="mute" className="tabular">{active.act.norms_done}/{active.act.norms_total} {t('walkNorms')}</Caption>
          <Caption tone="mute" className="tabular">{active.act.tokens.toLocaleString('ru-RU')} {t('walkTokens')}</Caption>
          <Caption tone={flagged(active.act.counts) ? 'warn' : 'mute'}>{flagged(active.act.counts)} {t('walkFound')}</Caption>
          {live && data.current?.document_id === active.act.document_id ? (
            <Caption tone="seal">{t('walkNow')}: {articleLabel(data.current.article_no, lang, t('mapArticle').toLowerCase())}</Caption>
          ) : null}
        </div>
      </div>
    </section>
  )
}
