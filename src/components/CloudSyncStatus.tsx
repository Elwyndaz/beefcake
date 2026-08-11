import { useEffect, useState } from 'preact/hooks'
import { getCloudSyncError, getCloudSyncLoginUrl, subscribeToCloudSyncError } from '../services/cloudSyncService'

export function CloudSyncStatus() {
  const [error, setError] = useState(getCloudSyncError())

  useEffect(() => subscribeToCloudSyncError(setError), [])

  if (!error) return null

  return (
    <div class="sync-error" role="alert">
      <strong>Molnsynk misslyckades.</strong> {error}{' '}
      <a href={getCloudSyncLoginUrl()} target="_blank" rel="noreferrer">
        Öppna API-inloggningen
      </a>{' '}
      och ladda sedan om Beefcake.
    </div>
  )
}
