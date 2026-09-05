import { useState } from 'react'
import {
  Body,
  Button,
  Caption,
  Cite,
  Display,
  H3,
  Label,
  Legal,
  Mono,
  Status,
  Textarea,
  UIText,
} from '../../shared/ui'
import { useT } from '../../i18n'
import type { Dict } from '../../i18n'
import './workspace.css'

const dict: Dict = {
  docTitle: { ru: 'Договор поставки № 47-П', kz: '№ 47-П жеткізу шарты', en: 'Supply contract No. 47-P' },
  matter: { ru: 'Дело', kz: 'Іс', en: 'Matter' },
  matterName: { ru: 'ТОО «Астана Логистик»', kz: '«Астана Логистик» ЖШС', en: 'Astana Logistik LLP' },
  pages: { ru: 'Страниц', kz: 'Беттер', en: 'Pages' },
  status: { ru: 'Статус', kz: 'Күйі', en: 'Status' },
  indexed: { ru: 'проиндексирован', kz: 'индекстелген', en: 'indexed' },
  version: { ru: 'Версия', kz: 'Нұсқа', en: 'Version' },

  actEdit: { ru: 'Внести правку', kz: 'Түзету енгізу', en: 'Amend' },
  actCheck: { ru: 'Полная проверка', kz: 'Толық тексеру', en: 'Full review' },
  actExport: { ru: 'Экспорт', kz: 'Экспорт', en: 'Export' },

  dialog: { ru: 'Диалог по документу', kz: 'Құжат бойынша диалог', en: 'Conversation about this document' },
  you: { ru: 'Ваш вопрос', kz: 'Сіздің сұрағыңыз', en: 'Your question' },
  tura: { ru: 'TURA', kz: 'TURA', en: 'TURA' },

  q1: {
    ru: 'Устоит ли в суде пункт о неустойке 5 % за каждый день просрочки?',
    kz: '5 % мөлшеріндегі күнделікті тұрақсыздық айыбы туралы тармақ сотта тұрақ бола ма?',
    en: 'Will the clause on a 5 % daily penalty hold up in court?',
  },
  q2: {
    ru: 'А срок оплаты в договоре не определён. Что применяется по умолчанию?',
    kz: 'Ал шартта төлем мерзімі белгіленбеген. Әдепкі бойынша не қолданылады?',
    en: 'The payment term is not fixed in the contract. What applies by default?',
  },

  ask: { ru: 'Вопрос по документу', kz: 'Құжат бойынша сұрақ', en: 'Question about the document' },
  askPh: {
    ru: 'Спросите о конкретном пункте — например, об ответственности за просрочку',
    kz: 'Нақты тармақ туралы сұраңыз — мысалы, мерзімін өткізгені үшін жауапкершілік',
    en: 'Ask about a specific clause — for example, liability for delay',
  },
  send: { ru: 'Спросить', kz: 'Сұрау', en: 'Ask' },

  panel: { ru: 'Пункт → норма', kz: 'Тармақ → норма', en: 'Clause → provision' },
  panelHint: {
    ru: 'Каждый пункт договора сопоставлен с нормой законодательства РК по смыслу текста, а не по типу договора.',
    kz: 'Шарттың әрбір тармағы шарт түрі бойынша емес, мәтін мағынасы бойынша ҚР заңнамасының нормасымен салыстырылған.',
    en: 'Each clause is matched to a provision of Kazakhstan law by the meaning of its text, not by contract type.',
  },
  yourClause: { ru: 'Ваш пункт', kz: 'Сіздің тармақ', en: 'Your clause' },
}

/** Привязки «пункт → норма» — раздел 6 спеки рабочего места. Данные замоканы. */
interface CrossRef {
  clause: string
  quote: string
  code: string
  norm: string
}

const REFS: CrossRef[] = [
  {
    clause: '7.2',
    quote:
      'При просрочке поставки Поставщик уплачивает Покупателю неустойку в размере 5 % от стоимости непоставленного товара за каждый день просрочки, без ограничения общей суммы.',
    code: 'ГК РК 297',
    norm:
      'Если подлежащая уплате неустойка чрезмерно велика по сравнению с убытками кредитора, суд вправе уменьшить неустойку, учитывая степень выполнения обязательства должником и заслуживающие внимания интересы должника и кредитора.',
  },
  {
    clause: '4.1',
    quote:
      'Оплата поставленного товара производится Покупателем после приёмки товара; конкретный срок оплаты стороны согласовывают дополнительно.',
    code: 'ГК РК 476',
    norm:
      'Покупатель оплачивает поставляемые товары с соблюдением порядка и формы расчётов, предусмотренных договором поставки. Если порядок и форма расчётов не определены соглашением сторон, расчёты осуществляются платёжными поручениями.',
  },
  {
    clause: '9.4',
    quote:
      'Все споры, вытекающие из настоящего Договора, подлежат рассмотрению в арбитраже в городе Лондоне по регламенту LCIA.',
    code: 'ГПК РК 30',
    norm:
      'Иски к юридическому лицу предъявляются по месту нахождения органа юридического лица; изъятия из этого правила допускаются лишь в случаях, прямо установленных законом или международным договором.',
  },
]

