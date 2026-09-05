import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ElementType, ReactNode } from 'react'

/**
 * Инструменты движения TURA.
 *
 * Оба уважают системную настройку «меньше движения»: там, где она включена,
 * содержимое сразу оказывается в конечном состоянии, без промежуточных шагов.
 */

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Появление блока, когда он доходит до экрана. Один раз: повторный въезд при
 * прокрутке вверх выглядит суетливо и мешает читать длинную страницу.
 */
export function Reveal({
  as,
  delay = 0,
  className,
  children,
  ...rest
}: {
  as?: ElementType
  delay?: number
  className?: string
  children?: ReactNode
} & Record<string, unknown>) {
  const Tag = as ?? 'div'
  const ref = useRef<HTMLElement | null>(null)
  const [shown, setShown] = useState(() => prefersReducedMotion())

  useEffect(() => {
    if (shown) return
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setShown(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true)
          io.disconnect()
        }
      },
      { rootMargin: '0px 0px -12% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [shown])

  const style = delay ? ({ animationDelay: `${delay}ms` } as CSSProperties) : undefined

  return (
    <Tag
      ref={ref}
      className={[shown ? 'enter' : 'pre-enter', className ?? ''].filter(Boolean).join(' ')}
      style={style}
      {...rest}
    >
      {children}
    </Tag>
  )
}

/**
 * Число, набегающее до значения. Для показателей: сводка аналитики, обзор
 * админки. Длительность держим короткой — это акцент, а не аттракцион.
 */
export function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(() => (prefersReducedMotion() ? target : 0))

  useEffect(() => {
    if (prefersReducedMotion()) {
      setValue(target)
      return
    }
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      // Тот же выкат без отскока, что и у --ease-out в токенах
      const eased = 1 - Math.pow(1 - p, 3)
      setValue(target * eased)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])

  return value
}

/** Целое с пробелом-разделителем разрядов: 1 247. */
export function useCountUpInt(target: number, duration?: number) {
  const v = useCountUp(target, duration)
  return Math.round(v).toLocaleString('ru-RU').replace(/ /g, ' ')
}
