import { useState, useEffect } from 'preact/hooks'
import { useLocation } from 'wouter'
import { getAllSessions, getAllTemplates } from '../services/dataService'
import { checkReminder } from '../services/reminderService'
import { formatDateWithWeekday } from '../lib/date'
import { icon } from '../icons'
import type { Session } from '../models'

export function Home() {
  const [, navigate] = useLocation()
  const [recentSessions, setRecentSessions] = useState<Session[]>([])
  const [templateCount, setTemplateCount] = useState(0)
  const [totalSessions, setTotalSessions] = useState(0)
  const [lastWorkout, setLastWorkout] = useState<string | null>(null)
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
      const [sessions, templates] = await Promise.all([
        getAllSessions(),
        getAllTemplates()
      ])
      setRecentSessions(sessions.slice(0, 5))
      setTemplateCount(templates.length)
      setTotalSessions(sessions.length)
      if (sessions.length > 0) {
        setLastWorkout(sessions[0].date)
      }
    } catch (err) {
      setError('Kunde inte ladda data. Försök igen.')
      console.error('Fel vid laddning:', err)
    } finally {
      setLoading(false)
    }
  }

  function formatDate(dateStr: string): string {
    return formatDateWithWeekday(dateStr)
  }

  if (loading) {
    return (
      <div>
        <h1 class="page-title">Översikt</h1>
        <div class="grid grid-3 mb">
          <div class="card skeleton skeleton-card"></div>
          <div class="card skeleton skeleton-card"></div>
          <div class="card skeleton skeleton-card"></div>
        </div>
        <div class="card skeleton skeleton-card"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div class="empty-state">
        <h3>Fel vid laddning</h3>
        <p>{error}</p>
        <button class="btn btn-primary mt" onClick={loadData}>Försök igen</button>
      </div>
    )
  }

  return (
    <div>
      {showReminder && (
        <div class="reminder-banner">
          <span>Du har inte tränat på {showReminder.daysSince} dagar. Den jävla latmasken.</span>
          <button class="banner-dismiss" onClick={dismissReminder} aria-label="Stäng">
            <svg width="16" height="16" viewBox="0 0 19 19"><use href={icon('x-icon')} /></svg>
          </button>
        </div>
      )}
      <h1 class="page-title">Översikt</h1>

      <div class="grid grid-3 mb">
        <div class="card">
          <h3>Totala pass</h3>
          <p class="text-3xl font-bold text-primary">{totalSessions}</p>
        </div>
        <div class="card">
          <h3>Mallar</h3>
          <p class="text-3xl font-bold text-primary">{templateCount}</p>
        </div>
        <div class="card">
          <h3>Senaste pass</h3>
          <p class="text-2xl font-semibold text-primary">
            {lastWorkout ? formatDate(lastWorkout) : '—'}
          </p>
        </div>
      </div>

      <div class="card">
        <div class="flex justify-between items-center mb">
          <h2>Senaste pass</h2>
          <a href="/log" class="btn btn-primary btn-sm">Logga nytt</a>
        </div>

        {recentSessions.length === 0 ? (
          <div class="empty-state">
            <h3>Inga pass loggade än</h3>
            <p>Börja med att skapa en mall och logga ditt första pass.</p>
            <a href="/templates" class="btn btn-primary mt">Skapa mall</a>
          </div>
        ) : (
          <div class="table-wrap">
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
                {recentSessions.map((session) => (
                  <tr 
                    key={session.id} 
                    onClick={() => navigate(`/history/${session.id}`)}
                    class="history-row"
                  >
                    <td>{formatDate(session.date)}</td>
                    <td><span class="badge badge-primary">{session.templateName}</span></td>
                    <td>{session.exercises.length}</td>
                    <td>
                      {session.exercises.reduce((sum, e) => {
                        const exerciseVolume = e.setEntries.reduce((setSum, set) => setSum + (set.sets * set.reps * set.weight), 0)
                        return sum + exerciseVolume
                      }, 0).toLocaleString('sv-SE')} kg
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}