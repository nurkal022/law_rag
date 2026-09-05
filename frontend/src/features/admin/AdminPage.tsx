import { useState } from 'react'
import {
  Body,
  Button,
  Caption,
  Display,
  Label,
  Mono,
  Status,
  Table,
  TableTitle,
  Tabs,
  UIText,
} from '../../shared/ui'
import type { StatusKind, TabItem } from '../../shared/ui'
import { useT } from '../../i18n'
import type { Dict, Lang } from '../../i18n'
import { useLang } from '../../i18n'
import './admin.css'

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

  queriesTitle: { ru: 'Последние вопросы', kz: 'Соңғы сұрақтар', en: 'Recent questions' },
  rateUp: { ru: 'полезно', kz: 'пайдалы', en: 'helpful' },
  rateDown: { ru: 'бесполезно', kz: 'пайдасыз', en: 'not helpful' },
  rateNone: { ru: 'без оценки', kz: 'бағаланбаған', en: 'not rated' },

  colKeyName: { ru: 'Название', kz: 'Атауы', en: 'Name' },
  colKeyPrefix: { ru: 'Ключ', kz: 'Кілт', en: 'Key' },
  colKeyCreated: { ru: 'Создан', kz: 'Жасалған', en: 'Created' },
  colKeyUsed: { ru: 'Последнее обращение', kz: 'Соңғы қолданыс', en: 'Last used' },
  colKeyLimit: { ru: 'Лимит в сутки', kz: 'Тәуліктік шек', en: 'Daily limit' },
  keyCreate: { ru: 'Создать ключ', kz: 'Кілт жасау', en: 'Create key' },
  keyRevoke: { ru: 'Отозвать', kz: 'Кері қайтару', en: 'Revoke' },
  keyRevokeAria: { ru: 'Отозвать ключ', kz: 'Кілтті кері қайтару', en: 'Revoke key' },
  never: { ru: 'не использовался', kz: 'қолданылмаған', en: 'never used' },
}

/* ---------- Данные (статические, правдоподобные) ---------- */

const metrics = [
  { key: 'mUsers', value: '1 284', delta: 'mUsersDelta' },
  { key: 'mQuestions', value: '3 917', delta: 'mQuestionsDelta' },
  { key: 'mDocs', value: '412', delta: 'mDocsDelta' },
  { key: 'mLatency', value: '4,2 с', delta: 'mLatencyDelta' },
] as const

const feed = [
  { time: '14:52', who: 'a.suleimenova@vsk.kz', key: 'evAsk' },
  { time: '14:47', who: 'd.omarov@kazlex.kz', key: 'evUpload' },
  { time: '14:41', who: 'n.kurmanov@tura.kz', key: 'evContract' },
  { time: '14:30', who: 'system', key: 'evIndex' },
  { time: '14:12', who: 'g.iskakova@aifc.kz', key: 'evKey' },
  { time: '13:58', who: 'm.zhaksylyk@gmail.com', key: 'evSignup' },
  { time: '13:36', who: 'n.kurmanov@tura.kz', key: 'evExport' },
] as const

const users = [
  { email: 'a.suleimenova@vsk.kz', name: 'Айгүл Сүлейменова', signup: '2026-02-11', seen: '2026-09-05 14:52', asks: 412 },
  { email: 'd.omarov@kazlex.kz', name: 'Дархан Омаров', signup: '2026-03-04', seen: '2026-09-05 14:47', asks: 288 },
  { email: 'g.iskakova@aifc.kz', name: 'Гүлнар Ысқақова', signup: '2026-04-19', seen: '2026-09-05 14:12', asks: 176 },
  { email: 'n.kurmanov@tura.kz', name: 'Нұрлыхан Құрманов', signup: '2025-11-02', seen: '2026-09-05 14:41', asks: 1043 },
  { email: 'm.zhaksylyk@gmail.com', name: 'Мадина Жақсылық', signup: '2026-09-05', seen: '2026-09-05 13:58', asks: 3 },
  { email: 's.abenov@kaspi.kz', name: 'Санжар Әбенов', signup: '2026-06-27', seen: '2026-09-04 18:20', asks: 94 },
] as const

const docs = [
  { title: 'Гражданский кодекс РК (общая часть)', size: '4,8 МБ', chunks: 3128, loaded: '2025-10-14' },
  { title: 'Гражданский кодекс РК (особенная часть)', size: '5,6 МБ', chunks: 3742, loaded: '2025-10-14' },
  { title: 'Трудовой кодекс РК', size: '2,1 МБ', chunks: 1416, loaded: '2025-10-21' },
  { title: 'Налоговый кодекс РК', size: '7,3 МБ', chunks: 5024, loaded: '2026-01-09' },
  { title: 'Кодекс РК об административных правонарушениях', size: '6,2 МБ', chunks: 4310, loaded: '2026-01-09' },
  { title: 'Закон «О государственных закупках»', size: '1,4 МБ', chunks: 902, loaded: '2026-04-02' },
  { title: 'Закон «О персональных данных и их защите»', size: '0,6 МБ', chunks: 318, loaded: '2026-05-16' },
] as const

