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
  onBack,
}: {
  day: DayWithExercises
  currentWeek: WeekNumber
  weeklyTargets: WeeklyTarget[]
  loggedSets: LoggedSet[]
  onCellClick: (setGroup: SetGroup) => void
  onBack: () => void
}) {
  const today = new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })

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
              return (
                <button
                  key={sg.id}
                  onClick={() => onCellClick(sg)}
                  className="flex w-full items-center justify-between py-3 text-left"
                >
                  <div>
                    <div className="font-medium">{de.exercise.name}</div>
                    {(plan || sg.num_sets > 0 || sg.intensity_note) && (
                      <div className="text-xs text-text-muted">
                        {plan ? `${plan.sets}x${plan.reps}` : sg.num_sets > 0 ? `${sg.num_sets}x${sg.reps}` : ''}
                        {plan?.note ? ` · ${plan.note}` : sg.intensity_note ? ` · ${sg.intensity_note}` : ''}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    {plan ? (
                      <div className="text-text">{plan.target_rpe ? `RPE ${plan.target_rpe}` : '—'}</div>
                    ) : (
                      <div className={target ? 'text-text' : 'text-text-muted/50'}>
                        {currentWeek === 6 ? 'Deload' : (target ?? '—')}
                      </div>
                    )}
                    {best && <div className="text-xs text-success">{best.weight}x{best.reps}</div>}
                  </div>
                </button>
              )
            }),
          )}
        </div>
      </div>
    </div>
  )
}
