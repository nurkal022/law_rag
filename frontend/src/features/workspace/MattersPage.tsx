import { Link } from 'react-router-dom'
import { Body, Button, Caption, Display, Empty, H2, Label, Mono, UIText } from '../../shared/ui'
import { useT } from '../../i18n'
import type { Dict } from '../../i18n'
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

interface Matter {
  id: string
  title: string
  description: string
  docs: number
  updated: string
  archived?: boolean
}

/** Замоканные дела — до подключения /api/workspace/matters. */
const MATTERS: Matter[] = [
  {
    id: 'astana-logistik',
    title: 'ТОО «Астана Логистик»',
    description: 'Корпоративное сопровождение: устав, договоры поставки, акты сверки.',
    docs: 12,
    updated: '4 сентября 2026',
  },
  {
    id: 'sklad-ryskulova',
    title: 'Аренда склада на Рыскулова',
    description: 'Долгосрочная аренда 1 400 м², согласование условий с арендодателем.',
    docs: 6,
    updated: '2 сентября 2026',
  },
  {
    id: 'kaztransservis',
    title: 'Спор с АО «КазТрансСервис»',
    description: 'Взыскание неустойки за просрочку поставки, досудебный порядок.',
    docs: 9,
    updated: '28 августа 2026',
  },
  {
    id: 'hr',
    title: 'Кадровые документы',
    description: 'Трудовые договоры, должностные инструкции, приказы по филиалу.',
    docs: 21,
    updated: '15 августа 2026',
  },
  {
    id: 'tender-2025',
    title: 'Госзакупки 2025: тендер на перевозки',
    description: 'Завершено: заявка отозвана, документы сохранены для истории.',
    docs: 4,
    updated: '11 марта 2026',
    archived: true,
  },
]

function MatterRow({ m, updatedLabel, docsLabel }: { m: Matter; updatedLabel: string; docsLabel: string }) {
  return (
    <Link
      to="/workspace"
      className={m.archived ? 'ws-matter ws-matter--archived' : 'ws-matter'}
      aria-label={m.title}
    >
      <span className="ws-matter__main">
        <H2 as="span">{m.title}</H2>
        <Body as="span" tone="mute" style={{ margin: 0 }}>
          {m.description}
        </Body>
      </span>
      <span className="ws-matter__meta">
        <UIText tone="ink2">
          {m.docs} {docsLabel}
        </UIText>
        <Caption tone="mute">
          {updatedLabel}: {m.updated}
        </Caption>
      </span>
    </Link>
  )
}

export function MattersPage() {
  const t = useT(dict)
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
              <MatterRow key={m.id} m={m} updatedLabel={t('updated')} docsLabel={t('docs')} />
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
                  <MatterRow key={m.id} m={m} updatedLabel={t('updated')} docsLabel={t('docs')} />
                ))}
              </div>
            </>
          ) : null}
        </>
      )}
    </div>
  )
}
