import { useState } from 'react'
import {
  Body,
  Button,
  Caption,
  Display,
  Empty,
  H2,
  Input,
  Label,
  Legal,
  Status,
  Textarea,
  UIText,
} from '../../shared/ui'
import type { StatusKind } from '../../shared/ui'
import { useLang, useT } from '../../i18n'
import type { Dict } from '../../i18n'
import './laws.css'

/* ============================================================
   Законопроекты.

   Пакет документов повторяет разделы law_generator/templates.py:
   титульный лист, аннотация, пояснительная записка, текст закона,
   сравнительная таблица, финансово-экономическое обоснование, ОРВ,
   акт соответствия, антикоррупционная экспертиза, прогноз, глоссарий,
   машиночитаемое приложение и журнал аудита.

   Результат показывается оглавлением: номер антиквой, название раздела,
   состояние готовности, разворачивается в текст. Ни карточек, ни теней —
   только линии и пространство.
   ============================================================ */

/** Нумерация разделов римскими — как в оглавлении печатного документа. */
function roman(n: number): string {
  const table: [number, string][] = [
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ]
  let rest = n
  let out = ''
  for (const [value, sign] of table) {
    while (rest >= value) {
      out += sign
      rest -= value
    }
  }
  return out
}

/* ---------- Разделы пакета ---------- */

interface Section {
  id: string
  state: StatusKind
}

const SECTIONS: Section[] = [
  { id: 'title_page', state: 'ok' },
  { id: 'annotation', state: 'ok' },
  { id: 'explanatory_note', state: 'ok' },
  { id: 'main_text', state: 'ok' },
  { id: 'comparison_table', state: 'ok' },
  { id: 'financial', state: 'ok' },
  { id: 'regulatory_impact', state: 'warn' },
  { id: 'compliance', state: 'warn' },
  { id: 'anticorruption', state: 'warn' },
  { id: 'forecast', state: 'idle' },
  { id: 'glossary', state: 'ok' },
  { id: 'machine_readable', state: 'idle' },
  { id: 'audit_log', state: 'ok' },
]

/* ---------- Реестр инициатив ---------- */

interface Draft {
  id: string
  status: StatusKind
  date: string
  version: number
}

const DRAFTS: Draft[] = [
  { id: 'procurement', status: 'warn', date: '12.02.2026', version: 4 },
  { id: 'digital', status: 'ok', date: '28.01.2026', version: 7 },
  { id: 'construction', status: 'idle', date: '05.02.2026', version: 1 },
  { id: 'appk', status: 'ok', date: '19.12.2025', version: 3 },
]

const VERSIONS = [
  { no: 4, date: '12.02.2026', note: 'ver4' },
  { no: 3, date: '03.02.2026', note: 'ver3' },
  { no: 2, date: '21.01.2026', note: 'ver2' },
  { no: 1, date: '15.01.2026', note: 'ver1' },
]

