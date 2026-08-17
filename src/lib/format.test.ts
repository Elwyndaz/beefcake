import { describe, it, expect } from 'vitest'
import { formatWeight, formatSet, formatSets } from './format'

// Non-breaking space: svensk tusentalsavgränsare i Intl är U+00A0, inte mellanslag.
const NBSP = ' '

describe('formatWeight', () => {
  it('använder decimalkomma', () => {
    expect(formatWeight(82.5)).toBe('82,5')
  })

  it('skriver heltal utan decimaler', () => {
    expect(formatWeight(80)).toBe('80')
  })

  it('använder mellanslag som tusentalsavgränsare', () => {
    expect(formatWeight(1897.5)).toBe(`1${NBSP}897,5`)
  })
})

describe('formatSet', () => {
  it('skriver vikt gånger reps', () => {
    expect(formatSet({ weight: 82.5, reps: 8 })).toBe('82,5 kg × 8')
  })

  it('skriver bara reps när vikten är 0', () => {
    expect(formatSet({ weight: 0, reps: 12 })).toBe('12 reps')
  })
})

describe('formatSets', () => {
  it('separerar med komma och mellanslag', () => {
    expect(formatSets([
      { weight: 82.5, reps: 8 },
      { weight: 82.5, reps: 7 }
    ])).toBe('82,5 kg × 8, 82,5 kg × 7')
  })
})
