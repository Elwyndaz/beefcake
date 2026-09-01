import { describe, expect, it } from 'vitest'
import { parseImportData } from './importValidation'

function valid() {
  const set = { sets: 1, reps: 10, weight: 60 }
  return {
    templates: [{ id: 't1', name: 'Ben', updatedAt: '2026-09-01T10:00:00.000Z', exercises: [{ exerciseId: 'e1', defaultSetEntry: set, order: 0 }] }],
    exercises: [{ id: 'e1', name: 'Benböj', createdAt: '2026-09-01T10:00:00.000Z', kind: 'weight' as string, muscleGroup: 'Ben' }],
    sessions: [{ id: 's1', date: '2026-09-01', templateId: 't1', templateName: 'Ben', createdAt: '2026-09-01T10:00:00.000Z', exercises: [{ exerciseId: 'e1', exerciseName: 'Benböj', setEntries: [{ ...set }], order: 0 }] }],
    exerciseHistory: [{ id: 'h1', date: '2026-09-01', exerciseId: 'e1', exerciseName: 'Benböj', setEntries: [set], volume: 600, sessionId: 's1' }]
  }
}

describe('parseImportData', () => {
  it('accepterar en komplett tom backup', () => {
    expect(parseImportData(JSON.stringify({
      templates: [],
      exercises: [],
      sessions: [],
      exerciseHistory: []
    }))).toEqual({
      templates: [],
      exercises: [],
      sessions: [],
      exerciseHistory: [],
      bodyWeight: []
    })
  })

  it('accepterar kroppsvikt när den finns och släpper igenom en tom lista', () => {
    const rows = [{ date: '2026-09-01', kg: 82.5 }]
    expect(parseImportData(JSON.stringify({ ...valid(), bodyWeight: rows })).bodyWeight).toEqual(rows)
    expect(parseImportData(JSON.stringify({ ...valid(), bodyWeight: [] })).bodyWeight).toEqual([])
  })

  it('avvisar kroppsvikt utan giltigt datum, utan kilo eller med två värden samma dag', () => {
    expect(() => parseImportData(JSON.stringify({ ...valid(), bodyWeight: [{ date: 'igår', kg: 82.5 }] }))).toThrow('bodyWeight')
    expect(() => parseImportData(JSON.stringify({ ...valid(), bodyWeight: [{ date: '2026-09-01', kg: 0 }] }))).toThrow('bodyWeight')
    expect(() => parseImportData(JSON.stringify({ ...valid(), bodyWeight: [{ date: '2026-09-01', kg: 82 }, { date: '2026-09-01', kg: 83 }] }))).toThrow('dubbletter')
  })

  it('avvisar en backup som saknar en samling', () => {
    expect(() => parseImportData(JSON.stringify({
      templates: [],
      exercises: [],
      sessions: []
    }))).toThrow('exerciseHistory')
  })

  it('accepterar en komplett domänmodell', () => {
    expect(() => parseImportData(JSON.stringify(valid()))).not.toThrow()
  })

  it('avvisar ett set med negativ vikt', () => {
    const data = valid()
    data.sessions[0].exercises[0].setEntries[0].weight = -5
    expect(() => parseImportData(JSON.stringify(data))).toThrow('sessions')
  })

  it('avvisar en okänd övningstyp', () => {
    const data = valid()
    data.exercises[0].kind = 'cardio'
    expect(() => parseImportData(JSON.stringify(data))).toThrow('exercises')
  })

  it('avvisar historik som pekar på ett pass som saknas', () => {
    const data = valid()
    data.exerciseHistory[0].sessionId = 'borta'
    expect(() => parseImportData(JSON.stringify(data))).toThrow('pass som saknas')
  })

  it('avvisar dubbla ID:n innan någon data rensas', () => {
    expect(() => parseImportData(JSON.stringify({
      ...valid(),
      templates: [valid().templates[0], valid().templates[0]]
    }))).toThrow('dubbletter')
  })
})
