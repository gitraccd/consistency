import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Drumstick, Flame } from 'lucide-react'
import { deleteNutritionLog, insertNutritionLog, upsertNutritionGoal, type NutritionGoal, type NutritionLog } from '../lib/api'
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

/** Calories is a ceiling (cut goal: at or under); protein is a floor (adequacy goal: at or over). */
function dayHitGoal(day: DayTotal, goal: NutritionGoal): { calories: boolean; protein: boolean } {
  return {
    calories: goal.calories == null || day.calories <= goal.calories,
    protein: goal.protein == null || day.protein >= goal.protein,
  }
}

function RingStat({
  value,
  goal,
  unit,
  label,
  color,
  icon,
}: {
  value: number
  goal: number | null
  unit: string
  label: string
  color: string
  icon: ReactNode
}) {
  const size = 64
  const stroke = 6
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = goal != null && goal > 0 ? Math.min(value / goal, 1) : 0

  const [animatedPct, setAnimatedPct] = useState(0)
  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimatedPct(pct))
    return () => cancelAnimationFrame(id)
  }, [pct])

  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-surface p-5">
      <div>
        <p className="text-3xl font-bold tabular-nums">
          {value.toLocaleString()}
          {goal != null && <span className="text-lg font-normal text-text-muted">/{goal.toLocaleString()}{unit}</span>}
        </p>
        <p className="text-sm text-text-muted">{label}</p>
      </div>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} className="-rotate-90" style={{ width: size, height: size }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-surface-2)" strokeWidth={stroke} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - animatedPct)}
            className="transition-[stroke-dashoffset] duration-700 ease-out"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center" style={{ color }}>
          {icon}
        </span>
      </div>
    </div>
  )
}

export function Nutrition({
  recent,
  goal,
  autoFocusAdd,
  onSaved,
  onBack,
}: {
  recent: NutritionLog[]
  goal: NutritionGoal | null
  autoFocusAdd?: boolean
  onSaved: () => void
  onBack: () => void
}) {
  const [label, setLabel] = useState('')
  const [calories, setCalories] = useState('')
  const [protein, setProtein] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const calorieInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (autoFocusAdd) calorieInputRef.current?.focus()
  }, [autoFocusAdd])

  const [editingGoal, setEditingGoal] = useState(false)
  const [goalCalories, setGoalCalories] = useState(goal?.calories != null ? String(goal.calories) : '')
  const [goalProtein, setGoalProtein] = useState(goal?.protein != null ? String(goal.protein) : '')
  const [savingGoal, setSavingGoal] = useState(false)

  const today = todayIsoDate()
  const todaysEntries = recent.filter((log) => log.log_date === today)
  const todaysTotal = todaysEntries.reduce(
    (acc, log) => ({ calories: acc.calories + (log.calories ?? 0), protein: acc.protein + (log.protein ?? 0) }),
    { calories: 0, protein: 0 },
  )
  const history = totalsByDay(recent.filter((log) => log.log_date !== today))

  const valid = calories !== '' || protein !== ''

  async function handleSaveGoal() {
    setSavingGoal(true)
    setError(null)
    try {
      await upsertNutritionGoal({
        calories: goalCalories === '' ? null : Number(goalCalories),
        protein: goalProtein === '' ? null : Number(goalProtein),
      })
      setEditingGoal(false)
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSavingGoal(false)
    }
  }

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
    <div className="page-enter mx-auto max-w-md space-y-4 p-4 pb-24">
      <div className="flex items-start justify-between">
        <h1 className="text-xl font-semibold">Nutrition</h1>
        <button
          onClick={onBack}
          aria-label="Close"
          className="-m-2.5 flex h-11 w-11 shrink-0 items-center justify-center text-text-muted"
        >
          ✕
        </button>
      </div>

      <div className="flex items-center justify-between px-1">
        <p className="text-sm text-text-muted">Today</p>
        <button onClick={() => setEditingGoal((v) => !v)} className="text-sm text-text-muted underline">
          {goal ? 'Edit goal' : 'Set goal'}
        </button>
      </div>

      <div className="space-y-3">
        <RingStat
          value={todaysTotal.calories}
          goal={goal?.calories ?? null}
          unit=""
          label="Calories eaten"
          color="var(--color-calories)"
          icon={<Flame className="h-6 w-6" fill="currentColor" />}
        />
        <RingStat
          value={todaysTotal.protein}
          goal={goal?.protein ?? null}
          unit="g"
          label="Protein eaten"
          color="var(--color-protein)"
          icon={<Drumstick className="h-6 w-6" />}
        />
      </div>

      {editingGoal && (
        <div className="space-y-3 rounded-xl bg-surface p-4">
          <div className="flex gap-2">
            <label className="flex-1 space-y-1">
              <span className="text-sm text-text-muted">Calorie target</span>
              <input
                type="number"
                inputMode="numeric"
                value={goalCalories}
                onChange={(e) => setGoalCalories(e.target.value)}
                className="w-full rounded-lg bg-surface-2 px-3 py-2 text-lg"
              />
            </label>
            <label className="flex-1 space-y-1">
              <span className="text-sm text-text-muted">Protein target (g)</span>
              <input
                type="number"
                inputMode="numeric"
                value={goalProtein}
                onChange={(e) => setGoalProtein(e.target.value)}
                className="w-full rounded-lg bg-surface-2 px-3 py-2 text-lg"
              />
            </label>
          </div>
          <button
            onClick={handleSaveGoal}
            disabled={savingGoal}
            className="w-full rounded-xl bg-accent py-3 font-medium text-accent-text transition-transform active:scale-[0.98] disabled:opacity-40"
          >
            {savingGoal ? 'Saving…' : 'Save goal'}
          </button>
        </div>
      )}

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
                  className="-m-1.5 flex h-10 w-10 shrink-0 items-center justify-center text-text-muted hover:text-danger disabled:opacity-40"
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
              ref={calorieInputRef}
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
          className="w-full rounded-xl bg-accent py-3 font-medium text-accent-text transition-transform active:scale-[0.98] disabled:opacity-40"
        >
          {submitting ? 'Adding…' : 'Add'}
        </button>
      </div>

      {history.length > 0 && (
        <div className="space-y-1 rounded-xl bg-surface p-4">
          <p className="text-sm text-text-muted">Last 7 days</p>
          <div className="divide-y divide-border">
            {history.map((day) => {
              const hit = goal ? dayHitGoal(day, goal) : null
              return (
                <div key={day.logDate} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-text-muted">{day.logDate}</span>
                  <span className="text-text">
                    {day.calories.toLocaleString()} cal{hit ? (hit.calories ? ' ✓' : ' ✗') : ''} · {day.protein}g
                    protein
                    {hit ? (hit.protein ? ' ✓' : ' ✗') : ''}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
