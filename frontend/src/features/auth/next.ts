import type { Lang } from '../../i18n'
import { withLang } from '../../i18n'

/**
 * Куда вести после входа.
 *
 * login_required на сервере уводит на /login?next=<путь>; после входа человек
 * должен оказаться там, куда шёл, а не в консультанте. Принимается только
 * относительный путь внутри сайта: «next» приходит из адресной строки, и
 * внешний адрес там — способ увести человека на чужой сайт после входа.
 */
export function afterLogin(search: string, lang: Lang): string {
  const next = new URLSearchParams(search).get('next') || ''
  if (/^\/(?![\/\\])/.test(next)) return next
  return withLang('/chat', lang)
}
