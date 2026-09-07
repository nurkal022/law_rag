import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import {
  Body,
  Button,
  Caption,
  Chip,
  Display,
  Empty,
  Input,
  Label,
  Mono,
  Status,
  Table,
  TableTitle,
  Tabs,
  UIText,
  useToast,
} from '../../shared/ui'
import type { StatusKind, TabItem } from '../../shared/ui'
import { useCountUp } from '../../shared/motion'
import { useT } from '../../i18n'
import type { Dict, Lang } from '../../i18n'
import { useLang } from '../../i18n'
import './admin.css'
import './admin.motion.css'

/* ============================================================
   Административная панель.

   Данные замоканы, но всё, что видно как действие, действует:
   сортировка и поиск в реестрах, отбор запросов по оценке, создание
   и отзыв ключа API. Ничего не уходит на сервер — состояние живёт
   в памяти вкладки и обнуляется при перезагрузке.
   ============================================================ */

const dict: Dict = {
  title: { ru: 'Администрирование', kz: 'Әкімшілік', en: 'Administration' },
  subtitle: {
    ru: 'Состояние системы, пользователи и корпус НПА',
    kz: 'Жүйенің күйі, пайдаланушылар және НҚА корпусы',
    en: 'System state, users and the corpus of legal acts',
  },

  tabOverview: { ru: 'Обзор', kz: 'Шолу', en: 'Overview' },
  tabUsers: { ru: 'Пользователи', kz: 'Пайдаланушылар', en: 'Users' },
  tabDocs: { ru: 'Документы', kz: 'Құжаттар', en: 'Documents' },
  tabQueries: { ru: 'Запросы', kz: 'Сұраулар', en: 'Queries' },
  tabKeys: { ru: 'Ключи API', kz: 'API кілттері', en: 'API keys' },

  mUsers: { ru: 'Пользователей', kz: 'Пайдаланушы', en: 'Users' },
  mQuestions: { ru: 'Вопросов за сутки', kz: 'Тәулігіне сұрақ', en: 'Questions per day' },
  mDocs: { ru: 'Документов в базе', kz: 'Базадағы құжат', en: 'Documents indexed' },
  mLatency: { ru: 'Средний ответ', kz: 'Орташа жауап', en: 'Average answer' },
  mUsersDelta: { ru: '+34 за неделю', kz: 'аптасына +34', en: '+34 this week' },
  mQuestionsDelta: { ru: '+12 % к среде', kz: 'сәрсенбіге +12 %', en: '+12 % vs Wednesday' },
  mDocsDelta: { ru: '2 в очереди', kz: 'кезекте 2', en: '2 in queue' },
  mLatencyDelta: { ru: 'медиана 3,1 с', kz: 'медиана 3,1 с', en: 'median 3.1 s' },

  feedTitle: { ru: 'Последние события', kz: 'Соңғы оқиғалар', en: 'Recent events' },
  feedAll: { ru: 'Показать всё', kz: 'Барлығын көрсету', en: 'Show all' },
  feedLess: { ru: 'Свернуть', kz: 'Жию', en: 'Show less' },

  evAsk: { ru: 'вопрос консультанту', kz: 'кеңесшіге сұрақ', en: 'question to the assistant' },
  evUpload: { ru: 'загружен документ', kz: 'құжат жүктелді', en: 'document uploaded' },
  evContract: { ru: 'сформирован договор', kz: 'шарт жасалды', en: 'contract generated' },
  evIndex: { ru: 'переиндексирован корпус', kz: 'корпус қайта индекстелді', en: 'corpus re-indexed' },
  evKey: { ru: 'создан ключ API', kz: 'API кілті жасалды', en: 'API key created' },
  evSignup: { ru: 'новая регистрация', kz: 'жаңа тіркелу', en: 'new sign-up' },
  evExport: { ru: 'выгрузка выборки', kz: 'таңдаманы шығару', en: 'dataset export' },

  colEmail: { ru: 'Почта', kz: 'Пошта', en: 'Email' },
  colName: { ru: 'Имя', kz: 'Аты-жөні', en: 'Name' },
  colSignup: { ru: 'Регистрация', kz: 'Тіркелген', en: 'Registered' },
  colLastSeen: { ru: 'Последний вход', kz: 'Соңғы кіру', en: 'Last sign-in' },
  colQuestions: { ru: 'Вопросов', kz: 'Сұрақ', en: 'Questions' },

  colDoc: { ru: 'Название', kz: 'Атауы', en: 'Title' },
  colSize: { ru: 'Размер', kz: 'Көлемі', en: 'Size' },
  colChunks: { ru: 'Фрагментов', kz: 'Үзінді', en: 'Chunks' },
  colLoaded: { ru: 'Загружен', kz: 'Жүктелген', en: 'Uploaded' },

  searchUsers: { ru: 'Поиск по почте и имени', kz: 'Пошта мен аты бойынша іздеу', en: 'Search by email and name' },
  searchDocs: { ru: 'Поиск по названию', kz: 'Атауы бойынша іздеу', en: 'Search by title' },
  searchHint: { ru: 'Отбор идёт по мере набора', kz: 'Іріктеу теру барысында жүреді', en: 'Filtering applies as you type' },
  found: { ru: 'Найдено', kz: 'Табылды', en: 'Found' },
  nothingTitle: { ru: 'Ничего не найдено', kz: 'Ештеңе табылмады', en: 'Nothing found' },
  nothingBody: {
    ru: 'Строка поиска не совпала ни с одной записью реестра. Сократите запрос или очистите поле.',
    kz: 'Іздеу жолы тізілімнің бірде-бір жазбасымен сәйкес келмеді. Сұранысты қысқартыңыз немесе өрісті тазалаңыз.',
    en: 'The search string matched no records. Shorten the query or clear the field.',
  },
  clearSearch: { ru: 'Очистить поиск', kz: 'Іздеуді тазалау', en: 'Clear search' },

  queriesTitle: { ru: 'Последние вопросы', kz: 'Соңғы сұрақтар', en: 'Recent questions' },
  rateUp: { ru: 'полезно', kz: 'пайдалы', en: 'helpful' },
  rateDown: { ru: 'бесполезно', kz: 'пайдасыз', en: 'not helpful' },
  rateNone: { ru: 'без оценки', kz: 'бағаланбаған', en: 'not rated' },
  filterAll: { ru: 'Все', kz: 'Барлығы', en: 'All' },
  filterUp: { ru: 'Положительные', kz: 'Оң бағаланған', en: 'Positive' },
  filterDown: { ru: 'Отрицательные', kz: 'Теріс бағаланған', en: 'Negative' },
  noQueriesTitle: { ru: 'Вопросов с такой оценкой нет', kz: 'Мұндай бағасы бар сұрақ жоқ', en: 'No questions with this rating' },
  noQueriesBody: {
    ru: 'Снимите отбор, чтобы вернуть полный список последних вопросов.',
    kz: 'Соңғы сұрақтардың толық тізімін қайтару үшін іріктеуді алып тастаңыз.',
    en: 'Clear the filter to bring back the full list of recent questions.',
  },

  colKeyName: { ru: 'Название', kz: 'Атауы', en: 'Name' },
  colKeyPrefix: { ru: 'Ключ', kz: 'Кілт', en: 'Key' },
  colKeyCreated: { ru: 'Создан', kz: 'Жасалған', en: 'Created' },
  colKeyUsed: { ru: 'Последнее обращение', kz: 'Соңғы қолданыс', en: 'Last used' },
  colKeyLimit: { ru: 'Лимит в сутки', kz: 'Тәуліктік шек', en: 'Daily limit' },
  keyCreate: { ru: 'Создать ключ', kz: 'Кілт жасау', en: 'Create key' },
  keyRevoke: { ru: 'Отозвать', kz: 'Кері қайтару', en: 'Revoke' },
  keyRevokeAria: { ru: 'Отозвать ключ', kz: 'Кілтті кері қайтару', en: 'Revoke key' },
  never: { ru: 'не использовался', kz: 'қолданылмаған', en: 'never used' },

  keyFormName: { ru: 'Название ключа', kz: 'Кілттің атауы', en: 'Key name' },
  keyFormNamePh: { ru: 'Например: Портал акимата', kz: 'Мысалы: Әкімдік порталы', en: 'For example: City hall portal' },
  keyFormLimit: { ru: 'Лимит обращений в сутки', kz: 'Тәулігіне өтініш шегі', en: 'Requests per day' },
  keyFormSubmit: { ru: 'Выпустить', kz: 'Шығару', en: 'Issue' },
  keyFormCancel: { ru: 'Отмена', kz: 'Болдырмау', en: 'Cancel' },
  keyFormNameErr: { ru: 'Без названия ключ не отличить от соседнего', kz: 'Атауы болмаса, кілтті көршісінен ажырату мүмкін емес', en: 'Without a name the key is indistinguishable from its neighbour' },
  keyFormLimitErr: { ru: 'Лимит — целое число от 1 до 1 000 000', kz: 'Шек — 1-ден 1 000 000-ға дейінгі бүтін сан', en: 'The limit is a whole number from 1 to 1,000,000' },
  keyShownOnce: {
    ru: 'Ключ показывается один раз. Скопируйте его сейчас: восстановить значение будет нельзя.',
    kz: 'Кілт бір рет қана көрсетіледі. Оны қазір көшіріп алыңыз: мәнін қалпына келтіру мүмкін болмайды.',
    en: 'The key is shown once. Copy it now: the value cannot be recovered later.',
  },
  copy: { ru: 'Копировать', kz: 'Көшіру', en: 'Copy' },
  copied: { ru: 'Ключ скопирован в буфер обмена', kz: 'Кілт алмасу буферіне көшірілді', en: 'Key copied to the clipboard' },
  copyFail: { ru: 'Браузер не дал доступ к буферу обмена', kz: 'Браузер алмасу буферіне рұқсат бермеді', en: 'The browser denied clipboard access' },
  hideSecret: { ru: 'Скрыть', kz: 'Жасыру', en: 'Hide' },
  keyCreated: { ru: 'Ключ выпущен', kz: 'Кілт шығарылды', en: 'Key issued' },
  keyRevoked: { ru: 'Ключ отозван', kz: 'Кілт кері қайтарылды', en: 'Key revoked' },
  confirmQ: { ru: 'Отозвать?', kz: 'Кері қайтарылсын ба?', en: 'Revoke?' },
  confirmYes: { ru: 'Да, отозвать', kz: 'Иә, қайтару', en: 'Yes, revoke' },
  confirmNo: { ru: 'Нет', kz: 'Жоқ', en: 'No' },
  noKeysTitle: { ru: 'Действующих ключей нет', kz: 'Қолданыстағы кілт жоқ', en: 'No active keys' },
  noKeysBody: {
    ru: 'Выпустите ключ, чтобы подключить внешнюю систему к правовому поиску Dalel.',
    kz: 'Сыртқы жүйені Dalel құқықтық іздеуіне қосу үшін кілт шығарыңыз.',
    en: 'Issue a key to connect an external system to Dalel legal search.',
  },
}

