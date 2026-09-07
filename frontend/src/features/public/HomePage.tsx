import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties, MouseEvent, ReactNode } from 'react'
import { Link } from '../../shared/nav'
import { Reveal, useCountUp } from '../../shared/motion'
import { useLang, useT } from '../../i18n'
import type { Dict } from '../../i18n'
import { citeCode } from '../legal/cite'
import { PublicPage } from './PublicChrome'
import './public.css'
import './home.css'

/**
 * Главная — витрина TURA.
 *
 * В отличие от продукта, где действует строгое направление «Документ»,
 * главная светлая и цветная: холодная бумага, индиго-акцент, пастельные
 * плоскости. Иллюстрации здесь — не картинки, а собранные из настоящих
 * элементов интерфейса макеты: окно консультанта, проверка договора,
 * оглавление законопроекта, диаграммы аналитики. Каждый раздел появляется
 * по мере прокрутки, схемы дорисовываются, цифры набегают.
 *
 * Все цвета, тени и длительности — токены с префиксом --h- из tokens.css;
 * системная настройка «меньше движения» гасит движение целиком.
 */

const dict: Dict = {
  /* ---- Первый экран ---- */
  eyebrow: {
    ru: 'Правовая платформа для Казахстана',
    kz: 'Қазақстанға арналған құқықтық платформа',
    en: 'A legal platform for Kazakhstan',
  },
  h1a: { ru: 'Право, у которого', kz: 'Дереккөзі', en: 'Law with its source' },
  h1b: { ru: 'видно источник', kz: 'көрініп тұратын құқық', en: 'in plain sight' },
  lede: {
    ru: 'TURA отвечает на правовой вопрос простым языком и рядом с каждым утверждением ставит норму, из которой оно следует: закон, статью, пункт. Ответ можно проверить, не выходя из него.',
    kz: 'TURA құқықтық сұраққа қарапайым тілмен жауап береді және әрбір тұжырымның қасына оның негізі болған норманы қояды: заң, бап, тармақ. Жауапты одан шықпай-ақ тексеруге болады.',
    en: 'TURA answers a legal question in plain language and puts the norm each statement follows from right beside it: the act, the article, the clause. You can verify the answer without leaving it.',
  },
  ctaMain: { ru: 'Начать бесплатно', kz: 'Тегін бастау', en: 'Start for free' },
  ctaHow: { ru: 'Как это работает', kz: 'Бұл қалай жұмыс істейді', en: 'See how it works' },
  perk1: { ru: 'Казахский и русский', kz: 'Қазақ және орыс тілдері', en: 'Kazakh and Russian' },
  perk1d: { ru: 'без потери качества', kz: 'сапасы бірдей', en: 'with equal quality' },
  perk2: { ru: 'Ссылка на норму', kz: 'Нормаға сілтеме', en: 'A norm behind' },
  perk2d: { ru: 'у каждого утверждения', kz: 'әрбір тұжырымда', en: 'every statement' },
  perk3: { ru: 'Данные у вас', kz: 'Деректер сізде', en: 'Your data stays' },
  perk3d: { ru: 'на собственных серверах', kz: 'меншікті серверлерде', en: 'on our own servers' },

  /* ---- Макет окна консультанта ---- */
  mockChat: { ru: 'Консультант', kz: 'Кеңесші', en: 'Assistant' },
  mockDocs: { ru: 'Договоры', kz: 'Шарттар', en: 'Contracts' },
  mockLaws: { ru: 'Законопроекты', kz: 'Заң жобалары', en: 'Draft laws' },
  mockStats: { ru: 'Аналитика', kz: 'Талдау', en: 'Analytics' },
  mockQ: {
    ru: 'Купил квартиру, а через два года выяснилось, что продавец не имел права её продавать. Сколько у меня времени, чтобы оспорить сделку?',
    kz: 'Пәтер сатып алдым, ал екі жылдан кейін сатушының оны сатуға құқығы болмағаны белгілі болды. Мәмілені даулауға қанша уақытым бар?',
    en: 'I bought a flat, and two years later it turned out the seller had no right to sell it. How long do I have to challenge the deal?',
  },
  mockA1: {
    ru: 'Общий срок исковой давности — три года ',
    kz: 'Талап қоюдың жалпы мерзімі — үш жыл ',
    en: 'The general limitation period is three years ',
  },
  mockA2: {
    ru: '. Он отсчитывается со дня, когда вы узнали о нарушении права ',
    kz: '. Ол құқығыңыздың бұзылғанын білген күннен басталады ',
    en: '. It runs from the day you learned of the violation ',
  },
  mockA3: {
    ru: ', значит срок не истёк.',
    kz: ', демек мерзім өткен жоқ.',
    en: ', so the period has not expired.',
  },
  mockSrc: { ru: 'Источники', kz: 'Дереккөздер', en: 'Sources' },
  n178t: { ru: 'Общий срок исковой давности', kz: 'Талап қоюдың жалпы мерзімі', en: 'General limitation period' },
  n180t: { ru: 'Начало течения срока', kz: 'Мерзімнің басталуы', en: 'Start of the period' },
  mockPlaceholder: { ru: 'Задайте вопрос…', kz: 'Сұрақ қойыңыз…', en: 'Ask a question…' },
  floatCheck: { ru: 'Проверка договора', kz: 'Шартты тексеру', en: 'Contract check' },
  floatCheckD: { ru: '12 условий · 1 замечание', kz: '12 талап · 1 ескертпе', en: '12 clauses · 1 issue' },
  floatNorm: { ru: 'Норма найдена', kz: 'Норма табылды', en: 'Norm found' },
  floatNormD: { ru: 'редакция от 01.07.2026', kz: '01.07.2026 редакциясы', en: 'version of 01.07.2026' },

  /* ---- Лента актов и цифры ---- */
  tickerLabel: {
    ru: 'Работает с действующими актами Республики Казахстан',
    kz: 'Қазақстан Республикасының қолданыстағы актілерімен жұмыс істейді',
    en: 'Works with the acts of the Republic of Kazakhstan in force',
  },
  fig1: { ru: 'нормативных актов в базе', kz: 'дерекқордағы нормативтік акт', en: 'legal acts indexed' },
  fig2: { ru: 'разделов в пакете законопроекта', kz: 'заң жобасы топтамасындағы бөлім', en: 'sections in a draft-law package' },
  fig3: { ru: 'типов договоров', kz: 'шарт түрі', en: 'contract types' },
  fig4: { ru: 'языка интерфейса и ответа', kz: 'интерфейс және жауап тілі', en: 'languages of interface and answer' },

  /* ---- Как это работает ---- */
  howTitle: { ru: 'Как это работает', kz: 'Бұл қалай жұмыс істейді', en: 'How it works' },
  howNote: {
    ru: 'Задайте вопрос своими словами. TURA найдёт нормы, соберёт ответ и покажет, откуда взято каждое утверждение.',
    kz: 'Сұрағыңызды өз сөзіңізбен қойыңыз. TURA нормаларды табады, жауап құрастырады және әрбір тұжырымның қайдан алынғанын көрсетеді.',
    en: 'Ask in your own words. TURA finds the norms, composes the answer and shows where every statement comes from.',
  },
  step1: { ru: 'Задайте вопрос', kz: 'Сұрақ қойыңыз', en: 'Ask a question' },
  step1d: {
    ru: 'Как есть: без юридических терминов и номеров статей. На казахском или русском.',
    kz: 'Қалай бар, солай: заң терминдерісіз және бап нөмірлерісіз. Қазақ немесе орыс тілінде.',
    en: 'As it is, with no legal terms or article numbers. In Kazakh or Russian.',
  },
  step2: { ru: 'Поиск по базе', kz: 'База бойынша іздеу', en: 'Retrieval' },
  step2d: {
    ru: 'Система находит фрагменты действующих актов, относящиеся к вопросу, и отбрасывает лишнее.',
    kz: 'Жүйе сұраққа қатысты қолданыстағы актілердің фрагменттерін табады және артығын алып тастайды.',
    en: 'The system finds the fragments of acts in force that bear on the question and drops the rest.',
  },
  step3: { ru: 'Ответ с координатами', kz: 'Координаталары бар жауап', en: 'A sourced answer' },
  step3d: {
    ru: 'Каждое утверждение опирается на норму, а норма раскрывается по нажатию.',
    kz: 'Әрбір тұжырым нормаға сүйенеді, ал норма басқанда ашылады.',
    en: 'Every statement rests on a norm, and the norm opens with one click.',
  },
  pipeQ: {
    ru: 'Можно ли расторгнуть договор аренды досрочно, если арендодатель не делает ремонт?',
    kz: 'Жалға беруші жөндеу жасамаса, жалдау шартын мерзімінен бұрын бұзуға бола ма?',
    en: 'Can I terminate a lease early if the landlord does not carry out repairs?',
  },
  pipeFound: { ru: 'Найдено в базе', kz: 'Базадан табылды', en: 'Found in the database' },
  pipeF1a: { ru: 'ГК РК, ст. 556', kz: 'ҚР АК, 556-бап', en: 'Civil Code, art. 556' },
  pipeF1t: {
    ru: 'Досрочное расторжение договора по требованию нанимателя',
    kz: 'Жалдаушының талабы бойынша шартты мерзімінен бұрын бұзу',
    en: 'Early termination at the tenant’s demand',
  },
  pipeF2a: { ru: 'ГК РК, ст. 552', kz: 'ҚР АК, 552-бап', en: 'Civil Code, art. 552' },
  pipeF2t: {
    ru: 'Обязанности наймодателя по содержанию имущества',
    kz: 'Жалға берушінің мүлікті күтіп-ұстау міндеттері',
    en: 'Landlord’s duties to maintain the property',
  },
  pipeF3a: { ru: 'ГК РК, ст. 401', kz: 'ҚР АК, 401-бап', en: 'Civil Code, art. 401' },
  pipeF3t: {
    ru: 'Основания расторжения договора',
    kz: 'Шартты бұзу негіздері',
    en: 'Grounds for terminating a contract',
  },
  pipeAnswer: { ru: 'Ответ', kz: 'Жауап', en: 'Answer' },
  pipeA1: {
    ru: 'Да. Если наймодатель не производит капитальный ремонт, который обязан делать, наниматель вправе требовать досрочного расторжения договора в суде ',
    kz: 'Иә. Жалға беруші жасауға міндетті күрделі жөндеуді жасамаса, жалдаушы сот арқылы шартты мерзімінен бұрын бұзуды талап ете алады ',
    en: 'Yes. If the landlord fails to carry out the major repairs they are obliged to do, the tenant may demand early termination in court ',
  },
  pipeA2: {
    ru: '. Обязанность ремонта лежит на наймодателе, если договором не установлено иное ',
    kz: '. Шартта басқаша көзделмесе, жөндеу міндеті жалға берушіде ',
    en: '. The duty to repair lies with the landlord unless the contract says otherwise ',
  },
  pipeA3: { ru: '.', kz: '.', en: '.' },
  pipeAgain: { ru: 'Показать ещё раз', kz: 'Қайта көрсету', en: 'Play again' },

  /* ---- Модули ---- */
  modsTitle: { ru: 'Что умеет TURA', kz: 'TURA не істей алады', en: 'What TURA does' },
  modsNote: {
    ru: 'Четыре инструмента на одной базе действующего права. Каждый показывает источник.',
    kz: 'Қолданыстағы құқықтың бір базасындағы төрт құрал. Әрқайсысы дереккөзін көрсетеді.',
    en: 'Four tools on one base of law in force. Each one shows its source.',
  },
  mod1: { ru: 'Консультант', kz: 'Кеңесші', en: 'Assistant' },
  mod1d: {
    ru: 'Вопрос простым языком — ответ с нормами, которые раскрываются на месте.',
    kz: 'Қарапайым тілдегі сұрақ — сол жерде ашылатын нормалары бар жауап.',
    en: 'A plain-language question, an answer with norms that open in place.',
  },
  mod2: { ru: 'Договоры', kz: 'Шарттар', en: 'Contracts' },
  mod2d: {
    ru: 'Сборка договора под вашу ситуацию и проверка чужого: риски, пропуски, нормы.',
    kz: 'Сіздің жағдайыңызға шарт құрастыру және басқа шартты тексеру: тәуекелдер, олқылықтар, нормалар.',
    en: 'Build a contract for your case and check someone else’s: risks, gaps, norms.',
  },
  mod3: { ru: 'Законопроекты', kz: 'Заң жобалары', en: 'Draft laws' },
  mod3d: {
    ru: 'Полный пакет по стандартам РК: концепция, текст, сравнительная таблица, пояснительная записка.',
    kz: 'ҚР стандарттары бойынша толық топтама: тұжырымдама, мәтін, салыстырма кесте, түсіндірме жазба.',
    en: 'A full package to state standards: concept, text, comparison table, explanatory note.',
  },
  mod4: { ru: 'Аналитика', kz: 'Талдау', en: 'Analytics' },
  mod4d: {
    ru: 'Темы и тональность обращений по правовым вопросам — в цифрах и динамике.',
    kz: 'Құқықтық мәселелер бойынша өтініштердің тақырыптары мен реңкі — сандар мен динамикада.',
    en: 'Topics and sentiment of legal inquiries, in numbers and over time.',
  },
  modOpen: { ru: 'Открыть', kz: 'Ашу', en: 'Open' },
  mcQ: {
    ru: 'Работодатель задерживает зарплату на месяц. Что мне делать?',
    kz: 'Жұмыс беруші жалақыны бір ай кешіктіріп жатыр. Не істеуім керек?',
    en: 'My employer is a month late with my salary. What can I do?',
  },
  mcA: {
    ru: 'За каждый день задержки положена пеня по ставке Нацбанка ',
    kz: 'Кешіктірілген әр күн үшін Ұлттық банк мөлшерлемесі бойынша өсімпұл төленеді ',
    en: 'A penalty at the National Bank rate accrues for every day of delay ',
  },
  mkDoc: { ru: 'Договор поставки № 14', kz: '№ 14 жеткізу шарты', en: 'Supply contract No. 14' },
  mk1: { ru: 'Неустойка без верхнего предела', kz: 'Жоғарғы шегі жоқ тұрақсыздық айыбы', en: 'Penalty with no upper limit' },
  mk2: { ru: 'Срок поставки не привязан к оплате', kz: 'Жеткізу мерзімі төлемге байланбаған', en: 'Delivery term not tied to payment' },
  mk3: { ru: 'Форс-мажор описан корректно', kz: 'Форс-мажор дұрыс сипатталған', en: 'Force majeure is described correctly' },
  mkErr: { ru: 'Риск', kz: 'Тәуекел', en: 'Risk' },
  mkWarn: { ru: 'Уточнить', kz: 'Нақтылау', en: 'Clarify' },
  mkOk: { ru: 'В порядке', kz: 'Дұрыс', en: 'Fine' },
  mlDoc: { ru: 'О цифровых платформах', kz: 'Цифрлық платформалар туралы', en: 'On digital platforms' },
  ml1: { ru: 'Концепция', kz: 'Тұжырымдама', en: 'Concept' },
  ml2: { ru: 'Текст законопроекта', kz: 'Заң жобасының мәтіні', en: 'Draft text' },
  ml3: { ru: 'Сравнительная таблица', kz: 'Салыстырма кесте', en: 'Comparison table' },
  ml4: { ru: 'Пояснительная записка', kz: 'Түсіндірме жазба', en: 'Explanatory note' },
  maPos: { ru: 'Положительные', kz: 'Оң', en: 'Positive' },
  maNeu: { ru: 'Нейтральные', kz: 'Бейтарап', en: 'Neutral' },
  maNeg: { ru: 'Отрицательные', kz: 'Теріс', en: 'Negative' },
  maTopics: { ru: 'Темы недели', kz: 'Апта тақырыптары', en: 'Topics of the week' },
  ma1: { ru: 'Трудовые споры', kz: 'Еңбек даулары', en: 'Labour disputes' },
  ma2: { ru: 'Аренда жилья', kz: 'Тұрғын үй жалдау', en: 'Housing rent' },
  ma3: { ru: 'Госзакупки', kz: 'Мемлекеттік сатып алу', en: 'Public procurement' },

  /* ---- Кому это нужно ---- */
  whoTitle: { ru: 'Кому это нужно', kz: 'Бұл кімге керек', en: 'Who it is for' },
  whoNote: {
    ru: 'Всем, кто сталкивается с правовым вопросом и хочет получить ответ, который можно проверить.',
    kz: 'Құқықтық сұраққа тап болған және тексеруге болатын жауап алғысы келетіндердің барлығына.',
    en: 'Anyone who faces a legal question and wants an answer they can verify.',
  },
  who1: { ru: 'Госслужащим', kz: 'Мемлекеттік қызметшілерге', en: 'Civil servants' },
  who1d: {
    ru: 'Быстро найти основание для проекта акта, решения или справки. Собрать пакет законопроекта по стандарту.',
    kz: 'Акт, шешім немесе анықтама жобасына негізді жылдам табу. Заң жобасының топтамасын стандарт бойынша құрастыру.',
    en: 'Find the basis for a draft act, decision or memo quickly. Assemble a draft-law package to standard.',
  },
  who2: { ru: 'Юристам', kz: 'Заңгерлерге', en: 'Lawyers' },
  who2d: {
    ru: 'Подобрать норму под позицию, проверить договор контрагента, подготовить аргументацию со ссылками.',
    kz: 'Ұстанымға норма таңдау, контрагенттің шартын тексеру, сілтемелері бар дәлелдеме дайындау.',
    en: 'Match a norm to a position, check a counterparty’s contract, prepare a sourced argument.',
  },
  who3: { ru: 'Предпринимателям', kz: 'Кәсіпкерлерге', en: 'Business' },
  who3d: {
    ru: 'Составить договор без юриста, понять риски перед подписанием, разобраться в требованиях к бизнесу.',
    kz: 'Заңгерсіз шарт жасау, қол қояр алдында тәуекелдерді түсіну, бизнеске қойылатын талаптарды білу.',
    en: 'Draft a contract without a lawyer, see the risks before signing, understand the rules for business.',
  },
  who4: { ru: 'Гражданам', kz: 'Азаматтарға', en: 'Citizens' },
  who4d: {
    ru: 'Разобраться в своих правах на работе, в аренде, в покупке жилья — и понять, куда обратиться.',
    kz: 'Жұмыстағы, жалдаудағы, тұрғын үй сатып алудағы құқықтарыңызды түсіну және қайда жүгінуді білу.',
    en: 'Understand your rights at work, in rent, in buying a home, and know where to turn.',
  },

  /* ---- Почему можно верить ---- */
  trustTitle: { ru: 'Почему можно верить', kz: 'Неге сенуге болады', en: 'Why you can trust it' },
  trustClaim: {
    ru: 'TURA не выдумывает нормы и не даёт уверенных ответов без источника.',
    kz: 'TURA нормаларды ойдан шығармайды және дереккөзі жоқ сенімді жауап бермейді.',
    en: 'TURA does not invent norms and gives no confident answer without a source.',
  },
  trustNote: {
    ru: 'Ответ собирается только из найденных фрагментов действующих актов. Если нормы нет — система так и скажет.',
    kz: 'Жауап тек қолданыстағы актілердің табылған фрагменттерінен құрастырылады. Норма болмаса, жүйе солай дейді.',
    en: 'The answer is composed only from found fragments of acts in force. If there is no norm, the system says so.',
  },
  trust1: { ru: 'Только по источникам', kz: 'Тек дереккөздер бойынша', en: 'Sources only' },
  trust1d: {
    ru: 'Ответ строится из фрагментов актов, найденных в базе, а не из общих знаний модели.',
    kz: 'Жауап модельдің жалпы білімінен емес, базадан табылған актілердің фрагменттерінен құрастырылады.',
    en: 'The answer is built from fragments found in the database, not from the model’s general knowledge.',
  },
  trust2: { ru: 'Каждое утверждение адресуемо', kz: 'Әрбір тұжырымның мекенжайы бар', en: 'Every statement is addressable' },
  trust2d: {
    ru: 'Закон, статья, пункт — норма раскрывается прямо под ответом и сверяется с официальной редакцией.',
    kz: 'Заң, бап, тармақ — норма жауаптың астында ашылады және ресми редакциямен салыстырылады.',
    en: 'Act, article, clause: the norm opens right under the answer and is checked against the official wording.',
  },
  trust3: { ru: 'Актуальная база', kz: 'Өзекті база', en: 'An up-to-date base' },
  trust3d: {
    ru: 'Редакции актов обновляются регулярно, а у каждой нормы видна дата редакции.',
    kz: 'Актілердің редакциялары жүйелі жаңартылады, әр норманың редакция күні көрінеді.',
    en: 'Act versions are updated regularly, and every norm shows the date of its version.',
  },
  trust4: { ru: 'Данные остаются у вас', kz: 'Деректер сізде қалады', en: 'Your data stays put' },
  trust4d: {
    ru: 'Документы и вопросы обрабатываются на собственных серверах и не уходят третьим лицам.',
    kz: 'Құжаттар мен сұрақтар меншікті серверлерде өңделеді және үшінші тарапқа берілмейді.',
    en: 'Documents and questions are processed on our own servers and never leave for third parties.',
  },
  diagQ: { ru: 'Вопрос', kz: 'Сұрақ', en: 'Question' },
  diagS: { ru: 'Найденные нормы', kz: 'Табылған нормалар', en: 'Norms found' },
  diagA: { ru: 'Ответ', kz: 'Жауап', en: 'Answer' },
  diagV: { ru: 'сверено с редакцией', kz: 'редакциямен салыстырылды', en: 'checked against version' },

  /* ---- Призыв ---- */
  finalTitle: {
    ru: 'Попробуйте TURA на своём вопросе',
    kz: 'TURA-ны өз сұрағыңызда байқап көріңіз',
    en: 'Try TURA on your own question',
  },
  finalLede: {
    ru: 'Бесплатно, без карты. Первый ответ с источниками — через минуту после регистрации.',
    kz: 'Тегін, картасыз. Дереккөздері бар бірінші жауап — тіркелгеннен кейін бір минуттан соң.',
    en: 'Free, no card needed. Your first sourced answer arrives a minute after signing up.',
  },
  finalAbout: { ru: 'Подробнее о проекте', kz: 'Жоба туралы толығырақ', en: 'More about the project' },
}

