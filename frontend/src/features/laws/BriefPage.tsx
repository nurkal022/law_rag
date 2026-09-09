import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Body, Button, Caption, Chip, Display, Label, Loading, Mono, Textarea, UIText, useToast } from '../../shared/ui'
import { useLang, useT, withLang } from '../../i18n'
import type { Dict } from '../../i18n'
import { ApiError, api, errorMessage } from '../../shared/api'
import { upload } from '../workspace/upload'
import { BuilderAside } from '../drafts/BuilderAside'
import { ListSkeleton, LoadFailure, useLoader } from '../drafts/shared'
import { buildPreviewTree, docLang } from '../drafts/preview'
import type { DraftResponse, JobResponse, PassportResponse } from '../drafts/types'
import { LawTabs } from './shared'
import { ConceptsScreen } from './ConceptsScreen'
import { THINK_STAGES } from './concepts'
import type { BriefAttachment, BriefResponse, DomainsResponse } from './concepts'
import '../drafts/drafts.css'
import '../drafts/drafts.motion.css'
import './laws.css'

/**
 * Новый законопроект: бриф → концепты → пакет.
 *
 * Вместо формы на семнадцать полей человек даёт контекст — пару фраз, файлы,
 * сферу — и выбирает один из трёх концептов, которые предлагает модель.
 * Выбранное становится значениями паспорта; пакет составляется тем же
 * обработчиком, что и раньше, и ничем не отличается от собранного формой.
 */

const dict: Dict = {
  title: { ru: 'Новый законопроект', kz: 'Жаңа заң жобасы', en: 'New draft law' },
  briefLabel: { ru: 'О чём закон', kz: 'Заң не туралы', en: 'What the law is about' },
  briefHint: {
    ru: 'Своими словами: какая проблема, кого касается, что должно измениться. Можно оставить пустым и выбрать только сферу.',
    kz: 'Өз сөзіңізбен: қандай мәселе, кімге қатысты, не өзгеруі керек. Бос қалдырып, тек сфераны таңдауға болады.',
    en: 'In your own words: the problem, who it affects, what should change. You may leave it empty and pick only the area.',
  },
  domain: { ru: 'Сфера', kz: 'Сфера', en: 'Area' },
  files: { ru: 'Материалы', kz: 'Материалдар', en: 'Materials' },
  filesHint: {
    ru: 'PDF или DOCX: аналитические записки, обзоры, прежние редакции. Текст извлекается сразу, файлы никуда не уходят.',
    kz: 'PDF немесе DOCX: талдамалық жазбалар, шолулар, бұрынғы редакциялар. Мәтін дереу алынады.',
    en: 'PDF or DOCX: analytical notes, reviews, earlier versions. Text is extracted at once; files are not stored.',
  },
  attach: { ru: 'Приложить файл', kz: 'Файл тіркеу', en: 'Attach a file' },
  uploading: { ru: 'Читаю файл…', kz: 'Файлды оқып жатырмын…', en: 'Reading the file…' },
  chars: { ru: 'знаков', kz: 'таңба', en: 'characters' },
  remove: { ru: 'Снять', kz: 'Алып тастау', en: 'Remove' },
  propose: { ru: 'Предложить варианты', kz: 'Нұсқалар ұсыну', en: 'Propose options' },
  example: { ru: 'Пример брифа', kz: 'Бриф үлгісі', en: 'Example brief' },
  exampleDone: {
    ru: 'Подставлен пример — можно менять или сразу просить варианты',
    kz: 'Үлгі қойылды — өзгертуге немесе бірден нұсқалар сұрауға болады',
    en: 'Example inserted — edit it or ask for options right away',
  },
  thinking: { ru: 'Готовлю варианты', kz: 'Нұсқаларды дайындап жатырмын', en: 'Preparing options' },
  reading: { ru: 'Читаю бриф и материалы', kz: 'Бриф пен материалдарды оқып жатырмын', en: 'Reading the brief and materials' },
  searching: { ru: 'Ищу нормы в корпусе', kz: 'Корпустан нормаларды іздеп жатырмын', en: 'Searching the corpus for norms' },
  drafting: { ru: 'Формулирую три варианта', kz: 'Үш нұсқаны тұжырымдап жатырмын', en: 'Formulating three options' },
  thinkNote: {
    ru: 'Обычно 10–20 секунд: модель читает найденные нормы и пишет три разных подхода.',
    kz: 'Әдетте 10–20 секунд: модель табылған нормаларды оқып, үш түрлі тәсіл жазады.',
    en: 'Usually 10–20 seconds: the model reads the norms found and writes three different approaches.',
  },
  errBrief: { ru: 'Не удалось получить варианты', kz: 'Нұсқаларды алу мүмкін болмады', en: 'Could not get the options' },
  errUpload: { ru: 'Файл не прочитан', kz: 'Файл оқылмады', en: 'The file could not be read' },
  errCreate: { ru: 'Не удалось создать пакет', kz: 'Топтама жасау мүмкін болмады', en: 'Could not create the package' },
  errGenerate: {
    ru: 'Пакет создан, но составление не запустилось — попробуйте на странице документа',
    kz: 'Топтама жасалды, бірақ құрастыру іске қосылмады — құжат бетінде қайта көріңіз',
    en: 'The package was created but drafting did not start — try from the document page',
  },
  sheetHint: {
    ru: 'Лист соберётся из выбранного варианта',
    kz: 'Парақ таңдалған нұсқадан жиналады',
    en: 'The sheet will be built from the chosen option',
  },
  caveat: { ru: 'Оговорка', kz: 'Ескертпе', en: 'Caveat' },
  notReviewed: { ru: 'Не вычитан юристом', kz: 'Заңгер тексермеген', en: 'Not reviewed by a lawyer' },
}

