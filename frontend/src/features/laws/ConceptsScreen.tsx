import { useMemo, useState } from 'react'
import { Body, Button, Caption, Chip, Cite, H3, Input, Label, Textarea, UIText, useToast } from '../../shared/ui'
import { useLang, useT } from '../../i18n'
import type { Dict } from '../../i18n'
import { citeCode } from '../legal/cite'
import { BuilderAside } from '../drafts/BuilderAside'
import { buildPreviewTree, docLang } from '../drafts/preview'
import type { Passport } from '../drafts/types'
import { conceptValues, missingRequired, refCode } from './concepts'
import type { BriefResponse, Concept } from './concepts'

/**
 * Три концепта на выбор, правка выбранного и уточнения чипами.
 *
 * Выбор вместо набора: человек читает три готовых законопроекта и берёт
 * один, а не сочиняет семнадцать полей. Всё, что не помещается в концепт —
 * инициатор, срок, бюджет, — спрашивается чипами, которые разворачиваются в
 * готовый текст. Лист справа собирается из выбранного, как в прежнем мастере.
 */

const dict: Dict = {
  title: { ru: 'Три варианта — выберите один', kz: 'Үш нұсқа — біреуін таңдаңыз', en: 'Three options — pick one' },
  lead: {
    ru: 'Каждый вариант — самостоятельный законопроект по вашему брифу. Выбранный можно править и дополнять целями из других.',
    kz: 'Әр нұсқа — сіздің бриф бойынша дербес заң жобасы. Таңдалғанды түзетуге және басқаларының мақсаттарымен толықтыруға болады.',
    en: 'Each option is a self-contained draft law for your brief. The chosen one can be edited and topped up with goals from the others.',
  },
  choose: { ru: 'Выбрать', kz: 'Таңдау', en: 'Choose' },
  chosen: { ru: 'Выбран', kz: 'Таңдалды', en: 'Chosen' },
  takeGoals: { ru: 'Добавить цели отсюда', kz: 'Осы жерден мақсаттар қосу', en: 'Add goals from here' },
  goals: { ru: 'Цели', kz: 'Мақсаттар', en: 'Goals' },
  provisions: { ru: 'Ключевые положения', kz: 'Негізгі ережелер', en: 'Key provisions' },
  basis: { ru: 'Правовая основа', kz: 'Құқықтық негіз', en: 'Legal basis' },
  refine: { ru: 'Уточнить выбранный вариант', kz: 'Таңдалған нұсқаны нақтылау', en: 'Refine the chosen option' },
  refineHint: {
    ru: 'Любую строку можно поправить — в пакет уйдёт то, что вы видите здесь.',
    kz: 'Кез келген жолды түзетуге болады — топтамаға осы жерде көргеніңіз кетеді.',
    en: 'Edit any line — what you see here goes into the package.',
  },
  clarify: { ru: 'Уточнения', kz: 'Нақтылаулар', en: 'Details' },
  clarifyHint: {
    ru: 'Без этого пакет не примут к рассмотрению — выберите или впишите своё.',
    kz: 'Бұларсыз топтама қарауға қабылданбайды — таңдаңыз немесе өзіңіздікін жазыңыз.',
    en: 'Required for submission — pick an option or type your own.',
  },
  initiatorType: { ru: 'Кто вносит', kz: 'Кім енгізеді', en: 'Initiated by' },
  initiator: { ru: 'Инициатор', kz: 'Бастамашы', en: 'Initiator' },
  timeline: { ru: 'Срок введения в действие', kz: 'Қолданысқа енгізу мерзімі', en: 'Entry into force' },
  ownTimeline: { ru: 'Свой срок', kz: 'Өз мерзімім', en: 'Custom' },
  budget: { ru: 'Влияние на бюджет', kz: 'Бюджетке әсері', en: 'Budget impact' },
  more: { ru: 'Ещё варианты', kz: 'Басқа нұсқалар', en: 'More options' },
  moreBusy: { ru: 'Думаю…', kz: 'Ойланып жатырмын…', en: 'Thinking…' },
  back: { ru: 'К брифу', kz: 'Брифке', en: 'Back to the brief' },
  submit: { ru: 'Составить пакет', kz: 'Топтама жасау', en: 'Draft the package' },
  submitBusy: { ru: 'Создаю…', kz: 'Жасап жатырмын…', en: 'Creating…' },
  missing: { ru: 'Не хватает:', kz: 'Жетіспейді:', en: 'Missing:' },
  sheetHint: {
    ru: 'Лист собран из выбранного варианта; разделы напишет модель после «Составить пакет»',
    kz: 'Парақ таңдалған нұсқадан жиналды; бөлімдерді модель «Топтама жасау» кейін жазады',
    en: 'The sheet is built from the chosen option; the model drafts the sections after “Draft the package”',
  },
  pickFirst: { ru: 'Сначала выберите вариант', kz: 'Алдымен нұсқаны таңдаңыз', en: 'Choose an option first' },
}