/* ---------- Данные (статические, правдоподобные) ---------- */

/** Строка на трёх языках. */
type L10n = Record<Lang, string>

/** Показатель обзора: значение числом, чтобы оно набегало. */
const metrics: { key: string; value: number; kind: 'int' | 'sec'; delta: string }[] = [
  { key: 'mUsers', value: 1284, kind: 'int', delta: 'mUsersDelta' },
  { key: 'mQuestions', value: 3917, kind: 'int', delta: 'mQuestionsDelta' },
  { key: 'mDocs', value: 412, kind: 'int', delta: 'mDocsDelta' },
  { key: 'mLatency', value: 4.2, kind: 'sec', delta: 'mLatencyDelta' },
]

const feed = [
  { time: '14:52', who: 'a.suleimenova@vsk.kz', key: 'evAsk' },
  { time: '14:47', who: 'd.omarov@kazlex.kz', key: 'evUpload' },
  { time: '14:41', who: 'n.kurmanov@dalel.kz', key: 'evContract' },
  { time: '14:30', who: 'system', key: 'evIndex' },
  { time: '14:12', who: 'g.iskakova@aifc.kz', key: 'evKey' },
  { time: '13:58', who: 'm.zhaksylyk@gmail.com', key: 'evSignup' },
  { time: '13:36', who: 'n.kurmanov@dalel.kz', key: 'evExport' },
]

