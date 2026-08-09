import { getDB, generateId, nowISO, migrateSession, migrateTemplateExercise } from '../models'
import type { Template, TemplateExercise, Exercise, Session, SessionExercise, ExerciseHistory, SetEntry, LegacySession, LegacyTemplateExercise } from '../models'

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
  // Atomär transaktion - sessions behåller templateId som historisk data
  const tx = db.transaction(['templates'], 'readwrite')
  await tx.objectStore('templates').delete(id)
  await tx.done
}

export async function updateTemplateExerciseLastUsed(
  templateId: string,
  exerciseId: string,
  setEntry: SetEntry
): Promise<void> {
  const db = await getDB()
  const template = await db.get('templates', templateId)
  if (!template) return
  const ex = template.exercises.find(e => e.exerciseId === exerciseId)
  if (ex) {
    ex.defaultSetEntry = setEntry
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

  const history: ExerciseHistory[] = exercises.map(e => {
    // För varje setEntry i exercise, skapa en historikpost
    // För nu: om det finns flera setEntries, summera volymen
    const totalVolume = e.setEntries.reduce((sum, set) => sum + (set.sets * set.reps * set.weight), 0)
    return {
      id: generateId(),
      date,
      exerciseId: e.exerciseId,
      exerciseName: e.exerciseName,
      setEntries: e.setEntries,
      volume: totalVolume,
      sessionId: session.id
    }
  })

  // Hämta den befintliga templaten för att uppdatera default-värden
  const template = await db.get('templates', templateId)
  if (template) {
    for (const e of exercises) {
      const ex = template.exercises.find(te => te.exerciseId === e.exerciseId)
      if (ex && e.setEntries.length > 0) {
        // Uppdatera default till det första setEntry
        ex.defaultSetEntry = { ...e.setEntries[0] }
        template.updatedAt = nowISO()
      }
    }
  }

  // Atomär transaktion som skriver till alla tre stores
  const tx = db.transaction(['sessions', 'exerciseHistory', 'templates'], 'readwrite')
  await tx.objectStore('sessions').put(session)
  for (const h of history) {
    await tx.objectStore('exerciseHistory').put(h)
  }
  if (template) {
    await tx.objectStore('templates').put(template)
  }
  await tx.done

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
  const history: ExerciseHistory[] = updated.exercises.map((e, i) => {
    // Summera volymen från alla setEntries
    const totalVolume = e.setEntries.reduce((sum, set) => sum + (set.sets * set.reps * set.weight), 0)
    return {
      id: `${id}-${i}`,
      date: updated.date,
      exerciseId: e.exerciseId,
      exerciseName: e.exerciseName,
      setEntries: e.setEntries,
      volume: totalVolume,
      sessionId: id
    }
  })

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
  // Atomär transaktion för båda stores
  const tx = db.transaction(['sessions', 'exerciseHistory'], 'readwrite')
  
  // Ta bort motsvarande historik-poster
  const history = await tx.objectStore('exerciseHistory').index('by-session').getAll(id)
  for (const h of history) {
    await tx.objectStore('exerciseHistory').delete(h.id)
  }
  
  // Ta bort sessionen
  await tx.objectStore('sessions').delete(id)
  
  await tx.done
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
    // För SetEntry[], hittar det högsta weight och volume från alla setEntries
    const maxWeight = Math.max(...h.setEntries.map(s => s.weight))
    const totalVolume = h.volume // Redan beräknad och sparad
    
    const existing = map.get(h.exerciseId)
    if (!existing) {
      map.set(h.exerciseId, {
        exerciseName: h.exerciseName,
        maxWeight,
        maxVolume: totalVolume,
        maxWeightDate: h.date,
        maxVolumeDate: h.date
      })
    } else {
      if (maxWeight > existing.maxWeight) {
        existing.maxWeight = maxWeight
        existing.maxWeightDate = h.date
      }
      if (totalVolume > existing.maxVolume) {
        existing.maxVolume = totalVolume
        existing.maxVolumeDate = h.date
      }
    }
  }

  return Array.from(map.entries()).map(([exerciseId, data]) => ({ exerciseId, ...data }))
}

// 1RM estimation using Epley formula: 1RM = weight * (1 + reps/30)
export async function getEstimated1RM(exerciseId: string): Promise<{ exerciseName: string; estimated1RM: number; date: string } | null> {
  const history = await getExerciseHistory(exerciseId)
  if (history.length === 0) return null

  // Find the entry with highest estimated 1RM
  let best: { exerciseName: string; estimated1RM: number; date: string } | null = null
  for (const h of history) {
    for (const set of h.setEntries) {
      if (set.weight > 0 && set.reps > 0) {
        const epley1RM = set.weight * (1 + set.reps / 30)
        if (!best || epley1RM > best.estimated1RM) {
          best = {
            exerciseName: h.exerciseName,
            estimated1RM: epley1RM,
            date: h.date
          }
        }
      }
    }
  }
  return best
}

