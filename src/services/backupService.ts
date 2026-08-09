import { exportAllData } from './dataService'

// Typdefinition för File System Access API
declare global {
  interface Window {
    showSaveFilePicker: (options?: SaveFilePickerOptions) => Promise<FileSystemFileHandle>
  }
}

interface SaveFilePickerOptions {
  suggestedName?: string
  types?: FilePickerAcceptType[]
}

interface FilePickerAcceptType {
  description: string
  accept: Record<string, string[]>
}

interface FileSystemFileHandle {
  createWritable: () => Promise<FileSystemWritableFileStream>
}

interface FileSystemWritableFileStream {
  write: (data: string) => Promise<void>
  close: () => Promise<void>
}

const LAST_BACKUP_KEY = 'beefcake-last-backup'
const BANNER_DISMISSED_KEY = 'beefcake-backup-banner-dismissed'
const STALE_DAYS = 30

// Exportera all data som JSON
export async function exportAllDataAsJSON(): Promise<string> {
  return exportAllData()
}

// Spara till fil via File System Access API
export async function saveBackupToFile(): Promise<{ success: boolean; error?: string }> {
  try {
    const json = await exportAllDataAsJSON()
    const date = new Date().toISOString().split('T')[0]
    const filename = `beefcake-backup-${date}.json`

    if (window.showSaveFilePicker) {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{
          description: 'JSON-filer',
          accept: { 'application/json': ['.json'] }
        }]
      })
      const writable = await handle.createWritable()
      await writable.write(json)
      await writable.close()
    } else {
      // Fallback för webbläsare som inte stödjer File System Access API
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    }

    // Spara senaste backup-datum
    localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString())
    // Rensa banner-dismiss för att visa banner om det behövs igen
    sessionStorage.removeItem(BANNER_DISMISSED_KEY)

    return { success: true }
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Okänt fel'
    return { success: false, error }
  }
}

// Ladda senaste backup-datum från localStorage
export function getLastBackupDate(): Date | null {
  const stored = localStorage.getItem(LAST_BACKUP_KEY)
  if (!stored) return null
  try {
    const date = new Date(stored)
    return isNaN(date.getTime()) ? null : date
  } catch {
    return null
  }
}

// Kontrollera om backup är för gammal (>30 dagar)
export function isBackupStale(): boolean {
  const lastBackup = getLastBackupDate()
  if (!lastBackup) return true

  const now = new Date()
  const daysSinceBackup = (now.getTime() - lastBackup.getTime()) / (1000 * 60 * 60 * 24)
  return daysSinceBackup > STALE_DAYS
}

// Dölj banner för sessionen
export function dismissBackupBanner(): void {
  sessionStorage.setItem(BANNER_DISMISSED_KEY, 'true')
}

// Kontrollera om banner ska visas
export function shouldShowBackupBanner(): boolean {
  if (sessionStorage.getItem(BANNER_DISMISSED_KEY)) return false
  return isBackupStale()
}
