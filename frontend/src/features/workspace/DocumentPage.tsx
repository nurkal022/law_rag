import { Fragment, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Body,
  Button,
  Caption,
  Cite,
  Display,
  H3,
  Label,
  Legal,
  Mono,
  Status,
  Textarea,
  UIText,
} from '../../shared/ui'
import { useLang, useT } from '../../i18n'
import type { Dict, Lang } from '../../i18n'
import { citeCode } from '../legal/cite'
import './workspace.css'

const dict: Dict = {
  docTitle: { ru: 'Договор поставки № 47-П', kz: '№ 47-П жеткізу шарты', en: 'Supply contract No. 47-P' },
  matter: { ru: 'Дело', kz: 'Іс', en: 'Matter' },
  matterName: { ru: 'ТОО «Астана Логистик»', kz: '«Астана Логистик» ЖШС', en: 'Astana Logistik LLP' },
  pages: { ru: 'Страниц', kz: 'Беттер', en: 'Pages' },
  status: { ru: 'Статус', kz: 'Күйі', en: 'Status' },
  indexed: { ru: 'проиндексирован', kz: 'индекстелген', en: 'indexed' },
  version: { ru: 'Версия', kz: 'Нұсқа', en: 'Version' },

  actEdit: { ru: 'Внести правку', kz: 'Түзету енгізу', en: 'Amend' },
  actCheck: { ru: 'Полная проверка', kz: 'Толық тексеру', en: 'Full review' },
  actExport: { ru: 'Экспорт', kz: 'Экспорт', en: 'Export' },

  dialog: { ru: 'Диалог по документу', kz: 'Құжат бойынша диалог', en: 'Conversation about this document' },
  you: { ru: 'Ваш вопрос', kz: 'Сіздің сұрағыңыз', en: 'Your question' },
  tura: { ru: 'TURA', kz: 'TURA', en: 'TURA' },

  q1: {
    ru: 'Устоит ли в суде пункт о неустойке 5 % за каждый день просрочки?',
    kz: '5 % мөлшеріндегі күнделікті тұрақсыздық айыбы туралы тармақ сотта тұрақ бола ма?',
    en: 'Will the clause on a 5 % daily penalty hold up in court?',
  },
  q2: {
    ru: 'А срок оплаты в договоре не определён. Что применяется по умолчанию?',
    kz: 'Ал шартта төлем мерзімі белгіленбеген. Әдепкі бойынша не қолданылады?',
    en: 'The payment term is not fixed in the contract. What applies by default?',
  },

  ask: { ru: 'Вопрос по документу', kz: 'Құжат бойынша сұрақ', en: 'Question about the document' },
  askPh: {
    ru: 'Спросите о конкретном пункте — например, об ответственности за просрочку',
    kz: 'Нақты тармақ туралы сұраңыз — мысалы, мерзімін өткізгені үшін жауапкершілік',
    en: 'Ask about a specific clause — for example, liability for delay',
  },
  send: { ru: 'Спросить', kz: 'Сұрау', en: 'Ask' },

  panel: { ru: 'Пункт → норма', kz: 'Тармақ → норма', en: 'Clause → provision' },
  panelHint: {
    ru: 'Каждый пункт договора сопоставлен с нормой законодательства РК по смыслу текста, а не по типу договора.',
    kz: 'Шарттың әрбір тармағы шарт түрі бойынша емес, мәтін мағынасы бойынша ҚР заңнамасының нормасымен салыстырылған.',
    en: 'Each clause is matched to a provision of Kazakhstan law by the meaning of its text, not by contract type.',
  },
  yourClause: { ru: 'Ваш пункт', kz: 'Сіздің тармақ', en: 'Your clause' },
}

/** Строка на трёх языках. */
type L10n = Record<Lang, string>

/**
 * Кусок ответа: человеческий текст либо правовая координата.
 * Координаты хранятся в русской канонической форме и переводятся при выводе.
 */
type Seg = string | { cite: string }

/** Привязки «пункт → норма» — раздел 6 спеки рабочего места. Данные замоканы. */
interface CrossRef {
  clause: string
  quote: L10n
  code: string
  norm: L10n
}

