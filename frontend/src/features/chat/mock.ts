import type { Lang } from '../../i18n'

/**
 * Замоканные ответы консультанта. Бэкенд подключается отдельно; форма данных
 * повторяет ожидаемый ответ /api/chat: текст с вкраплениями правовых координат
 * плюс список найденных норм.
 */

/** Кусок ответа: строка человеческого текста либо правовая координата. */
export type Seg = string | { cite: string }

export interface SourceItem {
  code: string
  doc: Record<Lang, string>
  excerpt: Record<Lang, string>
}

export interface MockAnswer {
  id: string
  /** Ключевые слова вопроса, по которым подбирается заготовленный ответ. */
  match: string[]
  body: Record<Lang, Seg[]>
  sources: SourceItem[]
}

export interface Example {
  id: string
  text: Record<Lang, string>
}

/** Примеры вопросов для пустого состояния. */
export const EXAMPLES: Example[] = [
  {
    id: 'limitation',
    text: {
      ru: 'Какой срок исковой давности по договору поставки и когда он начинает течь?',
      kz: 'Жеткізу шарты бойынша талап қою мерзімі қандай және ол қашан басталады?',
      en: 'What is the limitation period for a supply contract and when does it start running?',
    },
  },
  {
    id: 'penalty',
    text: {
      ru: 'Как рассчитывается неустойка за просрочку оплаты, если размер не указан в договоре?',
      kz: 'Шартта мөлшері көрсетілмесе, төлемді кешіктіргені үшін тұрақсыздық айыбы қалай есептеледі?',
      en: 'How is the penalty for late payment calculated if the contract sets no rate?',
    },
  },
  {
    id: 'termination',
    text: {
      ru: 'Можно ли расторгнуть договор аренды в одностороннем порядке без суда?',
      kz: 'Жалдау шартын сотсыз, біржақты тәртіппен бұзуға бола ма?',
      en: 'Can a lease be terminated unilaterally without going to court?',
    },
  },
  {
    id: 'force',
    text: {
      ru: 'Освобождает ли форс-мажор от уплаты неустойки по договору подряда?',
      kz: 'Форс-мажор мердігерлік шарты бойынша тұрақсыздық айыбын төлеуден босата ма?',
      en: 'Does force majeure release a contractor from paying a contractual penalty?',
    },
  },
]

