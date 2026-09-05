import { Link } from 'react-router-dom'
import { Body, Caption, Cite, H2, H3, Label, Legal, UIText } from '../../shared/ui'
import { useT } from '../../i18n'
import type { Dict } from '../../i18n'
import { PublicPage } from './PublicChrome'
import './public.css'

/**
 * Главная — лендинг направления «Документ».
 *
 * Героем страницы служит не иллюстрация, а живой пример работы системы:
 * вопрос, ответ и правовые координаты источника. Иллюстраций и карточек нет,
 * композицию держат типографика, линии и пространство.
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

  /* ---- Живой пример ---- */
  specQLabel: { ru: 'Вопрос', kz: 'Сұрақ', en: 'Question' },
  specQ: {
    ru: 'Я купил квартиру, а через два года выяснилось, что продавец не имел права её продавать. Сколько у меня времени, чтобы оспорить сделку?',
    kz: 'Пәтер сатып алдым, ал екі жылдан кейін сатушының оны сатуға құқығы болмағаны белгілі болды. Мәмілені даулауға қанша уақытым бар?',
    en: 'I bought a flat, and two years later it turned out the seller had no right to sell it. How long do I have to challenge the transaction?',
  },
  specALabel: { ru: 'Ответ TURA', kz: 'TURA жауабы', en: 'TURA answers' },
  specA1pre: {
    ru: 'Общий срок исковой давности — три года ',
    kz: 'Талап қоюдың жалпы мерзімі — үш жыл ',
    en: 'The general limitation period is three years ',
  },
  specA1post: {
    ru: '. Он отсчитывается не со дня сделки, а со дня, когда вы узнали или должны были узнать о нарушении права ',
    kz: '. Ол мәміле жасалған күннен емес, құқығыңыздың бұзылғанын білген немесе білуге тиіс болған күннен басталады ',
    en: '. It runs not from the day of the transaction but from the day you learned, or should have learned, that your right was violated ',
  },
  specA1end: {
    ru: '. В вашем случае отсчёт начался два года назад, значит срок не истёк.',
    kz: '. Сіздің жағдайыңызда есеп екі жыл бұрын басталған, демек мерзім өткен жоқ.',
    en: '. In your case the clock started two years ago, so the period has not expired.',
  },
  specA2pre: {
    ru: 'Сделка, совершённая лицом без надлежащих полномочий, оспорима в судебном порядке ',
    kz: 'Тиісті өкілеттігі жоқ адам жасаған мәміле сот тәртібімен дауланады ',
    en: 'A transaction made by a person without proper authority is voidable in court ',
  },
  specA2end: {
    ru: '. Иск подаётся по месту нахождения недвижимости.',
    kz: '. Талап қоюдың орны — жылжымайтын мүліктің орналасқан жері.',
    en: '. The claim is filed at the location of the property.',
  },
  specSrcLabel: { ru: 'Источники', kz: 'Дереккөздер', en: 'Sources' },
  specSrc1: { ru: 'Гражданский кодекс РК', kz: 'ҚР Азаматтық кодексі', en: 'Civil Code of the RK' },
  specSrc2: { ru: 'Гражданский кодекс РК', kz: 'ҚР Азаматтық кодексі', en: 'Civil Code of the RK' },
  specSrc3: { ru: 'ГПК РК', kz: 'ҚР АПК', en: 'Civil Procedure Code' },

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

export function HomePage() {
  const t = useT(dict)

  return (
    <PublicPage>
      {/* ---------- Первый экран ---------- */}
      <section className="pub-wrap hero" aria-labelledby="hero-title">
        <Label className="hero__label">{t('eyebrow')}</Label>
        <h1 className="pub-display" id="hero-title">
          {t('h1')}
        </h1>
        <p className="t-legal hero__lede">{t('lede')}</p>
        <div className="hero__actions">
          <Link to="/chat" className="pub-cta pub-cta--wide">
            {t('ctaMain')}
          </Link>
          <a href="#how" className="pub-link">
            {t('ctaSecond')}
          </a>
        </div>
      </section>

      {/* ---------- Живой пример вместо иллюстрации ---------- */}
      <section className="pub-wrap" aria-label={t('specALabel')}>
        <figure className="spec">
          <div className="spec__row">
            <Label className="spec__label">{t('specQLabel')}</Label>
            <p className="spec__q">{t('specQ')}</p>
          </div>

          <div className="spec__row">
            <Label className="spec__label">{t('specALabel')}</Label>
            <Legal as="p" className="spec__a">
              {t('specA1pre')}
              <Cite code="ГК РК 178.1" />
              {t('specA1post')}
              <Cite code="ГК РК 180.1" />
              {t('specA1end')}
            </Legal>
            <Legal as="p" className="spec__a">
              {t('specA2pre')}
              <Cite code="ГК РК 159.11" />
              {t('specA2end')}
            </Legal>
          </div>

          <figcaption className="spec__row">
            <Label className="spec__label">{t('specSrcLabel')}</Label>
            <div className="spec__srcs">
              <span className="spec__src">
                <Cite code="ГК РК 178.1" />
                <Caption tone="mute">{t('specSrc1')}</Caption>
              </span>
              <span className="spec__src">
                <Cite code="ГК РК 180.1" />
                <Caption tone="mute">{t('specSrc2')}</Caption>
              </span>
              <span className="spec__src">
                <Cite code="ГПК РК 30.1" />
                <Caption tone="mute">{t('specSrc3')}</Caption>
              </span>
            </div>
          </figcaption>
        </figure>
      </section>

      {/* ---------- Возможности ---------- */}
      <section className="pub-wrap pub-sec" aria-labelledby="mods-title">
        <div className="pub-sec__head">
          <H2 className="pub-sec__title" id="mods-title">
            {t('modsTitle')}
          </H2>
          <Body tone="mute" className="pub-note">
            {t('modsNote')}
          </Body>
        </div>

        <div className="mods">
          {MODULES.map((m) => (
            <article className="mod" key={m.n}>
              <span className="mod__num t-mono">{m.n}</span>
              <H3 as="h3" className="mod__name">
                {t(m.name)}
              </H3>
              <Body className="mod__body">{t(m.body)}</Body>
            </article>
          ))}
        </div>
      </section>

      {/* ---------- Как это работает ---------- */}
      <section className="pub-wrap pub-sec" id="how" aria-labelledby="how-title">
        <div className="pub-sec__head">
          <H2 className="pub-sec__title" id="how-title">
            {t('howTitle')}
          </H2>
          <Body tone="mute" className="pub-note">
            {t('howNote')}
          </Body>
        </div>

        <ol className="steps">
          {STEPS.map((s) => (
            <li className="step" key={s.n}>
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
      </section>

      {/* ---------- Для кого ---------- */}
      <section className="pub-wrap pub-sec" aria-labelledby="who-title">
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
      </section>

      {/* ---------- Доверие ---------- */}
      <section className="pub-wrap pub-sec" aria-labelledby="trust-title">
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
      </section>

      {/* ---------- Призыв в конце ---------- */}
      <section className="pub-wrap final" aria-labelledby="final-title">
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
      </section>
    </PublicPage>
  )
}
