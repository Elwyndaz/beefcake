import { getDB } from '../models'

interface BackupFileHandle {
  createWritable: () => Promise<BackupWritable>
  getFile: () => Promise<{ text: () => Promise<string> }>
  queryPermission?: (descriptor?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>
}

interface BackupWritable {
  write: (data: string) => Promise<void>
  close: () => Promise<void>
}

interface SaveFilePickerOptions {
  suggestedName?: string
  types?: Array<{
    description: string
    accept: Record<string, string[]>
  }>
}

declare global {
  interface Window {
    showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<BackupFileHandle>
  }
}

interface BackupTarget {
  handle: BackupFileHandle | null
  lastBackupAt: string | null
}

const BACKUP_SETTING_KEY = 'backup-target'
const BANNER_DISMISSED_KEY = 'beefcake-backup-banner-dismissed'
const STALE_DAYS = 30

let backupQueue: Promise<void> = Promise.resolve()

async function getBackupTarget(): Promise<BackupTarget> {
  const db = await getDB()
  const setting = await db.get('settings', BACKUP_SETTING_KEY)
  const value = setting?.value
  if (!value || typeof value !== 'object') {
    return { handle: null, lastBackupAt: null }
  }

  const stored = value as { handle?: BackupFileHandle | null; lastBackupAt?: string | null }
  return {
    handle: stored.handle ?? null,
    lastBackupAt: stored.lastBackupAt ?? null
  }
}

async function saveBackupTarget(target: BackupTarget): Promise<void> {
  const db = await getDB()
  await db.put('settings', { key: BACKUP_SETTING_KEY, value: target })
}

async function hasWritePermission(handle: BackupFileHandle): Promise<boolean> {
  if (!handle.queryPermission) return true
  return (await handle.queryPermission({ mode: 'readwrite' })) === 'granted'
}

async function writeBackup(handle: BackupFileHandle, json: string): Promise<void> {
  const writable = await handle.createWritable()
  try {
    await writable.write(json)
  } finally {
    await writable.close()
  }
}

async function writeConfiguredBackup(json: string): Promise<boolean> {
  const target = await getBackupTarget()
  if (!target.handle || !(await hasWritePermission(target.handle))) return false

  await writeBackup(target.handle, json)
  await saveBackupTarget({ ...target, lastBackupAt: new Date().toISOString() })
  return true
}

export async function exportAllDataAsJSON(): Promise<string> {
  const { exportAllData } = await import('./dataService')
  return exportAllData()
}

/** Skriver automatiska backups i ordning, så äldre snapshots inte vinner racet. */
export async function saveAutomaticBackup(json: string): Promise<void> {
  backupQueue = backupQueue
    .then(async () => {
      await writeConfiguredBackup(json)
    })
    .catch(err => {
      console.error('Backup failed:', err)
    })

  await backupQueue
}

export async function saveBackupToFile(): Promise<{ success: boolean; error?: string }> {
  try {
    const { exportAllData } = await import('./dataService')
    const json = await exportAllData()
    if (await writeConfiguredBackup(json)) return { success: true }

    const filename = `beefcake-backup-${new Date().toISOString().split('T')[0]}.json`
    if (window.showSaveFilePicker) {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{
          description: 'JSON-filer',
          accept: { 'application/json': ['.json'] }
        }]
      })
      const target = { handle, lastBackupAt: null }
      await writeBackup(handle, json)
      await saveBackupTarget({ ...target, lastBackupAt: new Date().toISOString() })
      return { success: true }
    }

    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    await saveBackupTarget({ handle: null, lastBackupAt: new Date().toISOString() })
    return { success: true }
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Okänt fel'
    return { success: false, error }
  }
}

export async function restoreFromBackupFile(): Promise<void> {
  try {
    const target = await getBackupTarget()
    if (!target.handle) return
    if (target.handle.queryPermission && !(await hasWritePermission(target.handle))) return
    const file = await target.handle.getFile()
    const { importAllData } = await import('./dataService')
    await importAllData(await file.text())
  } catch (err) {
    console.error('Restore failed:', err)
  }
}

export async function getLastBackupDate(): Promise<Date | null> {
  const stored = (await getBackupTarget()).lastBackupAt
  if (!stored) return null
  const date = new Date(stored)
  return Number.isNaN(date.getTime()) ? null : date
}

export async function isBackupStale(): Promise<boolean> {
  const lastBackup = await getLastBackupDate()
  if (!lastBackup) return true

  const daysSinceBackup = (Date.now() - lastBackup.getTime()) / (1000 * 60 * 60 * 24)
  return daysSinceBackup > STALE_DAYS
}

export function dismissBackupBanner(): void {
  sessionStorage.setItem(BANNER_DISMISSED_KEY, 'true')
}

export function isBackupBannerDismissed(): boolean {
  return !!sessionStorage.getItem(BANNER_DISMISSED_KEY)
}

export async function shouldShowBackupBanner(): Promise<boolean> {
  if (isBackupBannerDismissed()) return false
  return isBackupStale()
}
