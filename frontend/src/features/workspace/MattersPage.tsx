import { Link } from '../../shared/nav'
import { Body, Button, Caption, Display, Empty, H2, Label, Mono, UIText } from '../../shared/ui'
import { useLang, useT } from '../../i18n'
import type { Dict, Lang } from '../../i18n'
import './workspace.css'

const dict: Dict = {
  title: { ru: 'Дела', kz: 'Істер', en: 'Matters' },
  subtitle: {
    ru: 'Папки, объединяющие документы и диалоги по одному вопросу',
    kz: 'Бір мәселе бойынша құжаттар мен диалогтарды біріктіретін қалталар',
    en: 'Folders that group documents and conversations around one question',
  },
  create: { ru: 'Новое дело', kz: 'Жаңа іс', en: 'New matter' },
  active: { ru: 'В работе', kz: 'Жұмыста', en: 'Active' },
  archived: { ru: 'В архиве', kz: 'Мұрағатта', en: 'Archived' },
  docs: { ru: 'документов', kz: 'құжат', en: 'documents' },
  updated: { ru: 'Обновлено', kz: 'Жаңартылды', en: 'Updated' },
  emptyTitle: { ru: 'Дел пока нет', kz: 'Әзірге іс жоқ', en: 'No matters yet' },
  emptyBody: {
    ru: 'Дело собирает документы и переписку по одному вопросу: договор, спор, сделка. Создайте первое — и переносите в него файлы из библиотеки.',
    kz: 'Іс бір мәселе бойынша құжаттар мен хат алмасуды жинайды: шарт, дау, мәміле. Алғашқысын құрып, кітапханадан файлдарды көшіріңіз.',
    en: 'A matter collects the documents and conversations for one question: a contract, a dispute, a deal. Create the first one and move files into it.',
  },
}

/** Строка на трёх языках. */
type L10n = Record<Lang, string>

interface Matter {
  id: string
  title: L10n
  description: L10n
  docs: number
  updated: L10n
  archived?: boolean
}

/** Замоканные дела — до подключения /api/workspace/matters. */
const MATTERS: Matter[] = [
  {
    id: 'astana-logistik',
    title: {
      ru: 'ТОО «Астана Логистик»',
      kz: '«Астана Логистик» ЖШС',
      en: 'Astana Logistik LLP',
    },
    description: {
      ru: 'Корпоративное сопровождение: устав, договоры поставки, акты сверки.',
      kz: 'Корпоративтік сүйемелдеу: жарғы, жеткізу шарттары, салыстыру актілері.',
      en: 'Corporate support: charter, supply contracts, reconciliation statements.',
    },
    docs: 12,
    updated: { ru: '4 сентября 2026', kz: '2026 жылғы 4 қыркүйек', en: '4 September 2026' },
  },
  {
    id: 'sklad-ryskulova',
    title: {
      ru: 'Аренда склада на Рыскулова',
      kz: 'Рысқұлов көшесіндегі қойманы жалға алу',
      en: 'Warehouse lease on Ryskulov street',
    },
    description: {
      ru: 'Долгосрочная аренда 1 400 м², согласование условий с арендодателем.',
      kz: '1 400 ш. м. ұзақ мерзімді жалдау, жалға берушімен талаптарды келісу.',
      en: 'Long-term lease of 1,400 sq m; terms under negotiation with the landlord.',
    },
    docs: 6,
    updated: { ru: '2 сентября 2026', kz: '2026 жылғы 2 қыркүйек', en: '2 September 2026' },
  },
  {
    id: 'kaztransservis',
    title: {
      ru: 'Спор с АО «КазТрансСервис»',
      kz: '«ҚазТрансСервис» АҚ-мен дау',
      en: 'Dispute with KazTransService JSC',
    },
    description: {
      ru: 'Взыскание неустойки за просрочку поставки, досудебный порядок.',
      kz: 'Жеткізуді кешіктіргені үшін тұрақсыздық айыбын өндіру, сотқа дейінгі тәртіп.',
      en: 'Recovery of a penalty for late delivery; pre-action stage.',
    },
    docs: 9,
    updated: { ru: '28 августа 2026', kz: '2026 жылғы 28 тамыз', en: '28 August 2026' },
  },
  {
    id: 'hr',
    title: { ru: 'Кадровые документы', kz: 'Кадр құжаттары', en: 'HR documents' },
    description: {
      ru: 'Трудовые договоры, должностные инструкции, приказы по филиалу.',
      kz: 'Еңбек шарттары, лауазымдық нұсқаулықтар, филиал бойынша бұйрықтар.',
      en: 'Employment contracts, job descriptions, branch orders.',
    },
    docs: 21,
    updated: { ru: '15 августа 2026', kz: '2026 жылғы 15 тамыз', en: '15 August 2026' },
  },
  {
    id: 'tender-2025',
    title: {
      ru: 'Госзакупки 2025: тендер на перевозки',
      kz: '2025 мемлекеттік сатып алу: тасымалдау тендері',
      en: 'Public procurement 2025: haulage tender',
    },
    description: {
      ru: 'Завершено: заявка отозвана, документы сохранены для истории.',
      kz: 'Аяқталды: өтінім кері қайтарылды, құжаттар тарих үшін сақталды.',
      en: 'Closed: the bid was withdrawn and the documents kept for the record.',
    },
    docs: 4,
    updated: { ru: '11 марта 2026', kz: '2026 жылғы 11 наурыз', en: '11 March 2026' },
    archived: true,
  },
]

