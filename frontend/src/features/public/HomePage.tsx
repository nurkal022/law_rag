import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties, MouseEvent } from 'react'
import { Link } from '../../shared/nav'
import { Reveal } from '../../shared/motion'
import { Body, Caption, Cite, H2, H3, Label, Legal, Mono, UIText } from '../../shared/ui'
import { useLang, useT } from '../../i18n'
import type { Dict } from '../../i18n'
import { citeCode } from '../legal/cite'
import { PublicPage } from './PublicChrome'
import './public.css'
import './public.motion.css'

/**
 * Главная — лендинг направления «Документ».
 *
 * Героем страницы служит не иллюстрация, а живая выписка: вопрос, ответ и
 * правовые координаты источника. Выписку можно переключать между делами, а
 * каждая координата раскрывается в текст нормы прямо под ответом — лендинг
 * показывает работу системы, а не рассказывает о ней.
 *
 * Движение: первый экран появляется сразу с небольшими задержками, разделы
 * ниже — по мере прокрутки, по одному разу. Все длительности из tokens.css,
 * поэтому системная настройка «меньше движения» гасит слой целиком.
 */

const dict: Dict = {
  eyebrow: {
    ru: 'Правовая система Республики Казахстан',
    kz: 'Қазақстан Республикасының құқықтық жүйесі',
    en: 'Legal system of the Republic of Kazakhstan',
  },
  h1: {
    ru: 'Право, у которого видно источник',
    kz: 'Дереккөзі көрініп тұратын құқық',
    en: 'Law with its source in plain sight',
  },
  lede: {
    ru: 'TURA отвечает на правовой вопрос простым языком и рядом с каждым утверждением ставит норму, из которой оно следует: закон, статью, пункт. Ответ можно проверить, не выходя из него.',
    kz: 'TURA құқықтық сұраққа қарапайым тілмен жауап береді және әрбір тұжырымның қасына оның негізі болған норманы қояды: заң, бап, тармақ. Жауапты одан шықпай-ақ тексеруге болады.',
    en: 'TURA answers a legal question in plain language and puts the governing norm beside every statement it makes — the act, the article, the clause. You can verify the answer without leaving it.',
  },
  ctaMain: { ru: 'Задать вопрос', kz: 'Сұрақ қою', en: 'Ask a question' },
  ctaSecond: { ru: 'Как это работает', kz: 'Қалай жұмыс істейді', en: 'How it works' },

  /* ---- Живая выписка ---- */
  specPick: { ru: 'Дело', kz: 'Іс', en: 'Matter' },
  specQLabel: { ru: 'Вопрос', kz: 'Сұрақ', en: 'Question' },
  specALabel: { ru: 'Ответ TURA', kz: 'TURA жауабы', en: 'TURA answers' },
  specSrcLabel: { ru: 'Источники', kz: 'Дереккөздер', en: 'Sources' },
  specHint: {
    ru: 'Нажмите на координату — под ответом раскроется текст нормы',
    kz: 'Координатаны басыңыз — жауаптың астында норманың мәтіні ашылады',
    en: 'Click a coordinate — the text of the norm opens under the answer',
  },
  specOpen: { ru: 'Открыть норму', kz: 'Норманы ашу', en: 'Open the norm' },
  specClose: { ru: 'Свернуть', kz: 'Жию', en: 'Close' },

  /* Дело 1 — исковая давность */
  q1tab: { ru: 'Сделка', kz: 'Мәміле', en: 'Transaction' },
  q1q: {
    ru: 'Я купил квартиру, а через два года выяснилось, что продавец не имел права её продавать. Сколько у меня времени, чтобы оспорить сделку?',
    kz: 'Пәтер сатып алдым, ал екі жылдан кейін сатушының оны сатуға құқығы болмағаны белгілі болды. Мәмілені даулауға қанша уақытым бар?',
    en: 'I bought a flat, and two years later it turned out the seller had no right to sell it. How long do I have to challenge the transaction?',
  },
  q1a1: {
    ru: 'Общий срок исковой давности — три года ',
    kz: 'Талап қоюдың жалпы мерзімі — үш жыл ',
    en: 'The general limitation period is three years ',
  },
  q1a2: {
    ru: '. Он отсчитывается не со дня сделки, а со дня, когда вы узнали или должны были узнать о нарушении права ',
    kz: '. Ол мәміле жасалған күннен емес, құқығыңыздың бұзылғанын білген немесе білуге тиіс болған күннен басталады ',
    en: '. It runs not from the day of the transaction but from the day you learned, or should have learned, that your right was violated ',
  },
  q1a3: {
    ru: '. В вашем случае отсчёт начался два года назад, значит срок не истёк.',
    kz: '. Сіздің жағдайыңызда есеп екі жыл бұрын басталған, демек мерзім өткен жоқ.',
    en: '. In your case the clock started two years ago, so the period has not expired.',
  },
  q1b1: {
    ru: 'Сделка, совершённая лицом без надлежащих полномочий, оспорима в судебном порядке ',
    kz: 'Тиісті өкілеттігі жоқ адам жасаған мәміле сот тәртібімен дауланады ',
    en: 'A transaction made by a person without proper authority is voidable in court ',
  },
  q1b2: {
    ru: '. Иск подаётся по месту нахождения недвижимости.',
    kz: '. Талап жылжымайтын мүліктің орналасқан жері бойынша қойылады.',
    en: '. The claim is filed at the location of the property.',
  },

  /* Дело 2 — сокращение */
  q2tab: { ru: 'Сокращение', kz: 'Қысқарту', en: 'Redundancy' },
  q2q: {
    ru: 'Мне сообщили, что мою должность сокращают. Обязаны ли предупредить заранее и что положено при расчёте?',
    kz: 'Лауазымым қысқартылатынын хабарлады. Алдын ала ескертуге міндетті ме және есеп айырысу кезінде не тиесілі?',
    en: 'I was told my position is being made redundant. Must they warn me in advance, and what am I owed on the final settlement?',
  },
  q2a1: {
    ru: 'Сокращение численности или штата — законное основание расторгнуть договор по инициативе работодателя ',
    kz: 'Санды немесе штатты қысқарту — жұмыс берушінің бастамасымен шартты бұзудың заңды негізі ',
    en: 'A reduction in headcount or staff is a lawful ground for the employer to end the contract ',
  },
  q2a2: {
    ru: ', но при двух условиях. Первое: письменное уведомление не менее чем за один месяц, если договором не установлен более длительный срок ',
    kz: ', бірақ екі шартпен. Біріншісі: шартта ұзағырақ мерзім белгіленбесе, кемінде бір ай бұрын жазбаша ескерту ',
    en: ', but on two conditions. First, written notice at least one month ahead, unless the contract sets a longer term ',
  },
  q2a3: {
    ru: '. Второе: при расчёте выплачивается компенсация в размере среднемесячной заработной платы ',
    kz: '. Екіншісі: есеп айырысу кезінде орташа айлық жалақы мөлшерінде өтемақы төленеді ',
    en: '. Second, on the final settlement you are paid compensation equal to one average monthly wage ',
  },
  q2a4: {
    ru: '. Нарушение срока уведомления само по себе сокращение не отменяет, но даёт основание требовать возмещения.',
    kz: '. Ескерту мерзімінің бұзылуы қысқартудың өзін жоққа шығармайды, бірақ өтем талап етуге негіз береді.',
    en: '. A missed notice period does not undo the redundancy, but it does give ground to claim compensation.',
  },

  /* Дело 3 — отказ государственного органа */
  q3tab: { ru: 'Отказ органа', kz: 'Органның бас тартуы', en: 'Public refusal' },
  q3q: {
    ru: 'Государственный орган отказал в услуге. Сколько у меня времени на обжалование и куда подавать жалобу?',
    kz: 'Мемлекеттік орган қызмет көрсетуден бас тартты. Шағымдануға қанша уақытым бар және шағымды қайда беремін?',
    en: 'A public body refused me a service. How long do I have to appeal, and where do I file the complaint?',
  },
  q3a1: {
    ru: 'Срок — три месяца со дня, когда вам стало известно об отказе ',
    kz: 'Мерзімі — бас тарту туралы білген күннен бастап үш ай ',
    en: 'The period is three months from the day you learned of the refusal ',
  },
  q3a2: {
    ru: '. Жалоба подаётся не сразу в суд и не сразу наверх, а в тот орган, который принял решение: он обязан передать её вместе с материалами дела в вышестоящий орган ',
    kz: '. Шағым бірден сотқа да, жоғарыға да емес, шешім қабылдаған органға беріледі: ол шағымды іс материалдарымен бірге жоғары тұрған органға жіберуге міндетті ',
    en: '. The complaint goes neither straight to court nor straight upward, but to the body that made the decision: it must pass the complaint with the case file to the superior body ',
  },
  q3a3: {
    ru: '. Досудебный порядок здесь обязателен: заявление, поданное в обход него, суд вернёт.',
    kz: '. Мұнда сотқа дейінгі тәртіп міндетті: оны айналып өтіп берілген өтінішті сот қайтарады.',
    en: '. The pre-court stage is mandatory here: a court will return an application that skips it.',
  },

  /* Дело 4 — аренда */
  q4tab: { ru: 'Аренда', kz: 'Жалдау', en: 'Lease' },
  q4q: {
    ru: 'Арендодатель поднял плату посреди срока договора. Может ли он сделать это в одностороннем порядке?',
    kz: 'Жалға беруші шарт мерзімінің ортасында ақыны көтерді. Ол мұны біржақты тәртіппен жасай ала ма?',
    en: 'My landlord raised the rent in the middle of the term. Can they do that unilaterally?',
  },
  q4a1: {
    ru: 'Размер платы за пользование имуществом определяется договором ',
    kz: 'Мүлікті пайдаланғаны үшін ақының мөлшері шартпен айқындалады ',
    en: 'The amount payable for the use of the property is fixed by the contract ',
  },
  q4a2: {
    ru: ', а изменить договор можно по соглашению сторон, если сам договор или закон не допускают иного ',
    kz: ', ал шартты өзгерту тараптардың келісімі бойынша мүмкін, егер шарттың өзінде немесе заңда өзгеше көзделмесе ',
    en: ', and a contract is changed by agreement of the parties unless the contract or the law allows otherwise ',
  },
  q4a3: {
    ru: '. Значит одностороннее повышение действует только тогда, когда такая возможность прямо записана в договоре. Если её нет, вы вправе платить прежнюю сумму.',
    kz: '. Демек, біржақты көтеру мұндай мүмкіндік шартта тікелей жазылған жағдайда ғана жарамды. Ол болмаса, бұрынғы соманы төлеуге құқығыңыз бар.',
    en: '. So a unilateral increase holds only where the contract expressly provides for one. If it does not, you may keep paying the agreed amount.',
  },

  /* ---- Тексты норм, раскрываемых из выписки ---- */
  n178t: {
    ru: 'Общий срок исковой давности',
    kz: 'Талап қоюдың жалпы мерзімі',
    en: 'General limitation period',
  },
  n178: {
    ru: 'Общий срок исковой давности устанавливается в три года.',
    kz: 'Талап қоюдың жалпы мерзімі үш жыл болып белгіленеді.',
    en: 'The general limitation period is set at three years.',
  },
  n180t: {
    ru: 'Начало течения срока исковой давности',
    kz: 'Талап қою мерзімінің басталуы',
    en: 'Start of the limitation period',
  },
  n180: {
    ru: 'Течение срока исковой давности начинается со дня, когда лицо узнало или должно было узнать о нарушении своего права.',
    kz: 'Талап қою мерзімінің өтуі адам өз құқығының бұзылғанын білген немесе білуге тиіс болған күннен басталады.',
    en: 'The limitation period starts to run on the day the person learned, or should have learned, that their right was violated.',
  },
  n159t: {
    ru: 'Сделка, совершённая без надлежащих полномочий',
    kz: 'Тиісті өкілеттіксіз жасалған мәміле',
    en: 'Transaction made without proper authority',
  },
  n159: {
    ru: 'Сделка, совершённая представителем без полномочий либо с превышением полномочий, может быть признана судом недействительной по иску представляемого.',
    kz: 'Өкілеттігінсіз немесе өкілеттігінен асыра отырып өкіл жасаған мәміле өкілдік беруші тұлғаның талабы бойынша сот жарамсыз деп тануы мүмкін.',
    en: 'A transaction made by a representative without authority, or in excess of it, may be declared invalid by a court on the claim of the person represented.',
  },
  n531t: {
    ru: 'Расторжение договора по инициативе работодателя',
    kz: 'Жұмыс берушінің бастамасымен шартты бұзу',
    en: 'Termination at the employer’s initiative',
  },
  n531: {
    ru: 'Трудовой договор может быть расторгнут по инициативе работодателя, в том числе при сокращении численности или штата работников.',
    kz: 'Еңбек шарты жұмыс берушінің бастамасы бойынша, оның ішінде жұмыскерлер санын немесе штатын қысқарту кезінде бұзылуы мүмкін.',
    en: 'An employment contract may be terminated at the employer’s initiative, including on a reduction in headcount or staff.',
  },
  n532t: {
    ru: 'Уведомление о сокращении',
    kz: 'Қысқарту туралы ескерту',
    en: 'Notice of redundancy',
  },
  n532: {
    ru: 'О расторжении трудового договора при сокращении численности или штата работодатель письменно уведомляет работника не менее чем за один месяц, если трудовым или коллективным договором не установлен более длительный срок.',
    kz: 'Санды немесе штатты қысқартуға байланысты еңбек шартының бұзылатыны туралы жұмыс беруші жұмыскерді кемінде бір ай бұрын жазбаша хабардар етеді, егер еңбек немесе ұжымдық шартта ұзағырақ мерзім белгіленбесе.',
    en: 'The employer notifies the employee in writing of termination on redundancy at least one month in advance, unless the employment or collective agreement sets a longer term.',
  },
  n131t: {
    ru: 'Компенсационная выплата при сокращении',
    kz: 'Қысқарту кезіндегі өтемақы төлемі',
    en: 'Compensation on redundancy',
  },
  n131: {
    ru: 'При расторжении трудового договора в связи с сокращением численности или штата работнику производится компенсационная выплата в размере среднемесячной заработной платы.',
    kz: 'Жұмыскерлер санын немесе штатын қысқартуға байланысты еңбек шарты бұзылған кезде жұмыскерге орташа айлық жалақы мөлшерінде өтемақы төлемі жүргізіледі.',
    en: 'Where the contract ends because of a reduction in headcount or staff, the employee receives a compensation payment equal to one average monthly wage.',
  },
  n91t: { ru: 'Срок подачи жалобы', kz: 'Шағым беру мерзімі', en: 'Deadline for a complaint' },
  n91: {
    ru: 'Жалоба на административный акт подаётся в течение трёх месяцев со дня, когда лицу стало известно о принятом акте или совершённом административном действии.',
    kz: 'Әкімшілік актіге шағым қабылданған акт немесе жасалған әкімшілік әрекет туралы адамға белгілі болған күннен бастап үш ай ішінде беріледі.',
    en: 'A complaint against an administrative act is filed within three months of the day the person learned of the act or of the administrative action taken.',
  },
  n92t: { ru: 'Порядок подачи жалобы', kz: 'Шағым беру тәртібі', en: 'How a complaint is filed' },
  n92: {
    ru: 'Жалоба подаётся в орган, принявший административный акт. Этот орган направляет жалобу вместе с материалами дела в вышестоящий орган.',
    kz: 'Шағым әкімшілік актіні қабылдаған органға беріледі. Бұл орган шағымды іс материалдарымен бірге жоғары тұрған органға жібереді.',
    en: 'The complaint is filed with the body that issued the administrative act. That body forwards it, together with the case file, to the superior body.',
  },
  n544t: {
    ru: 'Плата за пользование имуществом',
    kz: 'Мүлікті пайдаланғаны үшін ақы',
    en: 'Payment for the use of property',
  },
  n544: {
    ru: 'Плата за пользование нанятым имуществом устанавливается договором имущественного найма.',
    kz: 'Жалға алынған мүлікті пайдаланғаны үшін ақы мүліктік жалдау шартымен белгіленеді.',
    en: 'The charge for the use of leased property is set by the lease contract.',
  },
  n401t: {
    ru: 'Изменение и расторжение договора',
    kz: 'Шартты өзгерту және бұзу',
    en: 'Amendment and termination of a contract',
  },
  n401: {
    ru: 'Изменение и расторжение договора возможны по соглашению сторон, если иное не предусмотрено законом или договором.',
    kz: 'Шартты өзгерту және бұзу тараптардың келісімі бойынша мүмкін, егер заңда немесе шартта өзгеше көзделмесе.',
    en: 'A contract may be amended or terminated by agreement of the parties, unless the law or the contract provides otherwise.',
  },

  /* ---- Возможности ---- */
  modsTitle: { ru: 'Четыре модуля', kz: 'Төрт модуль', en: 'Four modules' },
  modsNote: {
    ru: 'Одна база документов, один поиск, четыре способа применить его к работе.',
    kz: 'Бір құжат базасы, бір іздеу және оны жұмысқа қолданудың төрт тәсілі.',
    en: 'One document base, one retrieval engine, four ways to put it to work.',
  },

  mod1: { ru: 'Консультант по законодательству', kz: 'Заңнама бойынша кеңесші', en: 'Legislation assistant' },
  mod1d: {
    ru: 'Вопрос в свободной форме на казахском или русском. В ответ — разбор по существу и перечень норм, на которых он держится. Каждую ссылку можно раскрыть и прочитать целиком.',
    kz: 'Қазақша немесе орысша еркін нысандағы сұрақ. Жауабында — мәні бойынша талдау және оның негізі болған нормалар тізімі. Әрбір сілтемені ашып, толық оқуға болады.',
    en: 'A free-form question in Kazakh or Russian. In return, an answer on the merits and the list of norms it rests on. Every reference opens to its full text.',
  },
  mod2: { ru: 'Конструктор договоров', kz: 'Шарт құрастырушы', en: 'Contract builder' },
  mod2d: {
    ru: 'Договор собирается из условий, проверенных на соответствие требованиям РК. Спорные пункты помечаются, к каждому приводится норма, из которой следует требование.',
    kz: 'Шарт ҚР талаптарына сәйкестігі тексерілген талаптардан құралады. Даулы тармақтар белгіленеді, әрқайсысына талаптың негізі болған норма беріледі.',
    en: 'A contract assembled from clauses checked against Kazakhstani requirements. Risky terms are flagged, each with the norm the requirement comes from.',
  },
  mod3: { ru: 'Генератор законопроектов', kz: 'Заң жобаларының генераторы', en: 'Draft law generator' },
  mod3d: {
    ru: 'Из описания инициативы — полный комплект по государственным стандартам: текст закона, пояснительная записка, финансово-экономическое обоснование, сравнительная таблица и ещё девять обязательных разделов.',
    kz: 'Бастама сипаттамасынан — мемлекеттік стандарттар бойынша толық жинақ: заң мәтіні, түсіндірме жазба, қаржы-экономикалық негіздеме, салыстырмалы кесте және тағы тоғыз міндетті бөлім.',
    en: 'From a description of the initiative to a full package built to state standards: the text of the act, explanatory note, financial justification, comparison table and nine further mandatory sections.',
  },
  mod4: { ru: 'Правовая аналитика', kz: 'Құқықтық талдау', en: 'Legal analytics' },
  mod4d: {
    ru: 'Массивы общественных комментариев к законопроектам разбираются по темам и тональности, противоречия и риски сводятся в отчёт вместо ручного чтения тысяч отзывов.',
    kz: 'Заң жобаларына түскен қоғамдық пікірлер тақырып пен реңк бойынша сараланады, қайшылықтар мен тәуекелдер мыңдаған пікірді қолмен оқудың орнына есепке жинақталады.',
    en: 'Public comments on draft laws are sorted by topic and sentiment; contradictions and risks are gathered into a report instead of thousands of manual reads.',
  },

  /* ---- Как это работает ---- */
  howTitle: { ru: 'Как это работает', kz: 'Бұл қалай жұмыс істейді', en: 'How it works' },
  howNote: {
    ru: 'Три шага между вопросом и проверяемым ответом.',
    kz: 'Сұрақ пен тексерілетін жауаптың арасындағы үш қадам.',
    en: 'Three steps between a question and a verifiable answer.',
  },
  step1: { ru: 'Вопрос', kz: 'Сұрақ', en: 'The question' },
  step1d: {
    ru: 'Вы пишете так, как сказали бы юристу: без номеров статей и точных терминов. Система понимает казахский и русский одинаково.',
    kz: 'Заңгерге айтқандай жазасыз: бап нөмірлерінсіз және дәл терминдерсіз. Жүйе қазақ пен орыс тілін бірдей түсінеді.',
    en: 'You write as you would speak to a lawyer — no article numbers, no exact terminology. Kazakh and Russian are understood equally.',
  },
  step2: { ru: 'Поиск по базе', kz: 'База бойынша іздеу', en: 'Retrieval' },
  step2d: {
    ru: 'Запрос идёт по действующим правовым актам Республики Казахстан. Отбираются фрагменты, относящиеся к делу, а не похожие по словам.',
    kz: 'Сұрау Қазақстан Республикасының қолданыстағы құқықтық актілері бойынша жүреді. Сөзі ұқсас емес, іске қатысы бар үзінділер таңдалады.',
    en: 'The query runs across the legal acts of Kazakhstan in force. What is selected are the passages relevant to the matter, not those with similar wording.',
  },
  step3: { ru: 'Ответ с координатами', kz: 'Координаталары бар жауап', en: 'A sourced answer' },
  step3d: {
    ru: 'Модель формулирует ответ строго по найденным фрагментам и проставляет ссылку на каждую использованную норму. Не нашлось основания — система говорит об этом прямо.',
    kz: 'Модель жауапты тек табылған үзінділер бойынша тұжырымдап, пайдаланылған әр нормаға сілтеме қояды. Негіз табылмаса, жүйе бұл туралы тікелей айтады.',
    en: 'The model composes the answer strictly from the retrieved passages and cites every norm it used. Where no basis is found, it says so outright.',
  },

  /* ---- Для кого ---- */
  whoTitle: { ru: 'Для кого', kz: 'Кімге арналған', en: 'Who it is for' },
  whoCol1: { ru: 'Аудитория', kz: 'Аудитория', en: 'Audience' },
  whoCol2: { ru: 'Что меняется', kz: 'Не өзгереді', en: 'What changes' },
  who1: { ru: 'Государственные служащие', kz: 'Мемлекеттік қызметшілер', en: 'Civil servants' },
  who1d: {
    ru: 'Подготовка нормативного акта начинается с готовой структуры по стандартам РК, а не с чистого листа.',
    kz: 'Нормативтік актіні дайындау бос парақтан емес, ҚР стандарттары бойынша дайын құрылымнан басталады.',
    en: 'Drafting a regulation starts from a ready structure built to state standards rather than a blank page.',
  },
  who2: { ru: 'Юристы и адвокаты', kz: 'Заңгерлер мен адвокаттар', en: 'Lawyers and advocates' },
  who2d: {
    ru: 'Поиск нормы и первичный разбор занимают минуты; проверяемые ссылки сразу пригодны для позиции по делу.',
    kz: 'Норманы іздеу мен алғашқы талдау бірнеше минут алады; тексерілетін сілтемелер іс бойынша ұстанымға бірден жарамды.',
    en: 'Finding the norm and the first pass of analysis take minutes; verifiable citations are ready for the case file.',
  },
  who3: { ru: 'Бизнес', kz: 'Бизнес', en: 'Business' },
  who3d: {
    ru: 'Договор и решение проверяются на соответствие требованиям до того, как обойдутся дороже.',
    kz: 'Шарт пен шешім қымбатқа түспей тұрып, талаптарға сәйкестігі тұрғысынан тексеріледі.',
    en: 'Contracts and decisions are checked against requirements before they become expensive.',
  },
  who4: { ru: 'Граждане', kz: 'Азаматтар', en: 'Citizens' },
  who4d: {
    ru: 'Понятный ответ на правовой вопрос — без специального образования и без обращения к юристу на первом шаге.',
    kz: 'Құқықтық сұраққа түсінікті жауап — арнайы білімсіз және алғашқы қадамда заңгерге бармай-ақ.',
    en: 'A clear answer to a legal question — without a legal education, and without a lawyer at the first step.',
  },

  /* ---- Доверие ---- */
  trustTitle: { ru: 'Почему ответу можно верить', kz: 'Жауапқа неге сенуге болады', en: 'Why the answer holds' },
  trustClaim: {
    ru: 'Система не сочиняет норму. Она находит её и показывает, где искала.',
    kz: 'Жүйе норманы ойлап шығармайды. Ол оны тауып, қайдан іздегенін көрсетеді.',
    en: 'The system does not invent the norm. It finds it and shows you where it looked.',
  },
  trust1: { ru: 'Ответ только по источникам', kz: 'Жауап тек дереккөздер бойынша', en: 'Sourced answers only' },
  trust1d: {
    ru: 'Модель отвечает по фрагментам, извлечённым из базы правовых актов, а не по памяти обучения. Это снимает главный риск искусственного интеллекта в праве — уверенно сформулированную выдумку.',
    kz: 'Модель оқу барысындағы жадынан емес, құқықтық актілер базасынан алынған үзінділер бойынша жауап береді. Бұл құқық саласындағы жасанды интеллекттің басты тәуекелін — сенімді тұжырымдалған ойдан шығаруды — жояды.',
    en: 'The model answers from passages retrieved out of the legal base, not from what it memorised in training. That removes the central risk of AI in law: confident invention.',
  },
  trust2: { ru: 'Каждое утверждение адресуемо', kz: 'Әрбір тұжырымның мекенжайы бар', en: 'Every statement is addressable' },
  trust2d: {
    ru: 'Правовая координата набирается моноширинным и раскрывается в текст нормы. Проверка занимает один щелчок, а не отдельный поиск в правовой базе.',
    kz: 'Құқықтық координата ені бірдей қаріппен теріліп, норма мәтініне ашылады. Тексеру құқықтық базадан бөлек іздеуді емес, бір басуды талап етеді.',
    en: 'Each legal coordinate is set in monospace and opens to the text of the norm. Verification is one click, not a separate search.',
  },
  trust3: { ru: 'Данные остаются у вас', kz: 'Деректер сізде қалады', en: 'Your data stays put' },
  trust3d: {
    ru: 'Обработка идёт на собственных серверах, документы не уходят во внешние облака. Для государственных органов и работы с конфиденциальными материалами это условие, а не удобство.',
    kz: 'Өңдеу меншікті серверлерде жүреді, құжаттар сыртқы бұлттарға шықпайды. Мемлекеттік органдар мен құпия материалдармен жұмыс үшін бұл ыңғайлылық емес, шарт.',
    en: 'Processing runs on our own servers; documents never leave for an external cloud. For public bodies and confidential material that is a condition, not a convenience.',
  },
  trust4: { ru: 'Два языка без потери качества', kz: 'Сапасын жоғалтпайтын екі тіл', en: 'Two languages, one quality' },
  trust4d: {
    ru: 'Казахский и русский поддерживаются одинаково — и в вопросе, и в ответе, и в поиске по документам.',
    kz: 'Қазақ және орыс тілдері бірдей қолдау табады — сұрақта да, жауапта да, құжаттар бойынша іздеуде де.',
    en: 'Kazakh and Russian are supported equally — in the question, in the answer, and in retrieval across documents.',
  },

  /* ---- Финальный призыв ---- */
  finalTitle: {
    ru: 'Задайте первый вопрос — и посмотрите на источник',
    kz: 'Алғашқы сұрағыңызды қойып, дереккөзін көріңіз',
    en: 'Ask your first question and look at the source',
  },
  finalLede: {
    ru: 'Регистрация занимает минуту. Первые запросы бесплатны — этого хватает, чтобы проверить систему на своём деле.',
    kz: 'Тіркелу бір минут алады. Алғашқы сұраулар тегін — жүйені өз ісіңізде тексеруге жеткілікті.',
    en: 'Registration takes a minute. The first queries are free — enough to test the system on a matter of your own.',
  },
  finalAbout: { ru: 'Как устроена технология', kz: 'Технология қалай құрылған', en: 'How the technology works' },
}

