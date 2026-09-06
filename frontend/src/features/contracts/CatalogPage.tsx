import { useMemo, useState } from 'react'
import { Body, Caption, Chip, Display, Empty, Input, Label } from '../../shared/ui'
import { Link } from '../../shared/nav'
import { useLang, useT } from '../../i18n'
import type { Dict } from '../../i18n'
import { api } from '../../shared/api'
import { docLang } from '../drafts/preview'
import type { CatalogResponse, CatalogType } from '../drafts/types'
import { ListSkeleton, LoadFailure, useLoader } from '../drafts/shared'
import { ContractTabs } from './shared'
import '../drafts/drafts.css'
import '../drafts/drafts.motion.css'

/**
 * Каталог типов договоров.
 *
 * Витрина: типы сгруппированы по семействам, у каждого — правовая основа и
 * честная пометка о том, вычитан ли паспорт юристом. Скрывать невычитанность
 * нельзя: человек принимает решение о сделке, и он должен знать, на что
 * опирается текст.
 */

const dict: Dict = {
  title: { ru: 'Договоры', kz: 'Шарттар', en: 'Contracts' },
  lead: {
    ru: 'Составление договора по праву Республики Казахстан: реквизиты, существенные условия и текст со ссылками на нормы.',
    kz: 'Қазақстан Республикасының құқығы бойынша шарт жасау: деректемелер, елеулі талаптар және нормаларға сілтемелері бар мәтін.',
    en: 'Drafting contracts under Kazakhstan law: details, essential terms and text with references to the norms.',
  },
  search: { ru: 'Поиск по названию', kz: 'Атауы бойынша іздеу', en: 'Search by name' },
  all: { ru: 'Все', kz: 'Барлығы', en: 'All' },
  sections: { ru: 'разделов', kz: 'бөлім', en: 'sections' },
  notReviewed: {
    ru: 'Не вычитан юристом',
    kz: 'Заңгер тексермеген',
    en: 'Not reviewed by a lawyer',
  },
  notReviewedHint: {
    ru: 'Паспорт типа ещё не проверен практикующим юристом. Текст пригоден как основа, но требует проверки перед подписанием.',
    kz: 'Түр паспортын практик заңгер әлі тексермеген. Мәтін негіз ретінде жарамды, бірақ қол қоярдан бұрын тексеруді талап етеді.',
    en: 'The type passport has not yet been checked by a practising lawyer. Use the text as a basis, but review it before signing.',
  },
  caveat: { ru: 'Оговорка', kz: 'Ескертпе', en: 'Caveat' },
  emptyTitle: { ru: 'Ничего не найдено', kz: 'Ештеңе табылмады', en: 'Nothing found' },
  emptyBody: {
    ru: 'Измените запрос или снимите фильтр по семейству договоров.',
    kz: 'Сұрауды өзгертіңіз немесе шарт тобы бойынша сүзгіні алып тастаңыз.',
    en: 'Change the query or clear the family filter.',
  },
  catalogEmpty: {
    ru: 'Каталог типов договоров пуст',
    kz: 'Шарт түрлерінің каталогы бос',
    en: 'The contract catalogue is empty',
  },
  catalogEmptyBody: {
    ru: 'Сервер не вернул ни одного типа. Это ошибка настройки каталога на стороне сервера.',
    kz: 'Сервер бірде-бір түр қайтармады. Бұл сервер жағындағы каталог баптауының қатесі.',
    en: 'The server returned no types at all. This is a server-side catalogue configuration error.',
  },
}

/** Семейства из паспортов. Незнакомое семейство показывается своим кодом. */
const families: Dict = {
  sale: { ru: 'Купля-продажа', kz: 'Сатып алу-сату', en: 'Sale' },
  lease: { ru: 'Аренда', kz: 'Жалдау', en: 'Lease' },
  works: { ru: 'Подряд', kz: 'Мердігерлік', en: 'Works' },
  services: { ru: 'Услуги', kz: 'Қызметтер', en: 'Services' },
  finance: { ru: 'Финансы', kz: 'Қаржы', en: 'Finance' },
  labour: { ru: 'Труд', kz: 'Еңбек', en: 'Labour' },
  ip: { ru: 'Интеллектуальная собственность', kz: 'Зияткерлік меншік', en: 'Intellectual property' },
  corporate: { ru: 'Корпоративные', kz: 'Корпоративтік', en: 'Corporate' },
  family: { ru: 'Семейные', kz: 'Отбасылық', en: 'Family' },
}

