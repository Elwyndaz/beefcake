import * as XLSX from 'xlsx'
import { getDB, generateId, nowISO } from '../models'
import type { Template, Exercise, Session, ExerciseHistory, TemplateExercise, SessionExercise } from '../models'

interface ExcelRow {
  Datum: number
  Övning: string
  Vikt: number
  Set: number
  Repetitioner: number
  Pass: string
  'Total antal reps': number
  'Total vikt lyft': number
  'Värde på pass': number
}

function excelDateToISO(excelDate: number): string {
  const utcDays = Math.floor(excelDate - 25569)
  const utcValue = utcDays * 86400
  const dateInfo = new Date(utcValue * 1000)
  return `${dateInfo.getUTCFullYear()}-${String(dateInfo.getUTCMonth() + 1).padStart(2, '0')}-${String(dateInfo.getUTCDate()).padStart(2, '0')}`
}

function normalizeName(name: string): string {
  return name.trim()
}

export async function migrateFromExcel(file: File): Promise<{ templates: number; exercises: number; sessions: number; history: number }> {
  const db = await getDB()
  const arrayBuffer = await file.arrayBuffer()
  const workbook = XLSX.read(arrayBuffer, { type: 'array' })

  const sheetName = workbook.SheetNames.find(s => s === 'Träningsdata') || workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]
  const jsonData = XLSX.utils.sheet_to_json<ExcelRow>(worksheet)

  const exerciseMap = new Map<string, Exercise>()
  const templateMap = new Map<string, { id: string; exercises: TemplateExercise[] }>()
  const sessionMap = new Map<string, { id: string; templateId: string; templateName: string; date: string; exercises: SessionExercise[] }>()

  let orderCounter = 0

  for (const row of jsonData) {
    if (!row.Övning || !row.Datum) continue

    const dateISO = excelDateToISO(row.Datum)
    const exerciseName = normalizeName(row.Övning)
    const templateName = normalizeName(row.Pass)

    if (!exerciseMap.has(exerciseName)) {
      exerciseMap.set(exerciseName, {
        id: generateId(),
        name: exerciseName,
        muscleGroup: undefined,
        equipment: undefined,
        createdAt: nowISO()
      })
    }
    const exercise = exerciseMap.get(exerciseName)!

    if (!templateMap.has(templateName)) {
      templateMap.set(templateName, {
        id: generateId(),
        exercises: []
      })
    }
    const template = templateMap.get(templateName)!

    const existingTemplateExercise = template.exercises.find(te => te.exerciseId === exercise.id)
    if (!existingTemplateExercise) {
      template.exercises.push({
        exerciseId: exercise.id,
        defaultSets: row.Set,
        defaultReps: row.Repetitioner,
        defaultWeight: row.Vikt,
        order: orderCounter++
      })
    } else {
      existingTemplateExercise.defaultSets = row.Set
      existingTemplateExercise.defaultReps = row.Repetitioner
      existingTemplateExercise.defaultWeight = row.Vikt
    }

    const sessionKey = `${dateISO}-${templateName}`
    if (!sessionMap.has(sessionKey)) {
      sessionMap.set(sessionKey, {
        id: generateId(),
        templateId: template.id,
        templateName,
        date: dateISO,
        exercises: []
      })
    }
    const session = sessionMap.get(sessionKey)!
    session.exercises.push({
      exerciseId: exercise.id,
      exerciseName,
      sets: row.Set,
      reps: row.Repetitioner,
      weight: row.Vikt,
      order: session.exercises.length
    })
  }

  for (const template of templateMap.values()) {
    template.exercises.sort((a, b) => a.order - b.order)
  }

  const tx = db.transaction(['templates', 'exercises', 'sessions', 'exerciseHistory'], 'readwrite')

  for (const exercise of exerciseMap.values()) {
    await tx.objectStore('exercises').put(exercise)
  }

  const templates: Template[] = []
  for (const [name, data] of templateMap.entries()) {
    const template: Template = {
      id: data.id,
      name,
      exercises: data.exercises,
      updatedAt: nowISO()
    }
    templates.push(template)
    await tx.objectStore('templates').put(template)
  }

  const history: ExerciseHistory[] = []
  for (const sessionData of sessionMap.values()) {
    const session: Session = {
      id: sessionData.id,
      date: sessionData.date,
      templateId: sessionData.templateId,
      templateName: sessionData.templateName,
      exercises: sessionData.exercises.sort((a, b) => a.order - b.order),
      createdAt: nowISO()
    }
    await tx.objectStore('sessions').put(session)

    for (const se of session.exercises) {
      history.push({
        id: generateId(),
        date: session.date,
        exerciseId: se.exerciseId,
        exerciseName: se.exerciseName,
        sets: se.sets,
        reps: se.reps,
        weight: se.weight,
        volume: se.sets * se.reps * se.weight,
        sessionId: session.id
      })
    }
  }

  for (const h of history) {
    await tx.objectStore('exerciseHistory').put(h)
  }

  await tx.done

  return {
    templates: templates.length,
    exercises: exerciseMap.size,
    sessions: sessionMap.size,
    history: history.length
  }
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