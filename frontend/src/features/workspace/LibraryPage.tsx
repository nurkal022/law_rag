import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  Mono,
  Status,
  Table,
  TableTitle,
  UIText,
  useToast,
} from '../../shared/ui'
import type { StatusKind } from '../../shared/ui'
import { useLang, useT } from '../../i18n'
import type { Dict, Lang } from '../../i18n'
import './workspace.css'
import './workspace.motion.css'

const dict: Dict = {
  title: { ru: 'Мои документы', kz: 'Менің құжаттарым', en: 'My documents' },
  subtitle: {
    ru: 'Личная библиотека: загруженные файлы и созданное в TURA',
    kz: 'Жеке кітапхана: жүктелген файлдар және TURA-да жасалғаны',
    en: 'Personal library: uploaded files and documents created in TURA',
  },
  upload: { ru: 'Загрузить', kz: 'Жүктеу', en: 'Upload' },
  search: { ru: 'Поиск по своим документам', kz: 'Өз құжаттарыңнан іздеу', en: 'Search your documents' },
  drop: {
    ru: 'Перетащите PDF или DOCX сюда — до 20 МБ',
    kz: 'PDF немесе DOCX файлын осында сүйреңіз — 20 МБ дейін',
    en: 'Drag a PDF or DOCX here — up to 20 MB',
  },
  dropOver: { ru: 'Отпустите файл', kz: 'Файлды жіберіңіз', en: 'Drop the file' },
  choose: { ru: 'Выбрать файл', kz: 'Файл таңдау', en: 'Choose file' },
  colDoc: { ru: 'Документ', kz: 'Құжат', en: 'Document' },
  colMatter: { ru: 'Дело', kz: 'Іс', en: 'Matter' },
  colSource: { ru: 'Источник', kz: 'Дереккөз', en: 'Source' },
  colStatus: { ru: 'Статус', kz: 'Күйі', en: 'Status' },
  all: { ru: 'Все', kz: 'Барлығы', en: 'All' },
  noMatter: { ru: 'Без дела', kz: 'Іссіз', en: 'No matter' },
  dash: { ru: '—', kz: '—', en: '—' },
  srcUpload: { ru: 'загружен', kz: 'жүктелген', en: 'uploaded' },
  srcTura: { ru: 'создан в TURA', kz: 'TURA-да жасалған', en: 'created in TURA' },
  stIndexed: { ru: 'проиндексирован', kz: 'индекстелген', en: 'indexed' },
  stPending: { ru: 'индексируется…', kz: 'индекстелуде…', en: 'indexing…' },
  stFailed: { ru: 'не распознан', kz: 'танылмады', en: 'not recognised' },
  retry: { ru: 'Повторить', kz: 'Қайталау', en: 'Retry' },
  retryAria: {
    ru: 'Переиндексировать документ',
    kz: 'Құжатты қайта индекстеу',
    en: 'Re-index document',
  },
  emptyTitle: { ru: 'Библиотека пуста', kz: 'Кітапхана бос', en: 'The library is empty' },
  emptyBody: {
    ru: 'Загрузите договор, устав или доверенность — TURA проиндексирует документ и сможет отвечать по нему со ссылками на нормы РК.',
    kz: 'Шартты, жарғыны немесе сенімхатты жүктеңіз — TURA құжатты индекстеп, ҚР нормаларына сілтемемен жауап береді.',
    en: 'Upload a contract, charter or power of attorney — TURA will index it and answer questions with references to Kazakhstan law.',
  },
  emptyFilterTitle: { ru: 'Ничего не найдено', kz: 'Ештеңе табылмады', en: 'Nothing found' },
  emptyFilterBody: {
    ru: 'В этом деле пока нет документов. Снимите фильтр или загрузите файл.',
    kz: 'Бұл істе әзірге құжат жоқ. Сүзгіні алып тастаңыз немесе файл жүктеңіз.',
    en: 'This matter has no documents yet. Clear the filter or upload a file.',
  },
  colActs: { ru: 'Действия', kz: 'Әрекеттер', en: 'Actions' },
  remove: { ru: 'Удалить', kz: 'Жою', en: 'Delete' },
  removeAria: {
    ru: 'Удалить документ из библиотеки',
    kz: 'Құжатты кітапханадан жою',
    en: 'Delete document from the library',
  },
  removeAsk: { ru: 'Удалить безвозвратно?', kz: 'Қайтарымсыз жойылсын ба?', en: 'Delete permanently?' },
  removeYes: { ru: 'Да, удалить', kz: 'Иә, жою', en: 'Yes, delete' },
  cancel: { ru: 'Отмена', kz: 'Болдырмау', en: 'Cancel' },
  removed: { ru: 'Документ удалён', kz: 'Құжат жойылды', en: 'Document deleted' },
  queued: {
    ru: 'Файл принят, идёт индексация',
    kz: 'Файл қабылданды, индекстеу жүріп жатыр',
    en: 'File accepted, indexing has started',
  },
  ready: {
    ru: 'Документ проиндексирован и доступен в диалоге',
    kz: 'Құжат индекстелді және диалогта қолжетімді',
    en: 'The document is indexed and available in the conversation',
  },
}

