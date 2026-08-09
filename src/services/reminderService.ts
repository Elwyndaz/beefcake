import { getAllSessions } from './dataService'

function todayLocal(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function dateFromISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export async function checkReminder(): Promise<{ show: boolean; daysSince: number } | null> {
  const sessions = await getAllSessions()
  if (sessions.length === 0) return null

  const latest = dateFromISO(sessions[0].date)
  const today = todayLocal()

  const diffTime = today.getTime() - latest.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays > 3) {
    return { show: true, daysSince: diffDays }
  }
  return { show: false, daysSince: diffDays }
}