/* ============================================================
   Живая выписка: данные
   ============================================================ */

/** Кусок ответа: либо ключ словаря, либо правовая координата. */
type Seg = string | { cite: string }

interface SpecCase {
  id: string
  tab: string
  q: string
  a: Seg[][]
}

const SPECS: SpecCase[] = [
  {
    id: 'q1',
    tab: 'q1tab',
    q: 'q1q',
    a: [
      ['q1a1', { cite: 'ГК РК 178.1' }, 'q1a2', { cite: 'ГК РК 180.1' }, 'q1a3'],
      ['q1b1', { cite: 'ГК РК 159.11' }, 'q1b2'],
    ],
  },
  {
    id: 'q2',
    tab: 'q2tab',
    q: 'q2q',
    a: [
      [
        'q2a1',
        { cite: 'ТК РК 53.1' },
        'q2a2',
        { cite: 'ТК РК 53.2' },
        'q2a3',
        { cite: 'ТК РК 131.1' },
        'q2a4',
      ],
    ],
  },
  {
    id: 'q3',
    tab: 'q3tab',
    q: 'q3q',
    a: [['q3a1', { cite: 'АППК РК 91.1' }, 'q3a2', { cite: 'АППК РК 92.1' }, 'q3a3']],
  },
  {
    id: 'q4',
    tab: 'q4tab',
    q: 'q4q',
    a: [['q4a1', { cite: 'ГК РК 544.1' }, 'q4a2', { cite: 'ГК РК 401.1' }, 'q4a3']],
  },
]

