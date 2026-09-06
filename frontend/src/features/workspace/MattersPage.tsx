import { useCallback, useState } from 'react'
import type { CSSProperties } from 'react'
import { Link } from '../../shared/nav'
import {
  Body,
  Button,
  Caption,
  Display,
  Empty,
  H2,
  Input,
  Label,
  Mono,
  Textarea,
  UIText,
  useToast,
} from '../../shared/ui'
import { useLang, useT } from '../../i18n'
import type { Dict, Lang } from '../../i18n'
import './workspace.css'
import './workspace.motion.css'
import { SectionTabs } from './SectionTabs'

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
  formTitle: { ru: 'Название дела', kz: 'Іс атауы', en: 'Matter title' },
  formTitlePh: {
    ru: 'Например: Спор с подрядчиком по договору подряда',
    kz: 'Мысалы: Мердігерлік шарт бойынша мердігермен дау',
    en: 'For example: Dispute with a contractor under a works agreement',
  },
  formDesc: { ru: 'Описание', kz: 'Сипаттама', en: 'Description' },
  formDescPh: {
    ru: 'Коротко: что за вопрос, какие документы соберутся в деле',
    kz: 'Қысқаша: қандай мәселе, іске қандай құжаттар жиналады',
    en: 'Briefly: what the question is and which documents will gather here',
  },
  save: { ru: 'Создать', kz: 'Құру', en: 'Create' },
  cancel: { ru: 'Отмена', kz: 'Болдырмау', en: 'Cancel' },
  created: { ru: 'Дело создано', kz: 'Іс құрылды', en: 'Matter created' },
  noDesc: { ru: 'Описание не заполнено.', kz: 'Сипаттама толтырылмаған.', en: 'No description yet.' },
  today: { ru: 'сегодня', kz: 'бүгін', en: 'today' },
}

/** Строка на трёх языках. */
type L10n = Record<Lang, string>

interface Matter {
  id: string
  /** У заготовленных дел заголовок трёхъязычный, у созданных — как набран. */
  title: L10n | string
  description: L10n | string
  docs: number
  updated: L10n | string
  archived?: boolean
}

function text(v: L10n | string, lang: Lang): string {
  return typeof v === 'string' ? v : v[lang]
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
  index,
}: {
  m: Matter
  lang: Lang
  updatedLabel: string
  docsLabel: string
  index: number
}) {
  const title = text(m.title, lang)
  return (
    <Link
      /* Дело — это фильтр библиотеки: переход открывает реестр с уже
         выбранным делом, а не отдельный экран со списком тех же строк. */
      to={`/workspace?matter=${encodeURIComponent(m.id)}&name=${encodeURIComponent(title)}`}
      className={m.archived ? 'ws-matter ws-matter--archived enter-item' : 'ws-matter enter-item'}
      style={{ '--i': index } as CSSProperties}
      aria-label={title}
    >
      <span className="ws-matter__main">
        <H2 as="span">{title}</H2>
        <Body as="span" tone="mute" style={{ margin: 0 }}>
          {text(m.description, lang)}
        </Body>
      </span>
      <span className="ws-matter__meta">
        <UIText tone="ink2">
          {m.docs} {docsLabel}
        </UIText>
        <Caption tone="mute">
          {updatedLabel}: {text(m.updated, lang)}
        </Caption>
      </span>
    </Link>
  )
}

export function MattersPage() {
  const t = useT(dict)
  const { lang } = useLang()
  const toast = useToast()

  const [matters, setMatters] = useState<Matter[]>(MATTERS)
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')

  const active = matters.filter((m) => !m.archived)
  const archived = matters.filter((m) => m.archived)

  const create = useCallback(() => {
    const name = title.trim()
    if (!name) return
    const matter: Matter = {
      id: `m-${Date.now()}`,
      title: name,
      description: desc.trim() || t('noDesc'),
      docs: 0,
      updated: t('today'),
    }
    setMatters((prev) => [matter, ...prev])
    setTitle('')
    setDesc('')
    setOpen(false)
    toast(`${t('created')}: ${name}`, 'ok')
  }, [title, desc, t, toast])

  return (
    <div className="page">
      <SectionTabs />
      <div className="page__head">
        <div className="page__title">
          <Display>{t('title')}</Display>
          <Body tone="mute">{t('subtitle')}</Body>
        </div>
        <div className="ws-actions">
          <Button variant="primary" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            {t('create')}
          </Button>
        </div>
      </div>

      {open ? (
        <form
          className="ws-form unfold"
          onSubmit={(e) => {
            e.preventDefault()
            create()
          }}
        >
          <Input
            label={t('formTitle')}
            placeholder={t('formTitlePh')}
            value={title}
            autoFocus
            onChange={(e) => setTitle(e.currentTarget.value)}
          />
          <Textarea
            label={t('formDesc')}
            placeholder={t('formDescPh')}
            rows={2}
            value={desc}
            onChange={(e) => setDesc(e.currentTarget.value)}
          />
          <div className="ws-form__acts">
            <Button variant="primary" type="submit" disabled={!title.trim()}>
              {t('save')}
            </Button>
            <Button variant="ghost" type="button" onClick={() => setOpen(false)}>
              {t('cancel')}
            </Button>
          </div>
        </form>
      ) : null}

      {matters.length === 0 ? (
        <Empty title={t('emptyTitle')} action={<Button variant="primary" onClick={() => setOpen(true)}>{t('create')}</Button>}>
          {t('emptyBody')}
        </Empty>
      ) : (
        <>
          <div className="ws-group-head">
            <Label>{t('active')}</Label>
            <Mono tone="mute">{active.length}</Mono>
          </div>
          <div className="ws-matters" key={`a${active.length}`}>
            {active.map((m, i) => (
              <MatterRow
                key={m.id}
                m={m}
                index={i}
                lang={lang}
                updatedLabel={t('updated')}
                docsLabel={t('docs')}
              />
            ))}
          </div>

          {archived.length > 0 ? (
            <>
              <div className="ws-group-head">
                <Label>{t('archived')}</Label>
                <Mono tone="mute">{archived.length}</Mono>
              </div>
              <div className="ws-matters">
                {archived.map((m, i) => (
                  <MatterRow
                    key={m.id}
                    m={m}
                    index={i}
                    lang={lang}
                    updatedLabel={t('updated')}
                    docsLabel={t('docs')}
                  />
                ))}
              </div>
            </>
          ) : null}
        </>
      )}
    </div>
  )
}
