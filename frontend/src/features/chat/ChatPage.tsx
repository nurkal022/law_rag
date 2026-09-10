import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  Button,
  Caption,
  Caret,
  Cite,
  H2,
  Label,
  Mono,
  Textarea,
  useToast,
} from '../../shared/ui'
import { useLang, useT } from '../../i18n'
import type { Dict } from '../../i18n'
import { citeCode } from '../legal/cite'
import { useVoiceInput } from './useVoiceInput'
import { EXAMPLES } from './examples'
import { dateGroup, parseAnswer } from './answer'
import { AnswerMarkdown, citeLink } from './AnswerMarkdown'
import type { Answer, ChatReply, DateGroup, HistoryItem, Seg } from './answer'
import { ApiError, api } from '../../shared/api'
import { useMe } from '../../shared/me'
import './chat.css'
import './sidebar.css'
import './bubbles.css'
import './chat.motion.css'
import { Link } from '../../shared/nav'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { withLang } from '../../i18n'

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
  voice: { ru: 'Голосовой ввод', kz: 'Дауыспен енгізу', en: 'Voice input' },
  voiceStop: { ru: 'Остановить запись', kz: 'Жазуды тоқтату', en: 'Stop recording' },
  voiceListening: { ru: 'Слушаю…', kz: 'Тыңдап тұрмын…', en: 'Listening…' },
  voiceDecoding: { ru: 'Расшифровываю…', kz: 'Мәтінге айналдырудамын…', en: 'Transcribing…' },
  voiceInsecure: {
    ru: 'Микрофон работает только по HTTPS — откройте защищённый адрес',
    kz: 'Микрофон тек HTTPS арқылы жұмыс істейді — қорғалған мекенжайды ашыңыз',
    en: 'The microphone needs HTTPS — open the secure address',
  },
  voiceDenied: {
    ru: 'Доступ к микрофону не дан',
    kz: 'Микрофонға рұқсат берілмеді',
    en: 'Microphone access was denied',
  },
  voiceEmpty: {
    ru: 'Ничего не записалось — попробуйте ещё раз',
    kz: 'Ештеңе жазылмады — қайта көріңіз',
    en: 'Nothing was recorded — try again',
  },
  voiceFailed: {
    ru: 'Не удалось расшифровать запись',
    kz: 'Жазбаны мәтінге айналдыру мүмкін болмады',
    en: 'Could not transcribe the recording',
  },
  placeholder: {
    ru: 'Спросите о чём угодно по праву РК',
    kz: 'ҚР құқығы бойынша кез келген нәрсені сұраңыз',
    en: 'Ask anything about the law of Kazakhstan',
  },
  send: { ru: 'Спросить', kz: 'Сұрау', en: 'Ask' },
  stop: { ru: 'Остановить', kz: 'Тоқтату', en: 'Stop' },
  stopped: {
    ru: 'Ответ прерван — показано то, что успело напечататься.',
    kz: 'Жауап үзілді — терілуге үлгергені көрсетілді.',
    en: 'Answer interrupted — what had been typed is shown.',
  },
  attach: { ru: 'Приложить файл', kz: 'Файл тіркеу', en: 'Attach file' },
  attached: { ru: 'Файл приложен:', kz: 'Файл тіркелді:', en: 'File attached:' },
  detach: { ru: 'Снять', kz: 'Алып тастау', en: 'Remove' },
  detachAria: {
    ru: 'Снять приложенный файл',
    kz: 'Тіркелген файлды алып тастау',
    en: 'Remove the attached file',
  },
  withFile: { ru: 'К вопросу приложен файл:', kz: 'Сұраққа файл тіркелді:', en: 'File attached to the question:' },
  hint: {
    ru: 'Enter — отправить, Shift + Enter — перенос строки',
    kz: 'Enter — жіберу, Shift + Enter — жол ауыстыру',
    en: 'Enter to send, Shift + Enter for a line break',
  },
  ariaInput: { ru: 'Текст вопроса', kz: 'Сұрақ мәтіні', en: 'Question text' },
  ariaFeed: { ru: 'Лента диалога', kz: 'Диалог таспасы', en: 'Conversation' },
  writing: { ru: 'Ответ печатается', kz: 'Жауап теріліп жатыр', en: 'Answering' },
  thinking: {
    ru: 'Ищу нормы и составляю ответ…',
    kz: 'Нормаларды іздеп, жауап құрастырып жатырмын…',
    en: 'Looking up the norms and composing the answer…',
  },
  errAsk: {
    ru: 'Не удалось получить ответ — попробуйте ещё раз',
    kz: 'Жауап алу мүмкін болмады — қайта көріңіз',
    en: 'Could not get an answer — please try again',
  },
  registerCta: { ru: 'Зарегистрироваться', kz: 'Тіркелу', en: 'Create an account' },
  loginCta: { ru: 'Войти', kz: 'Кіру', en: 'Sign in' },
  disclaimer: {
    ru: 'Ответ носит справочный характер и не заменяет консультацию юриста.',
    kz: 'Жауап анықтамалық сипатта, заңгер кеңесін алмастырмайды.',
    en: 'The answer is for reference and does not replace advice from a lawyer.',
  },

  convs: { ru: 'Диалоги', kz: 'Диалогтар', en: 'Conversations' },
  gToday: { ru: 'Сегодня', kz: 'Бүгін', en: 'Today' },
  gWeek: { ru: 'На этой неделе', kz: 'Осы аптада', en: 'This week' },
  gEarlier: { ru: 'Ранее', kz: 'Бұрын', en: 'Earlier' },
  search: { ru: 'Поиск по диалогам', kz: 'Диалогтардан іздеу', en: 'Search conversations' },
  nothing: { ru: 'Ничего не найдено', kz: 'Ештеңе табылмады', en: 'Nothing found' },
  sections: { ru: 'Разделы', kz: 'Бөлімдер', en: 'Sections' },
  secDocs: { ru: 'Документы', kz: 'Құжаттар', en: 'Documents' },
  secContracts: { ru: 'Договоры', kz: 'Шарттар', en: 'Contracts' },
  secLaws: { ru: 'Законопроекты', kz: 'Заң жобалары', en: 'Draft laws' },
  secAnalytics: { ru: 'Аналитика', kz: 'Талдау', en: 'Analytics' },
  newTitle: { ru: 'Новый диалог', kz: 'Жаңа диалог', en: 'New conversation' },
  convsAria: { ru: 'Прошлые диалоги', kz: 'Өткен диалогтар', en: 'Past conversations' },
  convsShow: { ru: 'Показать диалоги', kz: 'Диалогтарды көрсету', en: 'Show conversations' },
  convsHide: { ru: 'Скрыть диалоги', kz: 'Диалогтарды жасыру', en: 'Hide conversations' },
  convNew: { ru: 'Новый диалог', kz: 'Жаңа диалог', en: 'New conversation' },
  today: { ru: 'сегодня', kz: 'бүгін', en: 'today' },
}

