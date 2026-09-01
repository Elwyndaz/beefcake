import { describe, expect, it } from 'vitest'
import { epley1RM, repRecords, sessionMetric } from './exerciseMetrics'

const h = {
  date: '2026-08-01',
  volume: 2450,
  setEntries: [
    { sets: 1, reps: 10, weight: 80 },
    { sets: 1, reps: 8, weight: 85 },
    { sets: 1, reps: 12, weight: 70 }
  ]
}

describe('epley1RM', () => {
  it('80 kg × 10 ger 106,7', () => {
    expect(epley1RM(80, 10)).toBeCloseTo(106.67, 1)
  })
  it('kroppsvikt och mer än 10 reps ger inget värde', () => {
    expect(epley1RM(0, 10)).toBeNull()
    expect(epley1RM(80, 12)).toBeNull()
  })
})

describe('sessionMetric', () => {
  it('tyngsta set, e1RM, bästa setvolym och passvolym', () => {
    expect(sessionMetric(h, 'maxWeight')).toBe(85)
    expect(sessionMetric(h, 'e1rm')).toBeCloseTo(85 * (1 + 8 / 30), 2)
    expect(sessionMetric(h, 'bestSetVolume')).toBe(840)
    expect(sessionMetric(h, 'sessionVolume')).toBe(2450)
  })
  it('e1RM är null när inget set har 10 reps eller färre', () => {
    expect(sessionMetric({ volume: 0, setEntries: [{ reps: 15, weight: 40 }] }, 'e1rm')).toBeNull()
  })
})

describe('repRecords', () => {
  it('tyngsta vikten för minst N reps, med datum, hoppar över reps utan träff', () => {
    const history = [
      { date: '2026-07-01', setEntries: [{ reps: 5, weight: 100 }, { reps: 1, weight: 120 }] },
      { date: '2026-08-01', setEntries: [{ reps: 8, weight: 90 }, { reps: 12, weight: 70 }] }
    ]
    expect(repRecords(history)).toEqual([
      { reps: 1, weight: 120, date: '2026-07-01' },
      { reps: 3, weight: 100, date: '2026-07-01' },
      { reps: 5, weight: 100, date: '2026-07-01' },
      { reps: 8, weight: 90, date: '2026-08-01' },
      { reps: 10, weight: 70, date: '2026-08-01' },
      { reps: 12, weight: 70, date: '2026-08-01' }
    ])
  })
  it('kroppsviktsset ger inget rekord', () => {
    expect(repRecords([{ date: '2026-08-01', setEntries: [{ reps: 10, weight: 0 }] }])).toEqual([])
  })
})
