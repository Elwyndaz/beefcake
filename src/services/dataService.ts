import { getDB, generateId, nowISO, migrateSession, migrateTemplateExercise } from '../models'
import type {
  Template,
  TemplateExercise,
  Exercise,
  Session,
  SessionExercise,
  ExerciseHistory,
  SetEntry,
  LegacySession,
  LegacyTemplateExercise,
  ActiveWorkout
} from '../models'
import { loadSnapshotFromCloud, syncSnapshot } from './cloudSyncService'
import { parseImportData } from '../lib/importValidation'
import { setVolume, setsVolume, exercisesVolume } from '../lib/volume'
import { localDateISO, parseLocalDate } from '../lib/date'

// Active Workout Service (pågående pass sparat lokalt i realtid)
export async function getActiveWorkout(): Promise<ActiveWorkout | undefined> {
  const db = await getDB()
  return db.get('activeWorkout', 'current')
}

export async function saveActiveWorkout(workout: Omit<ActiveWorkout, 'id' | 'updatedAt'>): Promise<ActiveWorkout> {
  const db = await getDB()
  const active: ActiveWorkout = {
    ...workout,
    id: 'current',
    updatedAt: nowISO()
  }
  await db.put('activeWorkout', active)
  return active
}

export async function clearActiveWorkout(): Promise<void> {
  const db = await getDB()
  await db.delete('activeWorkout', 'current')
}

// Exercise name → muscle group mapping for seed data and new exercises
const MUSCLE_GROUP_MAP: Record<string, string> = {
  'Armhävningar': 'Bröst', 'Axlar baksida rep': 'Axlar', 'Axlar sidolyft': 'Axlar',
  'Axlar sidolyft bakåt': 'Axlar', 'Benböj': 'Ben', 'Benlyft mage': 'Mage',
  'Benspark': 'Ben', 'Benspark baksida': 'Ben', 'Bicepscurl bänk': 'Biceps',
  'Bicepscurl ez stång': 'Biceps', 'Bicepscurl hantel': 'Biceps', 'Bänk': 'Bröst',
  'Chins': 'Rygg', 'Hantelpress': 'Axlar', 'Hantelrodd': 'Rygg',
  'Hip-thrusts': 'Bakre kedjan', 'Hopprep': 'Kondition', 'Hängande benlyft': 'Mage',
  'Marklyft': 'Bakre kedjan', 'Militärpress': 'Axlar', 'Situps': 'Mage',
  'Skivstångsrodd': 'Rygg', 'Snedbänk': 'Bröst', 'Snedbänk hantlar': 'Bröst',
  'Triceps pushdown': 'Triceps', 'Triceps stång': 'Triceps', 'Triceps övning': 'Triceps',
  'Vadpress skivstång': 'Ben', 'Vadpress maskin': 'Ben', 'Ab roller': 'Mage',
  'Axelpress maskin': 'Axlar', 'Latsdrag': 'Rygg', 'Leg curl': 'Ben',
  'Leg extension': 'Ben'
}

// Backfill muscleGroup on existing exercises that lack it (from the name map)
export async function backfillMuscleGroups(): Promise<number> {
  const db = await getDB()
  const exercises = await db.getAll('exercises')
  let updated = 0
  const tx = db.transaction(['exercises'], 'readwrite')
  for (const e of exercises) {
    if (!e.muscleGroup) {
      const mg = MUSCLE_GROUP_MAP[e.name]
      if (mg) {
        await tx.objectStore('exercises').put({ ...e, muscleGroup: mg })
        updated++
      }
    }
  }
  await tx.done
  return updated
}

// Template Service
export async function getAllTemplates(): Promise<Template[]> {
  const db = await getDB()
  return db.getAllFromIndex('templates', 'by-updated')
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
  await syncCloudData()
  return template
}

export async function updateTemplate(id: string, updates: Partial<Template>): Promise<Template> {
  const db = await getDB()
  const existing = await db.get('templates', id)
  if (!existing) throw new Error(`Template ${id} not found`)
  const updated = { ...existing, ...updates, updatedAt: nowISO() }
  await db.put('templates', updated)
  await syncCloudData()
  return updated
}

export async function deleteTemplate(id: string): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(['templates'], 'readwrite')
  await tx.objectStore('templates').delete(id)
  await tx.done
  await syncCloudData()
}

// Exercise Service
export async function getAllExercises(): Promise<Exercise[]> {
  const db = await getDB()
  return db.getAllFromIndex('exercises', 'by-name')
}

export async function getExercise(id: string): Promise<Exercise | undefined> {
  const db = await getDB()
  return db.get('exercises', id)
}

