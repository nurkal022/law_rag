import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Body, Caption, Chip, Display, Empty, H2, Label, Mono, UIText } from '../../shared/ui'
import { Link } from '../../shared/nav'
import { useLang, useT } from '../../i18n'
import { api } from '../../shared/api'
import { ListSkeleton, LoadFailure, useLoader } from '../drafts/shared'
import { Barcode } from './Barcode'
import { LevelBar } from './Bars'
import { Findings } from './Findings'
import { dict } from './dict'
import { LEVELS_DESC, apiLang } from './levels'
import type { ActResponse, Tri } from './types'
import '../drafts/drafts.css'
import './constitution.css'
import './constitution.motion.css'

export function ActPage() {
  const { id } = useParams()
  const t = useT(dict)
  const { lang } = useLang()
  const al = apiLang(lang)
  const [level, setLevel] = useState<number | null>(null)
  const [category, setCategory] = useState<string | null>(null)
  const [target, setTarget] = useState<number | null>(null)

  const query = [level !== null ? `level=${level}` : '', category ? `category=${category}` : ''].filter(Boolean).join('&')
  const { data, error, loading, reload } = useLoader<ActResponse>(
    () => api.get<ActResponse>(`/constitution/acts/${id}${query ? `?${query}` : ''}`),
    [id, query],
  )

  // Формулировки уровней приходят с сервера: код их не дублирует
  const wording = useMemo(() => {
    const out: Record<number, Tri> = {}
    for (const [k, v] of Object.entries(data?.wording ?? {})) out[Number(k)] = v
    return out
  }, [data])

  const categories = useMemo(() => {
    const seen = new Map<string, Tri>()
    for (const f of data?.findings ?? []) if (!seen.has(f.category)) seen.set(f.category, f.category_label)
    return [...seen.entries()]
  }, [data])

  useEffect(() => {
    if (target === null) return
    document.getElementById(`f-${target}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [target, data])

  const pick = (findingId: number) => {
    setLevel(null)
    setCategory(null)
    setTarget(findingId)
  }

  return (
    <div className="page cn">
      <Link to="/constitution" className="t-ui">← {t('back')}</Link>
      {loading && !data ? (
        <ListSkeleton rows={8} />
      ) : error ? (
        <div className="ct-state"><LoadFailure error={error} onRetry={reload} /></div>
      ) : !data ? (
        <div className="ct-state"><Empty title={t('noRunTitle')}>{t('noRunBody')}</Empty></div>
      ) : (
        <>
          <div className="page__head">
            <div className="page__title">
              <Display>{data.act.title}</Display>
              <Body tone="mute">{data.act.code}</Body>
            </div>
          </div>
          <div className="act-meta">
            <div className="act-meta__item"><Label>{t('tier')}</Label><UIText>{data.act.tier ?? '—'}</UIText></div>
            <div className="act-meta__item"><Label>{t('edition')}</Label><UIText className="tabular">{data.act.edition || '—'}</UIText></div>
            <div className="act-meta__item">
              <Label>{t('source')}</Label>
              {data.act.url ? <a href={data.act.url} target="_blank" rel="noreferrer"><Mono>{data.act.adilet}</Mono></a> : <UIText>—</UIText>}
            </div>
            <div className="act-meta__item"><Label>{t('figNorms')}</Label><UIText className="tabular">{data.act.norms}</UIText></div>
          </div>

          <section className="cn-block">
            <div className="cn-block__head">
              <H2>{t('barcodeHead')}</H2>
              <Body tone="mute" className="cn-block__lead">{t('barcodeLead')}</Body>
            </div>
            <Barcode articles={data.articles} wording={wording} onPick={pick} />
            <div className="bc-scale">
              <Caption tone="mute" className="tabular">{data.articles[0]?.article_no ?? ''}</Caption>
              <Caption tone="mute" className="tabular">{data.articles[data.articles.length - 1]?.article_no ?? ''}</Caption>
            </div>
            <LevelBar counts={data.act.counts} total={data.act.norms} className="walk__bar" />
          </section>

          <section className="cn-block">
            <div className="cn-block__head"><H2>{t('findingsHead')}</H2></div>
            <div className="act-filters">
              <Chip active={level === null} onClick={() => setLevel(null)}>{t('allLevels')}</Chip>
              {LEVELS_DESC.filter((lv) => lv > 0).map((lv) => (
                <Chip key={lv} active={level === lv} onClick={() => setLevel(level === lv ? null : lv)}>
                  {wording[lv]?.[al] ?? lv} · {data.act.counts[String(lv) as '1' | '2' | '3'] ?? 0}
                </Chip>
              ))}
            </div>
            {categories.length > 1 ? (
              <div className="act-filters">
                <Chip active={category === null} onClick={() => setCategory(null)}>{t('allCategories')}</Chip>
                {categories.map(([key, label]) => (
                  <Chip key={key} active={category === key} onClick={() => setCategory(category === key ? null : key)}>{label[al]}</Chip>
                ))}
              </div>
            ) : null}
            <Findings items={data.findings} targetId={target} />
          </section>
          <Caption tone="mute" className="cn-disclaimer">{t('disclaimer')}</Caption>
        </>
      )}
    </div>
  )
}
