import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Button,
  Caption,
  Caret,
  Cite,
  Empty,
  H2,
  Label,
  Textarea,
  UIText,
  useToast,
} from '../../shared/ui'
import { useLang, useT } from '../../i18n'
import type { Dict, Lang } from '../../i18n'
import { citeCode } from '../legal/cite'
import { ANSWERS, EXAMPLES, pickAnswer } from './mock'
import type { MockAnswer, Seg } from './mock'
import './chat.css'

const dict: Dict = {
  title: { ru: 'Консультант', kz: 'Кеңесші', en: 'Assistant' },
  emptyTitle: {
    ru: 'Задайте вопрос по праву Казахстана',
    kz: 'Қазақстан құқығы бойынша сұрақ қойыңыз',
    en: 'Ask a question on Kazakhstan law',
  },
  emptyBody: {
    ru: 'Ответ приводится со ссылками на нормы: каждую координату можно открыть и прочитать первоисточник.',
    kz: 'Жауап нормаларға сілтемелермен беріледі: әрбір координатаны ашып, бастапқы дереккөзді оқуға болады.',
    en: 'The answer cites the underlying provisions: every coordinate opens the source text.',
  },
  examples: { ru: 'Примеры вопросов', kz: 'Сұрақ үлгілері', en: 'Example questions' },
  you: { ru: 'Вопрос', kz: 'Сұрақ', en: 'Question' },
  assistant: { ru: 'Ответ', kz: 'Жауап', en: 'Answer' },
  sources: { ru: 'Источники', kz: 'Дереккөздер', en: 'Sources' },
  copy: { ru: 'Копировать', kz: 'Көшіру', en: 'Copy' },
  copied: { ru: 'Ответ скопирован', kz: 'Жауап көшірілді', en: 'Answer copied' },
  copyFailed: {
    ru: 'Не удалось скопировать',
    kz: 'Көшіру мүмкін болмады',
    en: 'Could not copy',
  },
  exportAct: { ru: 'Экспорт', kz: 'Экспорт', en: 'Export' },
  exportDone: {
    ru: 'Экспорт в DOCX будет готов после подключения сервера',
    kz: 'DOCX экспорты сервер қосылғаннан кейін дайын болады',
    en: 'DOCX export will be available once the server is connected',
  },
  saveAct: { ru: 'Сохранить в дело', kz: 'Іске сақтау', en: 'Save to matter' },
  saveDone: {
    ru: 'Ответ добавлен в дело',
    kz: 'Жауап іске қосылды',
    en: 'Answer added to the matter',
  },
  placeholder: {
    ru: 'Сформулируйте вопрос: обстоятельства, вид договора, что нужно выяснить',
    kz: 'Сұрағыңызды тұжырымдаңыз: мән-жайлар, шарт түрі, нені анықтау қажет',
    en: 'State your question: the facts, the type of contract, what you need to find out',
  },
  send: { ru: 'Спросить', kz: 'Сұрау', en: 'Ask' },
  attach: { ru: 'Приложить файл', kz: 'Файл тіркеу', en: 'Attach file' },
  attached: { ru: 'Файл приложен:', kz: 'Файл тіркелді:', en: 'File attached:' },
  hint: {
    ru: 'Enter — отправить, Shift + Enter — перенос строки',
    kz: 'Enter — жіберу, Shift + Enter — жол ауыстыру',
    en: 'Enter to send, Shift + Enter for a line break',
  },
  ariaInput: { ru: 'Текст вопроса', kz: 'Сұрақ мәтіні', en: 'Question text' },
  ariaFeed: { ru: 'Лента диалога', kz: 'Диалог таспасы', en: 'Conversation' },
  writing: { ru: 'Ответ печатается', kz: 'Жауап теріліп жатыр', en: 'Answering' },
  disclaimer: {
    ru: 'Ответ носит справочный характер и не заменяет консультацию юриста.',
    kz: 'Жауап анықтамалық сипатта, заңгер кеңесін алмастырмайды.',
    en: 'The answer is for reference and does not replace advice from a lawyer.',
  },
}

/* ---------- Стриминг: разбор ответа на единицы вывода ---------- */

