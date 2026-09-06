import { useRef, useState } from 'react'
import {
  Body,
  Button,
  Caption,
  Chip,
  Display,
  H3,
  Label,
  Loading,
  Select,
  Textarea,
  UIText,
  useToast,
} from '../../shared/ui'
import { useT } from '../../i18n'
import type { Dict } from '../../i18n'
import { errorMessage } from '../../shared/api'
import { LoadFailure } from '../drafts/shared'
import { ContractTabs } from './shared'
import type { Analysis, Risk } from './review.types'
import '../drafts/drafts.css'
import '../drafts/drafts.motion.css'
import './review.css'

/**
 * Проверка чужого договора.
 *
 * Зеркало конструктора: там документ составляют, здесь — разбирают присланный
 * контрагентом. Разбор ведётся с позиции одной из сторон, потому что «риск»
 * без указания, чей он, ничего не значит: пункт, невыгодный покупателю,
 * выгоден продавцу.
 */

const dict: Dict = {
  title: { ru: 'Проверить договор', kz: 'Шартты тексеру', en: 'Review a contract' },
  lead: {
    ru: 'Разбор присланного договора: риски, пропущенные условия и соответствие праву Республики Казахстан.',
    kz: 'Жіберілген шартты талдау: тәуекелдер, жетіспейтін талаптар және Қазақстан Республикасының құқығына сәйкестігі.',
    en: 'Analysis of a received contract: risks, missing terms and compliance with Kazakhstan law.',
  },
  drop: {
    ru: 'Перетащите файл — PDF, DOCX или TXT',
    kz: 'Файлды сүйреңіз — PDF, DOCX немесе TXT',
    en: 'Drop a file — PDF, DOCX or TXT',
  },
  pick: { ru: 'Выбрать файл', kz: 'Файл таңдау', en: 'Choose a file' },
  or: { ru: 'или вставьте текст договора', kz: 'немесе шарт мәтінін қойыңыз', en: 'or paste the contract text' },
  textPlaceholder: {
    ru: 'Вставьте текст договора целиком',
    kz: 'Шарт мәтінін толық қойыңыз',
    en: 'Paste the full text of the contract',
  },
  position: { ru: 'Чьи интересы защищаем', kz: 'Кімнің мүддесін қорғаймыз', en: 'Whose interests to protect' },
  neutral: { ru: 'Нейтрально', kz: 'Бейтарап', en: 'Neutral' },
  positionHint: {
    ru: 'Пункт, невыгодный одной стороне, выгоден другой. Без указания позиции разбор будет общим.',
    kz: 'Бір тарапқа тиімсіз тармақ екіншісіне тиімді. Позицияны көрсетпесеңіз, талдау жалпы болады.',
    en: 'A clause unfavourable to one party favours the other. Without a position the analysis stays general.',
  },
  type: { ru: 'Тип договора', kz: 'Шарт түрі', en: 'Contract type' },
  autoType: { ru: 'Определить самостоятельно', kz: 'Өзі анықтасын', en: 'Detect automatically' },
  run: { ru: 'Проверить', kz: 'Тексеру', en: 'Review' },
  again: { ru: 'Проверить другой', kz: 'Басқасын тексеру', en: 'Review another' },
  working: { ru: 'Читаю договор', kz: 'Шартты оқып жатырмын', en: 'Reading the contract' },
  tooShort: {
    ru: 'Текста слишком мало для разбора. Нужен полный текст договора, а не отрывок.',
    kz: 'Талдау үшін мәтін тым аз. Үзінді емес, шарттың толық мәтіні қажет.',
    en: 'Too little text to analyse. The full contract is needed, not a fragment.',
  },
  fail: { ru: 'Не удалось разобрать договор', kz: 'Шартты талдау мүмкін болмады', en: 'Could not analyse the contract' },

  score: { ru: 'Оценка договора', kz: 'Шарт бағасы', en: 'Contract score' },
  riskLevel: { ru: 'Уровень риска', kz: 'Тәуекел деңгейі', en: 'Risk level' },
  detected: { ru: 'Определён как', kz: 'Түрі анықталды', en: 'Detected as' },
  parties: { ru: 'Стороны', kz: 'Тараптар', en: 'Parties' },
  risks: { ru: 'Риски', kz: 'Тәуекелдер', en: 'Risks' },
  missing: { ru: 'Чего не хватает', kz: 'Не жетіспейді', en: 'What is missing' },
  compliance: { ru: 'Соответствие праву РК', kz: 'ҚР құқығына сәйкестік', en: 'Compliance with Kazakhstan law' },
  recommendations: { ru: 'Что сделать', kz: 'Не істеу керек', en: 'What to do' },
  strengths: { ru: 'Сильные стороны', kz: 'Күшті жақтары', en: 'Strengths' },
  clause: { ru: 'Пункт', kz: 'Тармақ', en: 'Clause' },
  howToFix: { ru: 'Как исправить', kz: 'Қалай түзету керек', en: 'How to fix' },
  why: { ru: 'Зачем нужен', kz: 'Не үшін қажет', en: 'Why it matters' },
  noRisks: { ru: 'Рисков не найдено', kz: 'Тәуекелдер табылмады', en: 'No risks found' },

  high: { ru: 'высокий', kz: 'жоғары', en: 'high' },
  medium: { ru: 'средний', kz: 'орташа', en: 'medium' },
  low: { ru: 'низкий', kz: 'төмен', en: 'low' },
  critical: { ru: 'обязательный', kz: 'міндетті', en: 'critical' },
  recommended: { ru: 'желательный', kz: 'ұсынылады', en: 'recommended' },
  optional: { ru: 'по желанию', kz: 'қалауы бойынша', en: 'optional' },
  compliant: { ru: 'соответствует', kz: 'сәйкес келеді', en: 'compliant' },
  warning: { ru: 'под вопросом', kz: 'күмәнді', en: 'questionable' },
  violation: { ru: 'нарушение', kz: 'бұзушылық', en: 'violation' },

  caution: {
    ru: 'Разбор выполнен моделью и не заменяет заключение юриста. Ссылки на нормы не выверены по корпусу актов.',
    kz: 'Талдауды модель жасады және ол заңгер қорытындысын алмастырмайды. Нормаларға сілтемелер актілер корпусы бойынша тексерілмеген.',
    en: 'The analysis is produced by a model and does not replace a lawyer. Citations are not verified against the corpus.',
  },
}

