/* ============================================================
   TURA — конструктор договоров: данные экрана.

   Типы договоров, поля и разделы перенесены один в один из
   contracts/templates.py (9 типов) — это источник правды по содержанию.
   Разделы и результаты проверки замоканы, но юридически правдоподобны
   по праву Республики Казахстан.
   ============================================================ */

import type { Lang } from '../../i18n'
import type { StatusKind } from '../../shared/ui'

/** Строка на трёх языках. */
export type L10n = Record<Lang, string>

export function tr(v: L10n, lang: Lang): string {
  return v[lang] ?? v.ru
}

/* ------------------------------------------------------------
   Поля
   ------------------------------------------------------------ */

/** Подписи, которыми группируются поля формы. */
export type GroupId = 'parties' | 'subject' | 'money' | 'terms' | 'liability'

export const GROUP_ORDER: GroupId[] = ['parties', 'subject', 'money', 'terms', 'liability']

export const GROUP_LABEL: Record<GroupId, L10n> = {
  parties: { ru: 'Стороны', kz: 'Тараптар', en: 'Parties' },
  subject: { ru: 'Предмет', kz: 'Мәні', en: 'Subject' },
  money: {
    ru: 'Сумма и порядок оплаты',
    kz: 'Сома және төлем тәртібі',
    en: 'Amount and payment',
  },
  terms: { ru: 'Сроки', kz: 'Мерзімдер', en: 'Deadlines' },
  liability: { ru: 'Ответственность', kz: 'Жауапкершілік', en: 'Liability' },
}

export type FieldKind = 'text' | 'textarea' | 'number' | 'date' | 'select'

export interface FieldOption {
  value: string
  label: L10n
}

export interface FieldDef {
  name: string
  label: L10n
  kind: FieldKind
  required: boolean
  group: GroupId
  options?: FieldOption[]
}

/** Общие поля всех девяти типов (COMMON_FIELDS в templates.py). */
export const COMMON_FIELDS: FieldDef[] = [
  {
    name: 'party1_name',
    label: {
      ru: 'Наименование/ФИО Стороны 1',
      kz: '1-тарап атауы/аты-жөні',
      en: 'Party 1 name',
    },
    kind: 'text',
    required: true,
    group: 'parties',
  },
  {
    name: 'party1_iin_bin',
    label: { ru: 'ИИН/БИН Стороны 1', kz: '1-тарап ЖСН/БСН', en: 'Party 1 IIN/BIN' },
    kind: 'text',
    required: true,
    group: 'parties',
  },
  {
    name: 'party1_address',
    label: { ru: 'Адрес Стороны 1', kz: '1-тарап мекенжайы', en: 'Party 1 address' },
    kind: 'text',
    required: true,
    group: 'parties',
  },
  {
    name: 'party2_name',
    label: {
      ru: 'Наименование/ФИО Стороны 2',
      kz: '2-тарап атауы/аты-жөні',
      en: 'Party 2 name',
    },
    kind: 'text',
    required: true,
    group: 'parties',
  },
  {
    name: 'party2_iin_bin',
    label: { ru: 'ИИН/БИН Стороны 2', kz: '2-тарап ЖСН/БСН', en: 'Party 2 IIN/BIN' },
    kind: 'text',
    required: true,
    group: 'parties',
  },
  {
    name: 'party2_address',
    label: { ru: 'Адрес Стороны 2', kz: '2-тарап мекенжайы', en: 'Party 2 address' },
    kind: 'text',
    required: true,
    group: 'parties',
  },
  {
    name: 'city',
    label: { ru: 'Город', kz: 'Қала', en: 'City' },
    kind: 'text',
    required: true,
    group: 'terms',
  },
  {
    name: 'contract_date',
    label: { ru: 'Дата договора', kz: 'Шарт күні', en: 'Contract date' },
    kind: 'date',
    required: true,
    group: 'terms',
  },
]

/* ------------------------------------------------------------
   Разделы договора
   ------------------------------------------------------------ */

/**
 * Смысловой род раздела. Определяет, каким абзацем раздел
 * разворачивается в предпросмотре.
 */
export type SectionKind =
  | 'subject'
  | 'money'
  | 'term'
  | 'duties'
  | 'liability'
  | 'force'
  | 'disputes'
  | 'confid'
  | 'accept'
  | 'quality'
  | 'final'
  | 'requisites'
  | 'other'

interface SectionDef {
  title: L10n
  kind: SectionKind
}

/**
 * Названия разделов из templates.py, переведённые на три языка.
 * Ключ — русская строка, как она записана в шаблоне.
 */
