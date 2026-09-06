import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties, MouseEvent } from 'react'
import { Link } from '../../shared/nav'
import { Reveal } from '../../shared/motion'
import { Body, Button, Caption, Caret, Cite, H2, H3, Label, Legal, Mono, Status, UIText } from '../../shared/ui'
import { useLang, useT, withLang } from '../../i18n'
import type { Dict } from '../../i18n'
import { citeCode } from '../legal/cite'
import { PublicPage } from './PublicChrome'
import './public.css'
import './public.motion.css'
import { useNavigate } from 'react-router-dom'

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
  askPlaceholder: {
    ru: 'Спросите о чём угодно по праву РК — например, о сроке исковой давности',
    kz: 'ҚР құқығы бойынша кез келген нәрсені сұраңыз — мысалы, талап қою мерзімі туралы',
    en: 'Ask anything about the law of Kazakhstan — the limitation period, for instance',
  },
  askAria: { ru: 'Вопрос по праву Казахстана', kz: 'Қазақстан құқығы бойынша сұрақ', en: 'Question about Kazakhstan law' },
  tryLabel: { ru: 'Попробуйте', kz: 'Байқап көріңіз', en: 'Try' },
  stamp1: { ru: 'Ответ', kz: 'Жауап', en: 'Answer' },
  stamp2: { ru: 'со ссылкой', kz: 'нормаға', en: 'with a link' },
  stamp3: { ru: 'на норму', kz: 'сілтемемен', en: 'to the norm' },
  meta1: { ru: 'Право РК', kz: 'ҚР құқығы', en: 'Law of Kazakhstan' },
  meta2: { ru: 'Три языка', kz: 'Үш тіл', en: 'Three languages' },
  meta3: { ru: 'Редакция 2026', kz: '2026 редакциясы', en: '2026 edition' },

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
  figsLabel: { ru: 'Система в цифрах', kz: 'Жүйе сандармен', en: 'The system in numbers' },
  fig1: { ru: 'нормативных актов в базе', kz: 'дерекқордағы нормативтік акт', en: 'legal acts indexed' },
  fig2: { ru: 'обязательных разделов в пакете законопроекта', kz: 'заң жобасы топтамасындағы міндетті бөлім', en: 'mandatory sections in a draft-law package' },
  fig3: { ru: 'типов договоров', kz: 'шарт түрі', en: 'contract types' },
  fig4: { ru: 'языка без потери качества', kz: 'сапасын жоғалтпайтын тіл', en: 'languages, without loss of quality' },
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

  /* ---- Витрина модулей ---- */
  showLine1: { ru: 'Вопрос — ответ — норма', kz: 'Сұрақ — жауап — норма', en: 'Question, answer, norm' },
  showLine2: { ru: 'Проверка и сборка условий', kz: 'Талаптарды тексеру және құрастыру', en: 'Clause check and assembly' },
  showLine3: { ru: 'Пакет по стандартам РК', kz: 'ҚР стандарттары бойынша топтама', en: 'A package to state standards' },
  showLine4: { ru: 'Темы и тональность отзывов', kz: 'Пікірлердің тақырыбы мен реңкі', en: 'Topics and sentiment of feedback' },
  showOpen: { ru: 'Открыть раздел', kz: 'Бөлімді ашу', en: 'Open the section' },
  showAria: { ru: 'Модуль', kz: 'Модуль', en: 'Module' },

  mcYou: { ru: 'Вы', kz: 'Сіз', en: 'You' },
  mcTura: { ru: 'TURA', kz: 'TURA', en: 'TURA' },
  mcQ: {
    ru: 'Какой срок исковой давности по договору поставки?',
    kz: 'Жеткізу шарты бойынша талап қою мерзімі қандай?',
    en: 'What is the limitation period under a supply contract?',
  },
  mcA1: {
    ru: 'Общий срок исковой давности — три года ',
    kz: 'Талап қоюдың жалпы мерзімі — үш жыл ',
    en: 'The general limitation period is three years ',
  },
  mcA2: {
    ru: '. Он течёт со дня, когда лицо узнало или должно было узнать о нарушении права ',
    kz: '. Ол тұлға құқығының бұзылғанын білген немесе білуге тиіс болған күннен бастап есептеледі ',
    en: '. It runs from the day the person learned, or should have learned, of the violation ',
  },
  mcA3: { ru: '.', kz: '.', en: '.' },
  mcSrc: { ru: 'Источники', kz: 'Дереккөздер', en: 'Sources' },

  mkDoc: { ru: 'Договор поставки № 14-2026', kz: '№ 14-2026 жеткізу шарты', en: 'Supply contract No. 14-2026' },
  mkCount: { ru: '3 замечания', kz: '3 ескерту', en: '3 findings' },
  mkErr: { ru: 'риск', kz: 'тәуекел', en: 'risk' },
  mkWarn: { ru: 'уточнить', kz: 'нақтылау', en: 'clarify' },
  mkOk: { ru: 'в порядке', kz: 'дұрыс', en: 'in order' },
  mk1: {
    ru: 'Неустойка 5 % в день без верхнего предела — суд вправе её уменьшить',
    kz: 'Күніне 5 % тұрақсыздық айыбы жоғарғы шегі жоқ — сот оны азайтуға құқылы',
    en: 'A 5% daily penalty with no cap — the court may reduce it',
  },
  mk2: {
    ru: 'Срок поставки не определён — будет считаться разумным сроком',
    kz: 'Жеткізу мерзімі анықталмаған — қисынды мерзім деп есептеледі',
    en: 'No delivery deadline — a reasonable period will be implied',
  },
  mk3: {
    ru: 'Письменная форма соблюдена, реквизиты сторон полные',
    kz: 'Жазбаша нысан сақталған, тараптардың деректемелері толық',
    en: 'Written form observed, party details complete',
  },
  mk1n: { ru: 'Уменьшение неустойки', kz: 'Тұрақсыздық айыбын азайту', en: 'Reduction of a penalty' },
  mk2n: { ru: 'Срок исполнения обязательства', kz: 'Міндеттемені орындау мерзімі', en: 'Time for performance' },
  mk3n: { ru: 'Письменная форма сделки', kz: 'Мәміленің жазбаша нысаны', en: 'Written form of a transaction' },

  mlDoc: {
    ru: 'О внесении изменений в вопросы цифровых активов',
    kz: 'Цифрлық активтер мәселелері бойынша өзгерістер енгізу туралы',
    en: 'On amendments concerning digital assets',
  },
  mlReady: { ru: 'готово', kz: 'дайын', en: 'ready' },
  mlWork: { ru: 'в работе', kz: 'жұмыста', en: 'in progress' },
  mlWait: { ru: 'ожидает', kz: 'кезекте', en: 'pending' },
  ml1: { ru: 'Текст закона', kz: 'Заң мәтіні', en: 'Text of the act' },
  ml2: { ru: 'Пояснительная записка', kz: 'Түсіндірме жазба', en: 'Explanatory note' },
  ml3: { ru: 'Финансово-экономическое обоснование', kz: 'Қаржы-экономикалық негіздеме', en: 'Financial justification' },
  ml4: { ru: 'Сравнительная таблица', kz: 'Салыстырмалы кесте', en: 'Comparison table' },
  ml5: { ru: 'Прогноз последствий', kz: 'Салдарды болжау', en: 'Impact forecast' },
  ml6: { ru: 'Заключение научной экспертизы', kz: 'Ғылыми сараптама қорытындысы', en: 'Scientific review opinion' },

  maDoc: { ru: 'Комментарии к законопроекту', kz: 'Заң жобасына пікірлер', en: 'Comments on the draft law' },
  maCount: { ru: '1 247 отзывов', kz: '1 247 пікір', en: '1,247 responses' },
  maPos: { ru: 'за', kz: 'қолдайды', en: 'for' },
  maNeu: { ru: 'нейтрально', kz: 'бейтарап', en: 'neutral' },
  maNeg: { ru: 'против', kz: 'қарсы', en: 'against' },
  maThemes: { ru: 'Темы', kz: 'Тақырыптар', en: 'Topics' },
  ma1: { ru: 'Сроки переходного периода', kz: 'Өтпелі кезең мерзімдері', en: 'Transition period deadlines' },
  ma2: { ru: 'Размер штрафов', kz: 'Айыппұл мөлшері', en: 'Size of fines' },
  ma3: { ru: 'Порядок уведомления', kz: 'Хабарлау тәртібі', en: 'Notification procedure' },

  /* ---- Конвейер ---- */
  pipeQ: {
    ru: 'Можно ли расторгнуть аренду досрочно?',
    kz: 'Жалдау шартын мерзімінен бұрын бұзуға бола ма?',
    en: 'Can a lease be terminated early?',
  },
  pipeFound: { ru: 'Найдено в базе', kz: 'Базадан табылды', en: 'Found in the base' },
  pipeAnswer: { ru: 'Ответ', kz: 'Жауап', en: 'Answer' },
  pipeF1a: { ru: 'Гражданский кодекс РК, ст. 401', kz: 'ҚР Азаматтық кодексі, 401-бап', en: 'Civil Code RK, art. 401' },
  pipeF1t: {
    ru: 'Изменение и расторжение договора возможны по соглашению сторон, если иное не предусмотрено…',
    kz: 'Шартты өзгерту және бұзу тараптардың келісімі бойынша мүмкін, егер өзгеше көзделмесе…',
    en: 'A contract may be amended or terminated by agreement of the parties, unless otherwise…',
  },
  pipeF2a: { ru: 'Гражданский кодекс РК, ст. 556', kz: 'ҚР Азаматтық кодексі, 556-бап', en: 'Civil Code RK, art. 556' },
  pipeF2t: {
    ru: 'По требованию нанимателя договор может быть расторгнут судом досрочно в случаях, когда…',
    kz: 'Жалдаушының талабы бойынша шартты сот мерзімінен бұрын бұза алады, егер…',
    en: 'At the lessee’s request the court may terminate the contract early where…',
  },
  pipeF3a: { ru: 'Гражданский кодекс РК, ст. 545', kz: 'ҚР Азаматтық кодексі, 545-бап', en: 'Civil Code RK, art. 545' },
  pipeF3t: {
    ru: 'По требованию наймодателя договор может быть расторгнут судом досрочно, если наниматель…',
    kz: 'Жалға берушінің талабы бойынша шартты сот мерзімінен бұрын бұза алады, егер жалдаушы…',
    en: 'At the lessor’s request the court may terminate the contract early if the lessee…',
  },
  pipeA1: {
    ru: 'Да, но не по одному лишь своему желанию. Договор расторгается по соглашению сторон ',
    kz: 'Иә, бірақ тек өз қалауымен емес. Шарт тараптардың келісімі бойынша бұзылады ',
    en: 'Yes, but not at will. The contract is terminated by agreement of the parties ',
  },
  pipeA2: {
    ru: ', а без согласия наймодателя — только через суд и по основаниям, названным в законе ',
    kz: ', ал жалға берушінің келісімінсіз — тек сот арқылы және заңда аталған негіздер бойынша ',
    en: ', and without the lessor’s consent only through court, on the grounds the law names ',
  },
  pipeA3: { ru: '.', kz: '.', en: '.' },
  pipeAgain: { ru: 'Показать ещё раз', kz: 'Тағы көрсету', en: 'Play again' },
  pipeAria: { ru: 'Путь вопроса к ответу', kz: 'Сұрақтан жауапқа дейінгі жол', en: 'From question to answer' },

  /* ---- Аудитории ---- */
  audAria: { ru: 'Аудитория', kz: 'Аудитория', en: 'Audience' },
  audDoes: { ru: 'Что делает TURA', kz: 'TURA не істейді', en: 'What TURA does' },
  audNorm: { ru: 'Норма', kz: 'Норма', en: 'The norm' },
  aud1role: { ru: 'госзакупки, акты, ответы заявителям', kz: 'мемлекеттік сатып алу, актілер, өтініш иелеріне жауап', en: 'procurement, regulations, replies to applicants' },
  aud1q: {
    ru: 'Конкурс не состоялся — можно ли заключить договор из одного источника?',
    kz: 'Конкурс өтпеді — бір көзден шарт жасасуға бола ма?',
    en: 'The tender failed — may we contract from a single source?',
  },
  aud1d1: { ru: 'Находит основания закупок из одного источника и условия их применения', kz: 'Бір көзден сатып алу негіздерін және оларды қолдану шарттарын табады', en: 'Finds the grounds for single-source procurement and the conditions attached' },
  aud1d2: { ru: 'Сверяет ситуацию с перечнем: несостоявшийся конкурс — отдельный случай', kz: 'Жағдайды тізіммен салыстырады: өтпеген конкурс — жеке жағдай', en: 'Checks the case against the list: a failed tender is a separate ground' },
  aud1d3: { ru: 'Готовит формулировку для протокола со ссылкой на норму', kz: 'Хаттама үшін нормаға сілтемесі бар тұжырым дайындайды', en: 'Drafts the wording for the minutes, with the norm cited' },
  aud1n: { ru: 'Закупки из одного источника', kz: 'Бір көзден сатып алу', en: 'Single-source procurement' },

  aud2role: { ru: 'позиция по делу, неустойка, практика', kz: 'іс бойынша ұстаным, тұрақсыздық айыбы, практика', en: 'case position, penalties, precedent' },
  aud2q: {
    ru: 'Неустойка 0,5 % в день уже превысила долг. Есть основания её снизить?',
    kz: 'Күніне 0,5 % тұрақсыздық айыбы қарыздан асып кетті. Оны азайтуға негіз бар ма?',
    en: 'A 0.5% daily penalty now exceeds the debt. Are there grounds to reduce it?',
  },
  aud2d1: { ru: 'Приводит критерий явной несоразмерности неустойки последствиям нарушения', kz: 'Тұрақсыздық айыбының бұзушылық салдарына айқын сәйкессіздігі өлшемін келтіреді', en: 'States the test of manifest disproportion to the consequences of the breach' },
  aud2d2: { ru: 'Показывает, что оценка соразмерности — право суда, а не сторон', kz: 'Мөлшерлестікті бағалау тараптардың емес, соттың құқығы екенін көрсетеді', en: 'Shows that proportionality is for the court, not the parties, to assess' },
  aud2d3: { ru: 'Собирает формулировку ходатайства с координатами норм', kz: 'Нормалардың координаталарымен өтінішхат тұжырымын құрастырады', en: 'Assembles the wording of the motion with the coordinates of the norms' },
  aud2n: { ru: 'Уменьшение неустойки', kz: 'Тұрақсыздық айыбын азайту', en: 'Reduction of a penalty' },

  aud3role: { ru: 'договоры, проверки, решения', kz: 'шарттар, тексерулер, шешімдер', en: 'contracts, audits, decisions' },
  aud3q: {
    ru: 'В договоре поставки не указан срок. Он вообще действует?',
    kz: 'Жеткізу шартында мерзім көрсетілмеген. Ол мүлде күшінде ме?',
    en: 'The supply contract names no deadline. Is it valid at all?',
  },
  aud3d1: { ru: 'Проверяет существенные условия: предмет есть, срок восполняется законом', kz: 'Елеулі талаптарды тексереді: мәні бар, мерзімді заң толықтырады', en: 'Checks the essential terms: the subject is there, the deadline is supplied by law' },
  aud3d2: { ru: 'Отмечает риск: «разумный срок» будет спорить с вашими ожиданиями', kz: 'Тәуекелді белгілейді: «қисынды мерзім» сіздің күткеніңізбен дауласады', en: 'Flags the risk: a “reasonable period” will argue with your expectations' },
  aud3d3: { ru: 'Предлагает редакцию пункта о сроке для дополнительного соглашения', kz: 'Қосымша келісім үшін мерзім туралы тармақтың редакциясын ұсынады', en: 'Proposes wording for a deadline clause in a supplementary agreement' },
  aud3n: { ru: 'Срок исполнения обязательства', kz: 'Міндеттемені орындау мерзімі', en: 'Time for performance' },

  aud4role: { ru: 'работа, аренда, семья', kz: 'жұмыс, жалдау, отбасы', en: 'work, housing, family' },
  aud4q: {
    ru: 'Зарплату задерживают второй месяц. Что я могу сделать?',
    kz: 'Жалақы екінші ай кешігіп жатыр. Мен не істей аламын?',
    en: 'My salary is two months late. What can I do?',
  },
  aud4d1: { ru: 'Объясняет: выплата — не позднее первой декады следующего месяца', kz: 'Түсіндіреді: төлем — келесі айдың бірінші онкүндігінен кешіктірілмей', en: 'Explains: payment is due no later than the first ten days of the following month' },
  aud4d2: { ru: 'Называет пеню за каждый день задержки и как её посчитать', kz: 'Кешіктірген әр күн үшін өсімпұлды және оны қалай есептеуді атайды', en: 'Names the daily late-payment charge and how to compute it' },
  aud4d3: { ru: 'Показывает, куда обратиться: инспекция труда, согласительная комиссия, суд', kz: 'Қайда жүгінуді көрсетеді: еңбек инспекциясы, келісім комиссиясы, сот', en: 'Shows where to turn: the labour inspectorate, the conciliation commission, the court' },
  aud4n: { ru: 'Сроки выплаты заработной платы', kz: 'Жалақы төлеу мерзімдері', en: 'Wage payment deadlines' },

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

