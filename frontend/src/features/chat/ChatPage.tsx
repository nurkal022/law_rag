import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Button,
  Caption,
  Caret,
  Cite,
  H2,
  Label,
  Mono,
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
import './sidebar.css'
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

/** Строка на трёх языках. */
type L10n = Record<Lang, string>

interface TurnData {
  id: number
  /** Вопрос: у прошлых диалогов заготовлен на трёх языках, у новых — как набран. */
  question: string | L10n
  answerId: string
  attachment?: string
}

interface Conv {
  id: string
  title: string | L10n
  date: L10n
  /** Группа в боковой колонке. У замоканных данных проставлена вручную. */
  group: 'today' | 'week' | 'earlier'
  turns: TurnData[]
}

function text(v: string | L10n, lang: Lang): string {
  return typeof v === 'string' ? v : v[lang]
}

/** Замоканная история — до подключения /api/chat/history. */
const PAST: Conv[] = [
  {
    id: 'c-penalty',
    title: {
      ru: 'Неустойка за просрочку оплаты без ставки в договоре',
      kz: 'Шартта мөлшерлемесіз төлемді кешіктіргені үшін тұрақсыздық айыбы',
      en: 'Penalty for late payment with no rate in the contract',
    },
    date: { ru: '4 сентября', kz: '4 қыркүйек', en: '4 September' },
    group: 'week',
    turns: [
      {
        id: 1,
        question: EXAMPLES[1].text,
        answerId: 'penalty',
      },
    ],
  },
  {
    id: 'c-limitation',
    title: {
      ru: 'Срок исковой давности по договору поставки',
      kz: 'Жеткізу шарты бойынша талап қою мерзімі',
      en: 'Limitation period for a supply contract',
    },
    date: { ru: '2 сентября', kz: '2 қыркүйек', en: '2 September' },
    group: 'week',
    turns: [
      { id: 1, question: EXAMPLES[0].text, answerId: 'limitation' },
      {
        id: 2,
        question: {
          ru: 'А если стороны подписали акт сверки — срок начинается заново?',
          kz: 'Ал тараптар салыстыру актісіне қол қойса — мерзім қайтадан басталады ма?',
          en: 'And if the parties signed a reconciliation act — does the period start afresh?',
        },
        answerId: 'limitation',
      },
    ],
  },
  {
    id: 'c-termination',
    title: {
      ru: 'Односторонний отказ от договора аренды',
      kz: 'Жалдау шартынан біржақты бас тарту',
      en: 'Unilateral withdrawal from a lease',
    },
    date: { ru: '28 августа', kz: '28 тамыз', en: '28 August' },
    group: 'earlier',
    turns: [{ id: 1, question: EXAMPLES[2].text, answerId: 'termination' }],
  },
]

const DRAFT_ID = 'draft'

