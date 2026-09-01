/** Vikt med svensk notation: decimalkomma, mellanslag som tusentalsavgränsare. */
export function formatWeight(kg: number): string {
  return kg.toLocaleString('sv-SE', { maximumFractionDigits: 2 })
}

/** Ett set som text: "82,5 kg × 8", med "@8" efter när RPE finns. Vikt 0 betyder kroppsvikt eller kondition. */
export function formatSet(set: { weight: number; reps: number; rpe?: number }): string {
  const base = set.weight > 0 ? `${formatWeight(set.weight)} kg × ${set.reps}` : `${set.reps} reps`
  return set.rpe ? `${base} @${formatWeight(set.rpe)}` : base
}

/** Kompakt set för trånga celler: "27,5×10", kroppsvikt "12 reps". */
export function formatSetCompact(set: { weight: number; reps: number }): string {
  return set.weight > 0 ? `${formatWeight(set.weight)}×${set.reps}` : `${set.reps} reps`
}

/** Flera set på en rad: "82,5 kg × 8, 82,5 kg × 8, 82,5 kg × 7". */
export function formatSets(sets: { weight: number; reps: number; rpe?: number }[]): string {
  return sets.map(formatSet).join(', ')
}
