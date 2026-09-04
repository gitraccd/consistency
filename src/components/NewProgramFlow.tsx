import { useState, type FormEvent } from 'react'
import type { DayWithExercises, Exercise, ExerciseTestPlan, Program } from '../lib/api'
import { createProgram, errorMessage } from '../lib/api'
import { resolveExerciseE1RM, computeWeeklyTargets, type TargetWeek } from '../lib/calc'
import type { ExerciseTestMode } from '../lib/database.types'
import { isoDateDaysAgo, todayIsoDate } from '../lib/schedule'

/** Below this many days since the latest block started, warn before creating another -- catches accidental duplicate blocks. */
const RECENT_BLOCK_WARNING_DAYS = 3

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
  latestProgram,
  onCreated,
  onCancel,
}: {
  testableExercises: Exercise[]
  template: DayWithExercises[]
  latestProgram: Program | null
  onCreated: () => void
  onCancel: () => void
}) {
  const [startDate, setStartDate] = useState(todayIsoDate())
  const [confirmedDuplicate, setConfirmedDuplicate] = useState(false)

  const recentBlockWarning =
    latestProgram && latestProgram.start_date >= isoDateDaysAgo(RECENT_BLOCK_WARNING_DAYS)
      ? `You already have a block started ${latestProgram.start_date} — creating another this soon is usually a mistake. Delete it from History first if this is a redo, or confirm below to create it anyway.`
      : null
  const [forms, setForms] = useState<Record<string, TestFormState>>(() =>
    Object.fromEntries(testableExercises.map((e) => [e.id, initialFormState()])),
  )
  const [included, setIncluded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(testableExercises.map((e) => [e.id, true])),
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
  const includedPlans = plans.filter((p) => included[p.exercise.id])
  const allValid =
    includedPlans.length > 0 &&
    includedPlans.every((p) => p.plan !== null) &&
    (recentBlockWarning == null || confirmedDuplicate)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!allValid) return
    setSubmitting(true)
    setError(null)
    try {
      await createProgram(
        startDate,
        includedPlans.map((p) => p.plan!),
      )
      onCreated()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page-enter mx-auto max-w-md space-y-6 p-4 pb-24">
      <div className="flex items-start justify-between">
        <h1 className="text-xl font-semibold">New 6-week block</h1>
        <button
          onClick={onCancel}
          aria-label="Cancel"
          className="-m-2.5 flex h-11 w-11 shrink-0 items-center justify-center text-text-muted"
        >
          ✕
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <label className="block space-y-1">
          <span className="text-sm text-text-muted">Start date</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded-lg bg-surface px-3 py-2 text-text"
          />
        </label>

        {recentBlockWarning && (
          <div className="space-y-2 rounded-xl bg-danger/10 p-4 text-sm">
            <p className="text-danger">{recentBlockWarning}</p>
            <label className="flex items-center gap-2 text-text-muted">
              <input
                type="checkbox"
                checked={confirmedDuplicate}
                onChange={(e) => setConfirmedDuplicate(e.target.checked)}
                className="h-5 w-5"
              />
              Create it anyway
            </label>
          </div>
        )}

        {plans.map(({ exercise, plan: computedPlan }) => {
          const form = forms[exercise.id]
          const isIncluded = included[exercise.id]
          const plan = isIncluded ? computedPlan : null
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
            <div
              key={exercise.id}
              className={`space-y-3 rounded-xl bg-surface p-4 transition-opacity ${isIncluded ? '' : 'opacity-50'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="font-medium">{exercise.name}</div>
                  <div className="text-xs text-text-muted">{isIncluded ? 'In this block' : 'Skipped this block'}</div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isIncluded}
                  aria-label={`${isIncluded ? 'Remove' : 'Add'} ${exercise.name} ${isIncluded ? 'from' : 'to'} this block`}
                  onClick={() => setIncluded((prev) => ({ ...prev, [exercise.id]: !prev[exercise.id] }))}
                  className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors ${
                    isIncluded ? 'border-success bg-success' : 'border-border bg-surface-2'
                  }`}
                >
                  <span
                    className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-transform ${
                      isIncluded ? 'translate-x-[18px]' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {isIncluded && (
                <>
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
                </>
              )}
            </div>
          )
        })}

        {error && <p className="text-sm text-danger">{error}</p>}

        <button
          type="submit"
          disabled={!allValid || submitting}
          className="w-full rounded-xl bg-accent py-3 font-medium text-accent-text transition-transform active:scale-[0.98] disabled:opacity-40"
        >
          {submitting ? 'Creating…' : 'Generate block'}
        </button>
      </form>
    </div>
  )
}
