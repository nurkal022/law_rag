import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Body, Button, Caption, H2, Label } from '../../shared/ui'
import { useLang, useT, withLang } from '../../i18n'
import { citeCode } from '../legal/cite'
import { dict } from './dict'
import type { Viz, VizAct } from './types'
import { levelToken, reducedMotion, token } from './viz'

/**
 * Обход в сжатом времени: весь корпус как поле точек, по одной на норму, блоками
 * по актам в порядке обхода. За полминуты агент «проходит» поле с теми же
 * пропорциями времени, что и в настоящем прогоне; найденное вспыхивает и остаётся.
 *
 * Canvas, а не SVG: семь тысяч точек, перерисовываемых каждый кадр, — это не
 * работа для DOM. Цвета читаются из токенов во время выполнения.
 */

const PITCH = 5
const DOT = 3
const PAD = 8
const LABEL = 18
const GAP = 14
const DURATION = 26_000
const FLASH = 700

interface Block {
  act: VizAct
  x: number
  y: number
  cols: number
  w: number
  h: number
  start: number
  end: number
  flaggedPrefix: number[]
}

function realDuration(a: VizAct): number {
  if (a.started_at && a.finished_at) return Math.max(1000, Date.parse(a.finished_at) - Date.parse(a.started_at))
  return Math.max(1, a.levels.length) * 400
}

function layout(acts: VizAct[], width: number): { blocks: Block[]; height: number; realTotal: number } {
  const maxCols = Math.max(4, Math.floor((width - 2 * PAD) / PITCH))
  const realTotal = acts.reduce((s, a) => s + realDuration(a), 0)
  const blocks: Block[] = []
  let x = 0
  let y = 0
  let rowH = 0
  let acc = 0
  for (const act of acts) {
    const n = Math.max(1, act.levels.length)
    const cols = Math.min(Math.ceil(Math.sqrt(n * 2.4)), maxCols)
    const rows = Math.ceil(n / cols)
    const w = cols * PITCH + 2 * PAD
    const h = rows * PITCH + 2 * PAD + LABEL
    if (x + w > width && x > 0) {
      x = 0
      y += rowH + GAP
      rowH = 0
    }
    const start = acc / realTotal
    acc += realDuration(act)
    const flaggedPrefix: number[] = [0]
    for (const lv of act.levels) flaggedPrefix.push(flaggedPrefix[flaggedPrefix.length - 1] + (lv >= 1 ? 1 : 0))
    blocks.push({ act, x, y, cols, w, h, start, end: acc / realTotal, flaggedPrefix })
    x += w + GAP
    rowH = Math.max(rowH, h)
  }
  return { blocks, height: y + rowH, realTotal }
}

function litCount(b: Block, p: number): number {
  const n = b.act.levels.length
  if (p >= b.end) return n
  if (p <= b.start) return 0
  return Math.floor((n * (p - b.start)) / (b.end - b.start))
}

