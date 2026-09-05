import type { ElementType, HTMLAttributes, ReactNode } from 'react'

/**
 * Типографические примитивы TURA.
 *
 * Роли гарнитур жёсткие и заданы токенами:
 *   Display/H1/H2/Legal — PT Serif  (смысловой текст: заголовки, нормы, ответы)
 *   H3/Body/UI/Caption/Label — Golos Text (интерфейс)
 *   Mono — JetBrains Mono (только правовые координаты; для ссылки на норму
 *          используй <Cite>, а не <Mono>)
 */

type Tone = 'ink' | 'ink2' | 'mute' | 'seal' | 'ok' | 'warn' | 'err'

interface TextProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType
  tone?: Tone
  children?: ReactNode
  /** Присутствует, когда примитив рендерится как <label> (см. Field). */
  htmlFor?: string
}

const toneClass: Record<Tone, string> = {
  ink: 'tone-ink',
  ink2: 'tone-ink2',
  mute: 'tone-mute',
  seal: 'tone-seal',
  ok: 'tone-ok',
  warn: 'tone-warn',
  err: 'tone-err',
}

function make(variant: string, defaultAs: ElementType) {
  return function Component({ as, tone, className, children, ...rest }: TextProps) {
    const Tag = as ?? defaultAs
    const cls = [variant, tone ? toneClass[tone] : '', className ?? ''].filter(Boolean).join(' ')
    return (
      <Tag className={cls} {...rest}>
        {children}
      </Tag>
    )
  }
}

export const Display = make('t-display', 'h1')
export const H1 = make('t-h1', 'h1')
export const H2 = make('t-h2', 'h2')
export const H3 = make('t-h3', 'h3')

/** Текст нормы или ответа ассистента. Широкий интерлиньяж, ограничение длины строки. */
export const Legal = make('t-legal', 'div')

export const Body = make('t-body', 'p')
export const UIText = make('t-ui', 'span')
export const Caption = make('t-caption', 'span')

/** Прописная подпись раздела. */
export const Label = make('t-label', 'div')

/** Моноширинный для служебных идентификаторов. Для ссылки на норму — <Cite>. */
export const Mono = make('t-mono', 'span')