/* ============================================================
   Вспомогательное
   ============================================================ */

function reducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Блок дошёл до экрана — один раз, дальше состояние не сбрасывается. */
function useOnScreen<T extends HTMLElement>(margin = '0px 0px -12% 0px') {
  const ref = useRef<T | null>(null)
  const [shown, setShown] = useState(() => reducedMotion())

  useEffect(() => {
    if (shown) return
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setShown(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true)
          io.disconnect()
        }
      },
      { rootMargin: margin },
    )
    io.observe(el)
    const failsafe = window.setTimeout(() => {
      setShown(true)
      io.disconnect()
    }, 2500)
    return () => {
      window.clearTimeout(failsafe)
      io.disconnect()
    }
  }, [shown, margin])

  return [ref, shown] as const
}

/** Задержка появления, кратная шагу ленты: гаснет вместе с --stagger. */
function step(i: number): CSSProperties {
  return { animationDelay: `calc(var(--stagger) * ${i})` }
}

function idx(i: number): CSSProperties {
  return { ['--i' as string]: i } as CSSProperties
}

/** Миллисекунды из токена: «220ms» → 220. JS-тайминги живут в tokens.css. */
function tokenMs(name: string): number {
  if (typeof window === 'undefined') return 0
  const v = getComputedStyle(document.documentElement).getPropertyValue(name)
  return parseFloat(v) || 0
}

