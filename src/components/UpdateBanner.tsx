import { useEffect, useState } from 'preact/hooks'
import { Button } from './Button'

type Update = () => Promise<void>

/**
 * Ny version av appen väntar i service workern. Ingen automatisk omladdning: mitt i
 * ett pass vore det en katastrof, så bannern ligger kvar tills användaren trycker.
 * main.tsx anropar announceUpdate() från registerSW; värdet sparas här också, eftersom
 * service workern kan bli klar innan appen har renderats (molnläsningen tar sin tid).
 */
let pending: Update | null = null
const EVENT = 'beefcake-update-available'

export function announceUpdate(update: Update): void {
  pending = update
  window.dispatchEvent(new Event(EVENT))
}

export function UpdateBanner() {
  const [update, setUpdate] = useState<Update | null>(pending)
  const [reloading, setReloading] = useState(false)

  useEffect(() => {
    const onUpdate = () => setUpdate(() => pending)
    window.addEventListener(EVENT, onUpdate)
    return () => window.removeEventListener(EVENT, onUpdate)
  }, [])

  if (!update) return null

  return (
    <div class="update-banner" role="status">
      <span><strong>Ny version av Beefcake finns.</strong> Ladda om när du har en paus.</span>
      <Button size="sm" disabled={reloading} onClick={() => { setReloading(true); void update() }}>
        {reloading ? 'Laddar om…' : 'Ladda om'}
      </Button>
    </div>
  )
}
