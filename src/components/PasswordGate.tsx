import { useState, useEffect } from 'preact/hooks'
import type { ComponentChildren } from 'preact'
import { AUTH_HASH, AUTH_KEY } from '../config'
import { Button } from './Button'

async function hashPassword(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

interface Props {
  children: ComponentChildren
}

// Låset sitter i localStorage, inte sessionStorage: grinden ska hålla borta
// nyfikna på en delad länk, inte tvinga fram lösenordet i varje ny flik.
function isUnlocked(): boolean {
  try {
    return localStorage.getItem(AUTH_KEY) === '1' || sessionStorage.getItem(AUTH_KEY) === '1'
  } catch {
    return false
  }
}

export function PasswordGate({ children }: Props) {
  const [unlocked, setUnlocked] = useState(isUnlocked)
  const [input, setInput] = useState('')
  const [error, setError] = useState(false)

  useEffect(() => {
    if (isUnlocked()) setUnlocked(true)
  }, [])

  async function handleSubmit(e: Event) {
    e.preventDefault()
    const hash = await hashPassword(input)
    if (hash === AUTH_HASH) {
      try {
        localStorage.setItem(AUTH_KEY, '1')
      } catch {
        sessionStorage.setItem(AUTH_KEY, '1')
      }
      setUnlocked(true)
    } else {
      setError(true)
      setInput('')
    }
  }

  if (unlocked) {
    return <>{children}</>
  }

  return (
    <div class="password-gate-container">
      <form onSubmit={handleSubmit} class="password-gate-form">
        <h1 class="password-gate-title">Beefcake</h1>
        <p class="password-gate-subtitle">
          Träningslogg
        </p>
        <input
          type="password"
          value={input}
          onInput={(e: Event) => {
            setInput((e.target as HTMLInputElement).value)
            setError(false)
          }}
          placeholder="Lösenord"
          autoFocus
          aria-label="Lösenord"
          class={error ? 'password-input password-input-error' : 'password-input'}
        />
        {error && (
          <p class="password-error">
            Fel lösenord.
          </p>
        )}
        <Button type="submit" class="btn-block">
          Öppna träningsloggen
        </Button>
      </form>
    </div>
  )
}