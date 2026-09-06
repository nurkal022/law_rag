import { Body, Display, Empty, Status, Table, TableTitle, UIText } from '../../shared/ui'
import { Link } from '../../shared/nav'
import { useLang, useT } from '../../i18n'
import type { Dict } from '../../i18n'
import { api } from '../../shared/api'
import { ListSkeleton, LoadFailure, useLoader } from '../drafts/shared'
import { STATUS_KIND, STATUS_LABEL, statusDict, when } from '../drafts/doc'
import type { Draft, DraftsResponse } from '../drafts/types'
import { LawTabs } from './shared'
import '../drafts/drafts.css'
import '../drafts/drafts.motion.css'
import './laws.css'

/**
 * Реестр законопроектов.
 *
 * Колонки те же, что у договоров, минус стороны: у законопроекта их нет.
 * Инициатора список с сервера не приносит — выдумывать его из названия
 * нельзя, поэтому колонки инициатора здесь нет вовсе.
 */

const dict: Dict = {
  title: { ru: 'Законопроекты', kz: 'Заң жобалары', en: 'Draft laws' },
  lead: {
    ru: 'Пакеты документов к внесению в Мажилис: аннотация, пояснительная записка, текст закона и обязательные обоснования.',
    kz: 'Мәжіліске енгізуге арналған құжаттар топтамасы: аннотация, түсіндірме жазба, заң мәтіні және міндетті негіздемелер.',
    en: 'Packages for submission to the Mazhilis: abstract, explanatory note, the text of the law and the required justifications.',
  },
  colName: { ru: 'Название', kz: 'Атауы', en: 'Title' },
  colUpdated: { ru: 'Изменён', kz: 'Өзгертілген', en: 'Updated' },
  colVersion: { ru: 'Версия', kz: 'Нұсқа', en: 'Version' },
  colStatus: { ru: 'Статус', kz: 'Мәртебе', en: 'Status' },

  emptyTitle: { ru: 'Законопроектов пока нет', kz: 'Әзірге заң жобалары жоқ', en: 'No draft laws yet' },
  emptyBody: {
    ru: 'Опишите проблему, которую решает закон, и цели — пакет соберётся по разделам: пояснительная записка, сравнительная таблица, финансовое обоснование, ОРВ и антикоррупционная экспертиза.',
    kz: 'Заң шешетін мәселені және мақсаттарды сипаттаңыз — топтама бөлімдер бойынша жиналады: түсіндірме жазба, салыстырмалы кесте, қаржылық негіздеме, РӘБ және сыбайлас жемқорлыққа қарсы сараптама.',
    en: 'Describe the problem the law solves and its goals — the package is assembled section by section: explanatory note, comparison table, financial justification, impact assessment and anti-corruption review.',
  },
  create: { ru: 'Составить законопроект', kz: 'Заң жобасын жасау', en: 'Draft a law' },
}

export function RegistryPage() {
  const t = useT(dict)
  const ts = useT(statusDict)
  const { lang } = useLang()
  const locale = lang === 'kz' ? 'kk-KZ' : lang === 'en' ? 'en-US' : 'ru-RU'

  const { data, error, loading, reload } = useLoader<DraftsResponse>(
    () => api.get<DraftsResponse>('/drafts?kind=law_project'),
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

      <LawTabs />

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
              <Link to="/laws/new" className="btn btn--primary">
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
                <th>{t('colUpdated')}</th>
                <th>{t('colVersion')}</th>
                <th>{t('colStatus')}</th>
              </tr>
            </thead>
            <tbody>
              {drafts.map((d, i) => (
                <tr key={d.id} className="enter-item" style={{ '--i': i } as React.CSSProperties}>
                  <td>
                    <Link to={`/laws/${d.id}`} className="ct-registry__link">
                      <TableTitle>{d.title}</TableTitle>
                    </Link>
                  </td>
                  <td className="tabular">{when(d.updated_at, locale)}</td>
                  <td className="tabular">
                    <UIText tone="ink2">{d.version}</UIText>
                  </td>
                  <td>
                    <Status kind={STATUS_KIND[d.status] ?? 'idle'}>
                      {ts(STATUS_LABEL[d.status] ?? 'statusDraft')}
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
