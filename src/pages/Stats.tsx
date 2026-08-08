import { useState, useEffect, useRef } from 'preact/hooks'
import { getAllExercises, getVolumeOverTime, getFrequencyPerTemplate, getHeatmapData, getPRs } from '../services/dataService'
import { Chart, registerables } from 'chart.js'
import 'chartjs-adapter-date-fns'
import type { Exercise } from '../models'

Chart.register(...registerables)

interface PR {
  exerciseId: string
  exerciseName: string
  maxWeight: number
  maxVolume: number
  maxWeightDate: string
  maxVolumeDate: string
}

function localDateISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatDateShort(isoDate: string): string {
  const date = new Date(isoDate)
  const day = date.getDate()
  const month = date.getMonth()
  const year = date.getFullYear()
  const monthNames = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
  return `${day} ${monthNames[month]} ${year}`
}

export function Stats() {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [selectedExerciseId, setSelectedExerciseId] = useState<string>('')
  const volumeChartRef = useRef<Chart | null>(null)
  const frequencyChartRef = useRef<Chart | null>(null)
  const heatmapChartRef = useRef<Chart | null>(null)
  const [frequencyData, setFrequencyData] = useState<{ templateName: string; count: number }[]>([])
  const [heatmapData, setHeatmapData] = useState<{ date: string; count: number }[]>([])
  const [prs, setPRs] = useState<PR[]>([])

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
      if (volumeChartRef.current) {
        volumeChartRef.current.destroy()
        volumeChartRef.current = null
      }
    }
  }, [selectedExerciseId])

  useEffect(() => {
    if (frequencyData.length > 0 && frequencyCanvasRef.current) {
      loadFrequencyChart()
    }
    return () => {
      if (frequencyChartRef.current) {
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
      if (heatmapChartRef.current) {
        heatmapChartRef.current.destroy()
        heatmapChartRef.current = null
      }
    }
  }, [heatmapData])

  async function loadData() {
    const [es, freq, heat, prsData] = await Promise.all([
      getAllExercises(),
      getFrequencyPerTemplate(),
      getHeatmapData(30),
      getPRs()
    ])
    setExercises(es)
    setFrequencyData(freq)
    setHeatmapData(heat)
    setPRs(prsData)
    if (es.length > 0 && !selectedExerciseId) {
      setSelectedExerciseId(es[0].id)
    }
  }

  async function loadVolumeChart() {
    const data = await getVolumeOverTime(selectedExerciseId)
    const ctx = volumeCanvasRef.current
    if (!ctx) return

    if (volumeChartRef.current) {
      volumeChartRef.current.data.labels = data.map(d => d.date)
      volumeChartRef.current.data.datasets[0].data = data.map(d => d.volume)
      volumeChartRef.current.update()
    } else {
      const chart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: data.map(d => d.date),
          datasets: [{
            label: 'Volym (kg)',
            data: data.map(d => d.volume),
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

  function loadFrequencyChart() {
    const ctx = frequencyCanvasRef.current
    if (!ctx) return

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
    for (let i = 29; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const iso = localDateISO(d)
      const found = heatmapData.find(h => h.date === iso)
      if (found && found.count > 0) return false
    }
    return true
  }

  function loadHeatmapChart() {
    const ctx = heatmapCanvasRef.current
    if (!ctx) return

    const labels: string[] = []
    const values: number[] = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const iso = localDateISO(d)
      labels.push(iso)
      const found = heatmapData.find(h => h.date === iso)
      values.push(found ? found.count : 0)
    }

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

  return (
    <div>
      <h1 class="page-title">Statistik</h1>

      <div class="grid grid-2 mb">
        <div class="card">
          <h3>Volym över tid</h3>
          <div class="input-group mb-sm">
            <label>Övning</label>
            <select value={selectedExerciseId} onChange={handleSelectChange}>
              {exercises.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
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
        </div>
      </div>
    </div>
  )
}