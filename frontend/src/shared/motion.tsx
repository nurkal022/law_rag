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

    /**
     * Страховка. До появления блок скрыт, поэтому любой сбой наблюдателя
     * означает не «нет анимации», а «содержимого нет вообще». Так и случается
     * в headless-снимках с виртуальным временем. Через полторы секунды
     * показываем безусловно: лучше показать без движения, чем не показать.
     */
    const failsafe = window.setTimeout(() => {
      setShown(true)
      io.disconnect()
    }, 1500)

    return () => {
      window.clearTimeout(failsafe)
      io.disconnect()
    }
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
    let done = false
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      // Тот же выкат без отскока, что и у --ease-out в токенах
      const eased = 1 - Math.pow(1 - p, 3)
      setValue(target * eased)
      if (p < 1) raf = requestAnimationFrame(tick)
      else done = true
    }
    raf = requestAnimationFrame(tick)

    /**
     * Страховка. Если кадры отрисовки не идут — вкладка в фоне, снимок в
     * headless, экономия энергии — счёт замирает на промежуточном значении,
     * и человек видит «0 комментариев» вместо 1247. Это уже не потеря
     * анимации, а ложные данные, поэтому по истечении срока ставим точное
     * значение безусловно.
     */
    const failsafe = window.setTimeout(() => {
      if (!done) {
        cancelAnimationFrame(raf)
        setValue(target)
      }
    }, duration + 400)

    return () => {
      window.clearTimeout(failsafe)
      cancelAnimationFrame(raf)
    }
  }, [target, duration])

  return value
}

/** Целое с пробелом-разделителем разрядов: 1 247. */
export function useCountUpInt(target: number, duration?: number) {
  const v = useCountUp(target, duration)
  return Math.round(v).toLocaleString('ru-RU').replace(/ /g, ' ')
}
