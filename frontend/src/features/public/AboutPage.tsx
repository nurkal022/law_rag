import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { Link } from '../../shared/nav'
import { Reveal } from '../../shared/motion'
import { Body, Caption, Cite, H2, Label, Legal } from '../../shared/ui'
import { useLang, useT } from '../../i18n'
import type { Dict } from '../../i18n'
import { citeCode } from '../legal/cite'
import { PublicPage } from './PublicChrome'
import './public.css'
import './public.motion.css'

/**
 * «О проекте» — спокойная типографическая страница.
 *
 * Ширина смыслового текста ограничена var(--measure): страницу читают подряд,
 * а не просматривают. Ни карточек, ни иллюстраций — только линии и набор.
 */

const dict: Dict = {
  eyebrow: { ru: 'О проекте', kz: 'Жоба туралы', en: 'About the project' },
  title: {
    ru: 'Право не должно быть привилегией',
    kz: 'Құқық артықшылық болмауға тиіс',
    en: 'Law should not be a privilege',
  },
  lede: {
    ru: 'TURA — правовая система для Казахстана. Она отвечает на вопрос по действующим нормативным актам Республики Казахстан и указывает источник каждого утверждения, чтобы ответ можно было проверить, а не принять на веру.',
    kz: 'TURA — Қазақстанға арналған құқықтық жүйе. Ол Қазақстан Республикасының қолданыстағы нормативтік актілері бойынша сұраққа жауап беріп, әрбір тұжырымның дереккөзін көрсетеді: жауапты сеніммен қабылдамай, тексеруге болады.',
    en: 'TURA is a legal system for Kazakhstan. It answers questions from the regulatory acts of the Republic in force and names the source of every statement, so the answer can be checked rather than taken on trust.',
  },

  /* ---- Задача ---- */
  taskTitle: { ru: 'Задача', kz: 'Міндет', en: 'The problem' },
  task1: {
    ru: 'Казахстанское законодательство — это тысячи нормативных актов, указов, постановлений и регламентов. Чтобы найти нужную норму в правовой базе, надо заранее знать точный термин или номер статьи. Тот, кто их не знает, ищет часами и всё равно не уверен, что нашёл действующую редакцию.',
    kz: 'Қазақстан заңнамасы — мыңдаған нормативтік акт, жарлық, қаулы және регламент. Құқықтық базадан қажет норманы табу үшін нақты терминді немесе бап нөмірін алдын ала білу керек. Оны білмейтін адам сағаттап іздейді және тапқаны қолданыстағы редакция екеніне бәрібір сенімді бола алмайды.',
    en: 'Kazakhstani legislation runs to thousands of acts, decrees, resolutions and regulations. Finding the right norm in a legal database presumes you already know the exact term or article number. Whoever does not spends hours searching and still cannot be sure the wording is the one in force.',
  },
  task2: {
    ru: 'Для юриста это рутина, которая съедает рабочий день. Для государственного служащего — недели на подготовку одного законопроекта. Для гражданина и малого бизнеса — барьер, из-за которого право остаётся недоступным без посредника.',
    kz: 'Заңгер үшін бұл жұмыс күнін жеп қоятын күнделікті ұсақ жұмыс. Мемлекеттік қызметші үшін — бір заң жобасын дайындауға кететін апталар. Азамат пен шағын бизнес үшін — құқықты делдалсыз қолжетімсіз ететін кедергі.',
    en: 'For a lawyer that is routine work eating up the day. For a civil servant it is weeks spent preparing a single draft law. For a citizen or a small business it is the barrier that keeps law out of reach without an intermediary.',
  },
  task3: {
    ru: 'TURA убирает не право, а посредника между вопросом и нормой.',
    kz: 'TURA құқықты емес, сұрақ пен норманың арасындағы делдалды алып тастайды.',
    en: 'TURA removes not the law but the intermediary between a question and the norm.',
  },

  /* ---- Технология ---- */
  techTitle: { ru: 'Как устроена технология', kz: 'Технология қалай құрылған', en: 'How the technology works' },
  tech1: {
    ru: 'Языковая модель, предоставленная сама себе, отвечает по памяти обучения и способна уверенно назвать статью, которой не существует. В праве это неприемлемо: ошибка выглядит так же убедительно, как верный ответ.',
    kz: 'Өз бетінше қалдырылған тілдік модель оқу барысындағы жадына сүйеніп жауап береді және жоқ бапты сеніммен атап кетуі мүмкін. Құқықта бұл мүмкін емес: қате жауап дұрысы сияқты сенімді көрінеді.',
    en: 'A language model left to itself answers from training memory and can name, with total confidence, an article that does not exist. In law that is unacceptable: the error looks exactly as convincing as the correct answer.',
  },
  tech2: {
    ru: 'Поэтому в основе TURA лежит поиск с последующей генерацией — RAG. Простыми словами: прежде чем отвечать, система читает документы.',
    kz: 'Сондықтан TURA-ның негізінде іздеу мен одан кейінгі генерация — RAG жатыр. Қарапайым тілмен: жауап берер алдында жүйе құжаттарды оқиды.',
    en: 'That is why TURA is built on retrieval-augmented generation — RAG. In plain words: before answering, the system reads the documents.',
  },
  flow1: {
    ru: 'Правовые акты разбиваются на смысловые фрагменты и индексируются — так, чтобы искать по смыслу, а не по совпадению слов.',
    kz: 'Құқықтық актілер мағыналық үзінділерге бөлініп индекстеледі — сөз сәйкестігі бойынша емес, мағына бойынша іздеу үшін.',
    en: 'Legal acts are split into meaningful passages and indexed, so that search runs on meaning rather than on matching words.',
  },
  flow2: {
    ru: 'Вопрос переводится в тот же вид, и по базе отбираются фрагменты, относящиеся к делу.',
    kz: 'Сұрақ дәл сол пішімге түрлендіріледі және базадан іске қатысы бар үзінділер таңдалады.',
    en: 'The question is converted into the same form, and the passages relevant to the matter are drawn from the base.',
  },
  flow3: {
    ru: 'Модель формулирует ответ только по отобранным фрагментам и проставляет ссылку на каждый использованный источник.',
    kz: 'Модель жауапты тек таңдалған үзінділер бойынша тұжырымдап, пайдаланылған әрбір дереккөзге сілтеме қояды.',
    en: 'The model composes an answer strictly from the selected passages and cites each source it used.',
  },
  flow4: {
    ru: 'Если основания в базе нет, система сообщает об этом, а не достраивает ответ по догадке.',
    kz: 'Егер базада негіз болмаса, жүйе жауапты болжаммен толықтырмай, бұл туралы хабарлайды.',
    en: 'Where the base holds no basis, the system says so instead of completing the answer by guesswork.',
  },
  tech3: {
    ru: 'Модель у проекта своя — дообученная на казахстанских правовых текстах и работающая на собственных серверах. Это даёт два следствия: система знает терминологию РК и структуру наших нормативных актов, а документы пользователей не покидают контур и не уходят во внешние облака.',
    kz: 'Жобаның моделі өзінікі — қазақстандық құқықтық мәтіндерде қосымша оқытылған және меншікті серверлерде жұмыс істейді. Бұдан екі салдар шығады: жүйе ҚР терминологиясы мен нормативтік актілеріміздің құрылымын біледі, ал пайдаланушылардың құжаттары контурдан шықпайды және сыртқы бұлттарға кетпейді.',
    en: 'The project runs its own model — further trained on Kazakhstani legal texts and served from our own machines. Two consequences follow: the system knows the terminology and the structure of our regulatory acts, and user documents never leave the perimeter for an external cloud.',
  },
  tech4pre: {
    ru: 'Правовая координата вида ',
    kz: 'Мына түрдегі құқықтық координата ',
    en: 'A legal coordinate such as ',
  },
  tech4post: {
    ru: ' набирается моноширинным во всём продукте. Это не украшение: моноширинный отделяет адресуемую норму от человеческого текста, и глаз находит ссылку без цветового выделения.',
    kz: ' бүкіл өнімде ені бірдей қаріппен теріледі. Бұл әшекей емес: ондай қаріп адресі бар норманы адам мәтінінен ажыратады, көз сілтемені түспен ерекшелеусіз табады.',
    en: ' is set in monospace throughout the product. That is not decoration: monospace separates the addressable norm from human prose, and the eye finds the reference without a colour cue.',
  },

  /* ---- Факты ---- */
  factsTitle: { ru: 'Коротко о системе', kz: 'Жүйе туралы қысқаша', en: 'The system in brief' },
  factBaseK: { ru: 'База документов', kz: 'Құжаттар базасы', en: 'Document base' },
  factBaseV: {
    ru: 'Более 400 действующих правовых актов Республики Казахстан, база пополняется',
    kz: 'Қазақстан Республикасының 400-ден астам қолданыстағы құқықтық актісі, база толықтырылып отырады',
    en: 'Over 400 legal acts of the Republic of Kazakhstan in force; the base keeps growing',
  },
  factLangK: { ru: 'Языки', kz: 'Тілдер', en: 'Languages' },
  factLangV: {
    ru: 'Казахский и русский — в вопросе, ответе и поиске; интерфейс также на английском',
    kz: 'Қазақ және орыс — сұрақта, жауапта және іздеуде; интерфейс ағылшынша да бар',
    en: 'Kazakh and Russian in question, answer and retrieval; the interface is also in English',
  },
  factModK: { ru: 'Модули', kz: 'Модульдер', en: 'Modules' },
  factModV: {
    ru: 'Консультант, конструктор договоров, генератор законопроектов, правовая аналитика',
    kz: 'Кеңесші, шарт құрастырушы, заң жобаларының генераторы, құқықтық талдау',
    en: 'Assistant, contract builder, draft law generator, legal analytics',
  },
  factDataK: { ru: 'Обработка данных', kz: 'Деректерді өңдеу', en: 'Data processing' },
  factDataV: {
    ru: 'Локальная, на собственных серверах, без передачи во внешние сервисы',
    kz: 'Жергілікті, меншікті серверлерде, сыртқы сервистерге берілмейді',
    en: 'Local, on our own servers, with no transfer to outside services',
  },
  factExportK: { ru: 'Выгрузка', kz: 'Жүктеп алу', en: 'Export' },
  factExportV: {
    ru: 'PDF, DOCX и XLSX — в форматах, пригодных для официальной подачи',
    kz: 'PDF, DOCX және XLSX — ресми тапсыруға жарамды пішімдерде',
    en: 'PDF, DOCX and XLSX — in the formats required for official filing',
  },

  /* ---- Кто делал ---- */
  teamTitle: { ru: 'Кто делает проект', kz: 'Жобаны кім жасайды', en: 'Who builds it' },
  team1: {
    ru: 'TURA делает небольшая команда разработчиков и юристов из Казахстана. Инженерная часть — поиск, модель, инфраструктура; правовая — отбор источников, разбор терминологии и проверка того, что система отвечает по действующей редакции документа.',
    kz: 'TURA-ны Қазақстандағы шағын әзірлеушілер мен заңгерлер тобы жасайды. Инженерлік бөлігі — іздеу, модель, инфрақұрылым; құқықтық бөлігі — дереккөздерді іріктеу, терминологияны талдау және жүйенің құжаттың қолданыстағы редакциясы бойынша жауап беретінін тексеру.',
    en: 'TURA is built by a small team of engineers and lawyers in Kazakhstan. The engineering side covers retrieval, the model and the infrastructure; the legal side selects sources, works through terminology and verifies that answers follow the wording currently in force.',
  },
  team2: {
    ru: 'Проект развивается открыто к замечаниям: если система ошиблась в норме, об этом стоит написать — исправление источника важнее любой формулировки.',
    kz: 'Жоба ескертпелерге ашық дамиды: егер жүйе нормада қателессе, бұл туралы жазған жөн — дереккөзді түзету кез келген тұжырымнан маңызды.',
    en: 'The project develops in the open to correction: if the system gets a norm wrong, write in — fixing the source matters more than any turn of phrase.',
  },


  /* ---- Условия использования ---- */
  termsTitle: { ru: 'Условия использования', kz: 'Пайдалану шарттары', en: 'Terms of use' },
  termsLede: {
    ru: 'Коротко и без мелкого шрифта: чем является сервис, чего от него ждать нельзя и что остаётся вашим. Пользуясь TURA, вы принимаете эти условия.',
    kz: 'Қысқа әрі ұсақ қаріпсіз: сервис не болып табылады, одан нені күтуге болмайды және не сіздікі болып қалады. TURA-ны пайдалана отырып, сіз осы шарттарды қабылдайсыз.',
    en: 'Short, and with no fine print: what the service is, what it must not be expected to do, and what stays yours. By using TURA you accept these terms.',
  },
  tm1k: { ru: 'Что это за сервис.', kz: 'Бұл қандай сервис.', en: 'What the service is.' },
  tm1d: {
    ru: 'TURA — информационная система: она готовит справку по действующим правовым актам Республики Казахстан и указывает источник каждого утверждения. Это инструмент работы с текстами права, а не оказание юридической помощи.',
    kz: 'TURA — ақпараттық жүйе: ол Қазақстан Республикасының қолданыстағы құқықтық актілері бойынша анықтама дайындап, әрбір тұжырымның дереккөзін көрсетеді. Бұл құқық мәтіндерімен жұмыс істеу құралы, заң көмегін көрсету емес.',
    en: 'TURA is an information system: it prepares a summary from the legal acts of the Republic of Kazakhstan in force and names the source of every statement. It is a tool for working with legal texts, not the provision of legal assistance.',
  },
  tm2k: { ru: 'Ответ требует проверки человеком.', kz: 'Жауапты адам тексеруі керек.', en: 'The answer needs a human check.' },
  tm2d: {
    ru: 'Ответ системы не является юридической консультацией и не заменяет решение суда или уполномоченного органа. Перед применением сверяйте норму с официальной редакцией документа, а в спорной ситуации обращайтесь к юристу. Решение, принятое на основании ответа, остаётся вашим решением.',
    kz: 'Жүйенің жауабы заң консультациясы болып табылмайды және соттың не уәкілетті органның шешімін алмастырмайды. Қолданар алдында норманы құжаттың ресми редакциясымен салыстырыңыз, ал даулы жағдайда заңгерге жүгініңіз. Жауап негізінде қабылданған шешім сіздің шешіміңіз болып қала береді.',
    en: 'An answer from the system is not legal advice and does not replace a decision of a court or a competent authority. Check the norm against the official wording before you rely on it, and consult a lawyer where the matter is contested. A decision taken on the basis of an answer remains your decision.',
  },
  tm3k: { ru: 'Учётная запись.', kz: 'Тіркелгі.', en: 'Your account.' },
  tm3d: {
    ru: 'Одна учётная запись принадлежит одному человеку. Вы отвечаете за сохранность пароля и за действия, совершённые под вашей учётной записью; о доступе посторонних сообщите нам.',
    kz: 'Бір тіркелгі бір адамға тиесілі. Құпиясөздің сақталуына және тіркелгіңіз арқылы жасалған әрекеттерге сіз жауап бересіз; бөгде адамның кіргені туралы бізге хабарлаңыз.',
    en: 'One account belongs to one person. You are responsible for keeping the password safe and for what is done under your account; tell us if someone else gains access.',
  },
  tm4k: { ru: 'Чего делать нельзя.', kz: 'Не істеуге болмайды.', en: 'What is not allowed.' },
  tm4d: {
    ru: 'Загружать материалы, права на которые вам не принадлежат; использовать сервис для нарушения закона; выгружать базу автоматическими средствами и создавать нагрузку, мешающую работе других пользователей.',
    kz: 'Құқығы сізге тиесілі емес материалдарды жүктеу; сервисті заңды бұзу үшін пайдалану; базаны автоматты құралдармен жүктеп алу және басқа пайдаланушылардың жұмысына кедергі келтіретін жүктеме тудыру.',
    en: 'Uploading material you hold no rights to; using the service to break the law; harvesting the base by automated means or creating a load that disrupts other users.',
  },
  tm5k: { ru: 'Ваши документы остаются вашими.', kz: 'Құжаттарыңыз өзіңізде қалады.', en: 'Your documents stay yours.' },
  tm5d: {
    ru: 'Мы не приобретаем прав на загруженные вами файлы и переписку и не передаём их третьим лицам. Подробности — в политике конфиденциальности ниже.',
    kz: 'Сіз жүктеген файлдар мен хат алмасуға біз құқық иеленбейміз және оларды үшінші тұлғаларға бермейміз. Егжей-тегжейі — төмендегі құпиялылық саясатында.',
    en: 'We acquire no rights over the files and conversations you upload, and we do not pass them to third parties. The detail is in the privacy policy below.',
  },
  tm6k: { ru: 'Доступность и изменения.', kz: 'Қолжетімділік және өзгерістер.', en: 'Availability and changes.' },
  tm6d: {
    ru: 'Сервис развивается: разделы могут меняться, а работа — прерываться на обслуживание. Существенные изменения условий публикуются на этой странице; дата редакции указана в конце раздела.',
    kz: 'Сервис дамып отырады: бөлімдер өзгеруі, ал жұмыс техникалық қызмет көрсетуге үзілуі мүмкін. Шарттардың елеулі өзгерістері осы бетте жарияланады; редакция күні бөлімнің соңында көрсетілген.',
    en: 'The service keeps developing: sections may change and the service may pause for maintenance. Material changes to these terms are published on this page; the revision date is given at the end of the section.',
  },
  tm7k: { ru: 'Применимое право.', kz: 'Қолданылатын құқық.', en: 'Governing law.' },
  tm7d: {
    ru: 'К настоящим условиям применяется право Республики Казахстан. Споры разрешаются в судах Республики Казахстан.',
    kz: 'Осы шарттарға Қазақстан Республикасының құқығы қолданылады. Даулар Қазақстан Республикасының соттарында шешіледі.',
    en: 'These terms are governed by the law of the Republic of Kazakhstan. Disputes are heard in the courts of the Republic of Kazakhstan.',
  },

  /* ---- Политика конфиденциальности ---- */
  privTitle: { ru: 'Политика конфиденциальности', kz: 'Құпиялылық саясаты', en: 'Privacy policy' },
  privLede: {
    ru: 'Главное в одном предложении: ваши вопросы и документы обрабатываются в инфраструктуре проекта и не передаются третьим лицам.',
    kz: 'Ең бастысы бір сөйлеммен: сіздің сұрақтарыңыз бен құжаттарыңыз жобаның инфрақұрылымында өңделеді және үшінші тұлғаларға берілмейді.',
    en: 'The essential point in one sentence: your questions and documents are processed inside the project’s own infrastructure and are not passed to third parties.',
  },
  pv1k: { ru: 'Какие данные собираются.', kz: 'Қандай деректер жиналады.', en: 'What is collected.' },
  pv1d: {
    ru: 'Имя и адрес почты при регистрации; содержание ваших запросов и загруженных документов; технические записи о работе сервиса — время обращения, ошибки, сведения о сеансе. Файлы cookie используются только для входа и сохранения языка, рекламных счётчиков нет.',
    kz: 'Тіркелу кезіндегі аты-жөні мен пошта мекенжайы; сұрауларыңыз бен жүктелген құжаттардың мазмұны; сервистің жұмысы туралы техникалық жазбалар — жүгіну уақыты, қателер, сеанс туралы мәліметтер. Cookie файлдары тек кіру мен тілді сақтау үшін пайдаланылады, жарнамалық санауыштар жоқ.',
    en: 'Your name and email at registration; the content of your queries and uploaded documents; technical records of the service — request time, errors, session data. Cookies are used only for signing in and remembering the language; there are no advertising trackers.',
  },
  pv2k: { ru: 'Зачем они нужны.', kz: 'Олар не үшін қажет.', en: 'Why they are needed.' },
  pv2d: {
    ru: 'Чтобы отвечать на ваши вопросы, хранить вашу переписку, документы и дела между сеансами и поддерживать работоспособность и безопасность сервиса. Для других целей данные не используются.',
    kz: 'Сұрақтарыңызға жауап беру, хат алмасуыңызды, құжаттарыңыз бен істеріңізді сеанстар арасында сақтау және сервистің жұмысы мен қауіпсіздігін қамтамасыз ету үшін. Басқа мақсатта деректер пайдаланылмайды.',
    en: 'To answer your questions, to keep your conversations, documents and matters between sessions, and to keep the service running and secure. The data is not used for anything else.',
  },
  pv3k: { ru: 'Где идёт обработка.', kz: 'Өңдеу қайда жүреді.', en: 'Where processing happens.' },
  pv3d: {
    ru: 'Запросы и документы обрабатываются в инфраструктуре проекта — на собственных серверах, и не передаются третьим лицам. Мы не отправляем ваши тексты во внешние облачные сервисы обработки: модель работает внутри контура.',
    kz: 'Сұраулар мен құжаттар жобаның инфрақұрылымында — меншікті серверлерде өңделеді және үшінші тұлғаларға берілмейді. Мәтіндеріңізді сыртқы бұлттық өңдеу сервистеріне жібермейміз: модель контурдың ішінде жұмыс істейді.',
    en: 'Queries and documents are processed inside the project’s infrastructure — on our own servers — and are not passed to third parties. We do not send your texts to external cloud processing services: the model runs inside the perimeter.',
  },
  pv4k: { ru: 'Обучение модели.', kz: 'Модельді оқыту.', en: 'Training the model.' },
  pv4d: {
    ru: 'Содержимое ваших документов и переписки не используется для дообучения модели без вашего отдельного согласия, данного явно.',
    kz: 'Құжаттарыңыз бен хат алмасуыңыздың мазмұны айқын білдірілген жеке келісіміңізсіз модельді қосымша оқыту үшін пайдаланылмайды.',
    en: 'The content of your documents and conversations is not used to train the model without your separate, explicit consent.',
  },
  pv5k: { ru: 'Сколько хранится.', kz: 'Қанша уақыт сақталады.', en: 'How long it is kept.' },
  pv5d: {
    ru: 'Пока существует ваша учётная запись. Удалённые документы, дела и переписка убираются из базы сразу, из резервных копий — в течение тридцати дней.',
    kz: 'Тіркелгіңіз болғанша. Жойылған құжаттар, істер мен хат алмасу базадан бірден, сақтық көшірмелерден отыз күн ішінде алынады.',
    en: 'For as long as your account exists. Deleted documents, matters and conversations leave the database at once and the backups within thirty days.',
  },
  pv6k: { ru: 'Ваши права.', kz: 'Сіздің құқықтарыңыз.', en: 'Your rights.' },
  pv6d: {
    ru: 'Вы можете получить копию своих данных, исправить их или удалить учётную запись вместе с содержимым — напишите на hello@tura.kz, ответ приходит в течение рабочей недели.',
    kz: 'Деректеріңіздің көшірмесін алуға, оларды түзетуге немесе тіркелгіні мазмұнымен бірге жоюға болады — hello@tura.kz мекенжайына жазыңыз, жауап бір жұмыс аптасы ішінде келеді.',
    en: 'You may obtain a copy of your data, correct it, or delete your account together with its content — write to hello@tura.kz and we answer within a working week.',
  },
  pv7k: { ru: 'Когда данные могут быть раскрыты.', kz: 'Деректер қашан ашылуы мүмкін.', en: 'When data may be disclosed.' },
  pv7d: {
    ru: 'Только по мотивированному требованию уполномоченного органа в порядке, предусмотренном законодательством Республики Казахстан. О таком требовании мы уведомляем пользователя, если закон это позволяет.',
    kz: 'Тек уәкілетті органның Қазақстан Республикасының заңнамасында көзделген тәртіппен қойған дәлелді талабы бойынша. Заң рұқсат етсе, мұндай талап туралы пайдаланушыны хабардар етеміз.',
    en: 'Only on a reasoned demand from a competent authority in the manner provided by the law of the Republic of Kazakhstan. Where the law permits, we notify the user of such a demand.',
  },
  revDate: {
    ru: 'Редакция от 5 сентября 2026 года',
    kz: '2026 жылғы 5 қыркүйектегі редакция',
    en: 'Revision of 5 September 2026',
  },

  /* ---- Оговорка ---- */
  discTitle: { ru: 'Оговорка', kz: 'Ескертпе', en: 'Disclaimer' },
  disc: {
    ru: 'Ответ TURA — справка по правовым актам, а не юридическая консультация. Он не заменяет решение уполномоченного органа или суда и не учитывает всех обстоятельств конкретного дела. Перед применением сверяйтесь с официальной редакцией документа, а в спорной ситуации обращайтесь к юристу.',
    kz: 'TURA жауабы — құқықтық актілер бойынша анықтама, заң консультациясы емес. Ол уәкілетті органның не соттың шешімін алмастырмайды және нақты істің барлық мән-жайын ескермейді. Қолданар алдында құжаттың ресми редакциясымен салыстырыңыз, ал даулы жағдайда заңгерге жүгініңіз.',
    en: 'A TURA answer is a summary of legal acts, not legal advice. It does not replace a decision of a competent authority or a court, and it does not account for every circumstance of a particular case. Check the official wording before relying on it, and consult a lawyer where the matter is contested.',
  },

  /* ---- Контакты ---- */
  contactsTitle: { ru: 'Контакты', kz: 'Байланыс', en: 'Contacts' },
  contactMailK: { ru: 'Почта', kz: 'Пошта', en: 'Email' },
  contactPressK: { ru: 'Сотрудничество', kz: 'Ынтымақтастық', en: 'Partnerships' },
  contactErrK: { ru: 'Сообщить об ошибке', kz: 'Қате туралы хабарлау', en: 'Report an error' },
  contactErrV: {
    ru: 'Напишите на почту и приложите вопрос и ответ системы',
    kz: 'Поштаға жазып, сұрақ пен жүйенің жауабын қоса жіберіңіз',
    en: 'Write to us and attach the question and the system’s answer',
  },
  contactGeoK: { ru: 'Юрисдикция', kz: 'Юрисдикция', en: 'Jurisdiction' },
  contactGeoV: { ru: 'Республика Казахстан', kz: 'Қазақстан Республикасы', en: 'Republic of Kazakhstan' },

  ctaTitle: {
    ru: 'Проверьте систему на своём вопросе',
    kz: 'Жүйені өз сұрағыңызбен тексеріңіз',
    en: 'Test the system on a question of your own',
  },
  ctaBtn: { ru: 'Задать вопрос', kz: 'Сұрақ қою', en: 'Ask a question' },
  ctaBack: { ru: 'На главную', kz: 'Басты бетке', en: 'Back to home' },
}

