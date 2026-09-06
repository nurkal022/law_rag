import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Body,
  Button,
  Caption,
  Display,
  H3,
  Label,
  Loading,
  UIText,
  useToast,
} from '../../shared/ui'
import { useLang, useT, withLang } from '../../i18n'
import type { Dict } from '../../i18n'
import { api, errorMessage, sse } from '../../shared/api'
import { Sheet } from '../drafts/Sheet'
import { ListSkeleton, LoadFailure, useLoader } from '../drafts/shared'
import { FieldControl, validateField } from '../drafts/FieldControl'
import { buildPreviewTree, docLang, hasValue, termCovered } from '../drafts/preview'
import type { DraftResponse, Job, JobResponse, Passport, PassportField, PassportResponse } from '../drafts/types'
import { LawTabs } from './shared'
import '../drafts/drafts.css'
import '../drafts/drafts.motion.css'
import './laws.css'

/**
 * Мастер законопроекта.
 *
 * Семнадцать полей паспорта в один экран не помещаются: форма уезжала на два
 * с половиной оборота прокрутки, и человек бросал её на «международном опыте»,
 * не дойдя до бюджета. Поэтому шаги — и последний из них не поле, а сводка:
 * прежде чем запускать модель на одиннадцать разделов, надо видеть, что
 * именно уйдёт в работу и чего не хватает.
 *
 * Сторон у законопроекта нет — ни блока «Стороны» в форме, ни подписей на
 * листе. Пустой passport.parties делает это сам, отдельной ветки здесь нет.
 */