const REFS: CrossRef[] = [
  {
    clause: '7.2',
    quote: {
      ru: 'При просрочке поставки Поставщик уплачивает Покупателю неустойку в размере 5 % от стоимости непоставленного товара за каждый день просрочки, без ограничения общей суммы.',
      kz: 'Жеткізуді кешіктірген жағдайда Жеткізуші Сатып алушыға жеткізілмеген тауар құнының 5 % мөлшерінде әрбір кешіктірілген күн үшін тұрақсыздық айыбын жалпы сомасын шектеместен төлейді.',
      en: 'In the event of late delivery the Supplier shall pay the Buyer a penalty of 5 % of the value of the undelivered goods for each day of delay, with no cap on the aggregate amount.',
    },
    code: 'ГК РК 297',
    norm: {
      ru: 'Если подлежащая уплате неустойка чрезмерно велика по сравнению с убытками кредитора, суд вправе уменьшить неустойку, учитывая степень выполнения обязательства должником и заслуживающие внимания интересы должника и кредитора.',
      kz: 'Төленуге тиіс тұрақсыздық айыбы кредитордың залалымен салыстырғанда шектен тыс көп болса, сот борышкердің міндеттемені орындау дәрежесін және борышкер мен кредитордың назар аударуға тұрарлық мүдделерін ескере отырып, тұрақсыздық айыбын азайтуға құқылы.',
      en: 'Where the penalty payable is excessive in comparison with the creditor’s loss, the court may reduce it, having regard to the extent to which the debtor has performed the obligation and to the legitimate interests of both debtor and creditor.',
    },
  },
  {
    clause: '4.1',
    quote: {
      ru: 'Оплата поставленного товара производится Покупателем после приёмки товара; конкретный срок оплаты стороны согласовывают дополнительно.',
      kz: 'Жеткізілген тауарды Сатып алушы тауарды қабылдағаннан кейін төлейді; төлемнің нақты мерзімін тараптар қосымша келіседі.',
      en: 'The Buyer shall pay for the delivered goods after acceptance; the parties are to agree the exact payment date separately.',
    },
    code: 'ГК РК 476',
    norm: {
      ru: 'Покупатель оплачивает поставляемые товары с соблюдением порядка и формы расчётов, предусмотренных договором поставки. Если порядок и форма расчётов не определены соглашением сторон, расчёты осуществляются платёжными поручениями.',
      kz: 'Сатып алушы жеткізілетін тауарларды жеткізу шартында көзделген есеп айырысу тәртібі мен нысанын сақтай отырып төлейді. Есеп айырысу тәртібі мен нысаны тараптардың келісімімен айқындалмаса, есеп айырысу төлем тапсырмаларымен жүргізіледі.',
      en: 'The buyer pays for the goods supplied in the manner and form of settlement provided for by the supply contract. If the parties have agreed neither the manner nor the form, settlement is made by payment orders.',
    },
  },
  {
    clause: '9.4',
    quote: {
      ru: 'Все споры, вытекающие из настоящего Договора, подлежат рассмотрению в арбитраже в городе Лондоне по регламенту LCIA.',
      kz: 'Осы Шарттан туындайтын барлық дау Лондон қаласындағы арбитражда LCIA регламенті бойынша қаралуға тиіс.',
      en: 'All disputes arising out of this Agreement shall be referred to arbitration in London under the LCIA Rules.',
    },
    code: 'ГПК РК 30',
    norm: {
      ru: 'Иски к юридическому лицу предъявляются по месту нахождения органа юридического лица; изъятия из этого правила допускаются лишь в случаях, прямо установленных законом или международным договором.',
      kz: 'Заңды тұлғаға талап қою заңды тұлға органының орналасқан жері бойынша қойылады; бұл қағидадан ауытқуға заңда немесе халықаралық шартта тікелей белгіленген жағдайларда ғана жол беріледі.',
      en: 'Claims against a legal entity are brought at the seat of its governing body; departures from this rule are permitted only where expressly provided by statute or by an international treaty.',
    },
  },
]

