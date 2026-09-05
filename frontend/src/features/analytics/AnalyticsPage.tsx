import { useRef, useState } from 'react'
import {
  Body,
  Button,
  Caption,
  Cite,
  Display,
  Empty,
  H2,
  Label,
  Legal,
  Status,
  Table,
  UIText,
} from '../../shared/ui'
import type { StatusKind } from '../../shared/ui'
import { useLang, useT } from '../../i18n'
import type { Dict } from '../../i18n'
import { citeCode } from '../legal/cite'
import './analytics.css'

/* ============================================================
   Правовая аналитика общественного обсуждения законопроекта.

   Считается то же, что и в legal_analytics/analyzer.py: общий обзор,
   распределение тональности, темы обсуждения и спорные места.
   Диаграммы — полосы и инлайновый SVG на токенах: ни библиотек,
   ни круговых, ни карточек.
   ============================================================ */

const TOTAL = 1247

const SENTIMENT = { pos: 474, neu: 262, neg: 511 }

const RISK_COUNT = 9

/** Тем девять, счётчики в сумме дают общее число комментариев. */
const THEMES: { id: string; count: number; tone: StatusKind }[] = [
  { id: 'threshold', count: 214, tone: 'err' },
  { id: 'electronic', count: 186, tone: 'ok' },
  { id: 'appeal', count: 173, tone: 'err' },
  { id: 'registry', count: 158, tone: 'err' },
  { id: 'domestic', count: 141, tone: 'ok' },
  { id: 'qualification', count: 122, tone: 'idle' },
  { id: 'dumping', count: 108, tone: 'err' },
  { id: 'liability', count: 84, tone: 'ok' },
  { id: 'other', count: 61, tone: 'idle' },
]

/** Поступление комментариев по неделям обсуждения. */
const WEEKS = [62, 118, 174, 231, 196, 155, 173, 138]

const RISKS: { id: string; kind: 'conflict' | 'gap' | 'corruption'; level: StatusKind; cite: string }[] = [
  { id: 'threshold', kind: 'conflict', level: 'err', cite: 'БК РК 41.2' },
  { id: 'appeal', kind: 'conflict', level: 'err', cite: 'АППК РК 91.1' },
  { id: 'registry', kind: 'conflict', level: 'err', cite: 'Конституция РК 77.3' },
  { id: 'dumping', kind: 'corruption', level: 'warn', cite: 'ЗРК О ПА 18.2' },
  { id: 'eaeu', kind: 'conflict', level: 'warn', cite: 'Договор о ЕАЭС 88' },
  { id: 'liability', kind: 'gap', level: 'warn', cite: 'КоАП РК 207' },
]

