import { useState, useEffect } from 'preact/hooks'
import { useLocation } from 'wouter'
import { getAllSessions, getAllTemplates } from '../services/dataService'
import { checkReminder } from '../services/reminderService'
import { formatDateWithWeekday } from '../lib/date'
import { icon } from '../icons'
import { Card } from '../components/Card'
import { Button } from '../components/Button'
import { Stat } from '../components/Stat'
import { EmptyState } from '../components/EmptyState'
import type { Session, Template } from '../models'

export function Home() {
  const [, navigate] = useLocation()
  const [recentSessions, setRecentSessions] = useState<Session[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [templateCount, setTemplateCount] = useState(0)
  const [totalSessions, setTotalSessions] = useState(0)
  const [lastWorkout, setLastWorkout] = useState<string | null>(null)
  const [lastUsedTemplate, setLastUsedTemplate] = useState<string | null>(null)
  const [showReminder, setShowReminder] = useState<{ show: boolean; daysSince: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadData()
    checkReminder().then(res => {
      if (res?.show) {
        const dismissed = sessionStorage.getItem('beefcake-reminder-dismissed')
        if (!dismissed) {
          setShowReminder({ show: true, daysSince: res.daysSince })
        }
      }
    })
  }, [])

  function dismissReminder() {
    sessionStorage.setItem('beefcake-reminder-dismissed', '1')
    setShowReminder(null)
  }

  async function loadData() {
    try {
      setLoading(true)
      setError(null)
      const [sessions, ts] = await Promise.all([
        getAllSessions(),
        getAllTemplates()
      ])
      setTemplates(ts)
      setRecentSessions(sessions.slice(0, 5))
      setTemplateCount(ts.length)
      setTotalSessions(sessions.length)
      if (sessions.length > 0) {
        setLastWorkout(sessions[0].date)
        setLastUsedTemplate(sessions[0].templateName)
      }
    } catch (err) {
      setError('Kunde inte ladda data. Försök igen.')
      console.error('Fel vid laddning:', err)
    } finally {
      setLoading(false)
    }
  }

  function handleQuickLog() {
    if (lastUsedTemplate) {
      navigate(`/log?template=${encodeURIComponent(lastUsedTemplate)}`)
    } else if (templates.length > 0) {
      navigate(`/log?template=${encodeURIComponent(templates[0].name)}`)
    } else {
      navigate('/log')
    }
  }

  if (loading) {
    return (
      <div>
        <h1 class="page-title">Översikt</h1>
        <Card class="skeleton skeleton-card mb"></Card>
        <div class="grid grid-3 mb">
          <Card class="skeleton skeleton-card"></Card>
          <Card class="skeleton skeleton-card"></Card>
          <Card class="skeleton skeleton-card"></Card>
        </div>
        <Card class="skeleton skeleton-card"></Card>
      </div>
    )
  }

  if (error) {
    return (
      <EmptyState
        title="Fel vid laddning"
        message={error}
        action={<Button onClick={loadData}>Försök igen</Button>}
      />
    )
  }

  return (
    <div>
      {showReminder && (
        <div class="reminder-banner">
          <span class="flex items-center gap-2 flex-1">
            <svg width="20" height="20" viewBox="0 0 24 24" class="text-danger">
              <path fill="currentColor" d="M12 2L1 21h20L12 2zm0 3.23L19.39 20H4.61L12 5.23zM12 12.77L14.14 17h-4.28L12 12.77z"/>
            </svg>
            <span>Du har inte tränat på {showReminder.daysSince} dagar. Den jävla latmasken.</span>
          </span>
          <button class="banner-dismiss" onClick={dismissReminder} aria-label="Stäng">
            <svg width="16" height="16" viewBox="0 0 19 19"><use href={icon('x-icon')} /></svg>
          </button>
        </div>
      )}
      <h1 class="page-title">Översikt</h1>

      <Card>
        <h2 class="m-0 mb-sm">Nästa pass</h2>
        <Button size="lg" class="btn-block" onClick={handleQuickLog}>
          {lastUsedTemplate ? `Kör "${lastUsedTemplate}" igen` : templates.length > 0 ? `Logga nytt pass` : `Skapa mall först`}
        </Button>
      </Card>

      <div class="grid grid-3 mb">
        <Card padding="sm">
          <Stat label="Totala pass" value={totalSessions} />
        </Card>
        <Card padding="sm">
          <Stat label="Mallar" value={templateCount} />
        </Card>
        <Card padding="sm">
          <Stat
            label="Senaste pass"
            value={lastWorkout ? formatDateWithWeekday(lastWorkout) : '—'}
          />
        </Card>
      </div>

      <Card padding="none">
        <div class="flex justify-between items-center mb-sm" style="padding: var(--space-6) var(--space-6) var(--space-2) var(--space-6)">
          <h2 class="m-0">Senaste pass</h2>
          <Button href="/log" variant="secondary" size="sm">Logga nytt</Button>
        </div>

        {recentSessions.length === 0 ? (
          <EmptyState
            title="Inga pass loggade ännu"
            message="Börja med att skapa en mall och logga ditt första pass."
            action={<Button href="/templates">Skapa mall</Button>}
          />
        ) : (
          <div class="table-wrap table-rows" style="padding: 0 var(--space-6) var(--space-6) var(--space-6)">
            <table>
              <thead>
                <tr>
                  <th>Datum</th>
                  <th>Pass</th>
                  <th>Övningar</th>
                  <th>Total volym</th>
                </tr>
              </thead>
              <tbody>
                {recentSessions.map((session) => {
                  const sessionVolume = session.exercises.reduce((sum, e) => {
                    const exerciseVolume = e.setEntries.reduce((setSum, set) => setSum + (set.sets * set.reps * set.weight), 0)
                    return sum + exerciseVolume
                  }, 0)
                  return (
                    <tr
                      key={session.id}
                      onClick={() => navigate(`/history/${session.id}`)}
                    >
                      <td>{formatDateWithWeekday(session.date)}</td>
                      <td><span class="badge badge-primary">{session.templateName}</span></td>
                      <td>{session.exercises.length}</td>
                      <td class="volume-hero">{sessionVolume.toLocaleString('sv-SE')} kg</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
