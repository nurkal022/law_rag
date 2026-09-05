import { useCallback, useMemo, useState } from 'react'
import type { DragEvent } from 'react'

import {
  Body,
  Button,
  Caption,
  Chip,
  Cite,
  Display,
  Empty,
  Input,
  Label,
  Select,
  Status,
  Tabs,
  Textarea,
  UIText,
  useToast,
} from '../../shared/ui'
import type { StatusKind, TabItem } from '../../shared/ui'
import { useLang, useT } from '../../i18n'
import type { Dict, Lang } from '../../i18n'
import { citeCode } from '../legal/cite'

import './contracts.css'
import {
  CONTRACT_TYPES,
  COMMON_FIELDS,
  FINDINGS,
  GROUP_LABEL,
  GROUP_ORDER,
  PARAGRAPHS,
  POSITIONS,
  SECTIONS,
  tr,
} from './data'
import type { ContractType, FieldDef, GroupId, Position } from './data'

/* ------------------------------------------------------------
   Словарь экрана
   ------------------------------------------------------------ */

const dict: Dict = {
  title: { ru: 'Договоры', kz: 'Шарттар', en: 'Contracts' },
  lead: {
    ru: 'Составление договора по праву Республики Казахстан и проверка чужого текста на риски.',
    kz: 'Қазақстан Республикасының құқығы бойынша шарт жасау және бөтен мәтінді тәуекелге тексеру.',
    en: 'Drafting a contract under Kazakhstan law and checking someone else’s text for risk.',
  },

  tabDraft: { ru: 'Составить', kz: 'Жасау', en: 'Draft' },
  tabReview: { ru: 'Проверить', kz: 'Тексеру', en: 'Review' },

  typeLabel: { ru: 'Тип договора', kz: 'Шарт түрі', en: 'Contract type' },
  typeHint: {
    ru: 'Девять типов, поддержанных системой',
    kz: 'Жүйе қолдайтын тоғыз түр',
    en: 'Nine types supported by the system',
  },
  build: { ru: 'Составить договор', kz: 'Шартты жасау', en: 'Draft the contract' },
  saveToMatter: { ru: 'Сохранить в дело', kz: 'Іске сақтау', en: 'Save to matter' },
  saved: {
    ru: 'Проект договора сохранён в дело',
    kz: 'Шарт жобасы іске сақталды',
    en: 'Draft saved to the matter',
  },
  requiredHint: {
    ru: 'Обязательное поле',
    kz: 'Міндетті өріс',
    en: 'Required field',
  },

  previewLabel: { ru: 'Предпросмотр', kz: 'Алдын ала қарау', en: 'Preview' },
  previewEmptyTitle: { ru: 'Договор не составлен', kz: 'Шарт жасалмаған', en: 'No contract yet' },
  previewEmptyBody: {
    ru: 'Заполните поля слева и нажмите «Составить договор». Текст соберётся по разделам выбранного типа с указанием применённых норм.',
    kz: 'Сол жақтағы өрістерді толтырып, «Шартты жасау» түймесін басыңыз. Мәтін таңдалған түрдің бөлімдері бойынша, қолданылған нормаларды көрсете отырып жиналады.',
    en: 'Fill in the fields on the left and press “Draft the contract”. The text is assembled section by section with the norms applied.',
  },
  docKind: { ru: 'Договор', kz: 'Шарт', en: 'Agreement' },
  norms: { ru: 'Применённые нормы', kz: 'Қолданылған нормалар', en: 'Norms applied' },
  preamble: {
    ru: '{p1}, именуемое в дальнейшем «Сторона 1», с одной стороны, и {p2}, именуемое в дальнейшем «Сторона 2», с другой стороны, совместно именуемые «Стороны», заключили настоящий договор о нижеследующем.',
    kz: '{p1}, бұдан әрі «1-тарап» деп аталатын, бір тараптан, және {p2}, бұдан әрі «2-тарап» деп аталатын, екінші тараптан, бірлесіп «Тараптар» деп аталатындар осы шартты төмендегілер туралы жасасты.',
    en: '{p1}, hereinafter “Party 1”, of the one part, and {p2}, hereinafter “Party 2”, of the other part, jointly the “Parties”, have entered into this agreement as follows.',
  },
  currency: { ru: 'тенге', kz: 'теңге', en: 'KZT' },
  blank: { ru: '—', kz: '—', en: '—' },

  /* --- Проверка --- */
  dropTitle: {
    ru: 'Перетащите файл договора сюда',
    kz: 'Шарт файлын осында сүйреп әкеліңіз',
    en: 'Drag the contract file here',
  },
  dropHint: {
    ru: 'DOCX, PDF или TXT — либо вставьте текст в поле ниже',
    kz: 'DOCX, PDF немесе TXT — не мәтінді төмендегі өріске қойыңыз',
    en: 'DOCX, PDF or TXT — or paste the text into the field below',
  },
  dropFile: { ru: 'Файл', kz: 'Файл', en: 'File' },
  dropClear: { ru: 'Убрать', kz: 'Алып тастау', en: 'Remove' },
  textLabel: { ru: 'Текст договора', kz: 'Шарт мәтіні', en: 'Contract text' },
  textPlaceholder: {
    ru: 'Вставьте текст проверяемого договора…',
    kz: 'Тексерілетін шарттың мәтінін қойыңыз…',
    en: 'Paste the text of the contract to be reviewed…',
  },
  positionLabel: { ru: 'Позиция', kz: 'Ұстаным', en: 'Position' },
  run: { ru: 'Проверить договор', kz: 'Шартты тексеру', en: 'Review the contract' },
  reviewEmptyTitle: { ru: 'Договор не проверен', kz: 'Шарт тексерілмеген', en: 'Nothing reviewed' },
  reviewEmptyBody: {
    ru: 'Загрузите файл или вставьте текст, выберите позицию и запустите проверку. Найденное разбирается по пунктам с указанием нормы.',
    kz: 'Файл жүктеңіз немесе мәтін қойыңыз, ұстанымды таңдап, тексеруді іске қосыңыз. Табылғандар нормасы көрсетіле отырып тармақтап талданады.',
    en: 'Upload a file or paste text, choose a position and run the review. Findings are set out clause by clause with the norm cited.',
  },
  critical: { ru: 'Критичных', kz: 'Сыни', en: 'Critical' },
  remarks: { ru: 'Замечаний', kz: 'Ескертулер', en: 'Remarks' },
  clean: { ru: 'Без замечаний', kz: 'Ескертусіз', en: 'Clean' },
  found: { ru: 'Найдено', kz: 'Табылды', en: 'Findings' },
  advice: { ru: 'Рекомендация', kz: 'Ұсыным', en: 'Recommendation' },
  levelErr: { ru: 'критично', kz: 'сыни', en: 'critical' },
  levelWarn: { ru: 'замечание', kz: 'ескерту', en: 'remark' },
  levelOk: { ru: 'в порядке', kz: 'ретінде', en: 'in order' },
}

