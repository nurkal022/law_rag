import type { ButtonHTMLAttributes } from 'react'

interface CiteProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Короткий код нормы: «ГК РК 178.1». Набирается моноширинным. */
  code: string
}

/**
 * Правовая координата — ссылка на норму.
 *
 * Единственный компонент, где применяется JetBrains Mono. Моноширинный здесь
 * работает как навигация: он отделяет адресуемую норму от человеческого текста,
 * и глаз находит ссылку без цветового выделения. Не используй его для обычных
 * ссылок и подписей.
 */
export function Cite({ code, className, ...rest }: CiteProps) {
  return (
    <button
      type="button"
      className={['cite', className ?? ''].filter(Boolean).join(' ')}
      title={`Открыть норму: ${code}`}
      {...rest}
    >
      {code}
    </button>
  )
}
