import { useState, useEffect } from 'preact/hooks'
import { getAllTemplates, getAllExercises, createSession, getOrCreateExercise } from '../services/dataService'
import type { Template, TemplateExercise, Exercise } from '../models'

interface FormExercise {
  exerciseId: string
  exerciseName: string
  sets: number
  reps: number
  weight: number
}

export function LogSession() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [exercises, setExercises] = useState<FormExercise[]>([])
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    loadTemplates()
  }, [])

  async function loadTemplates() {
    const ts = await getAllTemplates()
    setTemplates(ts)
    if (ts.length > 0 && !selectedTemplateId) {
      setSelectedTemplateId(ts[0].id)
    }
  }

  useEffect(() => {
    if (selectedTemplateId) {
      const template = templates.find(t => t.id === selectedTemplateId)
      if (template) {
        const formExercises: FormExercise[] = template.exercises.map(te => ({
          exerciseId: te.exerciseId,
          exerciseName: '', // Will be filled below
          sets: te.defaultSets,
          reps: te.defaultReps,
          weight: te.defaultWeight
        }))
        // Fetch exercise names
        const allExercises = await getAllExercises()
        const exMap = new Map(allExercises.map(e => [e.id, e.name]))
        formExercises.forEach(fe => { fe.exerciseName = exMap.get(fe.exerciseId) || '' })
        setExercises(formExercises)
      }
    } else {
      setExercises([])
    }
  }, [selectedTemplateId, templates])

  async function handleSave() {
    if (exercises.length === 0) return
    setSaving(true)
    try {
      const template = templates.find(t => t.id === selectedTemplateId)
      if (!template) throw new Error('Template not found')

      // Ensure all exercises exist in catalog
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

  async function handleExerciseSearch(idx: number, query: string) {
    if (query.length < 2) return
    const allExercises = await getAllExercises()
    const matches = allExercises
      .filter(e => e.name.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 5)
    // Could show dropdown, for now just log
    console.log('Matches:', matches)
  }

  return (
    <div>
      <h1 class="page-title">Logga pass</h1>

      <div class="card mb">
        <div class="grid grid-2 mb">
          <div class="input-group">
            <label>Datum</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div class="input-group">
            <label>Mall</label>
            <select value={selectedTemplateId} onChange={e => setSelectedTemplateId(e.target.value)}>
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
            {exercises.map((ex, idx) => (
              <div key={idx} class="grid grid-4 mb" style="align-items: end; gap: 12px;">
                <div class="input-group" style="margin: 0; flex: 2;">
                  <label>Övning</label>
                  <input
                    type="text"
                    value={ex.exerciseName}
                    onChange={e => updateExercise(idx, 'exerciseName', e.target.value)}
                    placeholder="Skriv övningsnamn..."
                    list="exercise-suggestions"
                  />
                  <datalist id="exercise-suggestions">
                    {templates.flatMap(t => t.exercises).map(te => (
                      <option key={te.exerciseId} value={''} />
                    ))}
                  </datalist>
                </div>
                <div class="input-group" style="margin: 0;">
                  <label>Set</label>
                  <input type="number" min="1" max="20" value={ex.sets} onChange={e => updateExercise(idx, 'sets', parseInt(e.target.value) || 0)} />
                </div>
                <div class="input-group" style="margin: 0;">
                  <label>Reps</label>
                  <input type="number" min="1" max="50" value={ex.reps} onChange={e => updateExercise(idx, 'reps', parseInt(e.target.value) || 0)} />
                </div>
                <div class="input-group" style="margin: 0;">
                  <label>Vikt (kg)</label>
                  <input type="number" min="0" step="0.5" max="500" value={ex.weight} onChange={e => updateExercise(idx, 'weight', parseFloat(e.target.value) || 0)} />
                </div>
                <div style="margin: 0;">
                  <button class="btn btn-danger btn-sm" onClick={() => removeExercise(idx)} style="height: 100%;">Ta bort</button>
                </div>
              </div>
            ))}

            <button class="btn btn-secondary" onClick={addExercise}>+ Lägg till övning</button>
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