const limitation: MockAnswer = {
  id: 'limitation',
  match: [
    'исковой', 'давност', 'срок', 'поставк',
    'талап', 'мерзім', 'ескіру',
    'limitation', 'period', 'prescription', 'supply',
  ],
  body: {
    ru: [
      'Общий срок исковой давности в Республике Казахстан составляет три года — ',
      { cite: 'ГК РК 178.1' },
      '. Для договора поставки специального сокращённого срока не установлено, поэтому применяется общий трёхлетний срок; сокращённые сроки закон вводит точечно, например по требованиям к перевозчику.\n\n',
      'Течение срока начинается не с даты подписания договора, а со дня, когда лицо узнало или должно было узнать о нарушении права — ',
      { cite: 'ГК РК 180.1' },
      '. По обязательству с определённым сроком исполнения это, как правило, день, следующий за последним днём оплаты или поставки. Если срок исполнения не определён, давность течёт с момента, когда у кредитора возникает право требовать исполнения.\n\n',
      'Важно, что по каждой просроченной партии и по каждому периодическому платежу срок считается отдельно. Признание долга должником — акт сверки, частичная оплата, письменный ответ на претензию — прерывает течение давности, и после перерыва срок начинается заново, а истёкшее время не засчитывается: ',
      { cite: 'ГК РК 183' },
      '.\n\n',
      'Суд применяет исковую давность только по заявлению стороны в споре, сделанному до вынесения решения — ',
      { cite: 'ГК РК 179.2' },
      '. Иными словами, пропуск срока сам по себе не блокирует иск: если ответчик о давности не заявил, дело рассматривается по существу.',
    ],
    kz: [
      'Қазақстан Республикасында талап қоюдың жалпы мерзімі — үш жыл: ',
      { cite: 'ҚР АК 178.1' },
      '. Жеткізу шарты үшін арнайы қысқартылған мерзім белгіленбеген, сондықтан жалпы үш жылдық мерзім қолданылады; қысқартылған мерзімдерді заң нүктелі түрде, мысалы тасымалдаушыға қойылатын талаптар бойынша енгізеді.\n\n',
      'Мерзімнің өтуі шартқа қол қойылған күннен емес, адам құқығының бұзылғанын білген немесе білуге тиіс болған күннен басталады — ',
      { cite: 'ҚР АК 180.1' },
      '. Орындау мерзімі айқындалған міндеттеме бойынша бұл, әдетте, төлемнің немесе жеткізудің соңғы күнінен кейінгі күн. Орындау мерзімі айқындалмаған болса, мерзім кредитордың орындауды талап ету құқығы туындаған сәттен басталады.\n\n',
      'Әрбір кешіктірілген топтама мен әрбір мерзімді төлем бойынша мерзім бөлек есептеледі. Борышкердің борышты мойындауы — салыстыру актісі, ішінара төлем, кінәрат-талапқа жазбаша жауап — мерзімнің өтуін үзеді, үзілістен кейін мерзім қайтадан басталады, ал өткен уақыт есепке алынбайды: ',
      { cite: 'ҚР АК 183' },
      '.\n\n',
      'Сот талап қою мерзімін тек даудағы тараптың шешім шығарылғанға дейін берген өтініші бойынша қолданады — ',
      { cite: 'ҚР АК 179.2' },
      '. Яғни мерзімді өткізіп алудың өзі талапты бөгемейді: жауапкер мерзім туралы мәлімдемесе, іс мәні бойынша қаралады.',
    ],
    en: [
      'The general limitation period in the Republic of Kazakhstan is three years — ',
      { cite: 'CC RK 178.1' },
      '. No shortened period is prescribed for supply contracts, so the general three-year term applies; shortened terms are introduced selectively, for instance for claims against a carrier.\n\n',
      'The period starts not on the date the contract was signed but on the day the person learned, or ought to have learned, of the infringement — ',
      { cite: 'CC RK 180.1' },
      '. For an obligation with a fixed performance date this is normally the day after the last day for payment or delivery. Where no date is fixed, time runs from the moment the creditor becomes entitled to demand performance.\n\n',
      'Each overdue consignment and each periodic payment is counted separately. Acknowledgement of the debt by the debtor — a reconciliation act, a part payment, a written reply to a claim — interrupts the running of time; after the interruption the period starts afresh and the elapsed time is not counted: ',
      { cite: 'CC RK 183' },
      '.\n\n',
      'A court applies limitation only on an application by a party made before judgment is delivered — ',
      { cite: 'CC RK 179.2' },
      '. In other words, an expired period does not bar the claim by itself: if the defendant does not raise it, the case is heard on the merits.',
    ],
  },
  sources: [
    {
      code: 'ГК РК 178.1',
      doc: {
        ru: 'Гражданский кодекс РК (общая часть), статья 178',
        kz: 'ҚР Азаматтық кодексі (жалпы бөлім), 178-бап',
        en: 'Civil Code of the RK (general part), article 178',
      },
      excerpt: {
        ru: 'Общий срок исковой давности устанавливается в три года.',
        kz: 'Талап қоюдың жалпы мерзімі үш жыл болып белгіленеді.',
        en: 'The general limitation period is set at three years.',
      },
    },
    {
      code: 'ГК РК 180.1',
      doc: {
        ru: 'Гражданский кодекс РК (общая часть), статья 180',
        kz: 'ҚР Азаматтық кодексі (жалпы бөлім), 180-бап',
        en: 'Civil Code of the RK (general part), article 180',
      },
      excerpt: {
        ru: 'Течение срока исковой давности начинается со дня, когда лицо узнало или должно было узнать о нарушении права.',
        kz: 'Талап қою мерзімінің өтуі адам құқығының бұзылғанын білген немесе білуге тиіс болған күннен басталады.',
        en: 'The limitation period begins on the day the person learned or should have learned of the infringement of the right.',
      },
    },
    {
      code: 'ГК РК 183',
      doc: {
        ru: 'Гражданский кодекс РК (общая часть), статья 183',
        kz: 'ҚР Азаматтық кодексі (жалпы бөлім), 183-бап',
        en: 'Civil Code of the RK (general part), article 183',
      },
      excerpt: {
        ru: 'Течение срока прерывается предъявлением иска, а также совершением обязанным лицом действий, свидетельствующих о признании долга.',
        kz: 'Мерзімнің өтуі талап қоюмен, сондай-ақ міндетті адамның борышты мойындауын білдіретін әрекеттерімен үзіледі.',
        en: 'The period is interrupted by bringing an action and by acts of the obliged person evidencing acknowledgement of the debt.',
      },
    },
  ],
}