const dict = {
  title: { ru: 'Аналитика', kz: 'Аналитика', en: 'Analytics' },
  lead: {
    ru: 'Разбор общественных комментариев к законопроекту: тональность, темы и юридически значимые возражения.',
    kz: 'Заң жобасына түскен қоғамдық пікірлерді талдау: реңк, тақырыптар және құқықтық маңызы бар қарсылықтар.',
    en: 'Analysis of public comments on a draft law: sentiment, themes and legally significant objections.',
  },

  /* Источник */
  upload: { ru: 'Загрузить файл', kz: 'Файл жүктеу', en: 'Upload file' },
  demo: { ru: 'Демо-данные', kz: 'Демо-деректер', en: 'Demo data' },
  reset: { ru: 'Очистить', kz: 'Тазалау', en: 'Clear' },
  sourceHint: {
    ru: 'Принимаются выгрузки CSV, XLSX и JSON с портала «Открытые НПА».',
    kz: '«Ашық НҚА» порталынан CSV, XLSX және JSON форматындағы жүктемелер қабылданады.',
    en: 'CSV, XLSX and JSON exports from the Open Legal Acts portal are accepted.',
  },
  source: { ru: 'Источник', kz: 'Дереккөз', en: 'Source' },
  demoSource: {
    ru: 'Обсуждение проекта закона о государственных закупках, 21.01 — 17.03.2026',
    kz: 'Мемлекеттік сатып алу туралы заң жобасын талқылау, 21.01 — 17.03.2026',
    en: 'Public discussion of the public procurement bill, 21 Jan — 17 Mar 2026',
  },

  emptyTitle: { ru: 'Комментарии не загружены', kz: 'Пікірлер жүктелмеген', en: 'No comments loaded' },
  emptyBody: {
    ru: 'Загрузите выгрузку обсуждения или откройте демонстрационный набор: обсуждение законопроекта о государственных закупках, 1 247 комментариев.',
    kz: 'Талқылау жүктемесін жүктеңіз немесе демонстрациялық жинақты ашыңыз: мемлекеттік сатып алу туралы заң жобасын талқылау, 1 247 пікір.',
    en: 'Upload a discussion export or open the demonstration set: the public procurement bill discussion, 1,247 comments.',
  },

  /* Сводка */
  figTotal: { ru: 'Всего комментариев', kz: 'Барлық пікір', en: 'Comments in total' },
  figSupport: { ru: 'Поддержка', kz: 'Қолдау', en: 'Support' },
  figCritique: { ru: 'Критика', kz: 'Сын', en: 'Criticism' },
  figRisks: { ru: 'Выявленных рисков', kz: 'Анықталған тәуекел', en: 'Risks identified' },

  /* Тональность */
  toneHead: { ru: 'Распределение тональности', kz: 'Реңктің таралуы', en: 'Sentiment distribution' },
  toneLead: {
    ru: 'Доли считаются по всем комментариям обсуждения, без учёта повторных обращений одного автора.',
    kz: 'Үлестер талқылаудағы барлық пікір бойынша, бір автордың қайталама өтініштерін есепке алмай саналады.',
    en: 'Shares are computed over all comments, excluding repeat submissions by the same author.',
  },
  tonePos: { ru: 'Поддержка', kz: 'Қолдау', en: 'Support' },
  toneNeu: { ru: 'Нейтрально', kz: 'Бейтарап', en: 'Neutral' },
  toneNeg: { ru: 'Критика', kz: 'Сын', en: 'Criticism' },

  /* Динамика */
  dynHead: { ru: 'Поступление по неделям', kz: 'Апта бойынша түсуі', en: 'Weekly inflow' },
  dynLead: {
    ru: 'Пик приходится на четвёртую неделю — публикацию сравнительной таблицы.',
    kz: 'Ең жоғары көрсеткіш төртінші аптаға — салыстырмалы кестенің жариялануына сәйкес келеді.',
    en: 'The peak falls on week four, when the comparative table was published.',
  },
  week: { ru: 'нед.', kz: 'апта', en: 'wk' },

  /* Темы */
  themesHead: { ru: 'Темы обсуждения', kz: 'Талқылау тақырыптары', en: 'Discussion themes' },
  colTheme: { ru: 'Тема', kz: 'Тақырып', en: 'Theme' },
  colCount: { ru: 'Комментариев', kz: 'Пікір саны', en: 'Comments' },
  colTone: { ru: 'Преобладающая тональность', kz: 'Басым реңк', en: 'Dominant sentiment' },
  colShare: { ru: 'Доля', kz: 'Үлес', en: 'Share' },

  th_threshold: {
    ru: 'Порог закупок из одного источника',
    kz: 'Бір көзден сатып алу шегі',
    en: 'Single-source procurement threshold',
  },
  th_electronic: {
    ru: 'Электронный формат конкурсных заявок',
    kz: 'Конкурстық өтінімдердің электрондық форматы',
    en: 'Electronic format of tender bids',
  },
  th_appeal: {
    ru: 'Сроки обжалования в уполномоченном органе',
    kz: 'Уәкілетті органда шағымдану мерзімдері',
    en: 'Appeal deadlines before the authorised body',
  },
  th_registry: {
    ru: 'Реестр недобросовестных поставщиков',
    kz: 'Жосықсыз өнім берушілер тізілімі',
    en: 'Register of unreliable suppliers',
  },
  th_domestic: {
    ru: 'Поддержка отечественного товаропроизводителя',
    kz: 'Отандық тауар өндірушіні қолдау',
    en: 'Support for domestic producers',
  },
  th_qualification: {
    ru: 'Квалификационные требования к участникам',
    kz: 'Қатысушыларға қойылатын біліктілік талаптары',
    en: 'Qualification requirements for bidders',
  },
  th_dumping: {
    ru: 'Демпинг и аномально низкая цена',
    kz: 'Демпинг және шамадан тыс төмен баға',
    en: 'Dumping and abnormally low price',
  },
  th_liability: {
    ru: 'Ответственность заказчика за срыв сроков',
    kz: 'Тапсырыс берушінің мерзімді бұзғаны үшін жауапкершілігі',
    en: 'Customer liability for missed deadlines',
  },
  th_other: { ru: 'Прочее', kz: 'Өзгесі', en: 'Other' },

  /* Риски */
  risksHead: { ru: 'Ключевые риски и противоречия', kz: 'Негізгі тәуекелдер мен қайшылықтар', en: 'Key risks and conflicts' },
  risksLead: {
    ru: 'Возражения, поднятые в комментариях и подтверждённые сверкой с действующими нормами.',
    kz: 'Пікірлерде көтерілген және қолданыстағы нормалармен салыстыру арқылы расталған қарсылықтар.',
    en: 'Objections raised in the comments and confirmed against provisions in force.',
  },
  kindConflict: { ru: 'Противоречие', kz: 'Қайшылық', en: 'Conflict' },
  kindGap: { ru: 'Пробел', kz: 'Олқылық', en: 'Gap' },
  kindCorruption: { ru: 'Коррупциогенный фактор', kz: 'Сыбайлас жемқорлық факторы', en: 'Corruption-prone factor' },
  levelErr: { ru: 'Высокий', kz: 'Жоғары', en: 'High' },
  levelWarn: { ru: 'Средний', kz: 'Орташа', en: 'Medium' },
  levelOk: { ru: 'Низкий', kz: 'Төмен', en: 'Low' },
  levelIdle: { ru: 'Не оценён', kz: 'Бағаланбаған', en: 'Not assessed' },
  mentions: { ru: 'упоминаний', kz: 'рет айтылған', en: 'mentions' },

  rk_threshold: {
    ru: 'Порог прямой закупки в четыре тысячи МРП не согласован с предельными значениями Бюджетного кодекса.',
    kz: 'Төрт мың АЕК мөлшеріндегі тікелей сатып алу шегі Бюджет кодексінің шекті мәндерімен үйлеспейді.',
    en: 'The direct-award threshold of four thousand MCI is inconsistent with the limits set by the Budget Code.',
  },
  rk_appeal: {
    ru: 'Срок обжалования в десять рабочих дней короче общего срока административной процедуры.',
    kz: 'Он жұмыс күндік шағымдану мерзімі әкімшілік рәсімнің жалпы мерзімінен қысқа.',
    en: 'The ten-working-day appeal window is shorter than the general administrative procedure deadline.',
  },
  rk_registry: {
    ru: 'Включение в реестр недобросовестных поставщиков допускается без вступившего в силу судебного акта.',
    kz: 'Жосықсыз өнім берушілер тізіліміне енгізу заңды күшіне енген сот актісінсіз жүзеге асырылады.',
    en: 'Entry in the register of unreliable suppliers is allowed without a final court decision.',
  },
  rk_dumping: {
    ru: 'Понятие аномально низкой цены отсылает к подзаконному акту, не принятому на дату внесения проекта.',
    kz: 'Шамадан тыс төмен баға ұғымы жоба енгізілген күні қабылданбаған заңға тәуелді актіге сілтейді.',
    en: 'The notion of an abnormally low price refers to a by-law that did not exist when the bill was tabled.',
  },
  rk_eaeu: {
    ru: 'Преференция отечественному товаропроизводителю расходится с обязательствами по Договору о ЕАЭС.',
    kz: 'Отандық тауар өндірушіге берілетін артықшылық ЕАЭО туралы шарт бойынша міндеттемелерге қайшы келеді.',
    en: 'The preference for domestic producers diverges from obligations under the EAEU Treaty.',
  },
  rk_liability: {
    ru: 'Ответственность заказчика за срыв сроков оплаты не подкреплена составом административного правонарушения.',
    kz: 'Тапсырыс берушінің төлем мерзімін бұзғаны үшін жауапкершілігі әкімшілік құқық бұзушылық құрамымен бекітілмеген.',
    en: 'Customer liability for late payment is not backed by any administrative offence provision.',
  },

  export: { ru: 'Экспорт отчёта', kz: 'Есепті экспорттау', en: 'Export report' },
} satisfies Dict

