import { useCallback, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Link } from '../../shared/nav'
import {
  Body,
  Button,
  Caption,
  H3,
  Input,
  Label,
  Legal,
  Select,
  UIText,
  useToast,
} from '../../shared/ui'
import { useLang, useT, withLang } from '../../i18n'
import type { Dict } from '../../i18n'
import { api, download, errorMessage } from '../../shared/api'
import { LoadFailure, useLoader } from '../drafts/shared'
import { upload } from './upload'
import {
  StatusMark,
  WsSkeleton,
  localeOf,
  reflow,
  useSize,
  useSourceLabel,
  whenShort,
  wsDict,
} from './common'
import type {
  DocumentFullResponse,
  MattersResponse,
  TextResponse,
} from './types'
import './workspace.css'
import './workspace.motion.css'
import './workspace.pages.css'

/**
 * Один документ библиотеки: свойства слева, текст для чтения по центру.
 *
 * Текст берётся из файла заново, а не из фрагментов поиска: фрагменты режутся
 * под индекс и читать их подряд нельзя. Поэтому документ, не попавший в
 * поиск, здесь всё равно читается — сбой индексации не запирает файл.
 */

const dict: Dict = {
  back: { ru: 'К библиотеке', kz: 'Кітапханаға', en: 'Back to the library' },
  titleAria: { ru: 'Название документа', kz: 'Құжаттың атауы', en: 'Document title' },

  download: { ru: 'Скачать оригинал', kz: 'Түпнұсқаны жүктеу', en: 'Download the original' },
  newVersion: { ru: 'Новая версия', kz: 'Жаңа нұсқа', en: 'New version' },
  remove: { ru: 'Удалить', kz: 'Жою', en: 'Delete' },
  removeAsk: {
    ru: 'Удалить документ вместе со всеми версиями? Это необратимо.',
    kz: 'Құжатты барлық нұсқаларымен бірге жою керек пе? Бұл қайтарымсыз.',
    en: 'Delete the document with all its versions? This cannot be undone.',
  },
  removeYes: { ru: 'Да, удалить', kz: 'Иә, жою', en: 'Yes, delete' },
  cancel: { ru: 'Отмена', kz: 'Болдырмау', en: 'Cancel' },
  removed: { ru: 'Документ удалён', kz: 'Құжат жойылды', en: 'Document deleted' },

  props: { ru: 'Свойства', kz: 'Сипаттары', en: 'Properties' },
  file: { ru: 'Файл', kz: 'Файл', en: 'File' },
  size: { ru: 'Размер', kz: 'Көлемі', en: 'Size' },
  pages: { ru: 'Страниц', kz: 'Беттер', en: 'Pages' },
  source: { ru: 'Источник', kz: 'Дереккөз', en: 'Source' },
  state: { ru: 'Состояние', kz: 'Күйі', en: 'State' },
  matter: { ru: 'Дело', kz: 'Іс', en: 'Matter' },
  added: { ru: 'Загружен', kz: 'Жүктелген', en: 'Added' },
  chunks: { ru: 'Фрагментов в поиске', kz: 'Іздеудегі үзінділер', en: 'Fragments in search' },

  failStill: {
    ru: 'Документ читается и скачивается — он только не участвует в поиске.',
    kz: 'Құжат оқылады және жүктеледі — тек іздеуге қатыспайды.',
    en: 'The document still opens and downloads — it is only left out of search.',
  },
  reindex: { ru: 'Переиндексировать', kz: 'Қайта индекстеу', en: 'Re-index' },
  reindexed: { ru: 'Обработка запущена заново', kz: 'Өңдеу қайта басталды', en: 'Processing restarted' },
  pendingNote: {
    ru: 'Текст разбирается для поиска. Читать и скачивать документ можно уже сейчас.',
    kz: 'Мәтін іздеу үшін талдануда. Құжатты қазірден оқуға және жүктеуге болады.',
    en: 'The text is being parsed for search. You can already read and download the document.',
  },

  versions: { ru: 'Версии', kz: 'Нұсқалар', en: 'Versions' },
  verNote: { ru: 'Примечание', kz: 'Ескертпе', en: 'Note' },
  verNotePh: {
    ru: 'Что изменилось в этой версии',
    kz: 'Осы нұсқада не өзгерді',
    en: 'What changed in this version',
  },
  verFile: { ru: 'Файл новой версии', kz: 'Жаңа нұсқаның файлы', en: 'File of the new version' },
  verSend: { ru: 'Загрузить версию', kz: 'Нұсқаны жүктеу', en: 'Upload version' },
  verSending: { ru: 'отправляется', kz: 'жіберілуде', en: 'sending' },
  verDone: { ru: 'Версия загружена', kz: 'Нұсқа жүктелді', en: 'Version uploaded' },
  verNoNote: { ru: 'без примечания', kz: 'ескертпесіз', en: 'no note' },

  text: { ru: 'Текст документа', kz: 'Құжат мәтіні', en: 'Document text' },
  textEmpty: {
    ru: 'Из файла не удалось получить текст. Скорее всего, это скан: страницы — картинки, и распознавание для них ещё не подключено. Оригинал доступен для скачивания.',
    kz: 'Файлдан мәтін алынбады. Бұл сканерленген құжат болуы мүмкін: беттер — сурет, ал тану әлі қосылмаған. Түпнұсқаны жүктеп алуға болады.',
    en: 'No text could be extracted. It is most likely a scan — the pages are images and recognition is not connected yet. The original is still available to download.',
  },

  fromContract: {
    ru: 'Составлен в модуле договоров',
    kz: 'Шарттар модулінде жасалған',
    en: 'Drafted in the contracts module',
  },
  fromLaw: {
    ru: 'Составлен в модуле законопроектов',
    kz: 'Заң жобалары модулінде жасалған',
    en: 'Drafted in the draft-law module',
  },

  failSave: { ru: 'Сохранить не удалось', kz: 'Сақтау мүмкін болмады', en: 'Could not save' },
  failDownload: { ru: 'Скачать не удалось', kz: 'Жүктеу мүмкін болмады', en: 'Could not download' },
}

