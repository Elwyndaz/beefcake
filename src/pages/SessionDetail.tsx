import { useState, useEffect, useCallback } from 'preact/hooks'
import { useLocation } from 'wouter'
import { 
  getSession, 
  getAllExercises, 
  getAllTemplates,
  updateSession, 
  deleteSession,
  getOrCreateExercise,
  createTemplate,
  updateTemplate
} from '../services/dataService'
import { icon } from '../icons'
import { formatDateFull, formatDateShort } from '../lib/date'
import { Card } from '../components/Card'
import { Button } from '../components/Button'
import { EmptyState } from '../components/EmptyState'
import { Field } from '../components/Field'
import type { Session, Exercise, SessionExercise, SetEntry, Template } from '../models'

interface FormExercise {
  exerciseId: string
  exerciseName: string
  setEntries: SetEntry[]
}

function calculateExerciseVolume(ex: FormExercise | SessionExercise): number {
  return ex.setEntries.reduce((sum, set) => sum + (set.weight > 0 ? set.sets * set.reps * set.weight : 0), 0)
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
          <Button variant="secondary" onClick={onClose}>Avbryt</Button>
          <Button variant="danger" onClick={onConfirm}>Radera</Button>
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
  const [allTemplates, setAllTemplates] = useState<Template[]>([])
  const [formDate, setFormDate] = useState('')
  const [formTemplateId, setFormTemplateId] = useState('')
  const [formExercises, setFormExercises] = useState<FormExercise[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [, navigate] = useLocation()
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [showSaveTemplate, setShowSaveTemplate] = useState(false)
  const [newTemplateName, setNewTemplateName] = useState('')

  const getSessionId = useCallback((): string | null => {
    const pathParts = window.location.pathname.split('/')
    const idIndex = pathParts.findIndex(p => p === 'history') + 1
    return idIndex > 0 && idIndex < pathParts.length ? pathParts[idIndex] : null
  }, [])

  useEffect(() => {
    async function load() {
      const sessionId = getSessionId()
      if (!sessionId) {
        setNotFound(true)
        setLoading(false)
        return
      }

      try {
        const [sess, es, ts] = await Promise.all([
          getSession(sessionId),
          getAllExercises(),
          getAllTemplates()
        ])
        
        if (!sess) {
          setNotFound(true)
        } else {
          setSession(sess)
          setAllExercises(es)
          setAllTemplates(ts)
          setFormDate(sess.date)
          setFormTemplateId(sess.templateId)
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

  useEffect(() => {
    if (saved) {
      const timer = setTimeout(() => setSaved(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [saved])

  function dismissToast() {
    setToastMessage(null)
  }

  function handleTemplateChange(e: Event) {
    const target = e.target as HTMLSelectElement
    setFormTemplateId(target.value)
  }

  async function handleSave() {
    if (formExercises.length === 0) return
    setSaving(true)
    
    try {
      const sessionId = getSessionId()
      if (!sessionId || !session) return

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

      const selectedTemplate = allTemplates.find(t => t.id === formTemplateId)
      const templateName = selectedTemplate?.name || session.templateName
      const templateId = selectedTemplate?.id || session.templateId

      await updateSession(session.id, {
        date: formDate,
        templateId,
        templateName,
        exercises: validExercises
      })
      
      const updatedSession = {
        ...session,
        date: formDate,
        templateId,
        templateName,
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

  // Spara ändringar i övningarna till den valda mallen
  async function handleUpdateTemplate() {
    if (!session) return
    const template = allTemplates.find(t => t.id === formTemplateId)
    if (!template) {
      setToastMessage('Denna mall finns inte längre, välj en annan mall eller spara som ny.')
      return
    }
    try {
      const templateExercises = await Promise.all(
        formExercises.map(async (e, i) => {
          let exerciseId = e.exerciseId
          if (!exerciseId || exerciseId.startsWith('new-')) {
            const ex = await getOrCreateExercise(e.exerciseName)
            exerciseId = ex.id
          }
          return {
            exerciseId,
            defaultSetEntry: e.setEntries[0] || { sets: 3, reps: 10, weight: 0 },
            order: i
          }
        })
      )
      await updateTemplate(template.id, { exercises: templateExercises })
      setToastMessage(`Mallen "${template.name}" uppdaterad med nuvarande övningar.`)
    } catch (err) {
      console.error('Failed to update template:', err)
      setToastMessage('Kunde inte uppdatera mallen.')
    }
  }

  // Spara nuvarande övningar som en ny mall
  async function handleSaveAsNewTemplate() {
    if (!session || !newTemplateName.trim()) return
    try {
      const templateExercises = await Promise.all(
        formExercises.map(async e => {
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
      const newTemplate = await createTemplate(newTemplateName.trim(), templateExercises)
      setAllTemplates(prev => [...prev, newTemplate].sort((a, b) => a.name.localeCompare(b.name)))
      setFormTemplateId(newTemplate.id)
      setShowSaveTemplate(false)
      setNewTemplateName('')
      setToastMessage(`Mallen "${newTemplate.name}" skapad.`)
    } catch (err) {
      console.error('Failed to create template:', err)
      setToastMessage('Kunde inte skapa mallen.')
    }
  }

  async function handleDelete() {
    const sessionId = getSessionId()
    if (!sessionId || !session) return
    
    setDeleteDialogOpen(false)
    setLoading(true)
    
    try {
      await deleteSession(sessionId)
      setToastMessage(`Pass "${session.templateName}" (${session.date}) raderat.`)
      setTimeout(() => {
        navigate('/history')
      }, 500)
    } catch (err) {
      console.error('Failed to delete session:', err)
      setLoading(false)
    }
  }

  function handleRunAgain() {
    if (!session) return
    navigate(`/log?from=${session.id}`)
  }

  function toggleEdit() {
    setEditing(!editing)
    if (!editing) {
      setSaved(false)
      if (session) {
        setFormDate(session.date)
        setFormTemplateId(session.templateId)
        setFormExercises(session.exercises.map(e => ({
          exerciseId: e.exerciseId,
          exerciseName: e.exerciseName,
          setEntries: e.setEntries
        })))
      }
    }
  }

  function cancelEdit() {
    setEditing(false)
    if (session) {
      setFormDate(session.date)
      setFormTemplateId(session.templateId)
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
        <Card class="skeleton skeleton-card"></Card>
      </div>
    )
  }

  // Render error state
  if (error) {
    return (
      <div>
        <h1 class="page-title">Passdetaljer</h1>
        <EmptyState
          title="Fel vid laddning"
          message={error}
          action={<Button onClick={() => window.location.reload()}>Försök igen</Button>}
        />
      </div>
    )
  }

  // Render not found state
  if (notFound || !session) {
    return (
      <div>
        <h1 class="page-title">Passdetaljer</h1>
        <EmptyState
          title="Passet hittades inte"
          action={<Button href="/history">Tillbaka till historik</Button>}
        />
      </div>
    )
  }

  // Render empty state
  if (session.exercises.length === 0) {
    return (
      <div>
        <h1 class="page-title">Passdetaljer</h1>
        <EmptyState
          title="Passet har inga övningar"
          action={<Button href="/history">Tillbaka till historik</Button>}
        />
      </div>
    )
  }

  // Render read mode (default)
  if (!editing) {
    return (
      <div>
        <h1 class="page-title">Passdetaljer</h1>

        <Card>
          <div class="flex justify-between items-center mb">
            <div>
              <h2 class="mb-1">{session.templateName}</h2>
              <p class="m-0 text-muted">{formatDateFull(session.date)}</p>
            </div>
            <div class="flex gap-sm">
              <Button size="sm" onClick={handleRunAgain}>Kör igen</Button>
              <Button variant="secondary" size="sm" onClick={toggleEdit}>Redigera</Button>
              <Button variant="danger" size="sm" onClick={() => setDeleteDialogOpen(true)}>Radera</Button>
            </div>
          </div>
        </Card>

        <Card>
          <h3 class="mb-sm">Övningar</h3>
          <div class="session-detail-exercise-list">
            <div class="session-detail-table table-rows">
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
                      <td class="volume-hero">{calculateExerciseVolume(ex).toLocaleString('sv-SE')} kg</td>
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
            <Button variant="secondary" size="sm" href="/history">Tillbaka till historik</Button>
          </p>
        </Card>

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

      <Card>
        <div class="flex justify-between items-center mb">
          <h2 class="m-0">{session.templateName}</h2>
          <div class="flex gap-sm">
            <Button variant="secondary" size="sm" onClick={cancelEdit}>Avbryt</Button>
            <Button 
              size="sm" 
              onClick={handleSave} 
              disabled={saving || formExercises.length === 0}
            >
              {saving ? 'Sparar...' : 'Spara'}
            </Button>
          </div>
        </div>

        <Field label="Datum" class="mb">
          <input type="date" value={formDate} onChange={handleDateChange} />
        </Field>

        <Field label="Passmall" class="mb">
          <select value={formTemplateId} onChange={handleTemplateChange}>
            {allTemplates.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </Field>

        <div class="flex gap-sm mb">
          <Button variant="secondary" size="sm" onClick={handleUpdateTemplate} disabled={!formTemplateId}>
            Spara övningarna till mallen
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setShowSaveTemplate(v => !v)}>
            Spara som ny mall
          </Button>
        </div>

        {showSaveTemplate && (
          <div class="card mb">
            <form
              class="flex gap-sm items-end"
              onSubmit={e => {
                e.preventDefault()
                handleSaveAsNewTemplate()
              }}
            >
              <Field label="Mallnamn" class="m-0 grow">
                <input
                  type="text"
                  value={newTemplateName}
                  onInput={(e: Event) => setNewTemplateName((e.target as HTMLInputElement).value)}
                  placeholder="t.ex. Bröst, axlar & triceps – lång"
                  autoFocus
                />
              </Field>
              <Button type="submit" disabled={!newTemplateName.trim() || formExercises.length === 0}>
                Skapa mall
              </Button>
            </form>
          </div>
        )}

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
                          <use href={icon('trash-icon')} />
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
                      <use href={icon('trash-icon')} />
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
      </Card>

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
