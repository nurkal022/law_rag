import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  Body,
  Button,
  Caption,
  Chip,
  Cite,
  Display,
  Empty,
  H2,
  H3,
  Label,
  Legal,
  Loading,
  Mono,
  Status,
  Table,
  UIText,
  useToast,
} from '../../shared/ui'
import type { StatusKind } from '../../shared/ui'
import { Reveal, useCountUp, useCountUpInt } from '../../shared/motion'
import { useLang, useT } from '../../i18n'
import type { Dict } from '../../i18n'
import { citeCode } from '../legal/cite'
import './analytics.css'
import './analytics.motion.css'

/* ============================================================
   Правовая аналитика общественного обсуждения законопроекта.

   Считается то же, что и в legal_analytics/analyzer.py: общий обзор,
   распределение тональности, темы обсуждения и спорные места.
   Диаграммы — полосы и инлайновый SVG на токенах: ни библиотек,
   ни круговых, ни карточек.

   Разбор идёт по замоканному набору: файл принимается, полторы секунды
   показывается ожидание и возвращается тот же демонстрационный корпус.
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

  /* Ход разбора */
  parsing: { ru: 'Разбираем выгрузку', kz: 'Жүктеме талданып жатыр', en: 'Parsing the export' },
  parsingHint: {
    ru: 'Комментарии размечаются по тональности и сводятся в темы. Обычно это занимает несколько секунд.',
    kz: 'Пікірлер реңкі бойынша белгіленіп, тақырыптарға жинақталады. Әдетте бұл бірнеше секунд алады.',
    en: 'Comments are being tagged by sentiment and grouped into themes. This usually takes a few seconds.',
  },
  toastLoaded: {
    ru: 'Выгрузка разобрана: 1 247 комментариев',
    kz: 'Жүктеме талданды: 1 247 пікір',
    en: 'Export parsed: 1,247 comments',
  },
  toastCleared: { ru: 'Разбор очищен', kz: 'Талдау тазаланды', en: 'Analysis cleared' },
  toastExport: {
    ru: 'Отчёт подготовлен и поставлен в очередь на выгрузку',
    kz: 'Есеп дайындалып, шығаруға кезекке қойылды',
    en: 'The report has been prepared and queued for download',
  },
  toastDemoOnly: {
    ru: 'Демонстрационный режим: данные не покидают браузер',
    kz: 'Демонстрациялық режим: деректер браузерден шықпайды',
    en: 'Demonstration mode: the data never leaves the browser',
  },

  /* Сводка */
  figTotal: { ru: 'Всего комментариев', kz: 'Барлық пікір', en: 'Comments in total' },
  figSupport: { ru: 'Поддержка', kz: 'Қолдау', en: 'Support' },
  figCritique: { ru: 'Критика', kz: 'Сын', en: 'Criticism' },
  figRisks: { ru: 'Выявленных рисков', kz: 'Анықталған тәуекел', en: 'Risks identified' },

  /* Тональность */
  toneHead: { ru: 'Распределение тональности', kz: 'Реңктің таралуы', en: 'Sentiment distribution' },
  toneLead: {
    ru: 'Доли считаются по всем комментариям обсуждения, без учёта повторных обращений одного автора. Нажмите на тональность, чтобы оставить в таблице только её темы.',
    kz: 'Үлестер талқылаудағы барлық пікір бойынша, бір автордың қайталама өтініштерін есепке алмай саналады. Кестеде тек сол реңктің тақырыптарын қалдыру үшін реңкті басыңыз.',
    en: 'Shares are computed over all comments, excluding repeat submissions by the same author. Click a sentiment to keep only its themes in the table.',
  },
  tonePos: { ru: 'Поддержка', kz: 'Қолдау', en: 'Support' },
  toneNeu: { ru: 'Нейтрально', kz: 'Бейтарап', en: 'Neutral' },
  toneNeg: { ru: 'Критика', kz: 'Сын', en: 'Criticism' },

  /* Динамика */
  dynHead: { ru: 'Поступление по неделям', kz: 'Апта бойынша түсуі', en: 'Weekly inflow' },
  dynLead: {
    ru: 'Пик приходится на четвёртую неделю — публикацию сравнительной таблицы. Наведите на точку, чтобы увидеть значение.',
    kz: 'Ең жоғары көрсеткіш төртінші аптаға — салыстырмалы кестенің жариялануына сәйкес келеді. Мәнді көру үшін нүктеге меңзеңіз.',
    en: 'The peak falls on week four, when the comparative table was published. Hover a point to read its value.',
  },
  week: { ru: 'нед.', kz: 'апта', en: 'wk' },

  /* Темы */
  themesHead: { ru: 'Темы обсуждения', kz: 'Талқылау тақырыптары', en: 'Discussion themes' },
  colTheme: { ru: 'Тема', kz: 'Тақырып', en: 'Theme' },
  colCount: { ru: 'Комментариев', kz: 'Пікір саны', en: 'Comments' },
  colTone: { ru: 'Преобладающая тональность', kz: 'Басым реңк', en: 'Dominant sentiment' },
  colShare: { ru: 'Доля', kz: 'Үлес', en: 'Share' },
  filterAll: { ru: 'Все темы', kz: 'Барлық тақырып', en: 'All themes' },
  filtered: { ru: 'Отбор по тональности', kz: 'Реңк бойынша іріктеу', en: 'Filtered by sentiment' },
  noThemes: { ru: 'Тем с такой тональностью нет', kz: 'Мұндай реңкті тақырып жоқ', en: 'No themes with this sentiment' },
  noThemesBody: {
    ru: 'Снимите отбор по тональности, чтобы вернуть полный список тем обсуждения.',
    kz: 'Талқылау тақырыптарының толық тізімін қайтару үшін реңк бойынша іріктеуді алып тастаңыз.',
    en: 'Clear the sentiment filter to bring back the full list of discussion themes.',
  },

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
    ru: 'Возражения, поднятые в комментариях и подтверждённые сверкой с действующими нормами. Нажмите на строку, чтобы раскрыть разбор.',
    kz: 'Пікірлерде көтерілген және қолданыстағы нормалармен салыстыру арқылы расталған қарсылықтар. Талдауды ашу үшін жолды басыңыз.',
    en: 'Objections raised in the comments and confirmed against provisions in force. Click a row to open the analysis.',
  },
  kindConflict: { ru: 'Противоречие', kz: 'Қайшылық', en: 'Conflict' },
  kindGap: { ru: 'Пробел', kz: 'Олқылық', en: 'Gap' },
  kindCorruption: { ru: 'Коррупциогенный фактор', kz: 'Сыбайлас жемқорлық факторы', en: 'Corruption-prone factor' },
  levelErr: { ru: 'Высокий', kz: 'Жоғары', en: 'High' },
  levelWarn: { ru: 'Средний', kz: 'Орташа', en: 'Medium' },
  levelOk: { ru: 'Низкий', kz: 'Төмен', en: 'Low' },
  levelIdle: { ru: 'Не оценён', kz: 'Бағаланбаған', en: 'Not assessed' },
  mentions: { ru: 'упоминаний', kz: 'рет айтылған', en: 'mentions' },
  riskNorm: { ru: 'Норма', kz: 'Норма', en: 'Provision' },
  riskRec: { ru: 'Рекомендация', kz: 'Ұсыным', en: 'Recommendation' },

  rt_threshold: {
    ru: 'Порог прямой закупки расходится с Бюджетным кодексом',
    kz: 'Тікелей сатып алу шегі Бюджет кодексіне қайшы келеді',
    en: 'Direct-award threshold conflicts with the Budget Code',
  },
  rt_appeal: {
    ru: 'Срок обжалования короче общего административного',
    kz: 'Шағымдану мерзімі жалпы әкімшілік мерзімнен қысқа',
    en: 'Appeal window is shorter than the general administrative one',
  },
  rt_registry: {
    ru: 'Реестр недобросовестных поставщиков без судебного акта',
    kz: 'Жосықсыз өнім берушілер тізілімі сот актісінсіз',
    en: 'Register of unreliable suppliers without a court decision',
  },
  rt_dumping: {
    ru: 'Аномально низкая цена определяется несуществующим актом',
    kz: 'Шамадан тыс төмен баға жоқ актімен айқындалады',
    en: 'Abnormally low price defined by a non-existent by-law',
  },
  rt_eaeu: {
    ru: 'Преференция отечественному производителю против Договора о ЕАЭС',
    kz: 'Отандық өндірушіге артықшылық ЕАЭО туралы шартқа қайшы',
    en: 'Domestic-producer preference against the EAEU Treaty',
  },
  rt_liability: {
    ru: 'Ответственность заказчика не подкреплена составом',
    kz: 'Тапсырыс беруші жауапкершілігі құраммен бекітілмеген',
    en: 'Customer liability is not backed by an offence provision',
  },

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

  rc_threshold: {
    ru: 'Привести порог к предельному значению бюджетного законодательства либо внести согласованную поправку в Бюджетный кодекс одним пакетом.',
    kz: 'Шекті мәнді бюджет заңнамасының шегіне сәйкестендіру немесе Бюджет кодексіне келісілген түзетуді бір пакетпен енгізу.',
    en: 'Align the threshold with the budget-law limit, or amend the Budget Code in the same package.',
  },
  rc_appeal: {
    ru: 'Увеличить срок обжалования до общего административного либо прямо назвать его специальным с обоснованием сокращения.',
    kz: 'Шағымдану мерзімін жалпы әкімшілік мерзімге дейін ұзарту немесе оны қысқарту негіздемесімен арнайы деп тікелей атау.',
    en: 'Extend the appeal window to the general administrative deadline, or state it as a special one with a justification.',
  },
  rc_registry: {
    ru: 'Обусловить включение в реестр вступившим в силу судебным актом: иначе мера остаётся санкцией без суда.',
    kz: 'Тізілімге енгізуді заңды күшіне енген сот актісіне байланыстыру: әйтпесе шара сотсыз санкция болып қалады.',
    en: 'Condition registry entry on a final court decision; otherwise the measure remains a sanction without trial.',
  },
  rc_dumping: {
    ru: 'Определить признаки аномально низкой цены в самом законе либо отложить норму до принятия подзаконного акта.',
    kz: 'Шамадан тыс төмен баға белгілерін заңның өзінде айқындау немесе норманы заңға тәуелді акт қабылданғанға дейін кейінге қалдыру.',
    en: 'Define the abnormally-low-price test in the law itself, or defer the rule until the by-law is adopted.',
  },
  rc_eaeu: {
    ru: 'Согласовать объём преференции с изъятиями, прямо допускаемыми Договором о ЕАЭС, и указать срок её действия.',
    kz: 'Артықшылық көлемін ЕАЭО туралы шарт тікелей жол беретін алып қоюлармен келісіп, оның қолданылу мерзімін көрсету.',
    en: 'Match the preference to the carve-outs the EAEU Treaty expressly allows and set an expiry date for it.',
  },
  rc_liability: {
    ru: 'Дополнить КоАП составом за нарушение срока оплаты: без санкции обязанность заказчика остаётся декларативной.',
    kz: 'ӘҚБтК-ні төлем мерзімін бұзғаны үшін құраммен толықтыру: санкциясыз тапсырыс беруші міндеті декларативті болып қалады.',
    en: 'Add an administrative offence for late payment; without a sanction the duty stays declaratory.',
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
  return n.toLocaleString('ru-RU').replace(/ |\s/g, ' ')
}