/** Первый ответ: устойчивость пункта 7.2 о неустойке. Абзацы, потом куски. */
const ANSWER_PENALTY: Record<Lang, Seg[][]> = {
  ru: [
    [
      'Пункт 7.2 устанавливает неустойку 5 % от стоимости непоставленного товара за каждый день просрочки — это 1 825 % годовых и заведомо больше вероятных убытков покупателя. Само условие законно: стороны свободны в определении размера неустойки. Однако ',
      { cite: 'ГК РК 297' },
      ' даёт суду право уменьшить явно несоразмерную неустойку, и в споре по такому пункту снижение следует считать наиболее вероятным исходом, а не исключением.',
    ],
    [
      'Отдельный риск создаёт оговорка «без ограничения общей суммы»: при длительной просрочке начисление превысит цену договора. Практика по ',
      { cite: 'ГК РК 293' },
      ' исходит из того, что неустойка обеспечивает обязательство, а не заменяет его, поэтому ограничение совокупного размера — обычно 10 % от суммы договора — делает пункт устойчивее, чем высокая ставка без потолка.',
    ],
    [
      'Практический вывод: снизьте ставку до 0,1–0,5 % в день и добавьте предельную сумму. Такой пункт взыскивается целиком, тогда как нынешний, скорее всего, будет урезан судом до сопоставимого уровня — но уже после разбирательства.',
    ],
  ],
  kz: [
    [
      '7.2-тармақ жеткізілмеген тауар құнының 5 % мөлшерінде әрбір кешіктірілген күн үшін тұрақсыздық айыбын белгілейді — бұл жылдық 1 825 % және сатып алушының ықтимал залалынан әлдеқайда көп. Шарттың өзі заңды: тараптар тұрақсыздық айыбының мөлшерін еркін айқындайды. Дегенмен ',
      { cite: 'ГК РК 297' },
      ' сотқа айқын мөлшерсіз тұрақсыздық айыбын азайту құқығын береді, сондықтан мұндай тармақ бойынша дауда азайту — ерекшелік емес, ең ықтимал нәтиже.',
    ],
    [
      'Бөлек тәуекелді «жалпы сомасын шектеместен» деген ескертпе тудырады: ұзақ кешіктіру кезінде есептелген сома шарт бағасынан асып кетеді. ',
      { cite: 'ГК РК 293' },
      ' бойынша тәжірибе тұрақсыздық айыбы міндеттемені қамтамасыз етеді, оны алмастырмайды деген пайымнан шығады, сондықтан жиынтық мөлшерді шектеу — әдетте шарт сомасының 10 %-ы — тармақты шексіз жоғары мөлшерлемеге қарағанда әлдеқайда тұрақты етеді.',
    ],
    [
      'Практикалық қорытынды: мөлшерлемені күніне 0,1–0,5 %-ға дейін төмендетіп, шекті соманы қосыңыз. Мұндай тармақ толық көлемде өндіріледі, ал қазіргісін сот, сірә, сол деңгейге дейін қысқартады — бірақ бұл сот талқылауынан кейін ғана болады.',
    ],
  ],
  en: [
    [
      'Clause 7.2 sets a penalty of 5 % of the value of the undelivered goods for every day of delay — 1,825 % per annum, plainly more than the buyer’s likely loss. The condition itself is lawful: the parties are free to fix the rate. However, ',
      { cite: 'ГК РК 297' },
      ' allows the court to reduce a manifestly disproportionate penalty, and in a dispute over such a clause reduction should be treated as the most likely outcome rather than the exception.',
    ],
    [
      'The words “with no cap on the aggregate amount” create a separate risk: over a long delay the accrual will exceed the contract price. Practice under ',
      { cite: 'ГК РК 293' },
      ' proceeds from the premise that a penalty secures the obligation rather than replacing it, so an aggregate cap — usually 10 % of the contract value — makes the clause far more durable than a high rate with no ceiling.',
    ],
    [
      'The practical conclusion: cut the rate to 0.1–0.5 % per day and add a cap. A clause in that form is recovered in full, whereas the present one will most likely be trimmed by the court to a comparable level — but only after litigation.',
    ],
  ],
}

/** Второй ответ: срок оплаты, не определённый договором. */
const ANSWER_TERM: Record<Lang, Seg[][]> = {
  ru: [
    [
      'Пункт 4.1 отсылает срок оплаты к дополнительному согласованию, то есть в договоре его нет. По ',
      { cite: 'ГК РК 476' },
      ' покупатель оплачивает товар в порядке и форме, предусмотренных договором поставки, а при отсутствии соглашения расчёты ведутся платёжными поручениями; сам срок при этом определяется по общему правилу ',
      { cite: 'ГК РК 277' },
      ' — обязательство исполняется в разумный срок, а после требования кредитора — в семидневный.',
    ],
    [
      'Для взыскания это означает, что просрочка начнёт течь только с восьмого дня после вашего письменного требования, и неустойка по пункту 7.2 до этого момента не начисляется. Прямой срок в договоре — «в течение 10 рабочих дней с даты подписания накладной» — устраняет спор о моменте начала просрочки.',
    ],
  ],
  kz: [
    [
      '4.1-тармақ төлем мерзімін қосымша келісуге қалдырады, яғни шартта ол жоқ. ',
      { cite: 'ГК РК 476' },
      ' бойынша сатып алушы тауарды жеткізу шартында көзделген тәртіп пен нысанда төлейді, ал келісім болмаса, есеп айырысу төлем тапсырмаларымен жүргізіледі; мерзімнің өзі ',
      { cite: 'ГК РК 277' },
      ' жалпы қағидасы бойынша айқындалады — міндеттеме ақылға қонымды мерзімде, ал кредитор талап еткеннен кейін жеті күн ішінде орындалады.',
    ],
    [
      'Өндіріп алу тұрғысынан бұл кешіктіру сіздің жазбаша талабыңыздан кейінгі сегізінші күні ғана басталатынын, оған дейін 7.2-тармақ бойынша тұрақсыздық айыбы есептелмейтінін білдіреді. Шартта тікелей мерзімнің болуы — «жүкқұжатқа қол қойылған күннен бастап 10 жұмыс күні ішінде» — кешіктірудің басталу сәті туралы дауды жояды.',
    ],
  ],
  en: [
    [
      'Clause 4.1 leaves the payment date to a separate agreement, which means the contract fixes none. Under ',
      { cite: 'ГК РК 476' },
      ' the buyer pays in the manner and form provided by the supply contract, and absent agreement settlement is made by payment orders; the date itself then follows the general rule in ',
      { cite: 'ГК РК 277' },
      ' — the obligation is performed within a reasonable time and, once the creditor demands performance, within seven days.',
    ],
    [
      'For recovery this means that delay starts running only on the eighth day after your written demand, and no penalty under clause 7.2 accrues before then. An express date in the contract — “within 10 working days of the date the delivery note is signed” — removes any argument about when default begins.',
    ],
  ],
}