type Key = keyof typeof dict

const toneKey: Record<StatusKind, Key> = {
  ok: 'tonePos',
  idle: 'toneNeu',
  err: 'toneNeg',
  warn: 'toneNeu',
}

const levelKey: Record<StatusKind, Key> = {
  ok: 'levelOk',
  warn: 'levelWarn',
  err: 'levelErr',
  idle: 'levelIdle',
}

const kindKey = {
  conflict: 'kindConflict',
  gap: 'kindGap',
  corruption: 'kindCorruption',
} satisfies Record<string, Key>

/** Разряды разделяются неразрывным пробелом: 1 247. */
function num(n: number): string {
  return n.toLocaleString('ru-RU').replace(/ |\s/g, ' ')
}

function pct(part: number, whole = TOTAL): number {
  return Math.round((part / whole) * 1000) / 10
}

export function AnalyticsPage() {
  const { lang } = useLang()
  const t = useT(dict)
  const fileRef = useRef<HTMLInputElement>(null)
  // Демо-набор показывается сразу: экран аналитики бессмыслен без данных,
  // а пустое состояние всё равно видно до первой загрузки своего файла.
  const [source, setSource] = useState<string | null>('demo')

  const posP = pct(SENTIMENT.pos)
  const neuP = pct(SENTIMENT.neu)
  const negP = pct(SENTIMENT.neg)

  /* Кривая динамики: инлайновый SVG, координаты считаются здесь. */
  const peak = Math.max(...WEEKS)
  const stepX = 280 / (WEEKS.length - 1)
  const points = WEEKS.map((v, i) => ({
    x: 20 + i * stepX,
    y: 70 - (v / peak) * 54,
    v,
  }))
  const path = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

  return (
    <div className="page">
      <div className="page__head">
        <div className="page__title">
          <Display>{t('title')}</Display>
          <Body tone="mute">{t('lead')}</Body>
        </div>
        {source ? <Button variant="secondary">{t('export')}</Button> : null}
      </div>

      <div className="an-source">
        <input
          ref={fileRef}
          type="file"
          className="an-source__file"
          accept=".csv,.xlsx,.json"
          onChange={(e) => setSource(e.target.files?.[0]?.name ?? null)}
        />
        <Button variant="secondary" onClick={() => fileRef.current?.click()}>
          {t('upload')}
        </Button>
        <Button variant="primary" onClick={() => setSource(t('demoSource'))}>
          {t('demo')}
        </Button>
        {source ? (
          <>
            <Label as="span">{t('source')}</Label>
            <UIText tone="ink2">{source}</UIText>
            <Button variant="ghost" onClick={() => setSource(null)}>
              {t('reset')}
            </Button>
          </>
        ) : (
          <Caption tone="mute">{t('sourceHint')}</Caption>
        )}
      </div>

      {!source ? (
        <div className="an-block">
          <Empty
            title={t('emptyTitle')}
            action={
              <Button variant="primary" onClick={() => setSource(t('demoSource'))}>
                {t('demo')}
              </Button>
            }
          >
            {t('emptyBody')}
          </Empty>
        </div>
      ) : (
        <>
          {/* ---------- Сводка числами ---------- */}
          <div className="an-figures">
            <div className="an-figure">
              <span className="an-figure__value">{num(TOTAL)}</span>
              <Label as="div" className="an-figure__label">
                {t('figTotal')}
              </Label>
            </div>
            <div className="an-figure">
              <span className="an-figure__value an-figure__value--ok">{posP}%</span>
              <Label as="div" className="an-figure__label">
                {t('figSupport')}
              </Label>
            </div>
            <div className="an-figure">
              <span className="an-figure__value an-figure__value--err">{negP}%</span>
              <Label as="div" className="an-figure__label">
                {t('figCritique')}
              </Label>
            </div>
            <div className="an-figure">
              <span className="an-figure__value">{RISK_COUNT}</span>
              <Label as="div" className="an-figure__label">
                {t('figRisks')}
              </Label>
            </div>
          </div>

          {/* ---------- Полоса распределения тональности ---------- */}
          <div className="an-block">
            <div className="an-block__head">
              <div>
                <H2>{t('toneHead')}</H2>
                <Body tone="mute">{t('toneLead')}</Body>
              </div>
            </div>

            <div
              className="an-bar"
              role="img"
              aria-label={`${t('tonePos')} ${posP}%, ${t('toneNeu')} ${neuP}%, ${t('toneNeg')} ${negP}%`}
            >
              <div className="an-bar__seg an-bar__seg--pos" style={{ width: `${posP}%` }} />
              <div className="an-bar__seg an-bar__seg--neu" style={{ width: `${neuP}%` }} />
              <div className="an-bar__seg an-bar__seg--neg" style={{ width: `${negP}%` }} />
            </div>

            <div className="an-legend">
              <span className="an-legend__item">
                <span className="an-legend__swatch an-legend__swatch--pos" />
                <UIText tone="ink2">
                  {t('tonePos')} — {num(SENTIMENT.pos)} · {posP}%
                </UIText>
              </span>
              <span className="an-legend__item">
                <span className="an-legend__swatch an-legend__swatch--neu" />
                <UIText tone="ink2">
                  {t('toneNeu')} — {num(SENTIMENT.neu)} · {neuP}%
                </UIText>
              </span>
              <span className="an-legend__item">
                <span className="an-legend__swatch an-legend__swatch--neg" />
                <UIText tone="ink2">
                  {t('toneNeg')} — {num(SENTIMENT.neg)} · {negP}%
                </UIText>
              </span>
            </div>
          </div>

          {/* ---------- Динамика поступления ---------- */}
          <div className="an-block">
            <div className="an-block__head">
              <div>
                <H2>{t('dynHead')}</H2>
                <Body tone="mute">{t('dynLead')}</Body>
              </div>
            </div>

            <svg className="an-plot" viewBox="0 0 320 80" role="img" aria-label={t('dynHead')}>
              <line className="an-plot__axis" x1="20" y1="72" x2="300" y2="72" />
              <polyline className="an-plot__line" points={path} />
              {points.map((p) => (
                <circle className="an-plot__dot" key={p.x} cx={p.x} cy={p.y} r="2" />
              ))}
            </svg>
            <div className="an-plot-scale">
              {WEEKS.map((v, i) => (
                <Caption key={i} tone="mute">
                  {i + 1} {t('week')} · {v}
                </Caption>
              ))}
            </div>
          </div>

          {/* ---------- Темы ---------- */}
          <div className="an-block">
            <div className="an-block__head">
              <H2>{t('themesHead')}</H2>
            </div>
            <Table>
              <thead>
                <tr>
                  <th>{t('colTheme')}</th>
                  <th>{t('colCount')}</th>
                  <th>{t('colTone')}</th>
                  <th>{t('colShare')}</th>
                </tr>
              </thead>
              <tbody>
                {THEMES.map((th) => {
                  const share = pct(th.count)
                  return (
                    <tr key={th.id}>
                      <td>{t(`th_${th.id}` as Key)}</td>
                      <td>{num(th.count)}</td>
                      <td>
                        <Status kind={th.tone}>{t(toneKey[th.tone])}</Status>
                      </td>
                      <td>
                        <span className="an-share">
                          <span className="an-share__track">
                            <span className="an-share__fill" style={{ width: `${(share / 20) * 100}%` }} />
                          </span>
                          <Caption tone="mute" className="an-share__num">
                            {share}%
                          </Caption>
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </Table>
          </div>

          {/* ---------- Риски и противоречия ---------- */}
          <div className="an-block">
            <div className="an-block__head">
              <div>
                <H2>{t('risksHead')}</H2>
                <Body tone="mute">{t('risksLead')}</Body>
              </div>
              <Button variant="secondary">{t('export')}</Button>
            </div>

            <div className="an-risks">
              {RISKS.map((r, i) => {
                const theme = THEMES.find((th) => th.id === r.id)
                return (
                  <div className="an-risk" key={r.id}>
                    <span className="an-risk__no">{i + 1}.</span>
                    <div className="an-risk__main">
                      <Legal>{t(`rk_${r.id}` as Key)}</Legal>
                      <div className="an-risk__meta">
                        <Cite code={citeCode(r.cite, lang)} />
                        <Caption tone="mute">{t(kindKey[r.kind])}</Caption>
                        <Status kind={r.level}>{t(levelKey[r.level])}</Status>
                        {theme ? (
                          <Caption tone="mute">
                            {num(theme.count)} {t('mentions')}
                          </Caption>
                        ) : null}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