/** Поля концепта, которые человек правит на месте, — в порядке показа. */
const EDITABLE = [
  'title_ru',
  'title_kz',
  'problem_description',
  'goals',
  'key_provisions',
  'target_audience',
  'current_legislation_gaps',
  'constitutional_basis',
] as const

export function ConceptsScreen({
  result,
  passport,
  onMore,
  moreBusy,
  onSubmit,
  submitBusy,
  onBack,
}: {
  result: BriefResponse
  passport: Passport
  onMore: () => void
  moreBusy: boolean
  onSubmit: (values: Record<string, string>) => void
  submitBusy: boolean
  onBack: () => void
}) {
  const t = useT(dict)
  const toast = useToast()
  const { lang } = useLang()
  const dl = docLang(lang)

  const [selected, setSelected] = useState<number | null>(null)
  // Правки и уточнения — одной картой поверх значений концепта
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [timelinePick, setTimelinePick] = useState<string>('')
  const [budgetPick, setBudgetPick] = useState<string>('')

  const concept: Concept | null = selected === null ? null : (result.concepts[selected] ?? null)
  const values = useMemo(() => (concept ? conceptValues(concept, edits) : {}), [concept, edits])
  const fieldByName = useMemo(() => new Map(passport.fields.map((f) => [f.name, f])), [passport])
  const set = (name: string, v: string) => setEdits((prev) => ({ ...prev, [name]: v }))

  const select = (i: number) => {
    setSelected(i)
    // Новый выбор — новые правки: правки одного концепта к другому не относятся
    setEdits({})
    setTimelinePick('')
    setBudgetPick('')
  }

  const takeGoals = (from: Concept) => {
    if (!concept) return
    const current = (values.goals ?? '').split('\n').map((s) => s.trim()).filter(Boolean)
    const extra = from.goals.map((s) => s.trim()).filter((g) => g && !current.includes(g))
    set('goals', [...current, ...extra].join('\n'))
  }

  const submit = () => {
    if (!concept) {
      toast(t('pickFirst'), 'err')
      return
    }
    const missing = missingRequired(passport, values)
    if (missing.length) {
      toast(`${t('missing')} ${missing.join(', ')}`, 'err')
      return
    }
    onSubmit(values)
  }

  const cl = result.clarifications
  const tree = useMemo(
    () => (concept ? buildPreviewTree(passport, values, dl, 'law_project') : null),
    [concept, passport, values, dl],
  )

  return (
    <div className="ct-split">
      <div className="ct-split__form">
        <div className="lb-head">
          <H3>{t('title')}</H3>
          <Body tone="mute">{t('lead')}</Body>
        </div>

        <div className="lb-cards">
          {result.concepts.map((c, i) => {
            const on = selected === i
            const dim = selected !== null && !on
            return (
              <article
                key={c.title_ru}
                className={['lb-card', on ? 'lb-card--on' : '', dim ? 'lb-card--dim' : ''].filter(Boolean).join(' ')}
              >
                <H3>{c.title_ru}</H3>
                {c.summary ? <Body tone="ink2">{c.summary}</Body> : null}
                <Body>{c.problem_description}</Body>
                {c.goals.length ? (
                  <div>
                    <Label as="div">{t('goals')}</Label>
                    <ul className="lb-list">
                      {c.goals.map((g) => (
                        <li key={g}>
                          <UIText>{g}</UIText>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {c.key_provisions.length ? (
                  <div>
                    <Label as="div">{t('provisions')}</Label>
                    <ul className="lb-list">
                      {c.key_provisions.map((g) => (
                        <li key={g}>
                          <UIText>{g}</UIText>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {c.refs.length ? (
                  <div>
                    <Label as="div">{t('basis')}</Label>
                    <div className="lb-refs">
                      {c.refs.map((r) => (
                        <Cite key={refCode(r)} code={citeCode(refCode(r), lang)} />
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="lb-card__acts">
                  <Button variant={on ? 'primary' : 'secondary'} onClick={() => select(i)} disabled={on}>
                    {on ? t('chosen') : t('choose')}
                  </Button>
                  {dim ? (
                    <Button variant="ghost" onClick={() => takeGoals(c)}>
                      {t('takeGoals')}
                    </Button>
                  ) : null}
                </div>
              </article>
            )
          })}
        </div>

        {concept ? (
          <>
            <section className="ct-group">
              <div className="ct-group__head">
                <H3>{t('refine')}</H3>
                <Caption tone="mute">{t('refineHint')}</Caption>
              </div>
              {EDITABLE.map((name) => {
                const f = fieldByName.get(name)
                if (!f) return null
                const multiline = f.type === 'textarea' || name === 'goals' || name === 'key_provisions'
                return (
                  <div className="lb-field" key={name}>
                    {multiline ? (
                      <Textarea
                        label={f.label}
                        hint={f.hint ?? undefined}
                        rows={name === 'goals' || name === 'key_provisions' ? 4 : 3}
                        value={values[name] ?? ''}
                        onChange={(e) => set(name, e.target.value)}
                      />
                    ) : (
                      <Input
                        label={f.label}
                        hint={f.hint ?? undefined}
                        value={values[name] ?? ''}
                        onChange={(e) => set(name, e.target.value)}
                      />
                    )}
                  </div>
                )
              })}
            </section>

            <section className="ct-group">
              <div className="ct-group__head">
                <H3>{t('clarify')}</H3>
                <Caption tone="mute">{t('clarifyHint')}</Caption>
              </div>

              {cl.initiator_type ? (
                <div className="lb-field">
                  <Label as="div">{t('initiatorType')}</Label>
                  <div className="lb-chips">
                    {cl.initiator_type.options.map((o) => (
                      <Chip key={o.value} active={values.initiator_type === o.value} onClick={() => set('initiator_type', o.value)}>
                        {o.label}
                      </Chip>
                    ))}
                  </div>
                </div>
              ) : null}

              {cl.initiator ? (
                <div className="lb-field">
                  <Input label={t('initiator')} value={values.initiator ?? ''} onChange={(e) => set('initiator', e.target.value)} />
                  <div className="lb-chips">
                    {cl.initiator.suggestions.map((s) => (
                      <Chip key={s} active={values.initiator === s} onClick={() => set('initiator', s)}>
                        {s}
                      </Chip>
                    ))}
                  </div>
                </div>
              ) : null}

              {cl.implementation_timeline ? (
                <div className="lb-field">
                  <Label as="div">{t('timeline')}</Label>
                  <div className="lb-chips">
                    {cl.implementation_timeline.chips.map((ch) => (
                      <Chip
                        key={ch.key}
                        active={timelinePick === ch.key}
                        onClick={() => {
                          setTimelinePick(ch.key)
                          set('implementation_timeline', ch.value)
                        }}
                      >
                        {ch.label}
                      </Chip>
                    ))}
                    <Chip active={timelinePick === 'own'} onClick={() => setTimelinePick('own')}>
                      {t('ownTimeline')}
                    </Chip>
                  </div>
                  {timelinePick === 'own' ? (
                    <div className="lb-field">
                      <Input
                        label={t('timeline')}
                        value={values.implementation_timeline ?? ''}
                        onChange={(e) => set('implementation_timeline', e.target.value)}
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}

              {cl.budget_impact ? (
                <div className="lb-field">
                  <Label as="div">{t('budget')}</Label>
                  <div className="lb-chips">
                    {cl.budget_impact.chips.map((ch) => (
                      <Chip
                        key={ch.key}
                        active={budgetPick === ch.key}
                        onClick={() => {
                          setBudgetPick(ch.key)
                          set('budget_impact', ch.value)
                        }}
                      >
                        {ch.label}
                      </Chip>
                    ))}
                  </div>
                  {budgetPick ? (
                    <div className="lb-field">
                      <Textarea
                        label={fieldByName.get('budget_impact')?.label ?? t('budget')}
                        rows={4}
                        value={values.budget_impact ?? ''}
                        onChange={(e) => set('budget_impact', e.target.value)}
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>
          </>
        ) : null}

        <div className="ct-actions lb-actions">
          <Button variant="ghost" onClick={onBack} disabled={submitBusy}>
            {t('back')}
          </Button>
          <Button variant="secondary" onClick={onMore} disabled={moreBusy || submitBusy}>
            {moreBusy ? t('moreBusy') : t('more')}
          </Button>
          <Button variant="primary" onClick={submit} disabled={!concept || submitBusy}>
            {submitBusy ? t('submitBusy') : t('submit')}
          </Button>
        </div>
      </div>

      {tree ? (
        <BuilderAside
          tree={tree}
          head={
            <Caption tone="mute" className="sheet__hint">
              {t('sheetHint')}
            </Caption>
          }
        />
      ) : null}
    </div>
  )
}
