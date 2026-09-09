import type { CSSProperties, ReactNode } from 'react'
import type { Clause, DocTable, DocTree, Party, Ref, Section } from './types'
import { refLabel } from './preview'
import type { DocLang } from './preview'

/**
 * Лист документа — общий для договора и законопроекта.
 *
 * Один компонент и в конструкторе, и в готовом документе: то, что человек
 * видит при заполнении формы, обязано совпадать с тем, что он получит после
 * генерации, — иначе предпросмотр не предпросмотр, а отдельная картинка.
 * Разница только в источнике дерева.
 *
 * У законопроекта нет сторон: ни преамбулы, ни подписей. Ветки этих блоков
 * проверяют содержимое, а не вид документа, поэтому пустой список сторон
 * просто не даёт им ничего нарисовать.
 */

const CITY_WORD: Record<DocLang, (city: string) => string> = {
  ru: (c) => `г. ${c}`,
  kk: (c) => `${c} қ.`,
  en: (c) => c,
}

const MONTHS: Record<DocLang, string[]> = {
  ru: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
  kk: ['қаңтар', 'ақпан', 'наурыз', 'сәуір', 'мамыр', 'маусым', 'шілде', 'тамыз', 'қыркүйек', 'қазан', 'қараша', 'желтоқсан'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
}

const YEAR_SUFFIX: Record<DocLang, string> = { ru: 'года', kk: 'жыл', en: '' }

const PENDING_WORD: Record<DocLang, string> = {
  ru: 'раздел будет составлен',
  kk: 'бөлім жасалады',
  en: 'section to be drafted',
}

const SIGNATURES_WORD: Record<DocLang, string> = {
  ru: 'Подписи сторон',
  kk: 'Тараптардың қолдары',
  en: 'Signatures of the parties',
}

const UNVERIFIED_HINT: Record<DocLang, string> = {
  ru: 'Ссылка не выверена по корпусу нормативных актов',
  kk: 'Сілтеме нормативтік актілер корпусы бойынша тексерілмеген',
  en: 'Citation is not verified against the corpus of legal acts',
}

/** Оговорка на весь документ, когда не выверена ни одна ссылка. */
const NONE_VERIFIED: Record<DocLang, string> = {
  ru: 'Ссылки на нормы приведены моделью и не выверены по корпусу актов',
  kk: 'Нормаларға сілтемелерді модель келтірді, олар актілер корпусы бойынша тексерілмеген',
  en: 'Citations were produced by the model and are not verified against the corpus',
}

/** Дата в договорной форме: «12 марта 2026 года». ISO оставляем как есть. */
function formatDate(iso: string, lang: DocLang): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return iso
  const day = Number(m[3])
  const month = MONTHS[lang][Number(m[2]) - 1] ?? m[2]
  const suffix = YEAR_SUFFIX[lang]
  return `«${day}» ${month} ${m[1]} ${suffix}`.trim()
}

function Refs({ refs, lang }: { refs: Ref[]; lang: DocLang }) {
  if (!refs.length) return null
  return (
    <span className="sheet__refs">
      {refs.map((r, i) => (
        <span
          key={`${r.act}-${r.article}-${i}`}
          className={['cite', 'sheet__ref', r.verified ? '' : 'sheet__ref--weak']
            .filter(Boolean)
            .join(' ')}
          title={r.verified ? refLabel(r) : `${refLabel(r)} — ${UNVERIFIED_HINT[lang]}`}
        >
          {refLabel(r)}
          {r.verified ? null : <span className="sheet__unverified" aria-hidden="true"> ?</span>}
        </span>
      ))}
    </span>
  )
}