type Source = 'upload' | 'tura'
type DocStatus = 'indexed' | 'pending' | 'failed'

/** Строка на трёх языках. */
type L10n = Record<Lang, string>

/** Названия дел, к которым привязаны документы. Ключ — идентификатор дела. */
const MATTER_NAMES: Record<string, L10n> = {
  'astana-logistik': {
    ru: 'ТОО «Астана Логистик»',
    kz: '«Астана Логистик» ЖШС',
    en: 'Astana Logistik LLP',
  },
  'sklad-ryskulova': {
    ru: 'Аренда склада на Рыскулова',
    kz: 'Рысқұлов көшесіндегі қойманы жалға алу',
    en: 'Warehouse lease on Ryskulov street',
  },
  kaztransservis: {
    ru: 'Спор с АО «КазТрансСервис»',
    kz: '«ҚазТрансСервис» АҚ-мен дау',
    en: 'Dispute with KazTransService JSC',
  },
  hr: { ru: 'Кадровые документы', kz: 'Кадр құжаттары', en: 'HR documents' },
}

const MATTER_IDS = Object.keys(MATTER_NAMES)

interface DocRow {
  id: string
  title: L10n
  ref: string
  /** Идентификатор дела либо null, если документ ни к одному не привязан. */
  matter: string | null
  source: Source
  status: DocStatus
}

/** Замоканный реестр — до подключения /api/workspace/documents. */
const DOCS: DocRow[] = [
  {
    id: '47-p',
    title: {
      ru: 'Договор поставки № 47-П',
      kz: '№ 47-П жеткізу шарты',
      en: 'Supply contract No. 47-P',
    },
    ref: 'DOC-2026-047',
    matter: 'astana-logistik',
    source: 'upload',
    status: 'indexed',
  },
  {
    id: 'lease-sk',
    title: {
      ru: 'Договор аренды складского помещения',
      kz: 'Қойма үй-жайын жалға алу шарты',
      en: 'Warehouse lease agreement',
    },
    ref: 'DOC-2026-051',
    matter: 'sklad-ryskulova',
    source: 'upload',
    status: 'indexed',
  },
  {
    id: 'charter',
    title: {
      ru: 'Устав ТОО «Астана Логистик»',
      kz: '«Астана Логистик» ЖШС жарғысы',
      en: 'Charter of Astana Logistik LLP',
    },
    ref: 'DOC-2026-012',
    matter: 'astana-logistik',
    source: 'upload',
    status: 'indexed',
  },
  {
    id: 'poa',
    title: {
      ru: 'Доверенность на представительство в суде',
      kz: 'Сотта өкілдік етуге сенімхат',
      en: 'Power of attorney for court representation',
    },
    ref: 'DOC-2026-063',
    matter: 'kaztransservis',
    source: 'tura',
    status: 'indexed',
  },
  {
    id: 'nda',
    title: {
      ru: 'Соглашение о неразглашении с подрядчиком',
      kz: 'Мердігермен жасалған құпиялылық туралы келісім',
      en: 'Non-disclosure agreement with a contractor',
    },
    ref: 'DOC-2026-070',
    matter: null,
    source: 'tura',
    status: 'pending',
  },
  {
    id: 'claim',
    title: {
      ru: 'Претензия о взыскании неустойки',
      kz: 'Тұрақсыздық айыбын өндіру туралы кінәрат-талап',
      en: 'Letter of claim for recovery of a penalty',
    },
    ref: 'DOC-2026-072',
    matter: 'kaztransservis',
    source: 'tura',
    status: 'indexed',
  },
  {
    id: 'bill',
    title: {
      ru: 'Законопроект о внесении изменений в Закон «О госзакупках»',
      kz: '«Мемлекеттік сатып алу туралы» Заңға өзгерістер енгізу туралы заң жобасы',
      en: 'Draft law amending the Public Procurement Act',
    },
    ref: 'DOC-2026-058',
    matter: null,
    source: 'tura',
    status: 'indexed',
  },
  {
    id: 'labor',
    title: {
      ru: 'Трудовой договор с директором филиала',
      kz: 'Филиал директорымен жасалған еңбек шарты',
      en: 'Employment contract with the branch director',
    },
    ref: 'DOC-2026-039',
    matter: 'hr',
    source: 'upload',
    status: 'failed',
  },
  {
    id: 'act',
    title: {
      ru: 'Акт сверки взаиморасчётов за 2025 год',
      kz: '2025 жылғы өзара есеп айырысуды салыстыру актісі',
      en: 'Reconciliation statement for 2025',
    },
    ref: 'DOC-2026-044',
    matter: 'astana-logistik',
    source: 'upload',
    status: 'failed',
  },
  {
    id: 'protocol',
    title: {
      ru: 'Протокол общего собрания участников',
      kz: 'Қатысушылардың жалпы жиналысының хаттамасы',
      en: 'Minutes of the general meeting of participants',
    },
    ref: 'DOC-2026-018',
    matter: 'sklad-ryskulova',
    source: 'upload',
    status: 'indexed',
  },
]

