import { useState, useEffect } from 'preact/hooks'
import { getAllExercises, getVolumeOverTime, getFrequencyPerTemplate, getHeatmapData, getPRs } from '../services/dataService'
import { Chart, registerables } from 'chart.js'
import type { Exercise } from '../models'

Chart.register(...registerables)

export function Stats() {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [selectedExerciseId, setSelectedExerciseId] = useState<string>('')
  const [volumeChart, setVolumeChart] = useState<Chart | null>(null)
  const [frequencyData, setFrequencyData] = useState<{ templateName: string; count: number }[]>([])
  const [heatmapData, setHeatmapData] = useState<{ date: string; count: number }[]>([])
  const [prs, setPRs] = useState<any[]>([])

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (selectedExerciseId) {
      loadVolumeChart()
    }
  }, [selectedExerciseId])

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
    const ctx = document.getElementById('volume-chart') as HTMLCanvasElement
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

  const selectedExercise = exercises.find(e => e.id === selectedExerciseId)

  return (
    <div>
      <h1 class="page-title">Statistik</h1>

      <div class="grid grid-2 mb">
        <div class="card">
          <h3>Volym över tid</h3>
          <div class="input-group mb-sm">
            <label>Övning</label>
            <select value={selectedExerciseId} onChange={e => setSelectedExerciseId(e.target.value)}>
              {exercises.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div style="height: 300px;">
            <canvas id="volume-chart"></canvas>
          </div>
        </div>

        <div class="card">
          <h3>Frekvens per pass</h3>
          <div style="height: 300px;">
            <canvas id="frequency-chart"></canvas>
          </div>
        </div>
      </div>

      <div class="grid grid-2 mb">
        <div class="card">
          <h3>Aktivitet (senaste 30 dagar)</h3>
          <div style="height: 200px;">
            <canvas id="heatmap-chart"></canvas>
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
                {prs.slice(0, 10).map(pr => (
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

      {/* Frequency chart */}
      <script dangerouslySetInnerHTML={{
        __html: `
          (function() {
            const ctx = document.getElementById('frequency-chart');
            if (ctx && !ctx.chart) {
              const data = ${JSON.stringify(frequencyData)};
              ctx.chart = new Chart(ctx, {
                type: 'bar',
                data: {
                  labels: data.map(d => d.templateName),
                  datasets: [{
                    label: 'Antal pass',
                    data: data.map(d => d.count),
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
              });
            }
          })();
        `
      }} />

      {/* Heatmap chart */}
      <script dangerouslySetInnerHTML={{
        __html: `
          (function() {
            const ctx = document.getElementById('heatmap-chart');
            if (ctx && !ctx.chart) {
              const data = ${JSON.stringify(heatmapData)};
              const labels = [];
              const values = [];
              for (let i = 29; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const iso = d.toISOString().split('T')[0];
                labels.push(iso);
                const found = data.find(h => h.date === iso);
                values.push(found ? found.count : 0);
              }
              ctx.chart = new Chart(ctx, {
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
              });
            }
          })();
        `
      }} />
    </div>
  )
}