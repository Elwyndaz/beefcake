import { useState, useEffect, useCallback } from 'preact/hooks'
import { useLocation } from 'wouter'
import { getAllSessions, getAllTemplates, deleteSession } from '../services/dataService'
import { icon } from '../icons'
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

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec']

function formatDateShort(isoDate: string): string {
  const date = new Date(isoDate)
  return `${date.getDate()} ${monthNames[date.getMonth()]} ${date.getFullYear()}`
}

function formatDateWithWeekday(isoDate: string): string {
  const date = new Date(isoDate)
  const weekdayNames = ['Sön', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör']
  return `${weekdayNames[date.getDay()]} ${date.getDate()} ${monthNames[date.getMonth()]} ${date.getFullYear()}`
}

function getMonthKey(date: string): string {
  const d = new Date(date)
  return `${monthNames[d.getMonth()]} ${d.getFullYear()}`
}

function calculateTotalVolume(session: Session): number {
  return session.exercises.reduce((sum, e) => sum + e.sets * e.reps * e.weight, 0)
}

function filterSessions(sessions: Session[], filters: FilterState): Session[] {
  const now = new Date()
  const cutoffDays = filters.period === '30' ? 30 : filters.period === '90' ? 90 : filters.period === '365' ? 365 : null
  
  let cutoffDate: Date | null = null
  if (cutoffDays !== null) {
    cutoffDate = new Date(now)
    cutoffDate.setDate(cutoffDate.getDate() - cutoffDays)
  }

  return sessions.filter(session => {
    // Filter by template name
    if (filters.template !== 'Alla') {
      if (session.templateName !== filters.template) return false
    }
    
    // Filter by period
    if (cutoffDate) {
      const sessionDate = new Date(session.date)
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
          <h3 style="margin: 0;">{title}</h3>
          <button class="banner-dismiss" onClick={onClose} aria-label="Stäng">
            <svg width="16" height="16" viewBox="0 0 19 19"><use href={icon('x-icon')} /></svg>
          </button>
        </div>
        <p>{message}</p>
        <div class="flex gap mt" style="justify-content: flex-end;">
          <button class="btn btn-secondary" onClick={onClose}>Avbryt</button>
          <button class="btn btn-danger" onClick={onConfirm}>Radera</button>
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

export function History() {
  const [, navigate] = useLocation()
  const [allSessions, setAllSessions] = useState<Session[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<FilterState>({
    template: 'Alla',
    period: 'all'
  })
  const [displayCount, setDisplayCount] = useState(50)
  const [deleteDialog, setDeleteDialog] = useState<{ session: Session } | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Load data
  useEffect(() => {
    async function load() {
      const [sessions, templates] = await Promise.all([
        getAllSessions(),
        getAllTemplates()
      ])
      setAllSessions(sessions)
      setTemplates(templates)
      setLoading(false)
    }
    load()
  }, [])

  const filteredSessions = filterSessions(allSessions, filters)
  const groupedSessions = groupSessionsByMonth(filteredSessions)
  
  // Sort map by month key descending (newest first)
  const sortedMonthKeys = Array.from(groupedSessions.keys()).sort((a, b) => {
    // Parse "Month YYYY" format
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
      setAllSessions(prev => prev.filter(s => s.id !== session.id))
      setToastMessage(`Pass "${session.templateName}" (${session.date}) raderat.`)
    } catch (err) {
      console.error('Kunde inte radera pass:', err)
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
        <div class="card">
          <p>Laddar pass...</p>
        </div>
      </div>
    )
  }

  // Render empty state
  if (filteredSessions.length === 0) {
    return (
      <div>
        <h1 class="page-title">Historik</h1>
        
        <div class="card mb">
          <div class="grid grid-2" style="gap: 12px;">
            <div class="input-group" style="margin: 0;">
              <label>Passtyp</label>
              <select value={filters.template} onChange={handleTemplateChange}>
                {templateOptions.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div class="input-group" style="margin: 0;">
              <label>Period</label>
              <select value={filters.period} onChange={handlePeriodChange}>
                {Object.entries(periodLabels).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        
        <div class="card">
          <div class="empty-state">
            <h3>Inga pass matchar filtret</h3>
            <p>Prova med andra filterinställningar.</p>
          </div>
        </div>
        
        {toastMessage && <Toast message={toastMessage} onDismiss={dismissToast} />}
      </div>
    )
  }

  return (
    <div>
      <h1 class="page-title">Historik</h1>

      {/* Filters */}
      <div class="card mb">
        <div class="grid grid-2" style="gap: 12px;">
          <div class="input-group" style="margin: 0;">
            <label>Passtyp</label>
            <select value={filters.template} onChange={handleTemplateChange}>
              {templateOptions.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div class="input-group" style="margin: 0;">
            <label>Period</label>
            <select value={filters.period} onChange={handlePeriodChange}>
              {Object.entries(periodLabels).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Session list - Desktop/Tablet: Table */}
      <div class="card">
        <div class="flex justify-between items-center mb-sm">
          <span>{filteredSessions.length} pass totalt</span>
          <a href="/log" class="btn btn-primary btn-sm">Logga nytt</a>
        </div>
        
        <div class="history-list-table">
          {sortedMonthKeys.map(monthKey => {
            const sessionsInMonth = groupedSessions.get(monthKey)!
            // Limit displayed sessions
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
                      <tr key={session.id} onClick={() => goToDetail(session.id)} class="history-row">
                        <td class="nowrap">{formatDateWithWeekday(session.date)}</td>
                        <td><span class="badge badge-primary">{session.templateName}</span></td>
                        <td>{session.exercises.length}</td>
                        <td class="tabular-nums">{calculateTotalVolume(session).toLocaleString('sv-SE')} kg</td>
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
            <button class="btn btn-secondary" onClick={loadMore} style="width: 100%;">
              Visa fler ({filteredSessions.length - displayCount} kvar)
            </button>
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <DeleteDialog
        isOpen={deleteDialog !== null}
        onClose={() => setDeleteDialog(null)}
        onConfirm={() => deleteDialog && handleDelete(deleteDialog.session)}
        title="Radera pass"
        message={`Är du säker på att du vill radera pass "${deleteDialog?.session.templateName}" från ${formatDateShort(deleteDialog?.session.date || '')}? Det går inte att ångra.`}
      />

      {/* Toast */}
      {toastMessage && <Toast message={toastMessage} onDismiss={dismissToast} />}
    </div>
  )
}