function pct(part: number, whole = TOTAL): number {
  return Math.round((part / whole) * 1000) / 10
}

/* ============================================================
   Сводка числами. Отдельный компонент, потому что счётчики должны
   начинаться заново при каждой новой загрузке: ключ на источнике
   пересоздаёт узел, и числа снова набегают.
   ============================================================ */
function Figures({ posP, negP, t }: { posP: number; negP: number; t: (k: Key) => string }) {
  const total = useCountUpInt(TOTAL)
  const pos = useCountUp(posP)
  const neg = useCountUp(negP)
  const risks = useCountUpInt(RISK_COUNT, 700)

  return (
    <div className="an-figures">
      <div className="an-figure">
        <span className="an-figure__value tabular">{total}</span>
        <Label as="div" className="an-figure__label">
          {t('figTotal')}
        </Label>
      </div>
      <div className="an-figure">
        <span className="an-figure__value an-figure__value--ok tabular">{pos.toFixed(1)}%</span>
        <Label as="div" className="an-figure__label">
          {t('figSupport')}
        </Label>
      </div>
      <div className="an-figure">
        <span className="an-figure__value an-figure__value--err tabular">{neg.toFixed(1)}%</span>
        <Label as="div" className="an-figure__label">
          {t('figCritique')}
        </Label>
      </div>
      <div className="an-figure">
        <span className="an-figure__value tabular">{risks}</span>
        <Label as="div" className="an-figure__label">
          {t('figRisks')}
        </Label>
      </div>
    </div>
  )
}

