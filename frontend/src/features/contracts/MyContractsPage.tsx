import { Body, Caption, Display, Empty, Status, Table, TableTitle } from '../../shared/ui'
import type { StatusKind } from '../../shared/ui'
import { Link } from '../../shared/nav'
import { useLang, useT } from '../../i18n'
import type { Dict } from '../../i18n'
import { api } from '../../shared/api'
import { ContractTabs, ListSkeleton, LoadFailure, useLoader } from './shared'
import type { Draft, DraftStatus, DraftsResponse } from './types'
import './contracts.css'
import './contracts.motion.css'

/**
 * Реестр договоров. Таблица, а не карточки: список из тридцати договоров
 * читают глазами по колонкам — дата, версия, статус, — а карточки заставляют
 * прокручивать экран ради тех же четырёх значений.
 */

const dict: Dict = {
  title: { ru: 'Мои договоры', kz: 'Менің шарттарым', en: 'My contracts' },
  lead: {
    ru: 'Все составленные договоры с историей версий.',
    kz: 'Нұсқалар тарихымен бірге жасалған барлық шарттар.',
    en: 'Every contract you have drafted, with its version history.',
  },
  colName: { ru: 'Название', kz: 'Атауы', en: 'Title' },
  colType: { ru: 'Тип', kz: 'Түрі', en: 'Type' },
  colParties: { ru: 'Стороны', kz: 'Тараптар', en: 'Parties' },
  colUpdated: { ru: 'Изменён', kz: 'Өзгертілген', en: 'Updated' },
  colVersion: { ru: 'Версия', kz: 'Нұсқа', en: 'Version' },
  colStatus: { ru: 'Статус', kz: 'Мәртебе', en: 'Status' },

  statusDraft: { ru: 'Черновик', kz: 'Жоба', en: 'Draft' },
  statusReview: { ru: 'На согласовании', kz: 'Келісуде', en: 'In review' },
  statusAgreed: { ru: 'Согласован', kz: 'Келісілген', en: 'Agreed' },
  statusSigned: { ru: 'Подписан', kz: 'Қол қойылған', en: 'Signed' },
  statusArchived: { ru: 'В архиве', kz: 'Мұрағатта', en: 'Archived' },

  emptyTitle: { ru: 'Договоров пока нет', kz: 'Әзірге шарттар жоқ', en: 'No contracts yet' },
  emptyBody: {
    ru: 'Выберите тип договора в каталоге, заполните реквизиты — и документ соберётся по разделам с указанием норм.',
    kz: 'Каталогтан шарт түрін таңдап, деректемелерді толтырыңыз — құжат нормаларды көрсете отырып бөлімдер бойынша жиналады.',
    en: 'Pick a type in the catalogue, fill in the details, and the document is assembled section by section with the norms cited.',
  },
  create: { ru: 'Составить договор', kz: 'Шарт жасау', en: 'Draft a contract' },
  dash: { ru: '—', kz: '—', en: '—' },
}

const STATUS_LABEL: Record<DraftStatus, string> = {
  draft: 'statusDraft',
  review: 'statusReview',
  agreed: 'statusAgreed',
  signed: 'statusSigned',
  archived: 'statusArchived',
}

const STATUS_KIND: Record<DraftStatus, StatusKind> = {
  draft: 'idle',
  review: 'warn',
  agreed: 'ok',
  signed: 'ok',
  archived: 'idle',
}

function when(iso: string | null, locale: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function MyContractsPage() {
  const t = useT(dict)
  const { lang } = useLang()
  const locale = lang === 'kz' ? 'kk-KZ' : lang === 'en' ? 'en-US' : 'ru-RU'

  const { data, error, loading, reload } = useLoader<DraftsResponse>(
    () => api.get<DraftsResponse>('/drafts?kind=contract'),
    [],
  )

  const drafts: Draft[] = data?.drafts ?? []

  return (
    <div className="page">
      <div className="page__head">
        <div className="page__title">
          <Display>{t('title')}</Display>
          <Body tone="mute">{t('lead')}</Body>
        </div>
      </div>

      <ContractTabs />

      {loading ? (
        <ListSkeleton rows={6} />
      ) : error ? (
        <div className="ct-state">
          <LoadFailure error={error} onRetry={reload} />
        </div>
      ) : !drafts.length ? (
        <div className="ct-state">
          <Empty
            title={t('emptyTitle')}
            action={
              <Link to="/contracts" className="btn btn--primary">
                {t('create')}
              </Link>
            }
          >
            {t('emptyBody')}
          </Empty>
        </div>
      ) : (
        <div className="ct-registry">
          <Table>
            <thead>
              <tr>
                <th>{t('colName')}</th>
                <th>{t('colType')}</th>
                <th>{t('colParties')}</th>
                <th>{t('colUpdated')}</th>
                <th>{t('colVersion')}</th>
                <th>{t('colStatus')}</th>
              </tr>
            </thead>
            <tbody>
              {drafts.map((d, i) => (
                <tr key={d.id} className="enter-item" style={{ '--i': i } as React.CSSProperties}>
                  <td>
                    <Link to={`/contracts/${d.id}`} className="ct-registry__link">
                      <TableTitle>{d.title}</TableTitle>
                    </Link>
                  </td>
                  <td>
                    <span className="cite">{d.type_id}</span>
                  </td>
                  <td>
                    {/* Стороны приходят только вместе с деревом, а список его не
                        отдаёт: показываем прочерк, а не выдуманные наименования. */}
                    <Caption tone="mute">{t('dash')}</Caption>
                  </td>
                  <td className="tabular">{when(d.updated_at, locale)}</td>
                  <td className="tabular">{d.version}</td>
                  <td>
                    <Status kind={STATUS_KIND[d.status] ?? 'idle'}>
                      {t(STATUS_LABEL[d.status] ?? 'statusDraft')}
                    </Status>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </div>
  )
}
