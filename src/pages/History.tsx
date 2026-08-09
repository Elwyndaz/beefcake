import { useState, useEffect, useCallback } from 'preact/hooks'
import { useLocation } from 'wouter'
import { getAllSessions, getAllTemplates, deleteSession } from '../services/dataService'
import { icon } from '../icons'
import { formatDateShort, formatDateWithWeekday, getMonthKey, monthNames, todayISO, parseLocalDate } from '../lib/date'
import { Card } from '../components/Card'
import { Button } from '../components/Button'
import { EmptyState } from '../components/EmptyState'
import { Field } from '../components/Field'
import type { Session, Template } from '../models'

interface FilterState {
  template: string
  period: '30' | '90' | '365' | 'all'
}

const periodLabels: Record<FilterState['period'], string> = {
  '30': 'Senaste 30 dagarna',
  '90': 'Senaste 3 månaderna',
  '365': 'Senaste 12 månaderna',
  'all': 'Alltid'
}

function calculateTotalVolume(session: Session): number {
  return session.exercises.reduce((sum, e) => {
    const exerciseVolume = e.setEntries.reduce((setSum, set) => setSum + (set.weight > 0 ? set.sets * set.reps * set.weight : 0), 0)
    return sum + exerciseVolume
  }, 0)
}

function filterSessions(sessions: Session[], filters: FilterState): Session[] {
  const now = parseLocalDate(todayISO())
  const cutoffDays = filters.period === '30' ? 30 : filters.period === '90' ? 90 : filters.period === '365' ? 365 : null
  
  let cutoffDate: Date | null = null
  if (cutoffDays !== null) {
    cutoffDate = new Date(now)
    cutoffDate.setDate(cutoffDate.getDate() - cutoffDays)
  }

  return sessions.filter(session => {
    if (filters.template !== 'Alla') {
      if (session.templateName !== filters.template) return false
    }
    
    if (cutoffDate) {
      const sessionDate = parseLocalDate(session.date)
      if (sessionDate < cutoffDate) return false
    }
    
    return true
  })
}

function groupSessionsByMonth(sessions: Session[]): Map<string, Session[]> {
  const map = new Map<string, Session[]>()
  for (const session of sessions) {
    const monthKey = getMonthKey(session.date)
    if (!map.has(monthKey)) {
      map.set(monthKey, [])
    }
    map.get(monthKey)!.push(session)
  }
  return map
}

// Custom delete confirmation dialog component
function DeleteDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message
}: {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
}) {
  if (!isOpen) return null

  return (
    <div class="dialog-overlay" onClick={onClose}>
      <div class="dialog" onClick={e => e.stopPropagation()}>
        <div class="flex justify-between items-center mb">
          <h3 class="m-0">{title}</h3>
          <button class="banner-dismiss" onClick={onClose} aria-label="Stäng">
            <svg width="16" height="16" viewBox="0 0 19 19"><use href={icon('x-icon')} /></svg>
          </button>
        </div>
        <p>{message}</p>
        <div class="flex gap mt justify-end">
          <Button variant="secondary" onClick={onClose}>Avbryt</Button>
          <Button variant="danger" onClick={onConfirm}>Radera</Button>
        </div>
      </div>
    </div>
  )
}

// Toast component
function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 3000)
    return () => clearTimeout(timer)
  }, [onDismiss])

  return (
    <div class="toast" onClick={onDismiss}>
      {message}
    </div>
  )
}

// Undo Toast component with action button
function UndoToast({ message, onUndo, onDismiss }: { message: string; onUndo: () => void; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000)
    return () => clearTimeout(timer)
  }, [onDismiss])

  return (
    <div class="toast undo-toast">
      <span>{message}</span>
      <Button variant="secondary" size="sm" class="ml" onClick={onUndo}>Ångra</Button>
      <button class="banner-dismiss" onClick={onDismiss} aria-label="Stäng">
        <svg width="16" height="16" viewBox="0 0 19 19"><use href={icon('x-icon')} /></svg>
      </button>
    </div>
  )
}

