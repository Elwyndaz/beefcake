import type { ComponentChildren } from 'preact'

interface FieldProps {
  label: string
  children: ComponentChildren
  error?: string
  class?: string
}

export function Field({ label, children, error, class: className = '' }: FieldProps) {
  return (
    <div class={`input-group ${className}`.trim()}>
      <label>{label}</label>
      {children}
      {error && <div class="field-error">{error}</div>}
    </div>
  )
}
