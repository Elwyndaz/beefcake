import { getDB, generateId, nowISO } from '../models'
import type { Template, TemplateExercise, Exercise, Session, SessionExercise, ExerciseHistory } from '../models'

// Template Service
export async function getAllTemplates(): Promise<Template[]> {
  const db = await getDB()
  return db.getAllFromIndex('templates', 'by-updated')
}

export async function getTemplate(id: string): Promise<Template | undefined> {
  const db = await getDB()
  return db.get('templates', id)
}

export async function createTemplate(name: string, exercises: Omit<TemplateExercise, 'order'>[]): Promise<Template> {
  const db = await getDB()
  const template: Template = {
    id: generateId(),
    name,
    exercises: exercises.map((e, i) => ({ ...e, order: i })),
    updatedAt: nowISO()
  }
  await db.put('templates', template)
  return template
}

export async function updateTemplate(id: string, updates: Partial<Template>): Promise<Template> {
  const db = await getDB()
  const existing = await db.get('templates', id)
  if (!existing) throw new Error(`Template ${id} not found`)
  const updated = { ...existing, ...updates, updatedAt: nowISO() }
  await db.put('templates', updated)
  return updated
}

export async function deleteTemplate(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('templates', id)
}

export async function updateTemplateExerciseLastUsed(
  templateId: string,
  exerciseId: string,
  sets: number,
  reps: number,
  weight: number
): Promise<void> {
  const db = await getDB()
  const template = await db.get('templates', templateId)
  if (!template) return
  const ex = template.exercises.find(e => e.exerciseId === exerciseId)
  if (ex) {
    ex.defaultSets = sets
    ex.defaultReps = reps
    ex.defaultWeight = weight
    template.updatedAt = nowISO()
    await db.put('templates', template)
  }
}

// Exercise Service
export async function getAllExercises(): Promise<Exercise[]> {
  const db = await getDB()
  return db.getAllFromIndex('exercises', 'by-name')
}

export async function getOrCreateExercise(name: string): Promise<Exercise> {
  const db = await getDB()
  const existing = await db.getFromIndex('exercises', 'by-name', name)
  if (existing) return existing
  const exercise: Exercise = {
    id: generateId(),
    name,
    createdAt: nowISO()
  }
  await db.put('exercises', exercise)
  return exercise
}

// Session Service
export async function getAllSessions(): Promise<Session[]> {
  const db = await getDB()
  const sessions = await db.getAllFromIndex('sessions', 'by-date')
  return sessions.sort((a: Session, b: Session) => b.date.localeCompare(a.date))
}

export async function getSession(id: string): Promise<Session | undefined> {
  const db = await getDB()
  return db.get('sessions', id)
}

export async function createSession(
  date: string,
  templateId: string,
  templateName: string,
  exercises: Omit<SessionExercise, 'order'>[]
): Promise<Session> {
  const db = await getDB()
  const session: Session = {
    id: generateId(),
    date,
    templateId,
    templateName,
    exercises: exercises.map((e, i) => ({ ...e, order: i })),
    createdAt: nowISO()
  }
  await db.put('sessions', session)

  const history: ExerciseHistory[] = exercises.map(e => ({
    id: generateId(),
    date,
    exerciseId: e.exerciseId,
    exerciseName: e.exerciseName,
    sets: e.sets,
    reps: e.reps,
    weight: e.weight,
    volume: e.sets * e.reps * e.weight,
    sessionId: session.id
  }))
  const tx = db.transaction('exerciseHistory', 'readwrite')
  for (const h of history) {
    await tx.objectStore('exerciseHistory').put(h)
  }
  await tx.done

  for (const e of exercises) {
    await updateTemplateExerciseLastUsed(templateId, e.exerciseId, e.sets, e.reps, e.weight)
  }

  return session
}

export async function updateSession(id: string, updates: Partial<Session>): Promise<Session> {
  const db = await getDB()
  const existing = await db.get('sessions', id)
  if (!existing) throw new Error(`Session ${id} not found`)
  const updated = { ...existing, ...updates, id }

  // exerciseHistory är en denormaliserad kopia av passets övningar och är det
  // statistiken läser. Skrivs bara passet blir graferna tyst fel. Bygg om
  // passets historikrader i samma transaktion som passet självt.
  const history: ExerciseHistory[] = updated.exercises.map((e, i) => ({
    id: `${id}-${i}`,
    date: updated.date,
    exerciseId: e.exerciseId,
    exerciseName: e.exerciseName,
    sets: e.sets,
    reps: e.reps,
    weight: e.weight,
    volume: e.sets * e.reps * e.weight,
    sessionId: id
  }))

  const stale = await db.getAllFromIndex('exerciseHistory', 'by-session', id)
  const tx = db.transaction(['sessions', 'exerciseHistory'], 'readwrite')
  for (const h of stale) await tx.objectStore('exerciseHistory').delete(h.id)
  for (const h of history) await tx.objectStore('exerciseHistory').put(h)
  await tx.objectStore('sessions').put(updated)
  await tx.done

  return updated
}

