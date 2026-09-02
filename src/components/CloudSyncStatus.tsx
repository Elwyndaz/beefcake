import { useEffect, useState } from 'preact/hooks'
import { getCloudSyncError, subscribeToCloudSyncError } from '../services/cloudSyncService'
import { Button } from './Button'

export function CloudSyncStatus() {
  const [error, setError] = useState(getCloudSyncError())

  useEffect(() => subscribeToCloudSyncError(setError), [])

  if (!error) return null

  return (
    <div class="sync-error" role="alert">
      <span>
        <strong>Molnsynk misslyckades.</strong> {error}
      </span>
      {/* En omladdning läser in servern igen och synkar om det lokala */}
      <Button size="sm" onClick={() => window.location.reload()}>Ladda om och försök igen</Button>
    </div>
  )
}