function ClauseBody({
  clause,
  lang,
  activeNo,
  onClauseClick,
  clauseSlot,
  level,
  order,
}: {
  clause: Clause
  lang: DocLang
  activeNo?: string | null
  onClauseClick?: (clause: Clause) => void
  clauseSlot?: (clause: Clause) => ReactNode
  level: number
  /** Порядок в свежем разделе — задержка каскада; без него анимации нет. */
  order?: number
}) {
  const interactive = Boolean(onClauseClick)
  const cls = [
    'sheet__clause',
    level > 0 ? 'sheet__clause--sub' : '',
    interactive ? 'sheet__clause--live' : '',
    activeNo === clause.no ? 'sheet__clause--on' : '',
    clause.locked ? 'sheet__clause--locked' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const style = order === undefined ? undefined : ({ '--i': order } as CSSProperties)

  return (
    <div className={cls} id={`clause-${clause.no}`} style={style}>
      <div
        className="sheet__clause-body"
        role={interactive ? 'button' : undefined}
        tabIndex={interactive ? 0 : undefined}
        onClick={interactive ? () => onClauseClick?.(clause) : undefined}
        onKeyDown={
          interactive
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onClauseClick?.(clause)
                }
              }
            : undefined
        }
      >
        <span className="sheet__no">{clause.no}</span>
        <span className="sheet__text">
          {clause.text}
          <Refs refs={clause.refs} lang={lang} />
        </span>
      </div>
      {clauseSlot?.(clause)}
      {clause.subclauses.map((sub) => (
        <ClauseBody
          key={sub.no || sub.text.slice(0, 24)}
          clause={sub}
          lang={lang}
          activeNo={activeNo}
          onClauseClick={onClauseClick}
          clauseSlot={clauseSlot}
          level={level + 1}
        />
      ))}
    </div>
  )
}

function SectionBody({
  section,
  lang,
  activeNo,
  onClauseClick,
  clauseSlot,
  fresh,
}: {
  section: Section
  lang: DocLang
  activeNo?: string | null
  onClauseClick?: (clause: Clause) => void
  clauseSlot?: (clause: Clause) => ReactNode
  /** Раздел только что пришёл готовым: пункты выезжают каскадом. */
  fresh?: boolean
}) {
  return (
    <section
      className={['sheet__section', fresh ? 'sheet__section--fresh' : ''].filter(Boolean).join(' ')}
      id={`section-${section.no}`}
    >
      <h3 className="sheet__section-title">
        <span className="sheet__no">{section.no}.</span> {section.title}
      </h3>
      {section.clauses.map((c, idx) => (
        <ClauseBody
          key={c.no || c.text.slice(0, 24)}
          clause={c}
          lang={lang}
          activeNo={activeNo}
          onClauseClick={onClauseClick}
          clauseSlot={clauseSlot}
          level={0}
          order={fresh ? idx : undefined}
        />
      ))}
      {section.pending || !section.clauses.length ? (
        <>
          {/* Раздел, которого ещё нет, — призрачные строки набора, а не подпись
              под каждым заголовком: одиннадцать одинаковых «раздел будет
              составлен» читались как список ошибок. Слова остаются для
              программ чтения с экрана. */}
          <div className="sheet__ghost" aria-hidden="true">
            <span className="sheet__ghost-line" style={{ width: '94%' }} />
            <span className="sheet__ghost-line" style={{ width: '88%' }} />
            <span className="sheet__ghost-line" style={{ width: '61%' }} />
          </div>
          <p className="sheet__pending visually-hidden">{PENDING_WORD[lang]}</p>
        </>
      ) : null}
    </section>
  )
}

