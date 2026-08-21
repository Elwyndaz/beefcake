import { useEffect, useState } from 'preact/hooks'
import { useLocation } from 'wouter'
import { getAllSessions } from '../services/dataService'
import { todayISO } from '../lib/date'
import { beefcakeStatusText, beefcakeStreak, BEEFCAKE_LABELS, type BeefcakeStreak } from '../lib/streak'
import level1 from '../assets/beefcake/1.jpg'
import level2 from '../assets/beefcake/2.jpg'
import level3 from '../assets/beefcake/3.jpg'
import level4 from '../assets/beefcake/4.jpg'

const AVATARS = { 1: level1, 2: level2, 3: level3, 4: level4 } as const

/**
 * Cartman överst i innehållsflödet, mer muskulös ju längre träningskedjan är.
 *
 * Läses om vid varje sidbyte: det är billigt mot IndexedDB och fångar att du
 * just slutfört ett pass utan att någon behöver skicka en händelse.
 */
export function BeefcakeBadge() {
  const [location] = useLocation()
  const [streak, setStreak] = useState<BeefcakeStreak>({ level: 1, streak: 0, daysSinceLast: null })

  useEffect(() => {
    let cancelled = false
    getAllSessions()
      .then(sessions => {
        if (!cancelled) setStreak(beefcakeStreak(sessions.map(s => s.date), todayISO()))
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [location])

  return (
    <div class={`beefcake-banner level-${streak.level}`}>
      <img
        src={AVATARS[streak.level]}
        alt={`Beefcake-nivå ${streak.level}: ${BEEFCAKE_LABELS[streak.level]}`}
        width="320"
        height="320"
      />
      <p class="beefcake-banner-text">{beefcakeStatusText(streak)}</p>
    </div>
  )
}