type Unit = { word: string } | { cite: string }

const STEP_MS = 30

function toUnits(segs: Seg[]): Unit[] {
  const out: Unit[] = []
  for (const seg of segs) {
    if (typeof seg !== 'string') {
      out.push({ cite: seg.cite })
      continue
    }
    const parts = seg.match(/\s*\S+\s*|\s+/g) ?? []
    for (const p of parts) out.push({ word: p })
  }
  return out
}

function toPlain(segs: Seg[]): string {
  return segs.map((s) => (typeof s === 'string' ? s : s.cite)).join('')
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const on = () => setReduced(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return reduced
}

/** Собирает видимую часть ответа: текст антиквой, координаты — через <Cite>. */
function renderUnits(units: Unit[], onCite: (code: string) => void) {
  const nodes: ReactNode[] = []
  let buf = ''
  units.forEach((u, i) => {
    if ('cite' in u) {
      if (buf) {
        nodes.push(buf)
        buf = ''
      }
      nodes.push(<Cite key={`c${i}`} code={u.cite} onClick={() => onCite(u.cite)} />)
    } else {
      buf += u.word
    }
  })
  if (buf) nodes.push(buf)
  return nodes
}

/* ---------- Одна пара «вопрос — ответ» ---------- */

interface TurnData {
  id: number
  question: string
  answerId: string
}

interface TurnProps {
  turn: TurnData
  streaming: boolean
  onDone: (id: number) => void
}

function Turn({ turn, streaming, onDone }: TurnProps) {
  const t = useT(dict)
  const { lang } = useLang()
  const toast = useToast()
  const reduced = useReducedMotion()
  const [open, setOpen] = useState(false)
  const sourcesId = useId()

  const answer = useMemo<MockAnswer>(
    () => ANSWERS.find((a) => a.id === turn.answerId) ?? ANSWERS[0],
    [turn.answerId],
  )
  const segs = answer.body[lang]
  const units = useMemo(() => toUnits(segs), [segs])

  const [shown, setShown] = useState(() => (streaming ? 0 : units.length))

  useEffect(() => {
    if (!streaming) return
    // Уважение к «меньше движения»: ответ выводится целиком, без набора
    if (reduced) {
      onDone(turn.id)
      return
    }
    let i = 0
    const timer = window.setInterval(() => {
      i += 1
      setShown(i)
      if (i >= units.length) {
        window.clearInterval(timer)
        onDone(turn.id)
      }
    }, STEP_MS)
    return () => window.clearInterval(timer)
  }, [streaming, reduced, units, turn.id, onDone])

  const openCite = useCallback((code: string) => toast(code), [toast])

  const typing = streaming && !reduced
  const visible = typing ? units.slice(0, shown) : units
  const busy = typing && shown < units.length

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(toPlain(segs))
      toast(t('copied'), 'ok')
    } catch {
      toast(t('copyFailed'), 'err')
    }
  }

  return (
    <article className="chat__turn">
      <Label className="chat__stamp">{t('you')}</Label>
      <UIText className="chat__ask">{turn.question}</UIText>

      <Label className="chat__stamp" style={{ marginTop: 'var(--s-5)' }}>
        {t('assistant')}
      </Label>
      <div
        className="chat__answer t-legal"
        aria-busy={busy || undefined}
        aria-live={busy ? 'polite' : undefined}
      >
        {renderUnits(visible, openCite)}
        {busy ? <Caret /> : null}
      </div>

      {!busy ? (
        <>
          <section className="chat__sources">
            <button
              type="button"
              className="chat__sources-toggle"
              aria-expanded={open}
              aria-controls={sourcesId}
              onClick={() => setOpen((v) => !v)}
            >
              <span className="chat__sign" aria-hidden="true">
                {open ? '—' : '+'}
              </span>
              {t('sources')} · {answer.sources.length}
            </button>
            <div id={sourcesId} hidden={!open}>
              {answer.sources.map((s) => (
                <div className="chat__source" key={s.code}>
                  <div className="chat__source-head">
                    <span className="chat__source-doc">{s.doc[lang as Lang]}</span>
                    <Cite code={citeCode(s.code, lang)} onClick={() => openCite(citeCode(s.code, lang))} />
                  </div>
                  <div className="chat__source-text t-legal">{s.excerpt[lang as Lang]}</div>
                </div>
              ))}
            </div>
          </section>

          <div className="chat__acts">
            <Button variant="ghost" onClick={copy}>
              {t('copy')}
            </Button>
            <Button variant="ghost" onClick={() => toast(t('exportDone'))}>
              {t('exportAct')}
            </Button>
            <Button variant="ghost" onClick={() => toast(t('saveDone'), 'ok')}>
              {t('saveAct')}
            </Button>
          </div>

          <Caption tone="mute" as="p" style={{ marginTop: 'var(--s-3)' }}>
            {t('disclaimer')}
          </Caption>
        </>
      ) : (
        <Caption tone="mute" as="p" style={{ marginTop: 'var(--s-3)' }} role="status">
          {t('writing')}
        </Caption>
      )}
    </article>
  )
}