const users = [
  { email: 'a.suleimenova@vsk.kz', name: 'Айгүл Сүлейменова', signup: '2026-02-11', seen: '2026-09-05 14:52', asks: 412 },
  { email: 'd.omarov@kazlex.kz', name: 'Дархан Омаров', signup: '2026-03-04', seen: '2026-09-05 14:47', asks: 288 },
  { email: 'g.iskakova@aifc.kz', name: 'Гүлнар Ысқақова', signup: '2026-04-19', seen: '2026-09-05 14:12', asks: 176 },
  { email: 'n.kurmanov@dalel.kz', name: 'Нұрлыхан Құрманов', signup: '2025-11-02', seen: '2026-09-05 14:41', asks: 1043 },
  { email: 'm.zhaksylyk@gmail.com', name: 'Мадина Жақсылық', signup: '2026-09-05', seen: '2026-09-05 13:58', asks: 3 },
  { email: 's.abenov@kaspi.kz', name: 'Санжар Әбенов', signup: '2026-06-27', seen: '2026-09-04 18:20', asks: 94 },
]

const docs: { title: L10n; size: L10n; bytes: number; chunks: number; loaded: string }[] = [
  {
    title: {
      ru: 'Гражданский кодекс РК (общая часть)',
      kz: 'ҚР Азаматтық кодексі (жалпы бөлім)',
      en: 'Civil Code of the RK (general part)',
    },
    size: { ru: '4,8 МБ', kz: '4,8 МБ', en: '4.8 MB' },
    bytes: 4.8,
    chunks: 3128,
    loaded: '2025-10-14',
  },
  {
    title: {
      ru: 'Гражданский кодекс РК (особенная часть)',
      kz: 'ҚР Азаматтық кодексі (ерекше бөлім)',
      en: 'Civil Code of the RK (special part)',
    },
    size: { ru: '5,6 МБ', kz: '5,6 МБ', en: '5.6 MB' },
    bytes: 5.6,
    chunks: 3742,
    loaded: '2025-10-14',
  },
  {
    title: { ru: 'Трудовой кодекс РК', kz: 'ҚР Еңбек кодексі', en: 'Labour Code of the RK' },
    size: { ru: '2,1 МБ', kz: '2,1 МБ', en: '2.1 MB' },
    bytes: 2.1,
    chunks: 1416,
    loaded: '2025-10-21',
  },
  {
    title: { ru: 'Налоговый кодекс РК', kz: 'ҚР Салық кодексі', en: 'Tax Code of the RK' },
    size: { ru: '7,3 МБ', kz: '7,3 МБ', en: '7.3 MB' },
    bytes: 7.3,
    chunks: 5024,
    loaded: '2026-01-09',
  },
  {
    title: {
      ru: 'Кодекс РК об административных правонарушениях',
      kz: 'ҚР Әкімшілік құқық бұзушылық туралы кодексі',
      en: 'Code of the RK on Administrative Offences',
    },
    size: { ru: '6,2 МБ', kz: '6,2 МБ', en: '6.2 MB' },
    bytes: 6.2,
    chunks: 4310,
    loaded: '2026-01-09',
  },
  {
    title: {
      ru: 'Закон «О государственных закупках»',
      kz: '«Мемлекеттік сатып алу туралы» Заң',
      en: 'Law on Public Procurement',
    },
    size: { ru: '1,4 МБ', kz: '1,4 МБ', en: '1.4 MB' },
    bytes: 1.4,
    chunks: 902,
    loaded: '2026-04-02',
  },
  {
    title: {
      ru: 'Закон «О персональных данных и их защите»',
      kz: '«Дербес деректер және оларды қорғау туралы» Заң',
      en: 'Law on Personal Data and its Protection',
    },
    size: { ru: '0,6 МБ', kz: '0,6 МБ', en: '0.6 MB' },
    bytes: 0.6,
    chunks: 318,
    loaded: '2026-05-16',
  },
]

