import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  Button,
  Caption,
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
import { Sheet } from '../drafts/Sheet'
import { ListSkeleton, LoadFailure } from '../drafts/shared'
import {
  EditPanel,
  STATUS_LABEL,
  VersionsPanel,
  issueClass,
  statusDict,
  useDraftDoc,
  useExport,
  useSectionBuild,
} from '../drafts/doc'
import type { QuickAsk } from '../drafts/doc'
import type { Clause, DraftStatus } from '../drafts/types'
import '../drafts/drafts.css'
import '../drafts/drafts.motion.css'

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

  download: { ru: 'Скачать', kz: 'Жүктеу', en: 'Download' },
  titleEdit: { ru: 'Название документа', kz: 'Құжаттың атауы', en: 'Document title' },
  version: { ru: 'версия', kz: 'нұсқа', en: 'version' },

  issues: { ru: 'Замечания', kz: 'Ескертулер', en: 'Issues' },
  pendingOne: { ru: 'раздел ещё не составлен', kz: 'бөлім әлі жазылмаған', en: 'section not drafted yet' },
  pendingMany: { ru: 'разделов ещё не составлены', kz: 'бөлім әлі жазылмаған', en: 'sections not drafted yet' },
  buildRest: { ru: 'Составить недостающие', kz: 'Жетіспейтінін жазу', en: 'Draft the rest' },
  building: { ru: 'Составляю разделы', kz: 'Бөлімдер жазылуда', en: 'Drafting sections' },
  fill: { ru: 'Дополнить', kz: 'Толықтыру', en: 'Complete it' },

  clauseEdit: { ru: 'Править вручную', kz: 'Қолмен түзету', en: 'Edit manually' },
  clauseRewrite: { ru: 'Переписать этот пункт', kz: 'Осы тармақты қайта жазу', en: 'Rewrite this clause' },
  clauseExplain: { ru: 'Объяснить пункт', kz: 'Тармақты түсіндіру', en: 'Explain this clause' },
  edited: { ru: 'правлено вручную', kz: 'қолмен түзетілген', en: 'edited manually' },
  saveClause: { ru: 'Сохранить', kz: 'Сақтау', en: 'Save' },
  cancelEdit: { ru: 'Отменить', kz: 'Бас тарту', en: 'Cancel' },
  saved: { ru: 'Пункт сохранён', kz: 'Тармақ сақталды', en: 'Clause saved' },

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

  noTurns: {
    ru: 'Правок ещё не было. Опишите, что изменить, — договор будет исправлен по пунктам.',
    kz: 'Әзірге түзетулер жоқ. Нені өзгерту керегін жазыңыз — шарт тармақтап түзетіледі.',
    en: 'No edits yet. Describe what to change and the contract will be amended clause by clause.',
  },

  noTree: { ru: 'У документа нет содержимого', kz: 'Құжаттың мазмұны жоқ', en: 'The document has no content' },
  noTreeBody: {
    ru: 'Сервер вернул документ без дерева. Это ошибка на стороне сервера — сообщите о ней.',
    kz: 'Сервер ағашсыз құжат қайтарды. Бұл сервер жағындағы қате — хабарлаңыз.',
    en: 'The server returned a document without a tree. This is a server-side error — please report it.',
  },
}

