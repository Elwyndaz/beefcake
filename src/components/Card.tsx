import type { ComponentChildren } from 'preact'

interface CardProps {
  children: ComponentChildren
  padding?: 'none' | 'sm' | 'md' | 'lg'
  class?: string
}

export function Card({
  children,
  padding = 'md',
  class: className = ''
}: CardProps) {
  const paddingClasses = {
    none: 'padding-none',
    sm: 'padding-sm',
    md: '',
    lg: 'padding-lg'
  }

  const classes = [
    'card',
    paddingClasses[padding],
    className
  ].filter(Boolean).join(' ')

  return (
    <div class={classes}>
      {children}
    </div>
  )
}
