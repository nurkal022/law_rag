import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, DragEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Link } from '../../shared/nav'
import {
  Body,
  Button,
  Caption,
  Chip,
  Display,
  Empty,
  Input,
  Label,
  Select,
  Table,
  TableTitle,
  UIText,
  useToast,
} from '../../shared/ui'
import { useLang, useT } from '../../i18n'
import type { Dict } from '../../i18n'
import { api, errorMessage } from '../../shared/api'
import { LoadFailure, useLoader } from '../drafts/shared'
import { SectionTabs } from './SectionTabs'
import { upload } from './upload'
import {
  Highlight,
  StatusMark,
  WsSkeleton,
  anyPending,
  localeOf,
  useSize,
  useSourceLabel,
  whenShort,
  wsDict,
} from './common'
import type {
  DocumentResponse,
  DocumentsResponse,
  FoundDocument,
  MattersResponse,
  SearchResponse,
  WsDocument,
} from './types'
import './workspace.css'
import './workspace.motion.css'
import './workspace.pages.css'

/**
 * Библиотека документов.
 *
 * Главное на экране — не список, а состояние каждого документа. Файл принят
 * сервером сразу, а разбор текста идёт фоном и может не удаться: скан без
 * распознавания, недоступный сервис. Поэтому строка со сбоем показывает
 * причину целиком, а не значок: в причине написано, что делать. И поэтому же
 * такой документ остаётся рабочим — он открывается и скачивается, теряется
 * только поиск по его тексту.
 */

