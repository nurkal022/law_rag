import type { Dict } from '../../i18n'

export const dict: Dict = {
  nav: { ru: 'Конституция', kz: 'Конституция', en: 'Constitution' },
  title: {
    ru: 'Конституция 2026 и действующее законодательство',
    kz: '2026 жылғы Конституция және қолданыстағы заңнама',
    en: 'The 2026 Constitution and the legislation in force',
  },
  lead: {
    ru: 'Агент прошёл акты корпуса по иерархии юридической силы и для каждой нормы оценил, есть ли признаки расхождения с Конституцией, вступившей в силу 1 июля 2026 года (ст. 96: акты применяются в части, не противоречащей Конституции).',
    kz: 'Агент корпустағы актілерді заңдық күш иерархиясы бойынша қарап, әр норма үшін 2026 жылғы 1 шілдеде күшіне енген Конституциямен алшақтық белгілері бар-жоғын бағалады (96-бап).',
    en: 'The agent walked the corpus by legal force and, for every provision, assessed whether it shows signs of divergence from the Constitution in force since 1 July 2026 (Art. 96).',
  },
  disclaimer: {
    ru: 'Автоматизированный предварительный анализ. Система не выносит заключение о неконституционности: окончательный вывод — за уполномоченным экспертом или государственным органом.',
    kz: 'Автоматтандырылған алдын ала талдау. Жүйе конституциялық емес деп қорытынды шығармайды: түпкілікті тұжырым — уәкілетті сарапшыда немесе мемлекеттік органда.',
    en: 'Automated preliminary analysis. The system does not declare acts unconstitutional: the final conclusion rests with an authorised expert or state body.',
  },

  figActs: { ru: 'Актов пройдено', kz: 'Қаралған актілер', en: 'Acts walked' },
  figNorms: { ru: 'Норм проверено', kz: 'Тексерілген нормалар', en: 'Provisions checked' },
  figHigh: { ru: 'Высокий риск', kz: 'Жоғары тәуекел', en: 'High risk' },
  figPossible: { ru: 'Возможное противоречие', kz: 'Ықтимал қайшылық', en: 'Possible conflict' },
  figReview: { ru: 'Требуют проверки', kz: 'Тексеру қажет', en: 'Need review' },
  figClean: { ru: 'Без признаков', kz: 'Белгісіз', en: 'No signs' },

  walkHead: { ru: 'Ход обхода', kz: 'Қарау барысы', en: 'The walk' },
  walkLead: {
    ru: 'Сначала словарь институтов, которых нет в Конституции 2026, и ссылок на прежнюю нумерацию; затем модель на каждой норме с ближайшими статьями Конституции в контексте; для найденного — второй проверочный проход другой моделью.',
    kz: 'Алдымен 2026 жылғы Конституцияда жоқ институттар мен бұрынғы нөмірлеуге сілтемелер сөздігі; сосын әр нормада Конституцияның жақын баптары контекстінде модель; табылғанға — басқа модельмен екінші тексеру.',
    en: 'First a dictionary of bodies absent from the 2026 Constitution and references to old numbering; then a model on every provision with the nearest Constitution articles in context; a second verification pass for what it found.',
  },
  walkNow: { ru: 'сейчас разбирает', kz: 'қазір қарап жатыр', en: 'now analysing' },
  walkNorms: { ru: 'норм', kz: 'норма', en: 'provisions' },
  walkTokens: { ru: 'токенов', kz: 'токен', en: 'tokens' },
  walkFound: { ru: 'с замечаниями', kz: 'ескертумен', en: 'flagged' },
  walkPending: { ru: 'ожидает', kz: 'күтуде', en: 'pending' },
  unitMin: { ru: 'мин', kz: 'мин', en: 'min' },
  unitSec: { ru: 'с', kz: 'с', en: 's' },

  pyrHead: { ru: 'Пирамида юридической силы', kz: 'Заңдық күш пирамидасы', en: 'Pyramid of legal force' },
  pyrLead: {
    ru: 'Одиннадцать уровней по техническому заданию. У каждого акта — доли норм по уровню риска; пустые ярусы означают, что актов этого уровня в базе пока нет.',
    kz: 'Техникалық тапсырма бойынша он бір деңгей. Әр актіде — тәуекел деңгейі бойынша нормалар үлесі; бос сатылар — базада бұл деңгейдегі актілер әзірге жоқ.',
    en: 'Eleven levels per the terms of reference. Each act shows its share of provisions by risk level; empty tiers mean no acts of that level are in the corpus yet.',
  },
  emptyTier: { ru: 'в базе нет актов этого уровня', kz: 'базада бұл деңгейдегі актілер жоқ', en: 'no acts of this level in the corpus' },
  constitutionRow: { ru: 'Конституция Республики Казахстан — принята 15 марта 2026, в силе с 1 июля 2026. 96 статей, 11 разделов.', kz: 'Қазақстан Республикасының Конституциясы — 2026 жылғы 15 наурызда қабылданды, 1 шілдеден күшінде. 96 бап, 11 бөлім.', en: 'Constitution of the Republic of Kazakhstan — adopted 15 March 2026, in force since 1 July 2026. 96 articles, 11 sections.' },

  mapHead: { ru: 'Карта Конституции', kz: 'Конституция картасы', en: 'Map of the Constitution' },
  mapLead: {
    ru: 'Каждая ячейка — статья. Насыщенность — сколько норм действующих актов её касаются, обводка — наихудший уровень среди них. Нажмите на статью, чтобы увидеть эти нормы.',
    kz: 'Әр ұяшық — бап. Қанықтылық — оған қатысты нормалар саны, жиек — олардың ішіндегі ең жоғары деңгей. Нормаларды көру үшін бапты басыңыз.',
    en: 'Each cell is an article. Fill shows how many provisions touch it, the outline the worst level among them. Click an article to see those provisions.',
  },
  mapArticle: { ru: 'Статья', kz: 'бап', en: 'Article' },

  chgHead: { ru: 'Что изменилось', kz: 'Не өзгерді', en: 'What changed' },
  chgLead: {
    ru: 'Реестр изменений между Конституцией 1995 года и Конституцией 2026 года, на который опирается анализ. Справа — сколько норм с замечаниями связано с каждым изменением.',
    kz: '1995 және 2026 жылғы Конституциялар арасындағы өзгерістер тізілімі — талдаудың негізі. Оң жақта — әр өзгеріске байланысты ескертуі бар нормалар саны.',
    en: 'The register of changes between the 1995 and 2026 Constitutions the analysis relies on. On the right, how many flagged provisions relate to each change.',
  },
  chgAll: { ru: 'Все', kz: 'Барлығы', en: 'All' },
  kind_institution: { ru: 'институты', kz: 'институттар', en: 'institutions' },
  kind_new: { ru: 'новое', kz: 'жаңа', en: 'new' },
  kind_removed: { ru: 'исключено', kz: 'алынып тасталды', en: 'removed' },
  kind_procedure: { ru: 'процедуры', kz: 'рәсімдер', en: 'procedures' },
  kind_reference: { ru: 'нумерация', kz: 'нөмірлеу', en: 'numbering' },
  was: { ru: 'Было', kz: 'Бұрын', en: 'Was' },
  became: { ru: 'Стало', kz: 'Қазір', en: 'Now' },

  methodHead: { ru: 'Метод', kz: 'Әдіс', en: 'Method' },
  methodModels: { ru: 'Модели', kz: 'Модельдер', en: 'Models' },
  methodRun: { ru: 'Прогон', kz: 'Жүргізу', en: 'Run' },
  methodTokens: { ru: 'Токенов', kz: 'Токен', en: 'Tokens' },
  running: { ru: 'Прогон идёт', kz: 'Жүргізу жүріп жатыр', en: 'Run in progress' },
  done: { ru: 'Завершён', kz: 'Аяқталды', en: 'Completed' },

  noRunTitle: { ru: 'Прогона ещё не было', kz: 'Жүргізу әлі болмады', en: 'No run yet' },
  noRunBody: {
    ru: 'Результаты появятся здесь после первого обхода корпуса: он запускается на сервере и занимает около часа.',
    kz: 'Нәтижелер корпусты бірінші қараудан кейін шығады: ол серверде іске қосылады және шамамен бір сағат алады.',
    en: 'Results appear after the first walk of the corpus: it runs on the server and takes about an hour.',
  },

  back: { ru: 'К обзору', kz: 'Шолуға', en: 'Back to overview' },
  tier: { ru: 'Уровень', kz: 'Деңгей', en: 'Tier' },
  edition: { ru: 'Редакция', kz: 'Редакция', en: 'Edition' },
  source: { ru: 'Источник', kz: 'Дереккөз', en: 'Source' },
  barcodeHead: { ru: 'Статьи акта', kz: 'Акт баптары', en: 'Articles of the act' },
  barcodeLead: {
    ru: 'Один штрих — одна статья в порядке акта; цвет — уровень риска. Нажмите на штрих, чтобы перейти к находке.',
    kz: 'Бір жолақ — акт ретіндегі бір бап; түс — тәуекел деңгейі. Табылғанға өту үшін жолақты басыңыз.',
    en: 'One bar is one article in the order of the act; colour is the risk level. Click a bar to jump to its finding.',
  },
  findingsHead: { ru: 'Находки', kz: 'Табылғандар', en: 'Findings' },
  noFindings: { ru: 'Замечаний по выбранным фильтрам нет', kz: 'Таңдалған сүзгілер бойынша ескерту жоқ', en: 'No findings for the chosen filters' },
  allLevels: { ru: 'Все уровни', kz: 'Барлық деңгей', en: 'All levels' },
  allCategories: { ru: 'Все категории', kz: 'Барлық санат', en: 'All categories' },
  quote: { ru: 'Фрагмент нормы', kz: 'Норма үзіндісі', en: 'Provision excerpt' },
  recommendation: { ru: 'Рекомендация', kz: 'Ұсыныс', en: 'Recommendation' },
  showNorm: { ru: 'Показать норму и статьи Конституции', kz: 'Норма мен Конституция баптарын көрсету', en: 'Show the provision and Constitution articles' },
  hideNorm: { ru: 'Свернуть', kz: 'Жию', en: 'Collapse' },
  normText: { ru: 'Текст нормы', kz: 'Норма мәтіні', en: 'Provision text' },
  constArticles: { ru: 'Статьи Конституции 2026', kz: '2026 жылғы Конституция баптары', en: '2026 Constitution articles' },
  method_dictionary: { ru: 'словарь', kz: 'сөздік', en: 'dictionary' },
  method_model: { ru: 'модель', kz: 'модель', en: 'model' },
  method_verified: { ru: 'модель, проверено', kz: 'модель, тексерілді', en: 'model, verified' },
  method_both: { ru: 'словарь + модель', kz: 'сөздік + модель', en: 'dictionary + model' },
  method_both_verified: { ru: 'словарь + модель, проверено', kz: 'сөздік + модель, тексерілді', en: 'dictionary + model, verified' },
  loadFailed: { ru: 'Не загрузилось', kz: 'Жүктелмеді', en: 'Failed to load' },

  artSection: { ru: 'Раздел', kz: 'Бөлім', en: 'Section' },
  artWas: { ru: 'Что изменилось в этой статье', kz: 'Бұл бапта не өзгерді', en: 'What changed in this article' },
  artNorms: { ru: 'Нормы, которые касаются статьи', kz: 'Бапқа қатысты нормалар', en: 'Provisions touching this article' },
  artNoNorms: { ru: 'Замечаний, связанных с этой статьёй, нет', kz: 'Бұл бапқа байланысты ескерту жоқ', en: 'No findings relate to this article' },
}

/** Метод находки → ключ словаря. */
export function methodKey(
  method: string,
): 'method_dictionary' | 'method_model' | 'method_verified' | 'method_both' | 'method_both_verified' {
  const dict = method.includes('dictionary')
  const verified = method.includes('verified')
  if (dict && method.includes('model')) return verified ? 'method_both_verified' : 'method_both'
  if (verified) return 'method_verified'
  if (method.includes('model')) return 'method_model'
  return 'method_dictionary'
}