export async function deleteSession(id: string): Promise<void> {
  const db = await getDB()
  const session = await db.get('sessions', id)
  if (session) {
    const history = await db.getAllFromIndex('exerciseHistory', 'by-session', id)
    const tx = db.transaction('exerciseHistory', 'readwrite')
    for (const h of history) {
      await tx.objectStore('exerciseHistory').delete(h.id)
    }
    await tx.done
  }
  await db.delete('sessions', id)
}

export async function getLatestSessionDate(): Promise<string | null> {
  const sessions = await getAllSessions()
  return sessions.length > 0 ? sessions[0].date : null
}

// Stats Service
export async function getExerciseHistory(exerciseId: string): Promise<ExerciseHistory[]> {
  const db = await getDB()
  const history = await db.getAllFromIndex('exerciseHistory', 'by-exercise', exerciseId)
  return history.sort((a: ExerciseHistory, b: ExerciseHistory) => a.date.localeCompare(b.date))
}

export async function getVolumeOverTime(exerciseId: string): Promise<{ date: string; volume: number }[]> {
  const history = await getExerciseHistory(exerciseId)
  return history.map(h => ({ date: h.date, volume: h.volume }))
}

export async function getFrequencyPerTemplate(): Promise<{ templateName: string; count: number }[]> {
  const db = await getDB()
  const sessions = await db.getAll('sessions')
  const map = new Map<string, number>()
  for (const s of sessions) {
    map.set(s.templateName, (map.get(s.templateName) || 0) + 1)
  }
  return Array.from(map.entries()).map(([templateName, count]) => ({ templateName, count }))
}

export async function getHeatmapData(days: number = 30): Promise<{ date: string; count: number }[]> {
  const db = await getDB()
  const sessions = await db.getAll('sessions')
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffISO = cutoff.toISOString().split('T')[0]

  const map = new Map<string, number>()
  for (const s of sessions) {
    if (s.date >= cutoffISO) {
      map.set(s.date, (map.get(s.date) || 0) + 1)
    }
  }
  return Array.from(map.entries()).map(([date, count]) => ({ date, count }))
}

export async function getPRs(): Promise<{ exerciseId: string; exerciseName: string; maxWeight: number; maxVolume: number; maxWeightDate: string; maxVolumeDate: string }[]> {
  const db = await getDB()
  const history = await db.getAll('exerciseHistory')
  const map = new Map<string, { exerciseName: string; maxWeight: number; maxVolume: number; maxWeightDate: string; maxVolumeDate: string }>()

  for (const h of history) {
    const existing = map.get(h.exerciseId)
    if (!existing) {
      map.set(h.exerciseId, {
        exerciseName: h.exerciseName,
        maxWeight: h.weight,
        maxVolume: h.volume,
        maxWeightDate: h.date,
        maxVolumeDate: h.date
      })
    } else {
      if (h.weight > existing.maxWeight) {
        existing.maxWeight = h.weight
        existing.maxWeightDate = h.date
      }
      if (h.volume > existing.maxVolume) {
        existing.maxVolume = h.volume
        existing.maxVolumeDate = h.date
      }
    }
  }

  return Array.from(map.entries()).map(([exerciseId, data]) => ({ exerciseId, ...data }))
}

// Export/Import
export async function exportAllData(): Promise<string> {
  const db = await getDB()
  const [templates, exercises, sessions, history] = await Promise.all([
    db.getAll('templates'),
    db.getAll('exercises'),
    db.getAll('sessions'),
    db.getAll('exerciseHistory')
  ])
  return JSON.stringify({ templates, exercises, sessions, exerciseHistory: history }, null, 2)
}

export async function importAllData(json: string): Promise<void> {
  const db = await getDB()
  const data = JSON.parse(json)
  const tx = db.transaction(['templates', 'exercises', 'sessions', 'exerciseHistory'], 'readwrite')
  await Promise.all([
    tx.objectStore('templates').clear(),
    tx.objectStore('exercises').clear(),
    tx.objectStore('sessions').clear(),
    tx.objectStore('exerciseHistory').clear()
  ])
  for (const t of data.templates || []) await tx.objectStore('templates').put(t)
  for (const e of data.exercises || []) await tx.objectStore('exercises').put(e)
  for (const s of data.sessions || []) await tx.objectStore('sessions').put(s)
  for (const h of data.exerciseHistory || []) await tx.objectStore('exerciseHistory').put(h)
  await tx.done
}

/** Övningsnamn jämförs skiftlägesokänsligt, så "Hantelrodd" och "hantelrodd"
 *  blir samma övning istället för att splittra historiken på två poster. */