const dict: Dict = {
  title: { ru: 'Мои документы', kz: 'Менің құжаттарым', en: 'My documents' },
  subtitle: {
    ru: 'Личная библиотека: загруженные файлы и составленное в TURA',
    kz: 'Жеке кітапхана: жүктелген файлдар және TURA-да жасалғаны',
    en: 'Personal library: uploaded files and documents drafted in TURA',
  },

  drop: {
    ru: 'Перетащите PDF или DOCX — можно несколько сразу',
    kz: 'PDF немесе DOCX сүйреп әкеліңіз — бірнешеуін бірден болады',
    en: 'Drag PDF or DOCX files here — several at once is fine',
  },
  dropOver: { ru: 'Отпустите файлы', kz: 'Файлдарды жіберіңіз', en: 'Drop the files' },
  choose: { ru: 'Выбрать файлы', kz: 'Файлдарды таңдау', en: 'Choose files' },
  toMatter: { ru: 'Попадут в дело', kz: 'Іске түседі', en: 'They will go to matter' },

  upSending: { ru: 'отправляется', kz: 'жіберілуде', en: 'sending' },
  upDone: { ru: 'принят, идёт обработка', kz: 'қабылданды, өңделуде', en: 'accepted, processing' },
  upDup: {
    ru: 'этот файл уже в библиотеке',
    kz: 'бұл файл кітапханада бар',
    en: 'this file is already in the library',
  },
  upClear: { ru: 'Скрыть', kz: 'Жасыру', en: 'Hide' },
  upFail: { ru: 'Файл не принят', kz: 'Файл қабылданбады', en: 'The file was not accepted' },

  fMatter: { ru: 'Дело', kz: 'Іс', en: 'Matter' },
  fSource: { ru: 'Источник', kz: 'Дереккөз', en: 'Source' },
  fStatus: { ru: 'Состояние', kz: 'Күйі', en: 'State' },
  all: { ru: 'Все', kz: 'Барлығы', en: 'All' },
  search: { ru: 'Поиск по тексту документов', kz: 'Құжат мәтіні бойынша іздеу', en: 'Search document text' },
  searchScope: {
    ru: 'Поиск идёт по всей библиотеке, фильтры к нему не применяются.',
    kz: 'Іздеу бүкіл кітапхана бойынша жүреді, сүзгілер қолданылмайды.',
    en: 'Search covers the whole library; the filters do not apply to it.',
  },
  found: { ru: 'Найдено документов', kz: 'Табылған құжаттар', en: 'Documents found' },
  searchShort: {
    ru: 'Наберите хотя бы два знака.',
    kz: 'Кемінде екі таңба теріңіз.',
    en: 'Type at least two characters.',
  },
  onlyIndexed: {
    ru: 'Поиск идёт по обработанным документам. Те, что ещё обрабатываются или не попали в поиск, здесь не появятся.',
    kz: 'Іздеу өңделген құжаттар бойынша жүреді. Әлі өңделіп жатқандар мұнда шықпайды.',
    en: 'Search covers processed documents only; those still processing or not searchable will not appear.',
  },

  colDoc: { ru: 'Документ', kz: 'Құжат', en: 'Document' },
  colMatter: { ru: 'Дело', kz: 'Іс', en: 'Matter' },
  colSize: { ru: 'Размер', kz: 'Көлемі', en: 'Size' },
  colSource: { ru: 'Источник', kz: 'Дереккөз', en: 'Source' },
  colStatus: { ru: 'Состояние', kz: 'Күйі', en: 'State' },
  colDate: { ru: 'Загружен', kz: 'Жүктелген', en: 'Added' },
  colActs: { ru: 'Действия', kz: 'Әрекеттер', en: 'Actions' },

  failStill: {
    ru: 'Документ открывается и скачивается как обычно — он только не участвует в поиске.',
    kz: 'Құжат әдеттегідей ашылады және жүктеледі — тек іздеуге қатыспайды.',
    en: 'The document still opens and downloads as usual — it is only left out of search.',
  },
  reindex: { ru: 'Переиндексировать', kz: 'Қайта индекстеу', en: 'Re-index' },
  reindexed: {
    ru: 'Обработка запущена заново',
    kz: 'Өңдеу қайта басталды',
    en: 'Processing has been restarted',
  },

  remove: { ru: 'Удалить', kz: 'Жою', en: 'Delete' },
  removeAsk: { ru: 'Удалить безвозвратно?', kz: 'Қайтарымсыз жойылсын ба?', en: 'Delete permanently?' },
  removeYes: { ru: 'Да, удалить', kz: 'Иә, жою', en: 'Yes, delete' },
  cancel: { ru: 'Отмена', kz: 'Болдырмау', en: 'Cancel' },
  removed: { ru: 'Документ удалён', kz: 'Құжат жойылды', en: 'Document deleted' },
  failRemove: { ru: 'Удалить не удалось', kz: 'Жою мүмкін болмады', en: 'Could not delete' },

  emptyTitle: { ru: 'Библиотека пуста', kz: 'Кітапхана бос', en: 'The library is empty' },
  emptyBody: {
    ru: 'Загрузите договор, устав или доверенность — TURA разберёт текст, и по документу можно будет искать и задавать вопросы.',
    kz: 'Шартты, жарғыны немесе сенімхатты жүктеңіз — TURA мәтінді талдайды, содан кейін құжаттан іздеуге және сұрақ қоюға болады.',
    en: 'Upload a contract, charter or power of attorney — TURA parses the text so you can search it and ask questions.',
  },
  emptyFilterTitle: { ru: 'Ничего не найдено', kz: 'Ештеңе табылмады', en: 'Nothing found' },
  emptyFilterBody: {
    ru: 'Под выбранные условия документов нет. Снимите фильтры или загрузите файл.',
    kz: 'Таңдалған шарттарға сай құжат жоқ. Сүзгілерді алып тастаңыз немесе файл жүктеңіз.',
    en: 'No documents match the filters. Clear them or upload a file.',
  },
  emptySearchTitle: { ru: 'Ничего не нашлось', kz: 'Ештеңе табылмады', en: 'No matches' },
  clearFilters: { ru: 'Снять фильтры', kz: 'Сүзгілерді алу', en: 'Clear filters' },
}

/** Состояние одной отправки: показывается, пока файл идёт и сразу после. */
interface Sending {
  key: number
  name: string
  percent: number
  state: 'sending' | 'done' | 'duplicate' | 'error'
  message?: string
}

const POLL_MS = 6000