export function DocumentPage() {
  const t = useT(dict)
  const [draft, setDraft] = useState('')

  return (
    <div className="ws-doc">
      <div className="ws-doc__main">
        <div>
          <Display>{t('docTitle')}</Display>
        </div>

        <div className="ws-meta">
          <span className="ws-meta__item">
            <Label as="span">{t('matter')}</Label>
            <UIText tone="ink2">{t('matterName')}</UIText>
          </span>
          <span className="ws-meta__item">
            <Label as="span">{t('pages')}</Label>
            <Mono tone="ink2">14</Mono>
          </span>
          <span className="ws-meta__item">
            <Label as="span">{t('status')}</Label>
            <Status kind="ok">{t('indexed')}</Status>
          </span>
          <span className="ws-meta__item">
            <Label as="span">{t('version')}</Label>
            <Mono tone="ink2">v3</Mono>
          </span>
        </div>

        <div className="ws-actions">
          <Button variant="primary">{t('actEdit')}</Button>
          <Button variant="secondary">{t('actCheck')}</Button>
          <Button variant="secondary">{t('actExport')}</Button>
        </div>

        <Label as="h2">{t('dialog')}</Label>

        <div className="ws-thread">
          <div className="ws-turn">
            <Caption tone="mute">{t('you')}</Caption>
            <div className="ws-turn__ask">
              <Body style={{ margin: 0 }}>{t('q1')}</Body>
            </div>
          </div>

          <div className="ws-turn">
            <Caption tone="mute">{t('tura')}</Caption>
            <Legal className="ws-answer">
              <p>
                Пункт 7.2 устанавливает неустойку 5 % от стоимости непоставленного товара за каждый
                день просрочки — это 1 825 % годовых и заведомо больше вероятных убытков покупателя.
                Само условие законно: стороны свободны в определении размера неустойки. Однако{' '}
                <Cite code="ГК РК 297" /> даёт суду право уменьшить явно несоразмерную неустойку, и в
                споре по такому пункту снижение следует считать наиболее вероятным исходом, а не
                исключением.
              </p>
              <p>
                Отдельный риск создаёт оговорка «без ограничения общей суммы»: при длительной просрочке
                начисление превысит цену договора. Практика по <Cite code="ГК РК 293" /> исходит из
                того, что неустойка обеспечивает обязательство, а не заменяет его, поэтому ограничение
                совокупного размера — обычно 10 % от суммы договора — делает пункт устойчивее, чем
                высокая ставка без потолка.
              </p>
              <p>
                Практический вывод: снизьте ставку до 0,1–0,5 % в день и добавьте предельную сумму.
                Такой пункт взыскивается целиком, тогда как нынешний, скорее всего, будет урезан судом
                до сопоставимого уровня — но уже после разбирательства.
              </p>
            </Legal>
          </div>

          <div className="ws-turn">
            <Caption tone="mute">{t('you')}</Caption>
            <div className="ws-turn__ask">
              <Body style={{ margin: 0 }}>{t('q2')}</Body>
            </div>
          </div>

          <div className="ws-turn">
            <Caption tone="mute">{t('tura')}</Caption>
            <Legal className="ws-answer">
              <p>
                Пункт 4.1 отсылает срок оплаты к дополнительному согласованию, то есть в договоре его
                нет. По <Cite code="ГК РК 476" /> покупатель оплачивает товар в порядке и форме,
                предусмотренных договором поставки, а при отсутствии соглашения расчёты ведутся
                платёжными поручениями; сам срок при этом определяется по общему правилу{' '}
                <Cite code="ГК РК 277" /> — обязательство исполняется в разумный срок, а после
                требования кредитора — в семидневный.
              </p>
              <p>
                Для взыскания это означает, что просрочка начнёт течь только с восьмого дня после
                вашего письменного требования, и неустойка по пункту 7.2 до этого момента не
                начисляется. Прямой срок в договоре — «в течение 10 рабочих дней с даты подписания
                накладной» — устраняет спор о моменте начала просрочки.
              </p>
            </Legal>
          </div>
        </div>

        <form className="ws-ask" onSubmit={(e) => e.preventDefault()}>
          <div className="ws-ask__field">
            <Textarea
              label={t('ask')}
              placeholder={t('askPh')}
              value={draft}
              rows={2}
              onChange={(e) => setDraft(e.currentTarget.value)}
            />
          </div>
          <Button variant="primary" type="submit">
            {t('send')}
          </Button>
        </form>
      </div>

      <aside className="ws-doc__side" aria-label={t('panel')}>
        <div>
          <H3>{t('panel')}</H3>
          <Caption tone="mute">{t('panelHint')}</Caption>
        </div>

        <div className="ws-links">
          {REFS.map((r) => (
            <div className="ws-link" key={r.clause}>
              <Mono tone="mute" className="ws-link__clause">
                {t('yourClause')} {r.clause}
              </Mono>
              <p className="ws-link__quote">{r.quote}</p>
              <div className="ws-link__arrow">
                <Cite code={r.code} />
              </div>
              <p className="ws-link__norm">{r.norm}</p>
            </div>
          ))}
        </div>
      </aside>
    </div>
  )
}
