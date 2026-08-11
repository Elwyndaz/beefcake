import { useEffect, useRef, useState } from 'preact/hooks'
import {
  loadRestTimerPresets,
  requestRestTimerNotifications,
  saveRestTimerPresets,
  showRestTimerNotification
} from '../services/timerService'

type TimerStatus = 'idle' | 'running' | 'paused' | 'finished'

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function playTimerSound(): void {
  try {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return
    const context = new AudioContextClass()
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = 880
    gain.gain.setValueAtTime(0.0001, context.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.18, context.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.45)
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start()
    oscillator.stop(context.currentTime + 0.5)
    oscillator.addEventListener('ended', () => void context.close())
  } catch {
    // Some browsers block audio until the next user gesture.
  }
}

export function RestTimer() {
  const [presets, setPresets] = useState([3, 5, 8])
  const [selectedPreset, setSelectedPreset] = useState(0)
  const [remaining, setRemaining] = useState(180)
  const [status, setStatus] = useState<TimerStatus>('idle')
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>(() =>
    'Notification' in window ? Notification.permission : 'unsupported'
  )
  const deadlineRef = useRef<number | null>(null)

  useEffect(() => {
    loadRestTimerPresets().then(loaded => {
      setPresets(loaded)
      setRemaining(loaded[0] * 60)
    }).catch(() => undefined)
  }, [])

  useEffect(() => {
    if (status !== 'running') return

    const tick = () => {
      const deadline = deadlineRef.current
      if (!deadline) return
      const nextRemaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
      setRemaining(nextRemaining)
      if (nextRemaining === 0) {
        deadlineRef.current = null
        setStatus('finished')
        playTimerSound()
        void showRestTimerNotification()
      }
    }

    tick()
    const interval = window.setInterval(tick, 250)
    return () => window.clearInterval(interval)
  }, [status])

  function choosePreset(index: number) {
    setSelectedPreset(index)
    if (status !== 'running') {
      setRemaining(presets[index] * 60)
      setStatus('idle')
    }
  }

  function updatePreset(value: string) {
    const minutes = Math.min(60, Math.max(1, Number.parseInt(value, 10) || 1))
    const nextPresets = presets.map((preset, index) => index === selectedPreset ? minutes : preset)
    setPresets(nextPresets)
    void saveRestTimerPresets(nextPresets)
    if (status !== 'running') setRemaining(minutes * 60)
  }

  function startOrResume() {
    if (status === 'finished' || status === 'idle') {
      setRemaining(presets[selectedPreset] * 60)
    }
    deadlineRef.current = Date.now() + remaining * 1000
    setStatus('running')
  }

  function pause() {
    if (deadlineRef.current) {
      setRemaining(Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000)))
    }
    deadlineRef.current = null
    setStatus('paused')
  }

  function reset() {
    deadlineRef.current = null
    setRemaining(presets[selectedPreset] * 60)
    setStatus('idle')
  }

  async function enableNotifications() {
    const permission = await requestRestTimerNotifications()
    setNotificationPermission(permission)
  }

  const isActive = status === 'running' || status === 'paused'
  const statusLabel = status === 'finished' ? 'Klar' : status === 'paused' ? 'Pausad' : status === 'running' ? 'Pågår' : 'Redo'

  return (
    <section class={`rest-timer ${status === 'finished' ? 'rest-timer-finished' : ''}`} aria-label="Vilotimer">
      <div class="rest-timer-header">
        <div>
          <span class="rest-timer-kicker">Mellan set</span>
          <h2>Vilotimer</h2>
        </div>
        <span class="rest-timer-status">{statusLabel}</span>
      </div>

      <div class="rest-timer-display" aria-live="polite">
        <span>{formatTime(remaining)}</span>
      </div>

      <div class="rest-timer-presets" role="group" aria-label="Snabbval för vilotid">
        {presets.map((preset, index) => (
          <button
            type="button"
            class={selectedPreset === index ? 'rest-timer-preset selected' : 'rest-timer-preset'}
            onClick={() => choosePreset(index)}
            aria-pressed={selectedPreset === index}
          >
            {preset} min
          </button>
        ))}
      </div>

      <label class="rest-timer-edit">
        <span>Ändra valt snabbval</span>
        <div class="rest-timer-input-wrap">
          <input
            type="number"
            min="1"
            max="60"
            value={presets[selectedPreset]}
            onInput={event => updatePreset((event.target as HTMLInputElement).value)}
            aria-label="Vald vilotid i minuter"
          />
          <span>min</span>
        </div>
      </label>

      <div class="rest-timer-actions">
        <button type="button" class="btn btn-primary rest-timer-main-action" onClick={status === 'running' ? pause : startOrResume}>
          {status === 'running' ? (
            <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 5h3v14H7zM14 5h3v14h-3z" /></svg>
          ) : (
            <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="m8 5 11 7-11 7z" /></svg>
          )}
          {status === 'running' ? 'Pausa' : isActive ? 'Fortsätt' : status === 'finished' ? 'Kör igen' : 'Starta'}
        </button>
        <button type="button" class="btn btn-secondary rest-timer-reset" onClick={reset}>Återställ</button>
      </div>

      {notificationPermission === 'default' && (
        <button type="button" class="rest-timer-notification" onClick={enableNotifications}>
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M6.5 10.5a5.5 5.5 0 0 1 11 0c0 6 2.5 6 2.5 7h-16c0-1 2.5-1 2.5-7Zm4 10h3" /></svg>
          Tillåt notis när tiden är slut
        </button>
      )}
      {notificationPermission === 'granted' && <span class="rest-timer-notification-ready">Notiser är aktiverade</span>}
      {notificationPermission === 'denied' && <span class="rest-timer-notification-muted">Notiser är blockerade i webbläsaren</span>}
    </section>
  )
}
