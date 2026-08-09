import { useState, useEffect } from 'preact/hooks'
import { getAllTemplates, exportAllData, importAllData, exportSessionsCSV, clearAllData } from '../services/dataService'
import { saveBackupToFile } from '../services/backupService'
import { icon } from '../icons'
import type { Template } from '../models'

// Toast component
function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 3000)
    return () => clearTimeout(timer)
  }, [onDismiss])

  return (
    <div class="toast" onClick={onDismiss}>
      {message}
    </div>
  )
}

// Delete confirmation dialog
function DeleteDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message
}: {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
}) {
  if (!isOpen) return null

  return (
    <div class="dialog-overlay" onClick={onClose}>
      <div class="dialog" onClick={e => e.stopPropagation()}>
        <div class="flex justify-between items-center mb">
          <h3 class="m-0">{title}</h3>
          <button class="banner-dismiss" onClick={onClose} aria-label="Stäng">
            <svg width="16" height="16" viewBox="0 0 19 19"><use href={icon('x-icon')} /></svg>
          </button>
        </div>
        <p>{message}</p>
        <div class="flex gap mt justify-end">
          <button class="btn btn-secondary" onClick={onClose}>Avbryt</button>
          <button class="btn btn-danger" onClick={onConfirm}>Radera</button>
        </div>
      </div>
    </div>
  )
}

