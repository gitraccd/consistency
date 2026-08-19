import { useState } from 'react'
import { upsertNutritionLog, type NutritionLog } from '../lib/api'
import { todayIsoDate } from '../lib/schedule'

export function Nutrition({
  today,
  recent,
  onSaved,
  onBack,
}: {
  today: NutritionLog | null
  recent: NutritionLog[]
  onSaved: () => void
  onBack: () => void
}) {
  const [calories, setCalories] = useState(today?.calories != null ? String(today.calories) : '')
  const [protein, setProtein] = useState(today?.protein != null ? String(today.protein) : '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setSubmitting(true)
    setError(null)
    try {
      await upsertNutritionLog({
        logDate: todayIsoDate(),
        calories: calories === '' ? null : Number(calories),
        protein: protein === '' ? null : Number(protein),
      })
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSubmitting(false)
    }
  }

  const history = recent.filter((log) => log.log_date !== todayIsoDate())

  return (
    <div className="mx-auto max-w-md space-y-4 p-4 pb-24">
      <div className="flex items-start justify-between">
        <h1 className="text-xl font-semibold">Nutrition</h1>
        <button onClick={onBack} className="text-text-muted">
          ✕
        </button>
      </div>

      <div className="space-y-3 rounded-xl bg-surface p-4">
        <p className="text-sm text-text-muted">Today</p>
        <div className="flex gap-2">
          <label className="flex-1 space-y-1">
            <span className="text-sm text-text-muted">Calories</span>
            <input
              autoFocus
              type="number"
              inputMode="numeric"
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
              className="w-full rounded-lg bg-surface-2 px-3 py-2 text-lg"
            />
          </label>
          <label className="flex-1 space-y-1">
            <span className="text-sm text-text-muted">Protein (g)</span>
            <input
              type="number"
              inputMode="numeric"
              value={protein}
              onChange={(e) => setProtein(e.target.value)}
              className="w-full rounded-lg bg-surface-2 px-3 py-2 text-lg"
            />
          </label>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <button
          onClick={handleSave}
          disabled={submitting}
          className="w-full rounded-xl bg-accent py-3 font-medium text-accent-text disabled:opacity-40"
        >
          {submitting ? 'Saving…' : 'Save'}
        </button>
      </div>

      {history.length > 0 && (
        <div className="space-y-1 rounded-xl bg-surface p-4">
          <p className="text-sm text-text-muted">Last 7 days</p>
          <div className="divide-y divide-border">
            {history.map((log) => (
              <div key={log.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-text-muted">{log.log_date}</span>
                <span className="text-text">
                  {log.calories != null ? `${log.calories} cal` : '—'}
                  {log.protein != null ? ` · ${log.protein}g protein` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
