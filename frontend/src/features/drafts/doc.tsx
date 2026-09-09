import { useCallback, useEffect, useRef, useState } from 'react'
import { Body, Button, Caption, Chip, Label, Loading, Textarea, UIText, useToast } from '../../shared/ui'
import type { StatusKind } from '../../shared/ui'
import { useT } from '../../i18n'
import type { Dict } from '../../i18n'
import { api, download, errorMessage, sse } from '../../shared/api'
import { LoadFailure, ListSkeleton, useLoader } from './shared'
import type {
  BuildMeta,
  Change,
  DocTree,
  Draft,
  DraftStatus,
  FoundNorm,
  Issue,
  Job,
  JobResponse,
  Rejected,
  Turn,
  TurnResponse,
  TurnsResponse,
  VersionFull,
  VersionResponse,
  VersionsResponse,
} from './types'

/**
 * Общая часть страницы документа: лента правок, история версий и запуск
 * составления разделов.
 *
 * Договор и законопроект отличаются составом пакета и подсказками, но работа
 * с текстом у них одна: правка через модель, отказы, версии, откат. Держать
 * два экземпляра этого кода — значит через месяц чинить отказы модели в одном
 * модуле и забыть про другой.
 */

const dict: Dict = {
  save: { ru: 'Сохранить', kz: 'Сақтау', en: 'Save' },
  cancel: { ru: 'Отменить', kz: 'Бас тарту', en: 'Cancel' },
  send: { ru: 'Отправить', kz: 'Жіберу', en: 'Send' },
  edit: { ru: 'Изменить', kz: 'Өзгерту', en: 'Edit' },

  applied: { ru: 'Изменения', kz: 'Өзгерістер', en: 'Changes' },
  rejected: { ru: 'Не применено', kz: 'Қолданылмады', en: 'Not applied' },
  rejectedHint: {
    ru: 'Модель просила эти правки, но применить их не удалось. Документ их не содержит.',
    kz: 'Модель осы түзетулерді сұрады, бірақ оларды қолдану мүмкін болмады. Құжатта олар жоқ.',
    en: 'The model asked for these edits, but they could not be applied. They are not in the document.',
  },
  changed: { ru: 'изменён', kz: 'өзгертілді', en: 'changed' },
  added: { ru: 'добавлен', kz: 'қосылды', en: 'added' },
  removed: { ru: 'удалён', kz: 'жойылды', en: 'removed' },
  clause: { ru: 'пункт', kz: 'тармақ', en: 'clause' },
  before: { ru: 'Было', kz: 'Болды', en: 'Before' },
  after: { ru: 'Стало', kz: 'Болды', en: 'After' },

  byLlm: { ru: 'модель', kz: 'модель', en: 'model' },
  byUser: { ru: 'вы', kz: 'сіз', en: 'you' },
  bySystem: { ru: 'система', kz: 'жүйе', en: 'system' },
  current: { ru: 'текущая', kz: 'ағымдағы', en: 'current' },
  revert: { ru: 'Вернуться к этой версии', kz: 'Осы нұсқаға оралу', en: 'Restore this version' },
  diffToCurrent: {
    ru: 'Отличия от текущей версии',
    kz: 'Ағымдағы нұсқадан айырмашылықтар',
    en: 'Differences from the current version',
  },
  noDiff: { ru: 'Отличий по пунктам нет.', kz: 'Тармақтар бойынша айырмашылық жоқ.', en: 'No clause-level differences.' },

  failEdit: { ru: 'Правка не применилась', kz: 'Түзету қолданылмады', en: 'The edit was not applied' },
  built: { ru: 'Разделы составлены', kz: 'Бөлімдер жасалды', en: 'Sections drafted' },
  errBuild: {
    ru: 'Не удалось запустить составление',
    kz: 'Жазуды бастау мүмкін болмады',
    en: 'Could not start drafting',
  },
}