function exerciseKey(name: string): string {
  return name.trim().toLowerCase()
}

/** Ett pass identifieras av datum och passnamn. Den nyckeln är stabil över
 *  omgenereringar av seed-datan; id:n är det inte, eftersom en ny övning i
 *  källan numrerar om hela sekvensen. */
function sessionKey(date: string, templateName: string): string {
  return `${date} ${templateName}`
}

/**
 * Lägger till det som saknas ur seed-datan. Additiv: skriver aldrig över och
 * raderar aldrig något som redan finns, så egna ändringar i appen och
 * historiska pass överlever varje körning. Idempotent, kan köras vid varje
 * appstart.
 */
export async function syncSeed(): Promise<{ sessionsAdded: number; exercisesAdded: number }> {
  const db = await getDB()
  const { seedTemplates, seedExercises, seedSessions } = await import('../db/seedData')

  const [existingExercises, existingTemplates, existingSessions] = await Promise.all([
    db.getAll('exercises'),
    db.getAll('templates'),
    db.getAll('sessions')
  ])

  const exerciseIdByName = new Map(existingExercises.map(e => [exerciseKey(e.name), e.id]))
  const templateIdByName = new Map(existingTemplates.map(t => [exerciseKey(t.name), t.id]))
  const haveSession = new Set(existingSessions.map(s => sessionKey(s.date, s.templateName)))
  const seedNameById = new Map(seedExercises.map(e => [e.id, e.name]))

  const newExercises: Exercise[] = []
  for (const e of seedExercises) {
    if (exerciseIdByName.has(exerciseKey(e.name))) continue
    exerciseIdByName.set(exerciseKey(e.name), e.id)
    newExercises.push(e)
  }

  const newTemplates: Template[] = []
  for (const t of seedTemplates) {
    if (templateIdByName.has(exerciseKey(t.name))) continue
    templateIdByName.set(exerciseKey(t.name), t.id)
    newTemplates.push({
      ...t,
      // Mallens övningar pekar på seed-id:n. Peka om dem till de id:n databasen
      // faktiskt använder, annars blir mallen tom i gränssnittet.
      exercises: t.exercises.map(te => ({
        ...te,
        exerciseId:
          exerciseIdByName.get(exerciseKey(seedNameById.get(te.exerciseId) ?? '')) ?? te.exerciseId
      }))
    })
  }

  const newSessions: Session[] = []
  const newHistory: ExerciseHistory[] = []
  for (const s of seedSessions) {
    if (haveSession.has(sessionKey(s.date, s.templateName))) continue
    const exercises = s.exercises.map(e => ({
      ...e,
      exerciseId: exerciseIdByName.get(exerciseKey(e.exerciseName)) ?? e.exerciseId
    }))
    newSessions.push({
      ...s,
      templateId: templateIdByName.get(exerciseKey(s.templateName)) ?? s.templateId,
      exercises
    })
    for (const e of exercises) {
      newHistory.push({
        id: `${s.id}-${e.order}`,
        date: s.date,
        exerciseId: e.exerciseId,
        exerciseName: e.exerciseName,
        sets: e.sets,
        reps: e.reps,
        weight: e.weight,
        volume: e.sets * e.reps * e.weight,
        sessionId: s.id
      })
    }
  }

  if (!newExercises.length && !newTemplates.length && !newSessions.length) {
    return { sessionsAdded: 0, exercisesAdded: 0 }
  }

  const tx = db.transaction(['templates', 'exercises', 'sessions', 'exerciseHistory'], 'readwrite')
  for (const e of newExercises) await tx.objectStore('exercises').put(e)
  for (const t of newTemplates) await tx.objectStore('templates').put(t)
  for (const s of newSessions) await tx.objectStore('sessions').put(s)
  for (const h of newHistory) await tx.objectStore('exerciseHistory').put(h)
  await tx.done

  return { sessionsAdded: newSessions.length, exercisesAdded: newExercises.length }
}

export async function exportSessionsCSV(): Promise<string> {
  const sessions = await getAllSessions()
  const headers = ['Datum', 'Pass', 'Övning', 'Set', 'Reps', 'Vikt (kg)', 'Volym']
  const rows = [headers.join(',')]
  for (const s of sessions) {
    for (const e of s.exercises) {
      rows.push([
        s.date,
        `"${s.templateName}"`,
        `"${e.exerciseName}"`,
        e.sets,
        e.reps,
        e.weight,
        e.sets * e.reps * e.weight
      ].join(','))
    }
  }
  return rows.join('\n')
}

export async function clearAllData(): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(['templates', 'exercises', 'sessions', 'exerciseHistory'], 'readwrite')
  await Promise.all([
    tx.objectStore('templates').clear(),
    tx.objectStore('exercises').clear(),
    tx.objectStore('sessions').clear(),
    tx.objectStore('exerciseHistory').clear()
  ])
  await tx.done
}