/** Разворачивает абзацы ответа, подставляя координаты на языке интерфейса. */
function Answer({ paragraphs, lang }: { paragraphs: Seg[][]; lang: Lang }) {
  return (
    <Legal className="ws-answer">
      {paragraphs.map((segs, pi) => (
        <p key={pi}>
          {segs.map((seg, si): ReactNode =>
            typeof seg === 'string' ? (
              <Fragment key={si}>{seg}</Fragment>
            ) : (
              <Cite key={si} code={citeCode(seg.cite, lang)} />
            ),
          )}
        </p>
      ))}
    </Legal>
  )
}

export function DocumentPage() {
  const t = useT(dict)
  const { lang } = useLang()
  const [draft, setDraft] = useState('')

  return (
    <div className="ws-doc">
      <div className="ws-doc__main">
        <div>
          <Display>{t('docTitle')}</Display>
        </div>

        <div className="ws-meta">
          <span className="ws-meta__item">
            <Label as="span">{t('matter')}</Label>
            <UIText tone="ink2">{t('matterName')}</UIText>
          </span>
          <span className="ws-meta__item">
            <Label as="span">{t('pages')}</Label>
            <Mono tone="ink2">14</Mono>
          </span>
          <span className="ws-meta__item">
            <Label as="span">{t('status')}</Label>
            <Status kind="ok">{t('indexed')}</Status>
          </span>
          <span className="ws-meta__item">
            <Label as="span">{t('version')}</Label>
            <Mono tone="ink2">v3</Mono>
          </span>
        </div>

        <div className="ws-actions">
          <Button variant="primary">{t('actEdit')}</Button>
          <Button variant="secondary">{t('actCheck')}</Button>
          <Button variant="secondary">{t('actExport')}</Button>
        </div>

        <Label as="h2">{t('dialog')}</Label>

        <div className="ws-thread">
          <div className="ws-turn">
            <Caption tone="mute">{t('you')}</Caption>
            <div className="ws-turn__ask">
              <Body style={{ margin: 0 }}>{t('q1')}</Body>
            </div>
          </div>

          <div className="ws-turn">
            <Caption tone="mute">{t('tura')}</Caption>
            <Answer paragraphs={ANSWER_PENALTY[lang]} lang={lang} />
          </div>

          <div className="ws-turn">
            <Caption tone="mute">{t('you')}</Caption>
            <div className="ws-turn__ask">
              <Body style={{ margin: 0 }}>{t('q2')}</Body>
            </div>
          </div>

          <div className="ws-turn">
            <Caption tone="mute">{t('tura')}</Caption>
            <Answer paragraphs={ANSWER_TERM[lang]} lang={lang} />
          </div>
        </div>

        <form className="ws-ask" onSubmit={(e) => e.preventDefault()}>
          <div className="ws-ask__field">
            <Textarea
              label={t('ask')}
              placeholder={t('askPh')}
              value={draft}
              rows={2}
              onChange={(e) => setDraft(e.currentTarget.value)}
            />
          </div>
          <Button variant="primary" type="submit">
            {t('send')}
          </Button>
        </form>
      </div>

      <aside className="ws-doc__side" aria-label={t('panel')}>
        <div>
          <H3>{t('panel')}</H3>
          <Caption tone="mute">{t('panelHint')}</Caption>
        </div>

        <div className="ws-links">
          {REFS.map((r) => (
            <div className="ws-link" key={r.clause}>
              <Mono tone="mute" className="ws-link__clause">
                {t('yourClause')} {r.clause}
              </Mono>
              <p className="ws-link__quote">{r.quote[lang]}</p>
              <div className="ws-link__arrow">
                <Cite code={citeCode(r.code, lang)} />
              </div>
              <p className="ws-link__norm">{r.norm[lang]}</p>
            </div>
          ))}
        </div>
      </aside>
    </div>
  )
}
