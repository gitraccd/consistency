import type { DayWithExercises, LoggedSet, Program, SetGroup, WeeklyTarget } from '../lib/api'
import { weeklyPlanEntryFor, type WeekNumber } from '../lib/calc'

const WEEKS: WeekNumber[] = [1, 2, 3, 4, 5, 6]

function targetFor(setGroup: SetGroup, week: WeekNumber, weeklyTargets: WeeklyTarget[]): string | null {
  if (week === 6) return null
  if (setGroup.is_freeform) return null
  const target = weeklyTargets.find((t) => t.set_group_id === setGroup.id && t.week_number === week)
  return target ? String(target.target_weight) : null
}

export function ProgramTable({
  program,
  template,
  currentWeek,
  weeklyTargets,
  loggedSets,
  onCellClick,
}: {
  program: Program
  template: DayWithExercises[]
  currentWeek: WeekNumber
  weeklyTargets: WeeklyTarget[]
  loggedSets: LoggedSet[]
  onCellClick: (setGroup: SetGroup, week: WeekNumber) => void
}) {
  return (
    <div className="space-y-8 p-4 pb-24">
      <div>
        <h1 className="text-xl font-semibold">Block started {program.start_date}</h1>
        <p className="text-sm text-text-muted">
          Week {currentWeek} of 6{currentWeek === 6 ? ' (Deload)' : ''}
        </p>
      </div>

      {template.map((day) => (
        <div key={day.id} className="space-y-2">
          <h2 className="text-lg font-semibold text-text">{day.name}</h2>
          <div className="overflow-x-auto rounded-xl bg-surface">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 min-w-[160px] bg-surface p-2 text-left font-medium text-text-muted">
                    Exercise
                  </th>
                  {WEEKS.map((w) => (
                    <th
                      key={w}
                      className={`p-2 text-center font-medium ${w === currentWeek ? 'text-accent' : 'text-text-muted'}`}
                    >
                      W{w}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {day.day_exercises.map((de) =>
                  de.set_groups.map((sg) => (
                    <tr key={sg.id} className="border-t border-border">
                      <td className="sticky left-0 z-10 bg-surface p-2 align-top">
                        <div className="font-medium">{de.exercise.name}</div>
                        <div className="text-xs text-text-muted">
                          {sg.num_sets}x{sg.reps}
                          {sg.intensity_note ? ` · ${sg.intensity_note}` : ''}
                        </div>
                      </td>
                      {WEEKS.map((week) => {
                        const target = targetFor(sg, week, weeklyTargets)
                        const plan = weeklyPlanEntryFor(sg.weekly_plan, week)
                        const logs = loggedSets.filter((s) => s.set_group_id === sg.id && s.week_number === week)
                        const best = logs.reduce<LoggedSet | null>(
                          (b, s) => (b === null || s.weight > b.weight ? s : b),
                          null,
                        )
                        return (
                          <td
                            key={week}
                            onClick={() => onCellClick(sg, week)}
                            className={`cursor-pointer p-2 text-center hover:bg-surface-2 ${
                              week === currentWeek ? 'bg-surface-2/60' : ''
                            }`}
                          >
                            {plan ? (
                              <div className="text-text">
                                {plan.sets}x{plan.reps}
                                {plan.target_rpe ? ` @ RPE ${plan.target_rpe}` : ''}
                              </div>
                            ) : (
                              <div className={target ? 'text-text' : 'text-text-muted/50'}>
                                {week === 6 ? 'Deload' : (target ?? '—')}
                              </div>
                            )}
                            {best && (
                              <div className="text-xs text-success">
                                {best.weight}x{best.reps}
                              </div>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}
