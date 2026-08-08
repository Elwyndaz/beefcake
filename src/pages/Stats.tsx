import { useState, useEffect, useRef } from 'preact/hooks'
import { getAllExercises, getVolumeOverTime, getFrequencyPerTemplate, getHeatmapData, getPRs } from '../services/dataService'
import { Chart, registerables } from 'chart.js'
import type { Exercise } from '../models'

Chart.register(...registerables)

export function Stats() {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [selectedExerciseId, setSelectedExerciseId] = useState<string>('')
  const [volumeChart, setVolumeChart] = useState<Chart | null>(null)
  const [frequencyChart, setFrequencyChart] = useState<Chart | null>(null)
  const [heatmapChart, setHeatmapChart] = useState<Chart | null>(null)
  const [frequencyData, setFrequencyData] = useState<{ templateName: string; count: number }[]>([])
  const [heatmapData, setHeatmapData] = useState<{ date: string; count: number }[]>([])
  const [prs, setPRs] = useState<any[]>([])

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
  }, [selectedExerciseId])

  useEffect(() => {
    if (frequencyData.length > 0 && frequencyCanvasRef.current) {
      loadFrequencyChart()
    }
  }, [frequencyData])

  useEffect(() => {
    if (heatmapData.length > 0 && heatmapCanvasRef.current) {
      loadHeatmapChart()
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

    if (volumeChart) {
      volumeChart.data.labels = data.map(d => d.date)
      volumeChart.data.datasets[0].data = data.map(d => d.volume)
      volumeChart.update()
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
            x: { ticks: { maxTicksLimit: 10 } },
            y: { beginAtZero: true }
          }
        }
      })
      setVolumeChart(chart)
    }
  }

  function loadFrequencyChart() {
    const ctx = frequencyCanvasRef.current
    if (!ctx) return

    if (frequencyChart) {
      frequencyChart.data.labels = frequencyData.map(d => d.templateName)
      frequencyChart.data.datasets[0].data = frequencyData.map(d => d.count)
      frequencyChart.update()
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
      setFrequencyChart(chart)
    }
  }

  function loadHeatmapChart() {
    const ctx = heatmapCanvasRef.current
    if (!ctx) return

    const labels: string[] = []
    const values: number[] = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const iso = d.toISOString().split('T')[0]
      labels.push(iso)
      const found = heatmapData.find(h => h.date === iso)
      values.push(found ? found.count : 0)
    }

    if (heatmapChart) {
      heatmapChart.data.labels = labels
      heatmapChart.data.datasets[0].data = values
      heatmapChart.data.datasets[0].backgroundColor = values.map(v => v > 0 ? '#e74c3c' : '#dee2e6')
      heatmapChart.data.datasets[0].borderColor = values.map(v => v > 0 ? '#c0392b' : '#dee2e6')
      heatmapChart.update()
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
      setHeatmapChart(chart)
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
          <div style="height: 300px;">
            <canvas ref={volumeCanvasRef} id="volume-chart"></canvas>
          </div>
        </div>

        <div class="card">
          <h3>Frekvens per pass</h3>
          <div style="height: 300px;">
            <canvas ref={frequencyCanvasRef} id="frequency-chart"></canvas>
          </div>
        </div>
      </div>

      <div class="grid grid-2 mb">
        <div class="card">
          <h3>Aktivitet (senaste 30 dagar)</h3>
          <div style="height: 200px;">
            <canvas ref={heatmapCanvasRef} id="heatmap-chart"></canvas>
          </div>
        </div>

        <div class="card">
          <h3>Personliga rekord (PR)</h3>
          <div class="table-wrap" style="max-height: 300px; overflow-y: auto;">
            <table>
              <thead>
                <tr>
                  <th>Övning</th>
                  <th>Max vikt</th>
                  <th>Max volym</th>
                </tr>
              </thead>
              <tbody>
                {prs.slice(0, 10).map((pr: any) => (
                  <tr key={pr.exerciseId}>
                    <td>{pr.exerciseName}</td>
                    <td>{pr.maxWeight} kg ({pr.maxWeightDate})</td>
                    <td>{pr.maxVolume.toLocaleString('sv-SE')} kg ({pr.maxVolumeDate})</td>
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