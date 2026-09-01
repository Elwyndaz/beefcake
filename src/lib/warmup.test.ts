import { describe, expect, it } from 'vitest'
import { roundToPlate, warmupSets } from './warmup'

describe('warmupSets', () => {
  it('100 kg ger 40, 60 och 80 kg', () => {
    expect(warmupSets(100)).toEqual([{ weight: 40, reps: 8 }, { weight: 60, reps: 5 }, { weight: 80, reps: 3 }])
  })
  it('avrundar till närmaste 2,5 kg', () => {
    expect(warmupSets(82.5).map(s => s.weight)).toEqual([32.5, 50, 65])
    expect(roundToPlate(33.4)).toBe(32.5)
    expect(roundToPlate(33.8)).toBe(35)
  })
})