/* ============================================================
   Иконки: тонкие линии в одну толщину, рисуются текущим цветом
   ============================================================ */

const ICON_PATHS: Record<string, ReactNode> = {
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  play: <path d="M9 7.5v9l7-4.5z" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  lang: <path d="M4 5h9M8.5 5V3M6 8.5c1.2 2.8 3.2 5 5.8 6.5M11 8.5C9.8 11.3 7.8 13.5 5.2 15M13 21l4.5-11L22 21M14.6 17h5.8" />,
  pin: <path d="M12 21s6-5.5 6-11a6 6 0 1 0-12 0c0 5.5 6 11 6 11z M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />,
  shield: <path d="M12 3l8 3v6c0 4.5-3.2 8-8 9.5C7.2 20 4 16.5 4 12V6l8-3z M9 12l2 2 4-4" />,
  chat: <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H10l-5 4v-4A2.5 2.5 0 0 1 4 13.5v-7z M8 9h8M8 12.5h5" />,
  doc: <path d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z M14 3v5h5M8.5 13h7M8.5 16.5h5" />,
  gavel: <path d="M13 6.5l4.5 4.5M10.5 9l4.5 4.5M4 20l7.5-7.5M15.5 4l4.5 4.5-2.5 2.5L13 6.5z" />,
  chart: <path d="M4 20h16M7 16v-5M12 16V7M17 16v-8" />,
  search: <path d="M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15z M21 21l-5-5" />,
  quote: <path d="M7 6h10M5 10h14M5 14h9M5 18h6" />,
  gov: <path d="M3 21h18M4 10h16M12 3l9 5H3l9-5zM6 10v8M10 10v8M14 10v8M18 10v8" />,
  scale: <path d="M12 3v18M5 21h14M4 8h16M6 8l-3 6a3 3 0 0 0 6 0L6 8zM18 8l-3 6a3 3 0 0 0 6 0l-3-6z" />,
  case: <path d="M4 8h16a1 1 0 0 1 1 1v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a1 1 0 0 1 1-1z M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18" />,
  person: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M5 21a7 7 0 0 1 14 0" />,
  clock: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 7v5l3.5 2" />,
  lock: <path d="M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z M8.5 11V8a3.5 3.5 0 0 1 7 0v3M12 15v3" />,
  sparkle: <path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6z M19 3v3M17.5 4.5h3" />,
}

