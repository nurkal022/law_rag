import type { CSSProperties } from 'react'
import type { Counts } from './types'

/**
 * Полоса долей уровней: слева высокий риск, справа — без признаков.
 * Ширины задаются разметкой, цвета — классами на токенах (constitution.css).
 */
export function LevelBar({ counts, total, className }: { counts: Counts | undefined; total: number; className?: string }) {
  const c = counts ?? { '0': 0, '1': 0, '2': 0, '3': 0, errors: 0 }
  const denom = Math.max(1, total)
  const seg = (k: keyof Counts) => ({ width: `${(100 * (c[k] ?? 0)) / denom}%` }) as CSSProperties
  return (
    <div className={['lvbar', className ?? ''].filter(Boolean).join(' ')} aria-hidden="true">
      <span className="lvbar__seg lv--3" style={seg('3')} />
      <span className="lvbar__seg lv--2" style={seg('2')} />
      <span className="lvbar__seg lv--1" style={seg('1')} />
      <span className="lvbar__seg lv--0" style={seg('0')} />
      <span className="lvbar__seg lv--x" style={seg('errors')} />
    </div>
  )
}
