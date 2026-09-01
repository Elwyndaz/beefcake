import { formatWeight } from './format'

/** Skivor per sida, tyngst först. Färgerna bor i PlateCalculator, det här är bara vikterna. */
export const PLATE_WEIGHTS = [25, 20, 15, 10, 5, 2.5, 1.25] as const

/** Stångvikt per utrustning. Utan känd stång finns inga plattor att räkna. */
export function barWeightFor(equipment: string | undefined): number | null {
  if (equipment === 'skivstång') return 20
  if (equipment === 'ez-stång') return 10
  return null
}

export function calculatePlates(targetWeight: number, barWeight = 20): { platesPerSide: { weight: number; count: number }[]; remainingWeight: number } {
  if (targetWeight <= barWeight) {
    return { platesPerSide: [], remainingWeight: 0 }
  }

  let weightPerSide = (targetWeight - barWeight) / 2
  const platesPerSide: { weight: number; count: number }[] = []

  for (const weight of PLATE_WEIGHTS) {
    const count = Math.floor(weightPerSide / weight)
    if (count > 0) {
      platesPerSide.push({ weight, count })
      weightPerSide -= count * weight
      weightPerSide = Math.round(weightPerSide * 100) / 100
    }
  }

  return {
    platesPerSide,
    remainingWeight: Math.round(weightPerSide * 2 * 100) / 100
  }
}

/** "20 + 10 + 2,5 per sida", eller "bara stången" när vikten inte överstiger stången. */
export function formatPlatesPerSide(targetWeight: number, barWeight: number): string {
  const { platesPerSide, remainingWeight } = calculatePlates(targetWeight, barWeight)
  if (platesPerSide.length === 0) return `bara stången (${formatWeight(barWeight)} kg)`
  const parts = platesPerSide.flatMap(p => Array.from({ length: p.count }, () => formatWeight(p.weight)))
  const rest = remainingWeight > 0 ? `, ${formatWeight(remainingWeight)} kg saknas` : ''
  return `${parts.join(' + ')} per sida${rest}`
}