function TableBody({ table }: { table: DocTable }) {
  return (
    <div className="sheet__table-wrap">
      <div className="sheet__table-title">{table.title}</div>
      <table className="sheet__table">
        <thead>
          <tr>
            {table.columns.map((c) => (
              <th key={c.key} className={c.numeric ? 'sheet__td--num' : undefined}>
                {c.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} className={table.columns[j]?.numeric ? 'sheet__td--num' : undefined}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
          {table.total_row ? (
            <tr className="sheet__tr--total">
              {table.total_row.map((cell, j) => (
                <td key={j} className={table.columns[j]?.numeric ? 'sheet__td--num' : undefined}>
                  {cell}
                </td>
              ))}
            </tr>
          ) : null}
        </tbody>
      </table>
      {table.note ? <p className="sheet__note">{table.note}</p> : null}
    </div>
  )
}

function PartyColumn({ party }: { party: Party }) {
  const lines = [party.name, party.id_no, party.address, party.bank, party.iban, party.bik].filter(
    Boolean,
  )
  return (
    <div className="sheet__party">
      <div className="sheet__party-role">{party.role}</div>
      {lines.map((line, i) => (
        <div key={i} className="sheet__party-line">
          {line}
        </div>
      ))}
      <div className="sheet__sign-line" aria-hidden="true" />
      <div className="sheet__party-line">
        {[party.signatory_role, party.signatory].filter(Boolean).join(' ')}
      </div>
    </div>
  )
}

export function Sheet({
  tree,
  activeNo,
  onClauseClick,
  clauseSlot,
  head,
  freshKeys,
}: {
  tree: DocTree
  /** Пункт, на котором сейчас открыто меню или правка. */
  activeNo?: string | null
  onClauseClick?: (clause: Clause) => void
  /** Вставка под пунктом: меню действий, поле ручной правки. */
  clauseSlot?: (clause: Clause) => ReactNode
  /** Плашка над листом: замечания, ход генерации. */
  head?: ReactNode
  /** Разделы, только что ставшие готовыми: их пункты выезжают каскадом. */
  freshKeys?: ReadonlySet<string>
}) {
  const lang: DocLang =
    tree.meta.lang === 'kk' || tree.meta.lang === 'en' ? tree.meta.lang : 'ru'
  const { requisites } = tree

  const meta = [
    requisites.city ? CITY_WORD[lang](requisites.city) : '',
    requisites.date ? formatDate(requisites.date, lang) : '',
  ].filter(Boolean)

  /* Знак «?» у каждой ссылки без исключения ничего не сообщает: постоянный
     признак читается как оформление, а не как предупреждение. Пока не выверена
     ни одна ссылка, оговорка ставится один раз на весь документ. */
  const anyVerified = tree.sections.some((s) =>
    s.clauses.some(
      (c) =>
        c.refs.some((r) => r.verified) ||
        c.subclauses.some((sub) => sub.refs.some((r) => r.verified)),
    ),
  )
  const anyRefs = tree.sections.some((s) =>
    s.clauses.some((c) => c.refs.length || c.subclauses.some((sub) => sub.refs.length)),
  )

  return (
    <article className={['sheet', anyVerified ? '' : 'sheet--unverified'].filter(Boolean).join(' ')} lang={lang}>
      {head}
      {anyRefs && !anyVerified ? (
        <p className="sheet__disclaimer">{NONE_VERIFIED[lang]}</p>
      ) : null}
      <header className="sheet__head">
        <h2 className="sheet__title">
          {tree.meta.title}
          {requisites.number ? <span className="sheet__number"> № {requisites.number}</span> : null}
        </h2>
        {meta.length ? (
          /* Пустой span в строке реквизитов не безобиден: space-between
             прижимал одинокую дату к левому краю под центрованным заголовком.
             У законопроекта города нет, поэтому строка собирается из того,
             что действительно заполнено. */
          <div className={['sheet__meta', meta.length === 1 ? 'sheet__meta--one' : ''].filter(Boolean).join(' ')}>
            {meta.map((item, i) => (
              <span key={i}>{item}</span>
            ))}
          </div>
        ) : null}
      </header>

      {tree.preamble ? <p className="sheet__preamble">{tree.preamble}</p> : null}

      {tree.sections.map((s) => (
        <SectionBody
          key={s.key ?? s.no}
          section={s}
          lang={lang}
          activeNo={activeNo}
          onClauseClick={onClauseClick}
          clauseSlot={clauseSlot}
          fresh={Boolean(s.key && freshKeys?.has(s.key))}
        />
      ))}

      {tree.tables.map((t) => (
        <TableBody key={t.id} table={t} />
      ))}

      {requisites.parties.length ? (
        <section className="sheet__section">
          <h3 className="sheet__section-title">{SIGNATURES_WORD[lang]}</h3>
          <div className="sheet__parties">
            {requisites.parties.map((p, i) => (
              <PartyColumn key={i} party={p} />
            ))}
          </div>
        </section>
      ) : null}

      {tree.annexes.map((a) => (
        <section className="sheet__annex" key={a.no + a.title}>
          <div className="sheet__annex-head">
            {a.title} {a.no ? `№ ${a.no}` : ''}
          </div>
          {a.table ? <TableBody table={a.table} /> : null}
          {a.sections.map((s) => (
            <SectionBody key={s.no} section={s} lang={lang} />
          ))}
        </section>
      ))}
    </article>
  )
}