/* ------------------------------------------------------------
   Вспомогательное
   ------------------------------------------------------------ */

type Values = Record<string, string>

function fill(template: string, subs: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => subs[key] ?? '—')
}

function fieldsOf(type: ContractType): FieldDef[] {
  return [...COMMON_FIELDS, ...type.fields]
}

/* ------------------------------------------------------------
   Поле формы
   ------------------------------------------------------------ */

function FormField({
  field,
  lang,
  value,
  onChange,
  requiredHint,
}: {
  field: FieldDef
  lang: Lang
  value: string
  onChange: (name: string, v: string) => void
  requiredHint: string
}) {
  const label = tr(field.label, lang)
  const hint = field.required ? requiredHint : undefined

  if (field.kind === 'textarea') {
    return (
      <div className="ct-grid__wide">
        <Textarea
          label={label}
          hint={hint}
          value={value}
          onChange={(e) => onChange(field.name, e.target.value)}
        />
      </div>
    )
  }

  if (field.kind === 'select') {
    return (
      <Select
        label={label}
        hint={hint}
        value={value}
        onChange={(e) => onChange(field.name, e.target.value)}
      >
        <option value="">—</option>
        {(field.options ?? []).map((o) => (
          <option key={o.value} value={o.value}>
            {tr(o.label, lang)}
          </option>
        ))}
      </Select>
    )
  }

  return (
    <Input
      type={field.kind === 'number' ? 'number' : field.kind === 'date' ? 'date' : 'text'}
      label={label}
      hint={hint}
      value={value}
      onChange={(e) => onChange(field.name, e.target.value)}
    />
  )
}

