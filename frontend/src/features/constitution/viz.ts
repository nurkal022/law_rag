/** Цвета для canvas и SVG-атрибутов берутся из токенов во время выполнения: литералов в коде нет. */
export function token(name: string): string {
  if (typeof document === 'undefined') return ''
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

/** Токен цвета уровня: 3 — печать ошибки, 2 — предупреждение, 1 — охра, 0 — линия, -1 — не разобрано. */
export function levelToken(level: number): string {
  if (level === 3) return '--err'
  if (level === 2) return '--warn'
  if (level === 1) return '--ochre'
  if (level === 0) return '--rule'
  return '--rule-soft'
}

export function reducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** «12 мин 30 с» из миллисекунд. */
export function fmtDuration(ms: number, min: string, sec: string): string {
  const s = Math.max(0, Math.round(ms / 1000))
  return s >= 60 ? `${Math.floor(s / 60)} ${min} ${String(s % 60).padStart(2, '0')} ${sec}` : `${s} ${sec}`
}
