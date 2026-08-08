import { openDB, DBSchema, IDBPDatabase } from 'idb'

export interface Exercise {
  id: string
  name: string
  muscleGroup?: string
  equipment?: string
  createdAt: string
}

export interface TemplateExercise {
  exerciseId: string
  defaultSets: number
  defaultReps: number
  defaultWeight: number
  order: number
}

export interface Template {
  id: string
  name: string
  exercises: TemplateExercise[]
  updatedAt: string
}

export interface SessionExercise {
  exerciseId: string
  exerciseName: string
  sets: number
  reps: number
  weight: number
  order: number
}

export interface Session {
  id: string
  date: string
  templateId: string
  templateName: string
  exercises: SessionExercise[]
  createdAt: string
}

export interface ExerciseHistory {
  id: string
  date: string
  exerciseId: string
  exerciseName: string
  sets: number
  reps: number
  weight: number
  volume: number
  sessionId: string
}

export interface BeefcakeDB extends DBSchema {
  templates: {
    key: string
    value: Template
    indexes: { 'by-name': string; 'by-updated': string }
  }
  exercises: {
    key: string
    value: Exercise
    indexes: { 'by-name': string; 'by-muscle': string }
  }
  sessions: {
    key: string
    value: Session
    indexes: { 'by-date': string; 'by-template': string }
  }
  exerciseHistory: {
    key: string
    value: ExerciseHistory
    indexes: { 'by-exercise': string; 'by-date': string; 'by-session': string }
  }
}

const DB_NAME = 'beefcake-db'
const DB_VERSION = 1

let dbInstance: IDBPDatabase<BeefcakeDB> | null = null

export async function getDB(): Promise<IDBPDatabase<BeefcakeDB>> {
  if (dbInstance) return dbInstance

  dbInstance = await openDB<BeefcakeDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('templates')) {
        const templateStore = db.createObjectStore('templates', { keyPath: 'id' })
        templateStore.createIndex('by-name', 'name', { unique: true })
        templateStore.createIndex('by-updated', 'updatedAt')
      }
      if (!db.objectStoreNames.contains('exercises')) {
        const exerciseStore = db.createObjectStore('exercises', { keyPath: 'id' })
        exerciseStore.createIndex('by-name', 'name', { unique: true })
        exerciseStore.createIndex('by-muscle', 'muscleGroup')
      }
      if (!db.objectStoreNames.contains('sessions')) {
        const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' })
        sessionStore.createIndex('by-date', 'date')
        sessionStore.createIndex('by-template', 'templateId')
      }
      if (!db.objectStoreNames.contains('exerciseHistory')) {
        const historyStore = db.createObjectStore('exerciseHistory', { keyPath: 'id' })
        historyStore.createIndex('by-exercise', 'exerciseId')
        historyStore.createIndex('by-date', 'date')
        historyStore.createIndex('by-session', 'sessionId')
      }
    }
  })

  return dbInstance
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function nowISO(): string {
  return new Date().toISOString()
}

export function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}