/* ============================================================
   Полоса тональности. Сегменты выходят из нуля: ширина ставится
   не при отрисовке, а следующим кадром, поэтому переход виден.
   ============================================================ */
type Tone = 'pos' | 'neu' | 'neg'
const toneOf: Record<Tone, StatusKind> = { pos: 'ok', neu: 'idle', neg: 'err' }

function ToneBar({
  shares,
  active,
  onPick,
  t,
}: {
  shares: Record<Tone, number>
  active: Tone | null
  onPick: (tone: Tone) => void
  t: (k: Key) => string
}) {
  const [grown, setGrown] = useState(false)

  useEffect(() => {
    const id = window.setTimeout(() => setGrown(true), 0)
    return () => window.clearTimeout(id)
  }, [])

  const order: Tone[] = ['pos', 'neu', 'neg']
  const label: Record<Tone, Key> = { pos: 'tonePos', neu: 'toneNeu', neg: 'toneNeg' }
  const counts: Record<Tone, number> = { pos: SENTIMENT.pos, neu: SENTIMENT.neu, neg: SENTIMENT.neg }

  return (
    <>
      <div
        className={['an-bar', active ? 'an-bar--filtered' : ''].filter(Boolean).join(' ')}
        role="img"
        aria-label={order.map((k) => `${t(label[k])} ${shares[k]}%`).join(', ')}
      >
        {order.map((k) => (
          <div
            key={k}
            className={['an-bar__seg', `an-bar__seg--${k}`, active === k ? 'an-bar__seg--on' : '']
              .filter(Boolean)
              .join(' ')}
            style={{ width: grown ? `${shares[k]}%` : '0%' }}
          />
        ))}
      </div>

      <div className={['an-legend', active ? 'an-legend--filtered' : ''].filter(Boolean).join(' ')}>
        {order.map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={active === k}
            onClick={() => onPick(k)}
            className={['anm-legend-btn', active === k ? 'anm-legend-btn--on' : ''].filter(Boolean).join(' ')}
          >
            <span className={`an-legend__swatch an-legend__swatch--${k}`} />
            <UIText tone="ink2" className="tabular">
              {t(label[k])} — {num(counts[k])} · {shares[k]}%
            </UIText>
          </button>
        ))}
      </div>
    </>
  )
}