/** Норма, раскрываемая по нажатию на координату: заголовок и текст. */
const NORMS: Record<string, { title: string; text: string }> = {
  'ГК РК 178.1': { title: 'n178t', text: 'n178' },
  'ГК РК 180.1': { title: 'n180t', text: 'n180' },
  'ГК РК 159.11': { title: 'n159t', text: 'n159' },
  'ТК РК 53.1': { title: 'n531t', text: 'n531' },
  'ТК РК 53.2': { title: 'n532t', text: 'n532' },
  'ТК РК 131.1': { title: 'n131t', text: 'n131' },
  'АППК РК 91.1': { title: 'n91t', text: 'n91' },
  'АППК РК 92.1': { title: 'n92t', text: 'n92' },
  'ГК РК 544.1': { title: 'n544t', text: 'n544' },
  'ГК РК 401.1': { title: 'n401t', text: 'n401' },
}

/** Координаты выписки в порядке появления — из них собирается список источников. */
function citesOf(spec: SpecCase): string[] {
  const out: string[] = []
  for (const para of spec.a) {
    for (const seg of para) {
      if (typeof seg !== 'string' && !out.includes(seg.cite)) out.push(seg.cite)
    }
  }
  return out
}

/** Смена дела сама по себе, пока читатель не взялся за переключатель. */
const ROTATE_MS = 9000

function reducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Появление списка при прокрутке — с состоянием наружу.
 *
 * <Reveal> держит своё состояние внутри, а ленте нужно знать, дошла ли она до
 * экрана: иначе элементы отыграют появление, пока раздел ещё не виден, и
 * очередь пропадёт.
 */
function useOnScreen<T extends HTMLElement>() {
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
      { rootMargin: '0px 0px -12% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [shown])

  return [ref, shown] as const
}

/** Задержка появления, кратная шагу ленты: гаснет вместе с --stagger. */
function step(i: number): CSSProperties {
  return { animationDelay: `calc(var(--stagger) * ${i})` }
}

/* ============================================================
   Живая выписка: разметка
   ============================================================ */

function LiveSpec() {
  const { lang } = useLang()
  const t = useT(dict)
  const [active, setActive] = useState(0)
  const [norm, setNorm] = useState<string | null>(null)
  /** Читатель взялся за выписку — самостоятельная смена дел прекращается. */
  const [held, setHeld] = useState(false)

  useEffect(() => {
    if (held || reducedMotion()) return
    const id = window.setInterval(() => {
      setActive((i) => (i + 1) % SPECS.length)
      setNorm(null)
    }, ROTATE_MS)
    return () => window.clearInterval(id)
  }, [held])

  const pick = useCallback((i: number) => {
    setHeld(true)
    setActive(i)
    setNorm(null)
  }, [])

  const spec = SPECS[active]
  const opened = norm ? NORMS[norm] : null

  return (
    <figure className="spec">
      <div className="spec__row">
        <Label className="spec__label">{t('specPick')}</Label>
        <div className="spec__pick" role="tablist" aria-label={t('specPick')}>
          {SPECS.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={i === active}
              className={['spec__tab', i === active ? 'spec__tab--on' : ''].filter(Boolean).join(' ')}
              onClick={() => pick(i)}
            >
              {t(s.tab)}
            </button>
          ))}
        </div>
      </div>

      <div className="spec__row">
        <Label className="spec__label">{t('specQLabel')}</Label>
        <p className="spec__q swap" key={`q-${spec.id}`}>
          {t(spec.q)}
        </p>
      </div>

      <div className="spec__row" aria-live="polite">
        <Label className="spec__label">{t('specALabel')}</Label>
        <div className="swap" key={`a-${spec.id}`}>
          {spec.a.map((para, pi) => (
            <Legal as="p" className="spec__a" key={pi}>
              {para.map((seg, si) =>
                typeof seg === 'string' ? (
                  t(seg)
                ) : (
                  <Cite
                    key={si}
                    code={citeCode(seg.cite, lang)}
                    title={`${t('specOpen')}: ${citeCode(seg.cite, lang)}`}
                    aria-expanded={norm === seg.cite}
                    onClick={() => {
                      setHeld(true)
                      setNorm((cur) => (cur === seg.cite ? null : seg.cite))
                    }}
                  />
                ),
              )}
            </Legal>
          ))}

          {opened && norm ? (
            <div className="spec__norm unfold" key={norm}>
              <div className="spec__norm-head">
                <Mono>{citeCode(norm, lang)}</Mono>
                <Caption tone="mute">{t(opened.title)}</Caption>
                <button type="button" className="spec__norm-close" onClick={() => setNorm(null)}>
                  {t('specClose')}
                </button>
              </div>
              <Legal as="p" className="spec__norm-text">
                {t(opened.text)}
              </Legal>
            </div>
          ) : null}
        </div>
      </div>

      <figcaption className="spec__row">
        <Label className="spec__label">{t('specSrcLabel')}</Label>
        <div className="spec__srcs swap" key={`s-${spec.id}`}>
          {citesOf(spec).map((code) => (
            <span className="spec__src" key={code}>
              <Cite
                code={citeCode(code, lang)}
                title={`${t('specOpen')}: ${citeCode(code, lang)}`}
                aria-expanded={norm === code}
                onClick={() => {
                  setHeld(true)
                  setNorm((cur) => (cur === code ? null : code))
                }}
              />
              <Caption tone="mute">{t(NORMS[code].title)}</Caption>
            </span>
          ))}
        </div>
        <Caption tone="mute" className="spec__hint">
          {t('specHint')}
        </Caption>
      </figcaption>
    </figure>
  )
}

