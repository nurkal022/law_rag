import { Input, Select, Textarea } from '../../shared/ui'
import type { PassportField } from './types'

/**
 * Поле формы по описанию из паспорта типа.
 *
 * Паспорт задаёт вид поля строкой, а не разметкой, — иначе каждый новый тип
 * документа требовал бы правки экрана. Здесь единственное место, где вид
 * превращается в элемент управления, и оно общее для договоров и
 * законопроектов: разошедшиеся копии дали бы ИИН в двенадцать цифр в одном
 * модуле и без ограничения в другом.
 */
export function FieldControl({
  field,
  value,
  error,
  onChange,
  onBlur,
}: {
  field: PassportField
  value: string
  error?: string
  onChange: (v: string) => void
  onBlur: () => void
}) {
  const label = field.unit ? `${field.label}, ${field.unit}` : field.label
  const hint = field.hint ?? undefined

  if (field.type === 'textarea') {
    return (
      <div className="ct-grid__wide">
        <Textarea
          label={label}
          hint={hint}
          error={error}
          onBlur={onBlur}
          placeholder={field.placeholder ?? undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    )
  }
  if (field.type === 'select') {
    return (
      <Select
        label={label}
        hint={hint}
        error={error}
        onBlur={onBlur}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">—</option>
        {field.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    )
  }

  const isId = field.type === 'iin' || field.type === 'bin' || field.type === 'iin_bin'
  return (
    <Input
      label={label}
      hint={hint}
      error={error}
      onBlur={onBlur}
      placeholder={field.placeholder ?? undefined}
      type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'}
      inputMode={isId ? 'numeric' : field.type === 'money' ? 'decimal' : undefined}
      maxLength={isId ? 12 : undefined}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

const ID_RE = /^\d{12}$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Сообщения проверки: экран подставляет свои переводы, правила одни. */
export interface FieldMessages {
  required: string
  digits12: string
  number: string
  date: string
}

/**
 * Проверка одного значения по виду поля из паспорта. Возвращает сообщение или
 * пустую строку. Вынесено сюда, потому что правила диктует паспорт, а не
 * конкретный экран: ИИН в двенадцать цифр остаётся таким и в законопроекте.
 */
export function validateField(
  value: string,
  type: string,
  required: boolean,
  msg: FieldMessages,
): string {
  const v = (value ?? '').trim()
  if (required && !v) return msg.required
  if (!v) return ''
  if (type === 'iin' || type === 'bin' || type === 'iin_bin') {
    return ID_RE.test(v) ? '' : msg.digits12
  }
  if (type === 'number' || type === 'money') {
    return Number.isFinite(Number(v.replace(/\s/g, '').replace(',', '.'))) ? '' : msg.number
  }
  if (type === 'date') {
    return DATE_RE.test(v) ? '' : msg.date
  }
  return ''
}