/* ------------------------------------------------------------
   Предпросмотр договора
   ------------------------------------------------------------ */

function Preview({
  type,
  values,
  lang,
  t,
}: {
  type: ContractType
  values: Values
  lang: Lang
  t: (k: string) => string
}) {
  const dash = t('blank')
  const p1 = values.party1_name || dash
  const p2 = values.party2_name || dash

  const all = fieldsOf(type)
  const moneyField = all.find((f) => f.group === 'money' && values[f.name])
  const amount = moneyField ? `${values[moneyField.name]} ${t('currency')}` : dash

  const subjectField = all.find((f) => f.group === 'subject' && values[f.name])
  const subject = subjectField ? values[subjectField.name] : dash

  const termField = all.find(
    (f) => f.group === 'terms' && f.name !== 'city' && f.name !== 'contract_date' && values[f.name],
  )
  const term = termField ? values[termField.name] : dash

  const subs = {
    p1,
    p2,
    amount,
    subject,
    term,
    legal: tr(type.legalBasis, lang),
  }

  return (
    <div className="ct-doc">
      <div className="ct-doc__head">
        <Label>{t('docKind')}</Label>
        <div className="ct-doc__title">{tr(type.name, lang)}</div>
        <div className="ct-doc__meta">
          <span>{values.city || dash}</span>
          <span>{values.contract_date || dash}</span>
          <span>{tr(type.legalBasis, lang)}</span>
        </div>
      </div>

      <p className="ct-doc__preamble">{fill(t('preamble'), subs)}</p>

      {type.sections.map((key, i) => {
        const section = SECTIONS[key]
        if (!section) return null
        return (
          <section className="ct-sec" key={key}>
            <h3 className="ct-sec__title">
              <span className="ct-sec__num">{i + 1}.</span>
              {tr(section.title, lang)}
            </h3>
            <p className="ct-sec__body">{fill(tr(PARAGRAPHS[section.kind], lang), subs)}</p>
          </section>
        )
      })}

      <div className="ct-norms">
        <div style={{ paddingTop: 'var(--s-4)' }}>
          <Label>{t('norms')}</Label>
        </div>
        {type.norms.map((n) => (
          <div className="ct-norm" key={n.code}>
            <Cite code={citeCode(n.code, lang)} />
            <span className="ct-norm__note">{tr(n.note, lang)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------
   Вкладка «Составить»
   ------------------------------------------------------------ */

function DraftTab({ lang, t }: { lang: Lang; t: (k: string) => string }) {
  const toast = useToast()
  // Тип выбран сразу: пустой экран не показывает ни формы, ни предпросмотра
  // и не даёт понять, что тут вообще происходит.
  const [typeId, setTypeId] = useState<string>('supply')
  const [values, setValues] = useState<Values>({})
  const [built, setBuilt] = useState(false)

  const type = useMemo(() => CONTRACT_TYPES.find((c) => c.id === typeId), [typeId])

  const setValue = useCallback((name: string, v: string) => {
    setValues((prev) => ({ ...prev, [name]: v }))
  }, [])

  const grouped = useMemo(() => {
    if (!type) return [] as { id: GroupId; fields: FieldDef[] }[]
    const all = fieldsOf(type)
    return GROUP_ORDER.map((id) => ({ id, fields: all.filter((f) => f.group === id) })).filter(
      (g) => g.fields.length > 0,
    )
  }, [type])

  return (
    <div className="ct-split">
      <div className="ct-split__main">
        <Label>{t('typeLabel')}</Label>
        <Caption tone="mute">{t('typeHint')}</Caption>

        <div className="ct-types">
          {CONTRACT_TYPES.map((c) => (
            <button
              type="button"
              key={c.id}
              className={['ct-type', c.id === typeId ? 'ct-type--on' : ''].filter(Boolean).join(' ')}
              aria-pressed={c.id === typeId}
              onClick={() => {
                setTypeId(c.id)
                setBuilt(false)
              }}
            >
              <span className="ct-type__name">{tr(c.name, lang)}</span>
              <span className="ct-type__desc">{tr(c.description, lang)}</span>
            </button>
          ))}
        </div>

        {type ? (
          <>
            {grouped.map((g) => (
              <div className="ct-group" key={g.id}>
                <div className="ct-group__head">
                  <Label>{tr(GROUP_LABEL[g.id], lang)}</Label>
                  {g.id === 'parties' ? <Caption tone="mute">{tr(type.legalBasis, lang)}</Caption> : null}
                </div>
                <div className="ct-grid">
                  {g.fields.map((f) => (
                    <FormField
                      key={f.name}
                      field={f}
                      lang={lang}
                      value={values[f.name] ?? ''}
                      onChange={setValue}
                      requiredHint={t('requiredHint')}
                    />
                  ))}
                </div>
              </div>
            ))}

            <div className="ct-actions">
              <Button variant="primary" onClick={() => setBuilt(true)}>
                {t('build')}
              </Button>
              <Button onClick={() => toast(t('saved'), 'ok')}>{t('saveToMatter')}</Button>
            </div>
          </>
        ) : null}
      </div>

      <aside className="ct-split__aside">
        <Label>{t('previewLabel')}</Label>
        <div style={{ marginTop: 'var(--s-4)' }}>
          {type && built ? (
            <Preview type={type} values={values} lang={lang} t={t} />
          ) : (
            <Empty title={t('previewEmptyTitle')}>{t('previewEmptyBody')}</Empty>
          )}
        </div>
      </aside>
    </div>
  )
}

/* ------------------------------------------------------------
   Вкладка «Проверить»
   ------------------------------------------------------------ */

function ReviewTab({ lang, t }: { lang: Lang; t: (k: string) => string }) {
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState('')
  const [over, setOver] = useState(false)
  const [position, setPosition] = useState<Position>('neutral')
  const [checked, setChecked] = useState(false)

  const accept = useCallback((file: File) => {
    setFileName(file.name)
    file
      .text()
      .then((v) => setText(v.slice(0, 20000)))
      .catch(() => setText(''))
  }, [])

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setOver(false)
      const file = e.dataTransfer.files?.[0]
      if (file) accept(file)
    },
    [accept],
  )

  const levelWord: Record<StatusKind, string> = {
    err: t('levelErr'),
    warn: t('levelWarn'),
    ok: t('levelOk'),
    idle: t('levelOk'),
  }

  const counts = useMemo(() => {
    let err = 0
    let warn = 0
    let ok = 0
    for (const f of FINDINGS) {
      const l = f.level[position]
      if (l === 'err') err += 1
      else if (l === 'warn') warn += 1
      else ok += 1
    }
    return { err, warn, ok }
  }, [position])

  const ready = text.trim().length > 0 || fileName.length > 0

  return (
    <div className="ct-split">
      <div className="ct-split__main">
        <div
          className={['ct-drop', over ? 'ct-drop--over' : ''].filter(Boolean).join(' ')}
          onDragOver={(e) => {
            e.preventDefault()
            setOver(true)
          }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
        >
          {fileName ? (
            <div className="ct-drop__file">
              <UIText>
                {t('dropFile')}: {fileName}
              </UIText>
              <Button
                variant="ghost"
                onClick={() => {
                  setFileName('')
                  setText('')
                  setChecked(false)
                }}
              >
                {t('dropClear')}
              </Button>
            </div>
          ) : (
            <>
              <Body>{t('dropTitle')}</Body>
              <Caption tone="mute">{t('dropHint')}</Caption>
            </>
          )}
        </div>

        <Textarea
          label={t('textLabel')}
          placeholder={t('textPlaceholder')}
          value={text}
          rows={10}
          onChange={(e) => {
            setText(e.target.value)
            setChecked(false)
          }}
        />

        <div className="ct-chips">
          <Label>{t('positionLabel')}</Label>
          {POSITIONS.map((p) => (
            <Chip key={p.id} active={p.id === position} onClick={() => setPosition(p.id)}>
              {tr(p.label, lang)}
            </Chip>
          ))}
        </div>

        <div className="ct-actions">
          <Button variant="primary" disabled={!ready} onClick={() => setChecked(true)}>
            {t('run')}
          </Button>
        </div>
      </div>

      <aside className="ct-split__aside">
        {checked ? (
          <>
            <div className="ct-summary">
              <div className="ct-summary__item">
                <Label>{t('critical')}</Label>
                <span className={`ct-summary__value ${counts.err > 0 ? 'tone-err' : 'tone-mute'}`}>
                  {counts.err}
                </span>
              </div>
              <div className="ct-summary__item">
                <Label>{t('remarks')}</Label>
                <span className={`ct-summary__value ${counts.warn > 0 ? 'tone-warn' : 'tone-mute'}`}>
                  {counts.warn}
                </span>
              </div>
              <div className="ct-summary__item">
                <Label>{t('clean')}</Label>
                <span className="ct-summary__value tone-ok">{counts.ok}</span>
              </div>
            </div>

            <div className="ct-findings">
              {FINDINGS.map((f) => {
                const level = f.level[position]
                return (
                  <article className="ct-finding" key={f.id}>
                    <div className="ct-finding__head">
                      <Status kind={level}>{levelWord[level]}</Status>
                      <Caption tone="mute">{tr(f.where, lang)}</Caption>
                    </div>

                    <p className="ct-finding__problem">{tr(f.problem, lang)}</p>
                    <p className="ct-finding__quote">{tr(f.quote, lang)}</p>

                    <div className="ct-finding__norm">
                      <Cite code={citeCode(f.cite, lang)} />
                      <Caption tone="mute">{tr(f.citeNote, lang)}</Caption>
                    </div>

                    <p className="ct-finding__advice">
                      {t('advice')}. {tr(f.advice, lang)}
                    </p>
                  </article>
                )
              })}
            </div>
          </>
        ) : (
          <>
            <Label>{t('found')}</Label>
            <div style={{ marginTop: 'var(--s-4)' }}>
              <Empty title={t('reviewEmptyTitle')}>{t('reviewEmptyBody')}</Empty>
            </div>
          </>
        )}
      </aside>
    </div>
  )
}

/* ------------------------------------------------------------
   Экран
   ------------------------------------------------------------ */

export function ContractsPage() {
  const t = useT(dict)
  const { lang } = useLang()
  const [tab, setTab] = useState('draft')

  const tabs: TabItem[] = [
    { id: 'draft', label: t('tabDraft') },
    { id: 'review', label: t('tabReview') },
  ]

  return (
    <div className="page">
      <div className="page__head">
        <div className="page__title">
          <Display>{t('title')}</Display>
          <Body tone="mute">{t('lead')}</Body>
        </div>
      </div>

      <Tabs items={tabs} value={tab} onChange={setTab} />

      {tab === 'draft' ? <DraftTab lang={lang} t={t} /> : <ReviewTab lang={lang} t={t} />}
    </div>
  )
}
