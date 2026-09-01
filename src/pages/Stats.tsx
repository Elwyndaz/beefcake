import { useState, useEffect, useRef } from 'preact/hooks'
import { Link } from 'wouter'
import { getAllExercises, getVolumeOverTime, getFrequencyPerTemplate, getPRs, getAllSessions, getEstimated1RM, getVolumeByMuscleGroup, getWeeklyHardSetsPerMuscleGroup, getExerciseTrainingCounts, getSessionYears } from '../services/dataService'
import { classifyWeeklySets, SET_LOAD_LABELS } from '../lib/hypertrophy'
import { formatWeight } from '../lib/format'
import { formatDateShort, localDateISO, todayISO, parseLocalDate } from '../lib/date'
import { exercisesVolume } from '../lib/volume'
import { Card } from '../components/Card'
import { Button } from '../components/Button'
import { EmptyState } from '../components/EmptyState'
import { Field } from '../components/Field'
import { Stat } from '../components/Stat'
import type { Exercise } from '../models'
import type { Chart } from 'chart.js'

// Lazy load Chart.js
let chartModule: typeof import('chart.js') | null = null
async function getChartModule(): Promise<typeof import('chart.js')> {
  if (!chartModule) {
    const [mod] = await Promise.all([
      import('chart.js'),
      import('chartjs-adapter-date-fns')
    ])
    mod.Chart.register(...mod.registerables)
    chartModule = mod
  }
  return chartModule
}

// Read CSS tokens from the design system so charts inherit theme colors.
// Never hardcode hex in this file.
function getCSSVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}

