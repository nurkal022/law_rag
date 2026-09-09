import type { Lang } from '../../i18n'

/** Примеры вопросов для пустого состояния консультанта. */
export interface Example {
  id: string
  text: Record<Lang, string>
}

export const EXAMPLES: Example[] = [
  {
    id: 'limitation',
    text: {
      ru: 'Какой срок исковой давности по договору поставки и когда он начинает течь?',
      kz: 'Жеткізу шарты бойынша талап қою мерзімі қандай және ол қашан басталады?',
      en: 'What is the limitation period for a supply contract and when does it start running?',
    },
  },
  {
    id: 'penalty',
    text: {
      ru: 'Как рассчитывается неустойка за просрочку оплаты, если размер не указан в договоре?',
      kz: 'Шартта мөлшері көрсетілмесе, төлемді кешіктіргені үшін тұрақсыздық айыбы қалай есептеледі?',
      en: 'How is the penalty for late payment calculated if the contract sets no rate?',
    },
  },
  {
    id: 'termination',
    text: {
      ru: 'Можно ли расторгнуть договор аренды в одностороннем порядке без суда?',
      kz: 'Жалдау шартын сотсыз, біржақты тәртіппен бұзуға бола ма?',
      en: 'Can a lease be terminated unilaterally without going to court?',
    },
  },
  {
    id: 'force',
    text: {
      ru: 'Освобождает ли форс-мажор от уплаты неустойки по договору подряда?',
      kz: 'Форс-мажор мердігерлік шарты бойынша тұрақсыздық айыбын төлеуден босата ма?',
      en: 'Does force majeure release a contractor from paying a contractual penalty?',
    },
  },
]
