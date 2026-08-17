/**
 * Antal arbetsset per muskelgrupp och vecka är det mått hypertrofilitteraturen
 * använder, inte tonnage: 1 000 kg vadpress och 1 000 kg marklyft ger samma
 * volymsiffra men helt olika stimulus. Vanlig rekommendation är 10-20 set/vecka.
 */
export type SetLoad = 'low' | 'optimal' | 'high'

export const SET_LOAD_LABELS: Record<SetLoad, string> = {
  low: 'Under',
  optimal: 'Optimalt',
  high: 'Högt'
}

export function classifyWeeklySets(sets: number): SetLoad {
  if (sets < 10) return 'low'
  if (sets <= 20) return 'optimal'
  return 'high'
}