/* ---------- Экран ---------- */

export function ChatPage() {
  const t = useT(dict)
  const { lang } = useLang()
  const toast = useToast()

  const [turns, setTurns] = useState<TurnData[]>([])
  const [streamingId, setStreamingId] = useState<number | null>(null)
  const [draft, setDraft] = useState('')

  const feedRef = useRef<HTMLDivElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  /** Поле растёт по содержимому: своё поле не пишем, работаем с готовым. */
  const grow = useCallback(() => {
    const el = boxRef.current?.querySelector('textarea')
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [])

  useEffect(grow, [draft, grow])

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight })
  }, [turns.length])

  const send = useCallback(
    (text: string) => {
      const q = text.trim()
      if (!q || streamingId !== null) return
      const id = Date.now()
      setTurns((prev) => {
        const answer = pickAnswer(q, prev.length)
        return [...prev, { id, question: q, answerId: answer.id }]
      })
      setStreamingId(id)
      setDraft('')
    },
    [streamingId],
  )

  const finish = useCallback((id: number) => {
    setStreamingId((cur) => (cur === id ? null : cur))
  }, [])

  const focusInput = () => boxRef.current?.querySelector('textarea')?.focus()

  return (
    <div className="chat">
      <div className="chat__feed" ref={feedRef} aria-label={t('ariaFeed')}>
        {turns.length === 0 ? (
          <div className="chat__empty">
            <Empty title={t('emptyTitle')}>{t('emptyBody')}</Empty>
            <div className="chat__examples">
              <Label style={{ paddingTop: 'var(--s-3)' }}>{t('examples')}</Label>
              {EXAMPLES.map((ex) => (
                <button
                  key={ex.id}
                  type="button"
                  className="chat__example"
                  onClick={() => {
                    setDraft(ex.text[lang as Lang])
                    window.requestAnimationFrame(focusInput)
                  }}
                >
                  {ex.text[lang as Lang]}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="chat__thread">
            <H2 className="visually-hidden">{t('title')}</H2>
            {turns.map((turn) => (
              <Turn
                key={turn.id}
                turn={turn}
                streaming={streamingId === turn.id}
                onDone={finish}
              />
            ))}
          </div>
        )}
      </div>

      <div className="chat__composer">
        <div className="chat__composer-inner">
          <div ref={boxRef}>
            <Textarea
              className="chat__input"
              rows={2}
              value={draft}
              aria-label={t('ariaInput')}
              placeholder={t('placeholder')}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send(draft)
                }
              }}
            />
          </div>

          <div className="chat__bar">
            <Caption tone="mute" className="chat__hint">
              {t('hint')}
            </Caption>

            <input
              ref={fileRef}
              type="file"
              className="visually-hidden"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) toast(`${t('attached')} ${f.name}`)
                e.target.value = ''
              }}
            />
            <Button variant="ghost" onClick={() => fileRef.current?.click()}>
              {t('attach')}
            </Button>
            <Button
              variant="primary"
              onClick={() => send(draft)}
              disabled={!draft.trim() || streamingId !== null}
            >
              {t('send')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
