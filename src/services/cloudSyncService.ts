import { getDB } from '../models'
import type { Exercise, ExerciseHistory, Session, Template } from '../models'

export interface SnapshotData {
  templates: Template[]
  exercises: Exercise[]
  sessions: Session[]
  exerciseHistory: ExerciseHistory[]
}

interface ServerSnapshot {
  revision: number
  data: SnapshotData | null
}

const REVISION_SETTING_KEY = 'server-revision'
const apiUrl = typeof import.meta.env.VITE_BEEFCAKE_API_URL === 'string'
  ? import.meta.env.VITE_BEEFCAKE_API_URL.replace(/\/$/, '')
  : ''
let syncQueue: Promise<void> = Promise.resolve()

export function isCloudSyncConfigured(): boolean {
  return apiUrl.length > 0
}

async function getKnownRevision(): Promise<number> {
  const db = await getDB()
  const setting = await db.get('settings', REVISION_SETTING_KEY)
  const value = setting?.value
  return typeof value === 'number' ? value : 0
}

async function setKnownRevision(revision: number): Promise<void> {
  const db = await getDB()
  await db.put('settings', { key: REVISION_SETTING_KEY, value: revision })
}

async function getServerSnapshot(): Promise<ServerSnapshot> {
  const response = await fetch(`${apiUrl}/api/snapshot`, { credentials: 'include' })
  if (!response.ok) throw new Error(`Servern kunde inte läsas (${response.status}).`)
  return response.json() as Promise<ServerSnapshot>
}

function mergeSnapshots(local: SnapshotData, remote: SnapshotData): SnapshotData {
  return {
    templates: mergeById(remote.templates, local.templates),
    exercises: mergeById(remote.exercises, local.exercises),
    sessions: mergeById(remote.sessions, local.sessions),
    exerciseHistory: mergeById(remote.exerciseHistory, local.exerciseHistory)
  }
}

function mergeById<T extends { id: string }>(primary: T[], secondary: T[]): T[] {
  const result = [...primary]
  const ids = new Set(primary.map(item => item.id))
  for (const item of secondary) {
    if (!ids.has(item.id)) {
      result.push(item)
      ids.add(item.id)
    }
  }
  return result
}

export async function syncSnapshot(snapshot: SnapshotData): Promise<void> {
  const next = syncQueue.then(() => syncSnapshotNow(snapshot))
  syncQueue = next.catch(() => undefined)
  return next
}

async function syncSnapshotNow(snapshot: SnapshotData): Promise<void> {
  if (!isCloudSyncConfigured()) return

  const knownRevision = await getKnownRevision()
  const server = await getServerSnapshot()
  let data = snapshot
  let expectedRevision = knownRevision

  if (server.revision === 0 && server.data === null) {
    expectedRevision = 0
  } else if (knownRevision === 0 && server.data) {
    // Första anslutningen: slå ihop lokal data och serverdata så inget av dem
    // försvinner. Därefter kräver alla skrivningar rätt revision.
    data = mergeSnapshots(snapshot, server.data)
    const { mergeDataIntoLocal } = await import('./dataService')
    await mergeDataIntoLocal(data)
    expectedRevision = server.revision
  } else if (server.revision !== knownRevision) {
    throw new Error(`Serverkonflikt: lokal revision ${knownRevision}, serverrevision ${server.revision}.`)
  }

  const response = await fetch(`${apiUrl}/api/snapshot`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expectedRevision, data })
  })
  if (!response.ok) {
    if (response.status === 409) throw new Error('Servern har ändrats. Ingen lokal data skrevs över.')
    throw new Error(`Servern kunde inte spara (${response.status}).`)
  }

  const result = await response.json() as { revision: number }
  await setKnownRevision(result.revision)
}