function Icon({ name, size = 20, className }: { name: keyof typeof ICON_PATHS; size?: number; className?: string }) {
  return (
    <svg
      className={['ico', className ?? ''].filter(Boolean).join(' ')}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {ICON_PATHS[name]}
    </svg>
  )
}

/** Правовая координата в витрине: индиго-чип, а не подчёркнутая ссылка. */
function Norm({ code, className }: { code: string; className?: string }) {
  const { lang } = useLang()
  return <span className={['norm', className ?? ''].filter(Boolean).join(' ')}>{citeCode(code, lang)}</span>
}

/* ============================================================
   Кольцевая диаграмма: дорисовывается, когда доходит до экрана
   ============================================================ */

function Donut({
  value,
  shown,
  size = 72,
  className,
  children,
}: {
  value: number
  shown: boolean
  size?: number
  className?: string
  children?: ReactNode
}) {
  return (
    <span className={['donut', className ?? ''].filter(Boolean).join(' ')} style={{ width: size, height: size }}>
      <svg viewBox="0 0 36 36" aria-hidden="true" focusable="false">
        <circle className="donut__track" cx="18" cy="18" r="15.9155" />
        <circle
          className="donut__fill"
          cx="18"
          cy="18"
          r="15.9155"
          style={{ strokeDasharray: shown ? `${value} 100` : '0 100' }}
        />
      </svg>
      <span className="donut__label">{children}</span>
    </span>
  )
}

