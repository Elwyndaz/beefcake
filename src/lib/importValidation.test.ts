import { describe, expect, it } from 'vitest'
import { parseImportData } from './importValidation'

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
      exerciseHistory: []
    })
  })

  it('avvisar en backup som saknar en samling', () => {
    expect(() => parseImportData(JSON.stringify({
      templates: [],
      exercises: [],
      sessions: []
    }))).toThrow('exerciseHistory')
  })

  it('avvisar dubbla ID:n innan någon data rensas', () => {
    expect(() => parseImportData(JSON.stringify({
      templates: [
        { id: 'duplicate' },
        { id: 'duplicate' }
      ],
      exercises: [],
      sessions: [],
      exerciseHistory: []
    }))).toThrow('dubbletter')
  })
})
