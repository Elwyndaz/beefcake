import { useState, useEffect, useRef } from 'preact/hooks'
import { getAllExercises, getVolumeOverTime, getFrequencyPerTemplate, getHeatmapData, getPRs, getCurrentStreak, getWeeklyTonnage, getEstimated1RM } from '../services/dataService'
import { formatDateShort, localDateISO, todayISO, parseLocalDate } from '../lib/date'
import type { Exercise } from '../models'

// Lazy load Chart.js
let chartPromise: Promise<any> | null = null
async function getChart() {
  if (!chartPromise) {
    chartPromise = Promise.all([
      import('chart.js'),
      import('chartjs-adapter-date-fns')
    ]).then(([ChartModule]) => {
      ChartModule.Chart.register(...ChartModule.registerables)
      return ChartModule.Chart
    })
  }
  return chartPromise
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
  const volumeChartRef = useRef<any>(null)
  const frequencyChartRef = useRef<any>(null)
  const heatmapChartRef = useRef<any>(null)
  const [frequencyData, setFrequencyData] = useState<{ templateName: string; count: number }[]>([])
  const [heatmapData, setHeatmapData] = useState<{ date: string; count: number }[]>([])
  const [prs, setPRs] = useState<PR[]>([])
  const [streak, setStreak] = useState<{ streakDays: number; lastWorkoutDate: string | null }>({ streakDays: 0, lastWorkoutDate: null })
  const [thisWeekTonnage, setThisWeekTonnage] = useState<number>(0)
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
  }, [selectedExerciseId, period])

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
  }, [frequencyData])

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
  }, [heatmapData])

  async function loadData() {
    try {
      setLoading(true)
      setError(null)
      const [es, freq, heat, prsData, streakData, tonnageData] = await Promise.all([
        getAllExercises(),
        getFrequencyPerTemplate(),
        getHeatmapData(30),
        getPRs(),
        getCurrentStreak(),
        getThisWeekTonnage()
      ])
      setExercises(es)
      setFrequencyData(freq)
      setHeatmapData(heat)
      setPRs(prsData)
      setStreak(streakData)
      setThisWeekTonnage(tonnageData)
      if (es.length > 0 && !selectedExerciseId) {
        setSelectedExerciseId(es[0].id)
        // Load 1RM for first exercise
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
    const dayOfWeek = now.getDay() // 0=Sunday, 1=Monday...
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
    
    // Filter data by period
    const filteredData = allData.filter(d => d.date >= periodStart)
    
    const ctx = volumeCanvasRef.current
    if (!ctx) return

    const Chart = await getChart()
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
            borderColor: '#2c3e50',
            backgroundColor: 'rgba(44, 62, 80, 0.1)',
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
            x: { type: 'time', ticks: { maxTicksLimit: 10 } },
            y: { beginAtZero: true }
          }
        }
      })
      volumeChartRef.current = chart
    }
  }

  async function loadFrequencyChart() {
    const ctx = frequencyCanvasRef.current
    if (!ctx) return

    const Chart = await getChart()
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
            backgroundColor: 'rgba(44, 62, 80, 0.8)',
            borderColor: '#2c3e50',
            borderWidth: 1
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { x: { beginAtZero: true } }
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

    const Chart = await getChart()
    if (heatmapChartRef.current) {
      heatmapChartRef.current.data.labels = labels
      heatmapChartRef.current.data.datasets[0].data = values
      heatmapChartRef.current.data.datasets[0].backgroundColor = values.map(v => v > 0 ? '#e74c3c' : '#dee2e6')
      heatmapChartRef.current.data.datasets[0].borderColor = values.map(v => v > 0 ? '#c0392b' : '#dee2e6')
      heatmapChartRef.current.update()
    } else {
      const chart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Pass per dag',
            data: values,
            backgroundColor: values.map(v => v > 0 ? '#e74c3c' : '#dee2e6'),
            borderColor: values.map(v => v > 0 ? '#c0392b' : '#dee2e6'),
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { x: { ticks: { maxTicksLimit: 10 } }, y: { beginAtZero: true } }
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
          <div class="card skeleton skeleton-chart"></div>
          <div class="card skeleton skeleton-chart"></div>
        </div>
        <div class="grid grid-2 mb">
          <div class="card skeleton skeleton-chart"></div>
          <div class="card skeleton skeleton-chart"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div class="empty-state">
        <h3>Fel vid laddning</h3>
        <p>{error}</p>
        <button class="btn btn-primary mt" onClick={loadData}>Försök igen</button>
      </div>
    )
  }

  return (
    <div>
      <h1 class="page-title">Statistik</h1>

      {/* Overview stats */}
      <div class="grid grid-3 mb">
        <div class="card">
          <h3>Streak</h3>
          <p class="text-3xl font-bold text-primary">{streak.streakDays}</p>
          <p class="text-sm text-muted">dagar i rad</p>
        </div>
        <div class="card">
          <h3>Veckovolym</h3>
          <p class="text-3xl font-bold text-primary">{thisWeekTonnage.toLocaleString('sv-SE')}</p>
          <p class="text-sm text-muted">kg denna vecka</p>
        </div>
        <div class="card">
          <h3>Est. 1RM</h3>
          <p class="text-3xl font-bold text-primary">
            {oneRM ? Math.round(oneRM.estimated1RM).toLocaleString('sv-SE') : '—'}
          </p>
          <p class="text-sm text-muted">{oneRM ? `${oneRM.exerciseName} (${formatDateShort(oneRM.date)})` : 'Välj övning'}</p>
        </div>
      </div>

      <div class="grid grid-2 mb">
        <div class="card">
          <h3>Volym över tid</h3>
          <div class="grid grid-2 gap-sm mb-sm">
            <div class="input-group m-0">
              <label>Övning</label>
              <select value={selectedExerciseId} onChange={handleSelectChange}>
                {exercises.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div class="input-group m-0">
              <label>Period</label>
              <select value={period} onChange={handlePeriodChange}>
                {Object.entries(periodLabels).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
          </div>
          <div class="h-300">
            <canvas ref={volumeCanvasRef} id="volume-chart"></canvas>
          </div>
        </div>

        <div class="card">
          <h3>Frekvens per pass</h3>
          <div class="h-300">
            <canvas ref={frequencyCanvasRef} id="frequency-chart"></canvas>
          </div>
        </div>
      </div>

      <div class="grid grid-2 mb">
        <div class="card">
          <h3>Aktivitet (senaste 30 dagar)</h3>
          {heatmapData.length === 0 && exercises.length === 0 ? (
            <div class="empty-state">
              <h3>Inga pass registrerade än.</h3>
            </div>
          ) : allValuesZero() ? (
            <div class="empty-state">
              <h3>Ingen aktivitet</h3>
              <p>Inga pass de senaste 30 dagarna.</p>
            </div>
          ) : (
            <div class="h-200">
              <canvas ref={heatmapCanvasRef} id="heatmap-chart"></canvas>
            </div>
          )}
        </div>

        <div class="card">
          <h3>Personliga rekord (PR)</h3>
          {prs.length === 0 ? (
            <div class="empty-state">
              <h3>Inga personliga rekord än</h3>
              <p>Logga pass för att se dina PR.</p>
            </div>
          ) : (
            <div class="table-wrap max-h-300 overflow-y-auto">
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
                      <td>{pr.exerciseName}</td>
                      <td class="tabular-nums">{pr.maxWeight} kg (<span class="nowrap">{formatDateShort(pr.maxWeightDate)}</span>)</td>
                      <td class="tabular-nums">{pr.maxVolume.toLocaleString('sv-SE')} kg (<span class="nowrap">{formatDateShort(pr.maxVolumeDate)}</span>)</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}