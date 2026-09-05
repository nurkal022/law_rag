import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { UIText } from './Text'

/* ---------- Индикатор загрузки ----------
   Не спиннер: тонкая пульсирующая линия — набор строки, а не вращение. */
export function Loading({ label }: { label?: string }) {
  return (
    <div role="status" aria-label={label ?? 'Загрузка'}>
      <div className="loading">
        <div className="loading__bar" />
      </div>
    </div>
  )
}

/** Курсор набора — показывается в конце ответа, пока идёт стриминг. */
export function Caret() {
  return <span className="caret" aria-hidden="true" />
}

/** Скелет строки. width — доля или значение CSS. */
export function Skeleton({ width = '100%', height = 12 }: { width?: string | number; height?: number }) {
  const style: CSSProperties = { width, height }
  return <div className="skeleton" style={style} aria-hidden="true" />
}

/* ---------- Уведомления ---------- */
type ToastKind = 'info' | 'ok' | 'err'
interface Toast {
  id: number
  kind: ToastKind
  text: string
}

const ToastCtx = createContext<(text: string, kind?: ToastKind) => void>(() => {})

export function useToast() {
  return useContext(ToastCtx)
}

export function ToastHost({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([])

  const push = useCallback((text: string, kind: ToastKind = 'info') => {
    const id = Date.now() + Math.random()
    setItems((prev) => [...prev, { id, kind, text }])
    window.setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id))
    }, 4500)
  }, [])

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const value = useMemo(() => push, [push])

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={['toast', t.kind !== 'info' ? `toast--${t.kind}` : ''].filter(Boolean).join(' ')}>
            <UIText>{t.text}</UIText>
            <button className="toast__close" onClick={() => dismiss(t.id)} aria-label="Закрыть">
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}
