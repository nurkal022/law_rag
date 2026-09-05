import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import {
  Body,
  Button,
  Caption,
  Caret,
  Cite,
  Display,
  H3,
  Label,
  Legal,
  Loading,
  Mono,
  Status,
  Textarea,
  UIText,
  useToast,
} from '../../shared/ui'
import { useLang, useT } from '../../i18n'
import type { Dict, Lang } from '../../i18n'
import { citeCode } from '../legal/cite'
import './workspace.css'
import './workspace.motion.css'

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

  writing: { ru: 'Ответ печатается', kz: 'Жауап теріліп жатыр', en: 'Answering' },
  newRef: {
    ru: 'В панель добавлена новая привязка',
    kz: 'Панельге жаңа байланыс қосылды',
    en: 'A new link has been added to the panel',
  },
  noRef: {
    ru: 'Для этой нормы привязки в документе нет',
    kz: 'Бұл норма үшін құжатта байланыс жоқ',
    en: 'No clause in this document is linked to that provision',
  },
  checkRunning: {
    ru: 'Идёт проверка документа по нормам РК',
    kz: 'Құжат ҚР нормалары бойынша тексерілуде',
    en: 'The document is being checked against Kazakhstan law',
  },
  checkTitle: { ru: 'Результат проверки', kz: 'Тексеру нәтижесі', en: 'Review findings' },
  checkSummary: {
    ru: 'Просмотрено 14 страниц, 23 пункта. Найдено 4 места, требующих решения.',
    kz: '14 бет, 23 тармақ қаралды. Шешім қажет ететін 4 орын табылды.',
    en: '14 pages and 23 clauses reviewed. Four places need a decision.',
  },
  checkAgain: { ru: 'Проверить заново', kz: 'Қайта тексеру', en: 'Check again' },
  sevErr: { ru: 'риск', kz: 'тәуекел', en: 'risk' },
  sevWarn: { ru: 'внимание', kz: 'назар', en: 'attention' },
  sevOk: { ru: 'в порядке', kz: 'ретінде', en: 'in order' },
  editSoon: {
    ru: 'Правка документа появится вместе с редактором',
    kz: 'Құжатты түзету редактормен бірге пайда болады',
    en: 'Editing arrives together with the editor',
  },
  exportSoon: {
    ru: 'Экспорт в DOCX будет готов после подключения сервера',
    kz: 'DOCX экспорты сервер қосылғаннан кейін дайын болады',
    en: 'DOCX export will be available once the server is connected',
  },
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
  /**
   * Координаты, по которым эта привязка находится из текста ответа. Одна норма
   * может упоминаться в разных формулировках, а пункт остаётся тем же.
   */
  matches: string[]
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
    matches: ['ГК РК 297', 'ГК РК 293'],
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
    matches: ['ГК РК 476', 'ГК РК 277'],
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
    matches: ['ГПК РК 30'],
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

/* ---------- Что появляется в ответ на вопрос ----------
   Привязка «пункт → норма» рождается не из типа договора, а из текста
   конкретного пункта: заданный вопрос вытягивает свой пункт и свою норму. */

interface Followup {
  answer: Record<Lang, Seg[][]>
  ref: CrossRef
}