/** Статусы черновика одни для всех видов документов. */
export const statusDict: Dict = {
  statusDraft: { ru: 'Черновик', kz: 'Жоба', en: 'Draft' },
  statusReview: { ru: 'На согласовании', kz: 'Келісуде', en: 'In review' },
  statusAgreed: { ru: 'Согласован', kz: 'Келісілген', en: 'Agreed' },
  statusSigned: { ru: 'Подписан', kz: 'Қол қойылған', en: 'Signed' },
  statusArchived: { ru: 'В архиве', kz: 'Мұрағатта', en: 'Archived' },
}

export const STATUS_LABEL: Record<DraftStatus, string> = {
  draft: 'statusDraft',
  review: 'statusReview',
  agreed: 'statusAgreed',
  signed: 'statusSigned',
  archived: 'statusArchived',
}

export const STATUS_KIND: Record<DraftStatus, StatusKind> = {
  draft: 'idle',
  review: 'warn',
  agreed: 'ok',
  signed: 'ok',
  archived: 'idle',
}

const AUTHOR_LABEL: Record<string, string> = { llm: 'byLlm', user: 'byUser', system: 'bySystem' }

export function issueClass(level: Issue['level']) {
  return level === 'error' ? 'ct-issue--err' : level === 'warning' ? 'ct-issue--warn' : 'ct-issue--info'
}

/** Дата списка в местном формате; пустую не выдумываем. */
export function when(iso: string | null, locale: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/* ------------------------------ составление ------------------------------ */

export interface Building {
  done: number
  total: number
  label: string
  /** Разделы, которые сейчас пишутся: оглавление помечает их отдельно. */
  keys: string[]
  stage?: BuildMeta['stage']
  /** Раздел, над которым идёт работа сейчас. */
  sectionKey?: string
  /** Нормы, найденные под этот раздел. */
  found?: FoundNorm[]
}

/**
 * Запуск составления разделов и слежение за ходом.
 *
 * Поток событий закрывается в трёх случаях — успех, отказ, обрыв, — и во всех
 * трёх документ уже сохранён на сервере, поэтому экран просто перечитывает
 * его: держать человека в бесконечном ожидании хуже, чем показать частично
 * составленный пакет.
 *
 * Задача может быть запущена другим экраном (мастером брифа): `attach`
 * подхватывает её по объекту из ответа документа.
 */
export function useSectionBuild(
  draftId: string,
  onDone: () => void,
  onPartial?: (tree: DocTree) => void,
) {
  const t = useT(dict)
  const toast = useToast()
  const [building, setBuilding] = useState<Building | null>(null)
  const stopRef = useRef<(() => void) | null>(null)
  // Колбэки — в ref: они меняются на каждой перерисовке экрана, а подписка
  // на поток открывается один раз и должна звать свежие.
  const onPartialRef = useRef(onPartial)
  onPartialRef.current = onPartial
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => () => stopRef.current?.(), [])

  /** Слежение за задачей — и за только что запущенной, и за подхваченной. */
  const follow = useCallback(
    (jobId: string, keys: string[]) => {
      // Закрывалка держится в локальной переменной, а не только в ref:
      // необорванный EventSource продолжает переподключаться и держит на
      // сервере поток, который никто не читает.
      let stop: (() => void) | null = null
      const finish = () => {
        stop?.()
        stop = null
        stopRef.current = null
        setBuilding(null)
        onDoneRef.current()
      }
      stop = sse<Job>(
        `/drafts/jobs/${jobId}/events`,
        (j) => {
          const meta = (j.result ?? null) as BuildMeta | null
          setBuilding({
            done: j.progress.done,
            total: j.progress.total,
            label: j.progress.label,
            keys,
            stage: meta?.stage,
            sectionKey: meta?.section,
            found: meta?.found,
          })
          if (meta?.partial) onPartialRef.current?.(meta.partial)
          if (j.status === 'done' || j.status === 'failed' || j.status === 'cancelled') {
            if (j.status === 'failed' && j.error) toast(j.error, 'err')
            // Тишина после сборки читалась как «ничего не произошло»: полоса
            // хода исчезала, а лист под ней просто становился длиннее.
            if (j.status === 'done') toast(`${t('built')}: ${keys.length}`, 'ok')
            finish()
          }
        },
        finish,
      )
      stopRef.current = () => stop?.()
    },
    [t, toast],
  )

  const run = useCallback(
    async (keys: string[], hint?: string) => {
      if (!keys.length || stopRef.current) return
      setBuilding({ done: 0, total: keys.length, label: '', keys })
      try {
        const started = await api.post<JobResponse>(`/drafts/${draftId}/generate`, {
          sections: keys,
          ...(hint ? { hint } : {}),
        })
        follow(started.job.id, keys)
      } catch (e) {
        setBuilding(null)
        toast(errorMessage(e, t('errBuild')), 'err')
      }
    },
    [draftId, follow, t, toast],
  )

  /** Подхватить задачу, запущенную другим экраном. */
  const attach = useCallback(
    (job: Job, keys: string[]) => {
      if (stopRef.current) return
      setBuilding({ done: job.progress.done, total: job.progress.total, label: job.progress.label, keys })
      follow(job.id, keys)
    },
    [follow],
  )

  return { building, run, attach }
}

