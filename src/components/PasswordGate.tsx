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
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: 'var(--bg)',
      color: 'var(--text)',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <form onSubmit={handleSubmit} style={{
        background: 'var(--card)',
        padding: '2rem',
        borderRadius: 'var(--radius)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
        width: '320px',
        textAlign: 'center'
      }}>
        <h1 style={{ marginBottom: '0.25rem' }}>Beefcake</h1>
        <p style={{ color: 'var(--text-muted)', marginTop: 0, marginBottom: '1.5rem' }}>
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
          style={{
            width: '100%',
            padding: '0.65rem 0.75rem',
            border: error ? '2px solid var(--danger)' : '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--bg)',
            color: 'var(--text)',
            fontSize: '1rem',
            marginBottom: '1rem',
            boxSizing: 'border-box' as const
          }}
        />
        {error && (
          <p style={{ color: 'var(--danger)', margin: '0 0 1rem', fontSize: '0.85rem' }}>
            Fel lösenord.
          </p>
        )}
        <button
          type="submit"
          class="btn btn-primary"
          style={{ width: '100%' }}
        >
          Logga in
        </button>
      </form>
    </div>
  )
}
