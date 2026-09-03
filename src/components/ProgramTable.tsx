import { useState } from 'react'
import type { DayWithExercises, LoggedSet, Program, SetGroup, WeeklyTarget } from '../lib/api'
import { weeklyPlanEntryFor, type WeekNumber } from '../lib/calc'
import { scheduledDayName } from '../lib/schedule'

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
  const [startYear, startMonth, startDay] = program.start_date.split('-')
  const formattedStart = `${startMonth}/${startDay}/${startYear}`

  const todaysDay = scheduledDayName()
  const [selectedDayName, setSelectedDayName] = useState(todaysDay ?? template[0]?.name)
  const day = template.find((d) => d.name === selectedDayName) ?? template[0]

  return (
    <div className="page-enter mx-auto max-w-md space-y-6 p-4 pb-24">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Program</h1>
        <p className="mt-1 text-sm text-text">
          Week {currentWeek} of 6{currentWeek === 6 ? ' (Deload)' : ''}
        </p>
        <p className="text-xs text-text-muted">Started {formattedStart}</p>
      </div>

      <div className="flex gap-2 overflow-x-auto">
        {template.map((d) => (
          <button
            key={d.id}
            onClick={() => setSelectedDayName(d.name)}
            aria-label={d.name === todaysDay ? `${d.name}, today` : d.name}
            className={`flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3.5 py-3 text-sm font-medium transition-transform active:scale-95 ${
              d.name === day?.name ? 'bg-text text-bg' : 'bg-surface-2 text-text-muted'
            }`}
          >
            {d.name}
            {d.name === todaysDay && (
              <span
                className={`h-1.5 w-1.5 rounded-full ${d.name === day?.name ? 'bg-bg' : 'bg-text'}`}
                aria-hidden="true"
              />
            )}
          </button>
        ))}
      </div>

      {day && (
        <div key={day.id} className="page-enter space-y-2">
          <div className="relative overflow-hidden rounded-xl bg-surface">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 min-w-[160px] bg-surface p-3 text-left font-medium text-text-muted">
                      Exercise
                    </th>
                    {WEEKS.map((w) => (
                      <th
                        key={w}
                        className={`p-3 text-center font-medium ${
                          w === currentWeek ? 'border-b-2 border-text font-semibold text-text' : 'text-text-muted'
                        }`}
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
                        <td className="sticky left-0 z-10 bg-surface p-3 align-top">
                          <div className="font-medium">{de.exercise.name}</div>
                          {(sg.num_sets > 0 || sg.intensity_note) && (
                            <div className="text-xs text-text-muted">
                              {sg.num_sets > 0 ? `${sg.num_sets}x${sg.reps}` : ''}
                              {sg.intensity_note ? ` · ${sg.intensity_note}` : ''}
                            </div>
                          )}
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
                              className={`touch-manipulation cursor-pointer p-3 text-center transition-colors hover:bg-surface-2 active:bg-surface-2/80 ${
                                week === currentWeek ? 'bg-surface-2' : ''
                              }`}
                            >
                              {plan ? (
                                <div className="text-text">
                                  {plan.sets}x{plan.reps}
                                  {plan.target_rpe ? ` @ ${plan.target_rpe}` : ''}
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
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-surface to-transparent"
            />
          </div>
        </div>
      )}
    </div>
  )
}