export function Replay({ viz }: { viz: Viz }) {
  const t = useT(dict)
  const { lang } = useLang()
  const navigate = useNavigate()
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const normsRef = useRef<HTMLSpanElement | null>(null)
  const foundRef = useRef<HTMLSpanElement | null>(null)
  const tokensRef = useRef<HTMLSpanElement | null>(null)
  const rangeRef = useRef<HTMLInputElement | null>(null)
  const progress = useRef(reducedMotion() ? 1 : 0)
  const [width, setWidth] = useState(960)
  const [playing, setPlaying] = useState(false)
  const [hover, setHover] = useState<Block | null>(null)
  const [started, setStarted] = useState(reducedMotion())
  const [frame, setFrame] = useState(0)   // принудительная перерисовка после ползунка

  const { blocks, height, realTotal } = useMemo(() => layout(viz.acts, width), [viz.acts, width])

  // Ширина холста — от контейнера
  useEffect(() => {
    const el = wrapRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((entries) => {
      const w = Math.floor(entries[0].contentRect.width)
      if (w > 0) setWidth(w)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Старт, когда блок доехал до экрана — не раньше, чтобы полминуты не пропали за шапкой
  useEffect(() => {
    if (started) return
    const el = wrapRef.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setStarted(true)
      setPlaying(true)
      return
    }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setStarted(true)
        setPlaying(true)
        io.disconnect()
      }
    }, { threshold: 0.35 })
    io.observe(el)
    return () => io.disconnect()
  }, [started])

  // Отрисовка кадра
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.floor(width * dpr)
    canvas.height = Math.floor(height * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const colors: Record<string, string> = {}
    const c = (name: string) => (colors[name] ??= token(name))
    const font = `${token('--t-mono-weight') || '500'} ${token('--t-mono-size') || '11px'} ${token('--font-mono')}`

    const draw = (p: number) => {
      ctx.clearRect(0, 0, width, height)
      let norms = 0
      let found = 0
      let tokens = 0
      for (const b of blocks) {
        const n = b.act.levels.length
        const lit = litCount(b, p)
        const current = p > b.start && p < b.end
        norms += lit
        found += b.flaggedPrefix[lit]
        tokens += b.act.tokens * (n ? lit / n : 0)
        for (let i = 0; i < n; i++) {
          const col = i % b.cols
          const row = Math.floor(i / b.cols)
          const x = b.x + PAD + col * PITCH
          const y = b.y + PAD + row * PITCH
          const lv = b.act.levels[i]
          if (i < lit) {
            ctx.globalAlpha = lv >= 1 ? 1 : 0.55
            ctx.fillStyle = lv >= 1 ? c(levelToken(lv)) : c('--ink-2')
          } else {
            ctx.globalAlpha = 1
            ctx.fillStyle = c('--rule-soft')
          }
          ctx.fillRect(x, y, DOT, DOT)
        }
        // Вспышка только что найденного
        if (current || p >= b.end) {
          const span = (b.end - b.start) * DURATION
          for (let i = Math.max(0, lit - 40); i < lit; i++) {
            const lv = b.act.levels[i]
            if (lv < 1) continue
            const litAt = b.start * DURATION + (span * i) / Math.max(1, n)
            const age = p * DURATION - litAt
            if (age < 0 || age > FLASH) continue
            const k = age / FLASH
            const col = i % b.cols
            const row = Math.floor(i / b.cols)
            ctx.globalAlpha = 1 - k
            ctx.strokeStyle = c(levelToken(lv))
            ctx.lineWidth = 1.5
            ctx.beginPath()
            ctx.arc(b.x + PAD + col * PITCH + DOT / 2, b.y + PAD + row * PITCH + DOT / 2, 3 + k * 9, 0, Math.PI * 2)
            ctx.stroke()
          }
        }
        ctx.globalAlpha = 1
        // Рамка текущего акта и подпись
        if (current || hover === b) {
          ctx.strokeStyle = c(current ? '--seal' : '--ink')
          ctx.lineWidth = 1
          ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - LABEL - 1)
        }
        ctx.font = font
        ctx.fillStyle = c(current ? '--seal' : lit > 0 ? '--ink-2' : '--mute')
        ctx.textBaseline = 'top'
        const label = citeCode(b.act.code, lang)
        const maxW = b.w - 2
        let text = label
        while (text.length > 3 && ctx.measureText(text).width > maxW) text = text.slice(0, -2) + '…'
        ctx.fillText(text, b.x + 1, b.y + b.h - LABEL + 4)
      }
      if (normsRef.current) normsRef.current.textContent = norms.toLocaleString('ru-RU')
      if (foundRef.current) foundRef.current.textContent = found.toLocaleString('ru-RU')
      if (tokensRef.current) tokensRef.current.textContent = Math.round(tokens).toLocaleString('ru-RU')
      if (rangeRef.current && document.activeElement !== rangeRef.current) rangeRef.current.value = String(Math.round(p * 1000))
    }

    draw(progress.current)
    if (!playing) return
    let raf = 0
    const t0 = performance.now()
    const p0 = progress.current
    const tick = (now: number) => {
      const p = Math.min(1, p0 + (now - t0) / DURATION)
      progress.current = p
      draw(p)
      if (p < 1) raf = requestAnimationFrame(tick)
      else setPlaying(false)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [blocks, width, height, playing, hover, lang, realTotal, t, frame])

  const blockAt = (e: React.MouseEvent<HTMLCanvasElement>): Block | null => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    return blocks.find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) ?? null
  }

  const restart = () => {
    progress.current = 0
    setPlaying(true)
  }

  return (
    <section className="cn-block replay">
      <div className="cn-block__head">
        <H2>{t('replayHead')}</H2>
        <Body tone="mute" className="cn-block__lead">{t('replayLead')}</Body>
      </div>
      <div className="replay__hud">
        <div className="replay__fig"><span className="replay__num" ref={normsRef}>0</span><Caption tone="mute">{t('figNorms')}</Caption></div>
        <div className="replay__fig"><span className="replay__num replay__num--warn" ref={foundRef}>0</span><Caption tone="mute">{t('replayFindings')}</Caption></div>
        <div className="replay__fig"><span className="replay__num" ref={tokensRef}>0</span><Caption tone="mute">{t('walkTokens')}</Caption></div>
      </div>
      <div className="replay__field" ref={wrapRef}>
        <canvas
          ref={canvasRef}
          className="replay__canvas"
          style={{ width, height }}
          onMouseMove={(e) => setHover(blockAt(e))}
          onMouseLeave={() => setHover(null)}
          onClick={(e) => {
            const b = blockAt(e)
            if (b) navigate(withLang(`/constitution/acts/${b.act.document_id}`, lang))
          }}
          role="img"
          aria-label={t('replayHead')}
        />
      </div>
      <div className="replay__controls">
        <Button variant="ghost" onClick={() => (progress.current >= 1 ? restart() : setPlaying((v) => !v))}>
          {playing ? t('pause') : t('play')}
        </Button>
        <Button variant="ghost" onClick={restart}>{t('restart')}</Button>
        <input
          ref={rangeRef}
          className="replay__range"
          type="range"
          min={0}
          max={1000}
          defaultValue={0}
          aria-label={t('elapsed')}
          onChange={(e) => {
            progress.current = Number(e.target.value) / 1000
            setPlaying(false)
            setFrame((f) => f + 1)
          }}
          onInput={() => setPlaying(false)}
        />
        <div className="replay__hover">
          {hover ? (
            <>
              <Label>{citeCode(hover.act.code, lang)}</Label>
              <Caption tone="mute">{hover.act.title} · {hover.act.levels.length} {t('walkNorms')} · {hover.flaggedPrefix[hover.act.levels.length]} {t('walkFound')}</Caption>
            </>
          ) : (
            <Caption tone="mute">{t('replayHint')}</Caption>
          )}
        </div>
      </div>
    </section>
  )
}