export const SECTIONS: Record<string, SectionDef> = {
  'Предмет договора': {
    title: { ru: 'Предмет договора', kz: 'Шарттың мәні', en: 'Subject of the agreement' },
    kind: 'subject',
  },
  'Предмет соглашения': {
    title: { ru: 'Предмет соглашения', kz: 'Келісімнің мәні', en: 'Subject of the agreement' },
    kind: 'subject',
  },
  'Цена и порядок расчётов': {
    title: {
      ru: 'Цена и порядок расчётов',
      kz: 'Бағасы және есеп айырысу тәртібі',
      en: 'Price and settlement procedure',
    },
    kind: 'money',
  },
  'Условия передачи товара': {
    title: {
      ru: 'Условия передачи товара',
      kz: 'Тауарды беру шарттары',
      en: 'Terms of transfer of goods',
    },
    kind: 'accept',
  },
  'Качество и гарантии': {
    title: { ru: 'Качество и гарантии', kz: 'Сапасы және кепілдіктер', en: 'Quality and warranties' },
    kind: 'quality',
  },
  'Права и обязанности сторон': {
    title: {
      ru: 'Права и обязанности сторон',
      kz: 'Тараптардың құқықтары мен міндеттері',
      en: 'Rights and obligations of the parties',
    },
    kind: 'duties',
  },
  'Ответственность сторон': {
    title: {
      ru: 'Ответственность сторон',
      kz: 'Тараптардың жауапкершілігі',
      en: 'Liability of the parties',
    },
    kind: 'liability',
  },
  'Форс-мажор': {
    title: { ru: 'Форс-мажор', kz: 'Форс-мажор', en: 'Force majeure' },
    kind: 'force',
  },
  'Порядок разрешения споров': {
    title: {
      ru: 'Порядок разрешения споров',
      kz: 'Дауларды шешу тәртібі',
      en: 'Dispute resolution',
    },
    kind: 'disputes',
  },
  'Заключительные положения': {
    title: { ru: 'Заключительные положения', kz: 'Қорытынды ережелер', en: 'Final provisions' },
    kind: 'final',
  },
  'Реквизиты и подписи сторон': {
    title: {
      ru: 'Реквизиты и подписи сторон',
      kz: 'Тараптардың деректемелері мен қолдары',
      en: 'Details and signatures of the parties',
    },
    kind: 'requisites',
  },
  'Срок аренды': {
    title: { ru: 'Срок аренды', kz: 'Жалға алу мерзімі', en: 'Lease term' },
    kind: 'term',
  },
  'Арендная плата и порядок расчётов': {
    title: {
      ru: 'Арендная плата и порядок расчётов',
      kz: 'Жалдау ақысы және есеп айырысу тәртібі',
      en: 'Rent and settlement procedure',
    },
    kind: 'money',
  },
  'Права и обязанности арендодателя': {
    title: {
      ru: 'Права и обязанности арендодателя',
      kz: 'Жалға берушінің құқықтары мен міндеттері',
      en: 'Rights and obligations of the lessor',
    },
    kind: 'duties',
  },
  'Права и обязанности арендатора': {
    title: {
      ru: 'Права и обязанности арендатора',
      kz: 'Жалға алушының құқықтары мен міндеттері',
      en: 'Rights and obligations of the lessee',
    },
    kind: 'duties',
  },
  'Условия использования имущества': {
    title: {
      ru: 'Условия использования имущества',
      kz: 'Мүлікті пайдалану шарттары',
      en: 'Conditions of use of the property',
    },
    kind: 'other',
  },
  'Досрочное расторжение': {
    title: { ru: 'Досрочное расторжение', kz: 'Мерзімінен бұрын бұзу', en: 'Early termination' },
    kind: 'other',
  },
  'Перечень и объём услуг': {
    title: {
      ru: 'Перечень и объём услуг',
      kz: 'Қызметтердің тізбесі және көлемі',
      en: 'List and scope of services',
    },
    kind: 'subject',
  },
  'Сроки оказания услуг': {
    title: {
      ru: 'Сроки оказания услуг',
      kz: 'Қызмет көрсету мерзімдері',
      en: 'Service delivery deadlines',
    },
    kind: 'term',
  },
  'Стоимость и порядок оплаты': {
    title: {
      ru: 'Стоимость и порядок оплаты',
      kz: 'Құны және төлеу тәртібі',
      en: 'Cost and payment procedure',
    },
    kind: 'money',
  },
  'Порядок сдачи-приёмки услуг': {
    title: {
      ru: 'Порядок сдачи-приёмки услуг',
      kz: 'Қызметтерді тапсыру-қабылдау тәртібі',
      en: 'Service acceptance procedure',
    },
    kind: 'accept',
  },
  Конфиденциальность: {
    title: { ru: 'Конфиденциальность', kz: 'Құпиялылық', en: 'Confidentiality' },
    kind: 'confid',
  },
  'Срок действия договора': {
    title: {
      ru: 'Срок действия договора',
      kz: 'Шарттың қолданылу мерзімі',
      en: 'Term of the agreement',
    },
    kind: 'term',
  },
  'Условия труда и рабочее место': {
    title: {
      ru: 'Условия труда и рабочее место',
      kz: 'Еңбек жағдайлары және жұмыс орны',
      en: 'Working conditions and workplace',
    },
    kind: 'other',
  },
  'Режим работы и отдыха': {
    title: {
      ru: 'Режим работы и отдыха',
      kz: 'Жұмыс және демалыс режимі',
      en: 'Working and rest schedule',
    },
    kind: 'term',
  },
  'Оплата труда': {
    title: { ru: 'Оплата труда', kz: 'Еңбекақы төлеу', en: 'Remuneration' },
    kind: 'money',
  },
  'Права и обязанности работодателя': {
    title: {
      ru: 'Права и обязанности работодателя',
      kz: 'Жұмыс берушінің құқықтары мен міндеттері',
      en: 'Rights and obligations of the employer',
    },
    kind: 'duties',
  },
  'Права и обязанности работника': {
    title: {
      ru: 'Права и обязанности работника',
      kz: 'Қызметкердің құқықтары мен міндеттері',
      en: 'Rights and obligations of the employee',
    },
    kind: 'duties',
  },
  'Социальное страхование и гарантии': {
    title: {
      ru: 'Социальное страхование и гарантии',
      kz: 'Әлеуметтік сақтандыру және кепілдіктер',
      en: 'Social insurance and guarantees',
    },
    kind: 'other',
  },
  'Основания прекращения договора': {
    title: {
      ru: 'Основания прекращения договора',
      kz: 'Шартты тоқтату негіздері',
      en: 'Grounds for termination',
    },
    kind: 'other',
  },
  'Сумма и валюта займа': {
    title: {
      ru: 'Сумма и валюта займа',
      kz: 'Қарыз сомасы және валютасы',
      en: 'Loan amount and currency',
    },
    kind: 'money',
  },
  Проценты: {
    title: { ru: 'Проценты', kz: 'Сыйақы (пайыздар)', en: 'Interest' },
    kind: 'money',
  },
  'Порядок предоставления займа': {
    title: {
      ru: 'Порядок предоставления займа',
      kz: 'Қарызды беру тәртібі',
      en: 'Loan disbursement procedure',
    },
    kind: 'other',
  },
  'Порядок и сроки возврата': {
    title: {
      ru: 'Порядок и сроки возврата',
      kz: 'Қайтару тәртібі мен мерзімдері',
      en: 'Repayment procedure and deadlines',
    },
    kind: 'term',
  },
  'Обеспечение обязательств': {
    title: {
      ru: 'Обеспечение обязательств',
      kz: 'Міндеттемелерді қамтамасыз ету',
      en: 'Security for obligations',
    },
    kind: 'other',
  },
  'Количество и ассортимент': {
    title: {
      ru: 'Количество и ассортимент',
      kz: 'Саны және ассортименті',
      en: 'Quantity and assortment',
    },
    kind: 'subject',
  },
  'Качество и комплектность': {
    title: {
      ru: 'Качество и комплектность',
      kz: 'Сапасы және жиынтықтылығы',
      en: 'Quality and completeness',
    },
    kind: 'quality',
  },
  'Сроки и порядок поставки': {
    title: {
      ru: 'Сроки и порядок поставки',
      kz: 'Жеткізу мерзімдері мен тәртібі',
      en: 'Delivery deadlines and procedure',
    },
    kind: 'term',
  },
  'Тара и упаковка': {
    title: { ru: 'Тара и упаковка', kz: 'Ыдыс және қаптама', en: 'Containers and packaging' },
    kind: 'other',
  },
  'Приёмка товара': {
    title: { ru: 'Приёмка товара', kz: 'Тауарды қабылдау', en: 'Acceptance of goods' },
    kind: 'accept',
  },
  'Сроки выполнения работ': {
    title: {
      ru: 'Сроки выполнения работ',
      kz: 'Жұмыстарды орындау мерзімдері',
      en: 'Work deadlines',
    },
    kind: 'term',
  },
  'Порядок выполнения работ': {
    title: {
      ru: 'Порядок выполнения работ',
      kz: 'Жұмыстарды орындау тәртібі',
      en: 'Procedure for performing the works',
    },
    kind: 'other',
  },
  'Материалы и оборудование': {
    title: {
      ru: 'Материалы и оборудование',
      kz: 'Материалдар және жабдық',
      en: 'Materials and equipment',
    },
    kind: 'other',
  },
  'Сдача-приёмка работ': {
    title: {
      ru: 'Сдача-приёмка работ',
      kz: 'Жұмыстарды тапсыру-қабылдау',
      en: 'Acceptance of the works',
    },
    kind: 'accept',
  },
  'Гарантии качества': {
    title: { ru: 'Гарантии качества', kz: 'Сапа кепілдіктері', en: 'Quality warranties' },
    kind: 'quality',
  },
  'Права и обязанности заказчика': {
    title: {
      ru: 'Права и обязанности заказчика',
      kz: 'Тапсырыс берушінің құқықтары мен міндеттері',
      en: 'Rights and obligations of the client',
    },
    kind: 'duties',
  },
  'Права и обязанности подрядчика': {
    title: {
      ru: 'Права и обязанности подрядчика',
      kz: 'Мердігердің құқықтары мен міндеттері',
      en: 'Rights and obligations of the contractor',
    },
    kind: 'duties',
  },
  'Определение конфиденциальной информации': {
    title: {
      ru: 'Определение конфиденциальной информации',
      kz: 'Құпия ақпаратты айқындау',
      en: 'Definition of confidential information',
    },
    kind: 'confid',
  },
  'Исключения из конфиденциальной информации': {
    title: {
      ru: 'Исключения из конфиденциальной информации',
      kz: 'Құпия ақпараттан алып тасталатындар',
      en: 'Exclusions from confidential information',
    },
    kind: 'other',
  },
  'Обязательства принимающей стороны': {
    title: {
      ru: 'Обязательства принимающей стороны',
      kz: 'Қабылдаушы тараптың міндеттемелері',
      en: 'Obligations of the receiving party',
    },
    kind: 'duties',
  },
  'Срок действия обязательств': {
    title: {
      ru: 'Срок действия обязательств',
      kz: 'Міндеттемелердің қолданылу мерзімі',
      en: 'Term of the obligations',
    },
    kind: 'term',
  },
  'Порядок обращения с информацией': {
    title: {
      ru: 'Порядок обращения с информацией',
      kz: 'Ақпаратпен жұмыс істеу тәртібі',
      en: 'Information handling procedure',
    },
    kind: 'confid',
  },
  'Ответственность за нарушение': {
    title: {
      ru: 'Ответственность за нарушение',
      kz: 'Бұзғаны үшін жауапкершілік',
      en: 'Liability for breach',
    },
    kind: 'liability',
  },
  'Полномочия агента': {
    title: { ru: 'Полномочия агента', kz: 'Агенттің өкілеттіктері', en: 'Powers of the agent' },
    kind: 'subject',
  },
  'Вознаграждение агента': {
    title: {
      ru: 'Вознаграждение агента',
      kz: 'Агенттің сыйақысы',
      en: "Agent's remuneration",
    },
    kind: 'money',
  },
  'Порядок оказания и отчётности': {
    title: {
      ru: 'Порядок оказания и отчётности',
      kz: 'Көрсету және есеп беру тәртібі',
      en: 'Performance and reporting procedure',
    },
    kind: 'accept',
  },
  'Права и обязанности принципала': {
    title: {
      ru: 'Права и обязанности принципала',
      kz: 'Принципалдың құқықтары мен міндеттері',
      en: 'Rights and obligations of the principal',
    },
    kind: 'duties',
  },
  'Права и обязанности агента': {
    title: {
      ru: 'Права и обязанности агента',
      kz: 'Агенттің құқықтары мен міндеттері',
      en: 'Rights and obligations of the agent',
    },
    kind: 'duties',
  },
  'Срок действия и расторжение': {
    title: {
      ru: 'Срок действия и расторжение',
      kz: 'Қолданылу мерзімі және бұзу',
      en: 'Term and termination',
    },
    kind: 'term',
  },
}

/**
 * Абзацы предпросмотра по роду раздела.
 * Подстановки: {p1} {p2} {subject} {amount} {term} {legal}.
 */