/* ============================================================
   Первый экран: макет окна консультанта с плавающими карточками
   ============================================================ */

function HeroArt() {
  const t = useT(dict)
  const [ref, shown] = useOnScreen<HTMLDivElement>('0px')
  return (
    <div className="art" ref={ref} aria-hidden="true">
      <span className="art__blob art__blob--a" />
      <span className="art__blob art__blob--b" />
      <span className="art__blob art__blob--c" />
      <span className="art__grid" />

      <div className="win enter" style={step(4)}>
        <div className="win__bar">
          <span className="win__dot" />
          <span className="win__dot" />
          <span className="win__dot" />
          <span className="win__addr">tura.kz / chat</span>
        </div>
        <div className="win__body">
          <aside className="win__side">
            <span className="win__nav win__nav--on"><Icon name="chat" size={14} />{t('mockChat')}</span>
            <span className="win__nav"><Icon name="doc" size={14} />{t('mockDocs')}</span>
            <span className="win__nav"><Icon name="gavel" size={14} />{t('mockLaws')}</span>
            <span className="win__nav"><Icon name="chart" size={14} />{t('mockStats')}</span>
          </aside>
          <div className="win__main">
            <div className="win__q enter" style={step(8)}>{t('mockQ')}</div>
            <div className="win__a enter" style={step(12)}>
              <span className="win__avatar"><Icon name="sparkle" size={14} /></span>
              <div>
                <p className="win__text">
                  {t('mockA1')}<Norm code="ГК РК 178.1" />{t('mockA2')}<Norm code="ГК РК 180.1" />{t('mockA3')}
                </p>
                <div className="win__srcs">
                  <span className="win__srcs-label">{t('mockSrc')}</span>
                  <span className="win__src"><Norm code="ГК РК 178.1" /><span>{t('n178t')}</span></span>
                  <span className="win__src"><Norm code="ГК РК 180.1" /><span>{t('n180t')}</span></span>
                </div>
              </div>
            </div>
            <div className="win__ask">
              <span>{t('mockPlaceholder')}</span>
              <span className="win__send"><Icon name="arrow" size={14} /></span>
            </div>
          </div>
        </div>
      </div>

      <div className="float float--a enter" style={step(14)}>
        <Donut value={92} shown={shown} size={56} className="float__donut">92%</Donut>
        <div>
          <span className="float__title">{t('floatCheck')}</span>
          <span className="float__sub">{t('floatCheckD')}</span>
        </div>
      </div>

      <div className="float float--b enter" style={step(17)}>
        <span className="float__ok"><Icon name="check" size={16} /></span>
        <div>
          <span className="float__title">{t('floatNorm')}</span>
          <span className="float__sub">{t('floatNormD')}</span>
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   Лента актов и цифры
   ============================================================ */

const ACTS = [
  'Гражданский кодекс',
  'Трудовой кодекс',
  'Налоговый кодекс',
  'Предпринимательский кодекс',
  'АППК',
  'Земельный кодекс',
  'Кодекс о браке и семье',
  'Закон о госзакупках',
  'Закон о защите прав потребителей',
  'Жилищный кодекс',
  'Экологический кодекс',
  'Закон о персональных данных',
]

function Ticker() {
  const t = useT(dict)
  const row = [...ACTS, ...ACTS]
  return (
    <div className="ticker" aria-label={t('tickerLabel')}>
      <p className="ticker__label">{t('tickerLabel')}</p>
      <div className="ticker__mask">
        <div className="ticker__row">
          {row.map((a, i) => (
            <span className="ticker__item" key={i} aria-hidden={i >= ACTS.length ? 'true' : undefined}>
              <Icon name="doc" size={14} />
              {a}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function Counter({ to, suffix = '' }: { to: number; suffix?: string }) {
  const v = useCountUp(to, 1400)
  return (
    <>
      {Math.round(v).toLocaleString('ru-RU')}
      {suffix}
    </>
  )
}

const FIGS = [
  { n: 400, suffix: '+', cap: 'fig1' },
  { n: 13, suffix: '', cap: 'fig2' },
  { n: 9, suffix: '', cap: 'fig3' },
  { n: 3, suffix: '', cap: 'fig4' },
] as const

function Figures() {
  const t = useT(dict)
  const [ref, shown] = useOnScreen<HTMLDivElement>()
  return (
    <div className="figs" ref={ref}>
      {FIGS.map((f, i) => (
        <div className={['fig', shown ? 'enter-item' : 'pre-enter'].join(' ')} style={idx(i)} key={f.cap}>
          <span className="fig__num tabular">{shown ? <Counter to={f.n} suffix={f.suffix} /> : `0${f.suffix}`}</span>
          <span className="fig__cap">{t(f.cap)}</span>
        </div>
      ))}
    </div>
  )
}

/* ============================================================
   Как это работает: шаги и живая сцена
   ============================================================ */

const STEPS = [
  { icon: 'chat', name: 'step1', body: 'step1d', tone: 'sky' },
  { icon: 'search', name: 'step2', body: 'step2d', tone: 'lilac' },
  { icon: 'quote', name: 'step3', body: 'step3d', tone: 'mint' },
] as const

const FRAGS = [
  { act: 'pipeF1a', text: 'pipeF1t' },
  { act: 'pipeF2a', text: 'pipeF2t' },
  { act: 'pipeF3a', text: 'pipeF3t' },
] as const

/** Фаза сцены: 0 — не началась, 1 — набор вопроса, 2 — поиск, 3 — ответ. */
type Phase = 0 | 1 | 2 | 3

function Pipeline() {
  const t = useT(dict)
  const [ref, shown] = useOnScreen<HTMLDivElement>()
  const [phase, setPhase] = useState<Phase>(0)
  const [typed, setTyped] = useState(0)
  const [run, setRun] = useState(0)
  const timers = useRef<number[]>([])

  const question = t('pipeQ')
  const chars = Array.from(question)

  useEffect(() => {
    if (!shown) return
    const clear = () => {
      timers.current.forEach((id) => window.clearTimeout(id))
      timers.current = []
    }
    clear()

    if (reducedMotion()) {
      setTyped(chars.length)
      setPhase(3)
      return clear
    }

    const stagger = Math.max(tokenMs('--stagger'), 1)
    const dur3 = tokenMs('--dur-3')
    const at = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms))

    setTyped(0)
    setPhase(1)
    let clock = dur3
    for (let i = 1; i <= chars.length; i++) {
      clock += stagger * 0.7
      const n = i
      at(clock, () => setTyped(n))
    }
    clock += dur3 * 2
    at(clock, () => setPhase(2))
    clock += FRAGS.length * stagger + dur3 * 4
    at(clock, () => setPhase(3))

    return clear
    // chars.length зависит от языка: смена языка перезапускает сцену
  }, [shown, run, chars.length])

  const replay = useCallback(() => {
    setPhase(0)
    setRun((r) => r + 1)
  }, [])

  return (
    <div className="pipe" ref={ref}>
      <ol className="steps">
        {STEPS.map((s, i) => {
          const n = (i + 1) as Phase
          const cls = ['stepc', `stepc--${s.tone}`, phase >= n ? 'stepc--on' : '', phase === n ? 'stepc--now' : '']
          return (
            <li className={cls.filter(Boolean).join(' ')} key={s.name} aria-current={phase === n ? 'step' : undefined}>
              <span className="stepc__icon"><Icon name={s.icon} /></span>
              <span className="stepc__num">0{i + 1}</span>
              <h3 className="stepc__name">{t(s.name)}</h3>
              <p className="stepc__body">{t(s.body)}</p>
            </li>
          )
        })}
      </ol>

      <div className="scene" aria-live="polite">
        <div className={['scene__ask', phase >= 1 ? 'scene__ask--on' : ''].filter(Boolean).join(' ')}>
          <Icon name="search" size={18} className="scene__ask-ico" />
          <span className="scene__typed">
            {chars.slice(0, typed).join('')}
            {phase === 1 ? <span className="scene__caret" aria-hidden="true" /> : null}
          </span>
        </div>

        {phase >= 2 ? (
          <div className="scene__found" key={`f-${run}`}>
            <span className="scene__label">{t('pipeFound')}</span>
            <div className="scene__frags">
              {FRAGS.map((f, i) => (
                <div className="frag enter-item" style={idx(i)} key={f.act}>
                  <Icon name="doc" size={16} className="frag__ico" />
                  <span className="frag__act">{t(f.act)}</span>
                  <span className="frag__text">{t(f.text)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {phase >= 3 ? (
          <div className="scene__answer enter" key={`a-${run}`}>
            <span className="scene__label">{t('pipeAnswer')}</span>
            <p className="scene__text">
              {t('pipeA1')}<Norm code="ГК РК 556" />{t('pipeA2')}<Norm code="ГК РК 552" />{t('pipeA3')}
            </p>
            <button type="button" className="scene__again" onClick={replay}>
              <Icon name="play" size={16} />
              {t('pipeAgain')}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

/* ============================================================
   Модули: четыре карточки с мини-макетами
   ============================================================ */

function MiniChat() {
  const t = useT(dict)
  return (
    <div className="mini mini--chat">
      <div className="mini__q">{t('mcQ')}</div>
      <div className="mini__a">
        {t('mcA')}<Norm code="ТК РК 113.1" />.
      </div>
    </div>
  )
}

const FINDINGS = [
  { kind: 'err', mark: 'mkErr', text: 'mk1', cite: 'ГК РК 297' },
  { kind: 'warn', mark: 'mkWarn', text: 'mk2', cite: 'ГК РК 277' },
  { kind: 'ok', mark: 'mkOk', text: 'mk3', cite: 'ГК РК 359' },
] as const

function MiniContracts({ shown }: { shown: boolean }) {
  const t = useT(dict)
  return (
    <div className="mini mini--docs">
      <div className="mini__head">
        <Icon name="doc" size={16} />
        <span>{t('mkDoc')}</span>
        <Donut value={83} shown={shown} size={40} className="mini__donut">83</Donut>
      </div>
      {FINDINGS.map((f, i) => (
        <div className={['find', shown ? 'enter-item' : 'pre-enter'].join(' ')} style={idx(i)} key={f.cite}>
          <span className={`find__dot find__dot--${f.kind}`} />
          <span className="find__text">{t(f.text)}</span>
          <span className={`find__mark find__mark--${f.kind}`}>{t(f.mark)}</span>
        </div>
      ))}
    </div>
  )
}

const TOC = [
  { name: 'ml1', pct: 100 },
  { name: 'ml2', pct: 100 },
  { name: 'ml3', pct: 64 },
  { name: 'ml4', pct: 18 },
] as const

function MiniLaws({ shown }: { shown: boolean }) {
  const t = useT(dict)
  return (
    <div className="mini mini--laws">
      <div className="mini__head">
        <Icon name="gavel" size={16} />
        <span>{t('mlDoc')}</span>
      </div>
      <ol className="toc">
        {TOC.map((s, i) => (
          <li className="toc__row" key={s.name}>
            <span className="toc__num">{['I', 'II', 'III', 'IV'][i]}</span>
            <span className="toc__name">{t(s.name)}</span>
            <span className="toc__track">
              <span className="toc__fill" style={{ width: shown ? `${s.pct}%` : '0%', transitionDelay: `${i * 120}ms` }} />
            </span>
            <span className="toc__pct tabular">{s.pct}%</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

const TONE = [
  { k: 'pos', share: 54, label: 'maPos' },
  { k: 'neu', share: 31, label: 'maNeu' },
  { k: 'neg', share: 15, label: 'maNeg' },
] as const

const THEMES = [
  { name: 'ma1', count: 412 },
  { name: 'ma2', count: 287 },
  { name: 'ma3', count: 163 },
] as const

function MiniAnalytics({ shown }: { shown: boolean }) {
  const t = useT(dict)
  const top = THEMES[0].count
  return (
    <div className="mini mini--stats">
      <div className="stats__row">
        <span className="ring" aria-hidden="true">
          <svg viewBox="0 0 36 36">
            <circle className="ring__track" cx="18" cy="18" r="15.9155" />
            {TONE.reduce<{ off: number; nodes: ReactNode[] }>(
              (acc, s) => {
                acc.nodes.push(
                  <circle
                    key={s.k}
                    className={`ring__seg ring__seg--${s.k}`}
                    cx="18"
                    cy="18"
                    r="15.9155"
                    style={{
                      strokeDasharray: shown ? `${s.share} 100` : '0 100',
                      strokeDashoffset: -acc.off,
                    }}
                  />,
                )
                acc.off += s.share
                return acc
              },
              { off: 0, nodes: [] },
            ).nodes}
          </svg>
        </span>
        <ul className="legend">
          {TONE.map((s) => (
            <li key={s.k}>
              <span className={`legend__dot ring__seg--${s.k}`} />
              <span className="tabular">{s.share}%</span>
              <span className="legend__name">{t(s.label)}</span>
            </li>
          ))}
        </ul>
      </div>
      <span className="mini__label">{t('maTopics')}</span>
      <ol className="bars">
        {THEMES.map((th, i) => (
          <li className="bars__row" key={th.name}>
            <span className="bars__name">{t(th.name)}</span>
            <span className="bars__track">
              <span
                className="bars__fill"
                style={{ width: shown ? `${(th.count / top) * 100}%` : '0%', transitionDelay: `${i * 120}ms` }}
              />
            </span>
            <span className="bars__num tabular">{th.count}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

const MODS = [
  { id: 'chat', icon: 'chat', name: 'mod1', body: 'mod1d', to: '/chat', tone: 'sky' },
  { id: 'docs', icon: 'doc', name: 'mod2', body: 'mod2d', to: '/contracts', tone: 'peach' },
  { id: 'laws', icon: 'gavel', name: 'mod3', body: 'mod3d', to: '/laws', tone: 'lilac' },
  { id: 'stats', icon: 'chart', name: 'mod4', body: 'mod4d', to: '/analytics', tone: 'mint' },
] as const

function Modules() {
  const t = useT(dict)
  const [ref, shown] = useOnScreen<HTMLDivElement>()
  return (
    <div className="mods" ref={ref}>
      {MODS.map((m, i) => (
        <Link
          to={m.to}
          className={['modc', `modc--${m.tone}`, shown ? 'enter-item' : 'pre-enter'].join(' ')}
          style={idx(i)}
          key={m.id}
        >
          <div className="modc__head">
            <span className="modc__icon"><Icon name={m.icon} /></span>
            <div>
              <h3 className="modc__name">{t(m.name)}</h3>
              <p className="modc__body">{t(m.body)}</p>
            </div>
          </div>
          <div className="modc__art" aria-hidden="true">
            {m.id === 'chat' ? <MiniChat /> : null}
            {m.id === 'docs' ? <MiniContracts shown={shown} /> : null}
            {m.id === 'laws' ? <MiniLaws shown={shown} /> : null}
            {m.id === 'stats' ? <MiniAnalytics shown={shown} /> : null}
          </div>
          <span className="modc__open">
            {t('modOpen')}
            <Icon name="arrow" size={16} />
          </span>
        </Link>
      ))}
    </div>
  )
}

/* ============================================================
   Аудитории
   ============================================================ */

const AUD = [
  { icon: 'gov', who: 'who1', body: 'who1d', tone: 'sky' },
  { icon: 'scale', who: 'who2', body: 'who2d', tone: 'lilac' },
  { icon: 'case', who: 'who3', body: 'who3d', tone: 'peach' },
  { icon: 'person', who: 'who4', body: 'who4d', tone: 'mint' },
] as const

function Audiences() {
  const t = useT(dict)
  const [ref, shown] = useOnScreen<HTMLDivElement>()
  return (
    <div className="aud" ref={ref}>
      {AUD.map((a, i) => (
        <div className={['audc', shown ? 'enter-item' : 'pre-enter'].join(' ')} style={idx(i)} key={a.who}>
          <span className={`audc__icon audc__icon--${a.tone}`}><Icon name={a.icon} size={24} /></span>
          <h3 className="audc__name">{t(a.who)}</h3>
          <p className="audc__body">{t(a.body)}</p>
        </div>
      ))}
    </div>
  )
}

/* ============================================================
   Доверие: схема «вопрос → нормы → ответ» дорисовывается на экране
   ============================================================ */

const TRUST = [
  { icon: 'search', term: 'trust1', def: 'trust1d' },
  { icon: 'pin', term: 'trust2', def: 'trust2d' },
  { icon: 'clock', term: 'trust3', def: 'trust3d' },
  { icon: 'lock', term: 'trust4', def: 'trust4d' },
] as const

function TrustDiagram({ shown }: { shown: boolean }) {
  const t = useT(dict)
  const cls = ['diag', shown ? 'diag--on' : ''].filter(Boolean).join(' ')
  return (
    <div className={cls} aria-hidden="true">
      <svg viewBox="0 0 520 300" className="diag__svg">
        {/* линии: от вопроса к трём нормам и от норм к ответу */}
        <path className="diag__line" pathLength="1" d="M120 150 C 170 150, 180 70, 235 70" />
        <path className="diag__line" pathLength="1" d="M120 150 L 235 150" />
        <path className="diag__line" pathLength="1" d="M120 150 C 170 150, 180 230, 235 230" />
        <path className="diag__line diag__line--late" pathLength="1" d="M345 70 C 380 70, 390 150, 430 150" />
        <path className="diag__line diag__line--late" pathLength="1" d="M345 150 L 430 150" />
        <path className="diag__line diag__line--late" pathLength="1" d="M345 230 C 380 230, 390 150, 430 150" />
      </svg>
      <div className="diag__node diag__node--q">
        <Icon name="chat" size={18} />
        <span>{t('diagQ')}</span>
      </div>
      <div className="diag__src diag__src--1"><Norm code="ГК РК 178.1" /><span className="diag__check"><Icon name="check" size={12} /></span></div>
      <div className="diag__src diag__src--2"><Norm code="ГК РК 180.1" /><span className="diag__check"><Icon name="check" size={12} /></span></div>
      <div className="diag__src diag__src--3"><Norm code="ГК РК 159.11" /><span className="diag__check"><Icon name="check" size={12} /></span></div>
      <span className="diag__cap">{t('diagS')} · {t('diagV')}</span>
      <div className="diag__node diag__node--a">
        <Icon name="sparkle" size={18} />
        <span>{t('diagA')}</span>
      </div>
    </div>
  )
}

/* ============================================================
   Страница
   ============================================================ */

export function HomePage() {
  const t = useT(dict)
  const [trustRef, trustShown] = useOnScreen<HTMLDivElement>()

  /** Якорь «Как это работает» ведёт к разделу, а не только меняет адрес. */
  const toHow = useCallback((e: MouseEvent<HTMLAnchorElement>) => {
    const el = document.getElementById('how')
    if (!el) return
    e.preventDefault()
    el.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' })
  }, [])

  return (
    <PublicPage variant="home">
      <div className="home">
        {/* ---------- Первый экран ---------- */}
        <section className="hero" aria-labelledby="hero-title">
          <div className="pub-wrap hero__grid">
            <div className="hero__copy">
              <span className="pill enter">
                <span className="pill__dot" />
                {t('eyebrow')}
              </span>
              <h1 className="hero__title enter" id="hero-title" style={step(2)}>
                {t('h1a')} <span className="hero__accent">{t('h1b')}</span>
              </h1>
              <p className="hero__lede enter" style={step(4)}>
                {t('lede')}
              </p>
              <div className="hero__actions enter" style={step(6)}>
                <Link to="/register" className="hbtn hbtn--primary">
                  {t('ctaMain')}
                  <Icon name="arrow" size={18} />
                </Link>
                <a href="#how" className="hbtn hbtn--ghost" onClick={toHow}>
                  <span className="hbtn__play"><Icon name="play" size={14} /></span>
                  {t('ctaHow')}
                </a>
              </div>
              <ul className="perks enter" style={step(8)}>
                <li><Icon name="lang" size={18} /><span><b>{t('perk1')}</b> {t('perk1d')}</span></li>
                <li><Icon name="pin" size={18} /><span><b>{t('perk2')}</b> {t('perk2d')}</span></li>
                <li><Icon name="shield" size={18} /><span><b>{t('perk3')}</b> {t('perk3d')}</span></li>
              </ul>
            </div>
            <HeroArt />
          </div>
        </section>

        {/* ---------- Лента актов и цифры ---------- */}
        <section className="band band--soft" aria-label={t('tickerLabel')}>
          <Ticker />
          <div className="pub-wrap">
            <Figures />
          </div>
        </section>

        {/* ---------- Как это работает ---------- */}
        <Reveal as="section" className="pub-wrap sec" id="how" aria-labelledby="how-title">
          <div className="sec__head">
            <span className="sec__num">01</span>
            <div>
              <h2 className="sec__title" id="how-title">{t('howTitle')}</h2>
              <p className="sec__note">{t('howNote')}</p>
            </div>
          </div>
          <Pipeline />
        </Reveal>

        {/* ---------- Модули ---------- */}
        <section className="band band--soft">
          <Reveal as="div" className="pub-wrap sec" aria-labelledby="mods-title">
            <div className="sec__head">
              <span className="sec__num">02</span>
              <div>
                <h2 className="sec__title" id="mods-title">{t('modsTitle')}</h2>
                <p className="sec__note">{t('modsNote')}</p>
              </div>
            </div>
            <Modules />
          </Reveal>
        </section>

        {/* ---------- Кому это нужно ---------- */}
        <Reveal as="section" className="pub-wrap sec" aria-labelledby="who-title">
          <div className="sec__head">
            <span className="sec__num">03</span>
            <div>
              <h2 className="sec__title" id="who-title">{t('whoTitle')}</h2>
              <p className="sec__note">{t('whoNote')}</p>
            </div>
          </div>
          <Audiences />
        </Reveal>

        {/* ---------- Почему можно верить ---------- */}
        <section className="band band--soft">
          <Reveal as="div" className="pub-wrap sec" aria-labelledby="trust-title">
            <div className="sec__head">
              <span className="sec__num">04</span>
              <div>
                <h2 className="sec__title" id="trust-title">{t('trustTitle')}</h2>
              </div>
            </div>
            <div className="trust" ref={trustRef}>
              <div className="trust__side">
                <p className="trust__claim">{t('trustClaim')}</p>
                <p className="trust__note">{t('trustNote')}</p>
                <TrustDiagram shown={trustShown} />
              </div>
              <ul className="trust__list">
                {TRUST.map((it, i) => (
                  <li className={['trustc', trustShown ? 'enter-item' : 'pre-enter'].join(' ')} style={idx(i)} key={it.term}>
                    <span className="trustc__icon"><Icon name={it.icon} /></span>
                    <div>
                      <h3 className="trustc__term">{t(it.term)}</h3>
                      <p className="trustc__def">{t(it.def)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </section>

        {/* ---------- Призыв ---------- */}
        <Reveal as="section" className="pub-wrap sec sec--cta" aria-labelledby="cta-title">
          <div className="cta">
            <span className="cta__blob cta__blob--a" aria-hidden="true" />
            <span className="cta__blob cta__blob--b" aria-hidden="true" />
            <h2 className="cta__title" id="cta-title">{t('finalTitle')}</h2>
            <p className="cta__lede">{t('finalLede')}</p>
            <div className="cta__actions">
              <Link to="/register" className="hbtn hbtn--light">
                {t('ctaMain')}
                <Icon name="arrow" size={18} />
              </Link>
              <Link to="/about" className="hbtn hbtn--outline">
                {t('finalAbout')}
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </PublicPage>
  )
}
