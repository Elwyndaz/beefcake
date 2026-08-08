/// <reference types="vite-plugin-pwa/client" />

import { Router, Link, Switch, Route, useLocation as useWouterLocation } from 'wouter'
import { useEffect } from 'preact/hooks'
import { PasswordGate } from './components/PasswordGate'
import { checkReminder } from './services/reminderService'
import { Home } from './pages/Home'
import { LogSession } from './pages/LogSession'
import { Templates } from './pages/Templates'
import { Stats } from './pages/Stats'
import { Settings } from './pages/Settings'
import './app.css'

const BASE_PATH = '/beefcake'

function useBeefcakeLocation() {
  const [path, navigate] = useWouterLocation()
  const realPath = path.startsWith(BASE_PATH) ? path.slice(BASE_PATH.length) : path
  const realNavigate = (to: string, options?: { replace?: boolean }) => {
    const fullPath = BASE_PATH + (to.startsWith('/') ? to : `/${to}`)
    return navigate(fullPath, options)
  }
  return [realPath, realNavigate] as [string, typeof navigate]
}

function NavLink({ href, children }: { href: string; children: string }) {
  const [location] = useBeefcakeLocation()
  const isActive = location === href
  return (
    <Link
      href={href}
      class={isActive ? 'nav-link active' : 'nav-link'}
    >
      {children}
    </Link>
  )
}

function AppContent() {
  useEffect(() => {
    checkReminder().then(res => {
      if (res?.show) {
        setTimeout(() => alert(`Hej Patrik, du har inte tränat på ${res.daysSince} dagar. Den jävla latmasken.`), 1000)
      }
    })
  }, [])

  return (
    <Router hook={useBeefcakeLocation}>
      <div class="app">
        <header class="header">
          <h1>Beefcake</h1>
          <nav>
            <NavLink href="/">Hem</NavLink>
            <NavLink href="/log">Logga pass</NavLink>
            <NavLink href="/templates">Mallar</NavLink>
            <NavLink href="/stats">Statistik</NavLink>
            <NavLink href="/settings">Inställningar</NavLink>
          </nav>
        </header>
        <main class="main">
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/log" component={LogSession} />
            <Route path="/templates" component={Templates} />
            <Route path="/stats" component={Stats} />
            <Route path="/settings" component={Settings} />
          </Switch>
        </main>
      </div>
    </Router>
  )
}

export function App() {
  return (
    <PasswordGate>
      <AppContent />
    </PasswordGate>
  )
}