/** Миллисекунды из токена движения: «220ms» → 220. Так JS-тайминги
 *  живут в tokens.css вместе с CSS и гаснут при «меньше движения». */
function tokenMs(name: string): number {
  if (typeof window === 'undefined') return 0
  const v = getComputedStyle(document.documentElement).getPropertyValue(name)
  return parseFloat(v) || 0
}

/* ============================================================
   Витрина модулей: мини-экраны из настоящих элементов интерфейса
   ============================================================ */

const SHOW = [
  { id: 'chat', name: 'mod1', line: 'showLine1', to: '/chat' },
  { id: 'contracts', name: 'mod2', line: 'showLine2', to: '/contracts' },
  { id: 'laws', name: 'mod3', line: 'showLine3', to: '/laws' },
  { id: 'analytics', name: 'mod4', line: 'showLine4', to: '/analytics' },
] as const

/** Витрина листает модули сама, пока читатель не выбрал свой. */
const SHOW_MS = 6000

function MiniChat() {
  const { lang } = useLang()
  const t = useT(dict)
  return (
    <div className="mini">
      <Label className="mini__stamp">{t('mcYou')}</Label>
      <UIText className="mini__ask">{t('mcQ')}</UIText>
      <Label className="mini__stamp mini__stamp--gap">{t('mcTura')}</Label>
      <Legal as="p" className="mini__answer">
        {t('mcA1')}
        <Cite code={citeCode('ГК РК 178.1', lang)} tabIndex={-1} />
        {t('mcA2')}
        <Cite code={citeCode('ГК РК 180.1', lang)} tabIndex={-1} />
        {t('mcA3')}
      </Legal>
      <div className="mini__srcs">
        <Label>{t('mcSrc')}</Label>
        <span className="mini__src">
          <Cite code={citeCode('ГК РК 178.1', lang)} tabIndex={-1} />
          <Caption tone="mute">{t('n178t')}</Caption>
        </span>
        <span className="mini__src">
          <Cite code={citeCode('ГК РК 180.1', lang)} tabIndex={-1} />
          <Caption tone="mute">{t('n180t')}</Caption>
        </span>
      </div>
    </div>
  )
}

