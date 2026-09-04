import { beforeEach, describe, expect, it, vi } from 'vitest'

const settings = vi.hoisted(() => new Map<string, unknown>())

vi.mock('../models', () => ({
  getDB: async () => ({
    get: async (_store: string, key: string) => settings.has(key) ? { key, value: settings.get(key) } : undefined,
    put: async (_store: string, setting: { key: string; value: unknown }) => {
      settings.set(setting.key, setting.value)
    }
  })
}))

import {
  DEFAULT_REST_TIMER_ALARM_DURATION,
  loadRestTimerAlarmDuration,
  saveRestTimerAlarmDuration
} from './timerService'

describe('vilotimerns alarmtid', () => {
  beforeEach(() => settings.clear())

  it('använder den tidigare fasta tiden som standard', async () => {
    await expect(loadRestTimerAlarmDuration()).resolves.toBe(DEFAULT_REST_TIMER_ALARM_DURATION)
  })

  it('sparar en vald tid i sekunder', async () => {
    await saveRestTimerAlarmDuration(30)
    await expect(loadRestTimerAlarmDuration()).resolves.toBe(30)
  })

  it('sparar null för alarm som ljuder tills det tystas', async () => {
    await saveRestTimerAlarmDuration(null)
    await expect(loadRestTimerAlarmDuration()).resolves.toBeNull()
  })

  it('avvisar tider utanför det tillåtna intervallet', async () => {
    await expect(saveRestTimerAlarmDuration(0)).rejects.toThrow('1 till 3 600 sekunder')
    await expect(saveRestTimerAlarmDuration(3601)).rejects.toThrow('1 till 3 600 sekunder')
  })
})
