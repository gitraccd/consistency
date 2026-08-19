import { useState } from 'react'
import { deleteNutritionLog, insertNutritionLog, type NutritionLog } from '../lib/api'
import { todayIsoDate } from '../lib/schedule'

interface DayTotal {
  logDate: string
  calories: number
  protein: number
}

function totalsByDay(logs: NutritionLog[]): DayTotal[] {
  const byDate = new Map<string, DayTotal>()
  for (const log of logs) {
    const existing = byDate.get(log.log_date) ?? { logDate: log.log_date, calories: 0, protein: 0 }
    existing.calories += log.calories ?? 0
    existing.protein += log.protein ?? 0
    byDate.set(log.log_date, existing)
  }
  return [...byDate.values()].sort((a, b) => (a.logDate < b.logDate ? 1 : -1))
}

export function Nutrition({
  recent,
  onSaved,
  onBack,
}: {
  recent: NutritionLog[]
  onSaved: () => void
  onBack: () => void
}) {
  const [label, setLabel] = useState('')
  const [calories, setCalories] = useState('')
  const [protein, setProtein] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const today = todayIsoDate()
  const todaysEntries = recent.filter((log) => log.log_date === today)
  const todaysTotal = todaysEntries.reduce(
    (acc, log) => ({ calories: acc.calories + (log.calories ?? 0), protein: acc.protein + (log.protein ?? 0) }),
    { calories: 0, protein: 0 },
  )
  const history = totalsByDay(recent.filter((log) => log.log_date !== today))

  const valid = calories !== '' || protein !== ''

  async function handleAdd() {
    if (!valid) return
    setSubmitting(true)
    setError(null)
    try {
      await insertNutritionLog({
        logDate: today,
        label: label === '' ? null : label,
        calories: calories === '' ? null : Number(calories),
        protein: protein === '' ? null : Number(protein),
      })
      setLabel('')
      setCalories('')
      setProtein('')
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    setError(null)
    try {
      await deleteNutritionLog(id)
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-4 p-4 pb-24">
      <div className="flex items-start justify-between">
        <h1 className="text-xl font-semibold">Nutrition</h1>
        <button onClick={onBack} className="text-text-muted">
          ✕
        </button>
      </div>

      <div className="space-y-1 rounded-xl bg-surface p-4">
        <p className="text-sm text-text-muted">Today</p>
        <p className="text-2xl font-semibold text-accent">
          {todaysTotal.calories.toLocaleString()} cal · {todaysTotal.protein}g protein
        </p>
      </div>

      {todaysEntries.length > 0 && (
        <div className="rounded-xl bg-surface p-4">
          <ul className="divide-y divide-border">
            {todaysEntries.map((log) => (
              <li key={log.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span>
                  {log.label ? <span className="font-medium">{log.label}: </span> : null}
                  {log.calories != null ? `${log.calories} cal` : '—'}
                  {log.protein != null ? ` · ${log.protein}g protein` : ''}
                </span>
                <button
                  onClick={() => handleDelete(log.id)}
                  disabled={deletingId === log.id}
                  aria-label="Delete entry"
                  className="px-1 text-text-muted hover:text-danger disabled:opacity-40"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-3 rounded-xl bg-surface p-4">
        <p className="text-sm text-text-muted">Add a meal or snack</p>

        <label className="block space-y-1">
          <span className="text-sm text-text-muted">Label (optional)</span>
          <input
            type="text"
            placeholder="Breakfast, lunch, snack…"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full rounded-lg bg-surface-2 px-3 py-2 text-lg"
          />
        </label>

        <div className="flex gap-2">
          <label className="flex-1 space-y-1">
            <span className="text-sm text-text-muted">Calories</span>
            <input
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
          onClick={handleAdd}
          disabled={!valid || submitting}
          className="w-full rounded-xl bg-accent py-3 font-medium text-accent-text disabled:opacity-40"
        >
          {submitting ? 'Adding…' : 'Add'}
        </button>
      </div>

      {history.length > 0 && (
        <div className="space-y-1 rounded-xl bg-surface p-4">
          <p className="text-sm text-text-muted">Last 7 days</p>
          <div className="divide-y divide-border">
            {history.map((day) => (
              <div key={day.logDate} className="flex items-center justify-between py-2 text-sm">
                <span className="text-text-muted">{day.logDate}</span>
                <span className="text-text">
                  {day.calories.toLocaleString()} cal · {day.protein}g protein
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
