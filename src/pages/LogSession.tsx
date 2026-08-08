import { useState, useEffect, useRef } from 'preact/hooks'
import { getAllTemplates, getAllExercises, createSession, getOrCreateExercise, getSession } from '../services/dataService'
import { todayISO } from '../models'
import { icon } from '../icons'
import type { Template, Exercise, TemplateExercise } from '../models'

interface FormExercise {
  exerciseId: string
  exerciseName: string
  sets: number
  reps: number
  weight: number
}

export function LogSession() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [allExercises, setAllExercises] = useState<Exercise[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [exercises, setExercises] = useState<FormExercise[]>([])
  const [date, setDate] = useState(() => todayISO())
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const fromSessionRef = useRef<string | null>(null)

  useEffect(() => {
    async function checkPrefill() {
      // Check URL for ?from=<sessionId> parameter
      const urlParams = new URLSearchParams(window.location.search)
      const fromSessionId = urlParams.get('from')
      
      if (fromSessionId) {
        fromSessionRef.current = fromSessionId
        try {
          const session = await getSession(fromSessionId)
          if (session) {
            // Prefill with the session's template and exercises
            setSelectedTemplateId(session.templateId)
            const formExercises: FormExercise[] = session.exercises.map(e => ({
              exerciseId: e.exerciseId,
              exerciseName: e.exerciseName,
              sets: e.sets,
              reps: e.reps,
              weight: e.weight
            }))
            setExercises(formExercises)
            setDate(todayISO())
            // Clear the URL parameter
            window.history.replaceState({}, '', window.location.pathname)
          }
        } catch (err) {
          console.error('Failed to load session for prefill:', err)
        }
      }
      
      loadTemplates()
    }
    checkPrefill()
  }, [])

  useEffect(() => {
    // Only load template exercises if we haven't prefilled from a session
    if (selectedTemplateId && !fromSessionRef.current) {
      loadTemplateExercises()
    } else if (!selectedTemplateId) {
      setExercises([])
    }
  }, [selectedTemplateId, templates])

  async function loadTemplates() {
    const [ts, es] = await Promise.all([getAllTemplates(), getAllExercises()])
    setTemplates(ts)
    setAllExercises(es)
    if (ts.length > 0 && !selectedTemplateId) {
      setSelectedTemplateId(ts[0].id)
    }
  }

  async function loadTemplateExercises() {
    const template = templates.find(t => t.id === selectedTemplateId)
    if (template) {
      const allExercises = await getAllExercises()
      const exMap = new Map(allExercises.map(e => [e.id, e.name]))
      const formExercises: FormExercise[] = template.exercises.map((te: TemplateExercise) => ({
        exerciseId: te.exerciseId,
        exerciseName: exMap.get(te.exerciseId) || '',
        sets: te.defaultSets,
        reps: te.defaultReps,
        weight: te.defaultWeight
      }))
      setExercises(formExercises)
    }
  }

  async function handleSave() {
    if (exercises.length === 0) return
    setSaving(true)
    try {
      const template = templates.find(t => t.id === selectedTemplateId)
      if (!template) throw new Error('Template not found')

      const validExercises = await Promise.all(
        exercises.map(async e => {
          let exerciseId = e.exerciseId
          if (!exerciseId || exerciseId.startsWith('new-')) {
            const ex = await getOrCreateExercise(e.exerciseName)
            exerciseId = ex.id
          }
          return { ...e, exerciseId }
        })
      )

      await createSession(date, selectedTemplateId, template.name, validExercises)
      setSaved(true)
      setExercises([])
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      console.error(err)
      alert('Kunde inte spara pass')
    } finally {
      setSaving(false)
    }
  }

  function updateExercise(idx: number, field: keyof FormExercise, value: any) {
    const newExercises = [...exercises]
    newExercises[idx] = { ...newExercises[idx], [field]: value }
    setExercises(newExercises)
  }

  function addExercise() {
    setExercises([...exercises, { exerciseId: `new-${Date.now()}`, exerciseName: '', sets: 3, reps: 10, weight: 0 }])
  }

  function removeExercise(idx: number) {
    const newExercises = exercises.filter((_, i) => i !== idx)
    setExercises(newExercises)
  }

  function handleInputChange(e: Event, idx: number, field: keyof FormExercise) {
    const target = e.target as HTMLInputElement
    const value = target.type === 'number' ? (parseFloat(target.value) || 0) : target.value
    updateExercise(idx, field, value)
  }

  function handleDateChange(e: Event) {
    const target = e.target as HTMLInputElement
    setDate(target.value)
  }

  function handleSelectChange(e: Event) {
    const target = e.target as HTMLSelectElement
    setSelectedTemplateId(target.value)
    // Clear the prefill ref when user manually selects a template
    fromSessionRef.current = null
  }

  return (
    <div>
      <h1 class="page-title">Logga pass</h1>

      <div class="card mb">
        <div class="grid grid-2 mb">
          <div class="input-group">
            <label>Datum</label>
            <input type="date" value={date} onChange={handleDateChange} />
          </div>
          <div class="input-group">
            <label>Mall</label>
            <select value={selectedTemplateId} onChange={handleSelectChange}>
              {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div class="card mb">
        <h3 class="mb">Övningar</h3>

        {exercises.length === 0 ? (
          <div class="empty-state">
            <p>Välj en mall ovan eller lägg till övningar manuellt.</p>
            <button class="btn btn-primary mt" onClick={addExercise}>Lägg till övning</button>
          </div>
        ) : (
          <>
            <datalist id="exercise-suggestions">
              {allExercises.map(e => (
                <option key={e.id} value={e.name} />
              ))}
            </datalist>
            <div class="exercise-list">
              <div class="exercise-list-table">
                <table>
                  <thead>
                    <tr>
                      <th>Övning</th>
                      <th>Set</th>
                      <th>Reps</th>
                      <th>Vikt (kg)</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {exercises.map((ex, idx) => (
                      <tr key={idx}>
                        <td>
                          <input
                            type="text"
                            value={ex.exerciseName}
                            onChange={e => handleInputChange(e, idx, 'exerciseName')}
                            placeholder="Skriv övningsnamn..."
                            list="exercise-suggestions"
                            class="table-input"
                          />
                        </td>
                        <td>
                          <input type="number" min="1" max="20" value={ex.sets} onChange={e => handleInputChange(e, idx, 'sets')} class="table-input" />
                        </td>
                        <td>
                          <input type="number" min="1" max="50" value={ex.reps} onChange={e => handleInputChange(e, idx, 'reps')} class="table-input" />
                        </td>
                        <td>
                          <input type="number" min="0" step="0.5" max="500" value={ex.weight} onChange={e => handleInputChange(e, idx, 'weight')} class="table-input" />
                        </td>
                        <td class="remove-cell">
                          <button class="btn-remove" onClick={() => removeExercise(idx)} aria-label="Ta bort">
                            <svg width="20" height="20" viewBox="0 0 19 19">
                              <use href={icon('x-icon')} />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div class="exercise-list-cards">
                {exercises.map((ex, idx) => (
                  <div key={idx} class="exercise-card">
                    <div class="exercise-card-header">
                      <h4>Övning {idx + 1}</h4>
                      <button class="btn-remove" onClick={() => removeExercise(idx)} aria-label="Ta bort">
                        <svg width="20" height="20" viewBox="0 0 19 19">
                          <use href={icon('x-icon')} />
                        </svg>
                      </button>
                    </div>
                    <div class="exercise-card-fields">
                      <div class="input-group">
                        <label>Övning</label>
                        <input
                          type="text"
                          value={ex.exerciseName}
                          onChange={e => handleInputChange(e, idx, 'exerciseName')}
                          placeholder="Skriv övningsnamn..."
                          list="exercise-suggestions"
                        />
                      </div>
                      <div class="input-group grid-3">
                        <div>
                          <label>Set</label>
                          <input type="number" min="1" max="20" value={ex.sets} onChange={e => handleInputChange(e, idx, 'sets')} />
                        </div>
                        <div>
                          <label>Reps</label>
                          <input type="number" min="1" max="50" value={ex.reps} onChange={e => handleInputChange(e, idx, 'reps')} />
                        </div>
                        <div>
                          <label>Vikt (kg)</label>
                          <input type="number" min="0" step="0.5" max="500" value={ex.weight} onChange={e => handleInputChange(e, idx, 'weight')} />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <button class="btn btn-secondary mt" onClick={addExercise}>+ Lägg till övning</button>
          </>
        )}
      </div>

      <div class="flex gap">
        <button class="btn btn-primary flex-1" onClick={handleSave} disabled={saving || exercises.length === 0}>
          {saving ? 'Sparar...' : 'Spara pass'}
        </button>
      </div>

      {saved && (
        <div class="toast">Pass sparat!</div>
      )}
    </div>
  )
}