import type { ComponentChildren } from 'preact'

export type CardPadding = 'none' | 'sm' | 'md' | 'lg'

interface CardProps {
  children?: ComponentChildren
  padding?: CardPadding
  class?: string
  title?: string
}

const PADDING_CLASS: Record<CardPadding, string> = {
  none: 'padding-none',
  sm: 'padding-sm',
  md: '',
  lg: 'padding-lg'
}

export function Card({ children, padding = 'md', class: className = '', title }: CardProps) {
  const classes = ['card', PADDING_CLASS[padding], className].filter(Boolean).join(' ')

  return (
    <div class={classes}>
      {title && <h3 class="card-title">{title}</h3>}
      {children}
    </div>
  )
}
