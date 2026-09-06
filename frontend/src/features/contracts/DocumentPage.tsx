import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  Body,
  Button,
  Caption,
  Chip,
  Empty,
  Label,
  Loading,
  Select,
  Tabs,
  Textarea,
  UIText,
  useToast,
} from '../../shared/ui'
import type { TabItem } from '../../shared/ui'
import { useT } from '../../i18n'
import type { Dict } from '../../i18n'
import { api, download, errorMessage } from '../../shared/api'
import { Sheet } from './Sheet'
import { ListSkeleton, LoadFailure, useLoader } from './shared'
import type {
  Change,
  Clause,
  Draft,
  DraftResponse,
  DraftStatus,
  Issue,
  Rejected,
  Turn,
  TurnResponse,
  TurnsResponse,
  VersionFull,
  VersionResponse,
  VersionsResponse,
} from './types'
import './contracts.css'
import './contracts.motion.css'

/**
 * Готовый документ: оглавление, лист, работа с текстом.
 *
 * Две вещи здесь важнее остальных. Первая — отказы модели: то, что она
 * попыталась изменить, но применить не удалось, показывается наравне с
 * применённым. Молча проигнорированная правка хуже видимой ошибки: человек
 * уверен, что договор изменён, и подписывает прежний текст. Вторая — пометка
 * ручной правки: пункт, исправленный человеком, помечен и не переписывается
 * при перегенерации.
 */

