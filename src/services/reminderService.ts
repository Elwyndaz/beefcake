import { getLatestSessionDate } from './dataService'

export async function checkReminder(): Promise<{ show: boolean; daysSince: number } | null> {
  const latestDate = await getLatestSessionDate()
  if (!latestDate) return null

  const latest = new Date(latestDate)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const diffTime = today.getTime() - latest.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays > 3) {
    return { show: true, daysSince: diffDays }
  }
  return { show: false, daysSince: diffDays }
}

export function formatReminderMessage(daysSince: number): string {
  return `Hej Patrik, du har inte tränat på ${daysSince} dagar. Den jävla latmasken.`
}