import { useCallback, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Body,
  Button,
  Caption,
  Chip,
  Display,
  H3,
  Input,
  Label,
  Loading,
  Select,
  Textarea,
  UIText,
  useToast,
} from '../../shared/ui'
import { useLang, useT, withLang } from '../../i18n'
import type { Dict } from '../../i18n'
import { api, errorMessage, sse } from '../../shared/api'
import { Sheet } from './Sheet'
import { ContractTabs, ListSkeleton, LoadFailure, useLoader } from './shared'
import {
  PARTY_ATTRS,
  buildPreviewTree,
  docLang,
  partyKey,
  passportPartyField,
  termCovered,
} from './preview'
import type {
  DraftResponse,
  Job,
  JobResponse,
  PassportField,
  PassportResponse,
  PartyKind,
} from './types'
import './contracts.css'
import './contracts.motion.css'

/**
 * Конструктор договора.
 *
 * Слева форма, справа лист. Лист пересобирается на каждое нажатие клавиши и
 * ни разу не спрашивает сервер: смысл экрана в том, что человек печатает
 * наименование стороны и сразу видит его в преамбуле договора, а не ждёт
 * ответа модели, чтобы узнать, как будет выглядеть документ.
 */

const dict: Dict = {
  back: { ru: 'К каталогу', kz: 'Каталогқа', en: 'Back to catalogue' },
  requisites: { ru: 'Реквизиты договора', kz: 'Шарттың деректемелері', en: 'Contract details' },
  number: { ru: 'Номер договора', kz: 'Шарт нөмірі', en: 'Contract number' },
  city: { ru: 'Место заключения', kz: 'Жасалған жері', en: 'Place of signing' },
  date: { ru: 'Дата договора', kz: 'Шарт күні', en: 'Contract date' },
  parties: { ru: 'Стороны', kz: 'Тараптар', en: 'Parties' },

  kind: { ru: 'Вид лица', kz: 'Тұлға түрі', en: 'Type of person' },
  legal: { ru: 'Юридическое лицо', kz: 'Заңды тұлға', en: 'Legal entity' },
  individual: { ru: 'Физическое лицо', kz: 'Жеке тұлға', en: 'Individual' },
  ip: { ru: 'Индивидуальный предприниматель', kz: 'Жеке кәсіпкер', en: 'Sole proprietor' },

  fName: { ru: 'Наименование или ФИО', kz: 'Атауы немесе аты-жөні', en: 'Name' },
  fIdNo: { ru: 'БИН / ИИН', kz: 'БСН / ЖСН', en: 'BIN / IIN' },
  fAddress: { ru: 'Адрес', kz: 'Мекенжайы', en: 'Address' },
  fPhone: { ru: 'Телефон', kz: 'Телефон', en: 'Phone' },
  fEmail: { ru: 'Электронная почта', kz: 'Электрондық пошта', en: 'Email' },
  fBank: { ru: 'Банк', kz: 'Банк', en: 'Bank' },
  fIban: { ru: 'Счёт (IBAN)', kz: 'Шот (IBAN)', en: 'Account (IBAN)' },
  fBik: { ru: 'БИК', kz: 'БСК', en: 'BIC' },
  fSignatory: { ru: 'Подписант (ФИО)', kz: 'Қол қоюшы (аты-жөні)', en: 'Signatory' },
  fSignatoryRole: { ru: 'Должность подписанта', kz: 'Қол қоюшының лауазымы', en: 'Signatory position' },
  fBasis: { ru: 'Действует на основании', kz: 'Негізінде әрекет етеді', en: 'Acting on the basis of' },

  gSubject: { ru: 'Предмет', kz: 'Мәні', en: 'Subject' },
  gTerms: { ru: 'Условия', kz: 'Талаптар', en: 'Terms' },
  gExtra: { ru: 'Дополнительно', kz: 'Қосымша', en: 'Additional' },
  gOther: { ru: 'Прочее', kz: 'Басқа', en: 'Other' },

  essential: { ru: 'Существенные условия', kz: 'Елеулі талаптар', en: 'Essential terms' },
  essentialHint: {
    ru: 'По ст. 393 ГК РК договор без согласованного существенного условия считается незаключённым.',
    kz: 'ҚР АК 393-бабы бойынша елеулі талабы келісілмеген шарт жасалмаған деп саналады.',
    en: 'Under art. 393 of the Civil Code, a contract missing an agreed essential term is deemed not concluded.',
  },
  covered: { ru: 'закрыто', kz: 'жабылды', en: 'covered' },
  notCovered: { ru: 'не заполнено', kz: 'толтырылмаған', en: 'not filled in' },

  risks: { ru: 'Риски', kz: 'Тәуекелдер', en: 'Risks' },
  risksFor: { ru: 'Я —', kz: 'Мен —', en: 'I am the' },
  mitigation: { ru: 'Как закрыть', kz: 'Қалай жабуға болады', en: 'How to mitigate' },
  noRisks: { ru: 'Для этой стороны рисков не описано.', kz: 'Бұл тарап үшін тәуекелдер сипатталмаған.', en: 'No risks described for this party.' },

  notReviewed: { ru: 'Не вычитан юристом', kz: 'Заңгер тексермеген', en: 'Not reviewed by a lawyer' },
  caveat: { ru: 'Оговорка', kz: 'Ескертпе', en: 'Caveat' },

  build: { ru: 'Составить договор', kz: 'Шартты жасау', en: 'Draft the contract' },
  building: { ru: 'Составляем договор', kz: 'Шарт жасалуда', en: 'Drafting the contract' },
  section: { ru: 'Раздел', kz: 'Бөлім', en: 'Section' },
  of: { ru: 'из', kz: '/', en: 'of' },
  titleLabel: { ru: 'Название документа', kz: 'Құжаттың атауы', en: 'Document title' },

  errRequired: { ru: 'Заполните это поле', kz: 'Бұл өрісті толтырыңыз', en: 'Fill in this field' },
  errDigits12: { ru: 'Ровно 12 цифр', kz: 'Дәл 12 сан', en: 'Exactly 12 digits' },
  errNumber: { ru: 'Нужно число', kz: 'Сан қажет', en: 'A number is required' },
  errDate: { ru: 'Дата в формате ГГГГ-ММ-ДД', kz: 'Күн ЖЖЖЖ-АА-КК форматында', en: 'Date as YYYY-MM-DD' },
  errForm: {
    ru: 'Проверьте отмеченные поля',
    kz: 'Белгіленген өрістерді тексеріңіз',
    en: 'Check the highlighted fields',
  },
  errCreate: {
    ru: 'Не удалось создать договор',
    kz: 'Шартты құру мүмкін болмады',
    en: 'Could not create the contract',
  },
  errGenerate: {
    ru: 'Каркас сохранён, но генерация не запустилась',
    kz: 'Қаңқа сақталды, бірақ генерация басталмады',
    en: 'The skeleton is saved, but generation did not start',
  },
  errStream: {
    ru: 'Связь с сервером прервалась. Документ сохранён — откройте его и повторите генерацию.',
    kz: 'Сервермен байланыс үзілді. Құжат сақталды — оны ашып, генерацияны қайталаңыз.',
    en: 'The connection dropped. The document is saved — open it and retry generation.',
  },
}