export function DocumentPage() {
  const { id = '' } = useParams()
  const t = useT(dict)
  const tw = useT(wsDict)
  const { lang } = useLang()
  const locale = localeOf(lang)
  const size = useSize()
  const sourceLabel = useSourceLabel()
  const toast = useToast()
  const navigate = useNavigate()

  const doc = useLoader<DocumentFullResponse>(
    () => api.get<DocumentFullResponse>(`/workspace/documents/${encodeURIComponent(id)}`),
    [id],
  )
  const matters = useLoader<MattersResponse>(
    () => api.get<MattersResponse>('/workspace/matters?archived=1'),
    [],
  )
  const text = useLoader<TextResponse>(
    () => api.get<TextResponse>(`/workspace/documents/${encodeURIComponent(id)}/text`),
    [id],
  )

  const [title, setTitle] = useState<string | null>(null)
  const [confirm, setConfirm] = useState(false)
  const [verOpen, setVerOpen] = useState(false)
  const [verNote, setVerNote] = useState('')
  const [verPercent, setVerPercent] = useState<number | null>(null)
  const verFileRef = useRef<HTMLInputElement>(null)

  const d = doc.data?.document ?? null
  const setDoc = doc.setData

  const rename = useCallback(async () => {
    if (!d || title === null) return
    const value = title.trim()
    setTitle(null)
    if (!value || value === d.title) return
    try {
      await api.patch(`/workspace/documents/${d.id}`, { title: value })
      setDoc({ document: { ...d, title: value } })
    } catch (e) {
      toast(errorMessage(e, t('failSave')), 'err')
    }
  }, [d, title, setDoc, t, toast])

  const setMatter = useCallback(
    async (value: string) => {
      if (!d) return
      const matter_id = value ? Number(value) : null
      try {
        await api.patch(`/workspace/documents/${d.id}`, { matter_id })
        setDoc({ document: { ...d, matter_id } })
      } catch (e) {
        toast(errorMessage(e, t('failSave')), 'err')
      }
    },
    [d, setDoc, t, toast],
  )

  const reindex = useCallback(async () => {
    if (!d) return
    try {
      await api.post(`/workspace/documents/${d.id}/reindex`)
      setDoc({ document: { ...d, status: 'pending', status_error: null } })
      toast(t('reindexed'))
    } catch (e) {
      toast(errorMessage(e, t('failSave')), 'err')
    }
  }, [d, setDoc, t, toast])

  const remove = useCallback(async () => {
    if (!d) return
    try {
      await api.del(`/workspace/documents/${d.id}`)
      toast(t('removed'), 'ok')
      navigate(withLang('/workspace', lang))
    } catch (e) {
      toast(errorMessage(e, t('failSave')), 'err')
    }
  }, [d, lang, navigate, t, toast])

  const sendVersion = useCallback(() => {
    const file = verFileRef.current?.files?.[0]
    if (!d || !file) return
    const form = new FormData()
    form.append('file', file)
    if (verNote.trim()) form.append('note', verNote.trim())
    setVerPercent(0)
    upload(`/workspace/documents/${d.id}/versions`, form, setVerPercent)
      .then(() => {
        setVerPercent(null)
        setVerOpen(false)
        setVerNote('')
        if (verFileRef.current) verFileRef.current.value = ''
        toast(t('verDone'), 'ok')
        /* Новая версия меняет и файл, и состояние документа, и список версий —
           дешевле перечитать документ целиком, чем собирать его из ответа. */
        doc.reload()
        text.reload()
      })
      .catch((e) => {
        setVerPercent(null)
        toast(errorMessage(e, t('failSave')), 'err')
      })
  }, [d, verNote, doc, text, t, toast])

  if (doc.loading) {
    return (
      <div className="page">
        <WsSkeleton rows={8} />
      </div>
    )
  }
  if (doc.error || !d) {
    return (
      <div className="page">
        <div className="ws-state">
          <LoadFailure error={doc.error} onRetry={doc.reload} />
        </div>
      </div>
    )
  }

  const matterList = matters.data?.matters ?? []

  return (
    <div className="page ws-dp">
      <div className="ws-dp__crumbs">
        <Link to="/workspace">
          <Caption>{t('back')}</Caption>
        </Link>
      </div>

      <header className="ws-dp__head">
        <input
          className="ws-dp__title"
          aria-label={t('titleAria')}
          value={title ?? d.title}
          onChange={(e) => setTitle(e.currentTarget.value)}
          onBlur={() => void rename()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') setTitle(null)
          }}
        />
        <div className="ws-dp__tools">
          <Button
            onClick={() => {
              download(
                `/workspace/documents/${d.id}/file`,
                d.original_filename ?? undefined,
              ).catch((e) => toast(errorMessage(e, t('failDownload')), 'err'))
            }}
          >
            {t('download')}
          </Button>
          <Button onClick={() => setVerOpen((v) => !v)} aria-expanded={verOpen}>
            {t('newVersion')}
          </Button>
          {confirm ? (
            <span className="ws-confirm swap">
              <Button variant="danger" onClick={() => void remove()}>
                {t('removeYes')}
              </Button>
              <Button variant="ghost" onClick={() => setConfirm(false)}>
                {t('cancel')}
              </Button>
            </span>
          ) : (
            <Button variant="ghost" onClick={() => setConfirm(true)}>
              {t('remove')}
            </Button>
          )}
        </div>
      </header>

      {confirm ? <Caption tone="mute">{t('removeAsk')}</Caption> : null}

      {verOpen ? (
        <form
          className="ws-form unfold"
          onSubmit={(e) => {
            e.preventDefault()
            sendVersion()
          }}
        >
          <div className="field">
            <Label as="div" className="field__label">
              {t('verFile')}
            </Label>
            <input ref={verFileRef} type="file" accept=".pdf,.docx,.txt,.rtf" className="field__control" />
          </div>
          <Input
            label={t('verNote')}
            placeholder={t('verNotePh')}
            value={verNote}
            onChange={(e) => setVerNote(e.currentTarget.value)}
          />
          <div className="ws-form__acts">
            <Button variant="primary" type="submit" disabled={verPercent !== null}>
              {verPercent === null ? t('verSend') : `${t('verSending')} · ${verPercent}%`}
            </Button>
            <Button variant="ghost" type="button" onClick={() => setVerOpen(false)}>
              {t('cancel')}
            </Button>
          </div>
        </form>
      ) : null}

      <div className="ws-dp__grid">
        <aside className="ws-dp__side">
          <Label as="div">{t('props')}</Label>
          <dl className="ws-props">
            <Prop label={t('file')}>
              <Caption tone="ink2">{d.original_filename ?? tw('dash')}</Caption>
            </Prop>
            <Prop label={t('size')}>
              <Caption tone="ink2">{size(d.file_size)}</Caption>
            </Prop>
            <Prop label={t('pages')}>
              <Caption tone="ink2">{d.pages ?? tw('dash')}</Caption>
            </Prop>
            <Prop label={t('source')}>
              <Caption tone="ink2">{sourceLabel(d.source)}</Caption>
            </Prop>
            <Prop label={t('added')}>
              <Caption tone="ink2">{whenShort(d.created_at, locale)}</Caption>
            </Prop>
            <Prop label={t('state')}>
              <StatusMark status={d.status} />
            </Prop>
            {d.status === 'indexed' ? (
              <Prop label={t('chunks')}>
                <Caption tone="ink2">{d.chunks_count}</Caption>
              </Prop>
            ) : null}
          </dl>

          {d.status === 'pending' ? (
            <Caption tone="mute">{t('pendingNote')}</Caption>
          ) : null}

          {d.status === 'failed' ? (
            <div className="ws-note ws-note--side">
              <div className="ws-note__text">
                {d.status_error ? <Body style={{ margin: 0 }}>{d.status_error}</Body> : null}
                <Caption tone="mute">{t('failStill')}</Caption>
              </div>
              <Button onClick={() => void reindex()}>{t('reindex')}</Button>
            </div>
          ) : null}

          {/* Из договоров и законопроектов сюда приходит внутренний числовой
              идентификатор черновика, а адрес документа собран из публичного.
              Ссылку по числу не построить, поэтому только пометка. */}
          {d.source === 'contract' || d.source === 'law_project' ? (
            <Caption tone="mute">
              {d.source === 'contract' ? t('fromContract') : t('fromLaw')}
            </Caption>
          ) : null}

          <Select
            label={t('matter')}
            value={d.matter_id === null ? '' : String(d.matter_id)}
            onChange={(e) => void setMatter(e.currentTarget.value)}
          >
            <option value="">{tw('noMatter')}</option>
            {matterList.map((m) => (
              <option key={m.id} value={String(m.id)}>
                {m.title}
              </option>
            ))}
          </Select>

          <div>
            <Label as="div">{t('versions')}</Label>
            <ol className="ws-versions">
              {d.versions.map((v) => (
                <li key={v.no} className="ws-version">
                  <span className="ws-version__no ws-num">№{v.no}</span>
                  <span className="ws-version__body">
                    <UIText>{v.note || t('verNoNote')}</UIText>
                    <Caption tone="mute">
                      {size(v.file_size)} · {whenShort(v.created_at, locale)}
                    </Caption>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </aside>

        <div className="ws-dp__main">
          <H3>{t('text')}</H3>
          {text.loading ? (
            <WsSkeleton rows={10} />
          ) : text.error ? (
            <LoadFailure error={text.error} onRetry={text.reload} />
          ) : (text.data?.text ?? '').trim() ? (
            <Legal className="ws-dp__text">
              {reflow(text.data?.text ?? '').map((para, i) => (
                <p key={i} className="ws-dp__para">
                  {para}
                </p>
              ))}
            </Legal>
          ) : (
            <Body tone="mute">{t('textEmpty')}</Body>
          )}
        </div>
      </div>
    </div>
  )
}

function Prop({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="ws-prop">
      <dt>
        <Label as="span">{label}</Label>
      </dt>
      <dd>{children}</dd>
    </div>
  )
}
