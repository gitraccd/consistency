import { useState } from 'react'
import { insertLoggedSet, type LoggedSet, type SetGroup } from '../lib/api'
import type { WeekNumber } from '../lib/calc'

export function LogPopover({
  programId,
  setGroup,
  week,
  label,
  targetWeight,
  existingLogs,
  onLogged,
  onClose,
}: {
  programId: string
  setGroup: SetGroup
  week: WeekNumber
  label: string
  targetWeight: string | null
  existingLogs: LoggedSet[]
  onLogged: () => void
  onClose: () => void
}) {
  const [weight, setWeight] = useState(targetWeight ?? '')
  const [reps, setReps] = useState(String(setGroup.reps))
  const [showMore, setShowMore] = useState(false)
  const [rpe, setRpe] = useState('')
  const [isMaxEffort, setIsMaxEffort] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const valid = weight !== '' && reps !== ''

  async function handleAdd() {
    if (!valid) return
    setSubmitting(true)
    setError(null)
    try {
      await insertLoggedSet({
        programId,
        setGroupId: setGroup.id,
        weekNumber: week,
        weight: Number(weight),
        reps: Number(reps),
        rpe: rpe === '' ? null : Number(rpe),
        isMaxEffort,
      })
      setRpe('')
      setIsMaxEffort(false)
      onLogged()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-sm space-y-3 rounded-t-2xl bg-surface p-4 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-semibold">{label}</h2>
            <p className="text-sm text-text-muted">
              Week {week}
              {targetWeight ? ` · target ${targetWeight} lb` : ''}
            </p>
          </div>
          <button onClick={onClose} className="text-text-muted">
            ✕
          </button>
        </div>

        {existingLogs.length > 0 && (
          <ul className="space-y-1 text-sm text-text-muted">
            {existingLogs.map((l) => (
              <li key={l.id}>
                {l.weight} lb x {l.reps}
                {l.rpe != null ? ` @ RPE ${l.rpe}` : ''}
                {l.is_max_effort ? ' — max effort' : ''}
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-end gap-2">
          <label className="flex-1 space-y-1">
            <span className="text-sm text-text-muted">Weight</span>
            <input
              autoFocus
              type="number"
              inputMode="decimal"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="w-full rounded-lg bg-surface-2 px-3 py-2 text-lg"
            />
          </label>
          <label className="flex-1 space-y-1">
            <span className="text-sm text-text-muted">Reps</span>
            <input
              type="number"
              inputMode="numeric"
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              className="w-full rounded-lg bg-surface-2 px-3 py-2 text-lg"
            />
          </label>
          <button
            onClick={handleAdd}
            disabled={!valid || submitting}
            className="rounded-lg bg-accent px-4 py-2 font-medium text-accent-text disabled:opacity-40"
          >
            Add
          </button>
        </div>

        {!showMore ? (
          <button onClick={() => setShowMore(true)} className="text-sm text-text-muted">
            + RPE / max effort
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-text-muted">
              RPE
              <input
                type="number"
                inputMode="decimal"
                value={rpe}
                onChange={(e) => setRpe(e.target.value)}
                className="w-16 rounded-lg bg-surface-2 px-2 py-1"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-text-muted">
              <input type="checkbox" checked={isMaxEffort} onChange={(e) => setIsMaxEffort(e.target.checked)} />
              Max effort
            </label>
          </div>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </div>
  )
}
