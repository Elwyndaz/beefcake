import type { ComponentChildren } from 'preact'

interface StatProps {
  label: string
  value: ComponentChildren
  trend?: ComponentChildren
  class?: string
}

export function Stat({ label, value, trend, class: className = '' }: StatProps) {
  return (
    <div class={className}>
      <div class="stat-label">{label}</div>
      <div class="stat-value">{value}</div>
      {trend && <div class="stat-trend">{trend}</div>}
    </div>
  )
}