export const PARAGRAPHS: Record<SectionKind, L10n> = {
  subject: {
    ru: 'Стороны определили предметом настоящего договора следующее: {subject}. Иные характеристики согласовываются сторонами в приложениях, являющихся неотъемлемой частью договора.',
    kz: 'Тараптар осы шарттың мәні ретінде мыналарды айқындады: {subject}. Өзге сипаттамалар шарттың ажырамас бөлігі болып табылатын қосымшаларда тараптармен келісіледі.',
    en: 'The parties have defined the subject of this agreement as follows: {subject}. Other characteristics are agreed by the parties in annexes forming an integral part of the agreement.',
  },
  money: {
    ru: 'Общая сумма договора составляет {amount}. Оплата производится в безналичном порядке в течение 10 (десяти) банковских дней с даты подписания сторонами соответствующего документа. Обязательство по оплате считается исполненным с момента зачисления средств на счёт получателя.',
    kz: 'Шарттың жалпы сомасы {amount} құрайды. Төлем тиісті құжатқа тараптар қол қойған күннен бастап 10 (он) банктік күн ішінде қолма-қол ақшасыз тәртіппен жүргізіледі. Төлем міндеттемесі қаражат алушының шотына түскен сәттен бастап орындалды деп есептеледі.',
    en: 'The total amount of the agreement is {amount}. Payment is made by bank transfer within 10 (ten) banking days from the date the parties sign the relevant document. The payment obligation is deemed performed once the funds are credited to the recipient account.',
  },
  term: {
    ru: 'Срок: {term}. Сроки изменяются только письменным соглашением сторон, оформленным дополнительным соглашением к настоящему договору.',
    kz: 'Мерзімі: {term}. Мерзімдер тек тараптардың жазбаша келісімімен, осы шартқа қосымша келісім түрінде ресімделіп өзгертіледі.',
    en: 'Term: {term}. Deadlines may be changed only by written agreement of the parties executed as an addendum to this agreement.',
  },
  duties: {
    ru: 'Стороны обязуются добросовестно исполнять принятые обязательства, своевременно передавать друг другу документы и сведения, необходимые для исполнения договора, и незамедлительно уведомлять об обстоятельствах, препятствующих исполнению.',
    kz: 'Тараптар қабылданған міндеттемелерді адал орындауға, шартты орындау үшін қажетті құжаттар мен мәліметтерді бір-біріне уақтылы беруге және орындауға кедергі келтіретін мән-жайлар туралы дереу хабарлауға міндеттенеді.',
    en: 'The parties undertake to perform their obligations in good faith, to provide each other in due time with the documents and information required for performance, and to notify each other without delay of circumstances impeding performance.',
  },
  liability: {
    ru: 'За нарушение сроков исполнения виновная сторона уплачивает неустойку в размере 0,1 % от суммы неисполненного обязательства за каждый день просрочки, но не более 10 % такой суммы. Ответственность сторон является встречной. Уплата неустойки не освобождает от исполнения обязательства в натуре.',
    kz: 'Орындау мерзімін бұзғаны үшін кінәлі тарап орындалмаған міндеттеме сомасының 0,1 % мөлшерінде әрбір кешіктірілген күн үшін, бірақ осы соманың 10 %-ынан аспайтын тұрақсыздық айыбын төлейді. Тараптардың жауапкершілігі өзара болып табылады. Тұрақсыздық айыбын төлеу міндеттемені заттай орындаудан босатпайды.',
    en: 'For breach of deadlines, the party at fault pays a penalty of 0.1 % of the unperformed obligation for each day of delay, but not more than 10 % of that amount. Liability of the parties is mutual. Payment of the penalty does not release a party from performance in kind.',
  },
  force: {
    ru: 'Стороны освобождаются от ответственности за неисполнение обязательств, если оно вызвано обстоятельствами непреодолимой силы. Изменение курса валют, финансовое положение стороны и действия её контрагентов обстоятельствами непреодолимой силы не признаются.',
    kz: 'Еңсерілмейтін күш мән-жайларынан туындаған міндеттемелерді орындамағаны үшін тараптар жауапкершіліктен босатылады. Валюта бағамының өзгеруі, тараптың қаржылық жағдайы және оның контрагенттерінің әрекеттері еңсерілмейтін күш мән-жайлары деп танылмайды.',
    en: 'The parties are released from liability for non-performance caused by force majeure. Exchange-rate movements, a party financial position and the acts of its counterparties are not recognised as force majeure.',
  },
  disputes: {
    ru: 'Споры разрешаются путём переговоров. Претензия рассматривается в течение 15 (пятнадцати) календарных дней с даты получения. При недостижении согласия спор передаётся на разрешение суда по месту нахождения ответчика в соответствии с законодательством Республики Казахстан.',
    kz: 'Даулар келіссөздер жолымен шешіледі. Талап-арыз алынған күннен бастап 15 (он бес) күнтізбелік күн ішінде қаралады. Келісімге қол жеткізілмеген жағдайда дау Қазақстан Республикасының заңнамасына сәйкес жауапкердің орналасқан жері бойынша сотқа беріледі.',
    en: 'Disputes are settled through negotiations. A claim is considered within 15 (fifteen) calendar days of receipt. Failing agreement, the dispute is referred to the court at the location of the defendant under the laws of the Republic of Kazakhstan.',
  },
  confid: {
    ru: 'Стороны не разглашают ставшие им известными сведения, составляющие коммерческую тайну другой стороны, и используют их исключительно в целях исполнения настоящего договора.',
    kz: 'Тараптар екінші тараптың коммерциялық құпиясын құрайтын, өздеріне белгілі болған мәліметтерді жарияламайды және оларды тек осы шартты орындау мақсатында пайдаланады.',
    en: 'The parties do not disclose information constituting the trade secret of the other party and use it solely for the performance of this agreement.',
  },
  accept: {
    ru: 'Результат передаётся по акту, подписываемому обеими сторонами. Принимающая сторона рассматривает акт и подписывает его либо направляет мотивированный отказ в течение 5 (пяти) рабочих дней.',
    kz: 'Нәтиже екі тарап қол қоятын акт бойынша тапсырылады. Қабылдаушы тарап актіні қарап, оған қол қояды не 5 (бес) жұмыс күні ішінде дәлелді бас тартуды жібереді.',
    en: 'The result is handed over under an act signed by both parties. The receiving party reviews the act and signs it or sends a reasoned refusal within 5 (five) business days.',
  },
  quality: {
    ru: 'Качество должно соответствовать требованиям законодательства Республики Казахстан, применимым техническим регламентам и обычно предъявляемым требованиям. Гарантийный срок исчисляется с даты подписания акта.',
    kz: 'Сапа Қазақстан Республикасы заңнамасының талаптарына, қолданылатын техникалық регламенттерге және әдетте қойылатын талаптарға сәйкес болуға тиіс. Кепілдік мерзімі акт қол қойылған күннен бастап есептеледі.',
    en: 'Quality must comply with the laws of the Republic of Kazakhstan, applicable technical regulations and requirements ordinarily imposed. The warranty period runs from the date the act is signed.',
  },
  final: {
    ru: 'Договор вступает в силу с даты подписания и действует до полного исполнения сторонами обязательств. Составлен в двух экземплярах равной юридической силы, по одному для каждой стороны. Изменения и дополнения оформляются письменно.',
    kz: 'Шарт қол қойылған күннен бастап күшіне енеді және тараптар міндеттемелерін толық орындағанға дейін қолданылады. Тең заңды күші бар екі данада, әр тарапқа бір данадан жасалды. Өзгерістер мен толықтырулар жазбаша ресімделеді.',
    en: 'The agreement enters into force upon signing and remains in effect until the parties have fully performed their obligations. Executed in two counterparts of equal legal force, one for each party. Amendments are made in writing.',
  },
  requisites: {
    ru: 'Сторона 1 — {p1}. Сторона 2 — {p2}. Банковские реквизиты и подписи уполномоченных представителей приводятся в конце документа.',
    kz: '1-тарап — {p1}. 2-тарап — {p2}. Банктік деректемелер мен уәкілетті өкілдердің қолдары құжаттың соңында келтіріледі.',
    en: 'Party 1 — {p1}. Party 2 — {p2}. Bank details and the signatures of authorised representatives are set out at the end of the document.',
  },
  other: {
    ru: 'Условия раздела определяются сторонами и не противоречат требованиям, установленным источником: {legal}.',
    kz: 'Бөлімнің талаптарын тараптар айқындайды және олар мына дереккөзде белгіленген талаптарға қайшы келмейді: {legal}.',
    en: 'The terms of this section are determined by the parties and do not contradict the requirements of: {legal}.',
  },
}

/* ------------------------------------------------------------
   Нормы
   ------------------------------------------------------------ */

export interface NormRef {
  /** Короткая координата для <Cite>. */
  code: string
  note: L10n
}

/* ------------------------------------------------------------
   Типы договоров
   ------------------------------------------------------------ */

export interface ContractType {
  id: string
  name: L10n
  description: L10n
  legalBasis: L10n
  sections: string[]
  fields: FieldDef[]
  norms: NormRef[]
}