const TERMS = [
  { k: 'tm1k', d: 'tm1d' },
  { k: 'tm2k', d: 'tm2d' },
  { k: 'tm3k', d: 'tm3d' },
  { k: 'tm4k', d: 'tm4d' },
  { k: 'tm5k', d: 'tm5d' },
  { k: 'tm6k', d: 'tm6d' },
  { k: 'tm7k', d: 'tm7d' },
] as const

const PRIVACY = [
  { k: 'pv1k', d: 'pv1d' },
  { k: 'pv2k', d: 'pv2d' },
  { k: 'pv3k', d: 'pv3d' },
  { k: 'pv4k', d: 'pv4d' },
  { k: 'pv5k', d: 'pv5d' },
  { k: 'pv6k', d: 'pv6d' },
  { k: 'pv7k', d: 'pv7d' },
] as const

/** Порядковый номер пункта: 01, 02 — той же формы, что и шаги технологии. */
function num(i: number) {
  return String(i + 1).padStart(2, '0')
}

export function AboutPage() {
  const { lang } = useLang()
  const t = useT(dict)
  const { hash } = useLocation()
  const landed = useRef(false)

  /**
   * Ссылки подвала ведут на /about#terms и /about#privacy. Маршрутизатор сам к
   * якорю не прокручивает — без этого ссылка внешне срабатывает, а страница
   * остаётся на месте.
   */
  useEffect(() => {
    if (!hash) return
    const el = document.getElementById(hash.slice(1))
    if (!el) return
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    /* Приход по ссылке снаружи — сразу на месте; переход внутри страницы —
       прокруткой, чтобы было видно, куда именно уехали. */
    const smooth = landed.current && !reduced
    landed.current = true
    el.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' })
  }, [hash])

  return (
    <PublicPage>
      <section className="pub-wrap about__head" aria-labelledby="about-title">
        <Label className="enter">{t('eyebrow')}</Label>
        <h1
          className="pub-display about__title enter"
          id="about-title"
          style={{ animationDelay: 'calc(var(--stagger) * 1)' }}
        >
          {t('title')}
        </h1>
        <p className="t-legal about__lede enter" style={{ animationDelay: 'calc(var(--stagger) * 2)' }}>
          {t('lede')}
        </p>
      </section>

      {/* ---------- Задача ---------- */}
      <Reveal as="section" className="pub-wrap about-sec" aria-labelledby="task-title">
        <H2 className="about-sec__title" id="task-title">
          {t('taskTitle')}
        </H2>
        <div className="about-sec__body">
          <Legal as="p">{t('task1')}</Legal>
          <Legal as="p">{t('task2')}</Legal>
          <Legal as="p">{t('task3')}</Legal>
        </div>
      </Reveal>

      {/* ---------- Технология ---------- */}
      <Reveal as="section" className="pub-wrap about-sec" aria-labelledby="tech-title">
        <H2 className="about-sec__title" id="tech-title">
          {t('techTitle')}
        </H2>
        <div className="about-sec__body">
          <Legal as="p">{t('tech1')}</Legal>
          <Legal as="p">{t('tech2')}</Legal>
        </div>

        <ol className="about-flow">
          <li>
            <span className="about-flow__step">01</span>
            <Body as="span">{t('flow1')}</Body>
          </li>
          <li>
            <span className="about-flow__step">02</span>
            <Body as="span">{t('flow2')}</Body>
          </li>
          <li>
            <span className="about-flow__step">03</span>
            <Body as="span">{t('flow3')}</Body>
          </li>
          <li>
            <span className="about-flow__step">04</span>
            <Body as="span">{t('flow4')}</Body>
          </li>
        </ol>

        <div className="about-sec__body about-sec__body--gap">
          <Legal as="p">{t('tech3')}</Legal>
          <Legal as="p">
            {t('tech4pre')}
            <Cite code={citeCode('ГК РК 178.1', lang)} />
            {t('tech4post')}
          </Legal>
        </div>
      </Reveal>

      {/* ---------- Коротко о системе ---------- */}
      <Reveal as="section" className="pub-wrap about-sec" aria-labelledby="facts-title">
        <H2 className="about-sec__title" id="facts-title">
          {t('factsTitle')}
        </H2>
        <table className="facts">
          <tbody>
            <tr>
              <th scope="row">{t('factBaseK')}</th>
              <td>{t('factBaseV')}</td>
            </tr>
            <tr>
              <th scope="row">{t('factLangK')}</th>
              <td>{t('factLangV')}</td>
            </tr>
            <tr>
              <th scope="row">{t('factModK')}</th>
              <td>{t('factModV')}</td>
            </tr>
            <tr>
              <th scope="row">{t('factDataK')}</th>
              <td>{t('factDataV')}</td>
            </tr>
            <tr>
              <th scope="row">{t('factExportK')}</th>
              <td>{t('factExportV')}</td>
            </tr>
          </tbody>
        </table>
      </Reveal>

      {/* ---------- Кто делает ---------- */}
      <Reveal as="section" className="pub-wrap about-sec" aria-labelledby="team-title">
        <H2 className="about-sec__title" id="team-title">
          {t('teamTitle')}
        </H2>
        <div className="about-sec__body">
          <Legal as="p">{t('team1')}</Legal>
          <Legal as="p">{t('team2')}</Legal>
        </div>
      </Reveal>

      {/* ---------- Условия использования ---------- */}
      <Reveal as="section" className="pub-wrap about-sec" id="terms" aria-labelledby="terms-title">
        <H2 className="about-sec__title" id="terms-title">
          {t('termsTitle')}
        </H2>
        <div className="about-sec__body">
          <Legal as="p">{t('termsLede')}</Legal>
        </div>

        <ol className="about-flow">
          {TERMS.map((it, i) => (
            <li key={it.k}>
              <span className="about-flow__step">{num(i)}</span>
              <Body as="span">
                <strong>{t(it.k)}</strong> {t(it.d)}
              </Body>
            </li>
          ))}
        </ol>

        <Caption tone="mute">{t('revDate')}</Caption>
      </Reveal>

      {/* ---------- Политика конфиденциальности ---------- */}
      <Reveal as="section" className="pub-wrap about-sec" id="privacy" aria-labelledby="privacy-title">
        <H2 className="about-sec__title" id="privacy-title">
          {t('privTitle')}
        </H2>
        <div className="about-sec__body">
          <Legal as="p">{t('privLede')}</Legal>
        </div>

        <ol className="about-flow">
          {PRIVACY.map((it, i) => (
            <li key={it.k}>
              <span className="about-flow__step">{num(i)}</span>
              <Body as="span">
                <strong>{t(it.k)}</strong> {t(it.d)}
              </Body>
            </li>
          ))}
        </ol>

        <Caption tone="mute">{t('revDate')}</Caption>
      </Reveal>

      {/* ---------- Оговорка ---------- */}
      <Reveal as="section" className="pub-wrap about-sec" id="disclaimer" aria-labelledby="disc-title">
        <H2 className="about-sec__title" id="disc-title">
          {t('discTitle')}
        </H2>
        <div className="about-sec__body">
          <Legal as="p">{t('disc')}</Legal>
        </div>
      </Reveal>

      {/* ---------- Контакты ---------- */}
      <Reveal as="section" className="pub-wrap about-sec" id="contacts" aria-labelledby="contacts-title">
        <H2 className="about-sec__title" id="contacts-title">
          {t('contactsTitle')}
        </H2>
        <ul className="contacts">
          <li>
            <Label className="contacts__key">{t('contactMailK')}</Label>
            <a href="mailto:hello@tura.kz" className="t-body">
              hello@tura.kz
            </a>
          </li>
          <li>
            <Label className="contacts__key">{t('contactPressK')}</Label>
            <a href="mailto:partners@tura.kz" className="t-body">
              partners@tura.kz
            </a>
          </li>
          <li>
            <Label className="contacts__key">{t('contactErrK')}</Label>
            <Body as="span" tone="ink2">
              {t('contactErrV')}
            </Body>
          </li>
          <li>
            <Label className="contacts__key">{t('contactGeoK')}</Label>
            <Body as="span" tone="ink2">
              {t('contactGeoV')}
            </Body>
          </li>
        </ul>
      </Reveal>

      {/* ---------- Призыв ---------- */}
      <Reveal as="section" className="pub-wrap final" aria-labelledby="about-cta">
        <h2 className="final__title" id="about-cta">
          {t('ctaTitle')}
        </h2>
        <div className="final__actions">
          <Link to="/chat" className="pub-cta pub-cta--wide">
            {t('ctaBtn')}
          </Link>
          <Link to="/" className="pub-link">
            {t('ctaBack')}
          </Link>
        </div>
      </Reveal>
    </PublicPage>
  )
}