/* ============================================================
   Кривая поступления. Линия проводится штрихом длиной в единицу
   (pathLength), точки садятся следом, значение показывается по наведению.
   ============================================================ */
function Plot({ t }: { t: (k: Key) => string }) {
  const [hover, setHover] = useState<number | null>(null)

  const peak = Math.max(...WEEKS)
  const stepX = 280 / (WEEKS.length - 1)
  const points = WEEKS.map((v, i) => ({
    x: 20 + i * stepX,
    y: 70 - (v / peak) * 54,
    v,
  }))
  const path = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

  return (
    <div className="anm-plot-wrap">
      <svg className="an-plot" viewBox="0 0 320 80" role="img" aria-label={t('dynHead')}>
        <line className="an-plot__axis" x1="20" y1="72" x2="300" y2="72" />
        <polyline className="an-plot__line anm-line" points={path} pathLength={1} />
        {points.map((p, i) => (
          <circle
            className={['an-plot__dot', 'anm-dot', hover === i ? 'anm-dot--on' : ''].filter(Boolean).join(' ')}
            key={`d${p.x}`}
            cx={p.x}
            cy={p.y}
            r="2"
            style={{ '--i': i } as CSSProperties}
          />
        ))}
        {points.map((p, i) => (
          <circle
            className="anm-hit"
            key={`h${p.x}`}
            cx={p.x}
            cy={p.y}
            r="9"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <title>{`${i + 1} ${t('week')} — ${p.v}`}</title>
          </circle>
        ))}
      </svg>

      {hover !== null ? (
        <div
          className="anm-tip"
          style={{
            left: `${(points[hover].x / 320) * 100}%`,
            top: `${(points[hover].y / 80) * 100}%`,
          }}
        >
          <Mono>
            {hover + 1} {t('week')} · {points[hover].v}
          </Mono>
        </div>
      ) : null}

      {/* Номер недели и значение — двумя строками, а не через разделитель:
          на узком экране подпись рвалась по «·», оставляя «· 62» одну. */}
      <div className="an-plot-scale">
        {WEEKS.map((v, i) => (
          <Caption key={i} tone="mute" className="an-plot-scale__item">
            <span className="an-plot-scale__week">
              {i + 1}&nbsp;{t('week')}
            </span>
            <span className="an-plot-scale__value tabular">{v}</span>
          </Caption>
        ))}
      </div>
    </div>
  )
}

