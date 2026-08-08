import type { ComponentChildren } from 'preact'

interface EmptyStateProps {
  title: string
  message: string
  action?: ComponentChildren
  class?: string
}

export function EmptyState({ title, message, action, class: className = '' }: EmptyStateProps) {
  return (
    <div class={`empty-state ${className}`.trim()}>
      <h3>{title}</h3>
      <p>{message}</p>
      {action && <div class="mt">{action}</div>}
    </div>
  )
}