export function Settings() {
  const [importing, setImporting] = useState(false)
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [clearDialogOpen, setClearDialogOpen] = useState(false)
  const [clearConfirmText, setClearConfirmText] = useState('')

  async function loadData() {
    try {
      setLoading(true)
      setError(null)
      const ts = await getAllTemplates()
      setTemplates(ts)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Okänt fel')
      console.error('Fel vid laddning av inställningar:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  async function handleExportJSON() {
    try {
      const json = await exportAllData()
      downloadFile(json, 'beefcake-backup.json', 'application/json')
    } catch (err) {
      console.error('Fel vid export:', err)
      setError('Kunde inte exportera data. Försök igen.')
    }
  }

  async function handleExportCSV() {
    try {
      const csv = await exportSessionsCSV()
      downloadFile(csv, 'beefcake-sessions.csv', 'text/csv')
    } catch (err) {
      console.error('Fel vid export:', err)
      setError('Kunde inte exportera data. Försök igen.')
    }
  }

  async function handleBackup() {
    try {
      await saveBackupToFile()
    } catch (err) {
      console.error('Fel vid backup:', err)
      setError('Kunde inte spara backup. Försök igen.')
    }
  }

  function downloadFile(content: string, filename: string, type: string) {
    const blob = new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleFileImport(e: Event) {
    const target = e.target as HTMLInputElement
    const file = target.files?.[0]
    if (file) {
      setImportFile(file)
      setImportDialogOpen(true)
    }
  }

  function dismissImportDialog() {
    setImportDialogOpen(false)
    setImportFile(null)
  }

  async function confirmImport() {
    if (!importFile) return
    setImportDialogOpen(false)
    setImporting(true)
    try {
      const text = await importFile.text()
      await importAllData(text)
      setToastMessage('Import klart! Laddar om sidan...')
      setTimeout(() => {
        window.location.reload()
      }, 500)
    } catch (err) {
      console.error(err)
      setToastMessage('Import misslyckades')
    } finally {
      setImporting(false)
      setImportFile(null)
    }
  }

  function dismissClearDialog() {
    setClearDialogOpen(false)
    setClearConfirmText('')
  }

  async function confirmClearAll() {
    if (clearConfirmText !== 'RADERA') {
      setToastMessage('Bekräftelse misslyckades')
      dismissClearDialog()
      return
    }
    setClearDialogOpen(false)
    setClearConfirmText('')
    await clearAllData()
    setToastMessage('All data raderad. Laddar om...')
    setTimeout(() => {
      window.location.reload()
    }, 500)
  }

  function handleClearAll() {
    setClearDialogOpen(true)
  }

  function handleClearConfirmChange(e: Event) {
    const target = e.target as HTMLInputElement
    setClearConfirmText(target.value)
  }

  function dismissError() {
    setError(null)
    loadData()
  }

  function dismissToast() {
    setToastMessage(null)
  }

  if (loading) {
    return (
      <div>
        <h1 class="page-title">Inställningar</h1>
        <div class="card skeleton skeleton-card"></div>
        <div class="card skeleton skeleton-card"></div>
        <div class="card skeleton skeleton-card"></div>
        {toastMessage && <Toast message={toastMessage} onDismiss={dismissToast} />}
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <h1 class="page-title">Inställningar</h1>
        <div class="card">
          <div class="empty-state">
            <h3>Något gick fel</h3>
            <p>{error}</p>
            <button class="btn btn-primary mt" onClick={dismissError}>Försök igen</button>
          </div>
        </div>
        {toastMessage && <Toast message={toastMessage} onDismiss={dismissToast} />}
      </div>
    )
  }

  return (
    <div>
      <h1 class="page-title">Inställningar</h1>

      {templates.length === 0 ? (
        <div class="card mb">
          <div class="empty-state">
            <h3>Inga mallar än</h3>
            <p>Skapa din första mall för att komma igång.</p>
            <a href="/templates" class="btn btn-primary mt">Skapa mall</a>
          </div>
        </div>
      ) : null}

      <div class="card mb">
        <h3>Export / Import</h3>
        <div class="flex gap mb">
          <button class="btn btn-secondary" onClick={handleExportJSON}>Export JSON (hela DB)</button>
          <button class="btn btn-secondary" onClick={handleExportCSV}>Export CSV (passlista)</button>
        </div>
        <div class="flex gap mb">
          <button class="btn btn-primary" onClick={handleBackup}>Ladda ned full backup</button>
        </div>
        <div class="input-group">
          <label>Import JSON</label>
          <input
            type="file"
            accept=".json"
            onChange={handleFileImport}
            disabled={importing}
          />
        </div>
      </div>

      <div class="card mb">
        <h3>Data</h3>
        <p class="mb text-muted">
          All data lagras lokalt i din webbläsare (IndexedDB). Inget skickas till server.
        </p>
        <button class="btn btn-danger" onClick={handleClearAll}>Radera ALL data</button>
      </div>

      <div class="card">
        <h3>Om</h3>
        <p>Beefcake — Träningslogg för styrketräning</p>
        <p class="text-sm text-muted">
          Byggd med Preact, TypeScript, IndexedDB, Chart.js, Workbox PWA.
        </p>
      </div>

      {/* Import confirmation dialog */}
      <DeleteDialog
        isOpen={importDialogOpen}
        onClose={dismissImportDialog}
        onConfirm={confirmImport}
        title="Import JSON"
        message="Detta kommer att ersätta ALL data. Är du säker?"
      />

      {/* Clear all data dialog with text confirmation */}
      <div class="dialog-overlay" style={{ display: clearDialogOpen ? 'block' : 'none' }} onClick={dismissClearDialog}>
        <div class="dialog" onClick={e => e.stopPropagation()}>
          <div class="flex justify-between items-center mb">
            <h3 class="m-0">Radera ALL data</h3>
            <button class="banner-dismiss" onClick={dismissClearDialog} aria-label="Stäng">
              <svg width="16" height="16" viewBox="0 0 19 19"><use href={icon('x-icon')} /></svg>
            </button>
          </div>
          <p>VARNING: Detta raderar ALL data permanent. Är du helt säker?</p>
          <p class="mt">Skriv "RADERA" för att bekräfta:</p>
          <div class="input-group mt">
            <input
              type="text"
              value={clearConfirmText}
              onChange={handleClearConfirmChange}
              placeholder="RADERA"
            />
          </div>
          <div class="flex gap mt justify-end">
            <button class="btn btn-secondary" onClick={dismissClearDialog}>Avbryt</button>
            <button class="btn btn-danger" onClick={confirmClearAll}>Radera</button>
          </div>
        </div>
      </div>

      {toastMessage && <Toast message={toastMessage} onDismiss={dismissToast} />}
    </div>
  )
}