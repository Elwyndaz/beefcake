import { MAX_GAP_DAYS } from '../../src/lib/streak'
import { daysBetween } from '../../src/lib/date'

/**
 * Latmask-regeln för mejlet, samma gräns som Cartman: kedjan bryts när glappet är
 * över MAX_GAP_DAYS. Från dag fyra och varje dag därefter skickas ett brev med antalet.
 * Ingen historik alls ger inget brev: den som aldrig tränat ska inte tjatas på.
 *
 * @param sessionDates passdatum YYYY-MM-DD, valfri ordning
 * @param todayISO dagens datum i Europe/Stockholm
 * @returns antal dagar sedan senaste passet om ett brev ska gå, annars null
 */
export function lazyDays(sessionDates: string[], todayISO: string): number | null {
  if (sessionDates.length === 0) return null
  const last = sessionDates.reduce((a, b) => (a > b ? a : b))
  const days = daysBetween(last, todayISO)
  return days > MAX_GAP_DAYS ? days : null
}

/** Dagens datum i Stockholm som YYYY-MM-DD. Cronen går i UTC, brevet ska räkna svenska dagar. */
export function stockholmToday(now: Date): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm' }).format(now)
}