const dict: Dict = {
  title: { ru: 'Новый законопроект', kz: 'Жаңа заң жобасы', en: 'New draft law' },

  step: { ru: 'Шаг', kz: 'Қадам', en: 'Step' },
  of: { ru: 'из', kz: '/', en: 'of' },
  back: { ru: 'Назад', kz: 'Артқа', en: 'Back' },
  next: { ru: 'Далее', kz: 'Әрі қарай', en: 'Next' },

  s1: { ru: 'Реквизиты', kz: 'Деректемелер', en: 'Details' },
  s1lead: {
    ru: 'Название закона и кто вносит его в Мажилис. Право законодательной инициативы — ст. 61 Конституции РК.',
    kz: 'Заңның атауы және оны Мәжіліске кім енгізеді. Заң шығару бастамасы құқығы — ҚР Конституциясының 61-бабы.',
    en: 'The title of the law and who submits it to the Mazhilis. The right of legislative initiative — art. 61 of the Constitution.',
  },
  s2: { ru: 'Проблема и цели', kz: 'Мәселе және мақсаттар', en: 'Problem and goals' },
  s2lead: {
    ru: 'Из этого собирается пояснительная записка: что не работает сейчас, чего добивается закон и кого это затрагивает.',
    kz: 'Бұдан түсіндірме жазба жиналады: қазір не жұмыс істемейді, заң неге қол жеткізеді және бұл кімге қатысты.',
    en: 'The explanatory note is built from this: what fails today, what the law achieves and who is affected.',
  },
  s3: { ru: 'Обоснование', kz: 'Негіздеме', en: 'Justification' },
  s3lead: {
    ru: 'Правовая, финансовая и регуляторная части. Без них финансово-экономическое обоснование и ОРВ соберутся из общих слов.',
    kz: 'Құқықтық, қаржылық және реттеушілік бөліктер. Оларсыз қаржы-экономикалық негіздеме мен РӘБ жалпы сөздерден жиналады.',
    en: 'The legal, financial and regulatory parts. Without them the financial justification and the impact assessment come out as platitudes.',
  },
  s4: { ru: 'Проверка', kz: 'Тексеру', en: 'Review' },
  s4lead: {
    ru: 'Что войдёт в пакет и чего не хватает. Незаполненное поле не отменяет раздел — модель напишет его на общих основаниях, и это будет видно.',
    kz: 'Топтамаға не кіреді және не жетіспейді. Толтырылмаған өріс бөлімді жоймайды — модель оны жалпы негізде жазады, бұл көрініп тұрады.',
    en: 'What goes into the package and what is missing. An empty field does not remove a section — the model writes it in general terms, and that shows.',
  },

  gLegal: { ru: 'Правовое обоснование', kz: 'Құқықтық негіздеме', en: 'Legal justification' },
  gFinance: { ru: 'Финансовое обоснование', kz: 'Қаржылық негіздеме', en: 'Financial justification' },
  gRegulatory: { ru: 'Регуляторное воздействие', kz: 'Реттеушілік әсер', en: 'Regulatory impact' },
  gOther: { ru: 'Прочее', kz: 'Басқа', en: 'Other' },

  package: { ru: 'Состав пакета', kz: 'Топтама құрамы', en: 'The package' },
  packageHint: {
    ru: 'Каждый раздел — самостоятельный документ пакета. Любой из них можно переписать отдельно после составления.',
    kz: 'Әр бөлім — топтаманың дербес құжаты. Жасалғаннан кейін кез келгенін бөлек қайта жазуға болады.',
    en: 'Each section is a document of its own. Any of them can be rewritten separately after drafting.',
  },
  optional: { ru: 'необязательный', kz: 'міндетті емес', en: 'optional' },

  essential: { ru: 'Обязательные сведения', kz: 'Міндетті мәліметтер', en: 'Required information' },
  essentialHint: {
    ru: 'Без этих сведений пакет не примут к рассмотрению: они прямо требуются от инициатора.',
    kz: 'Бұл мәліметтерсіз топтама қарауға қабылданбайды: олар бастамашыдан тікелей талап етіледі.',
    en: 'Without these the package will not be accepted for consideration: they are required of the initiator.',
  },
  covered: { ru: 'закрыто', kz: 'жабылды', en: 'covered' },
  notCovered: { ru: 'не заполнено', kz: 'толтырылмаған', en: 'not filled in' },

  fullness: { ru: 'Полнота', kz: 'Толықтығы', en: 'Completeness' },
  filled: { ru: 'заполнено полей', kz: 'өріс толтырылды', en: 'fields filled in' },
  fullnessLow: {
    ru: 'Данных мало: разделы получатся общими. Вернитесь и опишите проблему и бюджет подробнее.',
    kz: 'Дерек аз: бөлімдер жалпылама шығады. Оралып, мәселе мен бюджетті толығырақ сипаттаңыз.',
    en: 'Too little input: the sections will come out generic. Go back and describe the problem and the budget in more detail.',
  },
  fullnessMid: {
    ru: 'Основное заполнено. Чем подробнее финансовая и регуляторная части, тем меньше придётся переписывать вручную.',
    kz: 'Негізгісі толтырылды. Қаржылық және реттеушілік бөліктер неғұрлым толық болса, қолмен қайта жазу азаяды.',
    en: 'The essentials are in. The fuller the financial and regulatory parts, the less rewriting by hand.',
  },
  fullnessHigh: {
    ru: 'Данных достаточно для всех разделов пакета.',
    kz: 'Топтаманың барлық бөлімдері үшін дерек жеткілікті.',
    en: 'There is enough input for every section of the package.',
  },

  notReviewed: { ru: 'Не вычитан юристом', kz: 'Заңгер тексермеген', en: 'Not reviewed by a lawyer' },
  caveat: { ru: 'Оговорка', kz: 'Ескертпе', en: 'Caveat' },

  build: { ru: 'Составить пакет', kz: 'Топтаманы жасау', en: 'Draft the package' },
  building: { ru: 'Составляем пакет', kz: 'Топтама жасалуда', en: 'Drafting the package' },
  section: { ru: 'Раздел', kz: 'Бөлім', en: 'Section' },

  errRequired: { ru: 'Заполните это поле', kz: 'Бұл өрісті толтырыңыз', en: 'Fill in this field' },
  errDigits12: { ru: 'Ровно 12 цифр', kz: 'Дәл 12 сан', en: 'Exactly 12 digits' },
  errNumber: { ru: 'Нужно число', kz: 'Сан қажет', en: 'A number is required' },
  errDate: { ru: 'Дата в формате ГГГГ-ММ-ДД', kz: 'Күн ЖЖЖЖ-АА-КК форматында', en: 'Date as YYYY-MM-DD' },
  errStep: {
    ru: 'Проверьте отмеченные поля этого шага',
    kz: 'Осы қадамның белгіленген өрістерін тексеріңіз',
    en: 'Check the highlighted fields on this step',
  },
  errCreate: {
    ru: 'Не удалось создать законопроект',
    kz: 'Заң жобасын құру мүмкін болмады',
    en: 'Could not create the draft law',
  },
  errGenerate: {
    ru: 'Каркас сохранён, но составление не запустилось',
    kz: 'Қаңқа сақталды, бірақ жасау басталмады',
    en: 'The skeleton is saved, but drafting did not start',
  },
  errStream: {
    ru: 'Связь с сервером прервалась. Пакет сохранён — откройте его и повторите составление.',
    kz: 'Сервермен байланыс үзілді. Топтама сақталды — оны ашып, жасауды қайталаңыз.',
    en: 'The connection dropped. The package is saved — open it and retry drafting.',
  },
}