/* ============================================================
   Экран
   ============================================================ */
type SortKey = 'count' | 'share'

export function AnalyticsPage() {
  const { lang } = useLang()
  const t = useT(dict)
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)

  // Демо-набор показывается сразу: экран аналитики бессмыслен без данных,
  // а пустое состояние всё равно видно после «Очистить».
  const [source, setSource] = useState<string | null>('demo')
  const [busy, setBusy] = useState(false)
  const [tone, setTone] = useState<Tone | null>(null)
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: 'count', asc: false })
  const [openRisk, setOpenRisk] = useState<string | null>(null)
  const timer = useRef<number | null>(null)

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current)
  }, [])

  const shares: Record<Tone, number> = {
    pos: pct(SENTIMENT.pos),
    neu: pct(SENTIMENT.neu),
    neg: pct(SENTIMENT.neg),
  }

  /** Разбор замокан: полторы секунды ожидания и тот же демонстрационный корпус. */
  function parse(name: string) {
    setBusy(true)
    setTone(null)
    setOpenRisk(null)
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      setBusy(false)
      setSource(name)
      toast(t('toastLoaded'), 'ok')
      toast(t('toastDemoOnly'))
    }, 1500)
  }

  function clear() {
    if (timer.current) window.clearTimeout(timer.current)
    setBusy(false)
    setSource(null)
    setTone(null)
    setOpenRisk(null)
    if (fileRef.current) fileRef.current.value = ''
    toast(t('toastCleared'))
  }

  const rows = useMemo(() => {
    const wanted = tone ? toneOf[tone] : null
    const list = THEMES.filter((th) => (wanted ? th.tone === wanted : true))
    return [...list].sort((a, b) => (sort.asc ? a.count - b.count : b.count - a.count))
  }, [tone, sort])

  function sortBy(key: SortKey) {
    setSort((s) => (s.key === key ? { key, asc: !s.asc } : { key, asc: false }))
  }

  function header(key: SortKey, labelKey: Key) {
    const on = sort.key === key
    return (
      <button
        type="button"
        className={['anm-sort', on ? 'anm-sort--on' : ''].filter(Boolean).join(' ')}
        onClick={() => sortBy(key)}
        aria-label={t(labelKey)}
      >
        {t(labelKey)}
        <span className="anm-sort__mark" aria-hidden="true">
          {on && sort.asc ? '↑' : '↓'}
        </span>
      </button>
    )
  }

  const sourceLabel = source === 'demo' ? t('demoSource') : source

  return (
    <div className="page">
      <div className="page__head">
        <div className="page__title">
          <Display>{t('title')}</Display>
          <Body tone="mute">{t('lead')}</Body>
        </div>
        {source && !busy ? (
          <Button variant="secondary" onClick={() => toast(t('toastExport'), 'ok')}>
            {t('export')}
          </Button>
        ) : null}
      </div>

      <div className="an-source">
        <input
          ref={fileRef}
          type="file"
          className="an-source__file"
          accept=".csv,.xlsx,.json"
          onChange={(e) => {
            const name = e.target.files?.[0]?.name
            if (name) parse(name)
          }}
        />
        <Button variant="secondary" disabled={busy} onClick={() => fileRef.current?.click()}>
          {t('upload')}
        </Button>
        <Button variant="primary" disabled={busy} onClick={() => parse('demo')}>
          {t('demo')}
        </Button>
        {source && !busy ? (
          <>
            <Label as="span">{t('source')}</Label>
            <UIText tone="ink2">{sourceLabel}</UIText>
            <Button variant="ghost" onClick={clear}>
              {t('reset')}
            </Button>
          </>
        ) : (
          <Caption tone="mute">{t('sourceHint')}</Caption>
        )}
      </div>

      {busy ? (
        <div className="anm-wait">
          <H3>{t('parsing')}</H3>
          <Loading label={t('parsing')} />
          <Body tone="mute">{t('parsingHint')}</Body>
        </div>
      ) : !source ? (
        <div className="an-block">
          <Empty
            title={t('emptyTitle')}
            action={
              <Button variant="primary" onClick={() => parse('demo')}>
                {t('demo')}
              </Button>
            }
          >
            {t('emptyBody')}
          </Empty>
        </div>
      ) : (
        <div className="swap" key={source}>
          {/* ---------- Сводка числами ---------- */}
          <Figures posP={shares.pos} negP={shares.neg} t={t} />

          {/* ---------- Полоса распределения тональности ---------- */}
          <Reveal className="an-block">
            <div className="an-block__head">
              <div>
                <H2>{t('toneHead')}</H2>
                <Body tone="mute">{t('toneLead')}</Body>
              </div>
              {tone ? (
                <Chip onClick={() => setTone(null)}>{t('filterAll')}</Chip>
              ) : null}
            </div>

            <ToneBar
              shares={shares}
              active={tone}
              onPick={(k) => setTone((cur) => (cur === k ? null : k))}
              t={t}
            />
          </Reveal>

          {/* ---------- Динамика поступления ---------- */}
          <Reveal className="an-block">
            <div className="an-block__head">
              <div>
                <H2>{t('dynHead')}</H2>
                <Body tone="mute">{t('dynLead')}</Body>
              </div>
            </div>
            <Plot t={t} />
          </Reveal>

          {/* ---------- Темы ---------- */}
          <Reveal className="an-block">
            <div className="an-block__head">
              <H2>{t('themesHead')}</H2>
              {tone ? (
                <Caption tone="mute">
                  {t('filtered')}: {t(toneKey[toneOf[tone]])}
                </Caption>
              ) : null}
            </div>

            {rows.length === 0 ? (
              <Empty
                title={t('noThemes')}
                action={
                  <Button variant="secondary" onClick={() => setTone(null)}>
                    {t('filterAll')}
                  </Button>
                }
              >
                {t('noThemesBody')}
              </Empty>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th>{t('colTheme')}</th>
                    <th>{header('count', 'colCount')}</th>
                    <th>{t('colTone')}</th>
                    <th>{header('share', 'colShare')}</th>
                  </tr>
                </thead>
                <tbody key={`${tone ?? 'all'}-${sort.key}-${sort.asc}`}>
                  {rows.map((th, i) => {
                    const share = pct(th.count)
                    return (
                      <tr key={th.id} className="enter-item" style={{ '--i': i } as CSSProperties}>
                        <td>{t(`th_${th.id}` as Key)}</td>
                        <td className="tabular">{num(th.count)}</td>
                        <td>
                          <Status kind={th.tone}>{t(toneKey[th.tone])}</Status>
                        </td>
                        <td>
                          <span className="an-share">
                            <span className="an-share__track">
                              <span className="an-share__fill" style={{ width: `${(share / 20) * 100}%` }} />
                            </span>
                            <Caption tone="mute" className="an-share__num tabular">
                              {share}%
                            </Caption>
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </Table>
            )}
          </Reveal>

          {/* ---------- Риски и противоречия ---------- */}
          <Reveal className="an-block">
            <div className="an-block__head">
              <div>
                <H2>{t('risksHead')}</H2>
                <Body tone="mute">{t('risksLead')}</Body>
              </div>
              <Button variant="secondary" onClick={() => toast(t('toastExport'), 'ok')}>
                {t('export')}
              </Button>
            </div>

            <div className="an-risks">
              {RISKS.map((r) => {
                const theme = THEMES.find((th) => th.id === r.id)
                const on = openRisk === r.id
                return (
                  <div className={['an-risk', on ? 'anm-risk--on' : ''].filter(Boolean).join(' ')} key={r.id}>
                    <button
                      type="button"
                      className="anm-risk-head"
                      aria-expanded={on}
                      onClick={() => setOpenRisk(on ? null : r.id)}
                    >
                      <span className="anm-risk-sign" aria-hidden="true">
                        ›
                      </span>
                      <span className="anm-risk-title">{t(`rt_${r.id}` as Key)}</span>
                      <Status kind={r.level}>{t(levelKey[r.level])}</Status>
                    </button>

                    {on ? (
                      <div className="anm-risk-body unfold">
                        <Legal>{t(`rk_${r.id}` as Key)}</Legal>
                        <div className="an-risk__meta">
                          <Label as="span">{t('riskNorm')}</Label>
                          <Cite code={citeCode(r.cite, lang)} />
                          <Caption tone="mute">{t(kindKey[r.kind])}</Caption>
                          {theme ? (
                            <Caption tone="mute" className="tabular">
                              {num(theme.count)} {t('mentions')}
                            </Caption>
                          ) : null}
                        </div>
                        <div className="anm-risk-rec">
                          <Label as="div">{t('riskRec')}</Label>
                          <Body tone="ink2">{t(`rc_${r.id}` as Key)}</Body>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </Reveal>
        </div>
      )}
    </div>
  )
}
