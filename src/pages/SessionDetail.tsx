import { useState, useEffect, useCallback } from 'preact/hooks'
import { useLocation } from 'wouter'
import { 
  getSession, 
  getAllExercises, 
  updateSession, 
  deleteSession,
  getOrCreateExercise 
} from '../services/dataService'
import { icon } from '../icons'
import { formatDateFull, formatDateShort } from '../lib/date'
import type { Session, Exercise, SessionExercise, SetEntry } from '../models'

interface FormExercise {
  exerciseId: string
  exerciseName: string
  setEntries: SetEntry[]
}

function calculateExerciseVolume(ex: FormExercise | SessionExercise): number {
  return ex.setEntries.reduce((sum, set) => sum + (set.sets * set.reps * set.weight), 0)
}

function calculateTotalVolume(exercises: (FormExercise | SessionExercise)[]): number {
  return exercises.reduce((sum, e) => sum + calculateExerciseVolume(e), 0)
}

// Delete confirmation dialog
function DeleteDialog({
  isOpen,
  onClose,
  onConfirm,
  sessionName,
  sessionDate
}: {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  sessionName: string
  sessionDate: string
}) {
  if (!isOpen) return null

  return (
    <div class="dialog-overlay" onClick={onClose}>
      <div class="dialog" onClick={e => e.stopPropagation()}>
        <div class="flex justify-between items-center mb">
          <h3 class="m-0">Radera pass</h3>
          <button class="banner-dismiss" onClick={onClose} aria-label="Stäng">
            <svg width="16" height="16" viewBox="0 0 19 19"><use href={icon('x-icon')} /></svg>
          </button>
        </div>
        <p>
          Är du säker på att du vill radera pass <strong>"{sessionName}"</strong> från {sessionDate}?
          <br />
          Det går inte att ångra.
        </p>
        <div class="flex gap mt justify-end">
          <button class="btn btn-secondary" onClick={onClose}>Avbryt</button>
          <button class="btn btn-danger" onClick={onConfirm}>Radera</button>
        </div>
      </div>
    </div>
  )
}

// Toast component
function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 3000)
    return () => clearTimeout(timer)
  }, [onDismiss])

  return (
    <div class="toast" onClick={onDismiss}>
      {message}
    </div>
  )
}

