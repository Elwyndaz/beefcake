import { describe, expect, it } from 'vitest'
import { lazyDays, stockholmToday } from './reminders'
import { buildReminderEmail, SENDER } from './email'

describe('lazyDays', () => {
  it('inget brev inom tre dagar, brev från dag fyra och varje dag därefter', () => {
    const dates = ['2026-08-20', '2026-08-29', '2026-08-25']
    expect(lazyDays(dates, '2026-08-29')).toBeNull()
    expect(lazyDays(dates, '2026-09-01')).toBeNull() // 3 dagar, kedjan lever
    expect(lazyDays(dates, '2026-09-02')).toBe(4)
    expect(lazyDays(dates, '2026-09-03')).toBe(5)
    expect(lazyDays(dates, '2026-09-12')).toBe(14)
  })

  it('ingen historik ger inget brev', () => {
    expect(lazyDays([], '2026-09-02')).toBeNull()
  })
})

describe('stockholmToday', () => {
  it('räknar svensk dag, inte UTC', () => {
    expect(stockholmToday(new Date('2026-09-01T22:30:00Z'))).toBe('2026-09-02') // CEST
    expect(stockholmToday(new Date('2026-12-01T23:30:00Z'))).toBe('2026-12-02') // CET
    expect(stockholmToday(new Date('2026-09-02T10:00:00Z'))).toBe('2026-09-02')
  })
})

describe('buildReminderEmail', () => {
  it('bär bara dagarna och länken, från underdomänen', () => {
    const mail = buildReminderEmail({ to: 'a@b.se', days: 5, appUrl: 'https://buildapp.se/beefcake/' })
    expect(mail.from).toBe(SENDER)
    expect(mail.to).toEqual(['a@b.se'])
    expect(mail.subject).toBe('Nu har du inte tränat på 5 dagar, din latmask.')
    expect(mail.text).toContain('https://buildapp.se/beefcake/')
    expect(mail.html).not.toContain('<script')
  })
})