const STATUS_KIND: Record<DocStatus, StatusKind> = {
  indexed: 'ok',
  pending: 'warn',
  failed: 'err',
}

const STATUS_KEY: Record<DocStatus, string> = {
  indexed: 'stIndexed',
  pending: 'stPending',
  failed: 'stFailed',
}

/**
 * Реестр живёт в состоянии: загрузка, повтор индексации и удаление меняют его
 * прямо на экране. До подключения /api/workspace/documents индексация —
 * имитация с задержкой, а не запрос к серверу.
 */
const INDEX_MS = 2500

export function LibraryPage() {
  const t = useT(dict)
  const { lang } = useLang()
  const toast = useToast()
  const [params, setParams] = useSearchParams()

  const [docs, setDocs] = useState<DocRow[]>(DOCS)
  const [query, setQuery] = useState('')
  const [over, setOver] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const fileRef = useRef<HTMLInputElement>(null)
  const timers = useRef<number[]>([])

  useEffect(
    () => () => {
      for (const id of timers.current) window.clearTimeout(id)
    },
    [],
  )

  /* Фильтр по делу живёт в адресе: со страницы дел сюда приходят по ссылке
     /workspace?matter=<id>, и выбранное дело должно быть уже подставлено. */
  const fromUrl = params.get('matter')
  const filter = fromUrl && fromUrl.trim() ? fromUrl : 'all'
  /* Дело, созданное на соседнем экране, ещё не значится в замоканном списке:
     его имя приходит вместе с фильтром, чтобы чип было чем подписать. */
  const extraName = params.get('name')
  const known = filter === 'all' || filter === 'none' || MATTER_IDS.includes(filter)

  const setFilter = useCallback(
    (id: string) => {
      const next = new URLSearchParams(params)
      if (id === 'all') next.delete('matter')
      else next.set('matter', id)
      setParams(next, { replace: true })
      setConfirmId(null)
    },
    [params, setParams],
  )

  /** Перевод строки в «проиндексирован» через задержку — имитация фоновой индексации. */
  const indexLater = useCallback(
    (id: string, title: string) => {
      const timer = window.setTimeout(() => {
        setDocs((prev) => prev.map((d) => (d.id === id ? { ...d, status: 'indexed' } : d)))
        toast(`${title} — ${t('ready')}`, 'ok')
      }, INDEX_MS)
      timers.current.push(timer)
    },
    [toast, t],
  )

  const accept = useCallback(
    (files: FileList | null) => {
      const file = files?.[0]
      if (!file) return
      const id = `up-${Date.now()}`
      const name = file.name.replace(/\.[^.]+$/, '')
      const row: DocRow = {
        id,
        title: { ru: name, kz: name, en: name },
        ref: `DOC-2026-${String(Math.floor(Math.random() * 900) + 100)}`,
        matter: filter !== 'all' && filter !== 'none' ? filter : null,
        source: 'upload',
        status: 'pending',
      }
      setDocs((prev) => [row, ...prev])
      setQuery('')
      toast(t('queued'))
      indexLater(id, name)
    },
    [filter, indexLater, toast, t],
  )

  const retry = useCallback(
    (d: DocRow) => {
      setDocs((prev) => prev.map((x) => (x.id === d.id ? { ...x, status: 'pending' } : x)))
      indexLater(d.id, d.title[lang])
    },
    [indexLater, lang],
  )

  const remove = useCallback(
    (d: DocRow) => {
      setDocs((prev) => prev.filter((x) => x.id !== d.id))
      setConfirmId(null)
      toast(`${t('removed')}: ${d.title[lang]}`, 'ok')
    },
    [toast, t, lang],
  )

  const rows = useMemo(
    () =>
      docs.filter((d) => {
        if (filter === 'none' && d.matter !== null) return false
        if (filter !== 'all' && filter !== 'none' && d.matter !== filter) return false
        const q = query.trim().toLowerCase()
        if (q && !d.title[lang].toLowerCase().includes(q) && !d.ref.toLowerCase().includes(q)) {
          return false
        }
        return true
      }),
    [docs, filter, query, lang],
  )

  const onDrag = (e: DragEvent<HTMLDivElement>, state: boolean) => {
    e.preventDefault()
    setOver(state)
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setOver(false)
    accept(e.dataTransfer?.files ?? null)
  }

  return (
    <div className="page">
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.docx"
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
        <div className="ws-actions">
          <Button variant="primary" onClick={() => fileRef.current?.click()}>
            {t('upload')}
          </Button>
        </div>
      </div>

      <div className="ws-filters">
        <Chip active={filter === 'all'} onClick={() => setFilter('all')}>
          {t('all')} · {docs.length}
        </Chip>
        {MATTER_IDS.map((id) => (
          <Chip key={id} active={filter === id} onClick={() => setFilter(id)}>
            {MATTER_NAMES[id][lang]}
          </Chip>
        ))}
        <Chip active={filter === 'none'} onClick={() => setFilter('none')}>
          {t('noMatter')}
        </Chip>
        {known ? null : (
          <Chip active onClick={() => setFilter('all')}>
            {extraName ?? filter}
          </Chip>
        )}
        <div className="ws-search">
          <Input
            type="search"
            value={query}
            placeholder={t('search')}
            aria-label={t('search')}
            onChange={(e) => setQuery(e.currentTarget.value)}
          />
        </div>
      </div>

      <div
        className={over ? 'ws-drop ws-drop--over' : 'ws-drop'}
        onDragOver={(e) => onDrag(e, true)}
        onDragEnter={(e) => onDrag(e, true)}
        onDragLeave={(e) => onDrag(e, false)}
        onDrop={onDrop}
      >
        <Body tone="mute" style={{ margin: 0 }}>
          {over ? t('dropOver') : t('drop')}
        </Body>
        <Button variant="secondary" onClick={() => fileRef.current?.click()}>
          {t('choose')}
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="enter">
          <Empty
            title={docs.length === 0 ? t('emptyTitle') : t('emptyFilterTitle')}
            action={
              <Button variant="primary" onClick={() => fileRef.current?.click()}>
                {t('upload')}
              </Button>
            }
          >
            {docs.length === 0 ? t('emptyBody') : t('emptyFilterBody')}
          </Empty>
        </div>
      ) : (
        <Table className="ws-registry">
          <thead>
            <tr>
              <th scope="col">{t('colDoc')}</th>
              <th scope="col">{t('colMatter')}</th>
              <th scope="col" className="ws-col-src">
                {t('colSource')}
              </th>
              <th scope="col" className="ws-col-status">
                {t('colStatus')}
              </th>
              <th scope="col" className="ws-col-acts">
                <span className="visually-hidden">{t('colActs')}</span>
              </th>
            </tr>
          </thead>
          {/* Ключ по составу фильтра: при смене выборки лента набегает заново */}
          <tbody key={`${filter}:${query}`}>
            {rows.map((d, i) => (
              <tr key={d.id} className="enter-item" style={{ '--i': i } as CSSProperties}>
                <td>
                  <div className="ws-cell-doc">
                    <Link to={`/workspace/documents/${d.id}`}>
                      <TableTitle>{d.title[lang]}</TableTitle>
                    </Link>
                    <Mono tone="mute">{d.ref}</Mono>
                  </div>
                </td>
                <td>
                  {d.matter ? (
                    <UIText tone="ink2">{MATTER_NAMES[d.matter][lang]}</UIText>
                  ) : (
                    <UIText tone="mute">{t('dash')}</UIText>
                  )}
                </td>
                <td className="ws-col-src">
                  <Mono tone="mute">{d.source === 'upload' ? t('srcUpload') : t('srcTura')}</Mono>
                </td>
                <td className="ws-col-status">
                  <div className="ws-status-cell">
                    <Status kind={STATUS_KIND[d.status]}>{t(STATUS_KEY[d.status])}</Status>
                    {d.status === 'failed' ? (
                      <Button
                        variant="ghost"
                        aria-label={`${t('retryAria')}: ${d.title[lang]}`}
                        onClick={() => retry(d)}
                      >
                        <Caption>{t('retry')}</Caption>
                      </Button>
                    ) : null}
                  </div>
                </td>
                <td className="ws-col-acts">
                  {confirmId === d.id ? (
                    <div className="ws-confirm swap">
                      <Caption tone="mute">{t('removeAsk')}</Caption>
                      <Button variant="danger" onClick={() => remove(d)}>
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
                        aria-label={`${t('removeAria')}: ${d.title[lang]}`}
                        onClick={() => setConfirmId(d.id)}
                      >
                        <Caption>{t('remove')}</Caption>
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  )
}
