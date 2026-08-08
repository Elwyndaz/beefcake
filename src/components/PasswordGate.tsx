import { useState, useEffect } from 'preact/hooks'
import type { ComponentChildren } from 'preact'
import { AUTH_HASH, AUTH_KEY } from '../config'

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

export function PasswordGate({ children }: Props) {
  const [unlocked, setUnlocked] = useState(() => !!sessionStorage.getItem(AUTH_KEY))
  const [input, setInput] = useState('')
  const [error, setError] = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem(AUTH_KEY)) {
      setUnlocked(true)
    }
  }, [])

  async function handleSubmit(e: Event) {
    e.preventDefault()
    const hash = await hashPassword(input)
    if (hash === AUTH_HASH) {
      sessionStorage.setItem(AUTH_KEY, '1')
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
          class={error ? 'password-input password-input-error' : 'password-input'}
        />
        {error && (
          <p class="password-error">
            Fel lösenord.
          </p>
        )}
        <button
          type="submit"
          class="btn btn-primary btn-block"
        >
          Logga in
        </button>
      </form>
    </div>
  )
}
