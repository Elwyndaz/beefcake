import { useEffect, useState } from 'preact/hooks'
import type { ComponentChildren } from 'preact'
import { isCloudSyncConfigured } from '../services/cloudSyncService'
import { syncSeed } from '../services/dataService'
import {
  authErrorMessage, isAuthConfigured, refreshUser, registerWithEmail, resendVerification,
  sendPasswordReset, signInWithEmail, signInWithGoogle, signOutUser, subscribeToAuth, type AuthUser
} from '../services/authService'
import { Button } from './Button'

/**
 * Inloggningen sitter framför hela appen. Utan moln (lokal utveckling) finns ingen
 * grind alls. Med moln kräver Workern en bekräftad e-postadress, eftersom D1-datan
 * ligger under adressen: en obekräftad adress får inte ens se appen.
 */
export function useAuthUser(): AuthUser | null | undefined {
  const [user, setUser] = useState<AuthUser | null | undefined>(isCloudSyncConfigured() ? undefined : null)
  useEffect(() => {
    if (!isCloudSyncConfigured() || !isAuthConfigured()) return
    return subscribeToAuth(setUser)
  }, [])
  return user
}

export function LoginGate({ children }: { children: ComponentChildren }) {
  const user = useAuthUser()
  // Snapshoten hämtas först när Firebase gett en bekräftad användare, med giltig token.
  // Körs om per användare, så ett kontobyte hämtar det nya kontots data.
  const uid = user && user.emailVerified ? user.uid : null
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  useEffect(() => {
    if (!uid) return
    let cancelled = false
    syncSeed()
      .catch(err => console.error('Molnsnapshoten kunde inte hämtas:', err))
      .finally(() => { if (!cancelled) setLoadedFor(uid) })
    return () => { cancelled = true }
  }, [uid])

  if (!isCloudSyncConfigured()) return <>{children}</>
  if (!isAuthConfigured()) return <Shell><p class="login-error">Inloggningen är inte konfigurerad i det här bygget.</p></Shell>
  if (user === undefined) return <Shell><p class="login-subtitle">Laddar…</p></Shell>
  if (user === null) return <Shell><LoginForm /></Shell>
  if (!user.emailVerified) return <Shell><VerifyEmail user={user} /></Shell>
  // Misslyckas hämtningen släpps appen in ändå: synkfelet visas beständigt av CloudSyncStatus
  if (loadedFor !== user.uid) return <Shell><p class="login-subtitle">Hämtar dina pass…</p></Shell>
  return <>{children}</>
}

function Shell({ children }: { children: ComponentChildren }) {
  return (
    <div class="login-gate-container">
      <div class="login-gate-form">
        <h1 class="login-gate-title">Beefcake</h1>
        <p class="login-subtitle">Träningslogg</p>
        {children}
      </div>
    </div>
  )
}

type Mode = 'login' | 'register' | 'reset'

function LoginForm() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function run(action: () => Promise<void>, done?: string) {
    setBusy(true)
    setError(null)
    setInfo(null)
    try {
      await action()
      if (done) setInfo(done)
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  function submit(e: Event) {
    e.preventDefault()
    const address = email.trim()
    if (mode === 'reset') return void run(() => sendPasswordReset(address), 'Ett mejl med återställningslänk är skickat.')
    if (mode === 'register') return void run(() => registerWithEmail(address, password))
    void run(() => signInWithEmail(address, password))
  }

  return (
    <form onSubmit={submit}>
      <Button variant="secondary" class="btn-block mb" disabled={busy} onClick={() => run(signInWithGoogle)}>
        Logga in med Google
      </Button>
      <p class="login-subtitle">eller med e-post</p>
      <input
        type="email"
        class="login-input"
        value={email}
        placeholder="E-post"
        autocomplete="email"
        aria-label="E-post"
        onInput={(e: Event) => setEmail((e.target as HTMLInputElement).value)}
      />
      {mode !== 'reset' && (
        <input
          type="password"
          class="login-input"
          value={password}
          placeholder="Lösenord"
          autocomplete={mode === 'register' ? 'new-password' : 'current-password'}
          aria-label="Lösenord"
          onInput={(e: Event) => setPassword((e.target as HTMLInputElement).value)}
        />
      )}
      {error && <p class="login-error" role="alert">{error}</p>}
      {info && <p class="login-subtitle" role="status">{info}</p>}
      <Button type="submit" class="btn-block" disabled={busy || !email.trim() || (mode !== 'reset' && !password)}>
        {mode === 'register' ? 'Skapa konto' : mode === 'reset' ? 'Skicka återställningslänk' : 'Logga in'}
      </Button>
      <div class="login-links">
        {mode !== 'login' && <button type="button" class="link-button" onClick={() => setMode('login')}>Logga in</button>}
        {mode !== 'register' && <button type="button" class="link-button" onClick={() => setMode('register')}>Skapa konto</button>}
        {mode !== 'reset' && <button type="button" class="link-button" onClick={() => setMode('reset')}>Glömt lösenordet</button>}
      </div>
    </form>
  )
}

function VerifyEmail({ user }: { user: AuthUser }) {
  const [info, setInfo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function check() {
    setError(null)
    try {
      const fresh = await refreshUser()
      if (!fresh?.emailVerified) setInfo('Adressen är inte bekräftad än. Klicka på länken i mejlet först.')
      else window.location.reload()
    } catch (err) {
      setError(authErrorMessage(err))
    }
  }

  return (
    <div>
      <p>Bekräfta <strong>{user.email}</strong> via länken i mejlet från Firebase, sedan är det bara att träna.</p>
      {info && <p class="login-subtitle" role="status">{info}</p>}
      {error && <p class="login-error" role="alert">{error}</p>}
      <Button class="btn-block mb" onClick={check}>Jag har bekräftat</Button>
      <div class="login-links">
        <button type="button" class="link-button" onClick={() => resendVerification().then(() => setInfo('Nytt mejl skickat.')).catch(err => setError(authErrorMessage(err)))}>Skicka mejlet igen</button>
        <button type="button" class="link-button" onClick={() => void signOutUser()}>Logga ut</button>
      </div>
    </div>
  )
}