const FINDINGS = [
  { kind: 'err', mark: 'mkErr', text: 'mk1', cite: 'ГК РК 297', norm: 'mk1n' },
  { kind: 'warn', mark: 'mkWarn', text: 'mk2', cite: 'ГК РК 277', norm: 'mk2n' },
  { kind: 'ok', mark: 'mkOk', text: 'mk3', cite: 'ГК РК 152', norm: 'mk3n' },
] as const

function MiniContracts() {
  const { lang } = useLang()
  const t = useT(dict)
  return (
    <div className="mini">
      <div className="mini__head">
        <span className="mini__doc">{t('mkDoc')}</span>
        <Caption tone="mute">{t('mkCount')}</Caption>
      </div>
      {FINDINGS.map((f, i) => (
        <div className="mini__find enter-item" style={{ ['--i' as string]: i } as CSSProperties} key={f.cite}>
          <Status kind={f.kind}>{t(f.mark)}</Status>
          <span className="mini__find-text">{t(f.text)}</span>
          <span className="mini__src">
            <Cite code={citeCode(f.cite, lang)} tabIndex={-1} />
            <Caption tone="mute">{t(f.norm)}</Caption>
          </span>
        </div>
      ))}
    </div>
  )
}

const TOC = [
  { n: 'I', name: 'ml1', state: 'ok', mark: 'mlReady' },
  { n: 'II', name: 'ml2', state: 'ok', mark: 'mlReady' },
  { n: 'III', name: 'ml3', state: 'ok', mark: 'mlReady' },
  { n: 'IV', name: 'ml4', state: 'warn', mark: 'mlWork' },
  { n: 'V', name: 'ml5', state: 'idle', mark: 'mlWait' },
  { n: 'VI', name: 'ml6', state: 'idle', mark: 'mlWait' },
] as const