type Rate = 'up' | 'down' | 'none'

const queries: { time: string; rate: Rate; text: L10n }[] = [
  {
    time: '14:52',
    rate: 'up',
    text: {
      ru: 'Каков срок исковой давности по требованию о взыскании неустойки?',
      kz: 'Тұрақсыздық айыбын өндіру туралы талап бойынша ескіру мерзімі қандай?',
      en: 'What is the limitation period for a claim to recover a contractual penalty?',
    },
  },
  {
    time: '14:44',
    rate: 'none',
    text: {
      ru: 'Можно ли расторгнуть трудовой договор в период временной нетрудоспособности?',
      kz: 'Уақытша еңбекке жарамсыздық кезеңінде еңбек шартын бұзуға бола ма?',
      en: 'May an employment contract be terminated during temporary incapacity for work?',
    },
  },
  {
    time: '14:31',
    rate: 'up',
    text: {
      ru: 'Какие условия договора поставки признаются существенными?',
      kz: 'Жеткізу шартының қандай талаптары елеулі деп танылады?',
      en: 'Which terms of a supply contract are considered essential?',
    },
  },
  {
    time: '14:09',
    rate: 'down',
    text: {
      ru: 'Как оспорить решение о начислении НДС по камеральному контролю?',
      kz: 'Камералдық бақылау бойынша ҚҚС есептеу шешімін қалай даулауға болады?',
      en: 'How can a VAT assessment issued under desk control be challenged?',
    },
  },
  {
    time: '13:52',
    rate: 'up',
    text: {
      ru: 'Требуется ли нотариальная форма для договора залога недвижимости?',
      kz: 'Жылжымайтын мүлік кепілі шартына нотариалдық нысан қажет пе?',
      en: 'Does a pledge of immovable property require a notarised form?',
    },
  },
  {
    time: '13:20',
    rate: 'none',
    text: {
      ru: 'В каком порядке обжалуется постановление о наложении административного штрафа?',
      kz: 'Әкімшілік айыппұл салу туралы қаулыға қандай тәртіппен шағым жасалады?',
      en: 'What is the procedure for appealing an administrative fine order?',
    },
  },
]

interface KeyRow {
  id: string
  name: L10n
  prefix: string
  created: string
  used: string
  limit: number
  /** Полное значение: живёт только у только что выпущенного ключа. */
  secret?: string
}

