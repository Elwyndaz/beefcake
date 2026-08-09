import { useState, useEffect } from 'preact/hooks'
import { saveBackupToFile, shouldShowBackupBanner, dismissBackupBanner, getLastBackupDate } from '../services/backupService'

export function BackupBanner() {
  const [showBanner, setShowBanner] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    setShowBanner(shouldShowBackupBanner())
  }, [])

  if (!showBanner) return null

  const lastBackup = getLastBackupDate()
  const formattedDate = lastBackup 
    ? lastBackup.toLocaleDateString('sv-SE')
    : 'aldrig'

  async function handleDownloadBackup() {
    setIsLoading(true)
    const result = await saveBackupToFile()
    setIsLoading(false)
    if (result.success) {
      setShowBanner(false)
      dismissBackupBanner()
    }
  }

  function handleDismiss() {
    setShowBanner(false)
    dismissBackupBanner()
  }

  return (
    <div class="reminder-banner">
      <span class="flex items-center gap-2 flex-1">
        <svg width="20" height="20" viewBox="0 0 24 24" class="text-danger">
          <path fill="currentColor" d="M12 2L1 21h20L12 2zm0 3.23L19.39 20H4.61L12 5.23zM12 12.77L14.14 17h-4.28L12 12.77z"/>
        </svg>
        <strong>Backup saknas!</strong> Senaste backup gjordes {formattedDate}. Ladda ned nu.
      </span>
      <div class="flex items-center gap-sm">
        <button 
          class="btn btn-primary btn-sm" 
          onClick={handleDownloadBackup}
          disabled={isLoading}
        >
          {isLoading ? 'Laddar ned...' : 'Ladda ned backup'}
        </button>
        <button 
          class="banner-dismiss" 
          onClick={handleDismiss}
          aria-label="Stäng"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      </div>
    </div>
  )
}