const FOLLOWUPS: Followup[] = [
  {
    answer: {
      ru: [
        [
          'Пункт 8.1 освобождает стороны от ответственности при обстоятельствах непреодолимой силы, но не описывает ни порядок уведомления, ни срок. По ',
          { cite: 'ГК РК 359' },
          ' предприниматель отвечает за нарушение и без вины; освобождает только непреодолимая сила, то есть чрезвычайное и непредотвратимое при данных условиях обстоятельство. Отсутствие товара у поставщика и отказ его контрагента к ней не относятся.',
        ],
        [
          'Практический вывод: добавьте в пункт срок уведомления — обычно 10 календарных дней — и подтверждение торгово-промышленной палаты. Без этого ссылка на форс-мажор в споре по ',
          { cite: 'ГК РК 293' },
          ' не помешает начислению неустойки: суд рассматривает не сам факт события, а его связь с неисполнением.',
        ],
      ],
      kz: [
        [
          '8.1-тармақ тараптарды еңсерілмейтін күш жағдайларында жауапкершіліктен босатады, бірақ хабарлау тәртібін де, мерзімін де сипаттамайды. ',
          { cite: 'ГК РК 359' },
          ' бойынша кәсіпкер бұзушылық үшін кінәсіз де жауап береді; тек еңсерілмейтін күш, яғни осы жағдайларда төтенше әрі болғызбайтын мән-жай ғана босатады. Жеткізушіде тауардың болмауы және оның контрагентінің бас тартуы оған жатпайды.',
        ],
        [
          'Практикалық қорытынды: тармаққа хабарлау мерзімін — әдетте 10 күнтізбелік күн — және сауда-өнеркәсіп палатасының растауын қосыңыз. Онсыз ',
          { cite: 'ГК РК 293' },
          ' бойынша даудағы форс-мажорға сілтеме тұрақсыздық айыбын есептеуге кедергі болмайды: сот оқиғаның өзін емес, оның орындамаумен байланысын қарайды.',
        ],
      ],
      en: [
        [
          'Clause 8.1 releases the parties from liability in circumstances of force majeure but sets out neither a notice procedure nor a deadline. Under ',
          { cite: 'ГК РК 359' },
          ' an entrepreneur is liable for a breach even without fault; only force majeure — an extraordinary event that could not be prevented in the circumstances — provides relief. A supplier’s lack of stock or its own counterparty’s refusal is not such an event.',
        ],
        [
          'The practical conclusion: add a notice period to the clause — usually 10 calendar days — and confirmation from the chamber of commerce. Without them a plea of force majeure in a dispute under ',
          { cite: 'ГК РК 293' },
          ' will not stop the penalty accruing: the court looks not at the event itself but at its link to the non-performance.',
        ],
      ],
    },
    ref: {
      clause: '8.1',
      quote: {
        ru: 'Стороны освобождаются от ответственности за неисполнение обязательств, если оно вызвано обстоятельствами непреодолимой силы.',
        kz: 'Міндеттемелерді орындамау еңсерілмейтін күш жағдайларынан туындаса, тараптар жауапкершіліктен босатылады.',
        en: 'The parties are released from liability for non-performance caused by circumstances of force majeure.',
      },
      code: 'ГК РК 359',
      matches: ['ГК РК 359'],
      norm: {
        ru: 'Лицо, не исполнившее обязательство при осуществлении предпринимательской деятельности, несёт ответственность, если не докажет, что надлежащее исполнение оказалось невозможным вследствие непреодолимой силы.',
        kz: 'Кәсіпкерлік қызметті жүзеге асыру кезінде міндеттемені орындамаған адам тиісінше орындау еңсерілмейтін күш салдарынан мүмкін болмағанын дәлелдемесе, жауапты болады.',
        en: 'A person who has failed to perform an obligation in the course of business is liable unless it proves that proper performance was impossible owing to force majeure.',
      },
    },
  },
  {
    answer: {
      ru: [
        [
          'Пункт 11.2 требует оформлять изменения дополнительным соглашением в письменной форме, и это согласуется с ',
          { cite: 'ГК РК 402' },
          ': соглашение об изменении договора совершается в той же форме, что и сам договор, если из закона или обычая не следует иное.',
        ],
        [
          'Риск здесь не в самом пункте, а в переписке: согласование новой цены или срока по электронной почте изменением договора не является и в суде не подтверждает нового условия. Держите каждое отступление от договора отдельным подписанным приложением.',
        ],
      ],
      kz: [
        [
          '11.2-тармақ өзгерістерді жазбаша нысанда қосымша келісіммен ресімдеуді талап етеді, бұл ',
          { cite: 'ГК РК 402' },
          ' талабына сай: шартты өзгерту туралы келісім, егер заңнан немесе әдеттен өзгеше туындамаса, шарттың өзі сияқты нысанда жасалады.',
        ],
        [
          'Тәуекел тармақтың өзінде емес, хат алмасуда: жаңа бағаны немесе мерзімді электрондық поштамен келісу шартты өзгерту болып саналмайды және сотта жаңа талапты растамайды. Шарттан әрбір ауытқуды жеке қол қойылған қосымшамен ресімдеңіз.',
        ],
      ],
      en: [
        [
          'Clause 11.2 requires amendments to be made by a written supplementary agreement, which matches ',
          { cite: 'ГК РК 402' },
          ': an agreement to vary a contract is made in the same form as the contract itself unless statute or usage provides otherwise.',
        ],
        [
          'The risk lies not in the clause but in the correspondence: agreeing a new price or date by email is not a variation and will not establish the new term in court. Keep every departure from the contract as a separate signed annex.',
        ],
      ],
    },
    ref: {
      clause: '11.2',
      quote: {
        ru: 'Все изменения и дополнения к настоящему Договору действительны, если оформлены дополнительным соглашением в письменной форме.',
        kz: 'Осы Шартқа барлық өзгерістер мен толықтырулар жазбаша нысанда қосымша келісіммен ресімделсе жарамды.',
        en: 'All amendments and additions to this Agreement are valid if made by a supplementary agreement in writing.',
      },
      code: 'ГК РК 402',
      matches: ['ГК РК 402'],
      norm: {
        ru: 'Соглашение об изменении или расторжении договора совершается в той же форме, что и договор, если из законодательства, договора или обычаев делового оборота не вытекает иное.',
        kz: 'Шартты өзгерту немесе бұзу туралы келісім, егер заңнамадан, шарттан немесе іскерлік айналым дағдыларынан өзгеше туындамаса, шарт сияқты нысанда жасалады.',
        en: 'An agreement to vary or terminate a contract is made in the same form as the contract, unless legislation, the contract or business usage requires otherwise.',
      },
    },
  },
]