/* ---------- Данные диалогов ---------- */

interface TurnData {
  id: number
  question: string
  /** Ответ сервера; пока его нет — вопрос в работе. */
  answer?: Answer
  /** Вместо ответа: код и текст ошибки. guest_limit — предложение войти. */
  error?: { code: string; message: string }
  attachment?: string
}

interface Conv {
  id: string
  title: string
  group: DateGroup
  turns: TurnData[]
}

const DRAFT_ID = 'draft'

/**
 * История сессии с сервера — по записи на вопрос, свежие сверху. Сервер держит
 * одну ленту на сессию, поэтому «диалог» в колонке — это один вопрос с ответом;
 * новые вопросы в открытом диалоге дописываются к нему на экране.
 */
function fromHistory(items: HistoryItem[]): Conv[] {
  return items
    .slice()
    .reverse()
    .map((h) => ({
      id: `h${h.id}`,
      title: h.user_query,
      group: dateGroup(h.created_at),
      turns: [{ id: h.id, question: h.user_query, answer: parseAnswer(h.ai_response, h.sources ?? []) }],
    }))
}

/* ---------- Стриминг: разбор ответа на единицы вывода ---------- */

type Unit = { word: string } | { cite: string }

const STEP_MS = 30
/** Верхняя граница времени набора ответа любой длины. */
const TYPE_MAX_MS = 7000

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

function toPlain(units: Unit[]): string {
  return units.map((u) => ('cite' in u ? u.cite : u.word)).join('')
}