export function LibraryPage() {
  const t = useT(dict)
  const tw = useT(wsDict)
  const { lang } = useLang()
  const locale = localeOf(lang)
  const size = useSize()
  const sourceLabel = useSourceLabel()
  const toast = useToast()

  const [params, setParams] = useSearchParams()
  const matterParam = params.get('matter') ?? ''
  const statusParam = params.get('status') ?? ''
  const sourceParam = params.get('source') ?? ''
  const q = params.get('q') ?? ''

  const [term, setTerm] = useState(q)
  const [docs, setDocs] = useState<WsDocument[] | null>(null)
  const [docsError, setDocsError] = useState<unknown>(null)
  const [sending, setSending] = useState<Sending[]>([])
  const [over, setOver] = useState(false)
  const [confirmId, setConfirmId] = useState<number | null>(null)
  const [flash, setFlash] = useState<number[]>([])

  const fileRef = useRef<HTMLInputElement>(null)
  /* dragleave приходит и от дочерних узлов, поэтому «над областью» считается
     счётчиком входов и выходов, а не последним событием. */
  const dragDepth = useRef(0)
  const sendKey = useRef(0)
  const timers = useRef<number[]>([])

  useEffect(
    () => () => {
      for (const id of timers.current) window.clearTimeout(id)
    },
    [],
  )

  const matters = useLoader<MattersResponse>(
    () => api.get<MattersResponse>('/workspace/matters?archived=1'),
    [],
  )
  const matterList = useMemo(() => matters.data?.matters ?? [], [matters.data])
  const matterName = useCallback(
    (id: number | null) => matterList.find((m) => m.id === id)?.title ?? null,
    [matterList],
  )

  const query = useMemo(() => {
    const search = new URLSearchParams()
    if (matterParam) search.set('matter_id', matterParam)
    if (statusParam) search.set('status', statusParam)
    if (sourceParam) search.set('source', sourceParam)
    const s = search.toString()
    return s ? `?${s}` : ''
  }, [matterParam, statusParam, sourceParam])

  /**
   * Реестр перечитывается сам, пока хоть один документ обрабатывается.
   * Обновление молчаливое: подменять таблицу заглушкой раз в шесть секунд —
   * значит мигать экраном под руками у читающего.
   */
  const fetchDocs = useCallback(
    async (silent = false) => {
      try {
        const res = await api.get<DocumentsResponse>(`/workspace/documents${query}`)
        setDocs(res.documents)
        setDocsError(null)
      } catch (e) {
        if (!silent) {
          setDocs(null)
          setDocsError(e)
        }
      }
    },
    [query],
  )

  useEffect(() => {
    setDocs(null)
    setDocsError(null)
    void fetchDocs()
  }, [fetchDocs])

  useEffect(() => {
    if (!docs || !anyPending(docs)) return
    const id = window.setInterval(() => void fetchDocs(true), POLL_MS)
    return () => window.clearInterval(id)
  }, [docs, fetchDocs])

  /* Поиск живёт в адресе: найденное можно оставить открытым и вернуться. */
  useEffect(() => {
    if (term === q) return
    const id = window.setTimeout(() => {
      const next = new URLSearchParams(params)
      if (term.trim()) next.set('q', term.trim())
      else next.delete('q')
      setParams(next, { replace: true })
    }, 350)
    return () => window.clearTimeout(id)
  }, [term, q, params, setParams])

  const searching = q.trim().length >= 2
  const found = useLoader<SearchResponse>(
    () =>
      searching
        ? api.get<SearchResponse>(`/workspace/search?q=${encodeURIComponent(q.trim())}`)
        : Promise.resolve({ query: '', documents: [] as FoundDocument[] }),
    [q, searching],
  )

  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params)
      if (value) next.set(key, value)
      else next.delete(key)
      setParams(next, { replace: true })
      setConfirmId(null)
    },
    [params, setParams],
  )

  const markFlash = useCallback((id: number) => {
    setFlash((prev) => (prev.includes(id) ? prev : [...prev, id]))
    const timer = window.setTimeout(() => setFlash((prev) => prev.filter((x) => x !== id)), 4000)
    timers.current.push(timer)
  }, [])

  const accept = useCallback(
    (files: FileList | null) => {
      const list = files ? Array.from(files) : []
      if (!list.length) return

      for (const file of list) {
        const key = ++sendKey.current
        setSending((prev) => [...prev, { key, name: file.name, percent: 0, state: 'sending' }])

        const form = new FormData()
        form.append('file', file)
        if (/^\d+$/.test(matterParam)) form.append('matter_id', matterParam)

        upload<DocumentResponse>('/workspace/documents', form, (percent) =>
          setSending((prev) => prev.map((s) => (s.key === key ? { ...s, percent } : s))),
        )
          .then((res) => {
            setSending((prev) =>
              prev.map((s) =>
                s.key === key
                  ? { ...s, percent: 100, state: res.duplicate ? 'duplicate' : 'done' }
                  : s,
              ),
            )
            markFlash(res.document.id)
            void fetchDocs(true)
            /* Успех сам убирается из списка: он уже виден строкой в реестре,
               и держать про него отдельную запись незачем. Отказ остаётся. */
            const timer = window.setTimeout(
              () => setSending((prev) => prev.filter((s) => s.key !== key)),
              res.duplicate ? 7000 : 4000,
            )
            timers.current.push(timer)
          })
          .catch((e) => {
            setSending((prev) =>
              prev.map((s) =>
                s.key === key
                  ? { ...s, state: 'error', message: errorMessage(e, t('upFail')) }
                  : s,
              ),
            )
          })
      }
    },
    [matterParam, markFlash, fetchDocs, t],
  )

  const reindex = useCallback(
    async (doc: WsDocument) => {
      setDocs((prev) =>
        prev
          ? prev.map((d) =>
              d.id === doc.id ? { ...d, status: 'pending', status_error: null } : d,
            )
          : prev,
      )
      try {
        await api.post(`/workspace/documents/${doc.id}/reindex`)
        toast(`${doc.title} — ${t('reindexed')}`)
      } catch (e) {
        toast(errorMessage(e, t('upFail')), 'err')
        void fetchDocs(true)
      }
    },
    [fetchDocs, t, toast],
  )

  const remove = useCallback(
    async (doc: WsDocument) => {
      setConfirmId(null)
      try {
        await api.del(`/workspace/documents/${doc.id}`)
        setDocs((prev) => (prev ? prev.filter((d) => d.id !== doc.id) : prev))
        toast(`${t('removed')}: ${doc.title}`, 'ok')
      } catch (e) {
        toast(errorMessage(e, t('failRemove')), 'err')
      }
    },
    [t, toast],
  )

  const onDragEnter = (e: DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer?.types?.includes('Files')) return
    e.preventDefault()
    dragDepth.current += 1
    setOver(true)
  }
  const onDragLeave = () => {
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setOver(false)
  }
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    dragDepth.current = 0
    setOver(false)
    accept(e.dataTransfer?.files ?? null)
  }

  const filtered = Boolean(matterParam || statusParam || sourceParam)
  const rows = docs ?? []

  return (
    <div
      className={over ? 'page ws-page ws-page--over' : 'page ws-page'}
      onDragEnter={onDragEnter}
      onDragOver={(e) => {
        if (e.dataTransfer?.types?.includes('Files')) e.preventDefault()
      }}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <SectionTabs />

      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.docx"
        multiple
        className="visually-hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          accept(e.currentTarget.files)
          e.currentTarget.value = ''
        }}
      />

      <div className="page__head">
        <div className="page__title">
          <Display>{t('title')}</Display>
          <Body tone="mute">{t('subtitle')}</Body>
        </div>
      </div>

      <div className={over ? 'ws-drop ws-drop--over' : 'ws-drop'}>
        <div className="ws-drop__text">
          <Body tone="mute" style={{ margin: 0 }}>
            {over ? t('dropOver') : t('drop')}
          </Body>
          {/^\d+$/.test(matterParam) && matterName(Number(matterParam)) ? (
            <Caption tone="mute">
              {t('toMatter')}: {matterName(Number(matterParam))}
            </Caption>
          ) : null}
        </div>
        <Button variant="secondary" onClick={() => fileRef.current?.click()}>
          {t('choose')}
        </Button>
      </div>

      {sending.length ? (
        <ul className="ws-uploads">
          {sending.map((s) => (
            <li key={s.key} className="ws-upload swap">
              <div className="ws-upload__head">
                <UIText>{s.name}</UIText>
                <Caption tone={s.state === 'error' ? 'err' : 'mute'}>
                  {s.state === 'sending'
                    ? `${t('upSending')} · ${s.percent}%`
                    : s.state === 'done'
                      ? t('upDone')
                      : s.state === 'duplicate'
                        ? t('upDup')
                        : s.message}
                </Caption>
              </div>
              {s.state === 'sending' ? (
                <div className="ws-upload__track">
                  <div className="ws-upload__bar" style={{ width: `${s.percent}%` }} />
                </div>
              ) : (
                <Button
                  variant="ghost"
                  onClick={() => setSending((prev) => prev.filter((x) => x.key !== s.key))}
                >
                  <Caption>{t('upClear')}</Caption>
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="ws-filters">
        <Select
          label={t('fMatter')}
          value={matterParam}
          onChange={(e) => setParam('matter', e.currentTarget.value)}
        >
          <option value="">{t('all')}</option>
          <option value="none">{tw('noMatter')}</option>
          {matterList.map((m) => (
            <option key={m.id} value={String(m.id)}>
              {m.title}
            </option>
          ))}
        </Select>

        <Select
          label={t('fSource')}
          value={sourceParam}
          onChange={(e) => setParam('source', e.currentTarget.value)}
        >
          <option value="">{t('all')}</option>
          <option value="upload">{tw('srcUpload')}</option>
          <option value="contract">{tw('srcContract')}</option>
          <option value="law_project">{tw('srcLawProject')}</option>
          <option value="chat">{tw('srcChat')}</option>
        </Select>

        <div className="ws-filters__chips">
          <Label as="div">{t('fStatus')}</Label>
          <div className="ws-chiprow">
            <Chip active={!statusParam} onClick={() => setParam('status', '')}>
              {t('all')}
            </Chip>
            <Chip active={statusParam === 'indexed'} onClick={() => setParam('status', 'indexed')}>
              {tw('stIndexed')}
            </Chip>
            <Chip active={statusParam === 'pending'} onClick={() => setParam('status', 'pending')}>
              {tw('stPending')}
            </Chip>
            <Chip active={statusParam === 'failed'} onClick={() => setParam('status', 'failed')}>
              {tw('stFailed')}
            </Chip>
          </div>
        </div>

        <div className="ws-search">
          <Input
            type="search"
            value={term}
            label={t('search')}
            placeholder={t('search')}
            hint={term.trim() && !searching ? t('searchShort') : undefined}
            onChange={(e) => setTerm(e.currentTarget.value)}
          />
        </div>
      </div>

      {searching ? (
        <SearchResults
          state={found}
          query={q.trim()}
          matterName={matterName}
          onClear={() => {
            setTerm('')
            setParam('q', '')
          }}
        />
      ) : docsError ? (
        <div className="ws-state">
          <LoadFailure error={docsError} onRetry={() => void fetchDocs()} />
        </div>
      ) : docs === null ? (
        <WsSkeleton rows={7} />
      ) : rows.length === 0 ? (
        <div className="ws-state">
          <Empty
            title={filtered ? t('emptyFilterTitle') : t('emptyTitle')}
            action={
              filtered ? (
                <Button
                  onClick={() => {
                    const next = new URLSearchParams(params)
                    next.delete('matter')
                    next.delete('status')
                    next.delete('source')
                    setParams(next, { replace: true })
                  }}
                >
                  {t('clearFilters')}
                </Button>
              ) : (
                <Button variant="primary" onClick={() => fileRef.current?.click()}>
                  {t('choose')}
                </Button>
              )
            }
          >
            {filtered ? t('emptyFilterBody') : t('emptyBody')}
          </Empty>
        </div>
      ) : (
        <Table className="ws-registry">
          <thead>
            <tr>
              <th scope="col">{t('colDoc')}</th>
              <th scope="col">{t('colMatter')}</th>
              <th scope="col">{t('colSize')}</th>
              <th scope="col" className="ws-col-src">
                {t('colSource')}
              </th>
              <th scope="col" className="ws-col-status">
                {t('colStatus')}
              </th>
              <th scope="col">{t('colDate')}</th>
              <th scope="col" className="ws-col-acts">
                <span className="visually-hidden">{t('colActs')}</span>
              </th>
            </tr>
          </thead>
          <tbody key={query}>
            {rows.map((d, i) => (
              <Fragment key={d.id}>
                <tr
                  className={
                    flash.includes(d.id) ? 'enter-item ws-row--flash' : 'enter-item'
                  }
                  style={{ '--i': i } as CSSProperties}
                >
                  <td>
                    <div className="ws-cell-doc">
                      <Link to={`/workspace/documents/${d.id}`}>
                        <TableTitle>{d.title}</TableTitle>
                      </Link>
                      {d.original_filename ? (
                        <Caption tone="mute">{d.original_filename}</Caption>
                      ) : null}
                    </div>
                  </td>
                  <td>
                    {matterName(d.matter_id) ? (
                      <UIText tone="ink2">{matterName(d.matter_id)}</UIText>
                    ) : (
                      <UIText tone="mute">{tw('dash')}</UIText>
                    )}
                  </td>
                  <td className="ws-num">
                    <Caption tone="ink2">{size(d.file_size)}</Caption>
                  </td>
                  <td className="ws-col-src">
                    <Caption tone="mute">{sourceLabel(d.source)}</Caption>
                  </td>
                  <td className="ws-col-status">
                    <div className="ws-status-cell">
                      <StatusMark status={d.status} />
                      {d.status === 'pending' ? (
                        <span className="ws-progress" aria-hidden="true">
                          <span className="ws-progress__bar" />
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="ws-num">
                    <Caption tone="ink2">{whenShort(d.created_at, locale)}</Caption>
                  </td>
                  <td className="ws-col-acts">
                    {confirmId === d.id ? (
                      <div className="ws-confirm swap">
                        <Caption tone="mute">{t('removeAsk')}</Caption>
                        <Button variant="danger" onClick={() => void remove(d)}>
                          <Caption>{t('removeYes')}</Caption>
                        </Button>
                        <Button variant="ghost" onClick={() => setConfirmId(null)}>
                          <Caption>{t('cancel')}</Caption>
                        </Button>
                      </div>
                    ) : (
                      <div className="ws-row-acts">
                        <Button
                          variant="ghost"
                          aria-label={`${t('remove')}: ${d.title}`}
                          onClick={() => setConfirmId(d.id)}
                        >
                          <Caption>{t('remove')}</Caption>
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
                {d.status === 'failed' ? (
                  <tr className="ws-note-row">
                    <td colSpan={7}>
                      <div className="ws-note">
                        <div className="ws-note__text">
                          {d.status_error ? <Body style={{ margin: 0 }}>{d.status_error}</Body> : null}
                          <Caption tone="mute">{t('failStill')}</Caption>
                        </div>
                        <Button onClick={() => void reindex(d)}>{t('reindex')}</Button>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  )
}

/**
 * Найденное показывается отрывками с подсветкой: по одному названию нельзя
 * понять, тот ли это документ, а отрывок отвечает на вопрос сразу.
 */
function SearchResults({
  state,
  query,
  matterName,
  onClear,
}: {
  state: ReturnType<typeof useLoader<SearchResponse>>
  query: string
  matterName: (id: number | null) => string | null
  onClear: () => void
}) {
  const t = useT(dict)
  const tw = useT(wsDict)

  if (state.loading) return <WsSkeleton rows={4} />
  if (state.error) {
    return (
      <div className="ws-state">
        <LoadFailure error={state.error} onRetry={state.reload} />
      </div>
    )
  }

  const items = state.data?.documents ?? []
  if (!items.length) {
    return (
      <div className="ws-state">
        <Empty title={t('emptySearchTitle')} action={<Button onClick={onClear}>{t('cancel')}</Button>}>
          {t('onlyIndexed')}
        </Empty>
      </div>
    )
  }

  return (
    <div className="ws-found">
      <div className="ws-group-head">
        <Label>{t('found')}</Label>
        <Caption tone="mute">{items.length}</Caption>
      </div>
      <Caption tone="mute">{t('searchScope')}</Caption>
      {items.map((d, i) => (
        <article key={d.id} className="ws-hitdoc enter-item" style={{ '--i': i } as CSSProperties}>
          <div className="ws-hitdoc__head">
            <Link to={`/workspace/documents/${d.id}`}>
              <TableTitle>{d.title}</TableTitle>
            </Link>
            <Caption tone="mute">
              {matterName(d.matter_id) ?? tw('noMatter')}
            </Caption>
          </div>
          {d.excerpts.map((ex) => (
            <p key={ex.chunk} className="ws-excerpt">
              <Highlight text={ex.text} query={query} />
            </p>
          ))}
        </article>
      ))}
    </div>
  )
}