const penalty: MockAnswer = {
  id: 'penalty',
  match: [
    'неустойк', 'просрочк', 'пеня', 'штраф', 'оплат',
    'тұрақсыздық', 'айып', 'кешіктір', 'өсімпұл',
    'penalty', 'late', 'default', 'interest', 'forfeit',
  ],
  body: {
    ru: [
      'Неустойкой признаётся определённая законом или договором денежная сумма, которую должник обязан уплатить кредитору при просрочке исполнения, — ',
      { cite: 'ГК РК 293' },
      '. Кредитор не обязан доказывать причинение убытков: достаточно самого факта нарушения срока.\n\n',
      'Если размер неустойки в договоре не согласован, применяется законная неустойка. По денежному обязательству это ответственность за пользование чужими деньгами: сумма рассчитывается исходя из официальной ставки рефинансирования Национального Банка на день исполнения обязательства — ',
      { cite: 'ГК РК 353.1' },
      '. Начисление идёт за каждый день просрочки на сумму долга.\n\n',
      'Соглашение о неустойке требует письменной формы независимо от формы основного обязательства; несоблюдение влечёт недействительность соглашения о неустойке — ',
      { cite: 'ГК РК 294' },
      '. Поэтому переписка о «согласованной пене» без письменного условия в договоре обычно не работает.\n\n',
      'Суд вправе уменьшить неустойку, если она чрезмерно велика по сравнению с убытками кредитора, учитывая степень исполнения и заслуживающие внимания интересы сторон — ',
      { cite: 'ГК РК 297' },
      '. На практике снижение — самый частый исход спора о крупной договорной пене, поэтому расчёт стоит подкреплять доказательствами реальных потерь.',
    ],
    kz: [
      'Тұрақсыздық айыбы деп борышкер орындауды кешіктірген кезде кредиторға төлеуге міндетті, заңмен немесе шартпен айқындалған ақша сомасы танылады — ',
      { cite: 'ҚР АК 293' },
      '. Кредитор залал келтірілгенін дәлелдеуге міндетті емес: мерзімнің бұзылу фактісінің өзі жеткілікті.\n\n',
      'Шартта тұрақсыздық айыбының мөлшері келісілмесе, заңды тұрақсыздық айыбы қолданылады. Ақшалай міндеттеме бойынша бұл бөтен ақшаны пайдаланғаны үшін жауаптылық: сома міндеттеме орындалатын күнгі Ұлттық Банктің ресми қайта қаржыландыру мөлшерлемесі негізінде есептеледі — ',
      { cite: 'ҚР АК 353.1' },
      '. Есептеу борыш сомасына кешіктірілген әрбір күн үшін жүргізіледі.\n\n',
      'Тұрақсыздық айыбы туралы келісім негізгі міндеттеменің нысанына қарамастан жазбаша нысанды талап етеді; сақталмауы келісімнің жарамсыздығына әкеледі — ',
      { cite: 'ҚР АК 294' },
      '. Сондықтан шартта жазбаша талап болмаса, «келісілген өсімпұл» туралы хат алмасу әдетте жұмыс істемейді.\n\n',
      'Сот тұрақсыздық айыбы кредитордың залалымен салыстырғанда шектен тыс көп болса, орындалу дәрежесі мен тараптардың назар аударуға тұрарлық мүдделерін ескере отырып, оны азайтуға құқылы — ',
      { cite: 'ҚР АК 297' },
      '. Іс жүзінде азайту — ірі шарттық өсімпұл туралы даудың ең жиі нәтижесі, сондықтан есепті нақты шығын дәлелдерімен бекіткен жөн.',
    ],
    en: [
      'A penalty is a sum of money, fixed by law or by contract, which the debtor must pay the creditor upon delay in performance — ',
      { cite: 'CC RK 293' },
      '. The creditor need not prove any loss: the fact of the missed deadline is enough.\n\n',
      'If the contract fixes no rate, the statutory penalty applies. For a monetary obligation this is liability for the use of another person’s money: the amount is calculated on the official refinancing rate of the National Bank in force on the day of performance — ',
      { cite: 'CC RK 353.1' },
      '. It accrues on the outstanding sum for each day of delay.\n\n',
      'An agreement on a penalty must be in writing regardless of the form of the principal obligation; failure to observe this renders the penalty agreement void — ',
      { cite: 'CC RK 294' },
      '. Correspondence about an "agreed late fee" with no written contractual clause therefore rarely works.\n\n',
      'A court may reduce a penalty that is grossly disproportionate to the creditor’s loss, taking into account the degree of performance and the legitimate interests of the parties — ',
      { cite: 'CC RK 297' },
      '. In practice reduction is the most common outcome of a dispute over a large contractual penalty, so the calculation should be supported by evidence of actual loss.',
    ],
  },
  sources: [
    {
      code: 'ГК РК 293',
      doc: {
        ru: 'Гражданский кодекс РК (общая часть), статья 293',
        kz: 'ҚР Азаматтық кодексі (жалпы бөлім), 293-бап',
        en: 'Civil Code of the RK (general part), article 293',
      },
      excerpt: {
        ru: 'Неустойкой (штрафом, пеней) признаётся определённая законодательством или договором денежная сумма, которую должник обязан уплатить кредитору в случае неисполнения или ненадлежащего исполнения обязательства.',
        kz: 'Тұрақсыздық айыбы (айыппұл, өсімпұл) деп міндеттеме орындалмаған немесе тиісінше орындалмаған жағдайда борышкер кредиторға төлеуге міндетті, заңнамамен немесе шартпен айқындалған ақша сомасы танылады.',
        en: 'A penalty (fine, late fee) is a sum of money fixed by legislation or by contract which the debtor must pay the creditor in the event of non-performance or improper performance.',
      },
    },
    {
      code: 'ГК РК 297',
      doc: {
        ru: 'Гражданский кодекс РК (общая часть), статья 297',
        kz: 'ҚР Азаматтық кодексі (жалпы бөлім), 297-бап',
        en: 'Civil Code of the RK (general part), article 297',
      },
      excerpt: {
        ru: 'Если подлежащая уплате неустойка чрезмерно велика по сравнению с убытками кредитора, суд вправе уменьшить неустойку.',
        kz: 'Төленуге тиіс тұрақсыздық айыбы кредитордың залалымен салыстырғанда шектен тыс көп болса, сот тұрақсыздық айыбын азайтуға құқылы.',
        en: 'Where the penalty payable is grossly excessive compared with the creditor’s loss, the court may reduce the penalty.',
      },
    },
    {
      code: 'ГК РК 353.1',
      doc: {
        ru: 'Гражданский кодекс РК (общая часть), статья 353',
        kz: 'ҚР Азаматтық кодексі (жалпы бөлім), 353-бап',
        en: 'Civil Code of the RK (general part), article 353',
      },
      excerpt: {
        ru: 'За неправомерное пользование чужими деньгами подлежит уплате неустойка, размер которой исчисляется исходя из официальной ставки рефинансирования Национального Банка на день исполнения обязательства.',
        kz: 'Бөтен ақшаны заңсыз пайдаланғаны үшін міндеттеме орындалатын күнгі Ұлттық Банктің ресми қайта қаржыландыру мөлшерлемесі негізінде есептелетін тұрақсыздық айыбы төленуге тиіс.',
        en: 'Unlawful use of another’s money attracts a penalty calculated on the official refinancing rate of the National Bank as at the day of performance.',
      },
    },
  ],
}