type Phase = 'brief' | 'thinking' | 'concepts'

const TYPE_ID = 'law_project'
const STAGE_MS = 4500

export function BriefPage() {
  const t = useT(dict)
  const toast = useToast()
  const navigate = useNavigate()
  const { lang } = useLang()
  const dl = docLang(lang)

  const passportLoad = useLoader<PassportResponse>(
    () => api.get<PassportResponse>(`/drafts/passport/${TYPE_ID}?lang=${dl}`),
    [dl],
  )
  const domainsLoad = useLoader<DomainsResponse>(
    () => api.get<DomainsResponse>(`/drafts/brief/domains?lang=${dl}`),
    [dl],
  )
  const passport = passportLoad.data?.passport ?? null
  const domains = domainsLoad.data?.domains ?? []

  const [phase, setPhase] = useState<Phase>('brief')
  const [text, setText] = useState('')
  const [domain, setDomain] = useState('')
  const [attachments, setAttachments] = useState<BriefAttachment[]>([])
  const [uploading, setUploading] = useState(0)
  const [result, setResult] = useState<BriefResponse | null>(null)
  const [moreBusy, setMoreBusy] = useState(false)
  const [submitBusy, setSubmitBusy] = useState(false)
  const [stage, setStage] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)

  // Стадии ожидания идут по времени: сервер отвечает одним куском, а человеку
  // нужно видеть, что работа идёт. Названия — то, что сервер действительно делает.
  useEffect(() => {
    if (phase !== 'thinking') {
      setStage(0)
      return
    }
    const timer = window.setInterval(() => setStage((s) => Math.min(s + 1, THINK_STAGES.length - 1)), STAGE_MS)
    return () => window.clearInterval(timer)
  }, [phase])

  const canAsk = Boolean(text.trim() || domain || attachments.some((a) => a.text.trim())) && uploading === 0

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return
    for (const f of Array.from(files)) {
      setUploading((n) => n + 1)
      try {
        const form = new FormData()
        form.append('file', f)
        const res = await upload<{ text: string; filename: string; length: number }>('/api/chat/upload', form)
        setAttachments((prev) => [
          ...prev,
          { filename: res.filename || f.name, text: res.text, length: res.length ?? res.text.length },
        ])
      } catch (e) {
        toast(`${f.name}: ${errorMessage(e, t('errUpload'))}`, 'err')
      } finally {
        setUploading((n) => n - 1)
      }
    }
  }

  const askConcepts = useCallback(
    async (avoid: string[] = []) => {
      const more = avoid.length > 0
      if (more) setMoreBusy(true)
      else setPhase('thinking')
      try {
        const res = await api.post<BriefResponse>('/drafts/brief', {
          type_id: TYPE_ID,
          lang: dl,
          text,
          domain,
          attachments: attachments.map(({ filename, text: body }) => ({ filename, text: body })),
          avoid,
        })
        setResult(res)
        setPhase('concepts')
      } catch (e) {
        if (e instanceof ApiError && e.unauthorized) {
          window.location.assign('/login?next=/laws/new')
          return
        }
        toast(errorMessage(e, t('errBrief')), 'err')
        if (!more) setPhase('brief')
      } finally {
        setMoreBusy(false)
      }
    },
    [dl, text, domain, attachments, t, toast],
  )

  const fillExample = () => {
    const ex = domainsLoad.data?.example
    if (!ex) return
    setText(ex.text)
    setDomain(ex.domain)
    toast(t('exampleDone'))
  }

  const submit = async (values: Record<string, string>) => {
    setSubmitBusy(true)
    let draftId = ''
    try {
      // Каркас приходит мгновенно: пакет существует ещё до того, как модель
      // напишет первый раздел, и не теряется при обрыве составления.
      const created = await api.post<DraftResponse>('/drafts', {
        type_id: TYPE_ID,
        lang: dl,
        values: { ...values, lang: dl },
        title: values.title_ru || undefined,
      })
      draftId = created.draft.id
    } catch (e) {
      setSubmitBusy(false)
      toast(errorMessage(e, t('errCreate')), 'err')
      return
    }
    try {
      await api.post<JobResponse>(`/drafts/${draftId}/generate`, {})
    } catch (e) {
      toast(errorMessage(e, t('errGenerate')), 'err')
    }
    // Ход генерации показывает страница документа: она подхватывает задачу
    // из ответа сервера, поэтому ждать здесь нечего.
    navigate(withLang(`/laws/${draftId}`, lang))
  }

  const emptyTree = useMemo(
    () => (passport ? buildPreviewTree(passport, { lang: dl }, dl, 'law_project') : null),
    [passport, dl],
  )

  if (passportLoad.loading || domainsLoad.loading) {
    return (
      <div className="page">
        <LawTabs />
        <ListSkeleton rows={8} />
      </div>
    )
  }
  if (passportLoad.error || !passport) {
    return (
      <div className="page">
        <LawTabs />
        <div className="ct-state">
          <LoadFailure error={passportLoad.error} onRetry={passportLoad.reload} />
        </div>
      </div>
    )
  }

  const domainLabel = domains.find((d) => d.key === domain)?.label

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
        <details className="ct-caveat">
          <summary className="ct-caveat__head">
            <Label as="span">{t('caveat')}</Label>
          </summary>
          <Caption tone="ink2" className="ct-caveat__body">
            {passport.caveat}
          </Caption>
        </details>
      ) : null}

      {phase === 'concepts' && result ? (
        <ConceptsScreen
          result={result}
          passport={passport}
          onMore={() => askConcepts(result.concepts.map((c) => c.title_ru))}
          moreBusy={moreBusy}
          onSubmit={submit}
          submitBusy={submitBusy}
          onBack={() => setPhase('brief')}
        />
      ) : (
        <div className="ct-split">
          <div className="ct-split__form">
            {phase === 'thinking' ? (
              <div className="lb-think" role="status" aria-live="polite">
                <Loading label={t('thinking')} />
                {THINK_STAGES.map((s, i) => (
                  <div
                    key={s}
                    className={[
                      'lb-think__stage',
                      i === stage ? 'lb-think__stage--on' : i < stage ? 'lb-think__stage--done' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <span className="lb-think__no tabular">{i + 1}</span>
                    <UIText>
                      {t(s)}
                      {s === 'searching' && domainLabel ? ` — ${domainLabel}` : ''}
                    </UIText>
                  </div>
                ))}
                <Caption tone="mute">{t('thinkNote')}</Caption>
              </div>
            ) : (
              <div className="lb-brief">
                <Textarea
                  label={t('briefLabel')}
                  hint={t('briefHint')}
                  rows={6}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />

                <div>
                  <Label as="div">{t('domain')}</Label>
                  <div className="lb-domains">
                    {domains.map((d) => (
                      <Chip key={d.key} active={domain === d.key} onClick={() => setDomain(domain === d.key ? '' : d.key)}>
                        {d.label}
                      </Chip>
                    ))}
                  </div>
                </div>

                <div>
                  <Label as="div">{t('files')}</Label>
                  <div className="lb-files">
                    {attachments.map((a, i) => (
                      <span className="lb-file" key={`${a.filename}-${i}`}>
                        <Mono tone="ink2">{a.filename}</Mono>
                        <Caption tone="mute">
                          {a.length} {t('chars')}
                        </Caption>
                        <Button
                          variant="ghost"
                          aria-label={`${t('remove')} ${a.filename}`}
                          onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
                        >
                          {t('remove')}
                        </Button>
                      </span>
                    ))}
                    <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={uploading > 0}>
                      {uploading > 0 ? t('uploading') : t('attach')}
                    </Button>
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".pdf,.docx"
                      multiple
                      className="visually-hidden"
                      tabIndex={-1}
                      aria-hidden="true"
                      onChange={(e) => {
                        void addFiles(e.target.files)
                        e.target.value = ''
                      }}
                    />
                  </div>
                  <Caption tone="mute">{t('filesHint')}</Caption>
                </div>

                <div className="lb-actions">
                  <Button variant="primary" size="lg" disabled={!canAsk} onClick={() => askConcepts()}>
                    {t('propose')}
                  </Button>
                  <Button variant="ghost" onClick={fillExample}>
                    {t('example')}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {emptyTree ? (
            <BuilderAside
              tree={emptyTree}
              head={
                <Caption tone="mute" className="sheet__hint">
                  {t('sheetHint')}
                </Caption>
              }
            />
          ) : null}
        </div>
      )}
    </div>
  )
}