const dict: Dict = {
  contents: { ru: 'Оглавление', kz: 'Мазмұны', en: 'Contents' },
  edit: { ru: 'Изменить', kz: 'Өзгерту', en: 'Edit' },
  versions: { ru: 'Версии', kz: 'Нұсқалар', en: 'Versions' },

  statusDraft: { ru: 'Черновик', kz: 'Жоба', en: 'Draft' },
  statusReview: { ru: 'На согласовании', kz: 'Келісуде', en: 'In review' },
  statusAgreed: { ru: 'Согласован', kz: 'Келісілген', en: 'Agreed' },
  statusSigned: { ru: 'Подписан', kz: 'Қол қойылған', en: 'Signed' },
  statusArchived: { ru: 'В архиве', kz: 'Мұрағатта', en: 'Archived' },

  download: { ru: 'Скачать', kz: 'Жүктеу', en: 'Download' },
  titleEdit: { ru: 'Название документа', kz: 'Құжаттың атауы', en: 'Document title' },
  version: { ru: 'версия', kz: 'нұсқа', en: 'version' },

  issues: { ru: 'Замечания', kz: 'Ескертулер', en: 'Issues' },
  fill: { ru: 'Дополнить', kz: 'Толықтыру', en: 'Complete it' },

  clauseEdit: { ru: 'Править вручную', kz: 'Қолмен түзету', en: 'Edit manually' },
  clauseRewrite: { ru: 'Переписать этот пункт', kz: 'Осы тармақты қайта жазу', en: 'Rewrite this clause' },
  clauseExplain: { ru: 'Объяснить пункт', kz: 'Тармақты түсіндіру', en: 'Explain this clause' },
  save: { ru: 'Сохранить', kz: 'Сақтау', en: 'Save' },
  cancel: { ru: 'Отменить', kz: 'Бас тарту', en: 'Cancel' },
  edited: { ru: 'правлено вручную', kz: 'қолмен түзетілген', en: 'edited manually' },
  saved: { ru: 'Пункт сохранён', kz: 'Тармақ сақталды', en: 'Clause saved' },

  send: { ru: 'Отправить', kz: 'Жіберу', en: 'Send' },
  askPlaceholder: {
    ru: 'Что изменить в договоре? Например: «в пункте 4.2 увеличь неустойку до 0,5% за день»',
    kz: 'Шартта нені өзгерту керек? Мысалы: «4.2-тармақта тұрақсыздық айыбын күніне 0,5%-ға дейін ұлғайт»',
    en: 'What should change? For example: “in clause 4.2 raise the penalty to 0.5% per day”',
  },
  quickHarder: { ru: 'Ужесточить в мою пользу', kz: 'Мен үшін қатаңдату', en: 'Tighten in my favour' },
  quickPenalty: { ru: 'Добавить штрафные санкции', kz: 'Айыппұл санкцияларын қосу', en: 'Add penalties' },
  quickSimpler: { ru: 'Упростить язык', kz: 'Тілін жеңілдету', en: 'Simplify the language' },
  quickAnnex: { ru: 'Добавить приложение', kz: 'Қосымша қосу', en: 'Add an annex' },
  quickHarderText: {
    ru: 'Ужесточи условия договора в мою пользу: усиль ответственность другой стороны и сократи мои риски, не выходя за рамки права РК.',
    kz: 'Шарт талаптарын менің пайдама қатаңдат: екінші тараптың жауапкершілігін күшейт, менің тәуекелдерімді азайт.',
    en: 'Tighten the contract in my favour: strengthen the other party’s liability and reduce my risks within Kazakhstan law.',
  },
  quickPenaltyText: {
    ru: 'Добавь в раздел об ответственности неустойку за просрочку с указанием процента за каждый день и предельного размера.',
    kz: 'Жауапкершілік бөліміне мерзімін өткізгені үшін тұрақсыздық айыбын қос: күніне пайызын және шекті мөлшерін көрсет.',
    en: 'Add a late-payment penalty to the liability section: a daily percentage and a cap.',
  },
  quickSimplerText: {
    ru: 'Упрости язык договора: короткие предложения, без канцелярита, сохранив юридический смысл каждого условия.',
    kz: 'Шарт тілін жеңілдет: қысқа сөйлемдер, әр талаптың құқықтық мағынасын сақта.',
    en: 'Simplify the language: short sentences, no bureaucratese, preserving the legal meaning.',
  },
  quickAnnexText: {
    ru: 'Добавь приложение к договору: акт приёма-передачи с полями для даты, перечня и подписей сторон.',
    kz: 'Шартқа қосымша қос: күні, тізбесі және тараптардың қолдары үшін өрістері бар қабылдау-беру актісі.',
    en: 'Add an annex: a handover act with fields for the date, the list and the parties’ signatures.',
  },

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
  noTurns: {
    ru: 'Правок ещё не было. Опишите, что изменить, — договор будет исправлен по пунктам.',
    kz: 'Әзірге түзетулер жоқ. Нені өзгерту керегін жазыңыз — шарт тармақтап түзетіледі.',
    en: 'No edits yet. Describe what to change and the contract will be amended clause by clause.',
  },

  byLlm: { ru: 'модель', kz: 'модель', en: 'model' },
  byUser: { ru: 'вы', kz: 'сіз', en: 'you' },
  bySystem: { ru: 'система', kz: 'жүйе', en: 'system' },
  current: { ru: 'текущая', kz: 'ағымдағы', en: 'current' },
  revert: { ru: 'Вернуться к этой версии', kz: 'Осы нұсқаға оралу', en: 'Restore this version' },
  diffToCurrent: { ru: 'Отличия от текущей версии', kz: 'Ағымдағы нұсқадан айырмашылықтар', en: 'Differences from the current version' },
  noDiff: { ru: 'Отличий по пунктам нет.', kz: 'Тармақтар бойынша айырмашылық жоқ.', en: 'No clause-level differences.' },

  noTree: { ru: 'У документа нет содержимого', kz: 'Құжаттың мазмұны жоқ', en: 'The document has no content' },
  noTreeBody: {
    ru: 'Сервер вернул документ без дерева. Это ошибка на стороне сервера — сообщите о ней.',
    kz: 'Сервер ағашсыз құжат қайтарды. Бұл сервер жағындағы қате — хабарлаңыз.',
    en: 'The server returned a document without a tree. This is a server-side error — please report it.',
  },
  failEdit: { ru: 'Правка не применилась', kz: 'Түзету қолданылмады', en: 'The edit was not applied' },
}

const STATUS_LABEL: Record<DraftStatus, string> = {
  draft: 'statusDraft',
  review: 'statusReview',
  agreed: 'statusAgreed',
  signed: 'statusSigned',
  archived: 'statusArchived',
}

const AUTHOR_LABEL: Record<string, string> = { llm: 'byLlm', user: 'byUser', system: 'bySystem' }

function issueClass(level: Issue['level']) {
  return level === 'error' ? 'ct-issue--err' : level === 'warning' ? 'ct-issue--warn' : 'ct-issue--info'
}