/* ---------- Полная проверка: что находит разбор по пунктам ---------- */

type Severity = 'err' | 'warn' | 'ok'

interface Finding {
  clause: string
  code: string
  severity: Severity
  text: L10n
}

const FINDINGS: Finding[] = [
  {
    clause: '7.2',
    code: 'ГК РК 297',
    severity: 'err',
    text: {
      ru: 'Неустойка 5 % в день без предельной суммы: 1 825 % годовых. Суд уменьшит её как явно несоразмерную, а до решения взыскание неопределимо.',
      kz: 'Күніне 5 % тұрақсыздық айыбы шекті сомасыз: жылдық 1 825 %. Сот оны айқын мөлшерсіз деп азайтады, ал шешімге дейін өндіріп алу белгісіз.',
      en: 'A 5 % daily penalty with no cap is 1,825 % per annum. A court will cut it as disproportionate, and until judgment the recoverable amount is unknown.',
    },
  },
  {
    clause: '9.4',
    code: 'ГПК РК 30',
    severity: 'err',
    text: {
      ru: 'Арбитраж в Лондоне по регламенту LCIA при обеих сторонах из Казахстана: расходы несоразмерны сумме договора, а исполнение решения потребует отдельной процедуры признания.',
      kz: 'Екі тарап та Қазақстаннан болғанда LCIA регламенті бойынша Лондондағы арбитраж: шығыс шарт сомасына сәйкес емес, ал шешімді орындау тану рәсімін талап етеді.',
      en: 'LCIA arbitration in London with both parties based in Kazakhstan: the cost is out of proportion to the contract value and enforcement needs a separate recognition procedure.',
    },
  },
  {
    clause: '4.1',
    code: 'ГК РК 476',
    severity: 'warn',
    text: {
      ru: 'Срок оплаты отдан на дополнительное согласование. Просрочка начнёт течь только с восьмого дня после письменного требования — до этого неустойка не начисляется.',
      kz: 'Төлем мерзімі қосымша келісуге қалдырылған. Кешіктіру жазбаша талаптан кейінгі сегізінші күні ғана басталады — оған дейін тұрақсыздық айыбы есептелмейді.',
      en: 'The payment date is left to a further agreement. Delay begins only on the eighth day after a written demand; no penalty accrues before that.',
    },
  },
  {
    clause: '2.3',
    code: 'ГК РК 458',
    severity: 'ok',
    text: {
      ru: 'Условие о количестве и ассортименте товара определено однозначно: предмет договора согласован, риск признания договора незаключённым отсутствует.',
      kz: 'Тауардың саны мен ассортименті туралы талап біржақты айқындалған: шарттың мәні келісілген, шартты жасалмаған деп тану тәуекелі жоқ.',
      en: 'Quantity and assortment are stated unambiguously: the subject matter is agreed and there is no risk of the contract being held unconcluded.',
    },
  },
]

const SEVERITY_KEY: Record<Severity, string> = { err: 'sevErr', warn: 'sevWarn', ok: 'sevOk' }

/* ---------- Набор ответа по словам ---------- */

/** Единица вывода: слово либо правовая координата, с номером своего абзаца. */
type Unit = { p: number; word: string } | { p: number; cite: string }

const STEP_MS = 26
const CHECK_MS = 2400

function toUnits(paragraphs: Seg[][]): Unit[] {
  const out: Unit[] = []
  paragraphs.forEach((segs, p) => {
    for (const seg of segs) {
      if (typeof seg !== 'string') {
        out.push({ p, cite: seg.cite })
        continue
      }
      for (const w of seg.match(/\s*\S+\s*|\s+/g) ?? []) out.push({ p, word: w })
    }
  })
  return out
}

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Разворачивает абзацы ответа, подставляя координаты на языке интерфейса.
 * Когда typing включён, текст набирается по словам — как в консультанте.
 */
