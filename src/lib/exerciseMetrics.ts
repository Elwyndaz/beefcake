import { setVolume } from './volume'

/** Epley: 1RM = vikt × (1 + reps/30). Bara set på 1 till 10 reps ger ett trovärdigt värde. */
export function epley1RM(weight: number, reps: number): number | null {
  if (weight <= 0 || reps <= 0 || reps > 10) return null
  return weight * (1 + reps / 30)
}

export type ExerciseMetric = 'maxWeight' | 'e1rm' | 'bestSetVolume' | 'sessionVolume'

export const EXERCISE_METRIC_LABELS: Record<ExerciseMetric, string> = {
  maxWeight: 'Tyngsta set',
  e1rm: 'Estimerat 1RM',
  bestSetVolume: 'Bästa setvolym',
  sessionVolume: 'Passvolym'
}

interface HistoryLike {
  setEntries: { weight: number; reps: number; sets?: number }[]
  volume: number
}

/** Ett tal per genomförande för övningsgrafen. null när måttet inte går att räkna (e1RM utan tunga set). */
export function sessionMetric(h: HistoryLike, metric: ExerciseMetric): number | null {
  switch (metric) {
    case 'maxWeight':
      return h.setEntries.reduce((m, s) => Math.max(m, s.weight), 0)
    case 'e1rm':
      return h.setEntries.reduce<number | null>((m, s) => {
        const v = epley1RM(s.weight, s.reps)
        return v === null ? m : Math.max(m ?? 0, v)
      }, null)
    case 'bestSetVolume':
      return h.setEntries.reduce((m, s) => Math.max(m, setVolume({ sets: 1, reps: s.reps, weight: s.weight })), 0)
    case 'sessionVolume':
      return h.volume
  }
}

export const RECORD_REPS = [1, 3, 5, 8, 10, 12] as const

/**
 * Rekord per repsantal: tyngsta vikten lyft för minst N reps, med datum.
 * "Minst" är den vanliga definitionen av ett N-repsmax: 10 reps på 80 kg räknas också som 8RM.
 */
export function repRecords(
  history: { date: string; setEntries: { weight: number; reps: number }[] }[],
  reps: readonly number[] = RECORD_REPS
): { reps: number; weight: number; date: string }[] {
  const out: { reps: number; weight: number; date: string }[] = []
  for (const n of reps) {
    let best: { weight: number; date: string } | null = null
    for (const h of history) {
      for (const s of h.setEntries) {
        if (s.reps >= n && s.weight > 0 && (!best || s.weight > best.weight)) best = { weight: s.weight, date: h.date }
      }
    }
    if (best) out.push({ reps: n, ...best })
  }
  return out
}
