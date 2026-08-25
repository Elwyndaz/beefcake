export interface ImportData {
  templates: Record<string, unknown>[]
  exercises: Record<string, unknown>[]
  sessions: Record<string, unknown>[]
  exerciseHistory: Record<string, unknown>[]
}

export function parseImportData(json: string): ImportData {
  const parsed: unknown = JSON.parse(json)
  if (!parsed || typeof parsed !== 'object') throw new Error('Importen har fel format')
  const data = parsed as Record<string, unknown>

  return {
    templates: readImportCollection(data.templates, 'templates'),
    exercises: readImportCollection(data.exercises, 'exercises'),
    sessions: readImportCollection(data.sessions, 'sessions'),
    exerciseHistory: readImportCollection(data.exerciseHistory, 'exerciseHistory')
  }
}

function readImportCollection(value: unknown, name: string): Record<string, unknown>[] {
  if (!Array.isArray(value)) throw new Error(`Importen har fel format: ${name}`)

  const ids = new Set<string>()
  for (const item of value) {
    if (!item || typeof item !== 'object') {
      throw new Error(`Importen har fel format: ${name}`)
    }

    const id = (item as Record<string, unknown>).id
    if (typeof id !== 'string' || id.trim().length === 0) {
      throw new Error(`Importen har fel format: ${name}`)
    }
    if (ids.has(id)) throw new Error(`Importen innehåller dubbletter: ${name}`)
    ids.add(id)
  }

  return value as Record<string, unknown>[]
}
