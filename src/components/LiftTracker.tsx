import { useState } from 'react'
import { Check } from 'lucide-react'
import type { DayWithExercises, LoggedSet, SetGroup, WeeklyTarget } from '../lib/api'
import { weeklyPlanEntryFor, type WeekNumber } from '../lib/calc'

function targetFor(setGroup: SetGroup, week: WeekNumber, weeklyTargets: WeeklyTarget[]): string | null {
  if (week === 6) return null
  if (setGroup.is_freeform) return null
  const target = weeklyTargets.find((t) => t.set_group_id === setGroup.id && t.week_number === week)
  return target ? String(target.target_weight) : null
}

export function LiftTracker({
  day,
  currentWeek,
  weeklyTargets,
  loggedSets,
  onCellClick,
  onQuickLog,
  onBack,
}: {
  day: DayWithExercises
  currentWeek: WeekNumber
  weeklyTargets: WeeklyTarget[]
  loggedSets: LoggedSet[]
  onCellClick: (setGroup: SetGroup) => void
  onQuickLog: (setGroup: SetGroup, weight: number, reps: number) => Promise<void>
  onBack: () => void
}) {
  const today = new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
  const [loggingId, setLoggingId] = useState<string | null>(null)

  async function handleQuickLog(setGroup: SetGroup, weight: number, reps: number) {
    setLoggingId(setGroup.id)
    try {
      await onQuickLog(setGroup, weight, reps)
    } finally {
      setLoggingId(null)
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-4 p-4 pb-24">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">{day.name}</h1>
          <p className="text-sm text-text-muted">
            Week {currentWeek} of 6{currentWeek === 6 ? ' (Deload)' : ''}
          </p>
        </div>
        <button onClick={onBack} className="text-text-muted">
          ✕
        </button>
      </div>

      <div className="rounded-lg bg-surface-2 px-3 py-2 text-sm text-text-muted">{today}</div>

      <div className="space-y-1 rounded-xl bg-surface p-4">
        <p className="text-xs font-medium text-text-muted">Workout estimate</p>
        <div className="flex justify-between text-xs text-text-muted">
          <span>Exercise</span>
          <span>Weight | Reps</span>
        </div>
        <div className="divide-y divide-border">
          {day.day_exercises.map((de) =>
            de.set_groups.map((sg) => {
              const target = targetFor(sg, currentWeek, weeklyTargets)
              const plan = weeklyPlanEntryFor(sg.weekly_plan, currentWeek)
              const logs = loggedSets.filter((s) => s.set_group_id === sg.id && s.week_number === currentWeek)
              const best = logs.reduce<LoggedSet | null>(
                (b, s) => (b === null || s.weight > b.weight ? s : b),
                null,
              )
              const canQuickLog = !plan && target != null

              return (
                <div key={sg.id} className="flex w-full items-center gap-2 py-3">
                  <button onClick={() => onCellClick(sg)} className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left">
                    <div className="min-w-0">
                      <div className="font-medium">{de.exercise.name}</div>
                      {(plan || sg.num_sets > 0 || sg.intensity_note) && (
                        <div className="text-xs text-text-muted">
                          {plan ? `${plan.sets}x${plan.reps}` : sg.num_sets > 0 ? `${sg.num_sets}x${sg.reps}` : ''}
                          {plan?.note ? ` · ${plan.note}` : sg.intensity_note ? ` · ${sg.intensity_note}` : ''}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      {plan ? (
                        <div className="text-text">{plan.target_rpe ?? '—'}</div>
                      ) : (
                        <div className={target ? 'text-text' : 'text-text-muted/50'}>
                          {currentWeek === 6 ? 'Deload' : (target ?? '—')}
                        </div>
                      )}
                      {best && <div className="text-xs text-success">{best.weight}x{best.reps}</div>}
                    </div>
                  </button>

                  {canQuickLog && (
                    <button
                      onClick={() => handleQuickLog(sg, Number(target), sg.reps)}
                      disabled={loggingId === sg.id}
                      aria-label={`Log ${target} for ${sg.reps} reps as planned`}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-success disabled:opacity-40"
                    >
                      <Check className="h-4 w-4" strokeWidth={3} />
                    </button>
                  )}
                </div>
              )
            }),
          )}
        </div>
      </div>
    </div>
  )
}
