import { useState, useEffect } from 'preact/hooks'
import { getAllTemplates, getAllExercises, createTemplate, updateTemplate, deleteTemplate, updateTemplateExerciseLastUsed } from '../services/dataService'
import type { Template, TemplateExercise, Exercise } from '../models'

interface FormExercise {
  exerciseId: string
  exerciseName: string
  defaultSets: number
  defaultReps: number
  defaultWeight: number
}

export function Templates() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formName, setFormName] = useState('')
  const [formExercises, setFormExercises] = useState<FormExercise[]>([])
  const [showForm, setShowForm] = useState(false)
  const [allExercises, setAllExercises] = useState<Exercise[]>([])

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const [ts, es] = await Promise.all([getAllTemplates(), getAllExercises()])
    setTemplates(ts)
    setAllExercises(es)
  }

  function startEdit(template: Template) {
    setEditingId(template.id)
    setFormName(template.name)
    const exercises = await Promise.all(
      template.exercises.map(async te => {
        const ex = allExercises.find(e => e.id === te.exerciseId)
        return {
          exerciseId: te.exerciseId,
          exerciseName: ex?.name || '',
          defaultSets: te.defaultSets,
          defaultReps: te.defaultReps,
          defaultWeight: te.defaultWeight
        }
      })
    )
    setFormExercises(exercises)
    setShowForm(true)
  }

  function startCreate() {
    setEditingId(null)
    setFormName('')
    setFormExercises([{ exerciseId: '', exerciseName: '', defaultSets: 3, defaultReps: 10, defaultWeight: 0 }])
    setShowForm(true)
  }

  function cancelEdit() {
    setEditingId(null)
    setShowForm(false)
  }

  async function handleSave() {
    if (!formName.trim() || formExercises.length === 0) return

    // Ensure exercises exist in catalog
    const validExercises = await Promise.all(
      formExercises.map(async fe => {
        let exerciseId = fe.exerciseId
        if (!exerciseId || exerciseId.startsWith('new-')) {
          const ex = await getOrCreateExercise(fe.exerciseName)
          exerciseId = ex.id
        }
        return {
          exerciseId,
          defaultSets: fe.defaultSets,
          defaultReps: fe.defaultReps,
          defaultWeight: fe.defaultWeight
        }
      })
    )

    if (editingId) {
      await updateTemplate(editingId, { name: formName, exercises: validExercises })
    } else {
      await createTemplate(formName, validExercises)
    }
    await loadData()
    cancelEdit()
  }

  async function handleDelete(id: string) {
    if (!confirm('Radera mall? Det går inte att ångra.')) return
    await deleteTemplate(id)
    await loadData()
  }

  function updateFormExercise(idx: number, field: keyof FormExercise, value: any) {
    const newExercises = [...formExercises]
    newExercises[idx] = { ...newExercises[idx], [field]: value }
    setFormExercises(newExercises)
  }

  function addFormExercise() {
    setFormExercises([...formExercises, { exerciseId: `new-${Date.now()}`, exerciseName: '', defaultSets: 3, defaultReps: 10, defaultWeight: 0 }])
  }

  function removeFormExercise(idx: number) {
    setFormExercises(formExercises.filter((_, i) => i !== idx))
  }

  return (
    <div>
      <div class="flex justify-between items-center mb">
        <h1 class="page-title" style="margin: 0;">Mallar</h1>
        <button class="btn btn-primary" onClick={startCreate}>+ Ny mall</button>
      </div>

      {showForm && (
        <div class="card mb">
          <h3 class="mb">{editingId ? 'Redigera mall' : 'Ny mall'}</h3>

          <div class="input-group mb">
            <label>Mallnamn</label>
            <input type="text" value={formName} onChange={e => setFormName(e.target.value)} placeholder="T.ex. Bröst, axlar & biceps" />
          </div>

          <h4 class="mb-sm">Övningar</h4>
          {formExercises.map((fe, idx) => (
            <div key={idx} class="grid grid-4 mb" style="align-items: end; gap: 12px;">
              <div class="input-group" style="margin: 0; flex: 2;">
                <label>Övning</label>
                <input
                  type="text"
                  value={fe.exerciseName}
                  onChange={e => updateFormExercise(idx, 'exerciseName', e.target.value)}
                  placeholder="Skriv övningsnamn..."
                  list="template-exercise-suggestions"
                />
                <datalist id="template-exercise-suggestions">
                  {allExercises.map(e => <option key={e.id} value={e.name} />)}
                </datalist>
              </div>
              <div class="input-group" style="margin: 0;">
                <label>Set</label>
                <input type="number" min="1" max="20" value={fe.defaultSets} onChange={e => updateFormExercise(idx, 'defaultSets', parseInt(e.target.value) || 0)} />
              </div>
              <div class="input-group" style="margin: 0;">
                <label>Reps</label>
                <input type="number" min="1" max="50" value={fe.defaultReps} onChange={e => updateFormExercise(idx, 'defaultReps', parseInt(e.target.value) || 0)} />
              </div>
              <div class="input-group" style="margin: 0;">
                <label>Vikt (kg)</label>
                <input type="number" min="0" step="0.5" max="500" value={fe.defaultWeight} onChange={e => updateFormExercise(idx, 'defaultWeight', parseFloat(e.target.value) || 0)} />
              </div>
              <div style="margin: 0;">
                <button class="btn btn-danger btn-sm" onClick={() => removeFormExercise(idx)} style="height: 100%;">Ta bort</button>
              </div>
            </div>
          ))}

          <button class="btn btn-secondary mb" onClick={addFormExercise}>+ Lägg till övning</button>

          <div class="flex gap">
            <button class="btn btn-primary" onClick={handleSave}>Spara</button>
            <button class="btn btn-secondary" onClick={cancelEdit}>Avbryt</button>
          </div>
        </div>
      )}

      <div class="card">
        {templates.length === 0 ? (
          <div class="empty-state">
            <h3>Inga mallar än</h3>
            <p>Skapa din första mall för att komma igång.</p>
          </div>
        ) : (
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Namn</th>
                  <th>Övningar</th>
                  <th>Uppdaterad</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {templates.map(t => (
                  <tr key={t.id}>
                    <td><strong>{t.name}</strong></td>
                    <td>{t.exercises.length}</td>
                    <td>{new Date(t.updatedAt).toLocaleDateString('sv-SE')}</td>
                    <td>
                      <div class="flex gap-sm">
                        <button class="btn btn-secondary btn-sm" onClick={() => startEdit(t)}>Redigera</button>
                        <button class="btn btn-danger btn-sm" onClick={() => handleDelete(t.id)}>Radera</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// Helper - need to import from dataService
async function getOrCreateExercise(name: string) {
  const { getOrCreateExercise: fn } = await import('../services/dataService')
  return fn(name)
}