const FAMILY_ORDER = ['sale', 'lease', 'works', 'services', 'finance', 'labour', 'ip', 'corporate', 'family']

function TypeCard({ type, i, family }: { type: CatalogType; i: number; family: string }) {
  const t = useT(dict)
  return (
    <Link to={`/contracts/new/${type.id}`} className="ct-card enter-item" style={{ '--i': i } as React.CSSProperties}>
      <Label as="div" className="ct-card__family">{family}</Label>
      <div className="ct-card__name">{type.name}</div>
      <Body className="ct-card__summary" tone="mute">
        {type.summary}
      </Body>

      {/* Только основная норма: полный перечень статей — на странице типа.
          Четыре ссылки подряд растягивали карточки до несопоставимых высот
          и превращали каталог в список сносок. */}
      {type.legal_basis.length ? (
        <div className="ct-card__basis">
          <span className="cite ct-card__cite">{type.legal_basis[0]}</span>
          {type.legal_basis.length > 1 ? (
            <Caption tone="mute" className="tabular">
              {' '}+{type.legal_basis.length - 1}
            </Caption>
          ) : null}
        </div>
      ) : null}

      <div className="ct-card__foot">
        <Caption tone="mute">{type.form}</Caption>
        <Caption tone="mute" className="tabular">
          {type.sections_count} {t('sections')}
        </Caption>
      </div>

      {type.reviewed ? null : (
        <div className="ct-card__flag" title={t('notReviewedHint')}>
          <span className="status status--warn">{t('notReviewed')}</span>
        </div>
      )}

      {type.caveat ? (
        <details className="ct-caveat ct-card__caveat">
          <summary className="ct-caveat__head">
            <Label as="span">{t('caveat')}</Label>
          </summary>
          <Caption tone="ink2" className="ct-caveat__body">{type.caveat}</Caption>
        </details>
      ) : null}
    </Link>
  )
}

export function CatalogPage() {
  const t = useT(dict)
  const tf = useT(families)
  const { lang } = useLang()
  const [family, setFamily] = useState<string>('')
  const [query, setQuery] = useState('')

  const { data, error, loading, reload } = useLoader<CatalogResponse>(
    () => api.get<CatalogResponse>(`/drafts/catalog?kind=contract&lang=${docLang(lang)}`),
    [lang],
  )

  const types = useMemo(() => data?.types ?? [], [data])

  const present = useMemo(() => {
    const seen = new Set(types.map((x) => x.family))
    const known = FAMILY_ORDER.filter((f) => seen.has(f))
    const rest = [...seen].filter((f) => !FAMILY_ORDER.includes(f)).sort()
    return [...known, ...rest]
  }, [types])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return types.filter(
      (x) =>
        (!family || x.family === family) &&
        (!q || x.name.toLowerCase().includes(q) || x.summary.toLowerCase().includes(q)),
    )
  }, [types, family, query])

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
        <ListSkeleton rows={8} />
      ) : error ? (
        <div className="ct-state">
          <LoadFailure error={error} onRetry={reload} />
        </div>
      ) : !types.length ? (
        <div className="ct-state">
          <Empty title={t('catalogEmpty')}>{t('catalogEmptyBody')}</Empty>
        </div>
      ) : (
        <>
          <div className="ct-filters">
            <div className="ct-filters__chips">
              <Chip active={!family} onClick={() => setFamily('')}>
                {t('all')}
              </Chip>
              {present.map((f) => (
                <Chip key={f} active={family === f} onClick={() => setFamily(family === f ? '' : f)}>
                  {families[f] ? tf(f) : f}
                </Chip>
              ))}
            </div>
            <div className="ct-filters__search">
              <Input
                type="search"
                value={query}
                placeholder={t('search')}
                aria-label={t('search')}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>

          {!shown.length ? (
            <div className="ct-state">
              <Empty title={t('emptyTitle')}>{t('emptyBody')}</Empty>
            </div>
          ) : (
            <div className="ct-cards">
              {shown.map((type, i) => (
                <TypeCard key={type.id} type={type} i={i}
                          family={families[type.family] ? tf(type.family) : type.family} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
