import { useState, useEffect } from 'preact/hooks'
import { getAllSessions, getLatestSessionDate, getAllTemplates } from '../services/dataService'
import type { Session } from '../models'

export function Home() {
  const [recentSessions, setRecentSessions] = useState<Session[]>([])
  const [templateCount, setTemplateCount] = useState(0)
  const [totalSessions, setTotalSessions] = useState(0)
  const [lastWorkout, setLastWorkout] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
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
    const latest = await getLatestSessionDate()
    if (latest) setLastWorkout(latest)
  }

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  return (
    <div>
      <h1 class="page-title">Översikt</h1>

      <div class="grid grid-3 mb">
        <div class="card">
          <h3>Totala pass</h3>
          <p style="font-size: 2.5rem; font-weight: 700; color: var(--primary);">{totalSessions}</p>
        </div>
        <div class="card">
          <h3>Mallar</h3>
          <p style="font-size: 2.5rem; font-weight: 700; color: var(--primary);">{templateCount}</p>
        </div>
        <div class="card">
          <h3>Senaste pass</h3>
          <p style="font-size: 1.5rem; font-weight: 600; color: var(--primary);">
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
                  <tr key={session.id}>
                    <td>{formatDate(session.date)}</td>
                    <td><span class="badge badge-primary">{session.templateName}</span></td>
                    <td>{session.exercises.length}</td>
                    <td>
                      {session.exercises.reduce((sum, e) => sum + e.sets * e.reps * e.weight, 0).toLocaleString('sv-SE')} kg
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