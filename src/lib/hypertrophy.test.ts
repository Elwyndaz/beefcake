import { describe, it, expect } from 'vitest'
import { classifyWeeklySets } from './hypertrophy'

describe('classifyWeeklySets', () => {
  it('under 10 set är för lite', () => {
    expect(classifyWeeklySets(0)).toBe('low')
    expect(classifyWeeklySets(9)).toBe('low')
  })

  it('10 till 20 set är målbandet', () => {
    expect(classifyWeeklySets(10)).toBe('optimal')
    expect(classifyWeeklySets(20)).toBe('optimal')
  })

  it('över 20 set är hög volym', () => {
    expect(classifyWeeklySets(21)).toBe('high')
  })
})
