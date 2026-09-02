import { describe, it, expect } from 'vitest'
import { daysBetween, daysAgoText, formatDateTime, mondayISO, isoWeek } from './date'

// Fasta datum överallt: 2026-09-01 är en tisdag.

describe('formatDateTime', () => {
  it('formaterar tidpunkten i svensk tid', () => {
    expect(formatDateTime('2026-09-02T12:03:00Z')).toBe('2 sep. 2026 14:03')
  })
})

describe('daysBetween', () => {
  it('räknar hela dagar, positivt framåt', () => {
    expect(daysBetween('2026-08-30', '2026-09-01')).toBe(2)
    expect(daysBetween('2026-09-01', '2026-09-01')).toBe(0)
    expect(daysBetween('2026-09-01', '2026-08-30')).toBe(-2)
  })

  it('påverkas inte av sommartidsskiftet', () => {
    // 2026-10-25 är sista söndagen i oktober, klockan går tillbaka: fortfarande hela dagar
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2)
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2)
  })
})

describe('daysAgoText', () => {
  it('i dag, i går, annars för N dagar sedan', () => {
    expect(daysAgoText(0)).toBe('i dag')
    expect(daysAgoText(-1)).toBe('i dag')
    expect(daysAgoText(1)).toBe('i går')
    expect(daysAgoText(2)).toBe('för 2 dagar sedan')
    expect(daysAgoText(14)).toBe('för 14 dagar sedan')
  })
})

describe('mondayISO', () => {
  it('ger måndagen oavsett veckodag', () => {
    expect(mondayISO(0, '2026-08-31')).toBe('2026-08-31') // måndag
    expect(mondayISO(0, '2026-09-01')).toBe('2026-08-31') // tisdag
    expect(mondayISO(0, '2026-09-06')).toBe('2026-08-31') // söndag hör till samma vecka
  })

  it('går över månadsskifte och årsskifte', () => {
    expect(mondayISO(0, '2026-10-01')).toBe('2026-09-28') // torsdag
    expect(mondayISO(0, '2027-01-02')).toBe('2026-12-28') // lördag
    expect(mondayISO(1, '2026-09-01')).toBe('2026-08-24')
    expect(mondayISO(2, '2027-01-02')).toBe('2026-12-14')
  })
})

describe('isoWeek', () => {
  it('v. 1 vid nyår', () => {
    expect(isoWeek('2026-01-01')).toBe(1) // torsdag
    expect(isoWeek('2027-01-01')).toBe(53) // fredag, hör till 2026 v. 53
    expect(isoWeek('2027-01-04')).toBe(1) // första måndagen 2027
  })

  it('v. 52 och v. 53', () => {
    expect(isoWeek('2026-12-28')).toBe(53) // 2026 har 53 veckor
    expect(isoWeek('2025-12-29')).toBe(1)  // 2025 har 52, måndagen är redan 2026 v. 1
    expect(isoWeek('2025-12-28')).toBe(52)
    expect(isoWeek('2026-08-31')).toBe(36)
  })
})
