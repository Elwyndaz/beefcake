import { useState, useEffect, useRef } from 'preact/hooks'
import { Link } from 'wouter'
import { getAllExercises, getVolumeOverTime, getFrequencyPerTemplate, getHeatmapData, getPRs, getCurrentStreak, getWeeklyTonnage, getEstimated1RM, getVolumeByMuscleGroup, getWeeklyHardSetsPerMuscleGroup } from '../services/dataService'
import { classifyWeeklySets, SET_LOAD_LABELS } from '../lib/hypertrophy'
import { formatWeight } from '../lib/format'
import { formatDateShort, localDateISO, todayISO, parseLocalDate } from '../lib/date'
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
  accentBorder: string
  primary: string
  primaryFill: string
  inactive: string
  grid: string
  text: string
}

function getChartTheme(): ChartTheme {
  return {
    accent: getCSSVar('--accent', '#ff4757'),
    accentBorder: getCSSVar('--accent-hover', '#e63b4b'),
    primary: getCSSVar('--primary', '#2c3e50'),
    primaryFill: hexToRgba(getCSSVar('--primary', '#2c3e50'), 0.85),
    inactive: getCSSVar('--border', '#e4e7ee'),
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

const periodLabels: Record<Period, string> = {
  week: 'Vecka',
  month: 'Månad',
  quarter: 'Kvartal',
  year: 'År'
}

export function Stats() {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [selectedExerciseId, setSelectedExerciseId] = useState<string>('')
  const [period, setPeriod] = useState<Period>('month')
  const volumeChartRef = useRef<Chart | null>(null)
  const frequencyChartRef = useRef<Chart | null>(null)
  const heatmapChartRef = useRef<Chart | null>(null)
  const [frequencyData, setFrequencyData] = useState<{ templateName: string; count: number }[]>([])
  const [heatmapData, setHeatmapData] = useState<{ date: string; count: number }[]>([])
  const [prs, setPRs] = useState<PR[]>([])
  const [muscleGroupStats, setMuscleGroupStats] = useState<{ muscleGroup: string; volume: number; sessions: number }[]>([])
  const [streak, setStreak] = useState<{ streakDays: number; lastWorkoutDate: string | null }>({ streakDays: 0, lastWorkoutDate: null })
  const [thisWeekTonnage, setThisWeekTonnage] = useState<number>(0)
  const [weeklyHardSets, setWeeklyHardSets] = useState<{ muscleGroup: string; sets: number }[]>([])
  const [oneRM, setOneRM] = useState<{ exerciseName: string; estimated1RM: number; date: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const volumeCanvasRef = useRef<HTMLCanvasElement>(null)
  const frequencyCanvasRef = useRef<HTMLCanvasElement>(null)
  const heatmapCanvasRef = useRef<HTMLCanvasElement>(null)

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

  useEffect(() => {
    if (frequencyData.length > 0 && frequencyCanvasRef.current) {
      loadFrequencyChart()
    }
    return () => {
      if (frequencyChartRef.current?.destroy) {
        frequencyChartRef.current.destroy()
        frequencyChartRef.current = null
      }
    }
    // loading måste vara med: under skelettvyn finns ingen canvas, och utan
    // omkörning när den monteras blir kortet tomt
  }, [frequencyData, loading])

  useEffect(() => {
    if (heatmapCanvasRef.current) {
      loadHeatmapChart()
    }
    return () => {
      if (heatmapChartRef.current?.destroy) {
        heatmapChartRef.current.destroy()
        heatmapChartRef.current = null
      }
    }
  }, [heatmapData, loading])

  async function loadData() {
    try {
      setLoading(true)
      setError(null)
      const [es, freq, heat, prsData, streakData, tonnageData, muscleStats, hardSets] = await Promise.all([
        getAllExercises(),
        getFrequencyPerTemplate(),
        getHeatmapData(30),
        getPRs(),
        getCurrentStreak(),
        getThisWeekTonnage(),
        getVolumeByMuscleGroup(),
        getWeeklyHardSetsPerMuscleGroup(getMondayISO())
      ])
      setExercises(es)
      setFrequencyData(freq)
      setHeatmapData(heat)
      setPRs(prsData)
      setMuscleGroupStats(muscleStats)
      setWeeklyHardSets(hardSets)
      setStreak(streakData)
      setThisWeekTonnage(tonnageData)
      if (es.length > 0 && !selectedExerciseId) {
        setSelectedExerciseId(es[0].id)
        const firstExercise1RM = await getEstimated1RM(es[0].id)
        if (firstExercise1RM) {
          setOneRM(firstExercise1RM)
        }
      }
    } catch (err) {
      setError('Kunde inte ladda statistik. Försök igen.')
      console.error('Fel vid laddning av statistik:', err)
    } finally {
      setLoading(false)
    }
  }

  // Helper to get start of current week (Monday)
  function getMondayISO(): string {
    const now = parseLocalDate(todayISO())
    const dayOfWeek = now.getDay()
    const monday = new Date(now)
    monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7))
    return localDateISO(monday)
  }

  // Get tonnage for current week
  async function getThisWeekTonnage(): Promise<number> {
    return getWeeklyTonnage(getMondayISO())
  }

  // Update 1RM when selected exercise changes
  useEffect(() => {
    if (selectedExerciseId) {
      getEstimated1RM(selectedExerciseId).then(rm => {
        if (rm) setOneRM(rm)
        else setOneRM(null)
      })
    }
  }, [selectedExerciseId])

  // Filter volume data by period
  function getPeriodStartDate(period: Period): string {
    const now = parseLocalDate(todayISO())
    switch (period) {
      case 'week': {
        const monday = new Date(now)
        monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
        return localDateISO(monday)
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

  async function loadFrequencyChart() {
    const ctx = frequencyCanvasRef.current
    if (!ctx) return

    const Chart = (await getChartModule()).Chart
    const theme = getChartTheme()

    if (frequencyChartRef.current) {
      frequencyChartRef.current.data.labels = frequencyData.map(d => d.templateName)
      frequencyChartRef.current.data.datasets[0].data = frequencyData.map(d => d.count)
      frequencyChartRef.current.update()
    } else {
      const chart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: frequencyData.map(d => d.templateName),
          datasets: [{
            label: 'Antal pass',
            data: frequencyData.map(d => d.count),
            backgroundColor: theme.primaryFill,
            borderRadius: 4
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { beginAtZero: true, ticks: { color: theme.text }, grid: { color: theme.grid } },
            y: { ticks: { color: theme.text }, grid: { display: false } }
          }
        }
      })
      frequencyChartRef.current = chart
    }
  }

  function allValuesZero(): boolean {
    const today = parseLocalDate(todayISO())
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const iso = localDateISO(d)
      const found = heatmapData.find(h => h.date === iso)
      if (found && found.count > 0) return false
    }
    return true
  }

  async function loadHeatmapChart() {
    const ctx = heatmapCanvasRef.current
    if (!ctx) return

    const today = parseLocalDate(todayISO())
    const labels: string[] = []
    const values: number[] = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const iso = localDateISO(d)
      labels.push(iso)
      const found = heatmapData.find(h => h.date === iso)
      values.push(found ? found.count : 0)
    }

    const Chart = (await getChartModule()).Chart
    const theme = getChartTheme()

    if (heatmapChartRef.current) {
      heatmapChartRef.current.data.labels = labels
      heatmapChartRef.current.data.datasets[0].data = values
      heatmapChartRef.current.data.datasets[0].backgroundColor = values.map(v => v > 0 ? theme.accent : theme.inactive)
      heatmapChartRef.current.update()
    } else {
      const chart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Pass per dag',
            data: values,
            backgroundColor: values.map(v => v > 0 ? theme.accent : theme.inactive),
            borderWidth: 0,
            borderRadius: 3
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { maxTicksLimit: 10, color: theme.text }, grid: { display: false } },
            y: { beginAtZero: true, ticks: { color: theme.text }, grid: { color: theme.grid } }
          }
        }
      })
      heatmapChartRef.current = chart
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

  return (
    <div>
      <h1 class="page-title">Statistik</h1>

      {/* Overview stats */}
      <div class="grid grid-3 mb">
        <Card padding="sm">
          <Stat
            label="Streak"
            value={streak.streakDays}
            sub={streak.streakDays === 1 ? 'dag i rad' : 'dagar i rad'}
          />
        </Card>
        <Card padding="sm">
          <Stat
            label="Veckovolym"
            value={`${thisWeekTonnage.toLocaleString('sv-SE')} kg`}
            sub="denna vecka"
          />
        </Card>
        <Card padding="sm">
          <Stat
            label="Est. 1RM"
            value={oneRM ? Math.round(oneRM.estimated1RM).toLocaleString('sv-SE') : 'Ingen'}
            sub={oneRM ? `${oneRM.exerciseName} (${formatDateShort(oneRM.date)})` : 'Välj övning'}
          />
        </Card>
      </div>

      <div class="grid grid-2 mb">
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

        <Card title="Frekvens per pass">
          <div class="h-300">
            <canvas ref={frequencyCanvasRef} id="frequency-chart"></canvas>
          </div>
        </Card>
      </div>

      <div class="grid grid-2 mb">
        <Card title="Aktivitet (senaste 30 dagar)">
          {heatmapData.length === 0 && exercises.length === 0 ? (
            <EmptyState
              title="Inga pass registrerade ännu"
              message="Logga ett pass för att se din aktivitet här."
              action={<Button href="/log">Logga pass</Button>}
            />
          ) : allValuesZero() ? (
            <EmptyState
              title="Ingen aktivitet"
              message="Inga pass de senaste 30 dagarna. Dags att träna?"
              action={<Button href="/log">Logga pass</Button>}
            />
          ) : (
            <div class="h-200">
              <canvas ref={heatmapCanvasRef} id="heatmap-chart"></canvas>
            </div>
          )}
        </Card>

        <Card title="Personliga rekord (PR)">
          {prs.length === 0 ? (
            <EmptyState
              title="Inga personliga rekord ännu"
              message="Logga pass för att se dina PR."
              action={<Button href="/log">Logga pass</Button>}
            />
          ) : (
            <div class="table-wrap max-h-300 overflow-y-auto table-rows">
              <table>
                <thead>
                  <tr>
                    <th>Övning</th>
                    <th>Max vikt</th>
                    <th>Max volym</th>
                  </tr>
                </thead>
                <tbody>
                  {[...prs].sort((a, b) => a.exerciseName.localeCompare(b.exerciseName)).map((pr) => (
                    <tr key={pr.exerciseId}>
                      <td><Link href={`/exercises/${pr.exerciseId}`} class="exercise-link">{pr.exerciseName}</Link></td>
                      <td class="tabular-nums">{formatWeight(pr.maxWeight)} kg <span class="nowrap text-muted">({formatDateShort(pr.maxWeightDate)})</span></td>
                      <td class="tabular-nums">{pr.maxVolume.toLocaleString('sv-SE')} kg <span class="nowrap text-muted">({formatDateShort(pr.maxVolumeDate)})</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Set per muskelgrupp denna vecka">
          {weeklyHardSets.length === 0 ? (
            <EmptyState
              title="Inga set den här veckan"
              message="Målbandet för hypertrofi är 10 till 20 arbetsset per muskelgrupp och vecka."
            />
          ) : (
            <div class="muscle-group-list">
              {weeklyHardSets.map(mg => {
                const load = classifyWeeklySets(mg.sets)
                return (
                  <div class="muscle-group-row" key={mg.muscleGroup}>
                    <div class="flex justify-between items-center mb-1">
                      <span class="text-sm font-600">{mg.muscleGroup}</span>
                      <span class="text-sm text-muted tabular-nums">
                        {mg.sets} set · {SET_LOAD_LABELS[load]}
                      </span>
                    </div>
                    <div class="muscle-group-bar">
                      {/* Skalan går till 20 set: bandets övre kant, inte till veckans högsta värde */}
                      <div
                        class={`muscle-group-fill load-${load}`}
                        style={{ width: `${Math.min(100, Math.max(4, (mg.sets / 20) * 100))}%` }}
                      />
                    </div>
                  </div>
                )
              })}
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
    </div>
  )
}