const queries: {
  time: string
  rate: 'up' | 'down' | 'none'
  text: Record<Lang, string>
}[] = [
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

const keys = [
  { name: 'Мобильное приложение', prefix: 'tura_live_9f2c…', created: '2026-01-12', used: '2026-09-05 14:12', limit: '20 000' },
  { name: 'Портал госзакупок', prefix: 'tura_live_4ab7…', created: '2026-03-30', used: '2026-09-05 11:44', limit: '5 000' },
  { name: 'Стенд разработки', prefix: 'tura_test_1d80…', created: '2026-06-08', used: '2026-08-29 09:03', limit: '500' },
  { name: 'Интеграция АО «Каспий»', prefix: 'tura_live_7e51…', created: '2026-08-21', used: '', limit: '1 000' },
] as const

const rateKind: Record<'up' | 'down' | 'none', StatusKind> = {
  up: 'ok',
  down: 'err',
  none: 'idle',
}

const rateKey: Record<'up' | 'down' | 'none', string> = {
  up: 'rateUp',
  down: 'rateDown',
  none: 'rateNone',
}

export function AdminPage() {
  const t = useT(dict)
  const { lang } = useLang()
  const [tab, setTab] = useState('overview')

  const tabs: TabItem[] = [
    { id: 'overview', label: t('tabOverview') },
    { id: 'users', label: t('tabUsers') },
    { id: 'docs', label: t('tabDocs') },
    { id: 'queries', label: t('tabQueries') },
    { id: 'keys', label: t('tabKeys') },
  ]

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

      {tab === 'overview' ? (
        <section aria-label={t('tabOverview')}>
          <div className="adm-metrics">
            {metrics.map((m) => (
              <div key={m.key} className="adm-metric">
                <div className="adm-metric__value">{m.value}</div>
                <Label className="adm-metric__label">{t(m.key)}</Label>
                <Caption tone="mute" className="adm-metric__delta">
                  {t(m.delta)}
                </Caption>
              </div>
            ))}
          </div>

          <div className="adm-section">
            <div className="adm-section__head">
              <Label>{t('feedTitle')}</Label>
              <Button variant="ghost">{t('feedAll')}</Button>
            </div>
            <div className="adm-feed">
              {feed.map((e, i) => (
                <div key={`${e.time}-${i}`} className="adm-feed__row">
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
        <section className="adm-scroll" aria-label={t('tabUsers')}>
          <Table>
            <thead>
              <tr>
                <th>{t('colEmail')}</th>
                <th>{t('colName')}</th>
                <th>{t('colSignup')}</th>
                <th>{t('colLastSeen')}</th>
                <th className="adm-num">{t('colQuestions')}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.email}>
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
        </section>
      ) : null}

      {tab === 'docs' ? (
        <section className="adm-scroll" aria-label={t('tabDocs')}>
          <Table>
            <thead>
              <tr>
                <th>{t('colDoc')}</th>
                <th>{t('colSize')}</th>
                <th className="adm-num">{t('colChunks')}</th>
                <th>{t('colLoaded')}</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.title}>
                  <td>
                    <TableTitle>{d.title}</TableTitle>
                  </td>
                  <td>{d.size}</td>
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
        </section>
      ) : null}

      {tab === 'queries' ? (
        <section aria-label={t('tabQueries')}>
          <div className="adm-section__head">
            <Label>{t('queriesTitle')}</Label>
          </div>
          <div className="adm-queries">
            {queries.map((q) => (
              <div key={q.time} className="adm-query">
                <Mono className="adm-query__time">{q.time}</Mono>
                <div className="adm-query__text">{q.text[lang]}</div>
                <div className="adm-query__meta">
                  <Status kind={rateKind[q.rate]}>{t(rateKey[q.rate])}</Status>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {tab === 'keys' ? (
        <section aria-label={t('tabKeys')}>
          <div className="adm-section__head">
            <Label>{t('tabKeys')}</Label>
            <Button variant="primary">{t('keyCreate')}</Button>
          </div>
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
                  <tr key={k.prefix}>
                    <td>
                      <TableTitle>{k.name}</TableTitle>
                    </td>
                    <td>
                      <Mono>{k.prefix}</Mono>
                    </td>
                    <td>
                      <Mono tone="mute">{k.created}</Mono>
                    </td>
                    <td>
                      {k.used ? <Mono tone="mute">{k.used}</Mono> : <Caption tone="mute">{t('never')}</Caption>}
                    </td>
                    <td className="adm-num">
                      <Mono>{k.limit}</Mono>
                    </td>
                    <td>
                      <div className="adm-actions">
                        <Button variant="danger" aria-label={`${t('keyRevokeAria')}: ${k.name}`}>
                          {t('keyRevoke')}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </section>
      ) : null}
    </div>
  )
}
