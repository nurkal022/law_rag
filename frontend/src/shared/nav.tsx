import { forwardRef } from 'react'
import { Link as RouterLink, NavLink as RouterNavLink } from 'react-router-dom'
import type { LinkProps, NavLinkProps } from 'react-router-dom'
import { useLang, withLang } from '../i18n'

/**
 * Ссылки, сохраняющие язык.
 *
 * Язык — это префикс адреса (/kk, /en), поэтому обычная <Link to="/chat"> с
 * казахской страницы уводила бы на русскую. Эти обёртки подставляют префикс
 * текущего языка сами, чтобы про него нельзя было забыть.
 *
 * Импортируй Link и NavLink отсюда, а не из react-router-dom.
 */

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link({ to, ...rest }, ref) {
  const { lang } = useLang()
  const target = typeof to === 'string' ? withLang(to, lang) : to
  return <RouterLink ref={ref} to={target} {...rest} />
})

export const NavLink = forwardRef<HTMLAnchorElement, NavLinkProps>(function NavLink(
  { to, ...rest },
  ref,
) {
  const { lang } = useLang()
  const target = typeof to === 'string' ? withLang(to, lang) : to
  return <RouterNavLink ref={ref} to={target} {...rest} />
})
