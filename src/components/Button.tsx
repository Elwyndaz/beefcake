import type { ComponentChildren } from 'preact'

interface ButtonProps {
  children: ComponentChildren
  variant?: 'primary' | 'secondary' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  onClick?: (e: Event) => void
  class?: string
  type?: 'button' | 'submit' | 'reset'
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  onClick,
  class: className = '',
  type = 'button'
}: ButtonProps) {
  const variantClasses = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    danger: 'btn-danger'
  }
  const sizeClasses = {
    sm: 'btn-sm',
    md: '',
    lg: 'btn-lg'
  }

  const classes = [
    'btn',
    variantClasses[variant],
    sizeClasses[size],
    className
  ].filter(Boolean).join(' ')

  return (
    <button
      type={type}
      class={classes}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
