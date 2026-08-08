/// <reference types="vite-plugin-pwa/client" />

import { Router, Link, Switch, Route, useLocation } from 'wouter'
import { PasswordGate } from './components/PasswordGate'
import { Home } from './pages/Home'
import { LogSession } from './pages/LogSession'
import { Templates } from './pages/Templates'
import { Stats } from './pages/Stats'
import { Settings } from './pages/Settings'
import { icon } from './icons'
import './app.css'

const navItems = [
  { href: '/', label: 'Hem', icon: 'home-icon' },
  { href: '/log', label: 'Logga pass', icon: 'log-icon' },
  { href: '/templates', label: 'Mallar', icon: 'template-icon' },
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
        {navItems.slice(0, 4).map(item => (
          <NavLink key={item.href} href={item.href} label={item.label} icon={item.icon} showLabel />
        ))}
      </nav>
      <div class="sidebar-footer">
        <NavLink href={navItems[4].href} label={navItems[4].label} icon={navItems[4].icon} showLabel />
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
        {navItems.slice(0, 4).map(item => (
          <NavLink key={item.href} href={item.href} label={item.label} icon={item.icon} showLabel={false} />
        ))}
      </nav>
      <div class="rail-footer">
        <NavLink href={navItems[4].href} label={navItems[4].label} icon={navItems[4].icon} showLabel={false} />
      </div>
    </aside>
  )
}

function BottomNav() {
  return (
    <nav class="bottom-nav">
      {navItems.slice(0, 4).map(item => (
        <NavLink key={item.href} href={item.href} label={item.label} icon={item.icon} showLabel={false} />
      ))}
    </nav>
  )
}

function HeaderNav() {
  return (
    <Link href="/settings" class="header-settings">
      <svg width="24" height="24" viewBox="0 0 24 24">
        <use href={icon('settings-icon')} />
      </svg>
    </Link>
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
          <nav class="header-nav">
            {navItems.map(item => (
              <NavLink key={item.href} href={item.href} label={item.label} icon={item.icon} />
            ))}
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