export function DocumentPage() {
  const { id = '' } = useParams()
  const t = useT(dict)
  const toast = useToast()

  const { data, error, loading, reload, setData } = useLoader<DraftResponse>(
    () => api.get<DraftResponse>(`/drafts/${encodeURIComponent(id)}`),
    [id],
  )
  const draft: Draft | null = data?.draft ?? null
  const tree = draft?.tree ?? null

  const setDraft = useCallback((d: Draft) => setData({ draft: d }), [setData])

  const [tab, setTab] = useState('edit')
  const [activeNo, setActiveNo] = useState<string | null>(null)
  const [editingNo, setEditingNo] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  // Поле правки живёт здесь, а не в панели: «переписать этот пункт» из листа
  // должно подставлять в него указание, а лист панели не видит.
  const [ask, setAsk] = useState('')

  const tabs: TabItem[] = [
    { id: 'edit', label: t('edit') },
    { id: 'versions', label: t('versions') },
  ]

  /* ------------------------------- шапка ------------------------------- */

  const [title, setTitle] = useState('')
  useEffect(() => {
    if (draft) setTitle(draft.title)
  }, [draft])

  const saveTitle = async () => {
    if (!draft || !title.trim() || title === draft.title) return
    try {
      const res = await api.patch<DraftResponse>(`/drafts/${draft.id}`, { title: title.trim() })
      setDraft({ ...draft, title: res.draft.title })
    } catch (e) {
      setTitle(draft.title)
      toast(errorMessage(e, t('failEdit')), 'err')
    }
  }

  const setStatus = async (status: DraftStatus) => {
    if (!draft) return
    try {
      await api.patch<DraftResponse>(`/drafts/${draft.id}`, { status })
      setDraft({ ...draft, status })
    } catch (e) {
      toast(errorMessage(e, t('failEdit')), 'err')
    }
  }

  const grab = async (format: 'docx' | 'pdf' | 'xlsx') => {
    if (!draft) return
    try {
      await download(`/drafts/${draft.id}/export?format=${format}`)
    } catch (e) {
      toast(errorMessage(e, t('failEdit')), 'err')
    }
  }

  /* ---------------------------- правка пункта ---------------------------- */

  const openClause = (clause: Clause) => {
    if (editingNo === clause.no) return
    setActiveNo((prev) => (prev === clause.no ? null : clause.no))
    setEditingNo(null)
  }

  const startEdit = (clause: Clause) => {
    setEditingNo(clause.no)
    setEditText(clause.text)
  }

  const saveClause = async (no: string) => {
    if (!draft || !editText.trim()) return
    try {
      const res = await api.put<DraftResponse>(
        `/drafts/${draft.id}/clauses/${encodeURIComponent(no)}`,
        { text: editText.trim() },
      )
      setDraft(res.draft)
      setEditingNo(null)
      setActiveNo(null)
      toast(t('saved'), 'ok')
    } catch (e) {
      toast(errorMessage(e, t('failEdit')), 'err')
    }
  }

  /** Указание для правой панели: пункт адресуется по номеру, как в договоре. */
  const askAbout = (text: string) => {
    setTab('edit')
    setAsk(text)
  }

  /* ------------------------------ состояния ------------------------------ */

  if (loading) {
    return (
      <div className="page">
        <ListSkeleton rows={12} />
      </div>
    )
  }
  if (error || !draft) {
    return (
      <div className="page">
        <div className="ct-state">
          <LoadFailure error={error} onRetry={reload} />
        </div>
      </div>
    )
  }
  if (!tree) {
    return (
      <div className="page">
        <div className="ct-state">
          <Empty title={t('noTree')}>{t('noTreeBody')}</Empty>
        </div>
      </div>
    )
  }

  const hasTables = tree.tables.length > 0 || tree.annexes.some((a) => a.table)
  const generating = tree.sections.some((s) => s.pending)

  return (
    <div className="page ct-doc">
      <header className="ct-doc__head">
        <input
          className="ct-doc__title"
          value={title}
          aria-label={t('titleEdit')}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
        />
        <div className="ct-doc__tools">
          <Caption tone="mute" className="tabular">
            {t('version')} {draft.version}
          </Caption>
          <Select
            value={draft.status}
            aria-label={t('statusDraft')}
            onChange={(e) => setStatus(e.target.value as DraftStatus)}
          >
            {(Object.keys(STATUS_LABEL) as DraftStatus[]).map((s) => (
              <option key={s} value={s}>
                {t(STATUS_LABEL[s])}
              </option>
            ))}
          </Select>
          <span className="ct-doc__export">
            <Caption tone="mute">{t('download')}</Caption>
            <Button onClick={() => grab('docx')}>DOCX</Button>
            <Button onClick={() => grab('pdf')}>PDF</Button>
            {hasTables ? <Button onClick={() => grab('xlsx')}>XLSX</Button> : null}
          </span>
        </div>
      </header>

      <div className="ct-doc__grid">
        <nav className="ct-toc" aria-label={t('contents')}>
          <Label as="div" className="ct-toc__head">
            {t('contents')}
          </Label>
          <ol className="ct-toc__list">
            {tree.sections.map((s) => (
              <li key={s.key ?? s.no}>
                <a href={`#section-${s.no}`} className="ct-toc__link">
                  <span className="ct-toc__no tabular">{s.no}</span>
                  <span>{s.title}</span>
                  {s.pending ? <span className="ct-toc__pending" aria-hidden="true">·</span> : null}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="ct-paper ct-paper--wide">
          <Sheet
            tree={tree}
            activeNo={activeNo}
            onClauseClick={openClause}
            head={
              <>
                {generating ? <Loading /> : null}
                {tree.issues.length ? (
                  <div className="ct-issues">
                    <Label as="div">{t('issues')}</Label>
                    {tree.issues.map((issue, i) => (
                      <div key={i} className={['ct-issue', issueClass(issue.level)].join(' ')}>
                        <UIText>{issue.message}</UIText>
                        {issue.code === 'essential_term_missing' ? (
                          <Button
                            variant="ghost"
                            onClick={() =>
                              askAbout(
                                `${issue.message} Дополни договор так, чтобы это условие было согласовано.`,
                              )
                            }
                          >
                            {t('fill')}
                          </Button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </>
            }
            clauseSlot={(clause) => {
              if (editingNo === clause.no) {
                return (
                  <div className="ct-clause-edit unfold">
                    <Textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      aria-label={t('clauseEdit')}
                    />
                    <div className="ct-clause-edit__actions">
                      <Button variant="primary" onClick={() => saveClause(clause.no)}>
                        {t('save')}
                      </Button>
                      <Button variant="ghost" onClick={() => setEditingNo(null)}>
                        {t('cancel')}
                      </Button>
                    </div>
                  </div>
                )
              }
              if (activeNo !== clause.no) {
                return clause.locked ? (
                  <div className="ct-clause-flag">
                    <Caption tone="mute">{t('edited')}</Caption>
                  </div>
                ) : null
              }
              return (
                <div className="ct-clause-menu unfold">
                  <Button variant="ghost" onClick={() => startEdit(clause)}>
                    {t('clauseEdit')}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => askAbout(`Перепиши пункт ${clause.no}: `)}
                  >
                    {t('clauseRewrite')}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() =>
                      askAbout(
                        `Объясни простыми словами, что означает пункт ${clause.no} и чем он грозит сторонам. Текст договора не меняй.`,
                      )
                    }
                  >
                    {t('clauseExplain')}
                  </Button>
                  {clause.locked ? <Caption tone="mute">{t('edited')}</Caption> : null}
                </div>
              )
            }}
          />
        </div>

        <aside className="ct-side">
          <Tabs items={tabs} value={tab} onChange={setTab} />
          {tab === 'edit' ? (
            <EditPanel draft={draft} onDraft={setDraft} text={ask} onText={setAsk} />
          ) : (
            <VersionsPanel draft={draft} onDraft={setDraft} />
          )}
        </aside>
      </div>
    </div>
  )
}

/* --------------------------------- правка --------------------------------- */

function ChangeList({ changes }: { changes: Change[] }) {
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

function RejectedList({ rejected }: { rejected: Rejected[] }) {
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

function EditPanel({
  draft,
  onDraft,
  text,
  onText,
}: {
  draft: Draft
  onDraft: (d: Draft) => void
  text: string
  onText: (v: string) => void
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

  const quick: [string, string][] = [
    ['quickHarder', 'quickHarderText'],
    ['quickPenalty', 'quickPenaltyText'],
    ['quickSimpler', 'quickSimplerText'],
    ['quickAnnex', 'quickAnnexText'],
  ]

  return (
    <div className="ct-side__body">
      {failed ? (
        <LoadFailure error={failed} />
      ) : (
        <div className="ct-turns">
          {!turns.length ? <Caption tone="mute">{t('noTurns')}</Caption> : null}
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
          {quick.map(([label, body]) => (
            <Chip key={label} onClick={() => send(t(body))} disabled={busy}>
              {t(label)}
            </Chip>
          ))}
        </div>
        <Textarea
          value={text}
          placeholder={t('askPlaceholder')}
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

function VersionsPanel({ draft, onDraft }: { draft: Draft; onDraft: (d: Draft) => void }) {
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
      const res = await api.post<DraftResponse>(`/drafts/${draft.id}/revert`, { version: no })
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
