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
import { api } from '../../shared/api'
import { Sheet } from '../drafts/Sheet'
import { ListSkeleton, LoadFailure, useLoader } from '../drafts/shared'
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
import type { Clause, DraftStatus, PassportResponse, Section } from '../drafts/types'
import '../drafts/drafts.css'
import '../drafts/drafts.motion.css'
import './laws.css'

/**
 * Пакет законопроекта.
 *
 * Главное отличие от договора: одиннадцать разделов здесь — не части одного
 * текста, а самостоятельные документы. Финансовое обоснование переписывают,
 * не трогая пояснительную записку, поэтому у каждого раздела в оглавлении
 * своё действие, а не одна кнопка «составить недостающие» на весь пакет.
 *
 * Сторон у законопроекта нет: ни преамбулы, ни подписей на листе. Это делает
 * пустой список сторон в дереве, отдельной ветки здесь нет.
 */

const dict: Dict = {
  contents: { ru: 'Оглавление', kz: 'Мазмұны', en: 'Contents' },
  edit: { ru: 'Изменить', kz: 'Өзгерту', en: 'Edit' },
  versions: { ru: 'Версии', kz: 'Нұсқалар', en: 'Versions' },

  download: { ru: 'Скачать', kz: 'Жүктеу', en: 'Download' },
  titleEdit: { ru: 'Название законопроекта', kz: 'Заң жобасының атауы', en: 'Draft law title' },
  version: { ru: 'версия', kz: 'нұсқа', en: 'version' },
  xlsxHint: {
    ru: 'Сравнительная таблица и расчёт расходов — таблицами',
    kz: 'Салыстырмалы кесте және шығыстар есебі — кестелермен',
    en: 'Comparison table and cost estimate as spreadsheets',
  },

  caveat: { ru: 'Оговорка', kz: 'Ескертпе', en: 'Caveat' },

  issues: { ru: 'Замечания', kz: 'Ескертулер', en: 'Issues' },
  pendingOne: { ru: 'раздел ещё не составлен', kz: 'бөлім әлі жазылмаған', en: 'section not drafted yet' },
  pendingMany: { ru: 'разделов ещё не составлены', kz: 'бөлім әлі жазылмаған', en: 'sections not drafted yet' },
  buildRest: { ru: 'Составить недостающие', kz: 'Жетіспейтінін жазу', en: 'Draft the rest' },
  building: { ru: 'Составляю разделы', kz: 'Бөлімдер жазылуда', en: 'Drafting sections' },
  fill: { ru: 'Дополнить', kz: 'Толықтыру', en: 'Complete it' },

  sectionWrite: { ru: 'Составить', kz: 'Жазу', en: 'Draft' },
  sectionRedo: { ru: 'Переписать', kz: 'Қайта жазу', en: 'Rewrite' },
  sectionRedoHint: {
    ru: 'Раздел будет написан заново. Пункты, правленные вручную, сохранятся.',
    kz: 'Бөлім қайтадан жазылады. Қолмен түзетілген тармақтар сақталады.',
    en: 'The section is written from scratch. Clauses edited by hand are kept.',
  },

  clauseEdit: { ru: 'Править вручную', kz: 'Қолмен түзету', en: 'Edit manually' },
  clauseRewrite: { ru: 'Переписать этот пункт', kz: 'Осы тармақты қайта жазу', en: 'Rewrite this clause' },
  clauseExplain: { ru: 'Объяснить пункт', kz: 'Тармақты түсіндіру', en: 'Explain this clause' },
  saveClause: { ru: 'Сохранить', kz: 'Сақтау', en: 'Save' },
  cancelEdit: { ru: 'Отменить', kz: 'Бас тарту', en: 'Cancel' },
  edited: { ru: 'правлено вручную', kz: 'қолмен түзетілген', en: 'edited manually' },
  saved: { ru: 'Пункт сохранён', kz: 'Тармақ сақталды', en: 'Clause saved' },

  askPlaceholder: {
    ru: 'Что изменить в пакете? Например: «в финансовом обосновании раздели расходы по годам»',
    kz: 'Топтамада нені өзгерту керек? Мысалы: «қаржылық негіздемеде шығыстарды жылдар бойынша бөл»',
    en: 'What should change? For example: “in the financial justification split the costs by year”',
  },
  noTurns: {
    ru: 'Правок ещё не было. Опишите, что изменить, — пакет будет исправлен по пунктам.',
    kz: 'Әзірге түзетулер жоқ. Нені өзгерту керегін жазыңыз — топтама тармақтап түзетіледі.',
    en: 'No edits yet. Describe what to change and the package will be amended clause by clause.',
  },

  quickNorms: { ru: 'Добавить ссылки на нормы', kz: 'Нормаларға сілтеме қосу', en: 'Add citations' },
  quickNormsText: {
    ru: 'Подкрепи утверждения ссылками на конкретные статьи Конституции РК, кодексов и действующих законов. Там, где нормы нет, скажи об этом прямо, а не выдумывай ссылку.',
    kz: 'Тұжырымдарды ҚР Конституциясының, кодекстердің және қолданыстағы заңдардың нақты баптарына сілтемелермен бекіт. Норма жоқ жерде сілтеме ойлап таппай, тікелей айт.',
    en: 'Back the statements with citations to specific articles of the Constitution, the codes and the acts in force. Where there is no norm, say so instead of inventing a citation.',
  },
  quickCosts: { ru: 'Разложить расходы по годам', kz: 'Шығыстарды жылдар бойынша бөлу', en: 'Break costs down by year' },
  quickCostsText: {
    ru: 'В финансово-экономическом обосновании разложи расходы и доходы бюджета по годам таблицей, укажи источники финансирования и итог по каждому году.',
    kz: 'Қаржы-экономикалық негіздемеде бюджет шығыстары мен кірістерін жылдар бойынша кестемен бөл, қаржыландыру көздерін және әр жылдың қорытындысын көрсет.',
    en: 'In the financial justification break the budget costs and revenues down by year as a table, state the funding sources and the total for each year.',
  },
  quickCorruption: {
    ru: 'Усилить антикоррупционную часть',
    kz: 'Сыбайлас жемқорлыққа қарсы бөлікті күшейту',
    en: 'Strengthen the anti-corruption part',
  },
  quickCorruptionText: {
    ru: 'В антикоррупционной экспертизе разбери коррупциогенные факторы по видам: широта дискреционных полномочий, неопределённость формулировок, отсылочные нормы, завышенные требования к заявителю. По каждому фактору укажи способ устранения.',
    kz: 'Сыбайлас жемқорлыққа қарсы сараптамада коррупциогендік факторларды түрлері бойынша талда: дискрециялық өкілеттіктердің кеңдігі, тұжырымдардың айқынсыздығы, сілтемелік нормалар, өтініш берушіге қойылатын шамадан тыс талаптар. Әр фактор бойынша жою тәсілін көрсет.',
    en: 'In the anti-corruption review analyse the corruption-prone factors by type: breadth of discretion, vague wording, referential norms, excessive requirements on the applicant. For each factor state how to remove it.',
  },
  quickSimpler: { ru: 'Упростить язык', kz: 'Тілін жеңілдету', en: 'Simplify the language' },
  quickSimplerText: {
    ru: 'Упрости язык пояснительной записки и аннотации: короткие предложения, без канцелярита. Нормативный текст самого закона не трогай — там формулировки менять нельзя.',
    kz: 'Түсіндірме жазба мен аннотацияның тілін жеңілдет: қысқа сөйлемдер, кеңсе тілінсіз. Заңның нормативтік мәтінін қозғама.',
    en: 'Simplify the explanatory note and the abstract: short sentences, no bureaucratese. Leave the normative text of the law itself untouched.',
  },

  noTree: { ru: 'У пакета нет содержимого', kz: 'Топтаманың мазмұны жоқ', en: 'The package has no content' },
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

  /* Оговорка живёт в паспорте типа, а не в документе. Загрузка отдельная и
     необязательная: пакет читается и без неё, поэтому ошибку здесь показывать
     нечем — экран просто обходится без плашки. */
  const { data: pass } = useLoader<PassportResponse>(
    () => api.get<PassportResponse>(`/drafts/passport/law_project?lang=${draft?.lang ?? 'ru'}`),
    [draft?.lang],
  )
  const caveat = pass?.passport.caveat ?? null

  const [tab, setTab] = useState('edit')
  const [activeNo, setActiveNo] = useState<string | null>(null)
  const [editingNo, setEditingNo] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [ask, setAsk] = useState('')

  const tabs: TabItem[] = [
    { id: 'edit', label: t('edit') },
    { id: 'versions', label: t('versions') },
  ]

  const [title, setTitle] = useState('')
  useEffect(() => {
    if (draft) setTitle(draft.title)
  }, [draft])

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

  /* Сравнительная таблица и расчёт расходов — таблицы по существу, и XLSX для
     них осмысленнее DOCX. Кнопка появляется, только когда таблицы уже есть:
     пустой файл в ответ на нажатие хуже отсутствующей кнопки. */
  const hasTables = tree.tables.length > 0 || tree.annexes.some((a) => a.table)
  const pending = tree.sections.filter((s) => s.pending)
  const shownIssues = tree.issues.filter((i) => i.code !== 'section_pending')

  const quick: QuickAsk[] = [
    { label: t('quickNorms'), text: t('quickNormsText') },
    { label: t('quickCosts'), text: t('quickCostsText') },
    { label: t('quickCorruption'), text: t('quickCorruptionText') },
    { label: t('quickSimpler'), text: t('quickSimplerText') },
  ]

  const sectionBusy = (s: Section) => Boolean(building && s.key && building.keys.includes(s.key))

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
            {hasTables ? (
              <Button onClick={() => grab('xlsx')} title={t('xlsxHint')}>
                XLSX
              </Button>
            ) : null}
          </span>
        </div>
      </header>

      {caveat ? (
        <details className="ct-caveat">
          <summary className="ct-caveat__head">
            <Label as="span">{t('caveat')}</Label>
          </summary>
          <Caption tone="ink2" className="ct-caveat__body">
            {caveat}
          </Caption>
        </details>
      ) : null}

      <div className="ct-doc__grid">
        {/* Оглавление пакета: у каждого раздела своё действие, потому что
            раздел здесь — отдельный документ, а не часть общего текста. */}
        <nav className="ct-toc lw-toc" aria-label={t('contents')}>
          <Label as="div" className="ct-toc__head">
            {t('contents')}
          </Label>
          <ol className="ct-toc__list">
            {tree.sections.map((s) => (
              <li key={s.key ?? s.no} className="lw-toc__item">
                <a href={`#section-${s.no}`} className="ct-toc__link">
                  <span className="ct-toc__no tabular">{s.no}</span>
                  <span>{s.title}</span>
                  {s.pending ? <span className="ct-toc__pending" aria-hidden="true">·</span> : null}
                </a>
                {s.key ? (
                  <button
                    type="button"
                    className="lw-toc__redo"
                    disabled={Boolean(building)}
                    title={s.pending ? undefined : t('sectionRedoHint')}
                    onClick={() => run([s.key as string])}
                  >
                    {sectionBusy(s) ? '…' : s.pending ? t('sectionWrite') : t('sectionRedo')}
                  </button>
                ) : null}
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
                                `${issue.message} Дополни пакет так, чтобы это требование было закрыто.`,
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
                        `Объясни простыми словами, что означает пункт ${clause.no} и к каким последствиям он ведёт. Текст законопроекта не меняй.`,
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
