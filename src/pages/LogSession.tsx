import { useState, useEffect, useRef } from 'preact/hooks'
import { getAllTemplates, getAllExercises, createSession, getOrCreateExercise, getSession } from '../services/dataService'
import { todayISO } from '../models'
import { icon } from '../icons'
import type { Template, Exercise, TemplateExercise, SetEntry } from '../models'

interface FormExercise {
  exerciseId: string
  exerciseName: string
  setEntries: SetEntry[]
}

export function LogSession() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [allExercises, setAllExercises] = useState<Exercise[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [exercises, setExercises] = useState<FormExercise[]>([])
  const [date, setDate] = useState(() => todayISO())
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const fromSessionRef = useRef<string | null>(null)

  async function checkPrefill() {
    try {
      setLoading(true)
      setError(null)
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
              setEntries: e.setEntries
            }))
            setExercises(formExercises)
            setDate(todayISO())
            // Clear the URL parameter
            window.history.replaceState({}, '', window.location.pathname)
          }
        } catch (err) {
          console.error('Failed to load session for prefill:', err)
          // Continue to load templates even if prefill fails
        }
      }
      
      await loadTemplates()
    } catch (err) {
      setError('Kunde inte ladda mallar. Försök igen.')
      console.error('Fel vid laddning:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
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
        setEntries: [te.defaultSetEntry]
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
          return { 
            exerciseId,
            exerciseName: e.exerciseName,
            setEntries: e.setEntries,
            order: 0 // Order kommer att sättas i createSession
          }
        })
      )

      await createSession(date, selectedTemplateId, template.name, validExercises)
      setSaved(true)
      setExercises([])
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      console.error(err)
      setError('Kunde inte spara pass')
    } finally {
      setSaving(false)
    }
  }

  function updateExercise(idx: number, field: keyof FormExercise, value: string | number | SetEntry[]) {
    const newExercises = [...exercises]
    newExercises[idx] = { ...newExercises[idx], [field]: value }
    setExercises(newExercises)
  }

  function addExercise() {
    setExercises([...exercises, { exerciseId: `new-${Date.now()}`, exerciseName: '', setEntries: [{ sets: 3, reps: 10, weight: 0 }] }])
  }

  function removeExercise(idx: number) {
    const newExercises = exercises.filter((_, i) => i !== idx)
    setExercises(newExercises)
  }

  function addSetToExercise(exerciseIdx: number) {
    const newExercises = [...exercises]
    newExercises[exerciseIdx] = {
      ...newExercises[exerciseIdx],
      setEntries: [...newExercises[exerciseIdx].setEntries, { sets: 1, reps: 10, weight: 0 }]
    }
    setExercises(newExercises)
  }

  function removeSetFromExercise(exerciseIdx: number, setIdx: number) {
    const newExercises = [...exercises]
    if (newExercises[exerciseIdx].setEntries.length > 1) {
      newExercises[exerciseIdx] = {
        ...newExercises[exerciseIdx],
        setEntries: newExercises[exerciseIdx].setEntries.filter((_, i) => i !== setIdx)
      }
      setExercises(newExercises)
    }
  }

  function handleInputChange(e: Event, idx: number, field: keyof FormExercise, setIdx?: number, nestedField?: keyof SetEntry) {
    const target = e.target as HTMLInputElement
    const value = target.type === 'number' ? (parseFloat(target.value) || 0) : target.value
    
    if (field === 'setEntries' && setIdx !== undefined && nestedField) {
      // Uppdatera nested field i setEntries array
      const exercise = exercises[idx]
      const newSetEntries = [...exercise.setEntries]
      newSetEntries[setIdx] = { ...newSetEntries[setIdx], [nestedField]: value }
      updateExercise(idx, 'setEntries', newSetEntries)
    } else {
      updateExercise(idx, field, value)
    }
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

  if (loading) {
    return (
      <div>
        <h1 class="page-title">Logga pass</h1>
        <div class="card mb skeleton skeleton-card"></div>
        <div class="card mb skeleton skeleton-card"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div class="empty-state">
        <h3>Fel vid laddning</h3>
        <p>{error}</p>
        <button class="btn btn-primary mt" onClick={checkPrefill}>Försök igen</button>
      </div>
    )
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
                          <input 
                            type="number" 
                            min="1" 
                            max="20" 
                            value={ex.setEntries[0]?.sets || 0} 
                            onChange={e => handleInputChange(e, idx, 'setEntries', 0, 'sets')} 
                            class="table-input" 
                          />
                        </td>
                        <td>
                          <input 
                            type="number" 
                            min="1" 
                            max="50" 
                            value={ex.setEntries[0]?.reps || 0} 
                            onChange={e => handleInputChange(e, idx, 'setEntries', 0, 'reps')} 
                            class="table-input" 
                          />
                        </td>
                        <td>
                          <input 
                            type="number" 
                            min="0" 
                            step="0.5" 
                            max="500" 
                            value={ex.setEntries[0]?.weight || 0} 
                            onChange={e => handleInputChange(e, idx, 'setEntries', 0, 'weight')} 
                            class="table-input" 
                          />
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
                      {ex.setEntries.map((set, setIdx) => (
                        <div key={setIdx} class="input-group grid-3">
                          <div>
                            <label>Set {setIdx + 1}</label>
                            <input 
                              type="number" 
                              min="1" 
                              max="20" 
                              value={set.sets} 
                              onChange={e => handleInputChange(e, idx, 'setEntries', setIdx, 'sets')} 
                            />
                          </div>
                          <div>
                            <label>Reps</label>
                            <input 
                              type="number" 
                              min="1" 
                              max="50" 
                              value={set.reps} 
                              onChange={e => handleInputChange(e, idx, 'setEntries', setIdx, 'reps')} 
                            />
                          </div>
                          <div>
                            <label>Vikt (kg)</label>
                            <input 
                              type="number" 
                              min="0" 
                              step="0.5" 
                              max="500" 
                              value={set.weight} 
                              onChange={e => handleInputChange(e, idx, 'setEntries', setIdx, 'weight')} 
                            />
                          </div>
                          {ex.setEntries.length > 1 && (
                            <div class="m-0">
                              <button class="btn btn-danger btn-sm h-full" onClick={() => removeSetFromExercise(idx, setIdx)}>Ta bort</button>
                            </div>
                          )}
                        </div>
                      ))}
                      <button class="btn btn-secondary btn-sm mt-1" onClick={() => addSetToExercise(idx)}>+ Lägg till set</button>
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