export const CONTRACT_TYPES: ContractType[] = [
  {
    id: 'sale',
    name: { ru: 'Купля-продажа', kz: 'Сатып алу-сату', en: 'Sale and purchase' },
    description: {
      ru: 'Товары, имущество или имущественные права',
      kz: 'Тауарлар, мүлік немесе мүліктік құқықтар',
      en: 'Goods, property or property rights',
    },
    legalBasis: {
      ru: 'ГК РК, Особенная часть, глава 25',
      kz: 'ҚР АК, Ерекше бөлім, 25-тарау',
      en: 'Civil Code of Kazakhstan, Special Part, chapter 25',
    },
    sections: [
      'Предмет договора',
      'Цена и порядок расчётов',
      'Условия передачи товара',
      'Качество и гарантии',
      'Права и обязанности сторон',
      'Ответственность сторон',
      'Форс-мажор',
      'Порядок разрешения споров',
      'Заключительные положения',
      'Реквизиты и подписи сторон',
    ],
    fields: [
      {
        name: 'subject',
        label: {
          ru: 'Предмет договора (описание товара)',
          kz: 'Шарт мәні (тауар сипаттамасы)',
          en: 'Subject (goods description)',
        },
        kind: 'textarea',
        required: true,
        group: 'subject',
      },
      {
        name: 'price',
        label: { ru: 'Цена (тенге)', kz: 'Бағасы (теңге)', en: 'Price (KZT)' },
        kind: 'number',
        required: true,
        group: 'money',
      },
      {
        name: 'payment_terms',
        label: { ru: 'Порядок оплаты', kz: 'Төлем тәртібі', en: 'Payment terms' },
        kind: 'select',
        required: true,
        group: 'money',
        options: [
          {
            value: 'prepayment',
            label: { ru: 'Предоплата 100%', kz: 'Алдын ала 100% төлем', en: '100% prepayment' },
          },
          {
            value: 'postpayment',
            label: {
              ru: 'Оплата после передачи',
              kz: 'Тапсырғаннан кейін төлем',
              en: 'Payment after delivery',
            },
          },
          { value: 'installment', label: { ru: 'Рассрочка', kz: 'Бөліп төлеу', en: 'Installment' } },
          {
            value: 'partial_prepayment',
            label: {
              ru: 'Частичная предоплата',
              kz: 'Ішінара алдын ала төлем',
              en: 'Partial prepayment',
            },
          },
        ],
      },
      {
        name: 'delivery_terms',
        label: {
          ru: 'Условия передачи товара',
          kz: 'Тауарды тапсыру шарттары',
          en: 'Delivery terms',
        },
        kind: 'textarea',
        required: true,
        group: 'terms',
      },
      {
        name: 'warranty',
        label: { ru: 'Гарантийный срок', kz: 'Кепілдік мерзімі', en: 'Warranty period' },
        kind: 'text',
        required: false,
        group: 'liability',
      },
    ],
    norms: [
      {
        code: 'ГК РК 406',
        note: {
          ru: 'Понятие договора купли-продажи: продавец передаёт вещь в собственность, покупатель принимает и оплачивает.',
          kz: 'Сатып алу-сату шартының ұғымы: сатушы затты меншікке береді, сатып алушы қабылдап, ақысын төлейді.',
          en: 'Concept of the sale contract: the seller transfers title, the buyer accepts and pays.',
        },
      },
      {
        code: 'ГК РК 422',
        note: {
          ru: 'Качество товара: соответствие условиям договора, а при их отсутствии — обычно предъявляемым требованиям.',
          kz: 'Тауар сапасы: шарт талаптарына, ал олар болмағанда әдетте қойылатын талаптарға сәйкестік.',
          en: 'Quality of goods: conformity with the contract, and failing that, with requirements ordinarily imposed.',
        },
      },
      {
        code: 'ГК РК 439',
        note: {
          ru: 'Оплата товара: срок и порядок расчётов, последствия просрочки оплаты.',
          kz: 'Тауар ақысын төлеу: есеп айырысу мерзімі мен тәртібі, төлемді кешіктіру салдары.',
          en: 'Payment for goods: time and procedure of settlement, consequences of late payment.',
        },
      },
    ],
  },
  {
    id: 'lease',
    name: { ru: 'Аренда', kz: 'Жалға алу', en: 'Lease' },
    description: {
      ru: 'Недвижимость, оборудование, транспорт',
      kz: 'Жылжымайтын мүлік, жабдық, көлік',
      en: 'Real estate, equipment, transport',
    },
    legalBasis: {
      ru: 'ГК РК, Особенная часть, глава 29',
      kz: 'ҚР АК, Ерекше бөлім, 29-тарау',
      en: 'Civil Code of Kazakhstan, Special Part, chapter 29',
    },
    sections: [
      'Предмет договора',
      'Срок аренды',
      'Арендная плата и порядок расчётов',
      'Права и обязанности арендодателя',
      'Права и обязанности арендатора',
      'Условия использования имущества',
      'Ответственность сторон',
      'Досрочное расторжение',
      'Форс-мажор',
      'Порядок разрешения споров',
      'Заключительные положения',
      'Реквизиты и подписи сторон',
    ],
    fields: [
      {
        name: 'property_description',
        label: { ru: 'Описание имущества', kz: 'Мүлік сипаттамасы', en: 'Property description' },
        kind: 'textarea',
        required: true,
        group: 'subject',
      },
      {
        name: 'purpose',
        label: { ru: 'Цели использования', kz: 'Пайдалану мақсаттары', en: 'Purpose of use' },
        kind: 'text',
        required: true,
        group: 'subject',
      },
      {
        name: 'rent_amount',
        label: {
          ru: 'Арендная плата (тенге/мес)',
          kz: 'Жалдау ақысы (теңге/ай)',
          en: 'Rent (KZT/month)',
        },
        kind: 'number',
        required: true,
        group: 'money',
      },
      {
        name: 'deposit',
        label: {
          ru: 'Обеспечительный депозит (тенге)',
          kz: 'Кепілдік депозит (теңге)',
          en: 'Security deposit (KZT)',
        },
        kind: 'number',
        required: false,
        group: 'money',
      },
      {
        name: 'lease_term',
        label: { ru: 'Срок аренды', kz: 'Жалға алу мерзімі', en: 'Lease term' },
        kind: 'text',
        required: true,
        group: 'terms',
      },
    ],
    norms: [
      {
        code: 'ГК РК 540',
        note: {
          ru: 'Договор имущественного найма: наймодатель предоставляет имущество во временное владение и пользование.',
          kz: 'Мүліктік жалдау шарты: жалға беруші мүлікті уақытша иеленуге және пайдалануға береді.',
          en: 'Lease contract: the lessor provides property for temporary possession and use.',
        },
      },
      {
        code: 'ГК РК 545',
        note: {
          ru: 'Срок договора имущественного найма; последствия его отсутствия в тексте.',
          kz: 'Мүліктік жалдау шартының мерзімі; оның мәтінде болмауының салдары.',
          en: 'Term of the lease; consequences where the text omits it.',
        },
      },
      {
        code: 'ГК РК 546',
        note: {
          ru: 'Плата за пользование имуществом: форма, размер и порядок пересмотра.',
          kz: 'Мүлікті пайдаланғаны үшін ақы: нысаны, мөлшері және қайта қарау тәртібі.',
          en: 'Payment for use of the property: form, amount and revision procedure.',
        },
      },
    ],
  },
  {
    id: 'services',
    name: { ru: 'Оказание услуг', kz: 'Қызмет көрсету', en: 'Services' },
    description: {
      ru: 'Возмездное оказание услуг',
      kz: 'Ақылы қызмет көрсету',
      en: 'Paid services',
    },
    legalBasis: {
      ru: 'ГК РК, Особенная часть, глава 33',
      kz: 'ҚР АК, Ерекше бөлім, 33-тарау',
      en: 'Civil Code of Kazakhstan, Special Part, chapter 33',
    },
    sections: [
      'Предмет договора',
      'Перечень и объём услуг',
      'Сроки оказания услуг',
      'Стоимость и порядок оплаты',
      'Порядок сдачи-приёмки услуг',
      'Права и обязанности сторон',
      'Ответственность сторон',
      'Конфиденциальность',
      'Форс-мажор',
      'Порядок разрешения споров',
      'Заключительные положения',
      'Реквизиты и подписи сторон',
    ],
    fields: [
      {
        name: 'service_description',
        label: { ru: 'Описание услуг', kz: 'Қызметтер сипаттамасы', en: 'Service description' },
        kind: 'textarea',
        required: true,
        group: 'subject',
      },
      {
        name: 'service_cost',
        label: {
          ru: 'Стоимость услуг (тенге)',
          kz: 'Қызмет құны (теңге)',
          en: 'Service cost (KZT)',
        },
        kind: 'number',
        required: true,
        group: 'money',
      },
      {
        name: 'service_term',
        label: { ru: 'Срок оказания услуг', kz: 'Қызмет көрсету мерзімі', en: 'Service term' },
        kind: 'text',
        required: true,
        group: 'terms',
      },
      {
        name: 'acceptance_procedure',
        label: { ru: 'Порядок приёмки', kz: 'Қабылдау тәртібі', en: 'Acceptance procedure' },
        kind: 'select',
        required: true,
        group: 'terms',
        options: [
          {
            value: 'act',
            label: {
              ru: 'Акт выполненных работ',
              kz: 'Орындалған жұмыстар актісі',
              en: 'Completion act',
            },
          },
          {
            value: 'report',
            label: {
              ru: 'Отчёт об оказании услуг',
              kz: 'Қызмет көрсету туралы есеп',
              en: 'Service report',
            },
          },
          {
            value: 'auto',
            label: {
              ru: 'Автоматическая приёмка',
              kz: 'Автоматты қабылдау',
              en: 'Automatic acceptance',
            },
          },
        ],
      },
    ],
    norms: [
      {
        code: 'ГК РК 683',
        note: {
          ru: 'Договор возмездного оказания услуг: исполнитель обязуется оказать услуги, заказчик — оплатить их.',
          kz: 'Ақылы қызмет көрсету шарты: орындаушы қызмет көрсетуге, тапсырыс беруші ақысын төлеуге міндеттенеді.',
          en: 'Paid services contract: the provider renders services, the client pays for them.',
        },
      },
      {
        code: 'ГК РК 686',
        note: {
          ru: 'Оплата услуг: сроки и порядок, последствия невозможности исполнения.',
          kz: 'Қызмет ақысын төлеу: мерзімдері мен тәртібі, орындау мүмкін болмауының салдары.',
          en: 'Payment for services: timing and procedure, consequences of impossibility of performance.',
        },
      },
      {
        code: 'ГК РК 293',
        note: {
          ru: 'Неустойка: определённая законом или договором денежная сумма за неисполнение обязательства.',
          kz: 'Тұрақсыздық айыбы: міндеттемені орындамағаны үшін заңмен немесе шартпен белгіленген ақша сомасы.',
          en: 'Penalty: a sum fixed by law or contract for non-performance of an obligation.',
        },
      },
    ],
  },
  {
    id: 'employment',
    name: { ru: 'Трудовой договор', kz: 'Еңбек шарты', en: 'Employment contract' },
    description: {
      ru: 'Между работодателем и работником',
      kz: 'Жұмыс беруші мен қызметкер арасында',
      en: 'Between employer and employee',
    },
    legalBasis: {
      ru: 'ТК РК, глава 4',
      kz: 'ҚР ЕК, 4-тарау',
      en: 'Labour Code of Kazakhstan, chapter 4',
    },
    sections: [
      'Предмет договора',
      'Срок действия договора',
      'Условия труда и рабочее место',
      'Режим работы и отдыха',
      'Оплата труда',
      'Права и обязанности работодателя',
      'Права и обязанности работника',
      'Социальное страхование и гарантии',
      'Ответственность сторон',
      'Основания прекращения договора',
      'Заключительные положения',
      'Реквизиты и подписи сторон',
    ],
    fields: [
      {
        name: 'position',
        label: { ru: 'Должность', kz: 'Лауазым', en: 'Position' },
        kind: 'text',
        required: true,
        group: 'subject',
      },
      {
        name: 'salary',
        label: {
          ru: 'Заработная плата (тенге/мес)',
          kz: 'Жалақы (теңге/ай)',
          en: 'Salary (KZT/month)',
        },
        kind: 'number',
        required: true,
        group: 'money',
      },
      {
        name: 'start_date',
        label: { ru: 'Дата начала работы', kz: 'Жұмыс басталу күні', en: 'Start date' },
        kind: 'date',
        required: true,
        group: 'terms',
      },
      {
        name: 'work_schedule',
        label: { ru: 'Режим работы', kz: 'Жұмыс кестесі', en: 'Work schedule' },
        kind: 'select',
        required: true,
        group: 'terms',
        options: [
          {
            value: 'standard',
            label: {
              ru: 'Стандартный (5/2, 8 часов)',
              kz: 'Стандартты (5/2, 8 сағат)',
              en: 'Standard (5/2, 8 hours)',
            },
          },
          { value: 'shift', label: { ru: 'Сменный', kz: 'Ауысымдық', en: 'Shift work' } },
          { value: 'flexible', label: { ru: 'Гибкий', kz: 'Икемді', en: 'Flexible' } },
          { value: 'remote', label: { ru: 'Дистанционный', kz: 'Қашықтықтан', en: 'Remote' } },
        ],
      },
      {
        name: 'probation',
        label: { ru: 'Испытательный срок', kz: 'Сынақ мерзімі', en: 'Probation period' },
        kind: 'select',
        required: false,
        group: 'terms',
        options: [
          {
            value: 'none',
            label: {
              ru: 'Без испытательного срока',
              kz: 'Сынақ мерзімісіз',
              en: 'No probation',
            },
          },
          { value: '1month', label: { ru: '1 месяц', kz: '1 ай', en: '1 month' } },
          { value: '2months', label: { ru: '2 месяца', kz: '2 ай', en: '2 months' } },
          { value: '3months', label: { ru: '3 месяца', kz: '3 ай', en: '3 months' } },
        ],
      },
      {
        name: 'vacation_days',
        label: {
          ru: 'Оплачиваемый отпуск (календарных дней)',
          kz: 'Ақылы демалыс (күнтізбелік күн)',
          en: 'Paid vacation (calendar days)',
        },
        kind: 'number',
        required: false,
        group: 'liability',
      },
    ],
    norms: [
      {
        code: 'ТК РК 28',
        note: {
          ru: 'Содержание трудового договора: обязательные условия, без которых договор считается незаключённым.',
          kz: 'Еңбек шартының мазмұны: онсыз шарт жасалмаған деп есептелетін міндетті талаптар.',
          en: 'Content of the employment contract: mandatory terms without which it is not concluded.',
        },
      },
      {
        code: 'ТК РК 30',
        note: {
          ru: 'Срок трудового договора: основания заключения срочного договора.',
          kz: 'Еңбек шартының мерзімі: мерзімді шарт жасасу негіздері.',
          en: 'Duration of the employment contract: grounds for a fixed-term contract.',
        },
      },
      {
        code: 'ТК РК 36',
        note: {
          ru: 'Испытательный срок: предельная продолжительность и лица, которым он не устанавливается.',
          kz: 'Сынақ мерзімі: шекті ұзақтығы және ол белгіленбейтін адамдар.',
          en: 'Probation period: maximum length and persons exempt from it.',
        },
      },
      {
        code: 'ТК РК 113',
        note: {
          ru: 'Сроки и порядок выплаты заработной платы, ответственность за задержку.',
          kz: 'Жалақыны төлеу мерзімдері мен тәртібі, кешіктіргені үшін жауапкершілік.',
          en: 'Time and procedure of wage payment, liability for delay.',
        },
      },
    ],
  },
  {
    id: 'loan',
    name: { ru: 'Займ', kz: 'Қарыз', en: 'Loan' },
    description: {
      ru: 'Займ денежных средств',
      kz: 'Ақшалай қаражат қарызы',
      en: 'Monetary loan',
    },
    legalBasis: {
      ru: 'ГК РК, Особенная часть, глава 36',
      kz: 'ҚР АК, Ерекше бөлім, 36-тарау',
      en: 'Civil Code of Kazakhstan, Special Part, chapter 36',
    },
    sections: [
      'Предмет договора',
      'Сумма и валюта займа',
      'Проценты',
      'Порядок предоставления займа',
      'Порядок и сроки возврата',
      'Права и обязанности сторон',
      'Ответственность сторон',
      'Обеспечение обязательств',
      'Форс-мажор',
      'Порядок разрешения споров',
      'Заключительные положения',
      'Реквизиты и подписи сторон',
    ],
    fields: [
      {
        name: 'loan_amount',
        label: { ru: 'Сумма займа (тенге)', kz: 'Қарыз сомасы (теңге)', en: 'Loan amount (KZT)' },
        kind: 'number',
        required: true,
        group: 'money',
      },
      {
        name: 'interest_rate',
        label: {
          ru: 'Процентная ставка (% годовых)',
          kz: 'Пайыздық мөлшерлеме (% жылдық)',
          en: 'Interest rate (% p.a.)',
        },
        kind: 'number',
        required: true,
        group: 'money',
      },
      {
        name: 'repayment_schedule',
        label: { ru: 'График погашения', kz: 'Өтеу кестесі', en: 'Repayment schedule' },
        kind: 'select',
        required: true,
        group: 'money',
        options: [
          {
            value: 'lump_sum',
            label: {
              ru: 'Единовременно в конце срока',
              kz: 'Мерзім соңында бір жолғы',
              en: 'Lump sum at end',
            },
          },
          {
            value: 'monthly',
            label: {
              ru: 'Ежемесячно равными долями',
              kz: 'Ай сайын тең үлестермен',
              en: 'Monthly equal installments',
            },
          },
          { value: 'quarterly', label: { ru: 'Ежеквартально', kz: 'Тоқсан сайын', en: 'Quarterly' } },
        ],
      },
      {
        name: 'loan_term',
        label: { ru: 'Срок займа', kz: 'Қарыз мерзімі', en: 'Loan term' },
        kind: 'text',
        required: true,
        group: 'terms',
      },
      {
        name: 'collateral',
        label: {
          ru: 'Обеспечение (залог/поручительство)',
          kz: 'Қамтамасыз ету (кепіл/кепілдік)',
          en: 'Collateral (pledge/surety)',
        },
        kind: 'textarea',
        required: false,
        group: 'liability',
      },
    ],
    norms: [
      {
        code: 'ГК РК 715',
        note: {
          ru: 'Договор займа: заимодатель передаёт деньги, заёмщик обязуется их возвратить.',
          kz: 'Қарыз шарты: қарыз беруші ақшаны береді, қарыз алушы оны қайтаруға міндеттенеді.',
          en: 'Loan contract: the lender transfers money, the borrower undertakes to return it.',
        },
      },
      {
        code: 'ГК РК 718',
        note: {
          ru: 'Вознаграждение по договору займа: размер и порядок выплаты процентов.',
          kz: 'Қарыз шарты бойынша сыйақы: пайыздардың мөлшері және төлеу тәртібі.',
          en: 'Remuneration under the loan: amount and payment of interest.',
        },
      },
      {
        code: 'ГК РК 722',
        note: {
          ru: 'Обязанность заёмщика возвратить предмет займа в срок и в порядке, установленных договором.',
          kz: 'Қарыз алушының қарыз нысанасын шартта белгіленген мерзімде және тәртіппен қайтару міндеті.',
          en: 'Duty of the borrower to repay within the period and in the manner set by the contract.',
        },
      },
    ],
  },
  {
    id: 'supply',
    name: { ru: 'Поставка', kz: 'Жеткізу', en: 'Supply' },
    description: {
      ru: 'Товары для предпринимательской деятельности',
      kz: 'Кәсіпкерлік қызметке арналған тауарлар',
      en: 'Goods for business activity',
    },
    legalBasis: {
      ru: 'ГК РК, Особенная часть, глава 25',
      kz: 'ҚР АК, Ерекше бөлім, 25-тарау',
      en: 'Civil Code of Kazakhstan, Special Part, chapter 25',
    },
    sections: [
      'Предмет договора',
      'Количество и ассортимент',
      'Качество и комплектность',
      'Сроки и порядок поставки',
      'Цена и порядок расчётов',
      'Тара и упаковка',
      'Приёмка товара',
      'Права и обязанности сторон',
      'Ответственность сторон',
      'Форс-мажор',
      'Порядок разрешения споров',
      'Заключительные положения',
      'Реквизиты и подписи сторон',
    ],
    fields: [
      {
        name: 'goods_description',
        label: {
          ru: 'Наименование и описание товаров',
          kz: 'Тауарлардың атауы және сипаттамасы',
          en: 'Goods description',
        },
        kind: 'textarea',
        required: true,
        group: 'subject',
      },
      {
        name: 'total_amount',
        label: {
          ru: 'Общая сумма поставки (тенге)',
          kz: 'Жеткізудің жалпы сомасы (теңге)',
          en: 'Total supply amount (KZT)',
        },
        kind: 'number',
        required: true,
        group: 'money',
      },
      {
        name: 'delivery_schedule',
        label: { ru: 'График поставки', kz: 'Жеткізу кестесі', en: 'Delivery schedule' },
        kind: 'textarea',
        required: true,
        group: 'terms',
      },
      {
        name: 'delivery_address',
        label: { ru: 'Адрес доставки', kz: 'Жеткізу мекенжайы', en: 'Delivery address' },
        kind: 'text',
        required: true,
        group: 'terms',
      },
      {
        name: 'penalty_rate',
        label: {
          ru: 'Неустойка за просрочку (% в день)',
          kz: 'Мерзімін өткізгені үшін тұрақсыздық айыбы (% күніне)',
          en: 'Late delivery penalty (% per day)',
        },
        kind: 'number',
        required: false,
        group: 'liability',
      },
    ],
    norms: [
      {
        code: 'ГК РК 458',
        note: {
          ru: 'Договор поставки: передача товаров в обусловленный срок для использования в предпринимательской деятельности.',
          kz: 'Жеткізу шарты: кәсіпкерлік қызметте пайдалану үшін тауарларды келісілген мерзімде беру.',
          en: 'Supply contract: transfer of goods within an agreed period for use in business activity.',
        },
      },
      {
        code: 'ГК РК 476',
        note: {
          ru: 'Расчёты за поставляемые товары: порядок и сроки оплаты по договору поставки.',
          kz: 'Жеткізілетін тауарлар үшін есеп айырысу: жеткізу шарты бойынша төлем тәртібі мен мерзімдері.',
          en: 'Settlements for supplied goods: procedure and timing of payment under a supply contract.',
        },
      },
      {
        code: 'ГК РК 297',
        note: {
          ru: 'Уменьшение размера неустойки судом, если она явно несоразмерна последствиям нарушения.',
          kz: 'Тұрақсыздық айыбы бұзушылық салдарына анық сәйкес келмесе, сот оның мөлшерін азайтады.',
          en: 'Reduction of the penalty by the court where it is clearly disproportionate to the breach.',
        },
      },
    ],
  },
  {
    id: 'construction',
    name: { ru: 'Подряд', kz: 'Мердігерлік', en: 'Construction contract' },
    description: {
      ru: 'Строительные и иные работы',
      kz: 'Құрылыс және өзге жұмыстар',
      en: 'Construction and other works',
    },
    legalBasis: {
      ru: 'ГК РК, Особенная часть, глава 32',
      kz: 'ҚР АК, Ерекше бөлім, 32-тарау',
      en: 'Civil Code of Kazakhstan, Special Part, chapter 32',
    },
    sections: [
      'Предмет договора',
      'Сроки выполнения работ',
      'Стоимость и порядок оплаты',
      'Порядок выполнения работ',
      'Материалы и оборудование',
      'Сдача-приёмка работ',
      'Гарантии качества',
      'Права и обязанности заказчика',
      'Права и обязанности подрядчика',
      'Ответственность сторон',
      'Форс-мажор',
      'Порядок разрешения споров',
      'Заключительные положения',
      'Реквизиты и подписи сторон',
    ],
    fields: [
      {
        name: 'work_description',
        label: { ru: 'Описание работ', kz: 'Жұмыстар сипаттамасы', en: 'Work description' },
        kind: 'textarea',
        required: true,
        group: 'subject',
      },
      {
        name: 'materials_provider',
        label: {
          ru: 'Кто предоставляет материалы',
          kz: 'Материалдарды кім ұсынады',
          en: 'Materials provider',
        },
        kind: 'select',
        required: true,
        group: 'subject',
        options: [
          { value: 'contractor', label: { ru: 'Подрядчик', kz: 'Мердігер', en: 'Contractor' } },
          { value: 'client', label: { ru: 'Заказчик', kz: 'Тапсырыс беруші', en: 'Client' } },
          { value: 'both', label: { ru: 'Совместно', kz: 'Бірлесіп', en: 'Both parties' } },
        ],
      },
      {
        name: 'work_cost',
        label: { ru: 'Стоимость работ (тенге)', kz: 'Жұмыс құны (теңге)', en: 'Work cost (KZT)' },
        kind: 'number',
        required: true,
        group: 'money',
      },
      {
        name: 'work_deadline',
        label: {
          ru: 'Срок выполнения работ',
          kz: 'Жұмыстарды орындау мерзімі',
          en: 'Work deadline',
        },
        kind: 'text',
        required: true,
        group: 'terms',
      },
      {
        name: 'warranty_period',
        label: {
          ru: 'Гарантийный срок на работы',
          kz: 'Жұмыстарға кепілдік мерзімі',
          en: 'Warranty period for the works',
        },
        kind: 'text',
        required: false,
        group: 'liability',
      },
    ],
    norms: [
      {
        code: 'ГК РК 616',
        note: {
          ru: 'Договор подряда: подрядчик выполняет работу и сдаёт результат, заказчик принимает и оплачивает.',
          kz: 'Мердігерлік шарт: мердігер жұмысты орындап, нәтижесін тапсырады, тапсырыс беруші қабылдап, ақысын төлейді.',
          en: 'Works contract: the contractor performs and delivers the result, the client accepts and pays.',
        },
      },
      {
        code: 'ГК РК 620',
        note: {
          ru: 'Сроки выполнения работы: начальный, конечный и промежуточные сроки.',
          kz: 'Жұмысты орындау мерзімдері: бастапқы, соңғы және аралық мерзімдер.',
          en: 'Time for performance: initial, final and intermediate deadlines.',
        },
      },
      {
        code: 'ГК РК 630',
        note: {
          ru: 'Цена работы: твёрдая и приблизительная смета, последствия превышения.',
          kz: 'Жұмыс бағасы: тұрақты және шамамен алынған смета, асып кетудің салдары.',
          en: 'Price of the works: fixed and approximate estimate, consequences of overrun.',
        },
      },
    ],
  },
  {
    id: 'nda',
    name: { ru: 'Конфиденциальность', kz: 'Құпиялылық', en: 'Non-disclosure agreement' },
    description: {
      ru: 'Соглашение о неразглашении (NDA)',
      kz: 'Жарияламау туралы келісім (NDA)',
      en: 'Non-disclosure agreement (NDA)',
    },
    legalBasis: {
      ru: 'ГК РК, Общая часть, ст. 126; Закон РК «О коммерческой тайне»',
      kz: 'ҚР АК, Жалпы бөлім, 126-бап; ҚР «Коммерциялық құпия туралы» Заңы',
      en: 'Civil Code, Art. 126; Law on Commercial Secrets',
    },
    sections: [
      'Предмет соглашения',
      'Определение конфиденциальной информации',
      'Исключения из конфиденциальной информации',
      'Обязательства принимающей стороны',
      'Срок действия обязательств',
      'Порядок обращения с информацией',
      'Ответственность за нарушение',
      'Порядок разрешения споров',
      'Заключительные положения',
      'Реквизиты и подписи сторон',
    ],
    fields: [
      {
        name: 'confidential_info_scope',
        label: {
          ru: 'Описание конфиденциальной информации',
          kz: 'Құпия ақпараттың сипаттамасы',
          en: 'Scope of confidential information',
        },
        kind: 'textarea',
        required: true,
        group: 'subject',
      },
      {
        name: 'nda_purpose',
        label: {
          ru: 'Цель раскрытия информации',
          kz: 'Ақпаратты ашу мақсаты',
          en: 'Purpose of disclosure',
        },
        kind: 'textarea',
        required: true,
        group: 'subject',
      },
      {
        name: 'nda_term',
        label: {
          ru: 'Срок действия обязательств',
          kz: 'Міндеттемелердің қолданылу мерзімі',
          en: 'Term of the obligations',
        },
        kind: 'text',
        required: true,
        group: 'terms',
      },
      {
        name: 'penalty_amount',
        label: {
          ru: 'Штраф за нарушение (тенге)',
          kz: 'Бұзғаны үшін айыппұл (теңге)',
          en: 'Penalty for breach (KZT)',
        },
        kind: 'number',
        required: false,
        group: 'liability',
      },
    ],
    norms: [
      {
        code: 'ГК РК 126',
        note: {
          ru: 'Служебная и коммерческая тайна: условия защиты сведений, не известных третьим лицам.',
          kz: 'Қызметтік және коммерциялық құпия: үшінші тұлғаларға белгісіз мәліметтерді қорғау шарттары.',
          en: 'Official and commercial secrets: conditions for protecting information unknown to third parties.',
        },
      },
      {
        code: 'ГК РК 350',
        note: {
          ru: 'Возмещение убытков, причинённых нарушением обязательства, включая упущенную выгоду.',
          kz: 'Міндеттемені бұзумен келтірілген залалды өтеу, оның ішінде жіберіп алған пайда.',
          en: 'Compensation for losses caused by breach, including lost profit.',
        },
      },
    ],
  },
  {
    id: 'agency',
    name: { ru: 'Агентский договор', kz: 'Агенттік шарт', en: 'Agency agreement' },
    description: {
      ru: 'Агентирование и поручение',
      kz: 'Агенттік және тапсырма',
      en: 'Agency and mandate',
    },
    legalBasis: {
      ru: 'ГК РК, Особенная часть, глава 41',
      kz: 'ҚР АК, Ерекше бөлім, 41-тарау',
      en: 'Civil Code of Kazakhstan, Special Part, chapter 41',
    },
    sections: [
      'Предмет договора',
      'Полномочия агента',
      'Вознаграждение агента',
      'Порядок оказания и отчётности',
      'Права и обязанности принципала',
      'Права и обязанности агента',
      'Ответственность сторон',
      'Срок действия и расторжение',
      'Конфиденциальность',
      'Форс-мажор',
      'Порядок разрешения споров',
      'Заключительные положения',
      'Реквизиты и подписи сторон',
    ],
    fields: [
      {
        name: 'agency_scope',
        label: {
          ru: 'Предмет поручения / полномочия агента',
          kz: 'Тапсырма мәні / агент өкілеттіктері',
          en: 'Agency scope / agent authority',
        },
        kind: 'textarea',
        required: true,
        group: 'subject',
      },
      {
        name: 'territory',
        label: { ru: 'Территория действия', kz: 'Қолданылу аумағы', en: 'Territory' },
        kind: 'text',
        required: false,
        group: 'subject',
      },
      {
        name: 'agent_fee',
        label: {
          ru: 'Вознаграждение агента (тенге или %)',
          kz: 'Агент сыйақысы (теңге немесе %)',
          en: 'Agent fee (KZT or %)',
        },
        kind: 'text',
        required: true,
        group: 'money',
      },
      {
        name: 'agency_term',
        label: {
          ru: 'Срок действия договора',
          kz: 'Шарттың қолданылу мерзімі',
          en: 'Agreement term',
        },
        kind: 'text',
        required: true,
        group: 'terms',
      },
      {
        name: 'reporting_frequency',
        label: {
          ru: 'Периодичность отчётов',
          kz: 'Есеп беру мерзімділігі',
          en: 'Reporting frequency',
        },
        kind: 'select',
        required: true,
        group: 'terms',
        options: [
          { value: 'weekly', label: { ru: 'Еженедельно', kz: 'Апта сайын', en: 'Weekly' } },
          { value: 'monthly', label: { ru: 'Ежемесячно', kz: 'Ай сайын', en: 'Monthly' } },
          { value: 'quarterly', label: { ru: 'Ежеквартально', kz: 'Тоқсан сайын', en: 'Quarterly' } },
          {
            value: 'on_completion',
            label: { ru: 'По завершении', kz: 'Аяқталғанда', en: 'On completion' },
          },
        ],
      },
    ],
    norms: [
      {
        code: 'ГК РК 846',
        note: {
          ru: 'Договор поручения: поверенный совершает от имени и за счёт доверителя определённые действия.',
          kz: 'Тапсырма шарты: сенім білдірілген адам сенім білдірушінің атынан және есебінен әрекет жасайды.',
          en: 'Mandate contract: the agent performs acts in the name and at the expense of the principal.',
        },
      },
      {
        code: 'ГК РК 852',
        note: {
          ru: 'Вознаграждение поверенного: основания и размер выплаты.',
          kz: 'Сенім білдірілген адамның сыйақысы: төлеу негіздері мен мөлшері.',
          en: "Agent's remuneration: grounds and amount of payment.",
        },
      },
      {
        code: 'ГК РК 293',
        note: {
          ru: 'Неустойка за неисполнение или ненадлежащее исполнение обязательства.',
          kz: 'Міндеттемені орындамағаны немесе тиісінше орындамағаны үшін тұрақсыздық айыбы.',
          en: 'Penalty for non-performance or improper performance of an obligation.',
        },
      },
    ],
  },
]

