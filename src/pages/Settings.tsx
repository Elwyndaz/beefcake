import { useState, useEffect } from 'preact/hooks'
import { getAllTemplates, exportAllData, importAllData, exportSessionsCSV, clearAllData } from '../services/dataService'
import { saveBackupToFile } from '../services/backupService'
import { icon } from '../icons'
import { Card } from '../components/Card'
import { Button } from '../components/Button'
import { EmptyState } from '../components/EmptyState'
import { Field } from '../components/Field'
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
          <Button variant="secondary" onClick={onClose}>Avbryt</Button>
          <Button variant="danger" onClick={onConfirm}>Radera</Button>
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
      const result = await saveBackupToFile()
      if (!result.success) throw new Error(result.error ?? 'Okänt fel')
      setToastMessage('Manuell backup sparad')
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
        <Card class="skeleton skeleton-card"></Card>
        <Card class="skeleton skeleton-card"></Card>
        <Card class="skeleton skeleton-card"></Card>
        {toastMessage && <Toast message={toastMessage} onDismiss={dismissToast} />}
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <h1 class="page-title">Inställningar</h1>
        <EmptyState
          title="Något gick fel"
          message={error}
          action={<Button onClick={dismissError}>Försök igen</Button>}
        />
        {toastMessage && <Toast message={toastMessage} onDismiss={dismissToast} />}
      </div>
    )
  }

  return (
    <div>
      <h1 class="page-title">Inställningar</h1>

      {templates.length === 0 ? (
        <Card class="mb">
          <EmptyState
            title="Inga mallar ännu"
            message="Skapa din första mall för att komma igång."
            action={<Button href="/templates">Skapa mall</Button>}
          />
        </Card>
      ) : null}

      <Card title="Export / Import">
        <div class="flex gap mb">
          <Button variant="secondary" onClick={handleExportJSON}>Export JSON (hela DB)</Button>
          <Button variant="secondary" onClick={handleExportCSV}>Export CSV (passlista)</Button>
        </div>
        <div class="flex gap mb">
          <Button onClick={handleBackup}>Spara manuell backup</Button>
        </div>
        <p class="mb text-muted">
          Export och import är en manuell nödräddning. D1 är appens ordinarie lagring.
        </p>
        <Field label="Import JSON" class="m-0">
          <input
            type="file"
            accept=".json"
            onChange={handleFileImport}
            disabled={importing}
          />
        </Field>
      </Card>

      <Card title="Data">
        <p class="mb text-muted">
          D1 är sanningskällan. IndexedDB är lokal cache och serverkopplingen skyddas av Cloudflare Access.
        </p>
        <Button variant="danger" onClick={handleClearAll}>Radera ALL data</Button>
      </Card>

      <Card title="Om">
        <p>Beefcake, träningslogg för styrketräning</p>
        <p class="text-sm text-muted m-0">
          Byggd med Preact, TypeScript, IndexedDB, Chart.js, Workbox PWA.
        </p>
      </Card>

      {/* Import confirmation dialog */}
      <DeleteDialog
        isOpen={importDialogOpen}
        onClose={dismissImportDialog}
        onConfirm={confirmImport}
        title="Import JSON"
        message="Detta kommer att ersätta ALL data. Är du säker?"
      />

      {/* Clear all data dialog with text confirmation */}
      {clearDialogOpen && (
        <div class="dialog-overlay" onClick={dismissClearDialog}>
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
              <Button variant="secondary" onClick={dismissClearDialog}>Avbryt</Button>
              <Button variant="danger" onClick={confirmClearAll}>Radera</Button>
            </div>
          </div>
        </div>
      )}

      {toastMessage && <Toast message={toastMessage} onDismiss={dismissToast} />}
    </div>
  )
}
