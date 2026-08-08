import { Router } from 'preact-router'
import { useEffect } from 'preact/hooks'
import { registerSW } from 'virtual:pwa-register'
import { checkReminder } from './services/reminderService'
import { Home } from './pages/Home'
import { LogSession } from './pages/LogSession'
import { Templates } from './pages/Templates'
import { Stats } from './pages/Stats'
import { Settings } from './pages/Settings'
import './app.css'

registerSW({ onNeedRefresh: () => true, onOfflineReady: () => {} })

export function App() {
  useEffect(() => {
    checkReminder().then(res => {
      if (res?.show) {
        setTimeout(() => alert(`Hej Patrik, du har inte tränat på ${res.daysSince} dagar. Den jävla latmasken.`), 1000)
      }
    })
  }, [])

  return (
    <div class="app">
      <header class="header">
        <h1>Beefcake</h1>
        <nav>
          <a href="/">Hem</a>
          <a href="/log">Logga pass</a>
          <a href="/templates">Mallar</a>
          <a href="/stats">Statistik</a>
          <a href="/settings">Inställningar</a>
        </nav>
      </header>
      <main class="main">
        <Router>
          <Home path="/" />
          <LogSession path="/log" />
          <Templates path="/templates" />
          <Stats path="/stats" />
          <Settings path="/settings" />
        </Router>
      </main>
    </div>
  )
}