const dict = {
  title: { ru: 'Законопроекты', kz: 'Заң жобалары', en: 'Draft laws' },
  lead: {
    ru: 'Инициатива превращается в полный пакет документов: от пояснительной записки до машиночитаемого приложения.',
    kz: 'Бастама құжаттардың толық топтамасына айналады: түсіндірме жазбадан машинамен оқылатын қосымшаға дейін.',
    en: 'An initiative becomes a complete document package: from the explanatory note to the machine-readable annex.',
  },
  registry: { ru: 'Реестр', kz: 'Тізілім', en: 'Registry' },
  newDraft: { ru: 'Новая инициатива', kz: 'Жаңа бастама', en: 'New initiative' },

  /* Состояния инициативы */
  stOk: { ru: 'Внесён', kz: 'Енгізілді', en: 'Submitted' },
  stWarn: { ru: 'В работе', kz: 'Жұмыста', en: 'In progress' },
  stIdle: { ru: 'Черновик', kz: 'Жоба', en: 'Draft' },
  stErr: { ru: 'Отклонён', kz: 'Қабылданбады', en: 'Rejected' },
  ver: { ru: 'версия', kz: 'нұсқа', en: 'version' },

  /* Названия инициатив */
  dProcurement: {
    ru: 'О внесении изменений по вопросам государственных закупок',
    kz: 'Мемлекеттік сатып алу мәселелері бойынша өзгерістер енгізу туралы',
    en: 'On amendments concerning public procurement',
  },
  dDigital: {
    ru: 'О цифровых активах и цифровом майнинге',
    kz: 'Цифрлық активтер және цифрлық майнинг туралы',
    en: 'On digital assets and digital mining',
  },
  dConstruction: {
    ru: 'О государственном контроле в сфере строительства',
    kz: 'Құрылыс саласындағы мемлекеттік бақылау туралы',
    en: 'On state supervision in construction',
  },
  dAppk: {
    ru: 'О внесении изменений в Административный процедурно-процессуальный кодекс',
    kz: 'Әкімшілік рәсімдік-процестік кодекске өзгерістер енгізу туралы',
    en: 'On amendments to the Administrative Procedural Code',
  },

  /* Обоснование инициативы */
  rProcurement: {
    ru: 'Доля закупок из одного источника превысила треть объёма; основания прямого выбора рассредоточены по подзаконным актам.',
    kz: 'Бір көзден сатып алу үлесі көлемнің үштен бірінен асты; тікелей таңдау негіздері заңға тәуелді актілерге шашыраңқы.',
    en: 'Single-source procurement exceeds a third of volume; the grounds for direct award are scattered across by-laws.',
  },
  rDigital: {
    ru: 'Оборот цифровых активов вырос вне правового поля; налоговые последствия майнинга не определены.',
    kz: 'Цифрлық активтер айналымы құқықтық өрістен тыс өсті; майнингтің салықтық салдары айқындалмаған.',
    en: 'Digital asset turnover has grown outside the legal field; the tax consequences of mining remain undefined.',
  },
  rConstruction: {
    ru: 'Полномочия по контролю разделены между тремя органами, что порождает дублирование проверок.',
    kz: 'Бақылау өкілеттіктері үш орган арасында бөлінген, бұл тексерулердің қайталануына әкеледі.',
    en: 'Supervisory powers are split between three bodies, which produces duplicated inspections.',
  },
  rAppk: {
    ru: 'Сроки административного обжалования не согласованы с отраслевыми законами, применение противоречиво.',
    kz: 'Әкімшілік шағымдану мерзімдері салалық заңдармен үйлеспеген, қолдану қайшылықты.',
    en: 'Administrative appeal deadlines are out of step with sectoral laws, and practice is inconsistent.',
  },

  /* Предмет регулирования */
  sProcurement: {
    ru: 'Основания и порядок закупок из одного источника, электронный формат конкурсных заявок, сроки обжалования.',
    kz: 'Бір көзден сатып алу негіздері мен тәртібі, конкурстық өтінімдердің электрондық форматы, шағымдану мерзімдері.',
    en: 'Grounds and procedure for single-source purchases, electronic tender submissions, appeal deadlines.',
  },
  sDigital: {
    ru: 'Выпуск и обращение обеспеченных цифровых активов, лицензирование майнинговых пулов, учёт энергопотребления.',
    kz: 'Қамтамасыз етілген цифрлық активтерді шығару және айналымы, майнинг пулдарын лицензиялау, энергия тұтынуды есепке алу.',
    en: 'Issuance and circulation of secured digital assets, licensing of mining pools, energy accounting.',
  },
  sConstruction: {
    ru: 'Разграничение контрольных полномочий, риск-ориентированный отбор объектов, порядок приёмки.',
    kz: 'Бақылау өкілеттіктерін ажырату, нысандарды тәуекелге бағдарланған іріктеу, қабылдау тәртібі.',
    en: 'Delimitation of supervisory powers, risk-based selection of sites, acceptance procedure.',
  },
  sAppk: {
    ru: 'Сроки и порядок досудебного обжалования, полномочия апелляционной комиссии, примирительные процедуры.',
    kz: 'Сотқа дейінгі шағымдану мерзімдері мен тәртібі, апелляциялық комиссия өкілеттіктері, татуласу рәсімдері.',
    en: 'Pre-trial appeal deadlines and procedure, powers of the appeal commission, conciliation.',
  },

  /* Затрагиваемые акты */
  aProcurement: {
    ru: 'Закон «О государственных закупках»; Бюджетный кодекс; КоАП; Предпринимательский кодекс.',
    kz: '«Мемлекеттік сатып алу туралы» заң; Бюджет кодексі; ӘҚБтК; Кәсіпкерлік кодекс.',
    en: 'Law on Public Procurement; Budget Code; Administrative Offences Code; Entrepreneurial Code.',
  },
  aDigital: {
    ru: 'Закон «О цифровых активах»; Налоговый кодекс; Закон «Об электроэнергетике».',
    kz: '«Цифрлық активтер туралы» заң; Салық кодексі; «Электр энергетикасы туралы» заң.',
    en: 'Law on Digital Assets; Tax Code; Law on Electric Power.',
  },
  aConstruction: {
    ru: 'Закон «Об архитектурной, градостроительной и строительной деятельности»; Предпринимательский кодекс.',
    kz: '«Сәулет, қала құрылысы және құрылыс қызметі туралы» заң; Кәсіпкерлік кодекс.',
    en: 'Law on Architectural, Urban Planning and Construction Activity; Entrepreneurial Code.',
  },
  aAppk: {
    ru: 'Административный процедурно-процессуальный кодекс; Закон «О правовых актах».',
    kz: 'Әкімшілік рәсімдік-процестік кодекс; «Құқықтық актілер туралы» заң.',
    en: 'Administrative Procedural Code; Law on Legal Acts.',
  },

  /* Форма */
  formHead: { ru: 'Инициатива', kz: 'Бастама', en: 'Initiative' },
  fTitle: { ru: 'Название законопроекта', kz: 'Заң жобасының атауы', en: 'Title of the draft law' },
  fTitlePh: {
    ru: 'О внесении изменений и дополнений в некоторые законодательные акты',
    kz: 'Кейбір заңнамалық актілерге өзгерістер мен толықтырулар енгізу туралы',
    en: 'On amendments and additions to certain legislative acts',
  },
  fReason: { ru: 'Обоснование', kz: 'Негіздеме', en: 'Justification' },
  fReasonPh: {
    ru: 'Какая проблема не решается действующим регулированием',
    kz: 'Қолданыстағы реттеу қандай мәселені шешпейді',
    en: 'Which problem current regulation fails to solve',
  },
  fSubject: { ru: 'Предмет регулирования', kz: 'Реттеу мәні', en: 'Subject of regulation' },
  fSubjectPh: {
    ru: 'Отношения, на которые распространяется закон',
    kz: 'Заң қолданылатын қатынастар',
    en: 'Relations covered by the law',
  },
  fActs: { ru: 'Затрагиваемые акты', kz: 'Қозғалатын актілер', en: 'Acts affected' },
  fActsPh: {
    ru: 'Кодексы и законы, в которые вносятся изменения',
    kz: 'Өзгерістер енгізілетін кодекстер мен заңдар',
    en: 'Codes and laws to be amended',
  },
  generate: { ru: 'Сгенерировать пакет', kz: 'Топтаманы құру', en: 'Generate package' },
  regenerate: { ru: 'Перегенерировать', kz: 'Қайта құру', en: 'Regenerate' },
  needTitle: {
    ru: 'Укажите название законопроекта',
    kz: 'Заң жобасының атауын көрсетіңіз',
    en: 'Enter the title of the draft law',
  },

  /* Результат */
  packHead: { ru: 'Пакет документов', kz: 'Құжаттар топтамасы', en: 'Document package' },
  packLead: {
    ru: 'Тринадцать разделов по требованиям нормотворческой процедуры. Раскройте раздел, чтобы прочитать текст.',
    kz: 'Нормашығармашылық рәсім талаптары бойынша он үш бөлім. Мәтінді оқу үшін бөлімді ашыңыз.',
    en: 'Thirteen sections required by the law-making procedure. Open a section to read its text.',
  },
  secOk: { ru: 'Готов', kz: 'Дайын', en: 'Ready' },
  secWarn: { ru: 'На проверке', kz: 'Тексеруде', en: 'Under review' },
  secIdle: { ru: 'Не начат', kz: 'Басталмаған', en: 'Not started' },
  secErr: { ru: 'Ошибка', kz: 'Қате', en: 'Failed' },
  expand: { ru: 'Раскрыть раздел', kz: 'Бөлімді ашу', en: 'Open section' },
  collapse: { ru: 'Свернуть раздел', kz: 'Бөлімді жабу', en: 'Close section' },

  export: { ru: 'Экспорт', kz: 'Экспорт', en: 'Export' },
  pdf: { ru: 'PDF', kz: 'PDF', en: 'PDF' },
  docx: { ru: 'DOCX', kz: 'DOCX', en: 'DOCX' },
  xlsx: { ru: 'XLSX', kz: 'XLSX', en: 'XLSX' },

  historyHead: { ru: 'История версий', kz: 'Нұсқалар тарихы', en: 'Version history' },
  ver4: {
    ru: 'Учтены замечания антикоррупционной экспертизы',
    kz: 'Сыбайлас жемқорлыққа қарсы сараптама ескертулері ескерілді',
    en: 'Anti-corruption expertise comments incorporated',
  },
  ver3: {
    ru: 'Уточнён порог прямых закупок',
    kz: 'Тікелей сатып алу шегі нақтыланды',
    en: 'Direct procurement threshold refined',
  },
  ver2: {
    ru: 'Добавлена сравнительная таблица',
    kz: 'Салыстырмалы кесте қосылды',
    en: 'Comparative table added',
  },
  ver1: {
    ru: 'Первичная генерация пакета',
    kz: 'Топтаманың бастапқы құрылуы',
    en: 'Initial generation of the package',
  },

  /* Пустое состояние */
  emptyTitle: { ru: 'Пакет ещё не сформирован', kz: 'Топтама әлі құрылмаған', en: 'The package is not built yet' },
  emptyBody: {
    ru: 'Заполните форму инициативы и нажмите «Сгенерировать пакет». Разделы появятся оглавлением и будут дополняться по мере готовности.',
    kz: 'Бастама нысанын толтырып, «Топтаманы құру» түймесін басыңыз. Бөлімдер мазмұн түрінде шығып, дайын болған сайын толықтырылады.',
    en: 'Fill in the initiative form and press “Generate package”. Sections will appear as a table of contents and fill in as they become ready.',
  },

  /* Названия разделов */
  sec_title_page: { ru: 'Титульный лист', kz: 'Титулдық парақ', en: 'Title page' },
  sec_annotation: { ru: 'Аннотация', kz: 'Аннотация', en: 'Annotation' },
  sec_explanatory_note: { ru: 'Пояснительная записка', kz: 'Түсіндірме жазба', en: 'Explanatory note' },
  sec_main_text: { ru: 'Текст закона', kz: 'Заң мәтіні', en: 'Text of the law' },
  sec_comparison_table: { ru: 'Сравнительная таблица', kz: 'Салыстырмалы кесте', en: 'Comparative table' },
  sec_financial: {
    ru: 'Финансово-экономическое обоснование',
    kz: 'Қаржы-экономикалық негіздеме',
    en: 'Financial and economic justification',
  },
  sec_regulatory_impact: {
    ru: 'Оценка регулирующего воздействия',
    kz: 'Реттеушілік әсерді бағалау',
    en: 'Regulatory impact assessment',
  },
  sec_compliance: { ru: 'Акт соответствия', kz: 'Сәйкестік актісі', en: 'Compliance act' },
  sec_anticorruption: {
    ru: 'Антикоррупционная экспертиза',
    kz: 'Сыбайлас жемқорлыққа қарсы сараптама',
    en: 'Anti-corruption expertise',
  },
  sec_forecast: {
    ru: 'Прогноз социально-экономических последствий',
    kz: 'Әлеуметтік-экономикалық салдардың болжамы',
    en: 'Forecast of socio-economic consequences',
  },
  sec_glossary: { ru: 'Глоссарий терминов', kz: 'Терминдер глоссарийі', en: 'Glossary of terms' },
  sec_machine_readable: {
    ru: 'Машиночитаемое приложение',
    kz: 'Машинамен оқылатын қосымша',
    en: 'Machine-readable annex',
  },
  sec_audit_log: { ru: 'Журнал аудита', kz: 'Аудит журналы', en: 'Audit log' },

  /* Тексты разделов */
  body_title_page: {
    ru: 'Республика Казахстан. Парламент Республики Казахстан.\nПроект Закона Республики Казахстан.\nИнициатор, дата подготовки и регистрационный номер проставляются при внесении.',
    kz: 'Қазақстан Республикасы. Қазақстан Республикасының Парламенті.\nҚазақстан Республикасы Заңының жобасы.\nБастамашы, дайындау күні және тіркеу нөмірі енгізу кезінде қойылады.',
    en: 'Republic of Kazakhstan. Parliament of the Republic of Kazakhstan.\nDraft Law of the Republic of Kazakhstan.\nInitiator, date and registration number are entered upon submission.',
  },
  body_annotation: {
    ru: 'Краткое изложение цели, основной проблемы, ключевых изменений и ожидаемых результатов. Указывается целевая аудитория регулирования.',
    kz: 'Мақсаттың, негізгі мәселенің, түйінді өзгерістердің және күтілетін нәтижелердің қысқаша баяндалуы. Реттеудің нысаналы аудиториясы көрсетіледі.',
    en: 'A short statement of purpose, the core problem, key changes and expected results. The target audience of the regulation is named.',
  },
  body_explanatory_note: {
    ru: 'Обоснование необходимости правового регулирования. Цели и ожидаемые результаты. Анализ текущего правового поля. Сравнительный анализ зарубежного опыта. Ожидаемые социально-экономические последствия.',
    kz: 'Құқықтық реттеу қажеттігінің негіздемесі. Мақсаттар мен күтілетін нәтижелер. Қолданыстағы құқықтық өрісті талдау. Шетелдік тәжірибені салыстырмалы талдау. Күтілетін әлеуметтік-экономикалық салдар.',
    en: 'Justification of the need for regulation. Goals and expected results. Analysis of the current legal field. Comparative analysis of foreign practice. Expected socio-economic consequences.',
  },
  body_main_text: {
    ru: 'Глава 1. Общие положения. Статья 1. Основные понятия. Статья 2. Сфера применения Закона.\nЗаключительные и переходные положения: Закон вводится в действие по истечении шестидесяти календарных дней после первого официального опубликования.',
    kz: '1-тарау. Жалпы ережелер. 1-бап. Негізгі ұғымдар. 2-бап. Заңның қолданылу аясы.\nҚорытынды және өтпелі ережелер: Заң алғашқы ресми жарияланғаннан кейін күнтізбелік алпыс күн өткен соң қолданысқа енгізіледі.',
    en: 'Chapter 1. General provisions. Article 1. Key definitions. Article 2. Scope of the Law.\nFinal and transitional provisions: the Law enters into force sixty calendar days after first official publication.',
  },
  body_comparison_table: {
    ru: 'Постатейное сопоставление действующей и предлагаемой редакций с обоснованием каждой правки. Сопоставлены 34 нормы в четырёх законодательных актах.',
    kz: 'Қолданыстағы және ұсынылатын редакциялардың әр өзгерісті негіздей отырып баптап салыстырылуы. Төрт заңнамалық актідегі 34 норма салыстырылды.',
    en: 'Article-by-article comparison of the current and proposed wording with a reason for each edit. Thirty-four provisions in four acts compared.',
  },
  body_financial: {
    ru: 'Расчёт расходов республиканского бюджета на внедрение и сопровождение, оценка выпадающих доходов и источники покрытия. Дополнительных средств не требуется.',
    kz: 'Республикалық бюджеттің енгізу мен сүйемелдеуге жұмсалатын шығыстарын есептеу, түспей қалатын кірістерді бағалау және өтеу көздері. Қосымша қаражат талап етілмейді.',
    en: 'Calculation of budget costs for implementation and support, an estimate of forgone revenue and sources of coverage. No additional funds are required.',
  },
  body_regulatory_impact: {
    ru: 'Анализ издержек и выгод для субъектов предпринимательства, оценка регуляторной нагрузки и альтернативных вариантов, включая отказ от вмешательства.',
    kz: 'Кәсіпкерлік субъектілері үшін шығындар мен пайданы талдау, реттеушілік жүктемені және баламалы нұсқаларды, оның ішінде араласпау нұсқасын бағалау.',
    en: 'Cost-benefit analysis for businesses, an estimate of regulatory burden and of alternatives, including the option of no intervention.',
  },
  body_compliance: {
    ru: 'Чек-лист соответствия Конституции, международным договорам, действующему законодательству и требованиям юридической техники. Заключение формируется после снятия замечаний.',
    kz: 'Конституцияға, халықаралық шарттарға, қолданыстағы заңнамаға және заң техникасы талаптарына сәйкестік тізімі. Қорытынды ескертулер жойылғаннан кейін жасалады.',
    en: 'A checklist of compliance with the Constitution, international treaties, current legislation and drafting standards. The conclusion follows once comments are cleared.',
  },
  body_anticorruption: {
    ru: 'Выявление коррупциогенных факторов: широта дискреционных полномочий, отсылочные и бланкетные нормы, отсутствие административных процедур. Выявлено два фактора.',
    kz: 'Сыбайлас жемқорлық факторларын анықтау: дискрециялық өкілеттіктердің кеңдігі, сілтемелі және бланкеттік нормалар, әкімшілік рәсімдердің болмауы. Екі фактор анықталды.',
    en: 'Detection of corruption-prone factors: breadth of discretion, referential and blanket provisions, missing administrative procedures. Two factors detected.',
  },
  body_forecast: {
    ru: 'Прогноз на трёхлетний период: влияние на конкуренцию, на субъекты малого предпринимательства и на занятость в затрагиваемых отраслях.',
    kz: 'Үш жылдық кезеңге болжам: бәсекелестікке, шағын кәсіпкерлік субъектілеріне және қозғалатын салалардағы жұмыспен қамтуға әсері.',
    en: 'A three-year forecast: effect on competition, on small businesses and on employment in the sectors affected.',
  },
  body_glossary: {
    ru: 'Термины приведены в алфавитном порядке с определениями на казахском и русском языках. Всего восемнадцать терминов.',
    kz: 'Терминдер әліпби ретімен қазақ және орыс тілдеріндегі анықтамаларымен келтірілген. Барлығы он сегіз термин.',
    en: 'Terms are listed alphabetically with definitions in Kazakh and Russian. Eighteen terms in total.',
  },
  body_machine_readable: {
    ru: 'Формат Akoma Ntoso-XML и JSON-LD. Назначение: интеграция с E-Parliament, «Аділет» и Documentolog.',
    kz: 'Akoma Ntoso-XML және JSON-LD форматы. Мақсаты: E-Parliament, «Әділет» және Documentolog жүйелерімен интеграция.',
    en: 'Akoma Ntoso-XML and JSON-LD formats. Purpose: integration with E-Parliament, Adilet and Documentolog.',
  },
  body_audit_log: {
    ru: 'Хронология подготовки: инициатор, участники, внесённые правки и время каждого изменения. Журнал неизменяем и входит в пакет при внесении.',
    kz: 'Дайындау хронологиясы: бастамашы, қатысушылар, енгізілген түзетулер және әр өзгерістің уақыты. Журнал өзгертілмейді және енгізу кезінде топтамаға кіреді.',
    en: 'Chronology of preparation: initiator, participants, edits made and the time of each change. The log is immutable and travels with the package.',
  },
} satisfies Dict

