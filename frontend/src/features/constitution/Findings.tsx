import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { Body, Button, Caption, Cite, Label, Legal, Loading, Status, UIText } from '../../shared/ui'
import { useLang, useT, withLang } from '../../i18n'
import { api, errorMessage } from '../../shared/api'
import { citeCode } from '../legal/cite'
import { dict, methodKey } from './dict'
import { apiLang, articleLabel, levelKind } from './levels'
import type { ActMeta, Finding, FindingDetail } from './types'

function Detail({ id }: { id: number }) {
  const t = useT(dict)
  const { lang } = useLang()
  const [data, setData] = useState<FindingDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fallback = t('loadFailed')
  useEffect(() => {
    let alive = true
    api.get<{ finding: FindingDetail }>(`/constitution/findings/${id}`)
      .then((r) => { if (alive) setData(r.finding) })
      .catch((e) => { if (alive) setError(errorMessage(e, fallback)) })
    return () => { alive = false }
  }, [id, fallback])
  if (error) return <Caption tone="err">{error}</Caption>
  if (!data) return <Loading />
  return (
    <div className="fnd__detail">
      <div className="fnd__col">
        <Label>{t('normText')}</Label>
        <Legal className="fnd__norm">{data.norm_text}</Legal>
      </div>
      <div className="fnd__col">
        <Label>{t('constArticles')}</Label>
        {data.articles.map((a) => (
          <div key={a.no} className="fnd__col">
            <UIText tone="ink2">{articleLabel(a.no, lang, t('mapArticle'))} · {a.section.title}</UIText>
            <Legal className="fnd__norm">{a.text}</Legal>
          </div>
        ))}
        {data.changes.map((c) => (
          <div key={c.id} className="fnd__col">
            <UIText tone="ink2">{c.title}</UIText>
            <Body tone="mute">{c.summary}</Body>
          </div>
        ))}
      </div>
    </div>
  )
}

export function Findings({ items, withAct, targetId }: {
  items: (Finding & { act?: ActMeta | null })[]
  withAct?: boolean
  targetId?: number | null
}) {
  const t = useT(dict)
  const { lang } = useLang()
  const al = apiLang(lang)
  const navigate = useNavigate()
  const [open, setOpen] = useState<Record<number, boolean>>({})

  if (!items.length) return <Caption tone="mute">{t('noFindings')}</Caption>

  return (
    <div className="fnd-list">
      {items.map((f, i) => {
        const act = f.act
        return (
          <article
            key={f.id}
            id={`f-${f.id}`}
            className={['fnd', targetId === f.id ? 'fnd--target' : ''].filter(Boolean).join(' ')}
            style={{ '--i': i } as CSSProperties}
          >
            <span className="fnd__no">{f.article_no}</span>
            <div className="fnd__main">
              <div>
                {withAct && act ? (
                  <Cite code={citeCode(act.code, lang)} onClick={() => navigate(withLang(`/constitution/acts/${act.document_id}`, lang))} />
                ) : null}
                <h3 className="fnd__title">{f.article_title}</h3>
              </div>
              <div className="fnd__tags">
                {f.wording ? <Status kind={levelKind(f.level)}>{f.wording[al]}</Status> : null}
                <Caption tone="mute">{f.category_label[al]}</Caption>
                <Caption tone="mute">{t(methodKey(f.method))}</Caption>
              </div>
              {f.quote_norm ? <blockquote className="fnd__quote t-legal">«{f.quote_norm}»</blockquote> : null}
              {f.explanation ? <Body className="fnd__why">{f.explanation}</Body> : null}
              {f.recommendation ? (
                <Body className="fnd__why"><UIText tone="ink2">{t('recommendation')}:</UIText> {f.recommendation}</Body>
              ) : null}
              {f.constitution_articles.length ? (
                <div className="fnd__refs">
                  {f.constitution_articles.map((n) => (
                    <Cite
                      key={n}
                      code={citeCode(`Конституция РК ${n}`, lang)}
                      onClick={() => navigate(withLang(`/constitution/articles/${n}`, lang))}
                    />
                  ))}
                </div>
              ) : null}
              <div>
                <Button variant="ghost" onClick={() => setOpen((o) => ({ ...o, [f.id]: !o[f.id] }))}>
                  {open[f.id] ? t('hideNorm') : t('showNorm')}
                </Button>
              </div>
              {open[f.id] ? <Detail id={f.id} /> : null}
            </div>
          </article>
        )
      })}
    </div>
  )
}