const MODULES = [
  { n: '01', name: 'mod1', body: 'mod1d' },
  { n: '02', name: 'mod2', body: 'mod2d' },
  { n: '03', name: 'mod3', body: 'mod3d' },
  { n: '04', name: 'mod4', body: 'mod4d' },
] as const

const STEPS = [
  { n: 'I', name: 'step1', body: 'step1d' },
  { n: 'II', name: 'step2', body: 'step2d' },
  { n: 'III', name: 'step3', body: 'step3d' },
] as const

const WHO = [
  { who: 'who1', what: 'who1d' },
  { who: 'who2', what: 'who2d' },
  { who: 'who3', what: 'who3d' },
  { who: 'who4', what: 'who4d' },
] as const

const TRUST = [
  { term: 'trust1', def: 'trust1d' },
  { term: 'trust2', def: 'trust2d' },
  { term: 'trust3', def: 'trust3d' },
  { term: 'trust4', def: 'trust4d' },
] as const

/* ============================================================
   Страница
   ============================================================ */

export function HomePage() {
  const t = useT(dict)
  const [modsRef, modsShown] = useOnScreen<HTMLDivElement>()
  const [stepsRef, stepsShown] = useOnScreen<HTMLOListElement>()

  /** Якорь «Как это работает» ведёт к разделу, а не только меняет адрес. */
  const toHow = useCallback((e: MouseEvent<HTMLAnchorElement>) => {
    const el = document.getElementById('how')
    if (!el) return
    e.preventDefault()
    el.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' })
  }, [])

  return (
    <PublicPage>
      {/* ---------- Первый экран: появляется сразу, лентой ---------- */}
      <section className="pub-wrap hero" aria-labelledby="hero-title">
        <Label className="hero__label enter">{t('eyebrow')}</Label>
        <h1 className="pub-display enter" id="hero-title" style={step(1)}>
          {t('h1')}
        </h1>
        <p className="t-legal hero__lede enter" style={step(2)}>
          {t('lede')}
        </p>
        <div className="hero__actions enter" style={step(3)}>
          <Link to="/chat" className="pub-cta pub-cta--wide">
            {t('ctaMain')}
          </Link>
          <a href="#how" className="pub-link" onClick={toHow}>
            {t('ctaSecond')}
          </a>
        </div>
      </section>

      {/* ---------- Живая выписка вместо иллюстрации ---------- */}
      <section className="pub-wrap enter" aria-label={t('specALabel')} style={step(4)}>
        <LiveSpec />
      </section>

      {/* ---------- Возможности ---------- */}
      <Reveal as="section" className="pub-wrap pub-sec" aria-labelledby="mods-title">
        <div className="pub-sec__head">
          <H2 className="pub-sec__title" id="mods-title">
            {t('modsTitle')}
          </H2>
          <Body tone="mute" className="pub-note">
            {t('modsNote')}
          </Body>
        </div>

        <div className="mods" ref={modsRef}>
          {MODULES.map((m, i) => (
            <article
              className={['mod', modsShown ? 'enter-item' : 'pre-enter'].join(' ')}
              style={{ ['--i' as string]: i } as CSSProperties}
              key={m.n}
            >
              <span className="mod__num t-mono">{m.n}</span>
              <H3 as="h3" className="mod__name">
                {t(m.name)}
              </H3>
              <Body className="mod__body">{t(m.body)}</Body>
            </article>
          ))}
        </div>
      </Reveal>

      {/* ---------- Как это работает ---------- */}
      <Reveal as="section" className="pub-wrap pub-sec" id="how" aria-labelledby="how-title">
        <div className="pub-sec__head">
          <H2 className="pub-sec__title" id="how-title">
            {t('howTitle')}
          </H2>
          <Body tone="mute" className="pub-note">
            {t('howNote')}
          </Body>
        </div>

        <ol className="steps" ref={stepsRef}>
          {STEPS.map((s, i) => (
            <li
              className={['step', stepsShown ? 'enter-item' : 'pre-enter'].join(' ')}
              style={{ ['--i' as string]: i } as CSSProperties}
              key={s.n}
            >
              <span className="step__num" aria-hidden="true">
                {s.n}
              </span>
              <H3 as="h3" className="step__name">
                {t(s.name)}
              </H3>
              <Body className="step__body">{t(s.body)}</Body>
            </li>
          ))}
        </ol>
      </Reveal>

      {/* ---------- Для кого ---------- */}
      <Reveal as="section" className="pub-wrap pub-sec" aria-labelledby="who-title">
        <div className="pub-sec__head">
          <H2 className="pub-sec__title" id="who-title">
            {t('whoTitle')}
          </H2>
        </div>

        <table className="who">
          <thead>
            <tr>
              <th scope="col">{t('whoCol1')}</th>
              <th scope="col">{t('whoCol2')}</th>
            </tr>
          </thead>
          <tbody>
            {WHO.map((r) => (
              <tr key={r.who}>
                <td className="who__who">{t(r.who)}</td>
                <td className="who__what">{t(r.what)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Reveal>

      {/* ---------- Доверие ---------- */}
      <Reveal as="section" className="pub-wrap pub-sec" aria-labelledby="trust-title">
        <div className="pub-sec__head">
          <H2 className="pub-sec__title" id="trust-title">
            {t('trustTitle')}
          </H2>
        </div>

        <div className="trust">
          <p className="trust__claim">{t('trustClaim')}</p>
          <ul className="trust__list">
            {TRUST.map((it) => (
              <li className="trust__item" key={it.term}>
                <span className="trust__term">{t(it.term)}</span>
                <Body className="trust__def">{t(it.def)}</Body>
              </li>
            ))}
          </ul>
        </div>
      </Reveal>

      {/* ---------- Призыв в конце ---------- */}
      <Reveal as="section" className="pub-wrap final" aria-labelledby="final-title">
        <h2 className="final__title" id="final-title">
          {t('finalTitle')}
        </h2>
        <p className="t-body final__lede">{t('finalLede')}</p>
        <div className="final__actions">
          <Link to="/register" className="pub-cta pub-cta--wide">
            <UIText>{t('ctaMain')}</UIText>
          </Link>
          <Link to="/about" className="pub-link">
            {t('finalAbout')}
          </Link>
        </div>
      </Reveal>
    </PublicPage>
  )
}