function hexToRgba(hex: string, opacity: number): string {
  const value = hex.replace('#', '')
  const r = parseInt(value.slice(0, 2), 16)
  const g = parseInt(value.slice(2, 4), 16)
  const b = parseInt(value.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${opacity})`
}

interface ChartTheme {
  accent: string
  grid: string
  text: string
}

function getChartTheme(): ChartTheme {
  return {
    accent: getCSSVar('--accent', '#d6283a'),
    grid: getCSSVar('--border', '#e4e7ee'),
    text: getCSSVar('--text-muted', '#5b6472')
  }
}

interface PR {
  exerciseId: string
  exerciseName: string
  maxWeight: number
  maxVolume: number
  maxWeightDate: string
  maxVolumeDate: string
}

type Period = 'week' | 'month' | 'quarter' | 'year'

/** Frekvensfiltret: 'all', de rullande perioderna, eller ett kalenderår som sträng. */
type FrequencyRange = 'all' | 'month' | 'quarter' | 'year12' | string

const frequencyRangeLabels: [FrequencyRange, string][] = [
  ['all', 'Totalt'],
  ['month', 'Senaste månaden'],
  ['quarter', 'Senaste kvartalet'],
  ['year12', 'Senaste 12 månaderna']
]

/** Rullande perioder bakåt från idag. Kalenderår hanteras separat. */
function frequencyRangeBounds(range: FrequencyRange, today: string): { from?: string; to?: string } {
  const now = parseLocalDate(today)
  const back = (months: number) => {
    const d = new Date(now)
    d.setMonth(d.getMonth() - months)
    return localDateISO(d)
  }
  switch (range) {
    case 'all': return {}
    case 'month': return { from: back(1) }
    case 'quarter': return { from: back(3) }
    case 'year12': return { from: back(12) }
    default: return { from: `${range}-01-01`, to: `${range}-12-31` }
  }
}

interface RecentUseItem {
  id?: string
  name?: string
  exerciseId?: string
  exerciseName?: string
}

/**
 * Mest tränade övningar först, resten i bokstavsordning. Utan den här
 * sorteringen låg armhävningar alltid överst bara för att A kommer först.
 * Fungerar både på Exercise (id/name) och PR (exerciseId/exerciseName).
 */
function sortByRecentUse<T extends RecentUseItem>(items: T[], counts: Map<string, number>): T[] {
  const idOf = (item: T) => item.exerciseId ?? item.id ?? ''
  const nameOf = (item: T) => item.exerciseName ?? item.name ?? ''
  return [...items].sort((a, b) =>
    (counts.get(idOf(b)) ?? 0) - (counts.get(idOf(a)) ?? 0) || nameOf(a).localeCompare(nameOf(b))
  )
}

const periodLabels: Record<Period, string> = {
  week: 'Vecka',
  month: 'Månad',
  quarter: 'Kvartal',
  year: 'År'
}

const WEEKS_BACK = 8

/** Måndagen `weeksAgo` veckor bakåt, som YYYY-MM-DD */
function mondayISO(weeksAgo = 0): string {
  const now = parseLocalDate(todayISO())
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7) - weeksAgo * 7)
  return localDateISO(monday)
}

/** ISO-veckonummer för etiketten "v. 36" */
function isoWeek(iso: string): number {
  const d = parseLocalDate(iso)
  const thursday = new Date(d)
  thursday.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const firstThursday = new Date(thursday.getFullYear(), 0, 4)
  return 1 + Math.round(((thursday.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + ((firstThursday.getDay() + 6) % 7)) / 7)
}

interface Last30 {
  sessions: number
  volume: number
  newPRs: number
}

export function Stats() {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [selectedExerciseId, setSelectedExerciseId] = useState<string>('')
  // Kvartal som förval: månad gav en tom graf så fort man vilat en vecka.
  const [period, setPeriod] = useState<Period>('quarter')
  const volumeChartRef = useRef<Chart | null>(null)
  const [frequencyData, setFrequencyData] = useState<{ templateName: string; count: number }[]>([])
  const [frequencyRange, setFrequencyRange] = useState<FrequencyRange>('all')
  const [sessionYears, setSessionYears] = useState<number[]>([])
  // exerciseId -> antal pass senaste kvartalet. Styr sorteringen i övningsvalet
  // och i PR-listan så det du faktiskt tränar ligger överst.
  const [recentCounts, setRecentCounts] = useState<Map<string, number>>(new Map())
  const [prs, setPRs] = useState<PR[]>([])
  const [muscleGroupStats, setMuscleGroupStats] = useState<{ muscleGroup: string; volume: number; sessions: number }[]>([])
  const [last30, setLast30] = useState<Last30>({ sessions: 0, volume: 0, newPRs: 0 })
  // Set per muskelgrupp per vecka, nyaste veckan först. Tom lista för en vilovecka.
  const [weeklySets, setWeeklySets] = useState<{ weekStart: string; groups: { muscleGroup: string; sets: number }[] }[]>([])
  // e1RM för den mest tränade övningen, oberoende av valet i volymgrafen
  const [topOneRM, setTopOneRM] = useState<{ exerciseName: string; estimated1RM: number | null }>({ exerciseName: '', estimated1RM: null })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const volumeCanvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (selectedExerciseId) {
      loadVolumeChart()
    }
    return () => {
      if (volumeChartRef.current?.destroy) {
        volumeChartRef.current.destroy()
        volumeChartRef.current = null
      }
    }
  }, [selectedExerciseId, period, loading])

  async function loadData() {
    try {
      setLoading(true)
      setError(null)
      const today = todayISO()
      const quarterStart = frequencyRangeBounds('quarter', today).from!
      const cutoff30 = new Date(parseLocalDate(today))
      cutoff30.setDate(cutoff30.getDate() - 30)
      const cutoff30ISO = localDateISO(cutoff30)
      const [es, prsData, sessions, muscleStats, counts, years, weeks] = await Promise.all([
        getAllExercises(),
        getPRs(),
        getAllSessions(),
        getVolumeByMuscleGroup(),
        getExerciseTrainingCounts(quarterStart),
        getSessionYears(),
        Promise.all(Array.from({ length: WEEKS_BACK }, (_, i) => {
          const weekStart = mondayISO(i)
          return getWeeklyHardSetsPerMuscleGroup(weekStart).then(groups => ({ weekStart, groups }))
        }))
      ])
      const sorted = sortByRecentUse(es, counts)
      setExercises(sorted)
      setRecentCounts(counts)
      setSessionYears(years)
      setPRs(prsData)
      setMuscleGroupStats(muscleStats)
      setWeeklySets(weeks)
      const recent = sessions.filter(s => s.date >= cutoff30ISO)
      setLast30({
        sessions: recent.length,
        volume: recent.reduce((sum, s) => sum + exercisesVolume(s.exercises), 0),
        // Ett PR räknas per övning och sort: satt maxvikt eller maxvolym inom 30 dagar
        newPRs: prsData.reduce((n, pr) => n + (pr.maxWeightDate >= cutoff30ISO ? 1 : 0) + (pr.maxVolumeDate >= cutoff30ISO ? 1 : 0), 0)
      })
      if (sorted.length > 0) {
        if (!selectedExerciseId) setSelectedExerciseId(sorted[0].id)
        const rm = await getEstimated1RM(sorted[0].id)
        setTopOneRM({ exerciseName: sorted[0].name, estimated1RM: rm?.estimated1RM ?? null })
      }
    } catch (err) {
      setError('Kunde inte ladda statistik. Försök igen.')
      console.error('Fel vid laddning av statistik:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const { from, to } = frequencyRangeBounds(frequencyRange, todayISO())
    getFrequencyPerTemplate(from, to).then(setFrequencyData).catch(() => setFrequencyData([]))
  }, [frequencyRange])

  // Filter volume data by period
  function getPeriodStartDate(period: Period): string {
    const now = parseLocalDate(todayISO())
    switch (period) {
      case 'week': {
        return mondayISO()
      }
      case 'month': {
        return localDateISO(new Date(now.getFullYear(), now.getMonth(), 1))
      }
      case 'quarter': {
        const quarter = Math.floor(now.getMonth() / 3)
        return localDateISO(new Date(now.getFullYear(), quarter * 3, 1))
      }
      case 'year': {
        return localDateISO(new Date(now.getFullYear(), 0, 1))
      }
      default:
        return localDateISO(now)
    }
  }

  function handlePeriodChange(e: Event) {
    const target = e.target as HTMLSelectElement
    setPeriod(target.value as Period)
  }

  async function loadVolumeChart() {
    const allData = await getVolumeOverTime(selectedExerciseId)
    const periodStart = getPeriodStartDate(period)

    const filteredData = allData.filter(d => d.date >= periodStart)

    const ctx = volumeCanvasRef.current
    if (!ctx) return

    const Chart = (await getChartModule()).Chart
    Chart.defaults.font.family = getCSSVar('--font-sans', 'Geist, system-ui, sans-serif')
    Chart.defaults.color = getCSSVar('--text-muted', '#5b6472')
    const theme = getChartTheme()

    if (volumeChartRef.current) {
      volumeChartRef.current.data.labels = filteredData.map(d => d.date)
      volumeChartRef.current.data.datasets[0].data = filteredData.map(d => d.volume)
      volumeChartRef.current.update()
    } else {
      const chart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: filteredData.map(d => d.date),
          datasets: [{
            label: 'Volym (kg)',
            data: filteredData.map(d => d.volume),
            borderColor: theme.accent,
            backgroundColor: hexToRgba(theme.accent, 0.12),
            fill: true,
            tension: 0.3,
            pointRadius: 4,
            pointHoverRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            x: { type: 'time', ticks: { maxTicksLimit: 10, color: theme.text }, grid: { color: theme.grid } },
            y: { beginAtZero: true, ticks: { color: theme.text }, grid: { color: theme.grid } }
          }
        }
      })
      volumeChartRef.current = chart
    }
  }

  function handleSelectChange(e: Event) {
    const target = e.target as HTMLSelectElement
    setSelectedExerciseId(target.value)
  }

  if (loading) {
    return (
      <div>
        <h1 class="page-title">Statistik</h1>
        <div class="grid grid-2 mb">
          <Card class="skeleton skeleton-chart"></Card>
          <Card class="skeleton skeleton-chart"></Card>
        </div>
        <div class="grid grid-2 mb">
          <Card class="skeleton skeleton-chart"></Card>
          <Card class="skeleton skeleton-chart"></Card>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <EmptyState
        title="Fel vid laddning"
        message={error}
        action={<Button onClick={loadData}>Försök igen</Button>}
      />
    )
  }

  const sortedPRs = sortByRecentUse(prs, recentCounts)
  const maxFrequency = frequencyData[0]?.count || 1

  return (
    <div>
      <h1 class="page-title">Statistik</h1>

      {/* Senaste 30 dagar i tal. Ersätter streak, veckovolym och aktivitetsstapeln med 0 eller 1 per dag:
          kalendern på Historik är bilden, det här är räkningen. */}
      <div class="grid grid-4 stat-grid mb">
        <Card padding="sm">
          <Stat label="Pass" value={last30.sessions} sub="senaste 30 dagarna" />
        </Card>
        <Card padding="sm">
          <Stat label="Volym" value={`${last30.volume.toLocaleString('sv-SE')} kg`} sub="senaste 30 dagarna" />
        </Card>
        <Card padding="sm">
          <Stat label="Nya PR" value={last30.newPRs} sub="senaste 30 dagarna" />
        </Card>
        <Card padding="sm">
          <Stat
            label="Est. 1RM"
            value={topOneRM.estimated1RM !== null ? `${Math.round(topOneRM.estimated1RM).toLocaleString('sv-SE')} kg` : '–'}
            sub={topOneRM.exerciseName ? (topOneRM.estimated1RM !== null ? topOneRM.exerciseName : `${topOneRM.exerciseName}: inga set på 10 reps eller färre`) : 'Ingen övning'}
          />
        </Card>
      </div>

      <div class="grid grid-2 mb">
        <Card title={`Set per muskelgrupp, senaste ${WEEKS_BACK} veckorna`}>
          {weeklySets.every(w => w.groups.length === 0) ? (
            <EmptyState
              title={`Inga set på ${WEEKS_BACK} veckor`}
              message="Målbandet för hypertrofi är 10 till 20 arbetsset per muskelgrupp och vecka."
            />
          ) : (
            <div class="week-sets-list">
              {weeklySets.map((week, idx) => (
                <div class="week-sets-row" key={week.weekStart}>
                  <span class="week-sets-label text-sm font-600 tabular-nums">
                    {idx === 0 ? 'Denna vecka' : `v. ${isoWeek(week.weekStart)}`}
                  </span>
                  <div class="week-sets-chips">
                    {week.groups.length === 0 ? (
                      <span class="text-xs text-muted">vila</span>
                    ) : week.groups.map(mg => {
                      const load = classifyWeeklySets(mg.sets)
                      return (
                        <span class={`week-sets-chip load-${load}`} key={mg.muscleGroup} title={`${mg.muscleGroup}: ${mg.sets} set, ${SET_LOAD_LABELS[load]}`}>
                          {mg.muscleGroup} <strong class="tabular-nums">{mg.sets}</strong>
                        </span>
                      )
                    })}
                  </div>
                </div>
              ))}
              <p class="text-xs text-muted m-0 mt-2">Band: 10 till 20 set per muskelgrupp och vecka. Under bandet gult, i bandet grönt, över rött.</p>
            </div>
          )}
        </Card>
        <Card title="Volym över tid">
          <div class="grid grid-2 gap-sm mb-sm">
            <Field label="Övning" class="m-0">
              <select value={selectedExerciseId} onChange={handleSelectChange}>
                {exercises.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </Field>
            <Field label="Period" class="m-0">
              <select value={period} onChange={handlePeriodChange}>
                {Object.entries(periodLabels).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </Field>
          </div>
          {selectedExerciseId && (
            <p class="text-sm mb-sm m-0">
              <Link href={`/exercises/${selectedExerciseId}`} class="exercise-link">Öppna övningssidan</Link>
            </p>
          )}
          <div class="h-300">
            <canvas ref={volumeCanvasRef} id="volume-chart"></canvas>
          </div>
        </Card>
      </div>

      <div class="grid grid-2 mb">
        <Card title="Frekvens per pass">
          <Field label="Period" class="mb-sm">
            <select value={frequencyRange} onChange={(e: Event) => setFrequencyRange((e.target as HTMLSelectElement).value)}>
              {frequencyRangeLabels.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
              {sessionYears.map(year => (
                <option key={year} value={String(year)}>{year}</option>
              ))}
            </select>
          </Field>
          {frequencyData.length === 0 ? (
            <p class="text-sm text-muted">Inga pass i den valda perioden.</p>
          ) : (
            <div class="muscle-group-list">
              {frequencyData.map(d => (
                <div class="muscle-group-row" key={d.templateName}>
                  <div class="flex justify-between items-center gap-2 mb-1">
                    <span class="text-sm font-600">{d.templateName}</span>
                    <span class="text-sm text-muted tabular-nums nowrap">{d.count} pass</span>
                  </div>
                  <div class="muscle-group-bar">
                    <div class="muscle-group-fill" style={{ width: `${Math.max(4, (d.count / maxFrequency) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card title="Muskelgrupper">
          {muscleGroupStats.length === 0 ? (
            <EmptyState
              title="Inga muskelgrupper ännu"
              message="Övningarna mappas automatiskt till muskelgrupper när du loggar pass."
            />
          ) : (
            <div class="muscle-group-list">
              {(() => {
                const max = muscleGroupStats[0]?.volume || 1
                return muscleGroupStats.map((mg) => (
                  <div class="muscle-group-row" key={mg.muscleGroup}>
                    <div class="flex justify-between items-center mb-1">
                      <span class="text-sm font-600">{mg.muscleGroup}</span>
                      <span class="text-sm text-muted tabular-nums">
                        {mg.volume.toLocaleString('sv-SE')} kg · {mg.sessions} pass
                      </span>
                    </div>
                    <div class="muscle-group-bar">
                      <div class="muscle-group-fill" style={{ width: `${Math.max(4, (mg.volume / max) * 100)}%` }} />
                    </div>
                  </div>
                ))
              })()}
            </div>
          )}
        </Card>
      </div>

      <Card title="Personliga rekord (PR)">
        {prs.length === 0 ? (
          <EmptyState
            title="Inga personliga rekord ännu"
            message="Logga pass för att se dina PR."
            action={<Button href="/log">Logga pass</Button>}
          />
        ) : (
          <>
            {/* Telefon: ett kort per övning. Tabellen klippte kolumnen Max volym utanför kortet. */}
            <div class="history-list-cards">
              {sortedPRs.map(pr => (
                <div class="history-card session-detail-card" key={pr.exerciseId}>
                  <div class="history-card-header">
                    <span class="history-card-date"><Link href={`/exercises/${pr.exerciseId}`} class="exercise-link">{pr.exerciseName}</Link></span>
                  </div>
                  <div class="history-card-body">
                    <span class="tabular-nums">Max vikt <strong>{formatWeight(pr.maxWeight)} kg</strong> <span class="nowrap">({formatDateShort(pr.maxWeightDate)})</span></span>
                  </div>
                  <div class="history-card-body">
                    <span class="tabular-nums">Max volym <strong>{pr.maxVolume.toLocaleString('sv-SE')} kg</strong> <span class="nowrap">({formatDateShort(pr.maxVolumeDate)})</span></span>
                  </div>
                </div>
              ))}
            </div>
            <div class="history-list-table table-wrap table-rows">
              <table>
                <thead>
                  <tr>
                    <th>Övning</th>
                    <th>Max vikt</th>
                    <th>Max volym</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPRs.map((pr) => (
                    <tr key={pr.exerciseId}>
                      <td><Link href={`/exercises/${pr.exerciseId}`} class="exercise-link">{pr.exerciseName}</Link></td>
                      <td class="tabular-nums">{formatWeight(pr.maxWeight)} kg <span class="nowrap text-muted">({formatDateShort(pr.maxWeightDate)})</span></td>
                      <td class="tabular-nums">{pr.maxVolume.toLocaleString('sv-SE')} kg <span class="nowrap text-muted">({formatDateShort(pr.maxVolumeDate)})</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
