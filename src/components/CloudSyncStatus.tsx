import { useEffect, useState } from 'preact/hooks'
import { getCloudSyncError, getCloudSyncLoginUrl, subscribeToCloudSyncError } from '../services/cloudSyncService'
import { Button } from './Button'

export function CloudSyncStatus() {
  const [error, setError] = useState(getCloudSyncError())
  const [waitingForLogin, setWaitingForLogin] = useState(false)

  useEffect(() => subscribeToCloudSyncError(setError), [])

  // Access-inloggningen sker i en annan flik. När den här fliken får fokus
  // igen finns cookien, och en omladdning kör synken om sig själv. Det sparar
  // steget där man annars måste ladda om appen för hand.
  useEffect(() => {
    if (!waitingForLogin) return
    const reload = () => window.location.reload()
    window.addEventListener('focus', reload)
    return () => window.removeEventListener('focus', reload)
  }, [waitingForLogin])

  if (!error) return null

  return (
    <div class="sync-error" role="alert">
      <span>
        <strong>Molnsynk misslyckades.</strong> {error}
      </span>
      <Button
        size="sm"
        onClick={() => {
          window.open(getCloudSyncLoginUrl(), '_blank', 'noopener')
          setWaitingForLogin(true)
        }}
      >
        {waitingForLogin ? 'Väntar på inloggning…' : 'Logga in och försök igen'}
      </Button>
    </div>
  )
}
