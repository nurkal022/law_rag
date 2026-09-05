import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode, TableHTMLAttributes } from 'react'

/* ---------- Чип-фильтр ---------- */
interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
}
export function Chip({ active, className, ...rest }: ChipProps) {
  const cls = ['chip', active ? 'chip--on' : '', className ?? ''].filter(Boolean).join(' ')
  return <button type="button" className={cls} aria-pressed={active} {...rest} />
}

/* ---------- Статус ---------- */
export type StatusKind = 'ok' | 'warn' | 'err' | 'idle'
export function Status({ kind, children }: { kind: StatusKind; children: ReactNode }) {
  return <span className={`status status--${kind}`}>{children}</span>
}

/* ---------- Линия ---------- */
export function Rule({ soft }: { soft?: boolean }) {
  return <hr className={soft ? 'rule rule--soft' : 'rule'} />
}

/* ---------- Таблица ----------
   Реестры набираются таблицей, а не карточками: плотнее и честнее для списка. */
export function Table({ className, ...rest }: TableHTMLAttributes<HTMLTableElement>) {
  return <table className={['table', className ?? ''].filter(Boolean).join(' ')} {...rest} />
}

/** Название документа в строке реестра — антиквой, как смысловой текст. */
export function TableTitle({ children }: { children: ReactNode }) {
  return <span className="table__title">{children}</span>
}

/* ---------- Вкладки ---------- */
export interface TabItem {
  id: string
  label: ReactNode
}
export function Tabs({
  items,
  value,
  onChange,
}: {
  items: TabItem[]
  value: string
  onChange: (id: string) => void
}) {
  return (
    <div className="tabs" role="tablist">
      {items.map((it) => (
        <button
          key={it.id}
          role="tab"
          type="button"
          aria-selected={it.id === value}
          className={['tabs__item', it.id === value ? 'tabs__item--on' : ''].filter(Boolean).join(' ')}
          onClick={() => onChange(it.id)}
        >
          {it.label}
        </button>
      ))}
    </div>
  )
}

/* ---------- Пустое состояние ----------
   Обязательно для каждого списка: пустая библиотека, ноль результатов,
   недоступная модель. Всегда объясняет, что делать дальше. */
export function Empty({
  title,
  children,
  action,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { title: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty" {...rest}>
      <div className="empty__title">{title}</div>
      {children ? <div className="empty__body t-body">{children}</div> : null}
      {action}
    </div>
  )
}
