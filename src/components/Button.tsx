import type { ComponentChildren } from 'preact'

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
export type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps {
  children: ComponentChildren
  variant?: ButtonVariant
  size?: ButtonSize
  disabled?: boolean
  onClick?: (e: Event) => void
  class?: string
  type?: 'button' | 'submit' | 'reset'
  href?: string
  ariaLabel?: string
  title?: string
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  onClick,
  class: className = '',
  type = 'button',
  href,
  ariaLabel,
  title
}: ButtonProps) {
  const classes = [
    'btn',
    `btn-${variant}`,
    size !== 'md' ? `btn-${size}` : '',
    className
  ].filter(Boolean).join(' ')

  if (href) {
    const targetHref = href.startsWith('/')
      ? `${import.meta.env.BASE_URL}${href.slice(1)}`
      : href
    return (
      <a href={targetHref} class={classes} aria-label={ariaLabel} title={title}>
        {children}
      </a>
    )
  }

  return (
    <button type={type} class={classes} disabled={disabled} onClick={onClick} aria-label={ariaLabel} title={title}>
      {children}
    </button>
  )
}
