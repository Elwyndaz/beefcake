import { describe, expect, it } from 'vitest'
import { beefcakeStreak } from './streak'

describe('beefcakeStreak', () => {
  it('utan pass står Cartman kvar på nivå 1', () => {
    expect(beefcakeStreak([], '2026-08-21')).toEqual({ level: 1, streak: 0, daysSinceLast: null })
  })

  it('mer än tre dagars uppehåll faller tillbaka till nivå 1', () => {
    const result = beefcakeStreak(['2026-08-10', '2026-08-12', '2026-08-14', '2026-08-16'], '2026-08-21')
    expect(result.level).toBe(1)
    expect(result.streak).toBe(0)
    expect(result.daysSinceLast).toBe(5)
  })

  it('exakt tre dagars uppehåll håller kedjan vid liv', () => {
    expect(beefcakeStreak(['2026-08-18'], '2026-08-21').level).toBe(2)
  })

  it('varannan dag stegar upp: 4 pass ger nivå 3', () => {
    const dates = ['2026-08-15', '2026-08-17', '2026-08-19', '2026-08-21']
    expect(beefcakeStreak(dates, '2026-08-21')).toEqual({ level: 3, streak: 4, daysSinceLast: 0 })
  })

  it('tio pass i rad ger nivå 4', () => {
    const dates = Array.from({ length: 10 }, (_, i) => `2026-08-${String(3 + i * 2).padStart(2, '0')}`)
    expect(beefcakeStreak(dates, '2026-08-21')).toEqual({ level: 4, streak: 10, daysSinceLast: 0 })
  })

  it('kedjan bryts vid det första för långa glappet, äldre pass räknas inte', () => {
    const dates = ['2026-07-01', '2026-07-03', '2026-08-19', '2026-08-21']
    expect(beefcakeStreak(dates, '2026-08-21').streak).toBe(2)
  })

  it('dubbletter av samma datum räknas som ett pass', () => {
    const dates = ['2026-08-21', '2026-08-21', '2026-08-19']
    expect(beefcakeStreak(dates, '2026-08-21').streak).toBe(2)
  })

  it('ett pass daterat i framtiden bryter inte kedjan', () => {
    expect(beefcakeStreak(['2026-08-25'], '2026-08-21').level).toBe(2)
  })
})
