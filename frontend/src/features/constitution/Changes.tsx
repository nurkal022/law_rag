import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Body, Caption, Chip, Cite, H2, Label, Legal } from '../../shared/ui'
import { useLang, useT, withLang } from '../../i18n'
import { citeCode } from '../legal/cite'
import { dict } from './dict'
import type { Change } from './types'

const KINDS: Change['kind'][] = ['institution', 'new', 'removed', 'procedure', 'reference']

/** Реестр «было → стало» с числом затронутых норм; раскрытие строки — цитаты обеих Конституций. */
export function Changes({ changes }: { changes: Change[] }) {
  const t = useT(dict)
  const { lang } = useLang()
  const navigate = useNavigate()
  const [kind, setKind] = useState<Change['kind'] | null>(null)
  const shown = kind ? changes.filter((c) => c.kind === kind) : changes
  const max = Math.max(1, ...changes.map((c) => c.norms))

  return (
    <section className="cn-block">
      <div className="cn-block__head">
        <H2>{t('chgHead')}</H2>
        <Body tone="mute" className="cn-block__lead">{t('chgLead')}</Body>
      </div>
      <div className="chg-filters">
        <Chip active={kind === null} onClick={() => setKind(null)}>{t('chgAll')}</Chip>
        {KINDS.filter((k) => changes.some((c) => c.kind === k)).map((k) => (
          <Chip key={k} active={kind === k} onClick={() => setKind(kind === k ? null : k)}>{t(`kind_${k}`)}</Chip>
        ))}
      </div>
      <div>
        {shown.map((c) => (
          <details key={c.id} className="chg">
            <summary className="chg__sum">
              <Caption tone="mute">{t(`kind_${c.kind}`)}</Caption>
              <span className="chg__title">{c.title}</span>
              <span className="chg__n">
                <span className="lvbar" style={{ width: `${Math.max(8, (100 * c.norms) / max)}%` }} aria-hidden="true">
                  <span className="lvbar__seg lv--2" style={{ width: '100%' }} />
                </span>
                <span className="tabular t-caption">{c.norms}</span>
              </span>
            </summary>
            <div className="chg__body">
              <div className="chg__cols">
                <div className="chg__col">
                  <Label>{t('was')}</Label>
                  {c.old_quote ? <Legal>«{c.old_quote}»</Legal> : <Caption tone="mute">—</Caption>}
                  <div className="chg__refs">
                    {c.old_articles.map((n) => <Cite key={n} code={citeCode(`Конституция РК (1995) ${n}`, lang)} disabled />)}
                  </div>
                </div>
                <div className="chg__col">
                  <Label>{t('became')}</Label>
                  {c.new_quote ? <Legal>«{c.new_quote}»</Legal> : <Caption tone="mute">—</Caption>}
                  <div className="chg__refs">
                    {c.new_articles.map((n) => (
                      <Cite
                        key={n}
                        code={citeCode(`Конституция РК ${n}`, lang)}
                        onClick={() => navigate(withLang(`/constitution/articles/${n}`, lang))}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <Body>{c.summary}</Body>
            </div>
          </details>
        ))}
      </div>
    </section>
  )
}