export function DocumentPage() {
  const { id = '' } = useParams()
  const t = useT(dict)
  const ts = useT(statusDict)
  const toast = useToast()

  const { draft, error, loading, reload, setDraft, rename, setStatus, saveClause } = useDraftDoc(id)
  const tree = draft?.tree ?? null
  const grab = useExport(draft?.id)
  const { building, run } = useSectionBuild(draft?.id ?? '', reload)

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

  const [title, setTitle] = useState('')
  useEffect(() => {
    if (draft) setTitle(draft.title)
  }, [draft])

  /** Достроить незаполненные разделы.

      Со страницы документа генерацию запустить было нельзя вовсе: попав сюда
      из конструктора с частично составленным договором, человек упирался в
      тупик — оставалось начинать заново. */
  const buildPending = () => {
    if (!tree || building) return
    const keys = tree.sections.filter((s) => s.pending).map((s) => s.key).filter(Boolean) as string[]
    run(keys)
  }

  const openClause = (clause: Clause) => {
    if (editingNo === clause.no) return
    setActiveNo((prev) => (prev === clause.no ? null : clause.no))
    setEditingNo(null)
  }

  const commitClause = async (no: string) => {
    if (!(await saveClause(no, editText))) return
    setEditingNo(null)
    setActiveNo(null)
    toast(t('saved'), 'ok')
  }

  /** Указание для правой панели: пункт адресуется по номеру, как в договоре. */
  const askAbout = (text: string) => {
    setTab('edit')
    setAsk(text)
  }

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
  const pending = tree.sections.filter((s) => s.pending)
  // Пока разделы пересобираются, старые «не удалось составить» не показываем:
  // рядом с полосой хода они читаются как «всё ещё сломано», хотя относятся
  // к прошлой попытке и после сборки исчезнут вместе с новой версией.
  const shownIssues = tree.issues.filter(
    (i) => i.code !== 'section_pending' && !(building && i.code === 'section_failed'),
  )

  const quick: QuickAsk[] = [
    { label: t('quickHarder'), text: t('quickHarderText') },
    { label: t('quickPenalty'), text: t('quickPenaltyText') },
    { label: t('quickSimpler'), text: t('quickSimplerText') },
    { label: t('quickAnnex'), text: t('quickAnnexText') },
  ]

  return (
    <div className="page ct-doc">
      <header className="ct-doc__head">
        <input
          className="ct-doc__title"
          value={title}
          /* Обрезанное многоточием название целиком видно по наведению:
             у длинных названий законов первая строка ничего не говорит. */
          title={title}
          aria-label={t('titleEdit')}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            rename(title).catch(() => setTitle(draft.title))
          }}
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
            aria-label={ts('statusDraft')}
            onChange={(e) => setStatus(e.target.value as DraftStatus)}
          >
            {(Object.keys(STATUS_LABEL) as DraftStatus[]).map((s) => (
              <option key={s} value={s}>
                {ts(STATUS_LABEL[s])}
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
                {building ? (
                  <div className="ct-building">
                    <Loading />
                    <Caption tone="mute">
                      {t('building')}: {building.done}/{building.total} {building.label}
                    </Caption>
                  </div>
                ) : null}

                {/* Несоставленные разделы — одно состояние документа, а не
                    десяток новостей: развёрнутым списком они вытесняли сам
                    договор ниже линии сгиба. */}
                {pending.length ? (
                  <div className="ct-pending">
                    <UIText tone="mute">
                      <span className="tabular">{pending.length}</span>{' '}
                      {pending.length === 1 ? t('pendingOne') : t('pendingMany')}
                    </UIText>
                    <Button variant="secondary" onClick={buildPending} disabled={!!building}>
                      {t('buildRest')}
                    </Button>
                  </div>
                ) : null}

                {shownIssues.length ? (
                  <div className="ct-issues">
                    <Label as="div">{t('issues')}</Label>
                    {shownIssues.map((issue, i) => (
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
                      <Button variant="primary" onClick={() => commitClause(clause.no)}>
                        {t('saveClause')}
                      </Button>
                      <Button variant="ghost" onClick={() => setEditingNo(null)}>
                        {t('cancelEdit')}
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
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setEditingNo(clause.no)
                      setEditText(clause.text)
                    }}
                  >
                    {t('clauseEdit')}
                  </Button>
                  <Button variant="ghost" onClick={() => askAbout(`Перепиши пункт ${clause.no}: `)}>
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
            <EditPanel
              draft={draft}
              onDraft={setDraft}
              text={ask}
              onText={setAsk}
              quick={quick}
              placeholder={t('askPlaceholder')}
              empty={t('noTurns')}
            />
          ) : (
            <VersionsPanel draft={draft} onDraft={setDraft} />
          )}
        </aside>
      </div>
    </div>
  )
}
