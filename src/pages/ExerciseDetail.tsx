import { useState, useEffect, useRef } from 'preact/hooks'
import { useLocation, useRoute } from 'wouter'
import {
  getExercise,
  getExerciseHistory,
  getEstimated1RM,
  getAllSessions
} from '../services/dataService'
import { formatDateShort, formatDateWithWeekday } from '../lib/date'
import { Card } from '../components/Card'
import { Button } from '../components/Button'
import { Stat } from '../components/Stat'
import { EmptyState } from '../components/EmptyState'
import type { Exercise, ExerciseHistory, Session } from '../models'
import type { Chart } from 'chart.js'

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

function getCSSVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}

export function ExerciseDetail() {
  const [, navigate] = useLocation()
  const [, params] = useRoute('/exercises/:id')
  const exerciseId = params?.id ? decodeURIComponent(params.id) : null
  const [exercise, setExercise] = useState<Exercise | null>(null)
  const [history, setHistory] = useState<ExerciseHistory[]>([])
  const [allSessions, setAllSessions] = useState<Session[]>([])
  const [estimated1RM, setEstimated1RM] = useState<{ exerciseName: string; estimated1RM: number; date: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const chartCanvasRef = useRef<HTMLCanvasElement>(null)
  const chartInstanceRef = useRef<Chart | null>(null)

  async function loadExerciseData() {
    const exId = exerciseId
    if (!exId) {
      setError('Ingen övning angiven.')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const [ex, hist, rmData, sessions] = await Promise.all([
        getExercise(exId),
        getExerciseHistory(exId),
        getEstimated1RM(exId),
        getAllSessions()
      ])

      if (!ex) {
        setError('Övningen kunde inte hittas.')
      } else {
        setExercise(ex)
        setHistory(hist.sort((a, b) => b.date.localeCompare(a.date)))
        setEstimated1RM(rmData)
        setAllSessions(sessions)
      }
    } catch (err) {
      console.error('Fel vid laddning av övning:', err)
      setError('Kunde inte ladda övningsdata.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadExerciseData()
  }, [exerciseId])

  // Rendera graf över 1RM och toppvikt över tid
  useEffect(() => {
    if (!exercise || history.length === 0 || !chartCanvasRef.current) return

    const chronological = [...history].sort((a, b) => a.date.localeCompare(b.date))
    const labels = chronological.map(h => h.date)
    const maxWeights = chronological.map(h => h.setEntries.reduce((m, s) => Math.max(m, s.weight), 0))
    const volumes = chronological.map(h => h.volume)

    let isMounted = true

    getChartModule().then(mod => {
      if (!isMounted || !chartCanvasRef.current) return
      const ChartClass = mod.Chart

      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy()
        chartInstanceRef.current = null
      }

      const accentColor = getCSSVar('--accent', '#ff4757')
      const primaryColor = getCSSVar('--primary', '#2c3e50')
      const textColor = getCSSVar('--text-muted', '#5b6472')
      const borderColor = getCSSVar('--border', '#e4e7ee')

      chartInstanceRef.current = new ChartClass(chartCanvasRef.current, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Tyngsta set (kg)',
              data: maxWeights,
              borderColor: accentColor,
              backgroundColor: 'rgba(255, 71, 87, 0.1)',
              tension: 0.25,
              fill: false,
              pointRadius: 4,
              pointHoverRadius: 6,
              yAxisID: 'y'
            },
            {
              label: 'Totalvolym (kg)',
              data: volumes,
              borderColor: primaryColor,
              borderDash: [4, 4],
              backgroundColor: 'transparent',
              tension: 0.25,
              pointRadius: 3,
              yAxisID: 'y1'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: 'index',
            intersect: false
          },
          plugins: {
            legend: {
              position: 'top',
              labels: { color: textColor, font: { family: 'Geist, system-ui' } }
            },
            tooltip: {
              callbacks: {
                title: context => formatDateShort(context[0].label)
              }
            }
          },
          scales: {
            x: {
              grid: { color: borderColor },
              ticks: {
                color: textColor,
                callback: (_, index) => {
                  const dateStr = labels[index]
                  return dateStr ? dateStr.slice(5) : ''
                }
              }
            },
            y: {
              type: 'linear',
              position: 'left',
              grid: { color: borderColor },
              ticks: { color: textColor },
              title: { display: true, text: 'Vikt (kg)', color: textColor }
            },
            y1: {
              type: 'linear',
              position: 'right',
              grid: { drawOnChartArea: false },
              ticks: { color: textColor },
              title: { display: true, text: 'Volym (kg)', color: textColor }
            }
          }
        }
      })
    })

    return () => {
      isMounted = false
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy()
        chartInstanceRef.current = null
      }
    }
  }, [exercise, history])

  if (loading) {
    return (
      <div>
        <h1 class="page-title">Övningsdetaljer</h1>
        <Card class="skeleton skeleton-card mb"></Card>
        <Card class="skeleton skeleton-chart mb"></Card>
      </div>
    )
  }

  if (error || !exercise) {
    return (
      <EmptyState
        title="Kunde inte öppna övning"
        message={error || 'Övningen hittades inte.'}
        action={<Button onClick={() => navigate('/stats')}>Tillbaka till Statistik</Button>}
      />
    )
  }

  const maxWeightEver = history.reduce(
    (max, h) => h.setEntries.reduce((m, s) => Math.max(m, s.weight), max),
    0
  )

  return (
    <div>
      <div class="flex justify-between items-center mb">
        <div>
          <button
            type="button"
            class="btn btn-sm btn-secondary mb-1 flex items-center gap-1"
            onClick={() => navigate('/stats')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24"><path fill="currentColor" d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
            Statistik
          </button>
          <h1 class="page-title m-0">{exercise.name}</h1>
          <span class="badge badge-primary mt-1">{exercise.muscleGroup || 'Övrigt'}</span>
        </div>
        {history[0]?.sessionId && (
          <Button
            variant="primary"
            onClick={() => navigate(`/log?from=${history[0].sessionId}`)}
          >
            Kör passet igen
          </Button>
        )}
      </div>

      <div class="grid grid-3 mb">
        <Card padding="sm">
          <Stat
            label="Estimerat 1RM"
            value={estimated1RM ? `${Math.round(estimated1RM.estimated1RM)} kg` : '—'}
          />
        </Card>
        <Card padding="sm">
          <Stat
            label="Tyngsta lyft"
            value={maxWeightEver > 0 ? `${maxWeightEver} kg` : '—'}
          />
        </Card>
        <Card padding="sm">
          <Stat
            label="Genomförda pass"
            value={history.length}
          />
        </Card>
      </div>

      {/* Progressionsdiagram */}
      <Card title="Progression & Volym över tid" class="mb">
        {history.length <= 1 ? (
          <p class="text-sm text-muted m-0">Kör övningen i fler pass för att rita en progressionskurva.</p>
        ) : (
          <div style="height: 280px; position: relative;">
            <canvas ref={chartCanvasRef}></canvas>
          </div>
        )}
      </Card>

      {/* Historiklista */}
      <Card title="Tidigare genomföranden" padding="none">
        <div class="table-wrap table-rows" style="padding: 0 var(--space-6) var(--space-6) var(--space-6)">
          <table>
            <thead>
              <tr>
                <th>Datum</th>
                <th>Pass</th>
                <th>Set & Reps</th>
                <th>Volym</th>
              </tr>
            </thead>
            <tbody>
              {history.map(item => {
                const session = allSessions.find(s => s.id === item.sessionId)
                return (
                  <tr
                    key={item.id}
                    onClick={() => navigate(`/history/${item.sessionId}`)}
                    style="cursor: pointer;"
                  >
                    <td>{formatDateWithWeekday(item.date)}</td>
                    <td>
                      <span class="badge badge-primary">{session?.templateName || 'Pass'}</span>
                    </td>
                    <td class="tabular-nums">
                      {item.setEntries
                        .map(s => (s.weight > 0 ? `${s.weight} kg × ${s.reps}` : `${s.reps} reps`))
                        .join(', ')}
                    </td>
                    <td class="volume-hero tabular-nums">
                      {item.volume.toLocaleString('sv-SE')} kg
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
