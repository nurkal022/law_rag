import { useMemo } from 'react'
import Markdown from 'react-markdown'
import type { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Cite } from '../../shared/ui'

/**
 * Ответ консультанта — markdown с правовыми координатами.
 *
 * Модель отвечает развёрнуто: «Кратко», разделы, списки, таблицы. Раньше ответ
 * рисовался как есть, и «## Что говорит закон» человек читал вместе с решётками.
 * Координаты норм едут внутри текста ссылками вида [ГК РК 178](#cite:…) — это
 * единственный способ провести их через разбор markdown целиком; здесь такая
 * ссылка становится чипом <Cite>. Якорь, а не своя схема: react-markdown
 * вычищает адреса с незнакомым протоколом, а «#» перед двоеточием он пропускает.
 */

const CITE = '#cite:'

/** Координата → ссылка markdown, которую разберёт этот компонент. */
export function citeLink(code: string): string {
  return `[${code}](${CITE}${encodeURIComponent(code)})`
}

interface Props {
  text: string
  onCite: (code: string) => void
}

export function AnswerMarkdown({ text, onCite }: Props) {
  const components = useMemo<Components>(
    () => ({
      a: ({ href, children }) => {
        if (href && href.startsWith(CITE)) {
          const code = decodeURIComponent(href.slice(CITE.length))
          return <Cite code={code} onClick={() => onCite(code)} />
        }
        return (
          <a href={href} target="_blank" rel="noreferrer">
            {children}
          </a>
        )
      },
    }),
    [onCite],
  )
  return (
    <Markdown remarkPlugins={[remarkGfm]} components={components}>
      {text}
    </Markdown>
  )
}