/** Блок полей внутри шага: заголовок и имена полей паспорта по порядку. */
interface Block {
  label: string
  names: string[]
}

interface Step {
  key: string
  label: string
  lead: string
  blocks: Block[]
}

/* Разбиение по шагам задано именами полей, а не группами паспорта: группа
   terms в паспорте держит и правовое, и финансовое, и регуляторное разом —
   девять полей одним списком, что и создавало нечитаемую простыню. */
const LAYOUT: { key: string; label: string; lead: string; blocks: { label: string; names: string[] }[] }[] = [
  {
    key: 'requisites',
    label: 's1',
    lead: 's1lead',
    blocks: [{ label: '', names: ['title_ru', 'title_kz', 'initiator', 'initiator_type'] }],
  },
  {
    key: 'problem',
    label: 's2',
    lead: 's2lead',
    blocks: [{ label: '', names: ['problem_description', 'goals', 'target_audience'] }],
  },
  {
    key: 'basis',
    label: 's3',
    lead: 's3lead',
    blocks: [
      {
        label: 'gLegal',
        names: ['current_legislation_gaps', 'constitutional_basis', 'international_experience'],
      },
      { label: 'gFinance', names: ['budget_impact', 'funding_sources'] },
      {
        label: 'gRegulatory',
        names: [
          'business_impact',
          'citizen_impact',
          'corruption_risks',
          'implementation_timeline',
          'transitional_provisions',
        ],
      },
    ],
  },
]

