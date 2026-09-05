import { Link } from 'react-router-dom'
import { Body, Cite, H2, Label, Legal } from '../../shared/ui'
import { useT } from '../../i18n'
import type { Dict } from '../../i18n'
import { PublicPage } from './PublicChrome'
import './public.css'

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

export function AboutPage() {
  const t = useT(dict)

  return (
    <PublicPage>
      <section className="pub-wrap about__head" aria-labelledby="about-title">
        <Label>{t('eyebrow')}</Label>
        <h1 className="pub-display about__title" id="about-title">
          {t('title')}
        </h1>
        <p className="t-legal about__lede">{t('lede')}</p>
      </section>

      {/* ---------- Задача ---------- */}
      <section className="pub-wrap about-sec" aria-labelledby="task-title">
        <H2 className="about-sec__title" id="task-title">
          {t('taskTitle')}
        </H2>
        <div className="about-sec__body">
          <Legal as="p">{t('task1')}</Legal>
          <Legal as="p">{t('task2')}</Legal>
          <Legal as="p">{t('task3')}</Legal>
        </div>
      </section>

      {/* ---------- Технология ---------- */}
      <section className="pub-wrap about-sec" aria-labelledby="tech-title">
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
            <Cite code="ГК РК 178.1" />
            {t('tech4post')}
          </Legal>
        </div>
      </section>

      {/* ---------- Коротко о системе ---------- */}
      <section className="pub-wrap about-sec" aria-labelledby="facts-title">
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
      </section>

      {/* ---------- Кто делает ---------- */}
      <section className="pub-wrap about-sec" aria-labelledby="team-title">
        <H2 className="about-sec__title" id="team-title">
          {t('teamTitle')}
        </H2>
        <div className="about-sec__body">
          <Legal as="p">{t('team1')}</Legal>
          <Legal as="p">{t('team2')}</Legal>
        </div>
      </section>

      {/* ---------- Оговорка ---------- */}
      <section className="pub-wrap about-sec" id="disclaimer" aria-labelledby="disc-title">
        <H2 className="about-sec__title" id="disc-title">
          {t('discTitle')}
        </H2>
        <div className="about-sec__body">
          <Legal as="p">{t('disc')}</Legal>
        </div>
      </section>

      {/* ---------- Контакты ---------- */}
      <section className="pub-wrap about-sec" id="contacts" aria-labelledby="contacts-title">
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
      </section>

      {/* ---------- Призыв ---------- */}
      <section className="pub-wrap final" aria-labelledby="about-cta">
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
      </section>
    </PublicPage>
  )
}
