import { useState } from 'react'
import type { Lift } from '../lib/api'
import { insertLoggedSet } from '../lib/api'
import type { WeekNumber } from '../lib/calc'

export function LogSetForm({
  programId,
  lifts,
  currentWeek,
  defaultLiftId,
  onLogged,
  onCancel,
}: {
  programId: string
  lifts: Lift[]
  currentWeek: WeekNumber
  defaultLiftId: string
  onLogged: () => void
  onCancel: () => void
}) {
  const [liftId, setLiftId] = useState(defaultLiftId)
  const [week, setWeek] = useState<WeekNumber>(currentWeek)
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [rpe, setRpe] = useState('')
  const [isMaxEffort, setIsMaxEffort] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const valid = weight !== '' && reps !== ''

  async function handleSubmit() {
    if (!valid) return
    setSubmitting(true)
    setError(null)
    try {
      await insertLoggedSet({
        programId,
        liftId,
        weekNumber: week,
        weight: Number(weight),
        reps: Number(reps),
        rpe: rpe === '' ? null : Number(rpe),
        isMaxEffort,
      })
      onLogged()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 flex items-end justify-center bg-black/60 sm:items-center">
      <div className="w-full max-w-md space-y-4 rounded-t-2xl bg-slate-900 p-4 sm:rounded-2xl">
        <h2 className="text-lg font-semibold">Log a set</h2>

        <label className="block space-y-1">
          <span className="text-sm text-slate-400">Lift</span>
          <select
            value={liftId}
            onChange={(e) => setLiftId(e.target.value)}
            className="w-full rounded-lg bg-slate-800 px-3 py-2"
          >
            {lifts.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-sm text-slate-400">Week</span>
          <select
            value={week}
            onChange={(e) => setWeek(Number(e.target.value) as WeekNumber)}
            className="w-full rounded-lg bg-slate-800 px-3 py-2"
          >
            {[1, 2, 3, 4, 5].map((w) => (
              <option key={w} value={w}>
                Week {w}
              </option>
            ))}
          </select>
        </label>

        <div className="flex gap-2">
          <label className="flex-1 space-y-1">
            <span className="text-sm text-slate-400">Weight</span>
            <input
              autoFocus
              type="number"
              inputMode="decimal"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="w-full rounded-lg bg-slate-800 px-3 py-2 text-lg"
            />
          </label>
          <label className="flex-1 space-y-1">
            <span className="text-sm text-slate-400">Reps</span>
            <input
              type="number"
              inputMode="numeric"
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              className="w-full rounded-lg bg-slate-800 px-3 py-2 text-lg"
            />
          </label>
          <label className="w-20 space-y-1">
            <span className="text-sm text-slate-400">RPE</span>
            <input
              type="number"
              inputMode="decimal"
              value={rpe}
              onChange={(e) => setRpe(e.target.value)}
              className="w-full rounded-lg bg-slate-800 px-3 py-2 text-lg"
            />
          </label>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={isMaxEffort} onChange={(e) => setIsMaxEffort(e.target.checked)} />
          This was a genuine max effort
        </label>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 rounded-xl bg-slate-800 py-3 font-medium">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!valid || submitting}
            className="flex-1 rounded-xl bg-emerald-500 py-3 font-medium text-slate-950 disabled:opacity-40"
          >
            {submitting ? 'Saving…' : 'Log set'}
          </button>
        </div>
      </div>
    </div>
  )
}