const initialKeys: KeyRow[] = [
  {
    id: 'k1',
    name: { ru: 'Мобильное приложение', kz: 'Мобильді қосымша', en: 'Mobile app' },
    prefix: 'tura_live_9f2c…',
    created: '2026-01-12',
    used: '2026-09-05 14:12',
    limit: 20000,
  },
  {
    id: 'k2',
    name: {
      ru: 'Портал госзакупок',
      kz: 'Мемлекеттік сатып алу порталы',
      en: 'Public procurement portal',
    },
    prefix: 'tura_live_4ab7…',
    created: '2026-03-30',
    used: '2026-09-05 11:44',
    limit: 5000,
  },
  {
    id: 'k3',
    name: { ru: 'Стенд разработки', kz: 'Әзірлеу стенді', en: 'Development sandbox' },
    prefix: 'tura_test_1d80…',
    created: '2026-06-08',
    used: '2026-08-29 09:03',
    limit: 500,
  },
  {
    id: 'k4',
    name: {
      ru: 'Интеграция АО «Каспий»',
      kz: '«Каспий» АҚ интеграциясы',
      en: 'Kaspiy JSC integration',
    },
    prefix: 'tura_live_7e51…',
    created: '2026-08-21',
    used: '',
    limit: 1000,
  },
]

const rateKind: Record<Rate, StatusKind> = { up: 'ok', down: 'err', none: 'idle' }
const rateKey: Record<Rate, string> = { up: 'rateUp', down: 'rateDown', none: 'rateNone' }

/* ---------- Числа ---------- */

function fmtInt(n: number, lang: Lang): string {
  const v = Math.round(n)
  if (lang === 'en') return v.toLocaleString('en-US')
  return v.toLocaleString('ru-RU').replace(/ |\s/g, ' ')
}

function fmtSec(n: number, lang: Lang): string {
  const v = n.toFixed(1)
  return lang === 'en' ? `${v} s` : `${v.replace('.', ',')} с`
}

/* ---------- Сортировка ---------- */

type Dir = 'asc' | 'desc'
interface SortState {
  key: string
  dir: Dir
}

function cmp(a: string | number, b: string | number): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), 'ru')
}

/** Заголовок-кнопка: нажатие меняет колонку, повторное — направление. */
function SortTh({
  id,
  sort,
  onSort,
  children,
  className,
}: {
  id: string
  sort: SortState
  onSort: (id: string) => void
  children: ReactNode
  className?: string
}) {
  const on = sort.key === id
  return (
    <th className={className} aria-sort={on ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        className={['admm-sort', on ? 'admm-sort--on' : ''].filter(Boolean).join(' ')}
        onClick={() => onSort(id)}
      >
        {children}
        <span className="admm-sort__mark" aria-hidden="true">
          {on && sort.dir === 'asc' ? '↑' : '↓'}
        </span>
      </button>
    </th>
  )
}

function useSort(initial: string, initialDir: Dir = 'asc') {
  const [sort, setSort] = useState<SortState>({ key: initial, dir: initialDir })
  const onSort = (key: string) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))
  return { sort, onSort }
}

/* ---------- Показатель обзора ---------- */

function Metric({
  m,
  lang,
  t,
}: {
  m: (typeof metrics)[number]
  lang: Lang
  t: (k: string) => string
}) {
  const raw = useCountUp(m.value)
  return (
    <div className="adm-metric">
      <div className="adm-metric__value tabular">
        {m.kind === 'sec' ? fmtSec(raw, lang) : fmtInt(raw, lang)}
      </div>
      <Label className="adm-metric__label">{t(m.key)}</Label>
      <Caption tone="mute" className="adm-metric__delta">
        {t(m.delta)}
      </Caption>
    </div>
  )
}

/* ============================================================
   Экран
   ============================================================ */

