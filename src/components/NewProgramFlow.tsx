import { useState } from 'react'
import type { Lift, LiftTestPlan } from '../lib/api'
import { createProgram } from '../lib/api'
import { DEFAULT_WEEK1_PERCENTAGE, resolveTestLift, computeWeeklyTargets } from '../lib/calc'
import type { TestLiftMode } from '../lib/database.types'

interface LiftFormState {
  mode: TestLiftMode
  weight: string
  reps: string
  rpe: string
  manualE1rm: string
  manualWeek1Weight: string
  week1Percentage: string
  increments: [string, string, string, string]
}

function initialFormState(lift: Lift): LiftFormState {
  return {
    mode: 'raw_epley',
    weight: '',
    reps: '',
    rpe: '',
    manualE1rm: '',
    manualWeek1Weight: '',
    week1Percentage: String(lift.default_week1_percentage ?? DEFAULT_WEEK1_PERCENTAGE),
    increments: lift.default_increments.map(String) as [string, string, string, string],
  }
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

export function NewProgramFlow({ lifts, onCreated }: { lifts: Lift[]; onCreated: () => void }) {
  const [startDate, setStartDate] = useState(todayIsoDate())
  const [forms, setForms] = useState<Record<string, LiftFormState>>(() =>
    Object.fromEntries(lifts.map((l) => [l.id, initialFormState(l)])),
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function updateForm(liftId: string, patch: Partial<LiftFormState>) {
    setForms((prev) => ({ ...prev, [liftId]: { ...prev[liftId], ...patch } }))
  }

  function buildPlan(lift: Lift): LiftTestPlan | null {
    const form = forms[lift.id]
    const increments = form.increments.map((v) => Number(v) || 0) as [number, number, number, number]
    const week1Percentage = form.week1Percentage === '' ? undefined : Number(form.week1Percentage)

    switch (form.mode) {
      case 'raw_epley':
      case 'rpe_based':
        if (form.weight === '' || form.reps === '') return null
        return {
          liftId: lift.id,
          increments,
          input: {
            mode: form.mode,
            weight: Number(form.weight),
            reps: Number(form.reps),
            rpe: form.mode === 'rpe_based' ? Number(form.rpe) : undefined,
            week1Percentage,
          },
        }
      case 'manual_e1rm':
        if (form.manualE1rm === '') return null
        return {
          liftId: lift.id,
          increments,
          input: { mode: form.mode, manualE1rm: Number(form.manualE1rm), week1Percentage },
        }
      case 'manual_week1_weight':
        if (form.manualWeek1Weight === '') return null
        return {
          liftId: lift.id,
          increments,
          input: { mode: form.mode, manualWeek1Weight: Number(form.manualWeek1Weight) },
        }
    }
  }

  const plans = lifts.map((lift) => ({ lift, plan: buildPlan(lift) }))
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
      <h1 className="text-xl font-semibold">New 5-week block</h1>

      <label className="block space-y-1">
        <span className="text-sm text-slate-400">Start date</span>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="w-full rounded-lg bg-slate-900 px-3 py-2 text-slate-100"
        />
      </label>

      {lifts.map((lift) => {
        const form = forms[lift.id]
        const plan = buildPlan(lift)
        let preview: { e1rm: number | null; targets: Record<number, number> } | null = null
        if (plan) {
          try {
            const resolved = resolveTestLift(plan.input)
            preview = { e1rm: resolved.computedE1rm, targets: computeWeeklyTargets(resolved.week1Weight, plan.increments) }
          } catch {
            preview = null
          }
        }

        return (
          <div key={lift.id} className="space-y-3 rounded-xl bg-slate-900 p-4">
            <h2 className="font-medium">{lift.name}</h2>

            <label className="block space-y-1">
              <span className="text-sm text-slate-400">Test mode</span>
              <select
                value={form.mode}
                onChange={(e) => updateForm(lift.id, { mode: e.target.value as TestLiftMode })}
                className="w-full rounded-lg bg-slate-800 px-3 py-2"
              >
                <option value="raw_epley">Raw rep test (Epley)</option>
                <option value="rpe_based">RPE-based estimate</option>
                <option value="manual_e1rm">Manual E1RM</option>
                <option value="manual_week1_weight">Manual Week 1 weight</option>
              </select>
            </label>

            {(form.mode === 'raw_epley' || form.mode === 'rpe_based') && (
              <div className="flex gap-2">
                <label className="flex-1 space-y-1">
                  <span className="text-sm text-slate-400">Weight</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={form.weight}
                    onChange={(e) => updateForm(lift.id, { weight: e.target.value })}
                    className="w-full rounded-lg bg-slate-800 px-3 py-2"
                  />
                </label>
                <label className="flex-1 space-y-1">
                  <span className="text-sm text-slate-400">Reps</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={form.reps}
                    onChange={(e) => updateForm(lift.id, { reps: e.target.value })}
                    className="w-full rounded-lg bg-slate-800 px-3 py-2"
                  />
                </label>
                {form.mode === 'rpe_based' && (
                  <label className="flex-1 space-y-1">
                    <span className="text-sm text-slate-400">RPE</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={form.rpe}
                      onChange={(e) => updateForm(lift.id, { rpe: e.target.value })}
                      className="w-full rounded-lg bg-slate-800 px-3 py-2"
                    />
                  </label>
                )}
              </div>
            )}

            {form.mode === 'manual_e1rm' && (
              <label className="block space-y-1">
                <span className="text-sm text-slate-400">E1RM</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={form.manualE1rm}
                  onChange={(e) => updateForm(lift.id, { manualE1rm: e.target.value })}
                  className="w-full rounded-lg bg-slate-800 px-3 py-2"
                />
              </label>
            )}

            {form.mode === 'manual_week1_weight' && (
              <label className="block space-y-1">
                <span className="text-sm text-slate-400">Week 1 weight</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={form.manualWeek1Weight}
                  onChange={(e) => updateForm(lift.id, { manualWeek1Weight: e.target.value })}
                  className="w-full rounded-lg bg-slate-800 px-3 py-2"
                />
              </label>
            )}

            {form.mode !== 'manual_week1_weight' && (
              <label className="block space-y-1">
                <span className="text-sm text-slate-400">Week 1 % of E1RM</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={form.week1Percentage}
                  onChange={(e) => updateForm(lift.id, { week1Percentage: e.target.value })}
                  className="w-full rounded-lg bg-slate-800 px-3 py-2"
                />
              </label>
            )}

            <label className="block space-y-1">
              <span className="text-sm text-slate-400">Weeks 2-5 increments</span>
              <div className="flex gap-2">
                {form.increments.map((v, i) => (
                  <input
                    key={i}
                    type="number"
                    inputMode="decimal"
                    value={v}
                    onChange={(e) => {
                      const next = [...form.increments] as [string, string, string, string]
                      next[i] = e.target.value
                      updateForm(lift.id, { increments: next })
                    }}
                    className="w-full rounded-lg bg-slate-800 px-3 py-2"
                  />
                ))}
              </div>
            </label>

            {preview && (
              <div className="rounded-lg bg-slate-800/60 p-3 text-sm text-slate-300">
                {preview.e1rm != null && <div>E1RM: {preview.e1rm.toFixed(1)} lb</div>}
                <div className="mt-1 flex gap-3">
                  {Object.entries(preview.targets).map(([week, weight]) => (
                    <span key={week}>
                      W{week}: <span className="text-slate-100">{weight}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={!allValid || submitting}
        className="w-full rounded-xl bg-emerald-500 py-3 font-medium text-slate-950 disabled:opacity-40"
      >
        {submitting ? 'Creating…' : 'Generate block'}
      </button>
    </div>
  )
}