/* ------------------------------------------------------------
   Проверка договора
   ------------------------------------------------------------ */

export type Position = 'client' | 'contractor' | 'neutral'

export const POSITIONS: { id: Position; label: L10n }[] = [
  {
    id: 'client',
    label: { ru: 'Со стороны заказчика', kz: 'Тапсырыс беруші тарапынан', en: 'For the client' },
  },
  {
    id: 'contractor',
    label: { ru: 'Со стороны исполнителя', kz: 'Орындаушы тарапынан', en: 'For the contractor' },
  },
  { id: 'neutral', label: { ru: 'Нейтрально', kz: 'Бейтарап', en: 'Neutral' } },
]

export interface Finding {
  id: string
  /** Раздел проверяемого договора. */
  where: L10n
  /** Формулировка проблемы — набирается антиквой. */
  problem: L10n
  /** Цитата спорного условия. */
  quote: L10n
  cite: string
  citeNote: L10n
  advice: L10n
  /** Уровень риска зависит от того, чью сторону занимает юрист. */
  level: Record<Position, StatusKind>
}

export const FINDINGS: Finding[] = [
  {
    id: 'penalty-rate',
    where: { ru: 'П. 6.2. Ответственность', kz: '6.2-т. Жауапкершілік', en: 'Cl. 6.2 Liability' },
    problem: {
      ru: 'Неустойка 5 % от суммы договора за каждый день просрочки — это 1825 % годовых. Такая ставка явно несоразмерна последствиям нарушения и почти наверняка будет снижена судом, а условие в этой части утратит защитную ценность.',
      kz: 'Әрбір кешіктірілген күн үшін шарт сомасының 5 % мөлшеріндегі тұрақсыздық айыбы — жылдық 1825 %. Мұндай мөлшерлеме бұзушылық салдарына анық сәйкес келмейді және сот оны азайтуы әбден мүмкін, ал талап осы бөлігінде қорғаныш мәнін жоғалтады.',
      en: 'A penalty of 5 % of the contract amount per day of delay equals 1825 % per annum. Such a rate is clearly disproportionate to the breach and will almost certainly be reduced by the court, leaving the clause without protective value.',
    },
    quote: {
      ru: '«…уплачивает пеню в размере 5 % от общей суммы Договора за каждый день просрочки…»',
      kz: '«…әрбір кешіктірілген күн үшін Шарттың жалпы сомасының 5 % мөлшерінде өсімпұл төлейді…»',
      en: '"…shall pay a penalty of 5 % of the total contract amount for each day of delay…"',
    },
    cite: 'ГК РК 297',
    citeNote: {
      ru: 'Уменьшение размера неустойки',
      kz: 'Тұрақсыздық айыбының мөлшерін азайту',
      en: 'Reduction of the penalty',
    },
    advice: {
      ru: 'Снизить до 0,1 % в день и ограничить совокупный размер 10 % суммы неисполненного обязательства — такая ставка устойчива в судебной практике.',
      kz: '0,1 % күніне дейін төмендетіп, жиынтық мөлшерін орындалмаған міндеттеме сомасының 10 %-ымен шектеу керек — мұндай мөлшерлеме сот тәжірибесінде тұрақты.',
      en: 'Reduce to 0.1 % per day and cap the aggregate at 10 % of the unperformed obligation — a rate that holds up in practice.',
    },
    level: { client: 'warn', contractor: 'err', neutral: 'err' },
  },
  {
    id: 'no-mutual-liability',
    where: { ru: 'Раздел 6. Ответственность', kz: '6-бөлім. Жауапкершілік', en: 'Section 6 Liability' },
    problem: {
      ru: 'Ответственность установлена односторонне: исполнитель отвечает за просрочку работ, а ответственность заказчика за просрочку оплаты в договоре отсутствует. Встречного обязательства нет, и взыскать что-либо за задержку платежа можно будет только по общей норме.',
      kz: 'Жауапкершілік бір жақты белгіленген: орындаушы жұмыстың кешігуі үшін жауап береді, ал тапсырыс берушінің төлемді кешіктіргені үшін жауапкершілігі шартта жоқ. Қарсы міндеттеме жоқ, төлемнің кешігуі үшін тек жалпы норма бойынша талап қоюға болады.',
      en: 'Liability is one-sided: the contractor answers for delayed works, while the client bears no liability for late payment. With no mutual obligation, delay in payment can be pursued only under the general rule.',
    },
    quote: {
      ru: '«Ответственность Заказчика настоящим Договором не предусмотрена.»',
      kz: '«Тапсырыс берушінің жауапкершілігі осы Шартта көзделмеген.»',
      en: '"No liability of the Client is provided for by this Agreement."',
    },
    cite: 'ГК РК 293',
    citeNote: { ru: 'Понятие неустойки', kz: 'Тұрақсыздық айыбы ұғымы', en: 'Concept of penalty' },
    advice: {
      ru: 'Ввести зеркальную неустойку заказчика за просрочку оплаты в том же размере и с тем же ограничением — это выравнивает переговорную позицию и снимает довод о кабальности условия.',
      kz: 'Тапсырыс берушінің төлемді кешіктіргені үшін дәл сондай мөлшерде және сондай шектеумен айналы тұрақсыздық айыбын енгізу керек — бұл келіссөз ұстанымын теңестіреді.',
      en: 'Add a mirror penalty on the client for late payment at the same rate and cap — it balances the bargain and defuses the unconscionability argument.',
    },
    level: { client: 'warn', contractor: 'err', neutral: 'warn' },
  },
  {
    id: 'payment-order',
    where: {
      ru: 'П. 3.4. Порядок оплаты',
      kz: '3.4-т. Төлем тәртібі',
      en: 'Cl. 3.4 Payment procedure',
    },
    problem: {
      ru: 'Срок оплаты определён формулировкой «после подписания акта», без указания количества дней. Момент наступления обязанности платить не определён, просрочку исчислить невозможно, а значит неустойка и проценты не начисляются.',
      kz: 'Төлем мерзімі «акт қол қойылғаннан кейін» деген тұжырыммен, күндер санын көрсетпей айқындалған. Төлеу міндетінің туындау сәті белгісіз, кешіктіруді есептеу мүмкін емес, демек тұрақсыздық айыбы мен өсімақы есептелмейді.',
      en: 'The payment deadline reads "after the act is signed", with no number of days. The moment the payment obligation falls due is undefined, delay cannot be calculated, and neither penalty nor interest accrues.',
    },
    quote: {
      ru: '«Оплата производится после подписания акта выполненных работ.»',
      kz: '«Төлем орындалған жұмыстар актісіне қол қойылғаннан кейін жүргізіледі.»',
      en: '"Payment shall be made after signing of the completion act."',
    },
    cite: 'ГК РК 476',
    citeNote: {
      ru: 'Расчёты за поставляемые товары',
      kz: 'Жеткізілетін тауарлар үшін есеп айырысу',
      en: 'Settlements for supplied goods',
    },
    advice: {
      ru: 'Указать конкретный срок: «в течение 10 (десяти) банковских дней с даты подписания акта», и определить момент исполнения — зачисление средств на счёт получателя.',
      kz: 'Нақты мерзім көрсету қажет: «актіге қол қойылған күннен бастап 10 (он) банктік күн ішінде», және орындау сәтін — қаражаттың алушы шотына түсуін айқындау.',
      en: 'State a concrete period — "within 10 (ten) banking days of signing the act" — and define performance as crediting the funds to the recipient account.',
    },
    level: { client: 'warn', contractor: 'err', neutral: 'warn' },
  },
  {
    id: 'force-majeure',
    where: { ru: 'П. 7.1. Форс-мажор', kz: '7.1-т. Форс-мажор', en: 'Cl. 7.1 Force majeure' },
    problem: {
      ru: 'В перечень обстоятельств непреодолимой силы включены изменение курса валют и ухудшение финансового положения стороны. Это предпринимательский риск, а не непреодолимая сила: сторона, сославшаяся на такой пункт, ответственности не избежит, а сам пункт может быть признан недействительным в этой части.',
      kz: 'Еңсерілмейтін күш мән-жайларының тізбесіне валюта бағамының өзгеруі және тараптың қаржылық жағдайының нашарлауы енгізілген. Бұл — еңсерілмейтін күш емес, кәсіпкерлік тәуекел: осы тармаққа сілтеме жасаған тарап жауапкершіліктен құтылмайды.',
      en: 'The force majeure list includes currency movements and deterioration of a party financial position. That is entrepreneurial risk, not force majeure: a party relying on it will not escape liability, and the clause may be void in that part.',
    },
    quote: {
      ru: '«…в том числе изменение курса валют и ухудшение финансового положения Стороны.»',
      kz: '«…оның ішінде валюта бағамының өзгеруі және Тараптың қаржылық жағдайының нашарлауы.»',
      en: '"…including currency fluctuations and deterioration of a Party financial position."',
    },
    cite: 'ГК РК 359',
    citeNote: {
      ru: 'Основания ответственности; непреодолимая сила',
      kz: 'Жауапкершілік негіздері; еңсерілмейтін күш',
      en: 'Grounds of liability; force majeure',
    },
    advice: {
      ru: 'Оставить открытый перечень с признаком чрезвычайности и непредотвратимости, добавить срок уведомления 5 рабочих дней и подтверждение справкой уполномоченного органа.',
      kz: 'Төтенше және болғызбайтын белгісі бар ашық тізбені қалдырып, 5 жұмыс күндік хабарлау мерзімін және уәкілетті органның анықтамасымен растауды қосу керек.',
      en: 'Keep an open list keyed to extraordinariness and unavoidability, add a 5-business-day notice period and confirmation by a competent authority.',
    },
    level: { client: 'warn', contractor: 'warn', neutral: 'warn' },
  },
  {
    id: 'jurisdiction',
    where: {
      ru: 'П. 8.3. Разрешение споров',
      kz: '8.3-т. Дауларды шешу',
      en: 'Cl. 8.3 Dispute resolution',
    },
    problem: {
      ru: 'Подсудность привязана к месту нахождения исполнителя, а третейская оговорка не называет ни арбитраж, ни применимый регламент. Неопределённая арбитражная оговорка исполнению не подлежит, и спор всё равно придётся вести в суде — но уже в чужом городе.',
      kz: 'Соттылық орындаушының орналасқан жеріне байланыстырылған, ал төрелік ескертпеде төрелік те, қолданылатын регламент те аталмаған. Айқындалмаған төрелік ескертпе орындалуға жатпайды, дауды бәрібір сотта жүргізуге тура келеді — бірақ бөтен қалада.',
      en: 'Jurisdiction is tied to the contractor location, and the arbitration clause names neither the institution nor the rules. An indeterminate arbitration clause is unenforceable, so the dispute goes to court anyway — in the other side city.',
    },
    quote: {
      ru: '«Споры рассматриваются в арбитраже по месту нахождения Исполнителя.»',
      kz: '«Даулар Орындаушының орналасқан жері бойынша төрелікте қаралады.»',
      en: '"Disputes shall be resolved in arbitration at the location of the Contractor."',
    },
    cite: 'ГПК РК 30',
    citeNote: {
      ru: 'Подсудность по месту нахождения ответчика',
      kz: 'Жауапкердің орналасқан жері бойынша соттылық',
      en: 'Jurisdiction at the location of the defendant',
    },
    advice: {
      ru: 'Либо оставить общую подсудность — специализированный межрайонный экономический суд по месту нахождения ответчика, либо назвать конкретный арбитраж и его регламент.',
      kz: 'Не жалпы соттылықты — жауапкердің орналасқан жері бойынша мамандандырылған ауданаралық экономикалық сотты қалдыру, не нақты төрелікті және оның регламентін атау керек.',
      en: 'Either keep the default forum — the specialised inter-district economic court at the defendant location — or name a specific arbitration institution and its rules.',
    },
    level: { client: 'err', contractor: 'ok', neutral: 'warn' },
  },
  {
    id: 'essentials',
    where: { ru: 'Разделы 1–3', kz: '1–3-бөлімдер', en: 'Sections 1–3' },
    problem: {
      ru: 'Существенные условия согласованы: предмет описан однозначно, цена и валюта определены, срок исполнения указан календарной датой. Оснований считать договор незаключённым нет.',
      kz: 'Елеулі талаптар келісілген: мәні бір мағыналы сипатталған, бағасы мен валютасы айқындалған, орындау мерзімі күнтізбелік күнмен көрсетілген. Шартты жасалмаған деп есептеуге негіз жоқ.',
      en: 'The essential terms are agreed: the subject is described unambiguously, price and currency are fixed, and the deadline is a calendar date. There is no ground to treat the contract as not concluded.',
    },
    quote: {
      ru: '«Предмет, цена и срок определены в разделах 1–3 Договора.»',
      kz: '«Мәні, бағасы және мерзімі Шарттың 1–3-бөлімдерінде айқындалған.»',
      en: '"Subject, price and term are set out in sections 1–3 of the Agreement."',
    },
    cite: 'ГК РК 393',
    citeNote: {
      ru: 'Существенные условия договора',
      kz: 'Шарттың елеулі талаптары',
      en: 'Essential terms of a contract',
    },
    advice: {
      ru: 'Правок не требуется. Стоит только продублировать сумму прописью, чтобы исключить спор о цифровом значении.',
      kz: 'Түзету қажет емес. Тек сандық мәні туралы дауды болдырмау үшін соманы жазбаша қайталаған жөн.',
      en: 'No amendment needed. Worth duplicating the amount in words to foreclose a dispute over the figure.',
    },
    level: { client: 'ok', contractor: 'ok', neutral: 'ok' },
  },
]