/** Напечатанная часть ответа как markdown: координаты — ссылками для <AnswerMarkdown>. */
function toMarkdown(units: Unit[]): string {
  return units.map((u) => ('cite' in u ? citeLink(u.cite) : u.word)).join('')
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

/* ---------- Одна пара «вопрос — ответ» ---------- */

interface TurnProps {
  turn: TurnData
  streaming: boolean
  onDone: (id: number) => void
}

/**
 * Три состояния набора:
 *   typing  — идёт стриминг;
 *   cut     — стриминг прерван кнопкой «Остановить», остаётся напечатанное;
 *   done    — ответ показан целиком.
 */
type Phase = 'typing' | 'cut' | 'done'

function Turn({ turn, streaming, onDone }: TurnProps) {
  const t = useT(dict)
  const { lang } = useLang()
  const toast = useToast()
  const reduced = useReducedMotion()
  const [open, setOpen] = useState(false)
  const sourcesId = useId()

  const answer = turn.answer
  const segs = useMemo<Seg[]>(() => answer?.segs ?? [], [answer])
  const units = useMemo(() => toUnits(segs), [segs])

  const [shown, setShown] = useState(() => (streaming ? 0 : units.length))
  const [phase, setPhase] = useState<Phase>(() => (streaming ? 'typing' : 'done'))

  useEffect(() => {
    if (phase !== 'typing') return
    // Ответа ещё нет — набирать нечего; эффект перезапустится, когда он придёт.
    if (!answer) return
    // Уважение к «меньше движения»: ответ выводится целиком, без набора
    if (reduced) {
      setShown(units.length)
      setPhase('done')
      onDone(turn.id)
      return
    }
    // Развёрнутый ответ — до тысячи слов; по слову за тик он печатался бы
    // полминуты. Шаг растёт так, чтобы набор уложился примерно в TYPE_MAX_MS.
    const perTick = Math.max(1, Math.ceil(units.length / (TYPE_MAX_MS / STEP_MS)))
    let i = 0
    const timer = window.setInterval(() => {
      i = Math.min(i + perTick, units.length)
      setShown(i)
      if (i >= units.length) {
        window.clearInterval(timer)
        setPhase('done')
        onDone(turn.id)
      }
    }, STEP_MS)
    return () => window.clearInterval(timer)
  }, [phase, reduced, units, turn.id, onDone, answer])

  /* Кнопка «Остановить» снимает признак стриминга у родителя: набор
     прекращается, а напечатанное остаётся на экране. */
  useEffect(() => {
    if (!streaming && phase === 'typing') setPhase('cut')
  }, [streaming, phase])

  const openCite = useCallback((code: string) => toast(code), [toast])

  const visible = phase === 'done' ? units : units.slice(0, shown)
  const busy = phase === 'typing'

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(toPlain(visible))
      toast(t('copied'), 'ok')
    } catch {
      toast(t('copyFailed'), 'err')
    }
  }

  const qText = turn.question

  return (
    <article className="chat__turn enter">
      {/* Реплика человека — пузырём справа; штампы «ВЫ» и «TURA» убраны:
          в разговоре и так видно, кто говорит. */}
      <div className="msg msg--you">
        <div className="msg__bubble">
          {qText}
          {turn.attachment ? (
            <span className="chat-ask__file">
              {t('withFile')} {turn.attachment}
            </span>
          ) : null}
        </div>
      </div>

      {turn.error ? (
        <div className="chat__answer chat__answer--err t-legal" role="alert">
          <span className="tone-err">{turn.error.message}</span>
          {turn.error.code === 'guest_limit' ? (
            <span className="chat__cta">
              <Link to="/register" className="btn btn--primary">
                {t('registerCta')}
              </Link>
              <a href="/login?next=/chat" className="btn btn--ghost">
                {t('loginCta')}
              </a>
            </span>
          ) : null}
        </div>
      ) : !answer ? (
        <div className="chat__answer t-legal" aria-busy="true" aria-live="polite">
          <Caption tone="mute" as="p" role="status">
            {phase === 'cut' ? t('stopped') : t('thinking')}
          </Caption>
          {phase === 'cut' ? null : <Caret />}
        </div>
      ) : (
        <div
          className="chat__answer t-legal"
          aria-busy={busy || undefined}
          aria-live={busy ? 'polite' : undefined}
        >
          <AnswerMarkdown text={toMarkdown(visible)} onCite={openCite} />
          {busy ? <Caret /> : null}
        </div>
      )}

      {answer && !busy ? (
        <>
          {phase === 'cut' ? (
            <Caption tone="mute" className="chat-stopped" role="status">
              {t('stopped')}
            </Caption>
          ) : null}

          {answer.sources.length ? (
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
            {open ? (
              <div id={sourcesId} className="unfold">
                {answer.sources.map((s) => (
                  <div className="chat__source" key={s.code}>
                    <div className="chat__source-head">
                      <span className="chat__source-doc">{s.doc}</span>
                      <Cite code={citeCode(s.code, lang)} onClick={() => openCite(citeCode(s.code, lang))} />
                    </div>
                    <div className="chat__source-text t-legal">{s.excerpt}</div>
                  </div>
                ))}
              </div>
            ) : null}
          </section>
          ) : null}

          <div className="chat__acts">
            <Button variant="ghost" onClick={copy}>
              {t('copy')}
            </Button>
          </div>
        </>
      ) : answer && busy ? (
        <Caption tone="mute" as="p" style={{ marginTop: 'var(--s-3)' }} role="status">
          {t('writing')}
        </Caption>
      ) : null}
    </article>
  )
}

