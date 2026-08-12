import { useState } from 'react'
import type { DayWithExercises, Exercise, ExerciseTestPlan } from '../lib/api'
import { createProgram } from '../lib/api'
import { resolveExerciseE1RM, computeWeeklyTargets, type TargetWeek } from '../lib/calc'
import type { ExerciseTestMode } from '../lib/database.types'

interface TestFormState {
  mode: ExerciseTestMode
  weight: string
  reps: string
  rpe: string
  manualE1rm: string
}

function initialFormState(): TestFormState {
  return { mode: 'raw_epley', weight: '', reps: '', rpe: '', manualE1rm: '' }
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

interface PreviewRow {
  day: string
  exercise: string
  reps: number
  numSets: number
  intensityNote: string | null
  targets: Record<TargetWeek, number> | null
}

export function NewProgramFlow({
  testableExercises,
  template,
  onCreated,
}: {
  testableExercises: Exercise[]
  template: DayWithExercises[]
  onCreated: () => void
}) {
  const [startDate, setStartDate] = useState(todayIsoDate())
  const [forms, setForms] = useState<Record<string, TestFormState>>(() =>
    Object.fromEntries(testableExercises.map((e) => [e.id, initialFormState()])),
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function updateForm(exerciseId: string, patch: Partial<TestFormState>) {
    setForms((prev) => ({ ...prev, [exerciseId]: { ...prev[exerciseId], ...patch } }))
  }

  function buildPlan(exercise: Exercise): ExerciseTestPlan | null {
    const form = forms[exercise.id]
    switch (form.mode) {
      case 'raw_epley':
      case 'rpe_based':
        if (form.weight === '' || form.reps === '') return null
        return {
          exerciseId: exercise.id,
          input: {
            mode: form.mode,
            weight: Number(form.weight),
            reps: Number(form.reps),
            rpe: form.mode === 'rpe_based' ? Number(form.rpe) : undefined,
          },
        }
      case 'manual_e1rm':
        if (form.manualE1rm === '') return null
        return { exerciseId: exercise.id, input: { mode: form.mode, manualE1rm: Number(form.manualE1rm) } }
    }
  }

  function computePreview(exerciseId: string, e1rm: number): PreviewRow[] {
    const rows: PreviewRow[] = []
    for (const day of template) {
      for (const de of day.day_exercises) {
        const sourceId = de.exercise.requires_test ? de.exercise.id : de.exercise.e1rm_source_exercise_id
        if (sourceId !== exerciseId) continue
        for (const sg of de.set_groups) {
          const isProgrammed = !sg.is_freeform && sg.week1_percentage != null && sg.increments != null
          rows.push({
            day: day.name,
            exercise: de.exercise.name,
            reps: sg.reps,
            numSets: sg.num_sets,
            intensityNote: sg.intensity_note,
            targets: isProgrammed ? computeWeeklyTargets(e1rm * sg.week1_percentage!, sg.increments!) : null,
          })
        }
      }
    }
    return rows
  }

  const plans = testableExercises.map((exercise) => ({ exercise, plan: buildPlan(exercise) }))
  const allValid = plans.every((p) => p.plan !== null)

  async function handleSubmit() {
    if (!allValid) return
    setSubmitting(true)
    setError(null)
    try {
      await createProgram(
        startDate,
        plans.map((p) => p.plan!),
      )
      onCreated()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6 p-4 pb-24">
      <h1 className="text-xl font-semibold">New 6-week block</h1>

      <label className="block space-y-1">
        <span className="text-sm text-text-muted">Start date</span>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="w-full rounded-lg bg-surface px-3 py-2 text-text"
        />
      </label>

      {testableExercises.map((exercise) => {
        const form = forms[exercise.id]
        const plan = buildPlan(exercise)
        let e1rm: number | null = null
        let previewRows: PreviewRow[] = []
        if (plan) {
          try {
            e1rm = resolveExerciseE1RM(plan.input)
            previewRows = computePreview(exercise.id, e1rm)
          } catch {
            e1rm = null
          }
        }

        return (
          <div key={exercise.id} className="space-y-3 rounded-xl bg-surface p-4">
            <h2 className="font-medium">{exercise.name} test</h2>

            <label className="block space-y-1">
              <span className="text-sm text-text-muted">Test mode</span>
              <select
                value={form.mode}
                onChange={(e) => updateForm(exercise.id, { mode: e.target.value as ExerciseTestMode })}
                className="w-full rounded-lg bg-surface-2 px-3 py-2"
              >
                <option value="raw_epley">Raw rep test (Epley)</option>
                <option value="rpe_based">RPE-based estimate</option>
                <option value="manual_e1rm">Manual E1RM</option>
              </select>
            </label>

            {(form.mode === 'raw_epley' || form.mode === 'rpe_based') && (
              <div className="flex gap-2">
                <label className="flex-1 space-y-1">
                  <span className="text-sm text-text-muted">Weight</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={form.weight}
                    onChange={(e) => updateForm(exercise.id, { weight: e.target.value })}
                    className="w-full rounded-lg bg-surface-2 px-3 py-2"
                  />
                </label>
                <label className="flex-1 space-y-1">
                  <span className="text-sm text-text-muted">Reps</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={form.reps}
                    onChange={(e) => updateForm(exercise.id, { reps: e.target.value })}
                    className="w-full rounded-lg bg-surface-2 px-3 py-2"
                  />
                </label>
                {form.mode === 'rpe_based' && (
                  <label className="flex-1 space-y-1">
                    <span className="text-sm text-text-muted">RPE</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={form.rpe}
                      onChange={(e) => updateForm(exercise.id, { rpe: e.target.value })}
                      className="w-full rounded-lg bg-surface-2 px-3 py-2"
                    />
                  </label>
                )}
              </div>
            )}

            {form.mode === 'manual_e1rm' && (
              <label className="block space-y-1">
                <span className="text-sm text-text-muted">E1RM</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={form.manualE1rm}
                  onChange={(e) => updateForm(exercise.id, { manualE1rm: e.target.value })}
                  className="w-full rounded-lg bg-surface-2 px-3 py-2"
                />
              </label>
            )}

            {e1rm != null && (
              <div className="space-y-2 rounded-lg bg-surface-2/60 p-3 text-sm text-text-muted">
                <div>E1RM: {e1rm.toFixed(1)} lb</div>
                {previewRows.map((row, i) => (
                  <div key={i} className="border-t border-border pt-2 first:border-0 first:pt-0">
                    <div className="text-text-muted">
                      {row.day} · {row.exercise} — {row.numSets}x{row.reps}
                      {row.intensityNote ? ` (${row.intensityNote})` : ''}
                    </div>
                    {row.targets && (
                      <div className="mt-1 flex flex-wrap gap-3">
                        {Object.entries(row.targets).map(([week, weight]) => (
                          <span key={week}>
                            W{week}: <span className="text-text">{weight}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {error && <p className="text-sm text-danger">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={!allValid || submitting}
        className="w-full rounded-xl bg-accent py-3 font-medium text-accent-text disabled:opacity-40"
      >
        {submitting ? 'Creating…' : 'Generate block'}
      </button>
    </div>
  )
}