function MatterRow({
  m,
  lang,
  updatedLabel,
  docsLabel,
}: {
  m: Matter
  lang: Lang
  updatedLabel: string
  docsLabel: string
}) {
  return (
    <Link
      to="/workspace"
      className={m.archived ? 'ws-matter ws-matter--archived' : 'ws-matter'}
      aria-label={m.title[lang]}
    >
      <span className="ws-matter__main">
        <H2 as="span">{m.title[lang]}</H2>
        <Body as="span" tone="mute" style={{ margin: 0 }}>
          {m.description[lang]}
        </Body>
      </span>
      <span className="ws-matter__meta">
        <UIText tone="ink2">
          {m.docs} {docsLabel}
        </UIText>
        <Caption tone="mute">
          {updatedLabel}: {m.updated[lang]}
        </Caption>
      </span>
    </Link>
  )
}

export function MattersPage() {
  const t = useT(dict)
  const { lang } = useLang()
  const active = MATTERS.filter((m) => !m.archived)
  const archived = MATTERS.filter((m) => m.archived)

  return (
    <div className="page">
      <div className="page__head">
        <div className="page__title">
          <Display>{t('title')}</Display>
          <Body tone="mute">{t('subtitle')}</Body>
        </div>
        <div className="ws-actions">
          <Button variant="primary">{t('create')}</Button>
        </div>
      </div>

      {MATTERS.length === 0 ? (
        <Empty title={t('emptyTitle')} action={<Button variant="primary">{t('create')}</Button>}>
          {t('emptyBody')}
        </Empty>
      ) : (
        <>
          <div className="ws-group-head">
            <Label>{t('active')}</Label>
            <Mono tone="mute">{active.length}</Mono>
          </div>
          <div className="ws-matters">
            {active.map((m) => (
              <MatterRow key={m.id} m={m} lang={lang} updatedLabel={t('updated')} docsLabel={t('docs')} />
            ))}
          </div>

          {archived.length > 0 ? (
            <>
              <div className="ws-group-head">
                <Label>{t('archived')}</Label>
                <Mono tone="mute">{archived.length}</Mono>
              </div>
              <div className="ws-matters">
                {archived.map((m) => (
                  <MatterRow key={m.id} m={m} lang={lang} updatedLabel={t('updated')} docsLabel={t('docs')} />
                ))}
              </div>
            </>
          ) : null}
        </>
      )}
    </div>
  )
}