/* -------------------------------- изменения -------------------------------- */

export function ChangeList({ changes }: { changes: Change[] }) {
  const t = useT(dict)
  if (!changes.length) return null
  return (
    <div className="ct-changes">
      <Label as="div">{t('applied')}</Label>
      {changes.map((c, i) => (
        <details key={`${c.no}-${i}`} className="ct-change">
          <summary>
            {t('clause')} {c.no} {t(c.kind)}
            {c.title ? ` · ${c.title}` : ''}
          </summary>
          {c.before ? (
            <div className="ct-change__side">
              <Label as="div">{t('before')}</Label>
              <Body tone="mute">{c.before}</Body>
            </div>
          ) : null}
          {c.after ? (
            <div className="ct-change__side">
              <Label as="div">{t('after')}</Label>
              <Body>{c.after}</Body>
            </div>
          ) : null}
        </details>
      ))}
    </div>
  )
}

export function RejectedList({ rejected }: { rejected: Rejected[] }) {
  const t = useT(dict)
  if (!rejected.length) return null
  return (
    <div className="ct-rejected">
      <Label as="div" className="ct-rejected__head">
        {t('rejected')}
      </Label>
      <Caption tone="mute">{t('rejectedHint')}</Caption>
      <ul className="ct-rejected__list">
        {rejected.map((r, i) => (
          <li key={i}>
            <span className="cite">{r.op}</span> <UIText>{r.detail}</UIText>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* --------------------------------- правка --------------------------------- */

/** Готовое указание модели: подпись на кнопке и текст, который уйдёт целиком. */
export interface QuickAsk {
  label: string
  text: string
}

/**
 * Лента правок. Быстрые указания и подсказка приходят снаружи: «ужесточить в
 * мою пользу» для законопроекта бессмысленно, а «усилить антикоррупционные
 * гарантии» — для договора.
 */
export function EditPanel({
  draft,
  onDraft,
  text,
  onText,
  quick,
  placeholder,
  empty,
}: {
  draft: Draft
  onDraft: (d: Draft) => void
  text: string
  onText: (v: string) => void
  quick: QuickAsk[]
  placeholder: string
  empty: string
}) {
  const t = useT(dict)
  const toast = useToast()
  const [turns, setTurns] = useState<Turn[]>([])
  const [busy, setBusy] = useState(false)
  const [lastChanges, setLastChanges] = useState<Change[]>([])
  const [lastRejected, setLastRejected] = useState<Rejected[]>([])
  const [failed, setFailed] = useState<unknown>(null)
  // Отрицательные ключи для реплик, ещё не получивших идентификатор с сервера:
  // они не должны сталкиваться с настоящими id, приходящими при перезагрузке.
  const localId = useRef(0)

  useEffect(() => {
    let alive = true
    api
      .get<TurnsResponse>(`/drafts/${draft.id}/turns`)
      .then((r) => {
        if (alive) setTurns(r.turns)
      })
      .catch((e) => {
        if (alive) setFailed(e)
      })
    return () => {
      alive = false
    }
  }, [draft.id])

  const send = async (instruction: string) => {
    const value = instruction.trim()
    if (!value || busy) return
    setBusy(true)
    setLastChanges([])
    setLastRejected([])
    const optimistic: Turn = {
      id: --localId.current,
      role: 'user',
      text: value,
      ops: [],
      rejected: [],
      version_from: draft.version,
      version_to: null,
      created_at: null,
    }
    setTurns((prev) => [...prev, optimistic])
    onText('')
    try {
      const res = await api.post<TurnResponse>(`/drafts/${draft.id}/turns`, { text: value })
      setTurns((prev) => [
        ...prev,
        {
          id: --localId.current,
          role: 'assistant',
          text: res.reply,
          ops: [],
          rejected: res.rejected ?? [],
          version_from: draft.version,
          version_to: res.draft.version,
          created_at: null,
        },
      ])
      setLastChanges(res.changes ?? [])
      setLastRejected(res.rejected ?? [])
      onDraft(res.draft)
    } catch (e) {
      // Реплику пользователя оставляем: она уже записана на сервере,
      // и убрать её из ленты значило бы соврать про историю правок.
      toast(errorMessage(e, t('failEdit')), 'err')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="ct-side__body">
      {failed ? (
        <LoadFailure error={failed} />
      ) : (
        <div className="ct-turns">
          {!turns.length ? <Caption tone="mute">{empty}</Caption> : null}
          {turns.map((turn) => (
            <div
              key={turn.id}
              className={['ct-turn', `ct-turn--${turn.role}`, 'enter-soft'].join(' ')}
            >
              <Body>{turn.text}</Body>
              {turn.role === 'assistant' && turn.rejected.length ? (
                <RejectedList rejected={turn.rejected} />
              ) : null}
            </div>
          ))}
          {busy ? <Loading /> : null}
        </div>
      )}

      <ChangeList changes={lastChanges} />
      {lastChanges.length ? null : <RejectedList rejected={lastRejected} />}

      <div className="ct-ask">
        <div className="ct-ask__chips">
          {quick.map((q) => (
            <Chip key={q.label} onClick={() => send(q.text)} disabled={busy}>
              {q.label}
            </Chip>
          ))}
        </div>
        <Textarea
          value={text}
          placeholder={placeholder}
          aria-label={t('edit')}
          onChange={(e) => onText(e.target.value)}
        />
        <Button variant="primary" onClick={() => send(text)} disabled={busy || !text.trim()}>
          {t('send')}
        </Button>
      </div>
    </div>
  )
}

/* --------------------------------- версии --------------------------------- */

export function VersionsPanel({ draft, onDraft }: { draft: Draft; onDraft: (d: Draft) => void }) {
  const t = useT(dict)
  const toast = useToast()
  const [open, setOpen] = useState<number | null>(null)
  const [detail, setDetail] = useState<VersionFull | null>(null)
  const [busy, setBusy] = useState(false)

  const { data, error, loading, reload } = useLoader<VersionsResponse>(
    () => api.get<VersionsResponse>(`/drafts/${draft.id}/versions`),
    [draft.id, draft.version],
  )

  const show = async (no: number) => {
    if (open === no) {
      setOpen(null)
      setDetail(null)
      return
    }
    setOpen(no)
    setDetail(null)
    try {
      const res = await api.get<VersionResponse>(
        `/drafts/${draft.id}/versions/${no}?diff=${draft.version}`,
      )
      setDetail(res.version)
    } catch (e) {
      toast(errorMessage(e, t('failEdit')), 'err')
    }
  }

  const revert = async (no: number) => {
    setBusy(true)
    try {
      const res = await api.post<DraftResponseLike>(`/drafts/${draft.id}/revert`, { version: no })
      onDraft(res.draft)
      setOpen(null)
      setDetail(null)
      reload()
    } catch (e) {
      toast(errorMessage(e, t('failEdit')), 'err')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <ListSkeleton rows={5} />
  if (error) return <LoadFailure error={error} onRetry={reload} />

  const versions = data?.versions ?? []

  return (
    <div className="ct-side__body">
      <ol className="ct-versions">
        {versions.map((v) => (
          <li key={v.no} className="ct-version">
            <button type="button" className="ct-version__row" onClick={() => show(v.no)}>
              <span className="ct-version__no tabular">№{v.no}</span>
              <span className="ct-version__body">
                <UIText>{v.summary}</UIText>
                <Caption tone="mute">
                  {t(AUTHOR_LABEL[v.created_by] ?? 'bySystem')}
                  {v.no === (data?.current ?? draft.version) ? ` · ${t('current')}` : ''}
                </Caption>
              </span>
            </button>
            {open === v.no ? (
              <div className="ct-version__detail unfold">
                <Label as="div">{t('diffToCurrent')}</Label>
                {!detail ? (
                  <Loading />
                ) : detail.changes && detail.changes.length ? (
                  <ChangeList changes={detail.changes} />
                ) : (
                  <Caption tone="mute">{t('noDiff')}</Caption>
                )}
                {v.no === (data?.current ?? draft.version) ? null : (
                  <Button onClick={() => revert(v.no)} disabled={busy}>
                    {t('revert')}
                  </Button>
                )}
              </div>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  )
}

interface DraftResponseLike {
  draft: Draft
}

/* ------------------------------ сам документ ------------------------------ */

/**
 * Загрузка документа и всё, что с ним делают одинаково независимо от вида:
 * переименование, статус, выгрузка, ручная правка пункта.
 *
 * Ручная правка ставит пункту признак locked на сервере — перегенерация
 * раздела его не затирает. Поэтому правка обязана идти через этот маршрут, а
 * не через модель.
 */
export function useDraftDoc(id: string) {
  const t = useT(dict)
  const toast = useToast()

  const { data, error, loading, reload, setData } = useLoader<DraftResponseLike>(
    () => api.get<DraftResponseLike>(`/drafts/${encodeURIComponent(id)}`),
    [id],
  )
  const draft = data?.draft ?? null
  const setDraft = useCallback((d: Draft) => setData({ draft: d }), [setData])

  const rename = useCallback(
    async (title: string) => {
      if (!draft || !title.trim() || title === draft.title) return
      try {
        const res = await api.patch<DraftResponseLike>(`/drafts/${draft.id}`, { title: title.trim() })
        setDraft({ ...draft, title: res.draft.title })
      } catch (e) {
        toast(errorMessage(e, t('failEdit')), 'err')
        throw e
      }
    },
    [draft, setDraft, t, toast],
  )

  const setStatus = useCallback(
    async (status: DraftStatus) => {
      if (!draft) return
      try {
        await api.patch<DraftResponseLike>(`/drafts/${draft.id}`, { status })
        setDraft({ ...draft, status })
      } catch (e) {
        toast(errorMessage(e, t('failEdit')), 'err')
      }
    },
    [draft, setDraft, t, toast],
  )

  const saveClause = useCallback(
    async (no: string, text: string) => {
      if (!draft || !text.trim()) return false
      try {
        const res = await api.put<DraftResponseLike>(
          `/drafts/${draft.id}/clauses/${encodeURIComponent(no)}`,
          { text: text.trim() },
        )
        setDraft(res.draft)
        return true
      } catch (e) {
        toast(errorMessage(e, t('failEdit')), 'err')
        return false
      }
    },
    [draft, setDraft, t, toast],
  )

  /** Подменить дерево на экране, не трогая сервер: частичный результат генерации. */
  const setTree = useCallback(
    (tree: DocTree) => {
      if (draft) setData({ draft: { ...draft, tree } })
    },
    [draft, setData],
  )

  return { draft, error, loading, reload, setDraft, setTree, rename, setStatus, saveClause }
}

/** Выгрузка документа. Ошибку показывает сама: молчащая кнопка — худший исход. */
export function useExport(draftId: string | undefined) {
  const t = useT(dict)
  const toast = useToast()
  return useCallback(
    async (format: 'docx' | 'pdf' | 'xlsx') => {
      if (!draftId) return
      try {
        await download(`/drafts/${draftId}/export?format=${format}`)
      } catch (e) {
        toast(errorMessage(e, t('failEdit')), 'err')
      }
    },
    [draftId, t, toast],
  )
}