/** Роли сторон по типам договоров: разбор ведётся с позиции одной из них. */
const ROLES: Record<string, [string, string]> = {
  sale: ['Продавец', 'Покупатель'],
  supply: ['Поставщик', 'Покупатель'],
  lease: ['Арендодатель', 'Арендатор'],
  services: ['Заказчик', 'Исполнитель'],
  construction: ['Заказчик', 'Подрядчик'],
  employment: ['Работодатель', 'Работник'],
  loan: ['Займодатель', 'Заёмщик'],
  nda: ['Раскрывающая сторона', 'Получающая сторона'],
  agency: ['Принципал', 'Агент'],
}

const TYPE_NAMES: Record<string, string> = {
  sale: 'Купля-продажа',
  supply: 'Поставка',
  lease: 'Аренда',
  services: 'Оказание услуг',
  construction: 'Подряд',
  employment: 'Трудовой договор',
  loan: 'Займ',
  nda: 'Конфиденциальность',
  agency: 'Агентский договор',
}

const MIN_TEXT = 400

function severityTone(level: string) {
  return level === 'high' ? 'ct-rv__mark--err'
    : level === 'low' ? 'ct-rv__mark--ok' : 'ct-rv__mark--warn'
}

function complianceTone(status: string) {
  return status === 'violation' ? 'ct-rv__mark--err'
    : status === 'compliant' ? 'ct-rv__mark--ok' : 'ct-rv__mark--warn'
}

function RiskCard({ risk, t }: { risk: Risk; t: (k: string) => string }) {
  return (
    <li className="ct-rv__item">
      <div className="ct-rv__itemhead">
        <span className={['ct-rv__mark', severityTone(risk.severity)].join(' ')}>
          {t(risk.severity) || risk.severity}
        </span>
        <UIText className="ct-rv__itemtitle">{risk.title}</UIText>
      </div>
      {risk.description ? <Body tone="ink2">{risk.description}</Body> : null}
      {risk.clause_reference ? (
        <Caption tone="mute">
          {t('clause')}: <span className="cite">{risk.clause_reference}</span>
        </Caption>
      ) : null}
      {risk.recommendation ? (
        <div className="ct-rv__fix">
          <Label as="div">{t('howToFix')}</Label>
          <Body tone="ink2">{risk.recommendation}</Body>
        </div>
      ) : null}
    </li>
  )
}