export function SessionDetail() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [allExercises, setAllExercises] = useState<Exercise[]>([])
  const [formDate, setFormDate] = useState('')
  const [formExercises, setFormExercises] = useState<FormExercise[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [, navigate] = useLocation()
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Get session ID from URL
  const getSessionId = useCallback((): string | null => {
    const pathParts = window.location.pathname.split('/')
    const idIndex = pathParts.findIndex(p => p === 'history') + 1
    return idIndex > 0 && idIndex < pathParts.length ? pathParts[idIndex] : null
  }, [])

  // Load session data
  useEffect(() => {
    async function load() {
      const sessionId = getSessionId()
      if (!sessionId) {
        setNotFound(true)
        setLoading(false)
        return
      }

      try {
        const [sess, exercises] = await Promise.all([
          getSession(sessionId),
          getAllExercises()
        ])
        
        if (!sess) {
          setNotFound(true)
        } else {
          setSession(sess)
          setAllExercises(exercises)
          setFormDate(sess.date)
          // Convert session exercises to form exercises
          const formEx: FormExercise[] = sess.exercises.map(e => ({
            exerciseId: e.exerciseId,
            exerciseName: e.exerciseName,
            setEntries: e.setEntries
          }))
          setFormExercises(formEx)
        }
      } catch (err) {
        console.error('Failed to load session:', err)
        setError('Kunde inte ladda passet. Försök igen.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [getSessionId])

  // Reset saved message
  useEffect(() => {
    if (saved) {
      const timer = setTimeout(() => setSaved(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [saved])

  // Dismiss toast
  function dismissToast() {
    setToastMessage(null)
  }

  // Handle save
  async function handleSave() {
    if (formExercises.length === 0) return
    setSaving(true)
    
    try {
      const sessionId = getSessionId()
      if (!sessionId || !session) return

      // Validate exercises
      const validExercises = await Promise.all(
        formExercises.map(async (e, i) => {
          let exerciseId = e.exerciseId
          if (!exerciseId || exerciseId.startsWith('new-')) {
            const ex = await getOrCreateExercise(e.exerciseName)
            exerciseId = ex.id
          }
          return {
            exerciseId,
            exerciseName: e.exerciseName,
            setEntries: e.setEntries,
            order: i
          }
        })
      )

      await updateSession(session.id, {
        date: formDate,
        exercises: validExercises
      })
      
      // Update local state
      const updatedSession = {
        ...session,
        date: formDate,
        exercises: validExercises
      }
      setSession(updatedSession)
      setFormExercises(validExercises.map(e => ({
        exerciseId: e.exerciseId,
        exerciseName: e.exerciseName,
        setEntries: e.setEntries
      })))
      setEditing(false)
      setSaved(true)
      setToastMessage(`Pass "${session.templateName}" uppdaterat.`)
    } catch (err) {
      console.error('Failed to save session:', err)
    } finally {
      setSaving(false)
    }
  }

  // Handle delete
  async function handleDelete() {
    const sessionId = getSessionId()
    if (!sessionId || !session) return
    
    setDeleteDialogOpen(false)
    setLoading(true)
    
    try {
      await deleteSession(sessionId)
      setToastMessage(`Pass "${session.templateName}" (${session.date}) raderat.`)
      // Navigate back to history after a brief delay
      setTimeout(() => {
        navigate('/history')
      }, 500)
    } catch (err) {
      console.error('Failed to delete session:', err)
      setLoading(false)
    }
  }

  // Run again - navigate to /log?from=<sessionId>
  function handleRunAgain() {
    if (!session) return
    navigate(`/log?from=${session.id}`)
  }

  // Toggle edit mode
  function toggleEdit() {
    setEditing(!editing)
    // Reset saved state when entering edit mode
    if (!editing) {
      setSaved(false)
      if (session) {
        setFormDate(session.date)
        setFormExercises(session.exercises.map(e => ({
          exerciseId: e.exerciseId,
          exerciseName: e.exerciseName,
          setEntries: e.setEntries
        })))
      }
    }
  }

  // Cancel edit
  function cancelEdit() {
    setEditing(false)
    if (session) {
      setFormDate(session.date)
      setFormExercises(session.exercises.map(e => ({
        exerciseId: e.exerciseId,
        exerciseName: e.exerciseName,
        setEntries: e.setEntries
      })))
    }
  }

  // Form handlers
  function updateExercise(idx: number, field: keyof FormExercise, value: string | number | SetEntry[]) {
    const newExercises = [...formExercises]
    newExercises[idx] = { ...newExercises[idx], [field]: value }
    setFormExercises(newExercises)
  }

  function addExercise() {
    setFormExercises([...formExercises, {
      exerciseId: `new-${Date.now()}`,
      exerciseName: '',
      setEntries: [{ sets: 3, reps: 10, weight: 0 }]
    }])
  }

  function addSetToExercise(exerciseIdx: number) {
    const newExercises = [...formExercises]
    newExercises[exerciseIdx] = {
      ...newExercises[exerciseIdx],
      setEntries: [...newExercises[exerciseIdx].setEntries, { sets: 1, reps: 10, weight: 0 }]
    }
    setFormExercises(newExercises)
  }

  function removeSetFromExercise(exerciseIdx: number, setIdx: number) {
    const newExercises = [...formExercises]
    if (newExercises[exerciseIdx].setEntries.length > 1) {
      newExercises[exerciseIdx] = {
        ...newExercises[exerciseIdx],
        setEntries: newExercises[exerciseIdx].setEntries.filter((_, i) => i !== setIdx)
      }
      setFormExercises(newExercises)
    }
  }

  function removeExercise(idx: number) {
    const newExercises = formExercises.filter((_, i) => i !== idx)
    setFormExercises(newExercises)
  }

  function handleInputChange(e: Event, idx: number, field: keyof FormExercise, setIdx?: number, nestedField?: keyof SetEntry) {
    const target = e.target as HTMLInputElement
    const value = target.type === 'number' ? (parseFloat(target.value) || 0) : target.value
    
    if (field === 'setEntries' && setIdx !== undefined && nestedField) {
      // Uppdatera nested field i setEntries array
      const exercise = formExercises[idx]
      const newSetEntries = [...exercise.setEntries]
      newSetEntries[setIdx] = { ...newSetEntries[setIdx], [nestedField]: value }
      updateExercise(idx, 'setEntries', newSetEntries)
    } else {
      updateExercise(idx, field, value)
    }
  }

  function handleDateChange(e: Event) {
    const target = e.target as HTMLInputElement
    setFormDate(target.value)
  }

  // Render loading state
  if (loading) {
    return (
      <div>
        <h1 class="page-title">Passdetaljer</h1>
        <div class="card skeleton skeleton-card"></div>
      </div>
    )
  }

  // Render error state
  if (error) {
    return (
      <div>
        <h1 class="page-title">Passdetaljer</h1>
        <div class="card">
          <div class="empty-state">
            <h3>Fel vid laddning</h3>
            <p>{error}</p>
            <button class="btn btn-primary mt" onClick={() => window.location.reload()}>Försök igen</button>
          </div>
        </div>
      </div>
    )
  }

  // Render not found state
  if (notFound || !session) {
    return (
      <div>
        <h1 class="page-title">Passdetaljer</h1>
        <div class="card">
          <div class="empty-state">
            <h3>Passet hittades inte</h3>
            <p>
              <a href="/history" class="btn btn-primary mt-sm">Tillbaka till historik</a>
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Render empty state
  if (session.exercises.length === 0) {
    return (
      <div>
        <h1 class="page-title">Passdetaljer</h1>
        <div class="card">
          <div class="empty-state">
            <h3>Passet har inga övningar</h3>
            <p>
              <a href="/history" class="btn btn-primary mt-sm">Tillbaka till historik</a>
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Render read mode (default)
  if (!editing) {
    return (
      <div>
        <h1 class="page-title">Passdetaljer</h1>

        <div class="card mb">
          <div class="flex justify-between items-center mb">
            <div>
              <h2 class="mb-1">{session.templateName}</h2>
              <p class="m-0 text-muted">{formatDateFull(session.date)}</p>
            </div>
            <div class="flex gap-sm">
              <button class="btn btn-primary btn-sm" onClick={handleRunAgain}>Kör igen</button>
              <button class="btn btn-secondary btn-sm" onClick={toggleEdit}>Redigera</button>
              <button class="btn btn-danger btn-sm" onClick={() => setDeleteDialogOpen(true)}>Radera</button>
            </div>
          </div>
        </div>

        <div class="card mb">
          <h3 class="mb-sm">Övningar</h3>
          <div class="session-detail-exercise-list">
            <div class="session-detail-table">
              <table>
                <thead>
                  <tr>
                    <th>Övning</th>
                    <th>Set</th>
                    <th>Reps</th>
                    <th>Vikt (kg)</th>
                    <th>Volym</th>
                  </tr>
                </thead>
                <tbody>
                  {session.exercises.map((ex, idx) => (
                    <tr key={idx}>
                      <td>{ex.exerciseName}</td>
                      <td class="tabular-nums">
                        {ex.setEntries.length > 1 ? `${ex.setEntries[0]?.sets}+` : ex.setEntries[0]?.sets}
                      </td>
                      <td class="tabular-nums">
                        {ex.setEntries.length > 1 ? `${ex.setEntries[0]?.reps}+` : ex.setEntries[0]?.reps}
                      </td>
                      <td class="tabular-nums">
                        {ex.setEntries.length > 1 ? `${ex.setEntries[0]?.weight}+` : ex.setEntries[0]?.weight}
                      </td>
                      <td class="tabular-nums">{calculateExerciseVolume(ex).toLocaleString('sv-SE')} kg</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4} class="text-right font-semibold">Total:</td>
                    <td class="tabular-nums font-semibold">{calculateTotalVolume(session.exercises).toLocaleString('sv-SE')} kg</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
          <p class="mt-sm text-right text-muted">
            <a href="/history" class="btn btn-secondary btn-sm">Tillbaka till historik</a>
          </p>
        </div>

        {/* Delete dialog */}
        <DeleteDialog
          isOpen={deleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
          onConfirm={handleDelete}
          sessionName={session.templateName}
          sessionDate={formatDateShort(session.date)}
        />

        {/* Toast */}
        {toastMessage && <Toast message={toastMessage} onDismiss={dismissToast} />}
      </div>
    )
  }

  // Render edit mode
  return (
    <div>
      <h1 class="page-title">Redigera pass</h1>

      <div class="card mb">
        <div class="flex justify-between items-center mb">
          <h2 class="m-0">{session.templateName}</h2>
          <div class="flex gap-sm">
            <button class="btn btn-secondary btn-sm" onClick={cancelEdit}>Avbryt</button>
            <button 
              class="btn btn-primary btn-sm" 
              onClick={handleSave} 
              disabled={saving || formExercises.length === 0}
            >
              {saving ? 'Sparar...' : 'Spara'}
            </button>
          </div>
        </div>

        <div class="input-group mb">
          <label>Datum</label>
          <input type="date" value={formDate} onChange={handleDateChange} />
        </div>

        <h3 class="mb-sm">Övningar</h3>
        
        <datalist id="session-exercise-suggestions">
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
                {formExercises.map((ex, idx) => (
                  <tr key={idx}>
                    <td>
                      <input
                        type="text"
                        value={ex.exerciseName}
                        onChange={e => handleInputChange(e, idx, 'exerciseName')}
                        placeholder="Skriv övningsnamn..."
                        list="session-exercise-suggestions"
                        class="table-input"
                      />
                    </td>
                    <td>
                      <input type="number" min="1" max="20" value={ex.setEntries[0]?.sets || 0} onChange={e => handleInputChange(e, idx, 'setEntries', 0, 'sets')} class="table-input" />
                    </td>
                    <td>
                      <input type="number" min="1" max="50" value={ex.setEntries[0]?.reps || 0} onChange={e => handleInputChange(e, idx, 'setEntries', 0, 'reps')} class="table-input" />
                    </td>
                    <td>
                      <input type="number" min="0" step="0.5" max="500" value={ex.setEntries[0]?.weight || 0} onChange={e => handleInputChange(e, idx, 'setEntries', 0, 'weight')} class="table-input" />
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
            {formExercises.map((ex, idx) => (
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
                      list="session-exercise-suggestions"
                    />
                  </div>
                  {ex.setEntries.map((set, setIdx) => (
                    <div key={setIdx} class="input-group grid-3">
                      <div>
                        <label>Set {setIdx + 1}</label>
                        <input type="number" min="1" max="20" value={set.sets} onChange={e => handleInputChange(e, idx, 'setEntries', setIdx, 'sets')} />
                      </div>
                      <div>
                        <label>Reps</label>
                        <input type="number" min="1" max="50" value={set.reps} onChange={e => handleInputChange(e, idx, 'setEntries', setIdx, 'reps')} />
                      </div>
                      <div>
                        <label>Vikt (kg)</label>
                        <input type="number" min="0" step="0.5" max="500" value={set.weight} onChange={e => handleInputChange(e, idx, 'setEntries', setIdx, 'weight')} />
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
          <button class="btn btn-secondary mt" onClick={addExercise}>+ Lägg till övning</button>
        </div>
      </div>

      {saved && (
        <div class="toast">Pass sparat!</div>
      )}

      {/* Delete dialog */}
      <DeleteDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDelete}
        sessionName={session.templateName}
        sessionDate={formatDateShort(session.date)}
      />

      {/* Toast */}
      {toastMessage && <Toast message={toastMessage} onDismiss={dismissToast} />}
    </div>
  )
}