function Answer({
  paragraphs,
  lang,
  typing = false,
  onCite,
  onDone,
}: {
  paragraphs: Seg[][]
  lang: Lang
  typing?: boolean
  onCite: (code: string) => void
  onDone?: () => void
}) {
  const units = useMemo(() => toUnits(paragraphs), [paragraphs])
  const [shown, setShown] = useState(() => (typing ? 0 : units.length))
  const [busy, setBusy] = useState(typing)

  /* Обработчик держим в ссылке: иначе новая функция на каждом рендере
     родителя перезапускала бы набор с первого слова. */
  const done = useRef(onDone)
  useEffect(() => {
    done.current = onDone
  })

  useEffect(() => {
    if (!busy) return
    if (prefersReducedMotion()) {
      setShown(units.length)
      setBusy(false)
      done.current?.()
      return
    }
    let i = 0
    const timer = window.setInterval(() => {
      i += 1
      setShown(i)
      if (i >= units.length) {
        window.clearInterval(timer)
        setBusy(false)
        done.current?.()
      }
    }, STEP_MS)
    return () => window.clearInterval(timer)
  }, [busy, units])

  const visible = busy ? units.slice(0, shown) : units

  // Сборка по абзацам: соседние слова склеиваются, координата остаётся <Cite>
  const blocks: ReactNode[][] = paragraphs.map(() => [])
  let buf = ''
  let cur = 0
  visible.forEach((u, i) => {
    if (u.p !== cur) {
      if (buf) blocks[cur].push(buf)
      buf = ''
      cur = u.p
    }
    if ('cite' in u) {
      if (buf) {
        blocks[cur].push(buf)
        buf = ''
      }
      blocks[cur].push(
        <Cite key={`c${i}`} code={citeCode(u.cite, lang)} onClick={() => onCite(u.cite)} />,
      )
    } else {
      buf += u.word
    }
  })
  if (buf) blocks[cur].push(buf)

  return (
    <Legal className="ws-answer" aria-busy={busy || undefined}>
      {blocks.map((nodes, pi) =>
        nodes.length === 0 && busy ? null : (
          <p key={pi}>
            {nodes.map((n, ni) => (
              <Fragment key={ni}>{n}</Fragment>
            ))}
            {busy && pi === cur ? <Caret /> : null}
          </p>
        ),
      )}
    </Legal>
  )
}

/* ---------- Экран документа ---------- */

interface DocTurn {
  id: number
  question: string | L10n
  answer: Record<Lang, Seg[][]>
  /** Набирается ли ответ прямо сейчас: заготовленный диалог уже написан. */
  typing: boolean
}

type CheckState = 'idle' | 'running' | 'done'

