import { useState, useEffect, useRef, useCallback } from 'preact/hooks'
import {
  getAllTemplates,
  getAllExercises,
  createSession,
  getOrCreateExercise,
  getSession,
  createTemplate,
  getActiveWorkout,
  saveActiveWorkout,
  clearActiveWorkout,
  getLastPerformanceForExercise
} from '../services/dataService'
import { startRestTimer, triggerHaptic } from '../services/timerService'
import { formatDateShort } from '../lib/date'
import { formatSet, formatSets } from '../lib/format'
import { setsVolume } from '../lib/volume'
import { todayISO, nowISO } from '../models'
import { icon } from '../icons'
import { Card } from '../components/Card'
import { Button } from '../components/Button'
import { EmptyState } from '../components/EmptyState'
import { Field } from '../components/Field'
import { PlateCalculatorModal } from '../components/PlateCalculator'
import { RestTimer } from '../components/RestTimer'
import type { Template, Exercise, TemplateExercise, SetEntry, ActiveSetEntry, SetType } from '../models'

export interface LogFormExercise {
  exerciseId: string
  exerciseName: string
  setEntries: ActiveSetEntry[]
  notes?: string
}

export function LogSession() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [allExercises, setAllExercises] = useState<Exercise[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [exercises, setExercises] = useState<LogFormExercise[]>([])
  const [date, setDate] = useState(() => todayISO())
  const [startTime, setStartTime] = useState(() => nowISO())
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showSaveTemplate, setShowSaveTemplate] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [draggedExerciseIndex, setDraggedExerciseIndex] = useState<number | null>(null)
  const [previousPerformances, setPreviousPerformances] = useState<Record<string, { date: string; setEntries: SetEntry[] }>>({})
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [plateCalcModal, setPlateCalcModal] = useState<{ isOpen: boolean; weight: number; exIdx: number; setIdx: number }>({
    isOpen: false,
    weight: 60,
    exIdx: 0,
    setIdx: 0
  })

  const draggedExerciseIndexRef = useRef<number | null>(null)
  const activeTemplateRequestRef = useRef<string>('')
  const isInitialLoadRef = useRef(true)

  // Fetch previous performance for exercises
  const fetchPreviousPerformances = useCallback(async (exerciseIds: string[]) => {
    const missingIds = exerciseIds.filter(id => id && !id.startsWith('new-') && !previousPerformances[id])
    if (missingIds.length === 0) return

    const results = await Promise.all(
      missingIds.map(async id => {
        const perf = await getLastPerformanceForExercise(id)
        return { id, perf }
      })
    )

    setPreviousPerformances(prev => {
      const next = { ...prev }
      for (const res of results) {
        if (res.perf) {
          next[res.id] = res.perf
        }
      }
      return next
    })
  }, [previousPerformances])

  // Load initial data and check for active draft
  async function initSession() {
    try {
      setLoading(true)
      setError(null)
      const urlParams = new URLSearchParams(window.location.search)
      const fromSessionId = urlParams.get('from')
      const templateParam = urlParams.get('template')
      const requestedDate = urlParams.get('date')

      if (requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
        setDate(requestedDate)
      }

      const [ts, es, activeDraft] = await Promise.all([
        getAllTemplates(),
        getAllExercises(),
        getActiveWorkout()
      ])

      setTemplates(ts)
      setAllExercises(es)

      // Priority 1: explicitly requested ?from=<sessionId>
      if (fromSessionId) {
        try {
          const session = await getSession(fromSessionId)
          if (session) {
            setSelectedTemplateId(session.templateId)
            const formExercises: LogFormExercise[] = session.exercises.map(e => ({
              exerciseId: e.exerciseId,
              exerciseName: e.exerciseName,
              setEntries: e.setEntries.map(s => ({ ...s, completed: false, type: 'normal' }))
            }))
            setExercises(formExercises)
            setDate(todayISO())
            setStartTime(nowISO())
            void fetchPreviousPerformances(formExercises.map(e => e.exerciseId))
          }
        } catch (err) {
          console.error('Failed to load session for prefill:', err)
        }
      }
      // Priority 2: explicitly requested ?template=<name>
      else if (templateParam) {
        const matchedTemplate = ts.find(t => t.name.toLowerCase() === templateParam.toLowerCase())
        if (matchedTemplate) {
          setSelectedTemplateId(matchedTemplate.id)
          await loadTemplateIntoExercises(matchedTemplate, es)
        } else if (ts.length > 0) {
          setSelectedTemplateId(ts[0].id)
          await loadTemplateIntoExercises(ts[0], es)
        }
      }
      // Priority 3: active draft in IndexedDB
      else if (activeDraft && activeDraft.exercises.length > 0) {
        setSelectedTemplateId(activeDraft.templateId)
        setDate(activeDraft.date || todayISO())
        setStartTime(activeDraft.startTime || nowISO())
        setExercises(activeDraft.exercises)
        void fetchPreviousPerformances(activeDraft.exercises.map(e => e.exerciseId))
      }
      // Priority 4: Default to first template
      else if (ts.length > 0) {
        setSelectedTemplateId(ts[0].id)
        await loadTemplateIntoExercises(ts[0], es)
      }

      if (fromSessionId || templateParam || requestedDate) {
        window.history.replaceState({}, '', window.location.pathname)
      }
    } catch (err) {
      setError('Kunde inte ladda passdata. Försök igen.')
      console.error('Fel vid initiering:', err)
    } finally {
      setLoading(false)
      isInitialLoadRef.current = false
    }
  }

  async function loadTemplateIntoExercises(template: Template, allExList: Exercise[]) {
    const exMap = new Map(allExList.map(e => [e.id, e.name]))
    // Ladda förra gången först: den vikten är utgångsläget vid stången, inte mallens startvärde
    const lastPerformances = await Promise.all(
      template.exercises.map((te: TemplateExercise) => getLastPerformanceForExercise(te.exerciseId))
    )
    const formExercises: LogFormExercise[] = template.exercises.map((te: TemplateExercise, exIdx: number) => {
      const last = lastPerformances[exIdx]
      return {
        exerciseId: te.exerciseId,
        exerciseName: exMap.get(te.exerciseId) || '',
        setEntries: Array.from({ length: te.defaultSetEntry.sets || 3 }).map((_, setIdx) => {
          // Fler set än förra gången: upprepa sista setet i stället för att falla tillbaka på mallen
          const ref = last?.setEntries[setIdx] ?? last?.setEntries[last.setEntries.length - 1]
          return {
            sets: 1,
            reps: ref?.reps ?? te.defaultSetEntry.reps ?? 10,
            weight: ref?.weight ?? te.defaultSetEntry.weight ?? 0,
            completed: false,
            type: 'normal' as const
          }
        })
      }
    })
    setExercises(formExercises)
    setPreviousPerformances(prev => {
      const next = { ...prev }
      template.exercises.forEach((te: TemplateExercise, idx: number) => {
        const perf = lastPerformances[idx]
        if (perf) next[te.exerciseId] = perf
      })
      return next
    })
  }

  useEffect(() => {
    initSession()
  }, [])

  // Auto-save to activeWorkout whenever exercises or settings change (after initial load)
  useEffect(() => {
    if (isInitialLoadRef.current || loading) return

    if (exercises.length === 0) {
      void clearActiveWorkout()
      return
    }

    const template = templates.find(t => t.id === selectedTemplateId)
    void saveActiveWorkout({
      date,
      templateId: selectedTemplateId,
      templateName: template?.name || 'Fritt pass',
      exercises: exercises.map((e, idx) => ({ ...e, order: idx })),
      startTime
    })
  }, [exercises, date, selectedTemplateId, startTime, loading, templates])

  // Template switch handler with race-condition prevention
  async function handleSelectTemplate(newTemplateId: string) {
    setSelectedTemplateId(newTemplateId)
    activeTemplateRequestRef.current = newTemplateId

    const template = templates.find(t => t.id === newTemplateId)
    if (!template) {
      setExercises([])
      return
    }

    const allEx = allExercises.length > 0 ? allExercises : await getAllExercises()
    if (activeTemplateRequestRef.current !== newTemplateId) return

    await loadTemplateIntoExercises(template, allEx)
  }

  // Toggle set completion and trigger rest timer + haptics
  function toggleSetCompleted(exerciseIdx: number, setIdx: number) {
    const ex = exercises[exerciseIdx]
    const currentSet = ex.setEntries[setIdx]
    const nextCompleted = !currentSet.completed

    const newSetEntries = [...ex.setEntries]
    newSetEntries[setIdx] = {
      ...currentSet,
      completed: nextCompleted
    }

    const newExercises = [...exercises]
    newExercises[exerciseIdx] = { ...ex, setEntries: newSetEntries }
    setExercises(newExercises)

    if (nextCompleted) {
      triggerHaptic(50)
      startRestTimer()
    }
  }

  // Cycle set type: normal -> warmup -> drop -> failure -> normal
  function cycleSetType(exerciseIdx: number, setIdx: number) {
    const ex = exercises[exerciseIdx]
    const currentSet = ex.setEntries[setIdx]
    const typeOrder: SetType[] = ['normal', 'warmup', 'drop', 'failure']
    const nextIndex = (typeOrder.indexOf(currentSet.type || 'normal') + 1) % typeOrder.length
    const nextType = typeOrder[nextIndex]

    const newSetEntries = [...ex.setEntries]
    newSetEntries[setIdx] = { ...currentSet, type: nextType }

    const newExercises = [...exercises]
    newExercises[exerciseIdx] = { ...ex, setEntries: newSetEntries }
    setExercises(newExercises)
    triggerHaptic(20)
  }

  function adjustSetValues(exerciseIdx: number, setIdx: number, deltaWeight: number, deltaReps: number) {
    const ex = exercises[exerciseIdx]
    const set = ex.setEntries[setIdx]
    const newWeight = Math.max(0, Math.round((set.weight + deltaWeight) * 10) / 10)
    const newReps = Math.max(1, set.reps + deltaReps)

    const newSetEntries = [...ex.setEntries]
    newSetEntries[setIdx] = { ...set, weight: newWeight, reps: newReps }

    const newExercises = [...exercises]
    newExercises[exerciseIdx] = { ...ex, setEntries: newSetEntries }
    setExercises(newExercises)
    triggerHaptic(20)
  }

  function updateExerciseName(idx: number, name: string) {
    const matchedEx = allExercises.find(e => e.name.toLowerCase() === name.trim().toLowerCase())
    const exerciseId = matchedEx ? matchedEx.id : `new-${Date.now()}`

    const newExercises = [...exercises]
    newExercises[idx] = {
      ...newExercises[idx],
      exerciseId,
      exerciseName: name
    }
    setExercises(newExercises)

    if (matchedEx) {
      void fetchPreviousPerformances([matchedEx.id])
    }
  }

  function addExercise() {
    setExercises(prev => [
      ...prev,
      {
        exerciseId: `new-${Date.now()}`,
        exerciseName: '',
        setEntries: [
          { sets: 1, reps: 10, weight: 0, completed: false, type: 'normal' },
          { sets: 1, reps: 10, weight: 0, completed: false, type: 'normal' },
          { sets: 1, reps: 10, weight: 0, completed: false, type: 'normal' }
        ]
      }
    ])
  }

  function removeExercise(idx: number) {
    setExercises(prev => prev.filter((_, i) => i !== idx))
  }

  function addSet(exerciseIdx: number) {
    const ex = exercises[exerciseIdx]
    const lastSet = ex.setEntries[ex.setEntries.length - 1]
    const newSet: ActiveSetEntry = {
      sets: 1,
      reps: lastSet?.reps || 10,
      weight: lastSet?.weight || 0,
      completed: false,
      type: 'normal'
    }

    const newExercises = [...exercises]
    newExercises[exerciseIdx] = {
      ...ex,
      setEntries: [...ex.setEntries, newSet]
    }
    setExercises(newExercises)
  }

  function removeSet(exerciseIdx: number, setIdx: number) {
    const ex = exercises[exerciseIdx]
    if (ex.setEntries.length <= 1) return

    const newExercises = [...exercises]
    newExercises[exerciseIdx] = {
      ...ex,
      setEntries: ex.setEntries.filter((_, i) => i !== setIdx)
    }
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

  async function handleFinishSession() {
    if (exercises.length === 0) return
    setSaving(true)
    try {
      const template = templates.find(t => t.id === selectedTemplateId)
      const templateTitle = template?.name || 'Fritt pass'

      const validExercises = await Promise.all(
        exercises.map(async (e, order) => {
          let exerciseId = e.exerciseId
          if (!exerciseId || exerciseId.startsWith('new-')) {
            const ex = await getOrCreateExercise(e.exerciseName)
            exerciseId = ex.id
          }

          // Konvertera ActiveSetEntry[] till SetEntry[] för historiklagring
          const setEntries: SetEntry[] = e.setEntries.map(s => ({
            sets: s.sets || 1,
            reps: s.reps || 10,
            weight: s.weight || 0
          }))

          return {
            exerciseId,
            exerciseName: e.exerciseName,
            setEntries,
            order
          }
        })
      )

      await createSession(date, selectedTemplateId || 'custom', templateTitle, validExercises)
      setSaved(true)
      setExercises([])
      await clearActiveWorkout()
      triggerHaptic([60, 40, 100])
      setTimeout(() => {
        setSaved(false)
        window.location.href = `${import.meta.env.BASE_URL}history`
      }, 1200)
    } catch (err) {
      console.error('Kunde inte spara pass:', err)
      setError('Kunde inte spara pass')
    } finally {
      setSaving(false)
    }
  }

  async function handleCancelSession() {
    await clearActiveWorkout()
    setCancelDialogOpen(false)
    setExercises([])
    window.location.href = `${import.meta.env.BASE_URL}`
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
            defaultSetEntry: {
              sets: e.setEntries.length,
              reps: e.setEntries[0]?.reps || 10,
              weight: e.setEntries[0]?.weight || 0
            }
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

  function openPlateCalculator(weight: number, exIdx: number, setIdx: number) {
    setPlateCalcModal({
      isOpen: true,
      weight,
      exIdx,
      setIdx
    })
  }

  function applyPlateCalculatorWeight(newWeight: number) {
    const { exIdx, setIdx } = plateCalcModal
    if (exercises[exIdx] && exercises[exIdx].setEntries[setIdx]) {
      const ex = exercises[exIdx]
      const newSetEntries = [...ex.setEntries]
      newSetEntries[setIdx] = { ...newSetEntries[setIdx], weight: newWeight }
      const newExercises = [...exercises]
      newExercises[exIdx] = { ...ex, setEntries: newSetEntries }
      setExercises(newExercises)
    }
  }

  // Volym räknas på avbockade set: siffran ska visa vad du lyft, inte vad du planerat
  const totalVolume = exercises.reduce(
    (sum, e) => sum + setsVolume(e.setEntries.filter(s => s.completed)),
    0
  )

  const completedSetsCount = exercises.reduce((sum, e) => {
    return sum + e.setEntries.filter(s => s.completed).length
  }, 0)

  const totalSetsCount = exercises.reduce((sum, e) => sum + e.setEntries.length, 0)

  if (loading) {
    return (
      <div class="log-session-container">
        <h1 class="page-title">Logga pass</h1>
        <Card class="skeleton skeleton-card mb"></Card>
        <Card class="skeleton skeleton-card mb"></Card>
      </div>
    )
  }

  if (error) {
    return (
      <EmptyState
        title="Något gick fel"
        message={error}
        action={<Button onClick={initSession}>Försök igen</Button>}
      />
    )
  }

  return (
    <div class="log-session-layout">
      {/* Global Datalist för övningsförslag (renderas en gång för giltig HTML) */}
      <datalist id="exercise-suggestions">
        {allExercises.map(e => (
          <option key={e.id} value={e.name} />
        ))}
      </datalist>

      {/* Sidopanel med vilotimer på desktop */}
      <aside class="log-session-timer">
        <RestTimer />
      </aside>

      <div class="log-session-main">
        <div class="flex justify-between items-center mb">
          <div>
            <h1 class="page-title m-0">Aktivt träningspass</h1>
            <span class="text-xs text-muted">
              {completedSetsCount} av {totalSetsCount} set klara • Lyft volym: {totalVolume.toLocaleString('sv-SE')} kg
            </span>
          </div>
          <div class="flex gap-sm">
            <Button variant="secondary" size="sm" onClick={() => setCancelDialogOpen(true)}>
              Avbryt
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleFinishSession}
              disabled={saving || exercises.length === 0}
            >
              {saving ? 'Sparar...' : 'Slutför pass'}
            </Button>
          </div>
        </div>

        {/* Passinställningar & mallval */}
        <Card class="mb">
          <div class="grid grid-2 gap-3">
            <Field label="Datum" class="m-0">
              <input type="date" value={date} onChange={(e: Event) => setDate((e.target as HTMLInputElement).value)} />
            </Field>
            <Field label="Passtyp / Mall" class="m-0">
              <select value={selectedTemplateId} onChange={(e: Event) => handleSelectTemplate((e.target as HTMLSelectElement).value)}>
                <option value="">Fritt pass (egen uppsättning)</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </Field>
          </div>
        </Card>

        {/* Övningslista */}
        <div class="exercise-section mb">
          <div class="flex justify-between items-center mb-sm">
            <h2 class="m-0 text-lg">Övningar</h2>
            <Button variant="secondary" size="sm" onClick={() => setShowSaveTemplate(v => !v)}>
              {showSaveTemplate ? 'Dölj mallsparning' : 'Spara som ny mall'}
            </Button>
          </div>

          {showSaveTemplate && (
            <Card class="mb">
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
                    placeholder="T.ex. Bröst & Axlar tung"
                    autoFocus
                  />
                </Field>
                <Button type="submit" disabled={!templateName.trim() || exercises.length === 0}>
                  Spara mall
                </Button>
              </form>
            </Card>
          )}

          {exercises.length === 0 ? (
            <Card>
              <EmptyState
                title="Inga övningar tillagda"
                message="Välj en mall ovan eller lägg till din första övning."
                action={<Button onClick={addExercise}>+ Lägg till övning</Button>}
              />
            </Card>
          ) : (
            <div class="exercise-cards-list">
              {exercises.map((ex, exIdx) => {
                const prev = previousPerformances[ex.exerciseId]
                return (
                  <Card
                    key={ex.exerciseId || exIdx}
                    class={`exercise-live-card mb ${draggedExerciseIndex === exIdx ? 'exercise-row-dragging' : ''}`}
                    data-exercise-index={exIdx}
                  >
                    <div class="exercise-live-header flex justify-between items-center mb-sm">
                      <div class="flex items-center gap-2 grow">
                        <button
                          type="button"
                          class="drag-handle"
                          aria-label="Flytta övning"
                          onPointerDown={e => startExerciseDrag(e, exIdx)}
                          onPointerMove={continueExerciseDrag}
                          onPointerUp={endExerciseDrag}
                          onPointerCancel={endExerciseDrag}
                        >
                          <span aria-hidden="true">⋮⋮</span>
                        </button>
                        <input
                          type="text"
                          value={ex.exerciseName}
                          onChange={(e: Event) => updateExerciseName(exIdx, (e.target as HTMLInputElement).value)}
                          placeholder="Övningsnamn..."
                          list="exercise-suggestions"
                          class="exercise-title-input"
                        />
                      </div>
                      <button
                        type="button"
                        class="btn-remove"
                        onClick={() => removeExercise(exIdx)}
                        aria-label="Ta bort övning"
                      >
                        <svg width="20" height="20" viewBox="0 0 19 19">
                          <use href={icon('trash-icon')} />
                        </svg>
                      </button>
                    </div>

                    {prev && prev.setEntries.length > 0 && (
                      <div class="exercise-prev-banner mb-sm">
                        <span class="text-xs text-muted">
                          Förra gången ({formatDateShort(prev.date)}):{' '}
                          <strong>
                            {formatSets(prev.setEntries)}
                          </strong>
                        </span>
                      </div>
                    )}

                    <div class="set-rows-table-wrap">
                      <table class="set-rows-table">
                        <thead>
                          <tr>
                            <th class="col-type">Typ</th>
                            <th class="col-prev">Föregående</th>
                            <th class="col-kg">Kg</th>
                            <th class="col-reps">Reps</th>
                            <th class="col-plate"></th>
                            <th class="col-check">Klar</th>
                            <th class="col-del"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {ex.setEntries.map((set, setIdx) => {
                            const prevSet = prev?.setEntries[setIdx]
                            const prevText = prevSet ? formatSet(prevSet) : '—'
                            const isCompleted = Boolean(set.completed)
                            const setType = set.type || 'normal'

                            const badgeLabel =
                              setType === 'warmup' ? 'W' :
                              setType === 'drop' ? 'D' :
                              setType === 'failure' ? 'F' :
                              `${setIdx + 1}`

                            return (
                              <tr
                                key={setIdx}
                                class={`set-row ${isCompleted ? 'set-row-completed' : ''} set-type-${setType}`}
                              >
                                <td class="col-type">
                                  <button
                                    type="button"
                                    class={`set-type-badge badge-${setType}`}
                                    onClick={() => cycleSetType(exIdx, setIdx)}
                                    title="Klicka för att byta settyp (Normal, Warmup, Drop, Failure)"
                                  >
                                    {badgeLabel}
                                  </button>
                                </td>
                                <td class="col-prev text-xs text-muted tabular-nums">
                                  {prevText}
                                </td>
                                <td class="col-kg">
                                  <div class="input-with-steppers">
                                    <input
                                      type="number"
                                      step="0.5"
                                      min="0"
                                      max="500"
                                      value={set.weight}
                                      onChange={(e: Event) => {
                                        const val = parseFloat((e.target as HTMLInputElement).value) || 0
                                        const newSetEntries = [...ex.setEntries]
                                        newSetEntries[setIdx] = { ...set, weight: val }
                                        const newExs = [...exercises]
                                        newExs[exIdx] = { ...ex, setEntries: newSetEntries }
                                        setExercises(newExs)
                                      }}
                                      class="set-input"
                                    />
                                    <div class="stepper-buttons">
                                      <button type="button" onClick={() => adjustSetValues(exIdx, setIdx, 2.5, 0)}>+2,5</button>
                                      <button type="button" onClick={() => adjustSetValues(exIdx, setIdx, -2.5, 0)}>-2,5</button>
                                    </div>
                                  </div>
                                </td>
                                <td class="col-reps">
                                  <div class="input-with-steppers">
                                    <input
                                      type="number"
                                      min="1"
                                      max="100"
                                      value={set.reps}
                                      onChange={(e: Event) => {
                                        const val = parseInt((e.target as HTMLInputElement).value, 10) || 1
                                        const newSetEntries = [...ex.setEntries]
                                        newSetEntries[setIdx] = { ...set, reps: val }
                                        const newExs = [...exercises]
                                        newExs[exIdx] = { ...ex, setEntries: newSetEntries }
                                        setExercises(newExs)
                                      }}
                                      class="set-input"
                                    />
                                    <div class="stepper-buttons">
                                      <button type="button" onClick={() => adjustSetValues(exIdx, setIdx, 0, 1)}>+1</button>
                                      <button type="button" onClick={() => adjustSetValues(exIdx, setIdx, 0, -1)}>-1</button>
                                    </div>
                                  </div>
                                </td>
                                <td class="col-plate">
                                  <button
                                    type="button"
                                    class="btn-calc"
                                    onClick={() => openPlateCalculator(set.weight, exIdx, setIdx)}
                                    title="Öppna plattkalkylator"
                                    aria-label="Plattkalkylator"
                                  >
                                    🎛️
                                  </button>
                                </td>
                                <td class="col-check">
                                  <button
                                    type="button"
                                    class={`btn-check-set ${isCompleted ? 'checked' : ''}`}
                                    onClick={() => toggleSetCompleted(exIdx, setIdx)}
                                    aria-label={isCompleted ? 'Markera som ej klar' : 'Markera som klar'}
                                  >
                                    {isCompleted ? '✓' : ''}
                                  </button>
                                </td>
                                <td class="col-del">
                                  {ex.setEntries.length > 1 && (
                                    <button
                                      type="button"
                                      class="btn-remove-sm"
                                      onClick={() => removeSet(exIdx, setIdx)}
                                      aria-label="Ta bort set"
                                    >
                                      ×
                                    </button>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div class="flex justify-between items-center mt-sm">
                      <Button variant="secondary" size="sm" onClick={() => addSet(exIdx)}>
                        + Lägg till set
                      </Button>
                    </div>
                  </Card>
                )
              })}

              <Button variant="secondary" class="btn-block mt" onClick={addExercise}>
                + Lägg till övning
              </Button>
            </div>
          )}
        </div>

        {/* Avsluta eller spara knappar */}
        <div class="flex gap mt mb-lg">
          <Button
            variant="primary"
            size="lg"
            class="grow"
            onClick={handleFinishSession}
            disabled={saving || exercises.length === 0}
          >
            {saving ? 'Sparar pass...' : 'Slutför och spara pass'}
          </Button>
        </div>

        {saved && <div class="toast">Passet har sparats framgångsrikt!</div>}

        {/* Avbryt pass dialog */}
        {cancelDialogOpen && (
          <div class="dialog-overlay" onClick={() => setCancelDialogOpen(false)}>
            <div class="dialog" onClick={e => e.stopPropagation()}>
              <h3 class="m-0 mb-sm">Avbryt träningspass?</h3>
              <p>Om du avbryter rensas ditt påbörjade pass och ändringarna försvinner.</p>
              <div class="flex gap mt justify-end">
                <Button variant="secondary" onClick={() => setCancelDialogOpen(false)}>Fortsätt träna</Button>
                <Button variant="danger" onClick={handleCancelSession}>Avbryt pass</Button>
              </div>
            </div>
          </div>
        )}

        {/* Plattkalkylator modal */}
        <PlateCalculatorModal
          isOpen={plateCalcModal.isOpen}
          initialWeight={plateCalcModal.weight}
          onClose={() => setPlateCalcModal(prev => ({ ...prev, isOpen: false }))}
          onApplyWeight={applyPlateCalculatorWeight}
        />
      </div>
    </div>
  )
}