export function ReviewPage() {
  const t = useT(dict)
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)

  const [text, setText] = useState('')
  const [fileName, setFileName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [over, setOver] = useState(false)
  const [type, setType] = useState('')
  const [party, setParty] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [result, setResult] = useState<Analysis | null>(null)

  const roles = ROLES[type]
  const ready = Boolean(file) || text.trim().length >= MIN_TEXT

  const take = (f: File | null) => {
    if (!f) return
    setFile(f)
    setFileName(f.name)
    setText('')
    setError(null)
  }

  const reset = () => {
    setResult(null)
    setError(null)
    setFile(null)
    setFileName('')
    setText('')
  }

  const run = async () => {
    if (!ready || busy) return
    setBusy(true)
    setError(null)
    setResult(null)

    try {
      // Файл уходит формой, вставленный текст — обычным JSON: разбор
      // присланного файла делает сервер, у него для этого уже есть чтение
      // PDF и DOCX.
      let res: Response
      if (file) {
        const form = new FormData()
        form.append('file', file)
        if (type) form.append('contract_type', type)
        if (party) form.append('perspective', party)
        form.append('language', 'ru')
        res = await fetch('/api/contracts/analyze', {
          method: 'POST', body: form, credentials: 'include',
        })
      } else {
        res = await fetch('/api/contracts/analyze', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text, contract_type: type || null, perspective: party || null, language: 'ru',
          }),
        })
      }

      const body = await res.json().catch(() => ({}))
      if (!res.ok || !body.success) {
        throw new Error(body.message || body.error || t('fail'))
      }
      setResult(body.analysis as Analysis)
    } catch (e) {
      setError(e)
      toast(errorMessage(e, t('fail')), 'err')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <div className="page__head">
        <div className="page__title">
          <Display>{t('title')}</Display>
          <Body tone="mute">{t('lead')}</Body>
        </div>
      </div>

      <ContractTabs />

      {result ? (
        <section className="ct-rv enter">
          <div className="ct-rv__summary">
            <div className="ct-rv__score">
              <Label as="div">{t('score')}</Label>
              <div className="ct-rv__scorenum tabular">{result.overall_score}</div>
              <Caption tone="mute">
                {t('riskLevel')}: {t(result.risk_level) || result.risk_level}
              </Caption>
            </div>
            <div className="ct-rv__about">
              {result.summary ? <Body>{result.summary}</Body> : null}
              <div className="ct-rv__facts">
                {result.contract_type_detected ? (
                  <Caption tone="mute">
                    {t('detected')}: {TYPE_NAMES[result.contract_type_detected]
                      ?? result.contract_type_detected}
                  </Caption>
                ) : null}
                {result.parties?.length ? (
                  <Caption tone="mute">{t('parties')}: {result.parties.join(' — ')}</Caption>
                ) : null}
              </div>
              <Button variant="secondary" onClick={reset}>{t('again')}</Button>
            </div>
          </div>

          <p className="ct-rv__caution">{t('caution')}</p>

          <div className="ct-rv__block">
            <H3>{t('risks')}</H3>
            {result.risks?.length ? (
              <ul className="ct-rv__list">
                {result.risks.map((r, i) => <RiskCard key={i} risk={r} t={t} />)}
              </ul>
            ) : (
              <Body tone="mute">{t('noRisks')}</Body>
            )}
          </div>

          {result.missing_clauses?.length ? (
            <div className="ct-rv__block">
              <H3>{t('missing')}</H3>
              <ul className="ct-rv__list">
                {result.missing_clauses.map((m, i) => (
                  <li key={i} className="ct-rv__item">
                    <div className="ct-rv__itemhead">
                      <span className={['ct-rv__mark', m.importance === 'critical'
                        ? 'ct-rv__mark--err' : 'ct-rv__mark--warn'].join(' ')}>
                        {t(m.importance) || m.importance}
                      </span>
                      <UIText className="ct-rv__itemtitle">{m.clause}</UIText>
                    </div>
                    {m.reason ? (
                      <div className="ct-rv__fix">
                        <Label as="div">{t('why')}</Label>
                        <Body tone="ink2">{m.reason}</Body>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {result.compliance?.length ? (
            <div className="ct-rv__block">
              <H3>{t('compliance')}</H3>
              <ul className="ct-rv__list">
                {result.compliance.map((c, i) => (
                  <li key={i} className="ct-rv__item">
                    <div className="ct-rv__itemhead">
                      <span className={['ct-rv__mark', complianceTone(c.status)].join(' ')}>
                        {t(c.status) || c.status}
                      </span>
                      <span className="cite">{c.law}</span>
                    </div>
                    {c.note ? <Body tone="ink2">{c.note}</Body> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {result.recommendations?.length ? (
            <div className="ct-rv__block">
              <H3>{t('recommendations')}</H3>
              <ul className="ct-rv__list">
                {result.recommendations.map((r, i) => (
                  <li key={i} className="ct-rv__item">
                    <div className="ct-rv__itemhead">
                      <span className={['ct-rv__mark', severityTone(r.priority)].join(' ')}>
                        {t(r.priority) || r.priority}
                      </span>
                      <UIText className="ct-rv__itemtitle">{r.title}</UIText>
                    </div>
                    {r.description ? <Body tone="ink2">{r.description}</Body> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {result.strengths?.length ? (
            <div className="ct-rv__block">
              <H3>{t('strengths')}</H3>
              <ul className="ct-rv__plain">
                {result.strengths.map((s, i) => <li key={i}><Body tone="ink2">{s}</Body></li>)}
              </ul>
            </div>
          ) : null}
        </section>
      ) : (
        <section className="ct-rv__form">
          <div className="ct-rv__source">
          <div
            className={['ct-rv__drop', over ? 'ct-rv__drop--over' : ''].filter(Boolean).join(' ')}
            onDragOver={(e) => { e.preventDefault(); setOver(true) }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setOver(false)
              take(e.dataTransfer.files?.[0] ?? null)
            }}
          >
            <UIText tone="mute">{fileName || t('drop')}</UIText>
            <Button variant="secondary" onClick={() => fileRef.current?.click()}>
              {t('pick')}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.docx,.txt"
              className="visually-hidden"
              onChange={(e) => take(e.target.files?.[0] ?? null)}
            />
          </div>

          <Label as="div" className="ct-rv__or">{t('or')}</Label>
          <Textarea
            value={text}
            rows={10}
            placeholder={t('textPlaceholder')}
            aria-label={t('textPlaceholder')}
            onChange={(e) => { setText(e.target.value); setFile(null); setFileName('') }}
          />
          {text.trim().length > 0 && text.trim().length < MIN_TEXT ? (
            <Caption tone="warn">{t('tooShort')}</Caption>
          ) : null}
          </div>

          <div className="ct-rv__opts">
            <Select
              label={t('type')}
              value={type}
              onChange={(e) => { setType(e.target.value); setParty('') }}
            >
              <option value="">{t('autoType')}</option>
              {Object.entries(TYPE_NAMES).map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </Select>

            <div className="ct-rv__party">
              <Label as="div">{t('position')}</Label>
              <div className="ct-rv__chips">
                <Chip active={!party} onClick={() => setParty('')}>{t('neutral')}</Chip>
                {roles?.map((role) => (
                  <Chip key={role} active={party === role} onClick={() => setParty(role)}>
                    {role}
                  </Chip>
                ))}
              </div>
              <Caption tone="mute">{t('positionHint')}</Caption>
            </div>

            {busy ? (
              <div className="ct-rv__busy">
                <Loading />
                <Caption tone="mute">{t('working')}</Caption>
              </div>
            ) : (
              <Button variant="primary" onClick={run} disabled={!ready}>{t('run')}</Button>
            )}

            {error && !busy ? <LoadFailure error={error} onRetry={run} /> : null}
          </div>
        </section>
      )}
    </div>
  )
}
