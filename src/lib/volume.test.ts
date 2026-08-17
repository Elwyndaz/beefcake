import { describe, it, expect } from 'vitest'
import { setVolume, setsVolume, exercisesVolume } from './volume'

describe('setVolume', () => {
  it('multiplicerar set, reps och vikt', () => {
    expect(setVolume({ sets: 3, reps: 8, weight: 82.5 })).toBe(1980)
  })

  it('räknar en rad utan sets som ett set', () => {
    expect(setVolume({ reps: 8, weight: 80 })).toBe(640)
  })

  it('ger 0 för kroppsvikt och kondition, alltså vikt 0', () => {
    expect(setVolume({ sets: 3, reps: 12, weight: 0 })).toBe(0)
  })

  it('ger 0 för negativ vikt i stället för negativ volym', () => {
    expect(setVolume({ sets: 1, reps: 5, weight: -20 })).toBe(0)
  })
})

describe('setsVolume', () => {
  it('summerar set med olika vikt', () => {
    expect(setsVolume([
      { sets: 1, reps: 8, weight: 82.5 },
      { sets: 1, reps: 8, weight: 82.5 },
      { sets: 1, reps: 7, weight: 82.5 }
    ])).toBe(1897.5)
  })

  it('hoppar över viktlösa set men behåller resten', () => {
    expect(setsVolume([
      { sets: 1, reps: 10, weight: 0 },
      { sets: 1, reps: 10, weight: 60 }
    ])).toBe(600)
  })

  it('ger 0 för tom lista', () => {
    expect(setsVolume([])).toBe(0)
  })
})

describe('exercisesVolume', () => {
  it('summerar över övningar', () => {
    expect(exercisesVolume([
      { setEntries: [{ sets: 1, reps: 8, weight: 82.5 }] },
      { setEntries: [{ sets: 1, reps: 5, weight: 112.5 }] }
    ])).toBe(660 + 562.5)
  })
})
