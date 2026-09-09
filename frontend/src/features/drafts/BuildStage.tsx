import { Caption, Cite, Loading, UIText } from '../../shared/ui'
import { useLang, useT } from '../../i18n'
import type { Dict } from '../../i18n'
import { citeCode, normCode } from '../legal/cite'
import type { Building } from './doc'

/**
 * Строка хода генерации.
 *
 * Полоса с процентами говорила «идёт», но не «что». Здесь видно, какой раздел
 * пишется, какие нормы под него нашлись и на какой стадии работа — настоящие
 * данные из задачи, а не анимация ради анимации.
 */

const dict: Dict = {
  building: { ru: 'Составляю разделы', kz: 'Бөлімдерді жасап жатырмын', en: 'Drafting sections' },
  of: { ru: 'из', kz: '/', en: 'of' },
  retrieving: { ru: 'ищу нормы', kz: 'нормаларды іздеп жатырмын', en: 'looking up the norms' },
  drafting: { ru: 'пишу', kz: 'жазып жатырмын', en: 'writing' },
  checking: { ru: 'Проверяю ссылки и нумерацию', kz: 'Сілтемелер мен нөмірлеуді тексеріп жатырмын', en: 'Checking citations and numbering' },
  found: { ru: 'нашёл:', kz: 'табылды:', en: 'found:' },
}

export function BuildStage({ building, sectionTitle }: { building: Building; sectionTitle?: string }) {
  const t = useT(dict)
  const { lang } = useLang()
  const stage = building.stage ?? 'drafting'
  const current = Math.min(building.done + 1, building.total)

  return (
    <div className="ct-building" role="status" aria-live="polite">
      <Loading label={t('building')} />
      <div className="ct-building__line">
        <UIText tone="mute">
          {stage === 'checking'
            ? t('checking')
            : `${t('building')}: ${current} ${t('of')} ${building.total}${
                sectionTitle ? ` — ${sectionTitle}` : ''
              } · ${t(stage)}`}
        </UIText>
        {stage !== 'checking' && building.found?.length ? (
          <span className="ct-building__found">
            <Caption tone="mute" as="span">
              {t('found')}
            </Caption>
            {building.found.map((n) => (
              <Cite key={`${n.title}-${n.article}`} code={citeCode(normCode(n.title, n.article), lang)} />
            ))}
          </span>
        ) : null}
      </div>
    </div>
  )
}