const PARTY_LABEL: Record<string, string> = {
  name: 'fName',
  id_no: 'fIdNo',
  address: 'fAddress',
  phone: 'fPhone',
  email: 'fEmail',
  bank: 'fBank',
  iban: 'fIban',
  bik: 'fBik',
  signatory: 'fSignatory',
  signatory_role: 'fSignatoryRole',
  basis: 'fBasis',
}

/** Что имеет смысл спрашивать у стороны: у гражданина нет устава и подписанта. */
const ATTRS_BY_KIND: Record<PartyKind, readonly string[]> = {
  legal: PARTY_ATTRS,
  ip: ['name', 'id_no', 'address', 'phone', 'email', 'bank', 'iban', 'bik', 'basis'],
  individual: ['name', 'id_no', 'address', 'phone', 'email', 'bank', 'iban'],
}

const GROUP_ORDER = ['subject', 'terms', 'extra']
const GROUP_LABEL: Record<string, string> = { subject: 'gSubject', terms: 'gTerms', extra: 'gExtra' }

const ID_RE = /^\d{12}$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

type Values = Record<string, string>

export function BuilderPage() {
  const { type = '' } = useParams()
  const t = useT(dict)
  const { lang } = useLang()
  const dl = docLang(lang)
  const navigate = useNavigate()
  const toast = useToast()

  const { data, error, loading, reload } = useLoader<PassportResponse>(
    () => api.get<PassportResponse>(`/drafts/passport/${encodeURIComponent(type)}?lang=${dl}`),
    [type, dl],
  )
  const passport = data?.passport ?? null

  const [values, setValues] = useState<Values>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [submitted, setSubmitted] = useState(false)
  const [riskParty, setRiskParty] = useState(0)
  const [job, setJob] = useState<Job | null>(null)
  const [busy, setBusy] = useState(false)

  const set = useCallback((name: string, v: string) => {
    setValues((prev) => ({ ...prev, [name]: v }))
  }, [])

  const markTouched = useCallback((name: string) => {
    setTouched((prev) => (prev[name] ? prev : { ...prev, [name]: true }))
  }, [])

  /** Вид лица по умолчанию — первый допустимый для роли из паспорта. */
  const partyKind = useCallback(
    (idx: number): PartyKind => {
      const raw = values[partyKey(idx, 'kind')]
      if (raw === 'legal' || raw === 'individual' || raw === 'ip') return raw
      return (passport?.parties[idx]?.kinds[0] as PartyKind) ?? 'legal'
    },
    [values, passport],
  )

  /* ------------------------------- проверка ------------------------------- */

  const errors = useMemo(() => {
    const out: Record<string, string> = {}
    if (!passport) return out

    const checkValue = (name: string, v: string, kind: string, required: boolean) => {
      const value = (v ?? '').trim()
      if (required && !value) {
        out[name] = t('errRequired')
        return
      }
      if (!value) return
      if (kind === 'iin' || kind === 'bin' || kind === 'iin_bin') {
        if (!ID_RE.test(value)) out[name] = t('errDigits12')
      } else if (kind === 'number' || kind === 'money') {
        if (!Number.isFinite(Number(value.replace(/\s/g, '').replace(',', '.')))) {
          out[name] = t('errNumber')
        }
      } else if (kind === 'date') {
        if (!DATE_RE.test(value)) out[name] = t('errDate')
      }
    }

    for (const f of passport.fields) {
      checkValue(f.name, values[f.name] ?? '', f.type, f.required)
    }
    // Реквизиты сторон: наименование и ИИН/БИН обязательны — без них
    // договор не идентифицирует того, кто его заключил.
    passport.parties.forEach((_spec, idx) => {
      const allowed = ATTRS_BY_KIND[partyKind(idx)]
      for (const attr of allowed) {
        if (passportPartyField(passport, idx, attr)) continue
        const name = partyKey(idx, attr)
        checkValue(name, values[name] ?? '', attr === 'id_no' ? 'iin_bin' : 'text', attr === 'name' || attr === 'id_no')
      }
    })
    checkValue('date', values.date ?? '', 'date', false)
    return out
  }, [passport, values, partyKind, t])

  const errorFor = (name: string) =>
    (submitted || touched[name]) && errors[name] ? errors[name] : undefined

  /* --------------------------------- лист --------------------------------- */

  const tree = useMemo(
    () => (passport ? buildPreviewTree(passport, values, dl) : null),
    [passport, values, dl],
  )

  /* ------------------------------- генерация ------------------------------- */

  const submit = async () => {
    if (!passport) return
    setSubmitted(true)
    if (Object.keys(errors).length) {
      toast(t('errForm'), 'err')
      return
    }
    setBusy(true)
    let draftId = ''
    try {
      // Каркас приходит мгновенно: документ существует ещё до того, как
      // модель напишет первый раздел, и не теряется при обрыве генерации.
      const created = await api.post<DraftResponse>('/drafts', {
        type_id: passport.id,
        lang: dl,
        values: { ...values, lang: dl },
        title: values.title || undefined,
      })
      draftId = created.draft.id
    } catch (e) {
      setBusy(false)
      toast(errorMessage(e, t('errCreate')), 'err')
      return
    }

    let jobId = ''
    try {
      const started = await api.post<JobResponse>(`/drafts/${draftId}/generate`, {})
      setJob(started.job)
      jobId = started.job.id
    } catch (e) {
      setBusy(false)
      toast(errorMessage(e, t('errGenerate')), 'err')
      navigate(withLang(`/contracts/${draftId}`, lang))
      return
    }

    const stop = sse<Job>(
      `/drafts/jobs/${jobId}/events`,
      (j) => {
        setJob(j)
        if (j.status === 'done' || j.status === 'failed' || j.status === 'cancelled') {
          stop()
          setBusy(false)
          if (j.status === 'failed' && j.error) toast(j.error, 'err')
          navigate(withLang(`/contracts/${draftId}`, lang))
        }
      },
      () => {
        // Браузер переподключается сам; документ уже сохранён, поэтому
        // безопаснее увести человека на документ, чем держать его в ожидании.
        stop()
        setBusy(false)
        toast(t('errStream'), 'err')
        navigate(withLang(`/contracts/${draftId}`, lang))
      },
    )
  }

  /* -------------------------------- разметка -------------------------------- */

  if (loading) {
    return (
      <div className="page">
        <ContractTabs />
        <ListSkeleton rows={10} />
      </div>
    )
  }
  if (error || !passport || !tree) {
    return (
      <div className="page">
        <ContractTabs />
        <div className="ct-state">
          <LoadFailure error={error} onRetry={reload} />
        </div>
      </div>
    )
  }

  const commonFields = passport.fields.filter((f) => f.party === null || f.party === undefined)
  const groups = [
    ...GROUP_ORDER.filter((g) => commonFields.some((f) => f.group === g)),
    ...[...new Set(commonFields.map((f) => f.group))].filter((g) => !GROUP_ORDER.includes(g)),
  ]

  const progress = job?.progress
  const percent = progress && progress.total ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <div className="page ct-builder">
      <div className="page__head">
        <div className="page__title">
          <Display>{passport.name}</Display>
          <Body tone="mute">{passport.summary}</Body>
        </div>
      </div>

      <ContractTabs />

      {passport.reviewed ? null : (
        <div className="ct-flag ct-flag--warn">
          <span className="status status--warn">{t('notReviewed')}</span>
        </div>
      )}
      {passport.caveat ? (
        <div className="ct-flag">
          <Label as="div">{t('caveat')}</Label>
          <Caption tone="ink2">{passport.caveat}</Caption>
        </div>
      ) : null}

      <div className="ct-split">
        {/* ------------------------------ форма ------------------------------ */}
        <div className="ct-split__form">
          <section className="ct-group">
            <div className="ct-group__head">
              <H3>{t('requisites')}</H3>
            </div>
            <div className="ct-grid">
              <Input
                label={t('number')}
                value={values.number ?? ''}
                onChange={(e) => set('number', e.target.value)}
                onBlur={() => markTouched('number')}
              />
              <Input
                label={t('city')}
                value={values.city ?? ''}
                onChange={(e) => set('city', e.target.value)}
                onBlur={() => markTouched('city')}
              />
              <Input
                label={t('date')}
                type="date"
                value={values.date ?? ''}
                error={errorFor('date')}
                onChange={(e) => set('date', e.target.value)}
                onBlur={() => markTouched('date')}
              />
              <Input
                label={t('titleLabel')}
                value={values.title ?? ''}
                placeholder={passport.name}
                onChange={(e) => set('title', e.target.value)}
              />
            </div>
          </section>

          {passport.parties.map((spec, idx) => {
            const kind = partyKind(idx)
            const attrs = ATTRS_BY_KIND[kind]
            const own = passport.fields.filter((f) => f.party === idx)
            return (
              <section className="ct-group" key={`${spec.role}-${idx}`}>
                <div className="ct-group__head">
                  <H3>{spec.role}</H3>
                  <Caption tone="mute">
                    {t('parties')} {idx + 1}
                  </Caption>
                </div>
                <div className="ct-grid">
                  {spec.kinds.length > 1 ? (
                    <Select
                      label={t('kind')}
                      value={kind}
                      onChange={(e) => set(partyKey(idx, 'kind'), e.target.value)}
                    >
                      {spec.kinds.map((k) => (
                        <option key={k} value={k}>
                          {t(k)}
                        </option>
                      ))}
                    </Select>
                  ) : null}

                  {attrs.map((attr) => {
                    const declared = passportPartyField(passport, idx, attr)
                    if (declared) {
                      return (
                        <FieldControl
                          key={declared.name}
                          field={declared}
                          value={values[declared.name] ?? ''}
                          error={errorFor(declared.name)}
                          onChange={(v) => set(declared.name, v)}
                          onBlur={() => markTouched(declared.name)}
                        />
                      )
                    }
                    const name = partyKey(idx, attr)
                    const isId = attr === 'id_no'
                    const control = (
                      <Input
                        label={t(PARTY_LABEL[attr])}
                        value={values[name] ?? ''}
                        error={errorFor(name)}
                        inputMode={isId ? 'numeric' : undefined}
                        maxLength={isId ? 12 : undefined}
                        onChange={(e) => set(name, e.target.value)}
                        onBlur={() => markTouched(name)}
                      />
                    )
                    return attr === 'address' ? (
                      <div key={name} className="ct-grid__wide">
                        {control}
                      </div>
                    ) : (
                      <div key={name}>{control}</div>
                    )
                  })}

                  {own
                    .filter((f) => !PARTY_ATTRS.some((a) => f.name === a || f.name.endsWith('_' + a)))
                    .map((f) => (
                      <FieldControl
                        key={f.name}
                        field={f}
                        value={values[f.name] ?? ''}
                        error={errorFor(f.name)}
                        onChange={(v) => set(f.name, v)}
                        onBlur={() => markTouched(f.name)}
                      />
                    ))}
                </div>
              </section>
            )
          })}

          {groups.map((g) => (
            <section className="ct-group" key={g}>
              <div className="ct-group__head">
                <H3>{GROUP_LABEL[g] ? t(GROUP_LABEL[g]) : t('gOther')}</H3>
              </div>
              <div className="ct-grid">
                {commonFields
                  .filter((f) => f.group === g)
                  .map((f) => (
                    <FieldControl
                      key={f.name}
                      field={f}
                      value={values[f.name] ?? ''}
                      error={errorFor(f.name)}
                      onChange={(v) => set(f.name, v)}
                      onBlur={() => markTouched(f.name)}
                    />
                  ))}
              </div>
            </section>
          ))}

          <div className="ct-actions">
            <Button variant="primary" size="lg" onClick={submit} disabled={busy}>
              {busy ? t('building') : t('build')}
            </Button>
          </div>

          {busy ? (
            <div className="ct-progress" role="status" aria-live="polite">
              <Loading label={t('building')} />
              <UIText tone="mute">
                {progress && progress.total
                  ? `${t('section')} ${progress.done} ${t('of')} ${progress.total}${
                      progress.label ? `: ${progress.label}` : ''
                    } · ${percent}%`
                  : t('building')}
              </UIText>
            </div>
          ) : null}
        </div>

        {/* ------------------------- лист и панели ------------------------- */}
        <aside className="ct-split__aside">
          <div className="ct-paper">
            <Sheet tree={tree} />
          </div>

          <section className="ct-panel">
            <div className="ct-panel__head">
              <Label as="h3">{t('essential')}</Label>
            </div>
            <Caption tone="mute">{t('essentialHint')}</Caption>
            <ul className="ct-terms">
              {passport.essential_terms.map((term) => {
                const ok = termCovered(term.fields, values)
                return (
                  <li key={term.key} className="ct-term">
                    <span className={ok ? 'status status--ok' : 'status status--err'}>
                      {ok ? '✓' : '—'}
                    </span>
                    <span className="ct-term__body">
                      <UIText>{term.label}</UIText>
                      {term.basis ? <span className="cite ct-term__cite">{term.basis}</span> : null}
                      <Caption tone="mute" className="ct-term__state">
                        {ok ? t('covered') : t('notCovered')}
                      </Caption>
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>

          <section className="ct-panel">
            <div className="ct-panel__head">
              <Label as="h3">{t('risks')}</Label>
              <div className="ct-panel__switch">
                <Caption tone="mute">{t('risksFor')}</Caption>
                {passport.parties.map((spec, idx) => (
                  <Chip key={idx} active={riskParty === idx} onClick={() => setRiskParty(idx)}>
                    {spec.role}
                  </Chip>
                ))}
              </div>
            </div>
            <ul className="ct-risks">
              {passport.risks
                .filter((r) => r.party === riskParty)
                .map((r, i) => (
                  <li key={i} className="ct-risk swap">
                    <Body>{r.text}</Body>
                    {r.mitigation ? (
                      <Caption tone="mute" className="ct-risk__fix">
                        {t('mitigation')}: {r.mitigation}
                      </Caption>
                    ) : null}
                  </li>
                ))}
              {passport.risks.some((r) => r.party === riskParty) ? null : (
                <li className="ct-risk">
                  <Caption tone="mute">{t('noRisks')}</Caption>
                </li>
              )}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  )
}

/* --------------------------- поле по описанию паспорта --------------------------- */

function FieldControl({
  field,
  value,
  error,
  onChange,
  onBlur,
}: {
  field: PassportField
  value: string
  error?: string
  onChange: (v: string) => void
  onBlur: () => void
}) {
  const label = field.unit ? `${field.label}, ${field.unit}` : field.label
  const hint = field.hint ?? undefined

  if (field.type === 'textarea') {
    return (
      <div className="ct-grid__wide">
        <Textarea
          label={label}
          hint={hint}
          error={error}
          onBlur={onBlur}
          placeholder={field.placeholder ?? undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    )
  }
  if (field.type === 'select') {
    return (
      <Select
        label={label}
        hint={hint}
        error={error}
        onBlur={onBlur}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">—</option>
        {field.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    )
  }

  const isId = field.type === 'iin' || field.type === 'bin' || field.type === 'iin_bin'
  return (
    <Input
      label={label}
      hint={hint}
      error={error}
      onBlur={onBlur}
      placeholder={field.placeholder ?? undefined}
      type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'}
      inputMode={isId ? 'numeric' : field.type === 'money' ? 'decimal' : undefined}
      maxLength={isId ? 12 : undefined}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}