export async function getOrCreateExercise(name: string, muscleGroup?: string): Promise<Exercise> {
  const db = await getDB()
  const existing = await db.getFromIndex('exercises', 'by-name', name)
  if (existing) {
    if (muscleGroup && !existing.muscleGroup) {
      existing.muscleGroup = muscleGroup
      await db.put('exercises', existing)
    }
    return existing
  }
  const exercise: Exercise = {
    id: generateId(),
    name,
    muscleGroup,
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
    const totalVolume = setsVolume(e.setEntries)
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
  await clearActiveWorkout()
  await syncCloudData()

  return session
}

export async function updateSession(id: string, updates: Partial<Session>): Promise<Session> {
  const db = await getDB()
  const existing = await db.get('sessions', id)
  if (!existing) throw new Error(`Session ${id} not found`)
  const updated = { ...existing, ...updates, id }

  const history: ExerciseHistory[] = updated.exercises.map((e, i) => {
    const totalVolume = setsVolume(e.setEntries)
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
  await syncCloudData()

  return updated
}

export async function deleteSession(id: string): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(['sessions', 'exerciseHistory'], 'readwrite')
  
  const history = await tx.objectStore('exerciseHistory').index('by-session').getAll(id)
  for (const h of history) {
    await tx.objectStore('exerciseHistory').delete(h.id)
  }
  
  await tx.objectStore('sessions').delete(id)
  await tx.done
  await syncCloudData()
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

export async function getLastPerformanceForExercise(exerciseId: string): Promise<{ date: string; setEntries: SetEntry[] } | null> {
  const history = await getExerciseHistory(exerciseId)
  if (history.length === 0) return null
  const latest = history[history.length - 1]
  return {
    date: latest.date,
    setEntries: latest.setEntries
  }
}

/**
 * Antal pass per mall. Utan datumgränser räknas hela historiken.
 * `fromISO` och `toISO` är inklusive, formatet är `YYYY-MM-DD`.
 */
export async function getFrequencyPerTemplate(fromISO?: string, toISO?: string): Promise<{ templateName: string; count: number }[]> {
  const db = await getDB()
  const sessions = await db.getAll('sessions')
  const map = new Map<string, number>()
  for (const s of sessions) {
    if (fromISO && s.date < fromISO) continue
    if (toISO && s.date > toISO) continue
    // Passen från den trasiga mallen "undefined" i seeden ska inte få en egen
    // stapel, se CONTEXT.md om mallen som filtreras bort i syncSeed.
    if (!s.templateName || s.templateName === 'undefined') continue
    map.set(s.templateName, (map.get(s.templateName) || 0) + 1)
  }
  return Array.from(map.entries())
    .map(([templateName, count]) => ({ templateName, count }))
    .sort((a, b) => b.count - a.count)
}

/** Kalenderår som har minst ett pass, nyast först. Matar årsfiltret i Statistik. */
export async function getSessionYears(): Promise<number[]> {
  const db = await getDB()
  const sessions = await db.getAll('sessions')
  const years = new Set(sessions.map(s => Number(s.date.slice(0, 4))))
  return Array.from(years).sort((a, b) => b - a)
}

/**
 * Hur många gånger varje övning körts sedan `fromISO`, som `exerciseId -> antal`.
 * Används för att sortera de övningar du faktiskt tränar överst, istället för
 * bokstavsordning där armhävningar alltid hamnade först.
 */
export async function getExerciseTrainingCounts(fromISO: string): Promise<Map<string, number>> {
  const db = await getDB()
  const history = await db.getAll('exerciseHistory')
  const counts = new Map<string, number>()
  for (const h of history) {
    if (h.date < fromISO) continue
    counts.set(h.exerciseId, (counts.get(h.exerciseId) || 0) + 1)
  }
  return counts
}

export async function getHeatmapData(days: number = 30): Promise<{ date: string; count: number }[]> {
  const db = await getDB()
  const sessions = await db.getAll('sessions')
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffISO = localDateISO(cutoff)

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
    const maxWeight = Math.max(...h.setEntries.map(s => s.weight))
    const totalVolume = h.volume
    
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
// Endast set med 1-10 reps räknas för 1RM (högre reps ger inte tillförlitligt 1RM)
export async function getEstimated1RM(exerciseId: string): Promise<{ exerciseName: string; estimated1RM: number; date: string } | null> {
  const history = await getExerciseHistory(exerciseId)
  if (history.length === 0) return null

  let best: { exerciseName: string; estimated1RM: number; date: string } | null = null
  for (const h of history) {
    for (const set of h.setEntries) {
      if (set.weight > 0 && set.reps > 0 && set.reps <= 10) {
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
  
  const weekEndDate = parseLocalDate(weekStartDate)
  weekEndDate.setDate(weekEndDate.getDate() + 6)
  const weekEndISO = localDateISO(weekEndDate)
  
  return sessions
    .filter(s => s.date >= weekStartDate && s.date <= weekEndISO)
    .reduce((sum, s) => sum + exercisesVolume(s.exercises), 0)
}

// Get volume per muscle group
export async function getVolumeByMuscleGroup(): Promise<{ muscleGroup: string; volume: number; sessions: number }[]> {
  const db = await getDB()
  const [exercises, history] = await Promise.all([
    db.getAll('exercises'),
    db.getAll('exerciseHistory')
  ])
  
  const exerciseMuscleMap = new Map(exercises.map(e => [e.id, e.muscleGroup || 'Övrigt']))
  const map = new Map<string, { volume: number; sessionIds: Set<string> }>()
  
  for (const h of history) {
    const mg = exerciseMuscleMap.get(h.exerciseId) || 'Övrigt'
    const existing = map.get(mg) || { volume: 0, sessionIds: new Set() }
    existing.volume += h.volume
    existing.sessionIds.add(h.sessionId)
    map.set(mg, existing)
  }
  
  return Array.from(map.entries())
    .map(([muscleGroup, data]) => ({ muscleGroup, volume: data.volume, sessions: data.sessionIds.size }))
    .sort((a, b) => b.volume - a.volume)
}

// Hypertrofi: Hårda set per muskelgrupp för en given vecka
export async function getWeeklyHardSetsPerMuscleGroup(weekStartDate: string): Promise<{ muscleGroup: string; sets: number }[]> {
  const db = await getDB()
  const [sessions, exercises] = await Promise.all([
    db.getAll('sessions'),
    db.getAll('exercises')
  ])

  const exerciseMuscleMap = new Map(exercises.map(e => [e.id, e.muscleGroup || 'Övrigt']))
  const weekEndDate = parseLocalDate(weekStartDate)
  weekEndDate.setDate(weekEndDate.getDate() + 6)
  const weekEndISO = localDateISO(weekEndDate)

  const map = new Map<string, number>()
  for (const s of sessions) {
    if (s.date >= weekStartDate && s.date <= weekEndISO) {
      for (const ex of s.exercises) {
        const mg = exerciseMuscleMap.get(ex.exerciseId) || 'Övrigt'
        // Räkna antal set (varje setEntry i ett pass representerar 1 eller fler set)
        const totalSets = ex.setEntries.reduce((sum, set) => sum + (set.sets || 1), 0)
        map.set(mg, (map.get(mg) || 0) + totalSets)
      }
    }
  }

  return Array.from(map.entries())
    .map(([muscleGroup, sets]) => ({ muscleGroup, sets }))
    .sort((a, b) => b.sets - a.sets)
}

// Export/Import
export async function exportAllData(): Promise<string> {
  const db = await getDB()
  const tx = db.transaction(['templates', 'exercises', 'sessions', 'exerciseHistory'], 'readonly')
  const [templates, exercises, sessions, history] = await Promise.all([
    tx.objectStore('templates').getAll(),
    tx.objectStore('exercises').getAll(),
    tx.objectStore('sessions').getAll(),
    tx.objectStore('exerciseHistory').getAll()
  ])
  await tx.done
  return JSON.stringify({ templates, exercises, sessions, exerciseHistory: history }, null, 2)
}

export async function importAllData(json: string): Promise<void> {
  const db = await getDB()
  const { templates, exercises, sessions, exerciseHistory } = parseImportData(json)
  const tx = db.transaction(['templates', 'exercises', 'sessions', 'exerciseHistory'], 'readwrite')
  await Promise.all([
    tx.objectStore('templates').clear(),
    tx.objectStore('exercises').clear(),
    tx.objectStore('sessions').clear(),
    tx.objectStore('exerciseHistory').clear()
  ])
  for (const t of templates) await tx.objectStore('templates').put(t as unknown as Template)
  for (const e of exercises) await tx.objectStore('exercises').put(e as unknown as Exercise)
  for (const s of sessions) await tx.objectStore('sessions').put(s as unknown as Session)
  for (const h of exerciseHistory) await tx.objectStore('exerciseHistory').put(h as unknown as ExerciseHistory)
  await tx.done
  await syncCloudData()
}

/** Ersätt den lokala cachen med D1:s auktoritativa snapshot. */
async function replaceDataInLocal(data: {
  templates: Template[]
  exercises: Exercise[]
  sessions: Session[]
  exerciseHistory: ExerciseHistory[]
}): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(['templates', 'exercises', 'sessions', 'exerciseHistory'], 'readwrite')
  await Promise.all([
    tx.objectStore('templates').clear(),
    tx.objectStore('exercises').clear(),
    tx.objectStore('sessions').clear(),
    tx.objectStore('exerciseHistory').clear()
  ])
  for (const t of data.templates) await tx.objectStore('templates').put(t)
  for (const e of data.exercises) await tx.objectStore('exercises').put(e)
  for (const s of data.sessions) await tx.objectStore('sessions').put(s)
  for (const h of data.exerciseHistory) await tx.objectStore('exerciseHistory').put(h)
  await tx.done
}

function exerciseKey(name: string): string {
  return name.trim().toLowerCase()
}

function sessionKey(date: string, templateName: string): string {
  return `${date} ${templateName}`
}

export async function syncSeed(): Promise<{ sessionsAdded: number; exercisesAdded: number }> {
  await loadSnapshotFromCloud(
    JSON.parse(await exportAllData()) as {
      templates: Template[]
      exercises: Exercise[]
      sessions: Session[]
      exerciseHistory: ExerciseHistory[]
    },
    replaceDataInLocal
  )
  await backfillMuscleGroups()

  const db = await getDB()
  const { seedTemplates, seedExercises, seedSessions } = await import('../db/seedData')

  const [existingExercises, existingTemplates, existingSessions] = await Promise.all([
    db.getAll('exercises'),
    db.getAll('templates'),
    db.getAll('sessions')
  ])

  // Seeden är en engångsimport i en tom databas. Den var additiv vid varje uppstart,
  // och då kom varje raderat seedpass tillbaka nästa gång appen laddades.
  if (existingExercises.length || existingTemplates.length || existingSessions.length) {
    await syncCloudData()
    return { sessionsAdded: 0, exercisesAdded: 0 }
  }

  const exerciseIdByName = new Map(existingExercises.map(e => [exerciseKey(e.name), e.id]))
  const templateIdByName = new Map(existingTemplates.map(t => [exerciseKey(t.name), t.id]))
  const haveSession = new Set(existingSessions.map(s => sessionKey(s.date, s.templateName)))
  const seedNameById = new Map(seedExercises.map(e => [e.id, e.name]))

  const newExercises: Exercise[] = []
  for (const e of seedExercises) {
    if (exerciseIdByName.has(exerciseKey(e.name))) continue
    exerciseIdByName.set(exerciseKey(e.name), e.id)
    const mg = MUSCLE_GROUP_MAP[e.name]
    newExercises.push(mg ? { ...e, muscleGroup: mg } : e)
  }

  const newTemplates: Template[] = []
  for (const t of seedTemplates) {
    if (templateIdByName.has(exerciseKey(t.name))) continue
    if (t.name === 'undefined') continue
    templateIdByName.set(exerciseKey(t.name), t.id)
    newTemplates.push({
      ...t,
      exercises: t.exercises.map(te => {
        const migrated = migrateTemplateExercise(te as unknown as LegacyTemplateExercise)
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

  const newSessions: Session[] = []
  const newHistory: ExerciseHistory[] = []
  for (const s of seedSessions) {
    if (haveSession.has(sessionKey(s.date, s.templateName))) continue
    const migratedSession = migrateSession(s as LegacySession)
    migratedSession.templateId = templateIdByName.get(exerciseKey(s.templateName)) ?? s.templateId
    
    migratedSession.exercises = migratedSession.exercises.map(e => ({
      ...e,
      exerciseId: exerciseIdByName.get(exerciseKey(e.exerciseName)) ?? e.exerciseId
    }))
    
    newSessions.push(migratedSession)
    
    for (const e of migratedSession.exercises) {
      const totalVolume = setsVolume(e.setEntries)
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
    await syncCloudData()
    return { sessionsAdded: 0, exercisesAdded: 0 }
  }

  const tx = db.transaction(['templates', 'exercises', 'sessions', 'exerciseHistory'], 'readwrite')
  for (const e of newExercises) await tx.objectStore('exercises').put(e)
  for (const t of newTemplates) await tx.objectStore('templates').put(t)
  for (const s of newSessions) await tx.objectStore('sessions').put(s)
  for (const h of newHistory) await tx.objectStore('exerciseHistory').put(h)
  await tx.done

  await syncCloudData()

  return { sessionsAdded: newSessions.length, exercisesAdded: newExercises.length }
}

export async function exportSessionsCSV(): Promise<string> {
  const sessions = await getAllSessions()
  const headers = ['Datum', 'Pass', 'Övning', 'Set', 'Reps', 'Vikt (kg)', 'Volym']
  const rows = [headers.join(',')]
  for (const s of sessions) {
    for (const e of s.exercises) {
      for (const set of e.setEntries) {
        rows.push([
          s.date,
          `"${s.templateName}"`,
          `"${e.exerciseName}"`,
          set.sets,
          set.reps,
          set.weight,
          setVolume(set)
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
  await syncCloudData()
}

async function syncCloudData(): Promise<void> {
  const data = await exportAllData()
  await syncSnapshot(JSON.parse(data) as {
    templates: Template[]
    exercises: Exercise[]
    sessions: Session[]
    exerciseHistory: ExerciseHistory[]
  })
}