export function AdminPage() {
  const t = useT(dict)
  const { lang } = useLang()
  const toast = useToast()
  const [tab, setTab] = useState('overview')

  /* Обзор */
  const [feedAll, setFeedAll] = useState(false)

  /* Реестры */
  const [userQuery, setUserQuery] = useState('')
  const userSort = useSort('asks', 'desc')
  const [docQuery, setDocQuery] = useState('')
  const docSort = useSort('chunks', 'desc')

  /* Запросы */
  const [rate, setRate] = useState<'all' | 'up' | 'down'>('all')

  /* Ключи */
  const [keys, setKeys] = useState<KeyRow[]>(initialKeys)
  const [formOpen, setFormOpen] = useState(false)
  const [formName, setFormName] = useState('')
  const [formLimit, setFormLimit] = useState('1000')
  const [formErr, setFormErr] = useState<{ name?: boolean; limit?: boolean }>({})
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [leavingId, setLeavingId] = useState<string | null>(null)
  const leaveTimer = useRef<number | null>(null)

  useEffect(() => () => {
    if (leaveTimer.current) window.clearTimeout(leaveTimer.current)
  }, [])

  const tabs: TabItem[] = [
    { id: 'overview', label: t('tabOverview') },
    { id: 'users', label: t('tabUsers') },
    { id: 'docs', label: t('tabDocs') },
    { id: 'queries', label: t('tabQueries') },
    { id: 'keys', label: t('tabKeys') },
  ]

  const shownFeed = feedAll ? feed : feed.slice(0, 4)

  const userRows = useMemo(() => {
    const q = userQuery.trim().toLowerCase()
    const list = users.filter(
      (u) => !q || u.email.toLowerCase().includes(q) || u.name.toLowerCase().includes(q),
    )
    const k = userSort.sort.key as 'email' | 'name' | 'signup' | 'seen' | 'asks'
    const sorted = [...list].sort((a, b) => cmp(a[k], b[k]))
    return userSort.sort.dir === 'asc' ? sorted : sorted.reverse()
  }, [userQuery, userSort.sort])

  const docRows = useMemo(() => {
    const q = docQuery.trim().toLowerCase()
    const list = docs.filter((d) => !q || d.title[lang].toLowerCase().includes(q))
    const k = docSort.sort.key
    const sorted = [...list].sort((a, b) => {
      if (k === 'title') return cmp(a.title[lang], b.title[lang])
      if (k === 'size') return cmp(a.bytes, b.bytes)
      if (k === 'loaded') return cmp(a.loaded, b.loaded)
      return cmp(a.chunks, b.chunks)
    })
    return docSort.sort.dir === 'asc' ? sorted : sorted.reverse()
  }, [docQuery, docSort.sort, lang])

  const queryRows = useMemo(
    () => (rate === 'all' ? queries : queries.filter((q) => q.rate === rate)),
    [rate],
  )

  /* ---------- Ключи: выпуск и отзыв ---------- */

  function issue() {
    const name = formName.trim()
    const limit = Number(formLimit)
    const bad = {
      name: name.length === 0,
      limit: !Number.isInteger(limit) || limit < 1 || limit > 1000000,
    }
    setFormErr(bad)
    if (bad.name || bad.limit) return

    // Значение фиктивное: демонстрация не ходит на сервер, но ведёт себя как он.
    const body = Array.from({ length: 24 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
    const secret = `tura_live_${body}`
    const today = new Date().toISOString().slice(0, 10)
    const row: KeyRow = {
      id: `k${Date.now()}`,
      name: { ru: name, kz: name, en: name },
      prefix: `${secret.slice(0, 14)}…`,
      created: today,
      used: '',
      limit,
      secret,
    }
    setKeys((prev) => [row, ...prev])
    setFormOpen(false)
    setFormName('')
    setFormLimit('1000')
    setFormErr({})
    toast(t('keyCreated'), 'ok')
  }

  function copy(secret: string) {
    const done = () => toast(t('copied'), 'ok')
    const fail = () => toast(t('copyFail'), 'err')
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(secret).then(done, fail)
    } else {
      fail()
    }
  }

  function revoke(id: string) {
    setConfirmId(null)
    setLeavingId(id)
    if (leaveTimer.current) window.clearTimeout(leaveTimer.current)
    // 220 мс — та же --dur-2, что гасит строку: удаляем узел ровно после ухода.
    leaveTimer.current = window.setTimeout(() => {
      setKeys((prev) => prev.filter((k) => k.id !== id))
      setLeavingId(null)
      toast(t('keyRevoked'))
    }, 220)
  }

  return (
    <div className="page">
      <div className="page__head">
        <div className="page__title">
          <Display>{t('title')}</Display>
          <Body tone="mute">{t('subtitle')}</Body>
        </div>
      </div>

      <div className="adm-tabs">
        <Tabs items={tabs} value={tab} onChange={setTab} />
      </div>

      {/* Содержимое вкладки меняется подстановкой: ключ пересоздаёт узел,
          .swap проявляет новый набор данных на месте прежнего. */}
      <div className="swap" key={tab}>
        {tab === 'overview' ? (
          <section aria-label={t('tabOverview')}>
            <div className="adm-metrics">
              {metrics.map((m) => (
                <Metric key={m.key} m={m} lang={lang} t={t} />
              ))}
            </div>

            <div className="adm-section">
              <div className="adm-section__head">
                <Label>{t('feedTitle')}</Label>
                <Button variant="ghost" onClick={() => setFeedAll((v) => !v)}>
                  {feedAll ? t('feedLess') : t('feedAll')}
                </Button>
              </div>
              <div className="adm-feed" key={feedAll ? 'all' : 'short'}>
                {shownFeed.map((e, i) => (
                  <div
                    key={`${e.time}-${i}`}
                    className="adm-feed__row enter-item"
                    style={{ '--i': i } as CSSProperties}
                  >
                    <Mono className="adm-feed__time">{e.time}</Mono>
                    <UIText className="adm-feed__text">{t(e.key)}</UIText>
                    <Caption className="adm-feed__who">{e.who}</Caption>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {tab === 'users' ? (
          <section aria-label={t('tabUsers')}>
            <div className="admm-bar">
              <Input
                
                label={t('searchUsers')}
                hint={t('searchHint')}
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                type="search"
              />
              <Caption tone="mute" className="tabular">
                {t('found')}: {userRows.length}
              </Caption>
            </div>

            {userRows.length === 0 ? (
              <div className="admm-none">
                <Empty
                  title={t('nothingTitle')}
                  action={
                    <Button variant="secondary" onClick={() => setUserQuery('')}>
                      {t('clearSearch')}
                    </Button>
                  }
                >
                  {t('nothingBody')}
                </Empty>
              </div>
            ) : (
              <div className="adm-scroll">
                <Table>
                  <thead>
                    <tr>
                      <SortTh id="email" sort={userSort.sort} onSort={userSort.onSort}>
                        {t('colEmail')}
                      </SortTh>
                      <SortTh id="name" sort={userSort.sort} onSort={userSort.onSort}>
                        {t('colName')}
                      </SortTh>
                      <SortTh id="signup" sort={userSort.sort} onSort={userSort.onSort}>
                        {t('colSignup')}
                      </SortTh>
                      <SortTh id="seen" sort={userSort.sort} onSort={userSort.onSort}>
                        {t('colLastSeen')}
                      </SortTh>
                      <SortTh id="asks" sort={userSort.sort} onSort={userSort.onSort} className="adm-num">
                        {t('colQuestions')}
                      </SortTh>
                    </tr>
                  </thead>
                  <tbody key={`${userSort.sort.key}-${userSort.sort.dir}-${userQuery}`}>
                    {userRows.map((u, i) => (
                      <tr key={u.email} className="enter-item" style={{ '--i': i } as CSSProperties}>
                        <td>{u.email}</td>
                        <td>
                          <TableTitle>{u.name}</TableTitle>
                        </td>
                        <td>
                          <Mono tone="mute">{u.signup}</Mono>
                        </td>
                        <td>
                          <Mono tone="mute">{u.seen}</Mono>
                        </td>
                        <td className="adm-num">
                          <Mono>{u.asks}</Mono>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </section>
        ) : null}

        {tab === 'docs' ? (
          <section aria-label={t('tabDocs')}>
            <div className="admm-bar">
              <Input
                
                label={t('searchDocs')}
                hint={t('searchHint')}
                value={docQuery}
                onChange={(e) => setDocQuery(e.target.value)}
                type="search"
              />
              <Caption tone="mute" className="tabular">
                {t('found')}: {docRows.length}
              </Caption>
            </div>

            {docRows.length === 0 ? (
              <div className="admm-none">
                <Empty
                  title={t('nothingTitle')}
                  action={
                    <Button variant="secondary" onClick={() => setDocQuery('')}>
                      {t('clearSearch')}
                    </Button>
                  }
                >
                  {t('nothingBody')}
                </Empty>
              </div>
            ) : (
              <div className="adm-scroll">
                <Table>
                  <thead>
                    <tr>
                      <SortTh id="title" sort={docSort.sort} onSort={docSort.onSort}>
                        {t('colDoc')}
                      </SortTh>
                      <SortTh id="size" sort={docSort.sort} onSort={docSort.onSort}>
                        {t('colSize')}
                      </SortTh>
                      <SortTh id="chunks" sort={docSort.sort} onSort={docSort.onSort} className="adm-num">
                        {t('colChunks')}
                      </SortTh>
                      <SortTh id="loaded" sort={docSort.sort} onSort={docSort.onSort}>
                        {t('colLoaded')}
                      </SortTh>
                    </tr>
                  </thead>
                  <tbody key={`${docSort.sort.key}-${docSort.sort.dir}-${docQuery}`}>
                    {docRows.map((d, i) => (
                      <tr
                        key={d.loaded + d.title.ru}
                        className="enter-item"
                        style={{ '--i': i } as CSSProperties}
                      >
                        <td>
                          <TableTitle>{d.title[lang]}</TableTitle>
                        </td>
                        <td>{d.size[lang]}</td>
                        <td className="adm-num">
                          <Mono>{d.chunks}</Mono>
                        </td>
                        <td>
                          <Mono tone="mute">{d.loaded}</Mono>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </section>
        ) : null}

        {tab === 'queries' ? (
          <section aria-label={t('tabQueries')}>
            <div className="adm-section__head">
              <Label>{t('queriesTitle')}</Label>
              <div className="admm-filters">
                <Chip active={rate === 'all'} onClick={() => setRate('all')}>
                  {t('filterAll')}
                </Chip>
                <Chip active={rate === 'up'} onClick={() => setRate('up')}>
                  {t('filterUp')}
                </Chip>
                <Chip active={rate === 'down'} onClick={() => setRate('down')}>
                  {t('filterDown')}
                </Chip>
              </div>
            </div>

            {queryRows.length === 0 ? (
              <div className="admm-none">
                <Empty
                  title={t('noQueriesTitle')}
                  action={
                    <Button variant="secondary" onClick={() => setRate('all')}>
                      {t('filterAll')}
                    </Button>
                  }
                >
                  {t('noQueriesBody')}
                </Empty>
              </div>
            ) : (
              <div className="adm-queries" key={rate}>
                {queryRows.map((q, i) => (
                  <div key={q.time} className="adm-query enter-item" style={{ '--i': i } as CSSProperties}>
                    <Mono className="adm-query__time">{q.time}</Mono>
                    <div className="adm-query__text">{q.text[lang]}</div>
                    <div className="adm-query__meta">
                      <Status kind={rateKind[q.rate]}>{t(rateKey[q.rate])}</Status>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : null}

        {tab === 'keys' ? (
          <section aria-label={t('tabKeys')}>
            <div className="adm-section__head">
              <Label>{t('tabKeys')}</Label>
              {!formOpen ? (
                <Button variant="primary" onClick={() => setFormOpen(true)}>
                  {t('keyCreate')}
                </Button>
              ) : null}
            </div>

            {formOpen ? (
              <form
                className="admm-form unfold"
                onSubmit={(e) => {
                  e.preventDefault()
                  issue()
                }}
              >
                <div className="admm-form__field">
                  <Input
                    label={t('keyFormName')}
                    placeholder={t('keyFormNamePh')}
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    error={formErr.name ? t('keyFormNameErr') : undefined}
                    autoFocus
                  />
                </div>
                <div className="admm-form__field">
                  <Input
                    label={t('keyFormLimit')}
                    inputMode="numeric"
                    value={formLimit}
                    onChange={(e) => setFormLimit(e.target.value)}
                    error={formErr.limit ? t('keyFormLimitErr') : undefined}
                  />
                </div>
                <div className="admm-form__actions">
                  <Button variant="primary" type="submit">
                    {t('keyFormSubmit')}
                  </Button>
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() => {
                      setFormOpen(false)
                      setFormErr({})
                    }}
                  >
                    {t('keyFormCancel')}
                  </Button>
                </div>
              </form>
            ) : null}

            {keys.length === 0 ? (
              <div className="admm-none">
                <Empty
                  title={t('noKeysTitle')}
                  action={
                    <Button variant="primary" onClick={() => setFormOpen(true)}>
                      {t('keyCreate')}
                    </Button>
                  }
                >
                  {t('noKeysBody')}
                </Empty>
              </div>
            ) : (
              <div className="adm-scroll">
                <Table>
                  <thead>
                    <tr>
                      <th>{t('colKeyName')}</th>
                      <th>{t('colKeyPrefix')}</th>
                      <th>{t('colKeyCreated')}</th>
                      <th>{t('colKeyUsed')}</th>
                      <th className="adm-num">{t('colKeyLimit')}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {keys.map((k) => (
                      <tr
                        key={k.id}
                        className={[
                          k.secret ? 'enter admm-row--new' : '',
                          leavingId === k.id ? 'admm-leaving' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      >
                        <td>
                          <TableTitle>{k.name[lang]}</TableTitle>
                        </td>
                        <td>
                          {k.secret ? (
                            <div className="admm-reveal">
                              <Mono className="admm-secret">{k.secret}</Mono>
                              <Button
                                variant="secondary"
                                onClick={() => copy(k.secret as string)}
                              >
                                {t('copy')}
                              </Button>
                              <Button
                                variant="ghost"
                                onClick={() =>
                                  setKeys((prev) =>
                                    prev.map((r) => (r.id === k.id ? { ...r, secret: undefined } : r)),
                                  )
                                }
                              >
                                {t('hideSecret')}
                              </Button>
                              <Caption tone="mute">{t('keyShownOnce')}</Caption>
                            </div>
                          ) : (
                            <Mono>{k.prefix}</Mono>
                          )}
                        </td>
                        <td>
                          <Mono tone="mute">{k.created}</Mono>
                        </td>
                        <td>
                          {k.used ? (
                            <Mono tone="mute">{k.used}</Mono>
                          ) : (
                            <Caption tone="mute">{t('never')}</Caption>
                          )}
                        </td>
                        <td className="adm-num">
                          <Mono>{fmtInt(k.limit, lang)}</Mono>
                        </td>
                        <td>
                          <div className="adm-actions">
                            {confirmId === k.id ? (
                              <span className="admm-confirm">
                                <Caption tone="mute">{t('confirmQ')}</Caption>
                                <Button variant="danger" onClick={() => revoke(k.id)}>
                                  {t('confirmYes')}
                                </Button>
                                <Button variant="ghost" onClick={() => setConfirmId(null)}>
                                  {t('confirmNo')}
                                </Button>
                              </span>
                            ) : (
                              <Button
                                variant="danger"
                                aria-label={`${t('keyRevokeAria')}: ${k.name[lang]}`}
                                onClick={() => setConfirmId(k.id)}
                              >
                                {t('keyRevoke')}
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </section>
        ) : null}
      </div>
    </div>
  )
}
