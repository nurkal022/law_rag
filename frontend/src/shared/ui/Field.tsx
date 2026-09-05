import { useId } from 'react'
import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  ReactNode,
} from 'react'
import { Label, Caption } from './Text'

interface Common {
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
}

function Wrapper({
  id,
  label,
  hint,
  error,
  children,
}: Common & { id: string; children: ReactNode }) {
  return (
    <div className="field">
      {label ? (
        <Label as="label" htmlFor={id} className="field__label">
          {label}
        </Label>
      ) : null}
      {children}
      {error ? (
        <Caption className="field__hint field__hint--err" role="alert">
          {error}
        </Caption>
      ) : hint ? (
        <Caption tone="mute" className="field__hint">
          {hint}
        </Caption>
      ) : null}
    </div>
  )
}

export function Input({
  label,
  hint,
  error,
  className,
  ...rest
}: Common & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId()
  return (
    <Wrapper id={id} label={label} hint={hint} error={error}>
      <input
        id={id}
        className={['field__control', className ?? ''].filter(Boolean).join(' ')}
        aria-invalid={error ? true : undefined}
        {...rest}
      />
    </Wrapper>
  )
}

export function Textarea({
  label,
  hint,
  error,
  className,
  ...rest
}: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId()
  return (
    <Wrapper id={id} label={label} hint={hint} error={error}>
      <textarea
        id={id}
        className={['field__control', 'field__control--area', className ?? ''].filter(Boolean).join(' ')}
        aria-invalid={error ? true : undefined}
        {...rest}
      />
    </Wrapper>
  )
}

export function Select({
  label,
  hint,
  error,
  className,
  children,
  ...rest
}: Common & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId()
  return (
    <Wrapper id={id} label={label} hint={hint} error={error}>
      <select
        id={id}
        className={['field__control', className ?? ''].filter(Boolean).join(' ')}
        aria-invalid={error ? true : undefined}
        {...rest}
      >
        {children}
      </select>
    </Wrapper>
  )
}