export function DocumentPage() {
  const t = useT(dict)
  const { lang } = useLang()
  const toast = useToast()

  const [draft, setDraft] = useState('')
  const [turns, setTurns] = useState<DocTurn[]>([
    { id: 1, question: dict.q1, answer: ANSWER_PENALTY, typing: false },
    { id: 2, question: dict.q2, answer: ANSWER_TERM, typing: false },
  ])
  /** Сколько привязок доросло из диалога: каждая — ответ на заданный вопрос. */
  const [grown, setGrown] = useState(0)
  const [flash, setFlash] = useState<string | null>(null)
  const [check, setCheck] = useState<CheckState>('idle')

  const nodes = useRef(new Map<string, HTMLDivElement | null>())
  const timers = useRef<number[]>([])

  useEffect(
    () => () => {
      for (const id of timers.current) window.clearTimeout(id)
    },
    [],
  )

  const refs = useMemo(
    () => [...REFS, ...FOLLOWUPS.slice(0, grown).map((f) => f.ref)],
    [grown],
  )

  /**
   * Главный жест экрана: координата в тексте ответа ведёт к своей привязке в
   * правой панели — панель прокручивается к ней, и привязка коротко
   * подсвечивается фоном печати.
   */
  const openCite = useCallback(
    (code: string) => {
      const hit = refs.find((r) => r.matches.includes(code))
      if (!hit) {
        toast(`${citeCode(code, lang)} — ${t('noRef')}`)
        return
      }
      nodes.current.get(hit.clause)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      setFlash(hit.clause)
      const timer = window.setTimeout(() => setFlash((c) => (c === hit.clause ? null : c)), 1800)
      timers.current.push(timer)
    },
    [refs, toast, t, lang],
  )

  const typingNow = turns.some((x) => x.typing)

  const ask = useCallback(() => {
    const q = draft.trim()
    if (!q || typingNow) return
    const followup = FOLLOWUPS[Math.min(grown, FOLLOWUPS.length - 1)]
    setTurns((prev) => [...prev, { id: Date.now(), question: q, answer: followup.answer, typing: true }])
    setDraft('')
  }, [draft, typingNow, grown])

  /** Ответ дописан — в панели появляется привязка, найденная по этому вопросу. */
  const finished = useCallback(
    (id: number) => {
      setTurns((prev) => prev.map((x) => (x.id === id ? { ...x, typing: false } : x)))
      if (grown >= FOLLOWUPS.length) return
      setGrown(grown + 1)
      toast(`${t('newRef')}: ${t('yourClause')} ${FOLLOWUPS[grown].ref.clause}`, 'ok')
    },
    [toast, t, grown],
  )

  const runCheck = useCallback(() => {
    setCheck('running')
    const timer = window.setTimeout(() => setCheck('done'), CHECK_MS)
    timers.current.push(timer)
  }, [])

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
          <Button variant="primary" onClick={() => toast(t('editSoon'))}>
            {t('actEdit')}
          </Button>
          <Button variant="secondary" onClick={runCheck} disabled={check === 'running'}>
            {check === 'done' ? t('checkAgain') : t('actCheck')}
          </Button>
          <Button variant="secondary" onClick={() => toast(t('exportSoon'))}>
            {t('actExport')}
          </Button>
        </div>

        {check !== 'idle' ? (
          <section className="ws-check unfold" aria-live="polite">
            {check === 'running' ? (
              <>
                <Caption tone="mute">{t('checkRunning')}</Caption>
                <Loading label={t('checkRunning')} />
              </>
            ) : (
              <>
                <div className="ws-group-head" style={{ margin: 0 }}>
                  <Label>{t('checkTitle')}</Label>
                  <Mono tone="mute">{FINDINGS.length}</Mono>
                </div>
                <Caption tone="mute">{t('checkSummary')}</Caption>
                <div className="ws-check__list">
                  {FINDINGS.map((f, i) => (
                    <div key={f.clause} className="ws-finding enter-item" style={{ '--i': i } as CSSProperties}>
                      <div className="ws-finding__head">
                        <Mono tone="ink2">
                          {t('yourClause')} {f.clause}
                        </Mono>
                        <Status kind={f.severity}>{t(SEVERITY_KEY[f.severity])}</Status>
                        <Cite code={citeCode(f.code, lang)} onClick={() => openCite(f.code)} />
                      </div>
                      <p className="ws-finding__text">{f.text[lang]}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        ) : null}

        <Label as="h2">{t('dialog')}</Label>

        <div className="ws-thread">
          {turns.map((turn) => (
            <Fragment key={turn.id}>
              <div className="ws-turn enter">
                <Caption tone="mute">{t('you')}</Caption>
                <div className="ws-turn__ask">
                  <Body style={{ margin: 0 }}>
                    {typeof turn.question === 'string' ? turn.question : turn.question[lang]}
                  </Body>
                </div>
              </div>

              <div className="ws-turn enter">
                <Caption tone="mute">{t('tura')}</Caption>
                <Answer
                  /* Ключ по языку: при переключении ответ пересобирается,
                     а уже набранный не начинает печататься заново. */
                  key={`${turn.id}-${lang}`}
                  paragraphs={turn.answer[lang]}
                  lang={lang}
                  typing={turn.typing}
                  onCite={openCite}
                  onDone={turn.typing ? () => finished(turn.id) : undefined}
                />
                {turn.typing ? (
                  <Caption tone="mute" role="status">
                    {t('writing')}
                  </Caption>
                ) : null}
              </div>
            </Fragment>
          ))}
        </div>

        <form
          className="ws-ask"
          onSubmit={(e) => {
            e.preventDefault()
            ask()
          }}
        >
          <div className="ws-ask__field">
            <Textarea
              label={t('ask')}
              placeholder={t('askPh')}
              value={draft}
              rows={2}
              onChange={(e) => setDraft(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  ask()
                }
              }}
            />
          </div>
          <Button variant="primary" type="submit" disabled={!draft.trim() || typingNow}>
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
          {refs.map((r, i) => (
            <div
              className={[
                'ws-link',
                i >= REFS.length ? 'enter' : '',
                flash === r.clause ? 'ws-link--flash' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              key={r.clause}
              ref={(el) => {
                nodes.current.set(r.clause, el)
              }}
            >
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
