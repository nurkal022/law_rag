import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: 'md' | 'lg'
  children?: ReactNode
}

/**
 * Кнопка TURA. Прямоугольная, без тени и скругления.
 *   primary   — заливка чернилами, одно главное действие на экран
 *   secondary — контур по линии
 *   ghost     — только текст, для второстепенных действий в плотных местах
 *   danger    — удаление и необратимое
 */
export function Button({ variant = 'secondary', size = 'md', className, ...rest }: ButtonProps) {
  const cls = ['btn', `btn--${variant}`, size === 'lg' ? 'btn--lg' : '', className ?? '']
    .filter(Boolean)
    .join(' ')
  return <button className={cls} {...rest} />
}