/* ---------- Экран ---------- */

export function ChatPage() {
  const toast = useToast()
  const t = useT(dict)
  const { lang } = useLang()

  const [convs, setConvs] = useState<Conv[]>([])
  const me = useMe()
  // Вопросы, прерванные кнопкой «Остановить» до ответа: пришедший позже ответ
  // не должен внезапно допечататься поверх «прервано».
  const cancelled = useRef<Set<number>>(new Set())

  useEffect(() => {
    let alive = true
    api
      .get<{ history: HistoryItem[] }>('/api/history')
      .then((r) => {
        if (!alive) return
        // История подкладывается под то, что уже спросили на этом экране
        setConvs((prev) => [...prev, ...fromHistory(r.history ?? [])])
      })
      .catch(() => {
        /* без истории лента всё равно работает */
      })
    return () => {
      alive = false
    }
  }, [])
  const { id: routeId } = useParams()
  const navigate = useNavigate()
  const activeId = routeId ?? DRAFT_ID
  const [streamingId, setStreamingId] = useState<number | null>(null)
  const [search, setSearch] = useSearchParams()
  // Вопрос, заданный с обложки главной, подставляется в поле и сразу
  // убирается из адреса — иначе он вернётся при любой перезагрузке.
  const [draft, setDraft] = useState(() => search.get('q') ?? '')
  const [attachment, setAttachment] = useState<string | null>(null)
  const [listOpen, setListOpen] = useState(false)
  const [query, setQuery] = useState('')

  const feedRef = useRef<HTMLDivElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const active = convs.find((c) => c.id === activeId)
  const turns = active?.turns ?? []

  /** Поле растёт по содержимому: своё поле не пишем, работаем с готовым. */
  const grow = useCallback(() => {
    const el = boxRef.current?.querySelector('textarea')
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [])

  useEffect(grow, [draft, grow])

  useEffect(() => {
    if (!search.get('q')) return
    const next = new URLSearchParams(search)
    next.delete('q')
    setSearch(next, { replace: true })
  }, [search, setSearch])

  useEffect(() => {
    // На пустом диалоге не прокручиваем: иначе приветствие уезжает за верхний
    // край — на узком экране от него оставался один подзаголовок.
    if (turns.length === 0) {
      feedRef.current?.scrollTo({ top: 0 })
      return
    }
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight })
  }, [turns.length, activeId])

  /** Точечная правка одной реплики в любом диалоге. */
  const patchTurn = useCallback((id: number, patch: Partial<TurnData>) => {
    setConvs((prev) =>
      prev.map((c) =>
        c.turns.some((tn) => tn.id === id)
          ? { ...c, turns: c.turns.map((tn) => (tn.id === id ? { ...tn, ...patch } : tn)) }
          : c,
      ),
    )
  }, [])

  const send = useCallback(
    (value: string) => {
      const q = value.trim()
      if (!q || streamingId !== null) return
      const id = Date.now()
      const file = attachment ?? undefined
      const turn: TurnData = { id, question: q, attachment: file }

      const cur = convs.find((c) => c.id === activeId)
      if (!cur) {
        // Черновик становится настоящим диалогом: заголовок — сам вопрос
        const conv: Conv = { id: `c${id}`, title: q, group: 'today', turns: [turn] }
        setConvs((prev) => [conv, ...prev])
        navigate(withLang(`/chat/${conv.id}`, lang), { replace: true })
      } else {
        setConvs((prev) =>
          prev.map((c) => (c.id === cur.id ? { ...c, turns: [...c.turns, turn] } : c)),
        )
      }

      setStreamingId(id)
      setDraft('')
      setAttachment(null)

      api
        .post<ChatReply>('/api/chat', { query: q, use_rag: true })
        .then((r) => {
          if (cancelled.current.has(id)) return
          patchTurn(id, { answer: parseAnswer(r.answer, r.sources ?? []) })
        })
        .catch((e: unknown) => {
          if (cancelled.current.has(id)) return
          const err = e instanceof ApiError ? e : null
          patchTurn(id, {
            error: {
              code: err?.code ?? 'failed',
              message: err && err.status !== 0 ? err.message : t('errAsk'),
            },
          })
          setStreamingId((curId) => (curId === id ? null : curId))
        })
    },
    [streamingId, attachment, activeId, convs, navigate, lang, patchTurn, t],
  )

  const finish = useCallback((id: number) => {
    setStreamingId((cur) => (cur === id ? null : cur))
  }, [])

  /** Прерывание: набор останавливается, ещё не пришедший ответ — отбрасывается. */
  const stop = useCallback(() => {
    setStreamingId((cur) => {
      if (cur !== null) cancelled.current.add(cur)
      return null
    })
  }, [])

  const openConv = useCallback(
    (id: string) => {
      setStreamingId(null)
      setListOpen(false)
      // Диалог живёт в адресе: перезагрузка возвращает на место,
      // а ссылкой на переписку можно поделиться.
      navigate(withLang(id === DRAFT_ID ? '/chat' : `/chat/${id}`, lang))
    },
    [navigate, lang],
  )

  const voice = useVoiceInput({
    // Расшифровку дописываем к набранному, а не затираем его: человек мог
    // начать печатать и договорить голосом.
    onText: (text) => setDraft((prev) => (prev ? `${prev} ${text}` : text)),
    onError: (reason) => {
      const known: Record<string, string> = {
        denied: t('voiceDenied'),
        empty: t('voiceEmpty'),
        failed: t('voiceFailed'),
      }
      toast(known[reason] ?? reason, 'err')
    },
  })

  const focusInput = () => boxRef.current?.querySelector('textarea')?.focus()

  /** Диалоги, отобранные поиском и разложенные по группам. */
  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase()
    const hit = (c: Conv) => !q || c.title.toLowerCase().includes(q)
    const pick = (g: Conv['group']) => convs.filter((c) => c.group === g && hit(c))
    return [
      { id: 'today', label: t('gToday'), items: pick('today') },
      { id: 'week', label: t('gWeek'), items: pick('week') },
      { id: 'earlier', label: t('gEarlier'), items: pick('earlier') },
    ].filter((g) => g.items.length > 0)
  }, [convs, query, t])

  return (
    <div className="chat-shell">
      <aside className="cs" aria-label={t('convsAria')}>
        <div className="cs__brand">
          <Link to="/" className="wordmark">
            DALEL
          </Link>
        </div>

        <Button variant="secondary" className="cs__new" onClick={() => openConv(DRAFT_ID)}>
          + {t('convNew')}
        </Button>

        <input
          className="cs__search field__control"
          type="search"
          value={query}
          placeholder={t('search')}
          aria-label={t('search')}
          onChange={(e) => setQuery(e.target.value)}
        />

        {/* На узком экране список прячется за кнопку, чтобы переписка была видна */}
        <Button
          variant="ghost"
          className="cs__toggle"
          aria-expanded={listOpen}
          onClick={() => setListOpen((v) => !v)}
        >
          {listOpen ? t('convsHide') : t('convsShow')} · {convs.length}
        </Button>

        <nav className={listOpen ? 'cs__list' : 'cs__list cs__list--off'}>
          {grouped.length === 0 ? (
            <Caption tone="mute" className="cs__nothing">
              {t('nothing')}
            </Caption>
          ) : (
            grouped.map((g) => (
              <div className="cs__group" key={g.id}>
                <Label className="cs__group-label">{g.label}</Label>
                {g.items.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={c.id === activeId ? 'cs__conv cs__conv--on' : 'cs__conv'}
                    aria-current={c.id === activeId ? 'true' : undefined}
                    onClick={() => openConv(c.id)}
                  >
                    <span className="cs__conv-title">{c.title}</span>
                  </button>
                ))}
              </div>
            ))
          )}
        </nav>

        <div className="cs__foot">
          <Label className="cs__group-label">{t('sections')}</Label>
          <Link to="/workspace" className="cs__sec">
            {t('secDocs')}
          </Link>
          <Link to="/contracts" className="cs__sec">
            {t('secContracts')}
          </Link>
          <Link to="/laws" className="cs__sec">
            {t('secLaws')}
          </Link>
          <Link to="/analytics" className="cs__sec">
            {t('secAnalytics')}
          </Link>
          {me?.user ? (
            <div className="cs__user" title={me.user.email}>
              {me.user.full_name?.trim() || me.user.email}
            </div>
          ) : me && !me.authenticated ? (
            <a href="/login?next=/chat" className="cs__user cs__user--link">
              {t('loginCta')}
            </a>
          ) : null}
        </div>
      </aside>

      <div className="chat">
        {/* Полоса с названием диалога: без неё непонятно, где ты находишься,
            когда список слева свёрнут. */}
        <div className="chat__top">
          <h1 className="chat__title t-h3">
            {active ? active.title : t('newTitle')}
          </h1>
        </div>

        <div className="chat__feed" ref={feedRef} aria-label={t('ariaFeed')}>
          {turns.length === 0 ? (
            <div className="chat__empty enter">
              <div className="chat__greeting">
                <h2 className="t-display">{t('emptyTitle')}</h2>
                <p className="t-legal tone-mute">{t('emptyBody')}</p>
              </div>
              <div className="chat__examples">
                <Label style={{ paddingTop: 'var(--s-3)' }}>{t('examples')}</Label>
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex.id}
                    type="button"
                    className="chat__example"
                    onClick={() => {
                      setDraft(ex.text[lang])
                      window.requestAnimationFrame(focusInput)
                    }}
                  >
                    {ex.text[lang]}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Ключ по диалогу: при переключении лента подставляется через .swap */
            <div className="chat__thread swap" key={activeId}>
              <H2 className="visually-hidden">{t('title')}</H2>
              {turns.map((turn) => (
                <Turn key={turn.id} turn={turn} streaming={streamingId === turn.id} onDone={finish} />
              ))}
            </div>
          )}
        </div>

        <div className="chat__composer">
          <div className="chat__composer-inner">
            {attachment ? (
              <div className="chat-attach enter-soft">
                <Caption tone="mute">{t('attached')}</Caption>
                <Mono tone="ink2" className="chat-attach__name">
                  {attachment}
                </Mono>
                <Button variant="ghost" aria-label={t('detachAria')} onClick={() => setAttachment(null)}>
                  {t('detach')}
                </Button>
              </div>
            ) : null}

            <div className="bar" ref={boxRef}>
              <input
                ref={fileRef}
                type="file"
                className="visually-hidden"
                tabIndex={-1}
                aria-hidden="true"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) setAttachment(f.name)
                  e.target.value = ''
                }}
              />
              <button
                type="button"
                className="bar__attach"
                aria-label={t('attach')}
                title={t('attach')}
                onClick={() => fileRef.current?.click()}
              >
                <svg viewBox="0 0 18 18" width="16" height="16" aria-hidden="true" focusable="false">
                  <path d="M9 2.5v13M2.5 9h13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>

              <Textarea
                className="chat__input bar__field"
                rows={1}
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

              <button
                type="button"
                className={
                  voice.state === 'recording' ? 'bar__mic bar__mic--live' : 'bar__mic'
                }
                aria-label={voice.state === 'recording' ? t('voiceStop') : t('voice')}
                title={voice.state === 'recording' ? t('voiceStop') : t('voice')}
                aria-pressed={voice.state === 'recording'}
                disabled={voice.state === 'transcribing'}
                onClick={() => (voice.supported ? voice.toggle() : toast(t('voiceInsecure'), 'err'))}
              >
                <svg viewBox="0 0 16 22" width="15" height="18" aria-hidden="true" focusable="false">
                  <rect x="5" y="1" width="6" height="11" rx="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
                  <path d="M1.5 9.5a6.5 6.5 0 0 0 13 0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  <path d="M8 16.5V20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>

              {streamingId !== null ? (
                <button type="button" className="bar__go bar__go--stop" onClick={stop} aria-label={t('stop')}>
                  ■
                </button>
              ) : (
                <button
                  type="button"
                  className="bar__go"
                  onClick={() => send(draft)}
                  disabled={!draft.trim()}
                  aria-label={t('send')}
                >
                  ↑
                </button>
              )}
            </div>

            <Caption tone="mute" className="chat__hint">
              {voice.state === 'recording'
                ? t('voiceListening')
                : voice.state === 'transcribing'
                  ? t('voiceDecoding')
                  : t('hint')}
            </Caption>
          </div>
        </div>
      </div>
    </div>
  )
}