export function History() {
  const [, navigate] = useLocation()
  const [allSessions, setAllSessions] = useState<Session[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<FilterState>({
    template: 'Alla',
    period: 'all'
  })
  const [displayCount, setDisplayCount] = useState(50)
  const [deleteDialog, setDeleteDialog] = useState<{ session: Session } | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [deletedSession, setDeletedSession] = useState<Session | null>(null)
  const [showUndoToast, setShowUndoToast] = useState(false)

  // Load data
  async function load() {
    try {
      setLoading(true)
      setError(null)
      const [sessions, ts] = await Promise.all([
        getAllSessions(),
        getAllTemplates()
      ])
      setAllSessions(sessions)
      setTemplates(ts)
    } catch (err) {
      setError('Kunde inte ladda historik. Försök igen.')
      console.error('Fel vid laddning av historik:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  // Auto-dismiss undo toast after 5 seconds
  useEffect(() => {
    if (showUndoToast) {
      const timer = setTimeout(() => {
        setShowUndoToast(false)
        setDeletedSession(null)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [showUndoToast])

  const filteredSessions = filterSessions(allSessions, filters)
  const groupedSessions = groupSessionsByMonth(filteredSessions)
  
  // Sort map by month key descending (newest first)
  const sortedMonthKeys = Array.from(groupedSessions.keys()).sort((a, b) => {
    const parseMonthKey = (key: string) => {
      const [month, year] = key.split(' ')
      const monthIndex = monthNames.findIndex(m => m === month)
      return { year: parseInt(year), month: monthIndex }
    }
    const aKey = parseMonthKey(a)
    const bKey = parseMonthKey(b)
    if (aKey.year !== bKey.year) return bKey.year - aKey.year
    return bKey.month - aKey.month
  })

  // Load more
  const loadMore = useCallback(() => {
    setDisplayCount(prev => prev + 50)
  }, [])

  // All sessions displayed
  const allDisplayed = displayCount >= filteredSessions.length

  // Delete session
  async function handleDelete(session: Session) {
    setDeleteDialog(null)
    try {
      await deleteSession(session.id)
      setDeletedSession(session)
      setAllSessions(prev => prev.filter(s => s.id !== session.id))
      setShowUndoToast(true)
    } catch (err) {
      console.error('Kunde inte radera pass:', err)
    }
  }

  // Restore deleted session
  async function handleUndoDelete() {
    if (!deletedSession) return
    try {
      const { id, date, templateId, templateName, exercises, createdAt } = deletedSession
      const restoredSession: Session = {
        id,
        date,
        templateId,
        templateName,
        exercises: exercises.map(e => ({ ...e })),
        createdAt
      }
      setAllSessions(prev => [...prev, restoredSession].sort((a, b) => b.date.localeCompare(a.date)))
      setShowUndoToast(false)
      setDeletedSession(null)
      setToastMessage(`Pass "${templateName}" (${date}) återställt.`)
    } catch (err) {
      console.error('Kunde inte återställa pass:', err)
    }
  }

  // Navigate to detail
  function goToDetail(sessionId: string) {
    navigate(`/history/${sessionId}`)
  }

  // Filter change handlers
  function handleTemplateChange(e: Event) {
    const target = e.target as HTMLSelectElement
    setFilters({ ...filters, template: target.value })
    setDisplayCount(50)
  }

  function handlePeriodChange(e: Event) {
    const target = e.target as HTMLSelectElement
    setFilters({ ...filters, period: target.value as FilterState['period'] })
    setDisplayCount(50)
  }

  // Template options
  const templateOptions = ['Alla', ...templates.map(t => t.name).sort((a, b) => a.localeCompare(b))]

  // Dismiss toast
  function dismissToast() {
    setToastMessage(null)
  }

  // Render loading state
  if (loading) {
    return (
      <div>
        <h1 class="page-title">Historik</h1>
        <Card class="skeleton skeleton-card"></Card>
      </div>
    )
  }

  // Render error state
  if (error) {
    return (
      <div>
        <h1 class="page-title">Historik</h1>
        <EmptyState
          title="Fel vid laddning"
          message={error}
          action={<Button onClick={load}>Försök igen</Button>}
        />
      </div>
    )
  }

  // Render empty state
  if (filteredSessions.length === 0) {
    return (
      <div>
        <h1 class="page-title">Historik</h1>
        
        <Card>
          <div class="grid grid-2 gap-3">
            <Field label="Passtyp" class="m-0">
              <select value={filters.template} onChange={handleTemplateChange}>
                {templateOptions.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label="Period" class="m-0">
              <select value={filters.period} onChange={handlePeriodChange}>
                {Object.entries(periodLabels).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </Field>
          </div>
        </Card>
        
        <EmptyState
          title="Inga pass matchar filtret"
          message="Prova med andra filterinställningar."
        />
        
        {toastMessage && <Toast message={toastMessage} onDismiss={dismissToast} />}
      </div>
    )
  }

  return (
    <div>
      <h1 class="page-title">Historik</h1>

      {/* Filters */}
      <Card>
        <div class="grid grid-2 gap-3">
          <Field label="Passtyp" class="m-0">
            <select value={filters.template} onChange={handleTemplateChange}>
              {templateOptions.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Period" class="m-0">
            <select value={filters.period} onChange={handlePeriodChange}>
              {Object.entries(periodLabels).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </Field>
        </div>
      </Card>

      {/* Session list */}
      <Card>
        <div class="flex justify-between items-center mb-sm">
          <span class="text-muted">{filteredSessions.length} pass totalt</span>
          <Button href="/log" size="sm">Logga nytt</Button>
        </div>
        
        <div class="history-list-table table-rows">
          {sortedMonthKeys.map(monthKey => {
            const sessionsInMonth = groupedSessions.get(monthKey)!
            const prevCounts = sortedMonthKeys.slice(0, sortedMonthKeys.indexOf(monthKey))
              .reduce((sum, mk) => sum + (groupedSessions.get(mk)?.length || 0), 0)
            
            const startIdx = prevCounts
            const monthSessions = sessionsInMonth.slice(0, Math.max(0, displayCount - startIdx))
            
            if (monthSessions.length === 0) return null
            
            return (
              <div key={monthKey} class="history-month-group">
                <h3 class="history-month-header">{monthKey}</h3>
                <table>
                  <thead>
                    <tr>
                      <th>Datum</th>
                      <th>Pass</th>
                      <th>Övningar</th>
                      <th>Volym</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthSessions.map(session => (
                      <tr key={session.id} onClick={() => goToDetail(session.id)}>
                        <td class="nowrap">{formatDateWithWeekday(session.date)}</td>
                        <td><span class="badge badge-primary">{session.templateName}</span></td>
                        <td>{session.exercises.length}</td>
                        <td class="volume-hero">{calculateTotalVolume(session).toLocaleString('sv-SE')} kg</td>
                        <td class="history-actions">
                          <button 
                            class="btn-remove" 
                            onClick={e => {
                              e.stopPropagation()
                              setDeleteDialog({ session })
                            }}
                            aria-label="Radera"
                          >
                            <svg width="20" height="20" viewBox="0 0 19 19">
                              <use href={icon('x-icon')} />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>

        {/* Session list - Mobile: Cards */}
        <div class="history-list-cards">
          {sortedMonthKeys.map(monthKey => {
            const sessionsInMonth = groupedSessions.get(monthKey)!
            const prevCounts = sortedMonthKeys.slice(0, sortedMonthKeys.indexOf(monthKey))
              .reduce((sum, mk) => sum + (groupedSessions.get(mk)?.length || 0), 0)
            
            const startIdx = prevCounts
            const monthSessions = sessionsInMonth.slice(0, Math.max(0, displayCount - startIdx))
            
            if (monthSessions.length === 0) return null
            
            return (
              <div key={monthKey} class="history-month-group-mobile">
                <h3 class="history-month-header">{monthKey}</h3>
                {monthSessions.map(session => (
                  <div 
                    key={session.id} 
                    class="history-card" 
                    onClick={() => goToDetail(session.id)}
                  >
                    <div class="history-card-header">
                      <span class="history-card-date">{formatDateWithWeekday(session.date)}</span>
                      <span class="badge badge-primary">{session.templateName}</span>
                    </div>
                    <div class="history-card-body">
                      <span>{session.exercises.length} övningar</span>
                      <span class="history-card-volume tabular-nums">{calculateTotalVolume(session).toLocaleString('sv-SE')} kg</span>
                    </div>
                  </div>
                ))}
              </div>
            )
          })}
        </div>

        {/* Load more */}
        {!allDisplayed && (
          <div class="mt">
            <Button variant="secondary" class="btn-block" onClick={loadMore}>
              Visa fler ({filteredSessions.length - displayCount} kvar)
            </Button>
          </div>
        )}
      </Card>

      {/* Delete confirmation dialog */}
      <DeleteDialog
        isOpen={deleteDialog !== null}
        onClose={() => setDeleteDialog(null)}
        onConfirm={() => deleteDialog && handleDelete(deleteDialog.session)}
        title="Radera pass"
        message={`Är du säker på att du vill radera pass "${deleteDialog?.session.templateName}" från ${formatDateShort(deleteDialog?.session.date || '')}?`}
      />

      {/* Undo Toast */}
      {showUndoToast && deletedSession && (
        <UndoToast
          message={`Pass "${deletedSession.templateName}" (${deletedSession.date}) raderat.`}
          onUndo={handleUndoDelete}
          onDismiss={() => {
            setShowUndoToast(false)
            setDeletedSession(null)
          }}
        />
      )}

      {/* Regular Toast */}
      {toastMessage && <Toast message={toastMessage} onDismiss={dismissToast} />}
    </div>
  )
}