// Get total volume (tonnage) for a given week
export async function getWeeklyTonnage(weekStartDate: string): Promise<number> {
  const db = await getDB()
  const sessions = await db.getAll('sessions')
  
  const weekEndDate = new Date(weekStartDate)
  weekEndDate.setDate(weekEndDate.getDate() + 6)
  const weekEndISO = weekEndDate.toISOString().split('T')[0]
  
  let totalVolume = 0
  for (const s of sessions) {
    if (s.date >= weekStartDate && s.date <= weekEndISO) {
      for (const e of s.exercises) {
        for (const set of e.setEntries) {
          totalVolume += set.sets * set.reps * set.weight
        }
      }
    }
  }
  return totalVolume
}

// Get current training streak (consecutive days with workouts)
export async function getCurrentStreak(): Promise<{ streakDays: number; lastWorkoutDate: string | null }> {
  const db = await getDB()
  const sessions = await db.getAll('sessions')
  
  if (sessions.length === 0) {
    return { streakDays: 0, lastWorkoutDate: null }
  }

  // Sort by date descending
  const sortedSessions = [...sessions].sort((a, b) => b.date.localeCompare(a.date))
  
  let streakDays = 0
  let lastDate: string | null = null
  let currentDate = sortedSessions[0].date
  
  // Start from the most recent session and count consecutive days
  while (true) {
    const sessionOnDate = sortedSessions.find(s => s.date === currentDate)
    if (sessionOnDate) {
      streakDays++
      lastDate = currentDate
      // Move to previous day
      const prevDate = new Date(currentDate)
      prevDate.setDate(prevDate.getDate() - 1)
      currentDate = prevDate.toISOString().split('T')[0]
    } else {
      break
    }
    
    // Stop after checking 365 days
    if (streakDays >= 365) break
  }
  
  return { streakDays, lastWorkoutDate: lastDate }
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
 * 
 * Migrerar också från Legacy-typ (defaultSets/defaultReps/defaultWeight) till
 * ny SetEntry-baserad struktur.
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

  // Migrera seedTemplates till ny struktur
  // Hoppa över mallen med name: "undefined" (P0-2: städa undefined-mallen)
  const newTemplates: Template[] = []
  for (const t of seedTemplates) {
    if (templateIdByName.has(exerciseKey(t.name))) continue
    // Hoppa över den felaktiga undefined-mallen
    if (t.name === 'undefined') continue
    templateIdByName.set(exerciseKey(t.name), t.id)
    newTemplates.push({
      ...t,
      // Mallens övningar pekar på seed-id:n. Peka om dem till de id:n databasen
      // faktiskt använder, annars blir mallen tom i gränssnittet.
      exercises: t.exercises.map(te => {
        const migrated = migrateTemplateExercise(te as unknown as LegacyTemplateExercise)
        // Kontrollera att inga undefined-värden finns i defaultSetEntry
        const cleanMigrated = {
          ...migrated,
          exerciseId: exerciseIdByName.get(exerciseKey(seedNameById.get(te.exerciseId) ?? '')) ?? te.exerciseId,
          defaultSetEntry: {
            sets: migrated.defaultSetEntry.sets || 0,
            reps: migrated.defaultSetEntry.reps || 0,
            weight: migrated.defaultSetEntry.weight || 0
          }
        }
        return cleanMigrated
      })
    })
  }

  // Migrera seedSessions till ny struktur
  const newSessions: Session[] = []
  const newHistory: ExerciseHistory[] = []
  for (const s of seedSessions) {
    if (haveSession.has(sessionKey(s.date, s.templateName))) continue
    // Migrera sessionens exercises till nya strukturen
    const migratedSession = migrateSession(s as LegacySession)
    migratedSession.templateId = templateIdByName.get(exerciseKey(s.templateName)) ?? s.templateId
    
    // Uppdatera exerciseIds för alla exercises
    migratedSession.exercises = migratedSession.exercises.map(e => ({
      ...e,
      exerciseId: exerciseIdByName.get(exerciseKey(e.exerciseName)) ?? e.exerciseId
    }))
    
    newSessions.push(migratedSession)
    
    // Skapa historik från migrerade exercises
    for (const e of migratedSession.exercises) {
      const totalVolume = e.setEntries.reduce((sum, set) => sum + (set.sets * set.reps * set.weight), 0)
      newHistory.push({
        id: `${s.id}-${e.order}`,
        date: s.date,
        exerciseId: e.exerciseId,
        exerciseName: e.exerciseName,
        setEntries: e.setEntries,
        volume: totalVolume,
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
      // För varje setEntry, skapa en rad
      for (const set of e.setEntries) {
        rows.push([
          s.date,
          `"${s.templateName}"`,
          `"${e.exerciseName}"`,
          set.sets,
          set.reps,
          set.weight,
          set.sets * set.reps * set.weight
        ].join(','))
      }
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