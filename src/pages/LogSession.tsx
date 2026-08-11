import { useState, useEffect, useRef } from 'preact/hooks'
import { getAllTemplates, getAllExercises, createSession, getOrCreateExercise, getSession, createTemplate } from '../services/dataService'
import { todayISO } from '../models'
import { icon } from '../icons'
import { Card } from '../components/Card'
import { Button } from '../components/Button'
import { EmptyState } from '../components/EmptyState'
import { Field } from '../components/Field'
import type { Template, Exercise, TemplateExercise, SetEntry } from '../models'
import { RestTimer } from '../components/RestTimer'

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
  const [showSaveTemplate, setShowSaveTemplate] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [prefillSessionId, setPrefillSessionId] = useState<string | null>(null)
  const [draggedExerciseIndex, setDraggedExerciseIndex] = useState<number | null>(null)
  const draggedExerciseIndexRef = useRef<number | null>(null)

  async function checkPrefill() {
    try {
      setLoading(true)
      setError(null)
      const urlParams = new URLSearchParams(window.location.search)
      const fromSessionId = urlParams.get('from')
      const templateName = urlParams.get('template')
      const requestedDate = urlParams.get('date')
      setPrefillSessionId(fromSessionId)

      if (requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
        setDate(requestedDate)
      }
      
      const [ts, es] = await Promise.all([getAllTemplates(), getAllExercises()])
      setTemplates(ts)
      setAllExercises(es)
      
      if (fromSessionId) {
        try {
          const session = await getSession(fromSessionId)
          if (session) {
            setSelectedTemplateId(session.templateId)
            const formExercises: FormExercise[] = session.exercises.map(e => ({
              exerciseId: e.exerciseId,
              exerciseName: e.exerciseName,
              setEntries: e.setEntries
            }))
            setExercises(formExercises)
            setDate(todayISO())
          }
        } catch (err) {
          console.error('Failed to load session for prefill:', err)
        }
      } else if (templateName) {
        // Match template by name (case-insensitive)
        const matchedTemplate = ts.find(t => t.name.toLowerCase() === templateName.toLowerCase())
        if (matchedTemplate) {
          setSelectedTemplateId(matchedTemplate.id)
        } else if (ts.length > 0) {
          // Fallback to first template if no match
          setSelectedTemplateId(ts[0].id)
        }
      } else if (ts.length > 0) {
        // Default to first template
        setSelectedTemplateId(ts[0].id)
      }

      if (fromSessionId || templateName || requestedDate) {
        window.history.replaceState({}, '', window.location.pathname)
      }
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
    if (selectedTemplateId && !prefillSessionId) {
      loadTemplateExercises()
    } else if (!selectedTemplateId && !prefillSessionId) {
      setExercises([])
    }
  }, [selectedTemplateId, templates, prefillSessionId])

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
            order: 0
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

  async function handleSaveAsTemplate() {
    if (exercises.length === 0 || !templateName.trim()) return
    try {
      const templateExercises = await Promise.all(
        exercises.map(async e => {
          let exerciseId = e.exerciseId
          if (!exerciseId || exerciseId.startsWith('new-')) {
            const ex = await getOrCreateExercise(e.exerciseName)
            exerciseId = ex.id
          }
          return {
            exerciseId,
            defaultSetEntry: e.setEntries[0] || { sets: 3, reps: 10, weight: 0 }
          }
        })
      )
      const newTemplate = await createTemplate(templateName.trim(), templateExercises)
      setTemplates(prev => [...prev, newTemplate].sort((a, b) => a.name.localeCompare(b.name)))
      setSelectedTemplateId(newTemplate.id)
      setShowSaveTemplate(false)
      setTemplateName('')
    } catch (err) {
      console.error('Kunde inte spara mall:', err)
      setError('Kunde inte spara mall')
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

  function moveExercise(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex || toIndex < 0 || toIndex >= exercises.length) return
    setExercises(current => {
      const reordered = [...current]
      const [moved] = reordered.splice(fromIndex, 1)
      reordered.splice(toIndex, 0, moved)
      return reordered
    })
  }

  function startExerciseDrag(event: PointerEvent, index: number) {
    if (event.button !== 0) return
    event.preventDefault()
    const handle = event.currentTarget as HTMLButtonElement
    handle.setPointerCapture(event.pointerId)
    draggedExerciseIndexRef.current = index
    setDraggedExerciseIndex(index)
  }

  function continueExerciseDrag(event: PointerEvent) {
    const fromIndex = draggedExerciseIndexRef.current
    if (fromIndex === null) return
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-exercise-index]')
    const toIndex = Number(target?.dataset.exerciseIndex)
    if (!Number.isInteger(toIndex) || toIndex === fromIndex) return
    moveExercise(fromIndex, toIndex)
    draggedExerciseIndexRef.current = toIndex
    setDraggedExerciseIndex(toIndex)
  }

  function endExerciseDrag() {
    draggedExerciseIndexRef.current = null
    setDraggedExerciseIndex(null)
  }

  function handleExerciseDragKey(event: KeyboardEvent, index: number) {
    const direction = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0
    if (!direction) return
    event.preventDefault()
    moveExercise(index, index + direction)
  }

  function dragHandle(index: number) {
    return (
      <button
        type="button"
        class="drag-handle"
        aria-label={`Flytta övning ${index + 1}. Använd uppåt- och nedåtpil eller dra.`}
        onPointerDown={event => startExerciseDrag(event, index)}
        onPointerMove={continueExerciseDrag}
        onPointerUp={endExerciseDrag}
        onPointerCancel={endExerciseDrag}
        onKeyDown={event => handleExerciseDragKey(event, index)}
      >
        <span aria-hidden="true">⋮⋮</span>
      </button>
    )
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
    setPrefillSessionId(null)
  }

  if (loading) {
    return (
      <div>
        <h1 class="page-title">Logga pass</h1>
        <Card class="skeleton skeleton-card mb"></Card>
        <Card class="skeleton skeleton-card mb"></Card>
      </div>
    )
  }

  if (error) {
    return (
      <EmptyState
        title="Fel vid laddning"
        message={error}
        action={<Button onClick={checkPrefill}>Försök igen</Button>}
      />
    )
  }

  return (
    <div class="log-session-layout">
      <aside class="log-session-timer"><RestTimer /></aside>
      <div>
        <h1 class="page-title">Logga pass</h1>

      <Card>
        <div class="grid grid-2 mb">
          <Field label="Datum" class="m-0">
            <input type="date" value={date} onChange={handleDateChange} />
          </Field>
          <Field label="Mall" class="m-0">
            <select value={selectedTemplateId} onChange={handleSelectChange}>
              {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
        </div>
      </Card>

      <Card title="Övningar">
        <div class="flex justify-between items-center mb-sm gap-sm">
          <p class="m-0 text-muted text-sm">Övningarna du fyller i här kan sparas som en mall.</p>
          <Button variant="secondary" size="sm" onClick={() => setShowSaveTemplate(v => !v)}>
            Spara som mall
          </Button>
        </div>
        {showSaveTemplate && (
          <div class="card mb">
            <form
              class="flex gap-sm items-end"
              onSubmit={e => {
                e.preventDefault()
                handleSaveAsTemplate()
              }}
            >
              <Field label="Mallnamn" class="m-0 grow">
                <input
                  type="text"
                  value={templateName}
                  onInput={(e: Event) => setTemplateName((e.target as HTMLInputElement).value)}
                  placeholder="t.ex. Bröst, axlar & triceps – lång"
                  autoFocus
                />
              </Field>
              <Button type="submit" disabled={!templateName.trim() || exercises.length === 0}>
                Spara mall
              </Button>
            </form>
          </div>
        )}
        {exercises.length === 0 ? (
          <EmptyState
            title="Lägg till övningar"
            message="Välj en mall ovan eller lägg till övningar manuellt."
            action={<Button onClick={addExercise}>Lägg till övning</Button>}
          />
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
                      <th aria-label="Ordning"></th>
                      <th>Övning</th>
                      <th>Set</th>
                      <th>Reps</th>
                      <th>Vikt (kg)</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {exercises.map((ex, idx) => (
                      <tr
                        key={idx}
                        data-exercise-index={idx}
                        class={draggedExerciseIndex === idx ? 'exercise-row-dragging' : ''}
                      >
                        <td class="drag-cell">{dragHandle(idx)}</td>
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
                  <div
                    key={idx}
                    data-exercise-index={idx}
                    class={`exercise-card${draggedExerciseIndex === idx ? ' exercise-row-dragging' : ''}`}
                  >
                    <div class="exercise-card-header">
                      <div class="exercise-card-title">
                        {dragHandle(idx)}
                        <h4>Övning {idx + 1}</h4>
                      </div>
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
                              <Button variant="danger" size="sm" class="h-full" onClick={() => removeSetFromExercise(idx, setIdx)}>Ta bort</Button>
                            </div>
                          )}
                        </div>
                      ))}
                      <Button variant="secondary" size="sm" class="mt-1" onClick={() => addSetToExercise(idx)}>+ Lägg till set</Button>
                    </div>
                  </div>
                ))}
              </div>
              <Button variant="secondary" class="mt" onClick={addExercise}>+ Lägg till övning</Button>
            </div>
          </>
        )}
      </Card>

      <div class="flex gap">
        <Button class="flex-1" onClick={handleSave} disabled={saving || exercises.length === 0}>
          {saving ? 'Sparar...' : 'Spara pass'}
        </Button>
      </div>

      {saved && (
        <div class="toast">Pass sparat!</div>
      )}
      </div>
    </div>
  )
}