type Key = keyof typeof dict

const statusKey: Record<StatusKind, Key> = {
  ok: 'stOk',
  warn: 'stWarn',
  idle: 'stIdle',
  err: 'stErr',
}

const sectionStateKey: Record<StatusKind, Key> = {
  ok: 'secOk',
  warn: 'secWarn',
  idle: 'secIdle',
  err: 'secErr',
}

const draftFields: Record<string, { title: Key; reason: Key; subject: Key; acts: Key }> = {
  procurement: { title: 'dProcurement', reason: 'rProcurement', subject: 'sProcurement', acts: 'aProcurement' },
  digital: { title: 'dDigital', reason: 'rDigital', subject: 'sDigital', acts: 'aDigital' },
  construction: { title: 'dConstruction', reason: 'rConstruction', subject: 'sConstruction', acts: 'aConstruction' },
  appk: { title: 'dAppk', reason: 'rAppk', subject: 'sAppk', acts: 'aAppk' },
}

interface Form {
  title: string
  reason: string
  subject: string
  acts: string
}

const emptyForm: Form = { title: '', reason: '', subject: '', acts: '' }

export function LawsPage() {
  const t = useT(dict)
  const { lang } = useLang()

  const [selected, setSelected] = useState<string | null>('procurement')
  /* Форма редактируется пользователем, поэтому язык берётся только при первом
     построении: иначе смена языка затирала бы внесённые правки. */
  const [form, setForm] = useState<Form>(() => ({
    title: dict.dProcurement[lang],
    reason: dict.rProcurement[lang],
    subject: dict.sProcurement[lang],
    acts: dict.aProcurement[lang],
  }))
  const [built, setBuilt] = useState(true)
  const [open, setOpen] = useState<string | null>('explanatory_note')

  function pick(id: string) {
    const f = draftFields[id]
    setSelected(id)
    setForm({ title: t(f.title), reason: t(f.reason), subject: t(f.subject), acts: t(f.acts) })
    setBuilt(true)
    setOpen(null)
  }

  function startNew() {
    setSelected(null)
    setForm(emptyForm)
    setBuilt(false)
    setOpen(null)
  }

  function set<K extends keyof Form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const canBuild = form.title.trim().length > 0

  return (
    <div className="page">
      <div className="page__head">
        <div className="page__title">
          <Display>{t('title')}</Display>
          <Body tone="mute">{t('lead')}</Body>
        </div>
        <Button variant="secondary" onClick={startNew}>
          {t('newDraft')}
        </Button>
      </div>

      <div className="laws-layout">
        {/* ---------- Реестр инициатив ---------- */}
        <aside>
          <Label as="div" style={{ paddingBottom: 'var(--s-2)' }}>
            {t('registry')}
          </Label>
          <div className="laws-list">
            {DRAFTS.map((d) => (
              <button
                key={d.id}
                type="button"
                aria-current={selected === d.id ? 'true' : undefined}
                className={['laws-item', selected === d.id ? 'laws-item--on' : ''].filter(Boolean).join(' ')}
                onClick={() => pick(d.id)}
              >
                <span className="laws-item__title">{t(draftFields[d.id].title)}</span>
                <span className="laws-item__meta">
                  <Status kind={d.status}>{t(statusKey[d.status])}</Status>
                  <Caption tone="mute">{d.date}</Caption>
                  <Caption tone="mute">
                    {t('ver')} {d.version}
                  </Caption>
                </span>
              </button>
            ))}
          </div>
        </aside>

        {/* ---------- Работа над инициативой ---------- */}
        <section>
          <Label as="div">{t('formHead')}</Label>

          <div className="laws-form">
            <div className="laws-form__wide">
              <Input
                label={t('fTitle')}
                placeholder={t('fTitlePh')}
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
              />
            </div>
            <Textarea
              label={t('fReason')}
              placeholder={t('fReasonPh')}
              value={form.reason}
              onChange={(e) => set('reason', e.target.value)}
            />
            <Textarea
              label={t('fSubject')}
              placeholder={t('fSubjectPh')}
              value={form.subject}
              onChange={(e) => set('subject', e.target.value)}
            />
            <div className="laws-form__wide">
              <Textarea
                label={t('fActs')}
                placeholder={t('fActsPh')}
                value={form.acts}
                onChange={(e) => set('acts', e.target.value)}
              />
            </div>
          </div>

          <div className="laws-actions">
            <Button variant="primary" disabled={!canBuild} onClick={() => setBuilt(true)}>
              {built ? t('regenerate') : t('generate')}
            </Button>
            {!canBuild ? <Caption tone="mute">{t('needTitle')}</Caption> : null}
          </div>

          {/* ---------- Результат: оглавление пакета ---------- */}
          {built ? (
            <>
              <div className="laws-block">
                <div className="laws-block__head">
                  <div>
                    <H2>{t('packHead')}</H2>
                    <Body tone="mute">{t('packLead')}</Body>
                  </div>
                  <div className="laws-actions">
                    <Label as="span">{t('export')}</Label>
                    <Button variant="secondary">{t('pdf')}</Button>
                    <Button variant="secondary">{t('docx')}</Button>
                    <Button variant="secondary">{t('xlsx')}</Button>
                  </div>
                </div>

                <div className="laws-toc">
                  {SECTIONS.map((s, i) => {
                    const isOpen = open === s.id
                    const nameKey = `sec_${s.id}` as Key
                    const bodyKey = `body_${s.id}` as Key
                    return (
                      <div className="laws-sec" key={s.id}>
                        <button
                          type="button"
                          className="laws-sec__head"
                          aria-expanded={isOpen}
                          aria-label={isOpen ? t('collapse') : t('expand')}
                          onClick={() => setOpen(isOpen ? null : s.id)}
                        >
                          <span className="laws-sec__num">{roman(i + 1)}.</span>
                          <span className="laws-sec__name">{t(nameKey)}</span>
                          <span className="laws-sec__state">
                            <Status kind={s.state}>{t(sectionStateKey[s.state])}</Status>
                          </span>
                          <span className="laws-sec__mark" aria-hidden="true">
                            {isOpen ? '−' : '+'}
                          </span>
                        </button>
                        {isOpen ? (
                          <div className="laws-sec__body">
                            <Legal className="laws-sec__text">{t(bodyKey)}</Legal>
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* ---------- История версий ---------- */}
              <div className="laws-block">
                <div className="laws-block__head">
                  <H2>{t('historyHead')}</H2>
                </div>
                <div className="laws-versions">
                  {VERSIONS.map((v) => (
                    <div className="laws-version" key={v.no}>
                      <span className="laws-version__no">
                        {t('ver')} {v.no}
                      </span>
                      <Caption tone="mute">{v.date}</Caption>
                      <UIText tone="ink2" className="laws-version__note">
                        {t(v.note as Key)}
                      </UIText>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="laws-block">
              <Empty title={t('emptyTitle')}>{t('emptyBody')}</Empty>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
