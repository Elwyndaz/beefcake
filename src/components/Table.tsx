import type { ComponentChildren } from 'preact'

interface TableProps {
  children: ComponentChildren
  class?: string
}

export function Table({ children, class: className = '' }: TableProps) {
  return (
    <div class={`table-wrap ${className}`.trim()}>
      <table>{children}</table>
    </div>
  )
}