function MiniLaws() {
  const t = useT(dict)
  return (
    <div className="mini">
      <div className="mini__head">
        <span className="mini__doc">{t('mlDoc')}</span>
      </div>
      <ol className="mini__toc">
        {TOC.map((s, i) => (
          <li className="mini__sec enter-item" style={{ ['--i' as string]: i } as CSSProperties} key={s.n}>
            <span className="mini__sec-num">{s.n}.</span>
            <span className="mini__sec-name">{t(s.name)}</span>
            <Status kind={s.state}>{t(s.mark)}</Status>
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

function MiniAnalytics() {
  const t = useT(dict)
  const top = THEMES[0].count
  return (
    <div className="mini">
      <div className="mini__head">
        <span className="mini__doc">{t('maDoc')}</span>
        <Caption tone="mute" className="tabular">
          {t('maCount')}
        </Caption>
      </div>
      <div className="mini__bar" aria-hidden="true">
        {TONE.map((s) => (
          <span className={`mini__seg mini__seg--${s.k}`} style={{ width: `${s.share}%` }} key={s.k} />
        ))}
      </div>
      <div className="mini__legend">
        {TONE.map((s) => (
          <span className="mini__legend-item" key={s.k}>
            <span className={`mini__swatch mini__seg--${s.k}`} aria-hidden="true" />
            <Caption tone="ink2" className="tabular">
              {s.share} % · {t(s.label)}
            </Caption>
          </span>
        ))}
      </div>
      <Label className="mini__stamp mini__stamp--gap">{t('maThemes')}</Label>
      <ol className="mini__themes">
        {THEMES.map((th, i) => (
          <li className="mini__theme enter-item" style={{ ['--i' as string]: i } as CSSProperties} key={th.name}>
            <span className="mini__theme-name">{t(th.name)}</span>
            <span className="mini__theme-track" aria-hidden="true">
              <span className="mini__theme-fill" style={{ width: `${(th.count / top) * 100}%` }} />
            </span>
            <span className="mini__theme-num tabular">{th.count}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

function Showcase() {
  const t = useT(dict)
  const [active, setActive] = useState(0)
  const [held, setHeld] = useState(false)

  useEffect(() => {
    if (held || reducedMotion()) return
    const id = window.setInterval(() => setActive((i) => (i + 1) % SHOW.length), SHOW_MS)
    return () => window.clearInterval(id)
  }, [held])

  const mod = SHOW[active]

  return (
    <div className="show">
      <div className="show__pick" role="tablist" aria-label={t('showAria')}>
        {SHOW.map((m, i) => (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={i === active}
            className={['show__tab', i === active ? 'show__tab--on' : ''].filter(Boolean).join(' ')}
            onClick={() => {
              setHeld(true)
              setActive(i)
            }}
          >
            <span className="show__tab-num" aria-hidden="true">
              0{i + 1}
            </span>
            <span className="show__tab-name">{t(m.name)}</span>
            <span className="show__tab-line">{t(m.line)}</span>
          </button>
        ))}
      </div>

      <div className="show__stage">
        <div className="show__screen swap" key={mod.id} aria-live="polite">
          {mod.id === 'chat' ? <MiniChat /> : null}
          {mod.id === 'contracts' ? <MiniContracts /> : null}
          {mod.id === 'laws' ? <MiniLaws /> : null}
          {mod.id === 'analytics' ? <MiniAnalytics /> : null}
        </div>
        <Link to={mod.to} className="pub-link show__open">
          {t('showOpen')} →
        </Link>
      </div>
    </div>
  )
}

/* ============================================================
   Конвейер: вопрос → найденные фрагменты → ответ с координатами
   ============================================================ */

const STEPS = [
  { n: 'I', name: 'step1', body: 'step1d' },
  { n: 'II', name: 'step2', body: 'step2d' },
  { n: 'III', name: 'step3', body: 'step3d' },
] as const

const FRAGS = [
  { act: 'pipeF1a', text: 'pipeF1t' },
  { act: 'pipeF2a', text: 'pipeF2t' },
  { act: 'pipeF3a', text: 'pipeF3t' },
] as const

/** Фаза сцены: 0 — не началась, 1 — набор вопроса, 2 — поиск, 3 — ответ. */
type Phase = 0 | 1 | 2 | 3

function Pipeline() {
  const { lang } = useLang()
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

    const stagger = tokenMs('--stagger')
    const dur3 = tokenMs('--dur-3')
    const at = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms))

    setTyped(0)
    setPhase(1)
    /* Буквы набираются с шагом ленты: та же скорость, что у очереди появления. */
    let clock = dur3
    for (let i = 1; i <= chars.length; i++) {
      clock += stagger
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
    <div className="pipe" ref={ref} aria-label={t('pipeAria')}>
      <div className="pipe__scene" aria-live="polite">
        {/* I. Поле с набирающимся вопросом */}
        <div className={['pipe__ask', phase >= 1 ? 'pipe__ask--on' : ''].filter(Boolean).join(' ')}>
          <span className="pipe__typed">{chars.slice(0, typed).join('')}</span>
          {phase === 1 ? <Caret /> : null}
        </div>

        {/* II. Найденные фрагменты */}
        {phase >= 2 ? (
          <div className="pipe__found" key={`f-${run}`}>
            <Label className="pipe__label">{t('pipeFound')}</Label>
            {FRAGS.map((f, i) => (
              <div className="pipe__frag enter-item" style={{ ['--i' as string]: i } as CSSProperties} key={f.act}>
                <span className="pipe__frag-act">{t(f.act)}</span>
                <span className="pipe__frag-text">{t(f.text)}</span>
              </div>
            ))}
          </div>
        ) : null}

        {/* III. Ответ с координатами */}
        {phase >= 3 ? (
          <div className="pipe__answer enter" key={`a-${run}`}>
            <Label className="pipe__label">{t('pipeAnswer')}</Label>
            <Legal as="p" className="pipe__answer-text">
              {t('pipeA1')}
              <Cite code={citeCode('ГК РК 401.1', lang)} tabIndex={-1} />
              {t('pipeA2')}
              <Cite code={citeCode('ГК РК 556', lang)} tabIndex={-1} />
              {t('pipeA3')}
            </Legal>
          </div>
        ) : null}
      </div>

      <ol className="pipe__steps">
        {STEPS.map((s, i) => {
          const n = (i + 1) as Phase
          const cls = ['pipe__step', phase >= n ? 'pipe__step--on' : '', phase === n ? 'pipe__step--now' : '']
          return (
            <li className={cls.filter(Boolean).join(' ')} key={s.n} aria-current={phase === n ? 'step' : undefined}>
              <span className="pipe__num" aria-hidden="true">
                {s.n}
              </span>
              <div className="pipe__step-body">
                <H3 as="h3" className="pipe__name">
                  {t(s.name)}
                </H3>
                <Body className="pipe__desc">{t(s.body)}</Body>
              </div>
            </li>
          )
        })}
        <li className="pipe__again">
          <Button variant="ghost" onClick={replay} disabled={!shown || phase < 3}>
            {t('pipeAgain')}
          </Button>
        </li>
      </ol>
    </div>
  )
}

/* ============================================================
   Аудитории: четыре человека, четыре вопроса
   ============================================================ */

const AUD = [
  { id: 'gov', who: 'who1', role: 'aud1role', q: 'aud1q', does: ['aud1d1', 'aud1d2', 'aud1d3'], cite: 'ЗРК О госзакупках 39', norm: 'aud1n' },
  { id: 'law', who: 'who2', role: 'aud2role', q: 'aud2q', does: ['aud2d1', 'aud2d2', 'aud2d3'], cite: 'ГК РК 297', norm: 'aud2n' },
  { id: 'biz', who: 'who3', role: 'aud3role', q: 'aud3q', does: ['aud3d1', 'aud3d2', 'aud3d3'], cite: 'ГК РК 277', norm: 'aud3n' },
  { id: 'cit', who: 'who4', role: 'aud4role', q: 'aud4q', does: ['aud4d1', 'aud4d2', 'aud4d3'], cite: 'ТК РК 113', norm: 'aud4n' },
] as const

function Audiences() {
  const { lang } = useLang()
  const t = useT(dict)
  const [active, setActive] = useState(0)
  const a = AUD[active]

  return (
    <div className="aud">
      <div className="aud__pick" role="tablist" aria-label={t('audAria')}>
        {AUD.map((x, i) => (
          <button
            key={x.id}
            type="button"
            role="tab"
            aria-selected={i === active}
            className={['aud__tab', i === active ? 'aud__tab--on' : ''].filter(Boolean).join(' ')}
            onClick={() => setActive(i)}
          >
            <span className="aud__tab-name">{t(x.who)}</span>
            <span className="aud__tab-role">{t(x.role)}</span>
          </button>
        ))}
      </div>

      <div className="aud__scene swap" key={a.id} aria-live="polite">
        <p className="aud__q">{t(a.q)}</p>
        <div className="aud__side">
          <Label className="aud__label">{t('audDoes')}</Label>
          <ol className="aud__does">
            {a.does.map((d, i) => (
              <li className="aud__do enter-item" style={{ ['--i' as string]: i } as CSSProperties} key={d}>
                <Body>{t(d)}</Body>
              </li>
            ))}
          </ol>
          <Label className="aud__label aud__label--gap">{t('audNorm')}</Label>
          <span className="mini__src">
            <Cite code={citeCode(a.cite, lang)} tabIndex={-1} />
            <Caption tone="mute">{t(a.norm)}</Caption>
          </span>
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   Доверие: четыре принципа сеткой
   ============================================================ */

const TRUST = [
  { n: '01', term: 'trust1', def: 'trust1d' },
  { n: '02', term: 'trust2', def: 'trust2d' },
  { n: '03', term: 'trust3', def: 'trust3d' },
  { n: '04', term: 'trust4', def: 'trust4d' },
] as const

/* ============================================================
   Страница
   ============================================================ */

export function HomePage() {
  const { lang } = useLang()
  const [ask, setAsk] = useState('')
  const navigate = useNavigate()
  const t = useT(dict)
  const [trustRef, trustShown] = useOnScreen<HTMLOListElement>()

  /** Якорь «Как это работает» ведёт к разделу, а не только меняет адрес. */
  const toHow = useCallback((e: MouseEvent<HTMLAnchorElement>) => {
    const el = document.getElementById('how')
    if (!el) return
    e.preventDefault()
    el.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' })
  }, [])

  return (
    <PublicPage>
      {/* ---------- Обложка ----------
          Первый экран — не описание продукта, а сам продукт: чернильный
          разворот с полем ввода. Вопрос задаётся прямо здесь и уносится
          в консультанта. Раньше здесь были две кнопки и полтора экрана
          пустоты справа. */}
      <section className="band band--ink cover" aria-labelledby="hero-title">
        <div className="pub-wrap cover__inner">
          <div className="cover__meta enter">
            <span>{t('meta1')}</span>
            <span>{t('meta2')}</span>
            <span>{t('meta3')}</span>
          </div>

          <h1 className="cover__title enter" id="hero-title" style={step(1)}>
            {t('h1')}
          </h1>

          <p className="cover__lede enter" style={step(2)}>
            {t('lede')}
          </p>

          <form
            className="ask enter"
            style={step(3)}
            onSubmit={(e) => {
              e.preventDefault()
              const q = ask.trim()
              navigate(withLang(q ? `/chat?q=${encodeURIComponent(q)}` : '/chat', lang))
            }}
          >
            <input
              className="ask__field"
              value={ask}
              onChange={(e) => setAsk(e.target.value)}
              placeholder={t('askPlaceholder')}
              aria-label={t('askAria')}
            />
            <button type="submit" className="ask__go">
              {t('ctaMain')}
            </button>
          </form>

          <div className="cover__try enter" style={step(4)}>
            <span className="cover__try-label">{t('tryLabel')}</span>
            {SPECS.slice(0, 3).map((c) => (
              <button
                key={c.id}
                type="button"
                className="cover__chip"
                onClick={() => setAsk(t(c.q))}
              >
                {t(c.tab)}
              </button>
            ))}
            <a href="#how" className="cover__how" onClick={toHow}>
              {t('ctaSecond')}
            </a>
          </div>

          {/* Печать: типографский штамп, как на правовом документе */}
          <div className="stamp" aria-hidden="true">
            <span>{t('stamp1')}</span>
            <span>{t('stamp2')}</span>
            <span>{t('stamp3')}</span>
          </div>
        </div>
      </section>

      {/* ---------- Живая выписка вместо иллюстрации ---------- */}
      <section className="pub-wrap enter" aria-label={t('specALabel')} style={step(4)}>
        <LiveSpec />
      </section>

      {/* ---------- Цифры продукта на чернильной полосе ----------
          Единственный контрастный блок страницы: без него вся полоса от
          шапки до подвала идёт одним тоном и читается плоско. */}
      <Reveal as="section" className="band band--ink" aria-label={t('figsLabel')}>
        <div className="pub-wrap figs">
          <div className="fig">
            <span className="fig__num">400+</span>
            <span className="fig__cap">{t('fig1')}</span>
          </div>
          <div className="fig">
            <span className="fig__num">13</span>
            <span className="fig__cap">{t('fig2')}</span>
          </div>
          <div className="fig">
            <span className="fig__num">9</span>
            <span className="fig__cap">{t('fig3')}</span>
          </div>
          <div className="fig">
            <span className="fig__num">3</span>
            <span className="fig__cap">{t('fig4')}</span>
          </div>
        </div>
      </Reveal>

      {/* ---------- Витрина модулей ---------- */}
      <Reveal as="section" className="pub-wrap pub-sec" aria-labelledby="mods-title">
        <div className="pub-sec__head">
          <H2 className="pub-sec__title" id="mods-title">
            {t('modsTitle')}
          </H2>
          <Body tone="mute" className="pub-note">
            {t('modsNote')}
          </Body>
        </div>
        <Showcase />
      </Reveal>

      {/* ---------- Как это работает: конвейер ---------- */}
      <Reveal as="section" className="band band--surface" id="how" aria-labelledby="how-title">
        <div className="pub-wrap pub-sec">
          <div className="pub-sec__head">
            <H2 className="pub-sec__title" id="how-title">
              {t('howTitle')}
            </H2>
            <Body tone="mute" className="pub-note">
              {t('howNote')}
            </Body>
          </div>
          <Pipeline />
        </div>
      </Reveal>

      {/* ---------- Для кого: аудитории ---------- */}
      <Reveal as="section" className="pub-wrap pub-sec" aria-labelledby="who-title">
        <div className="pub-sec__head">
          <H2 className="pub-sec__title" id="who-title">
            {t('whoTitle')}
          </H2>
        </div>
        <Audiences />
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
          <ol className="trust-grid" ref={trustRef}>
            {TRUST.map((it, i) => (
              <li
                className={['trust-cell', trustShown ? 'enter-item' : 'pre-enter'].join(' ')}
                style={{ ['--i' as string]: i } as CSSProperties}
                key={it.term}
              >
                <span className="trust-cell__num" aria-hidden="true">
                  {it.n}
                </span>
                <span className="trust-cell__term">{t(it.term)}</span>
                <Body className="trust-cell__def">{t(it.def)}</Body>
              </li>
            ))}
          </ol>
        </div>
      </Reveal>

      {/* ---------- Призыв в конце ---------- */}
      <Reveal as="section" className="band band--ink" aria-labelledby="final-title">
        <div className="pub-wrap final">
          <h2 className="final__title" id="final-title">
            {t('finalTitle')}
          </h2>
          <p className="t-body final__lede">{t('finalLede')}</p>
          <div className="final__actions">
            <Link to="/register" className="pub-cta pub-cta--wide pub-cta--onink">
              <UIText>{t('ctaMain')}</UIText>
            </Link>
            <Link to="/about" className="pub-link pub-link--onink">
              {t('finalAbout')}
            </Link>
          </div>
        </div>
      </Reveal>
    </PublicPage>
  )
}