const termination: MockAnswer = {
  id: 'termination',
  match: [
    'расторж', 'растор', 'односторон', 'аренд', 'договор',
    'бұзу', 'біржақты', 'жалдау', 'шарт',
    'terminat', 'rescis', 'unilateral', 'lease', 'contract',
  ],
  body: {
    ru: [
      'По общему правилу договор изменяется и расторгается по соглашению сторон — ',
      { cite: 'ГК РК 401.1' },
      '. Односторонний отказ допустим в двух случаях: когда он прямо предусмотрен законодательными актами и когда такое право стороны согласовали в самом договоре.\n\n',
      'Через суд договор расторгается по требованию одной стороны при существенном нарушении другой стороной. Существенным признаётся нарушение, влекущее для контрагента такой ущерб, что он в значительной степени лишается того, на что был вправе рассчитывать при заключении договора, — ',
      { cite: 'ГК РК 401.2' },
      '.\n\n',
      'Для договора аренды закон прямо называет основания досрочного расторжения по требованию арендодателя: пользование имуществом с существенным нарушением условий или назначения, существенное ухудшение имущества, невнесение платы более двух раз подряд по истечении срока платежа — ',
      { cite: 'ГК РК 556' },
      '. Арендатор, в свою очередь, вправе требовать расторжения, если имущество не передано или в нём обнаружились препятствующие пользованию недостатки — ',
      { cite: 'ГК РК 557' },
      '.\n\n',
      'Досудебный порядок обязателен: требование о расторжении заявляется в суд только после отказа другой стороны либо неполучения ответа в указанный в предложении срок, а при его отсутствии — в тридцатидневный срок — ',
      { cite: 'ГК РК 402.2' },
      '. Обязательства считаются прекращёнными с момента заключения соглашения о расторжении, а при судебном порядке — со дня вступления решения в законную силу.',
    ],
    kz: [
      'Жалпы ереже бойынша шарт тараптардың келісімімен өзгертіледі және бұзылады — ',
      { cite: 'ҚР АК 401.1' },
      '. Біржақты бас тартуға екі жағдайда жол беріледі: ол заңнамалық актілерде тікелей көзделгенде және тараптар мұндай құқықты шарттың өзінде келіскенде.\n\n',
      'Сот арқылы шарт екінші тарап оны елеулі түрде бұзған кезде бір тараптың талабы бойынша бұзылады. Контрагент шарт жасасу кезінде үміттенуге құқылы болған нәрседен айтарлықтай айырылатындай зиян келтіретін бұзушылық елеулі деп танылады — ',
      { cite: 'ҚР АК 401.2' },
      '.\n\n',
      'Жалдау шарты үшін заң жалға берушінің талабы бойынша мерзімінен бұрын бұзу негіздерін тікелей атайды: мүлікті шарт талаптарын немесе мақсатын елеулі бұза отырып пайдалану, мүлікті елеулі түрде нашарлату, төлем мерзімі өткеннен кейін ақыны қатарынан екі реттен артық енгізбеу — ',
      { cite: 'ҚР АК 556' },
      '. Жалға алушы, өз кезегінде, мүлік берілмесе не онда пайдалануға кедергі келтіретін кемшіліктер табылса, шартты бұзуды талап етуге құқылы — ',
      { cite: 'ҚР АК 557' },
      '.\n\n',
      'Сотқа дейінгі тәртіп міндетті: шартты бұзу туралы талап сотқа екінші тарап бас тартқаннан кейін не ұсыныста көрсетілген мерзімде, ол болмаса отыз күн ішінде жауап алынбаған соң ғана қойылады — ',
      { cite: 'ҚР АК 402.2' },
      '. Міндеттемелер бұзу туралы келісім жасалған кезден, ал сот тәртібінде — шешім заңды күшіне енген күннен бастап тоқтатылды деп есептеледі.',
    ],
    en: [
      'As a general rule a contract is amended or terminated by agreement of the parties — ',
      { cite: 'CC RK 401.1' },
      '. Unilateral withdrawal is permitted in two situations: where legislative acts expressly provide for it, and where the parties agreed such a right in the contract itself.\n\n',
      'Through the courts, a contract is terminated at the request of one party upon a material breach by the other. A breach is material where it causes the counterparty such damage that it is substantially deprived of what it was entitled to expect when concluding the contract — ',
      { cite: 'CC RK 401.2' },
      '.\n\n',
      'For leases the law expressly lists the grounds for early termination at the lessor’s request: use of the property in material breach of the terms or its designated purpose, material deterioration of the property, and failure to pay more than twice in succession after the payment date — ',
      { cite: 'CC RK 556' },
      '. The lessee, in turn, may seek termination if the property was not handed over or has defects preventing its use — ',
      { cite: 'CC RK 557' },
      '.\n\n',
      'A pre-action step is mandatory: a claim for termination may be filed only after the other party refuses, or fails to reply within the period stated in the proposal or, absent one, within thirty days — ',
      { cite: 'CC RK 402.2' },
      '. Obligations end when the termination agreement is concluded or, in court proceedings, on the day the judgment enters into legal force.',
    ],
  },
  sources: [
    {
      code: 'ГК РК 401.2',
      doc: {
        ru: 'Гражданский кодекс РК (общая часть), статья 401',
        kz: 'ҚР Азаматтық кодексі (жалпы бөлім), 401-бап',
        en: 'Civil Code of the RK (general part), article 401',
      },
      excerpt: {
        ru: 'По требованию одной из сторон договор может быть изменён или расторгнут по решению суда при существенном нарушении договора другой стороной.',
        kz: 'Тараптардың бірінің талабы бойынша шарт екінші тарап оны елеулі түрде бұзған кезде сот шешімімен өзгертілуі немесе бұзылуы мүмкін.',
        en: 'At the request of one party a contract may be amended or terminated by court decision upon a material breach by the other party.',
      },
    },
    {
      code: 'ГК РК 402.2',
      doc: {
        ru: 'Гражданский кодекс РК (общая часть), статья 402',
        kz: 'ҚР Азаматтық кодексі (жалпы бөлім), 402-бап',
        en: 'Civil Code of the RK (general part), article 402',
      },
      excerpt: {
        ru: 'Требование в суд может быть заявлено только после получения отказа другой стороны либо неполучения ответа в срок, указанный в предложении, а при его отсутствии — в тридцатидневный срок.',
        kz: 'Талап сотқа екінші тараптың бас тартуын алғаннан кейін не ұсыныста көрсетілген мерзімде, ол болмаған кезде отыз күн ішінде жауап алынбаған соң ғана қойылуы мүмкін.',
        en: 'A claim may be brought only after the other party’s refusal, or where no reply is received within the period stated in the proposal or, absent one, within thirty days.',
      },
    },
    {
      code: 'ГК РК 556',
      doc: {
        ru: 'Гражданский кодекс РК (особенная часть), статья 556',
        kz: 'ҚР Азаматтық кодексі (ерекше бөлім), 556-бап',
        en: 'Civil Code of the RK (special part), article 556',
      },
      excerpt: {
        ru: 'По требованию арендодателя договор аренды может быть расторгнут досрочно, если арендатор более двух раз подряд не вносит плату по истечении установленного срока платежа.',
        kz: 'Жалға берушінің талабы бойынша жалдау шарты, егер жалға алушы белгіленген төлем мерзімі өткеннен кейін ақыны қатарынан екі реттен артық енгізбесе, мерзімінен бұрын бұзылуы мүмкін.',
        en: 'At the lessor’s request a lease may be terminated early where the lessee fails to pay more than twice in succession after the due date.',
      },
    },
  ],
}

export const ANSWERS: MockAnswer[] = [limitation, penalty, termination]

/** Подбор заготовленного ответа по ключевым словам вопроса. */
export function pickAnswer(question: string, fallbackIndex: number): MockAnswer {
  const q = question.toLowerCase()
  const hit = ANSWERS.find((a) => a.match.some((m) => q.includes(m)))
  return hit ?? ANSWERS[fallbackIndex % ANSWERS.length]
}