/** Дата создания диалога — сразу на трёх языках, чтобы список не зависел от языка. */
function todayLabel(): L10n {
  const d = new Date()
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' }
  return {
    ru: d.toLocaleDateString('ru-RU', opts),
    kz: d.toLocaleDateString('kk-KZ', opts),
    en: d.toLocaleDateString('en-GB', opts),
  }
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

function toPlain(units: Unit[]): string {
  return units.map((u) => ('cite' in u ? u.cite : u.word)).join('')
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

  const answer = useMemo<MockAnswer>(
    () => ANSWERS.find((a) => a.id === turn.answerId) ?? ANSWERS[0],
    [turn.answerId],
  )
  const segs = answer.body[lang]
  const units = useMemo(() => toUnits(segs), [segs])

  const [shown, setShown] = useState(() => (streaming ? 0 : units.length))
  const [phase, setPhase] = useState<Phase>(() => (streaming ? 'typing' : 'done'))

  useEffect(() => {
    if (phase !== 'typing') return
    // Уважение к «меньше движения»: ответ выводится целиком, без набора
    if (reduced) {
      setShown(units.length)
      setPhase('done')
      onDone(turn.id)
      return
    }
    let i = 0
    const timer = window.setInterval(() => {
      i += 1
      setShown(i)
      if (i >= units.length) {
        window.clearInterval(timer)
        setPhase('done')
        onDone(turn.id)
      }
    }, STEP_MS)
    return () => window.clearInterval(timer)
  }, [phase, reduced, units, turn.id, onDone])

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

  const qText = text(turn.question, lang)

  return (
    <article className="chat__turn enter">
      <Label className="chat__stamp">{t('you')}</Label>
      <UIText className="chat__ask">
        {qText}
        {turn.attachment ? (
          <span className="chat-ask__file">
            {t('withFile')} {turn.attachment}
          </span>
        ) : null}
      </UIText>

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
          {phase === 'cut' ? (
            <Caption tone="mute" className="chat-stopped" role="status">
              {t('stopped')}
            </Caption>
          ) : null}

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
                      <span className="chat__source-doc">{s.doc[lang]}</span>
                      <Cite code={citeCode(s.code, lang)} onClick={() => openCite(citeCode(s.code, lang))} />
                    </div>
                    <div className="chat__source-text t-legal">{s.excerpt[lang]}</div>
                  </div>
                ))}
              </div>
            ) : null}
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

  const [convs, setConvs] = useState<Conv[]>(PAST)
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

  const send = useCallback(
    (value: string) => {
      const q = value.trim()
      if (!q || streamingId !== null) return
      const id = Date.now()
      const file = attachment ?? undefined

      const cur = convs.find((c) => c.id === activeId)

      if (!cur) {
        // Черновик становится настоящим диалогом: заголовок — сам вопрос
        const conv: Conv = {
          id: `c${id}`,
          title: q,
          date: todayLabel(),
          group: 'today',
          turns: [{ id, question: q, answerId: pickAnswer(q, 0).id, attachment: file }],
        }
        setConvs((prev) => [conv, ...prev])
        navigate(withLang(`/chat/${conv.id}`, lang), { replace: true })
      } else {
        const answer = pickAnswer(q, cur.turns.length)
        const turn: TurnData = { id, question: q, answerId: answer.id, attachment: file }
        setConvs((prev) =>
          prev.map((c) => (c.id === cur.id ? { ...c, turns: [...c.turns, turn] } : c)),
        )
      }

      setStreamingId(id)
      setDraft('')
      setAttachment(null)
    },
    [streamingId, attachment, activeId, convs],
  )

  const finish = useCallback((id: number) => {
    setStreamingId((cur) => (cur === id ? null : cur))
  }, [])

  /** Прерывание набора: Turn оставляет напечатанное и переходит в «прервано». */
  const stop = useCallback(() => setStreamingId(null), [])

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

  const focusInput = () => boxRef.current?.querySelector('textarea')?.focus()

  /** Диалоги, отобранные поиском и разложенные по группам. */
  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase()
    const hit = (c: Conv) => !q || text(c.title, lang).toLowerCase().includes(q)
    const pick = (g: Conv['group']) => convs.filter((c) => c.group === g && hit(c))
    return [
      { id: 'today', label: t('gToday'), items: pick('today') },
      { id: 'week', label: t('gWeek'), items: pick('week') },
      { id: 'earlier', label: t('gEarlier'), items: pick('earlier') },
    ].filter((g) => g.items.length > 0)
  }, [convs, query, lang, t])

  return (
    <div className="chat-shell">
      <aside className="cs" aria-label={t('convsAria')}>
        <div className="cs__brand">
          <Link to="/" className="wordmark">
            TURA
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
                    <span className="cs__conv-title">{text(c.title, lang)}</span>
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
          <div className="cs__user">н. курманов</div>
        </div>
      </aside>

      <div className="chat">
        {/* Полоса с названием диалога: без неё непонятно, где ты находишься,
            когда список слева свёрнут. */}
        <div className="chat__top">
          <h1 className="chat__title t-h3">
            {active ? text(active.title, lang) : t('newTitle')}
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
                  if (f) setAttachment(f.name)
                  e.target.value = ''
                }}
              />
              <Button variant="ghost" onClick={() => fileRef.current?.click()}>
                {t('attach')}
              </Button>
              {streamingId !== null ? (
                <Button variant="secondary" onClick={stop}>
                  {t('stop')}
                </Button>
              ) : (
                <Button variant="primary" onClick={() => send(draft)} disabled={!draft.trim()}>
                  {t('send')}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