export function WizardPage() {
  const t = useT(dict)
  const { lang } = useLang()
  const dl = docLang(lang)
  const navigate = useNavigate()
  const toast = useToast()

  const { data, error, loading, reload } = useLoader<PassportResponse>(
    () => api.get<PassportResponse>(`/drafts/passport/law_project?lang=${dl}`),
    [dl],
  )
  const passport = data?.passport ?? null

  const [values, setValues] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [tried, setTried] = useState<Record<string, boolean>>({})
  const [stepNo, setStepNo] = useState(0)
  const [job, setJob] = useState<Job | null>(null)
  const [busy, setBusy] = useState(false)

  const set = useCallback((name: string, v: string) => {
    setValues((prev) => ({ ...prev, [name]: v }))
  }, [])

  /* ------------------------------- шаги ------------------------------- */

  const steps: Step[] = useMemo(() => {
    if (!passport) return []
    const byName = new Map(passport.fields.map((f) => [f.name, f]))
    const placed = new Set(LAYOUT.flatMap((s) => s.blocks.flatMap((b) => b.names)))
    const out = LAYOUT.map((s) => ({
      key: s.key,
      label: t(s.label),
      lead: t(s.lead),
      blocks: s.blocks
        .map((b) => ({ label: b.label ? t(b.label) : '', names: b.names.filter((n) => byName.has(n)) }))
        .filter((b) => b.names.length),
    }))
    /* Поле, которого нет в раскладке, потерять нельзя: паспорт правят на
       сервере, и молча выпавшее поле означало бы пустой раздел без причины. */
    const extra = passport.fields.filter((f) => !placed.has(f.name)).map((f) => f.name)
    if (extra.length && out.length) out[out.length - 1].blocks.push({ label: t('gOther'), names: extra })
    return [...out, { key: 'review', label: t('s4'), lead: t('s4lead'), blocks: [] }]
  }, [passport, t])

  const fieldMap = useMemo(() => {
    const m = new Map<string, PassportField>()
    for (const f of passport?.fields ?? []) m.set(f.name, f)
    return m
  }, [passport])

  const messages = useMemo(
    () => ({
      required: t('errRequired'),
      digits12: t('errDigits12'),
      number: t('errNumber'),
      date: t('errDate'),
    }),
    [t],
  )

  const errors = useMemo(() => {
    const out: Record<string, string> = {}
    for (const f of passport?.fields ?? []) {
      const problem = validateField(values[f.name] ?? '', f.type, f.required, messages)
      if (problem) out[f.name] = problem
    }
    return out
  }, [passport, values, messages])

  const step = steps[stepNo]
  const stepNames = useMemo(() => step?.blocks.flatMap((b) => b.names) ?? [], [step])

  const errorFor = (name: string) =>
    (tried[step?.key ?? ''] || touched[name]) && errors[name] ? errors[name] : undefined

  const goNext = () => {
    if (stepNames.some((n) => errors[n])) {
      setTried((prev) => ({ ...prev, [step.key]: true }))
      toast(t('errStep'), 'err')
      return
    }
    setStepNo((n) => Math.min(n + 1, steps.length - 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  /** Прыжок по номеру шага: назад свободно, вперёд — только по заполненному. */
  const goTo = (target: number) => {
    if (target <= stepNo) {
      setStepNo(target)
      return
    }
    for (let i = stepNo; i < target; i++) {
      const names = steps[i].blocks.flatMap((b) => b.names)
      if (names.some((n) => errors[n])) {
        setStepNo(i)
        setTried((prev) => ({ ...prev, [steps[i].key]: true }))
        toast(t('errStep'), 'err')
        return
      }
    }
    setStepNo(target)
  }

  /* -------------------------------- лист -------------------------------- */

  const tree = useMemo(
    () => (passport ? buildPreviewTree(passport, values, dl, 'law_project') : null),
    [passport, values, dl],
  )

  /* ----------------------------- составление ----------------------------- */

  const submit = async () => {
    if (!passport) return
    if (Object.keys(errors).length) {
      // Обязательное поле могло остаться на первом шаге — увести туда, а не
      // сообщать об ошибке на экране, где её не исправить.
      const bad = steps.findIndex((s) => s.blocks.flatMap((b) => b.names).some((n) => errors[n]))
      if (bad >= 0) {
        setStepNo(bad)
        setTried((prev) => ({ ...prev, [steps[bad].key]: true }))
      }
      toast(t('errStep'), 'err')
      return
    }

    setBusy(true)
    let draftId = ''
    try {
      // Каркас приходит мгновенно: пакет существует ещё до того, как модель
      // напишет первый раздел, и не теряется при обрыве составления.
      const created = await api.post<DraftResponse>('/drafts', {
        type_id: passport.id,
        lang: dl,
        values: { ...values, lang: dl },
        title: values.title_ru || undefined,
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
      navigate(withLang(`/laws/${draftId}`, lang))
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
          navigate(withLang(`/laws/${draftId}`, lang))
        }
      },
      () => {
        // Браузер переподключается сам; пакет уже сохранён, поэтому безопаснее
        // увести человека на документ, чем держать его в ожидании.
        stop()
        setBusy(false)
        toast(t('errStream'), 'err')
        navigate(withLang(`/laws/${draftId}`, lang))
      },
    )
  }

  /* ------------------------------- разметка ------------------------------- */

  if (loading) {
    return (
      <div className="page">
        <LawTabs />
        <ListSkeleton rows={10} />
      </div>
    )
  }
  if (error || !passport || !tree || !step) {
    return (
      <div className="page">
        <LawTabs />
        <div className="ct-state">
          <LoadFailure error={error} onRetry={reload} />
        </div>
      </div>
    )
  }

  const last = stepNo === steps.length - 1
  const progress = job?.progress
  const percent = progress && progress.total ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <div className="page ct-builder">
      <div className="page__head">
        <div className="page__title">
          <Display>{t('title')}</Display>
          <Body tone="mute">{passport.summary}</Body>
        </div>
      </div>

      <LawTabs />

      {passport.reviewed ? null : (
        <div className="ct-flag ct-flag--warn">
          <span className="status status--warn">{t('notReviewed')}</span>
        </div>
      )}
      {passport.caveat ? (
        /* Оговорка важна, но её место — под рукой, а не поперёк дороги. */
        <details className="ct-caveat">
          <summary className="ct-caveat__head">
            <Label as="span">{t('caveat')}</Label>
          </summary>
          <Caption tone="ink2" className="ct-caveat__body">
            {passport.caveat}
          </Caption>
        </details>
      ) : null}

      <div className="ct-split">
        <div className="ct-split__form">
          <nav className="lw-steps" aria-label={t('step')}>
            <ol className="lw-steps__list">
              {steps.map((s, i) => (
                <li key={s.key} className="lw-steps__item">
                  <button
                    type="button"
                    className={[
                      'lw-step',
                      i === stepNo ? 'lw-step--on' : '',
                      i < stepNo ? 'lw-step--done' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => goTo(i)}
                    aria-current={i === stepNo ? 'step' : undefined}
                  >
                    <span className="lw-step__no tabular">{i + 1}</span>
                    <span className="lw-step__label">{s.label}</span>
                  </button>
                </li>
              ))}
            </ol>
            <Caption tone="mute" className="lw-steps__count tabular">
              {t('step')} {stepNo + 1} {t('of')} {steps.length}
            </Caption>
          </nav>

          <section className="ct-group lw-stage">
            <div className="ct-group__head">
              <H3>{step.label}</H3>
            </div>
            <Caption tone="mute">{step.lead}</Caption>

            {last ? (
              <Review passport={passport} values={values} />
            ) : (
              step.blocks.map((block, bi) => (
                <div className="lw-block" key={block.label || bi}>
                  {block.label ? <Label as="div" className="lw-block__head">{block.label}</Label> : null}
                  <div className="ct-grid">
                    {block.names.map((name) => {
                      const field = fieldMap.get(name)
                      if (!field) return null
                      return (
                        <FieldControl
                          key={name}
                          field={field}
                          value={values[name] ?? ''}
                          error={errorFor(name)}
                          onChange={(v) => set(name, v)}
                          onBlur={() => setTouched((p) => (p[name] ? p : { ...p, [name]: true }))}
                        />
                      )
                    })}
                  </div>
                </div>
              ))
            )}
          </section>

          <div className="ct-actions lw-actions">
            <Button onClick={() => setStepNo((n) => Math.max(0, n - 1))} disabled={stepNo === 0 || busy}>
              {t('back')}
            </Button>
            {last ? (
              <Button variant="primary" size="lg" onClick={submit} disabled={busy}>
                {busy ? t('building') : t('build')}
              </Button>
            ) : (
              <Button variant="primary" size="lg" onClick={goNext}>
                {t('next')}
              </Button>
            )}
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
        </aside>
      </div>
    </div>
  )
}

/* ------------------------------ сводка на шаге 4 ------------------------------ */

function Review({ passport, values }: { passport: Passport; values: Record<string, string> }) {
  const t = useT(dict)

  const filled = passport.fields.filter((f) => hasValue(values, f.name)).length
  const total = passport.fields.length
  const share = total ? filled / total : 0
  const verdict = share < 0.35 ? t('fullnessLow') : share < 0.7 ? t('fullnessMid') : t('fullnessHigh')

  const missing = passport.essential_terms.filter((term) => !termCovered(term.fields, values))

  return (
    <div className="lw-review">
      <div className="lw-review__block">
        <Label as="div" className="lw-block__head">
          {t('package')}
        </Label>
        <Caption tone="mute">{t('packageHint')}</Caption>
        <ol className="lw-package">
          {passport.sections.map((s, i) => (
            <li key={s.key} className="lw-package__item">
              <span className="lw-package__no tabular">{i + 1}</span>
              <span className="lw-package__body">
                <UIText>{s.title}</UIText>
                {s.required ? null : (
                  <Caption tone="mute" className="lw-package__opt">
                    {t('optional')}
                  </Caption>
                )}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div className="lw-review__block">
        <Label as="div" className="lw-block__head">
          {t('fullness')}
        </Label>
        <UIText className="tabular">
          {filled} {t('of')} {total} — {t('filled')}
        </UIText>
        {/* Полоса, а не проценты: доля читается взглядом, а число заставляет
            считать, много это или мало. */}
        <div className="lw-gauge" role="img" aria-label={`${filled} / ${total}`}>
          <span className="lw-gauge__fill" style={{ width: `${Math.round(share * 100)}%` }} />
        </div>
        <Caption tone="mute">{verdict}</Caption>
        {missing.length ? (
          <ul className="lw-missing">
            {missing.map((term) => (
              <li key={term.key}>
                <span className="status status--err">—</span> <UIText>{term.label}</UIText>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  )
}
