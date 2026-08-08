import { useState } from 'preact/hooks'
import { exportAllData, importAllData, exportSessionsCSV, clearAllData } from '../services/dataService'

export function Settings() {
  const [importing, setImporting] = useState(false)

  async function handleExportJSON() {
    const json = await exportAllData()
    downloadFile(json, 'beefcake-backup.json', 'application/json')
  }

  async function handleExportCSV() {
    const csv = await exportSessionsCSV()
    downloadFile(csv, 'beefcake-sessions.csv', 'text/csv')
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
    if (file) handleImportJSON(file)
  }

  async function handleImportJSON(file: File) {
    if (!confirm('Detta kommer att ersätta ALL data. Är du säker?')) return
    setImporting(true)
    try {
      const text = await file.text()
      await importAllData(text)
      alert('Import klart! Laddar om sidan...')
      window.location.reload()
    } catch (err) {
      console.error(err)
      alert('Import misslyckades')
    } finally {
      setImporting(false)
    }
  }

  async function handleClearAll() {
    if (!confirm('VARNING: Detta raderar ALL data permanent. Är du helt säker?')) return
    const confirmText = prompt('Skriv "RADERA" för att bekräfta:')
    if (confirmText !== 'RADERA') return
    await clearAllData()
    alert('All data raderad. Laddar om...')
    window.location.reload()
  }

  return (
    <div>
      <h1 class="page-title">Inställningar</h1>

      <div class="card mb">
        <h3>Export / Import</h3>
        <div class="flex gap mb">
          <button class="btn btn-secondary" onClick={handleExportJSON}>Export JSON (hela DB)</button>
          <button class="btn btn-secondary" onClick={handleExportCSV}>Export CSV (passlista)</button>
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
        <p class="mb" style="color: var(--text-muted);">
          All data lagras lokalt i din webbläsare (IndexedDB). Inget skickas till server.
        </p>
        <button class="btn btn-danger" onClick={handleClearAll}>Radera ALL data</button>
      </div>

      <div class="card">
        <h3>Om</h3>
        <p>Beefcake — Träningslogg för styrketräning</p>
        <p style="font-size: 0.9rem; color: var(--text-muted);">
          Byggd med Preact, TypeScript, IndexedDB, Chart.js, Workbox PWA.
        </p>
      </div>
    </div>
  )
}