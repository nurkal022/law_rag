import { useParams } from 'react-router-dom'
import { Body, Caption, Display, Empty, H2, Legal, UIText } from '../../shared/ui'
import { Link } from '../../shared/nav'
import { useLang, useT } from '../../i18n'
import { articleLabel } from './levels'
import { api } from '../../shared/api'
import { ListSkeleton, LoadFailure, useLoader } from '../drafts/shared'
import { Findings } from './Findings'
import { dict } from './dict'
import type { ArticleResponse } from './types'
import '../drafts/drafts.css'
import './constitution.css'
import './constitution.motion.css'

export function ArticlePage() {
  const { no } = useParams()
  const t = useT(dict)
  const { lang } = useLang()
  const { data, error, loading, reload } = useLoader<ArticleResponse>(
    () => api.get<ArticleResponse>(`/constitution/articles/${no}`),
    [no],
  )
  const a = data?.article

  return (
    <div className="page cn">
      <Link to="/constitution" className="t-ui">← {t('back')}</Link>
      {loading ? (
        <ListSkeleton rows={6} />
      ) : error ? (
        <div className="ct-state"><LoadFailure error={error} onRetry={reload} /></div>
      ) : !a ? (
        <div className="ct-state"><Empty title={t('noRunTitle')}>{t('noRunBody')}</Empty></div>
      ) : (
        <>
          <div className="page__head">
            <div className="page__title">
              <Display>{articleLabel(a.no, lang, t('mapArticle'))}</Display>
              <Body tone="mute">{t('artSection')} {a.section.no}. {a.section.title}</Body>
            </div>
          </div>
          <Legal className="art-text">{a.text}</Legal>

          {a.was.length ? (
            <section className="cn-block">
              <div className="cn-block__head"><H2>{t('artWas')}</H2></div>
              <div className="art-was">
                {a.was.map((c) => (
                  <div key={c.id} className="chg__col">
                    <UIText>{c.title}</UIText>
                    {c.old_quote ? <Caption tone="mute">{t('was')}: «{c.old_quote}»</Caption> : null}
                    <Body tone="mute">{c.summary}</Body>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="cn-block">
            <div className="cn-block__head"><H2>{t('artNorms')}</H2></div>
            {a.norms.length ? <Findings items={a.norms} withAct /> : <Caption tone="mute">{t('artNoNorms')}</Caption>}
          </section>
          <Caption tone="mute" className="cn-disclaimer">{t('disclaimer')}</Caption>
        </>
      )}
    </div>
  )
}
