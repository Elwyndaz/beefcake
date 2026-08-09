import type { ComponentChildren } from 'preact'

interface StatProps {
  label: string
  value: ComponentChildren
  sub?: ComponentChildren
  class?: string
}

export function Stat({ label, value, sub, class: className = '' }: StatProps) {
  return (
    <div class={`stat ${className}`.trim()}>
      <div class="stat-label">{label}</div>
      <div class="stat-value font-numeric">{value}</div>
      {sub && <div class="stat-trend">{sub}</div>}
    </div>
  )
}
