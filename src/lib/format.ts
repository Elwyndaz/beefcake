/** Vikt med svensk notation: decimalkomma, mellanslag som tusentalsavgränsare. */
export function formatWeight(kg: number): string {
  return kg.toLocaleString('sv-SE', { maximumFractionDigits: 2 })
}

/** Ett set som text: "82,5 kg × 8". Vikt 0 betyder kroppsvikt eller kondition. */
export function formatSet(set: { weight: number; reps: number }): string {
  return set.weight > 0 ? `${formatWeight(set.weight)} kg × ${set.reps}` : `${set.reps} reps`
}

/** Flera set på en rad: "82,5 kg × 8, 82,5 kg × 8, 82,5 kg × 7". */
export function formatSets(sets: { weight: number; reps: number }[]): string {
  return sets.map(formatSet).join(', ')
}
