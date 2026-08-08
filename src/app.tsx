/// <reference types="vite-plugin-pwa/client" />

import { Router, Link, Switch, Route, useLocation } from 'wouter'
import { lazy, Suspense } from 'preact/compat'
import { PasswordGate } from './components/PasswordGate'
import { Home } from './pages/Home'
import { LogSession } from './pages/LogSession'
import { Templates } from './pages/Templates'
import { Settings } from './pages/Settings'
import { History } from './pages/History'
import { SessionDetail } from './pages/SessionDetail'
import { icon } from './icons'
import './app.css'

const Stats = lazy(async () => {
  const m = await import('./pages/Stats')
  return { default: m.Stats }
})

const navItems = [
  { href: '/', label: 'Hem', icon: 'home-icon' },
  { href: '/log', label: 'Logga pass', icon: 'log-icon' },
  { href: '/templates', label: 'Mallar', icon: 'template-icon' },
  { href: '/history', label: 'Historik', icon: 'history-icon' },
  { href: '/stats', label: 'Statistik', icon: 'stats-icon' },
  { href: '/settings', label: 'Inställningar', icon: 'settings-icon' },
]

function NavLink({ href, label, icon: iconId, showLabel = true }: { href: string; label: string; icon: string; showLabel?: boolean }) {
  const [location] = useLocation()
  const isActive = location === href
  return (
    <Link href={href} class={isActive ? 'nav-link active' : 'nav-link'}>
      <svg class="nav-icon" width="24" height="24" viewBox="0 0 24 24">
        <use href={icon(iconId)} />
      </svg>
      {showLabel && <span class="nav-text">{label}</span>}
    </Link>
  )
}

function SidebarNav() {
  return (
    <aside class="sidebar">
      <div class="sidebar-header">
        <span class="sidebar-wordmark">Beefcake</span>
      </div>
      <nav class="sidebar-nav">
        {navItems.slice(0, 5).map(item => (
          <NavLink key={item.href} href={item.href} label={item.label} icon={item.icon} showLabel />
        ))}
      </nav>
      <div class="sidebar-footer">
        <NavLink href={navItems[5].href} label={navItems[5].label} icon={navItems[5].icon} showLabel />
      </div>
    </aside>
  )
}

function RailNav() {
  return (
    <aside class="rail">
      <div class="rail-header">
        <svg class="rail-wordmark" width="24" height="24" viewBox="0 0 24 24">
          <use href={icon('home-icon')} />
        </svg>
      </div>
      <nav class="rail-nav">
        {navItems.slice(0, 5).map(item => (
          <NavLink key={item.href} href={item.href} label={item.label} icon={item.icon} showLabel={false} />
        ))}
      </nav>
      <div class="rail-footer">
        <NavLink href={navItems[5].href} label={navItems[5].label} icon={navItems[5].icon} showLabel={false} />
      </div>
    </aside>
  )
}

function BottomNav() {
  // Mobile bottom nav: Hem, Logga pass, Historik, Statistik (indices 0, 1, 3, 4)
  const mobileNavItems = [navItems[0], navItems[1], navItems[3], navItems[4]]
  return (
    <nav class="bottom-nav">
      {mobileNavItems.map(item => (
        <NavLink key={item.href} href={item.href} label={item.label} icon={item.icon} showLabel={false} />
      ))}
    </nav>
  )
}

function HeaderNav() {
  // Mobile header: Templates (index 2) and Settings (index 5)
  return (
    <div class="header-nav-right flex gap-sm">
      <Link href="/templates" class="header-settings" aria-label="Mallar">
        <svg width="24" height="24" viewBox="0 0 24 24">
          <use href={icon('template-icon')} />
        </svg>
      </Link>
      <Link href="/settings" class="header-settings" aria-label="Inställningar">
        <svg width="24" height="24" viewBox="0 0 24 24">
          <use href={icon('settings-icon')} />
        </svg>
      </Link>
    </div>
  )
}

function AppContent() {
  return (
    <Router base="/beefcake">
      <div class="app">
        <SidebarNav />
        <RailNav />
        <header class="header">
          <h1>Beefcake</h1>
          <HeaderNav />
        </header>
        <main class="main">
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/log" component={LogSession} />
            <Route path="/templates" component={Templates} />
            <Route path="/history" component={History} />
            <Route path="/history/:id" component={SessionDetail} />
            <Route path="/stats" component={() => (
              <Suspense fallback={<div class="card skeleton skeleton-card"></div>}>
                <Stats />
              </Suspense>
            )} />
            <Route path="/settings" component={Settings} />
          </Switch>
        </main>
        <BottomNav />
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