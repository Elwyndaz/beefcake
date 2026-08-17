/**
 * Volymberäkning på ett ställe. Formeln fanns i nio kopior i sex filer, vilket är
 * så en regel som "vikt 0 räknas inte" tappas bort i en av dem.
 */

interface VolumeSet {
  sets?: number
  reps: number
  weight: number
}

/** Vikt 0 betyder kroppsvikt eller kondition och ger ingen tonnagevolym. */
export function setVolume(set: VolumeSet): number {
  return set.weight > 0 ? (set.sets ?? 1) * set.reps * set.weight : 0
}

export function setsVolume(sets: VolumeSet[]): number {
  return sets.reduce((sum, set) => sum + setVolume(set), 0)
}

export function exercisesVolume(exercises: { setEntries: VolumeSet[] }[]): number {
  return exercises.reduce((sum, e) => sum + setsVolume(e.setEntries), 0)
}
