/** Uppvärmning ur första arbetssetet: 40, 60 och 80 % avrundat till 2,5 kg, med fallande reps. */
export const WARMUP_STEPS: readonly { fraction: number; reps: number }[] = [
  { fraction: 0.4, reps: 8 },
  { fraction: 0.6, reps: 5 },
  { fraction: 0.8, reps: 3 }
]

export function roundToPlate(weight: number, step = 2.5): number {
  return Math.round(weight / step) * step
}

export function warmupSets(workingWeight: number): { weight: number; reps: number }[] {
  return WARMUP_STEPS.map(s => ({ weight: roundToPlate(workingWeight * s.fraction), reps: s.reps }))
}
