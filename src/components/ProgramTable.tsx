import { useState } from 'react'
import { ChevronDown, Settings } from 'lucide-react'
import type { DayExerciseWithDetails, DayWithExercises, LoggedSet, Program, SetGroup, WeeklyTarget } from '../lib/api'
import { weeklyPlanEntryFor, type WeekNumber } from '../lib/calc'
import { scheduledDayName } from '../lib/schedule'

const WEEKS: WeekNumber[] = [1, 2, 3, 4, 5, 6]

function targetFor(setGroup: SetGroup, week: WeekNumber, weeklyTargets: WeeklyTarget[]): string | null {
  if (week === 6) return null
  if (setGroup.is_freeform) return null
  const target = weeklyTargets.find((t) => t.set_group_id === setGroup.id && t.week_number === week)
  return target ? String(target.target_weight) : null
}

function bestLogFor(loggedSets: LoggedSet[], setGroupId: string, week: WeekNumber): LoggedSet | null {
  return loggedSets
    .filter((s) => s.set_group_id === setGroupId && s.week_number === week)
    .reduce<LoggedSet | null>((b, s) => (b === null || s.weight > b.weight ? s : b), null)
}

/** One set/rep scheme within an exercise -- collapsed shows this week's number, tap to reveal the full block. */
function SetGroupRow({
  setGroup,
  currentWeek,
  weeklyTargets,
  loggedSets,
  onCellClick,
}: {
  setGroup: SetGroup
  currentWeek: WeekNumber
  weeklyTargets: WeeklyTarget[]
  loggedSets: LoggedSet[]
  onCellClick: (setGroup: SetGroup, week: WeekNumber) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const currentPlan = weeklyPlanEntryFor(setGroup.weekly_plan, currentWeek)
  const currentTarget = targetFor(setGroup, currentWeek, weeklyTargets)
  const currentBest = bestLogFor(loggedSets, setGroup.id, currentWeek)

  return (
    <div className="rounded-lg bg-surface-2/60 p-3">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <div className="min-w-0">
          {(setGroup.num_sets > 0 || setGroup.intensity_note) && (
            <div className="text-xs text-text-muted">
              {setGroup.num_sets > 0 ? `${setGroup.num_sets}x${setGroup.reps}` : ''}
              {setGroup.intensity_note ? ` · ${setGroup.intensity_note}` : ''}
            </div>
          )}
          <div className="text-xs text-text-muted">This week</div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="text-right">
            {currentPlan ? (
              <div className="font-medium text-text">
                {currentPlan.sets}x{currentPlan.reps}
                {currentPlan.target_rpe ? ` @ ${currentPlan.target_rpe}` : ''}
              </div>
            ) : (
              <div className={`font-medium ${currentTarget ? 'text-text' : 'text-text-muted/50'}`}>
                {currentWeek === 6 ? 'Deload' : (currentTarget ?? '—')}
              </div>
            )}
            {currentBest && (
              <div className="text-xs text-success">
                {currentBest.weight}x{currentBest.reps}
              </div>
            )}
          </div>
          <ChevronDown className={`h-4 w-4 shrink-0 text-text-muted transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {expanded && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
          {WEEKS.map((week) => {
            const plan = weeklyPlanEntryFor(setGroup.weekly_plan, week)
            const target = targetFor(setGroup, week, weeklyTargets)
            const best = bestLogFor(loggedSets, setGroup.id, week)
            return (
              <button
                key={week}
                onClick={() => onCellClick(setGroup, week)}
                className={`rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors active:scale-95 ${
                  week === currentWeek ? 'bg-surface-2 ring-1 ring-border' : 'bg-surface'
                }`}
              >
                <div className="text-text-muted">W{week}</div>
                {plan ? (
                  <div className="font-medium text-text">
                    {plan.sets}x{plan.reps}
                    {plan.target_rpe ? ` @ ${plan.target_rpe}` : ''}
                  </div>
                ) : (
                  <div className={`font-medium ${target ? 'text-text' : 'text-text-muted/50'}`}>
                    {week === 6 ? 'Deload' : (target ?? '—')}
                  </div>
                )}
                {best && (
                  <div className="text-success">
                    {best.weight}x{best.reps}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ExerciseCard({
  dayExercise,
  currentWeek,
  weeklyTargets,
  loggedSets,
  onCellClick,
}: {
  dayExercise: DayExerciseWithDetails
  currentWeek: WeekNumber
  weeklyTargets: WeeklyTarget[]
  loggedSets: LoggedSet[]
  onCellClick: (setGroup: SetGroup, week: WeekNumber) => void
}) {
  return (
    <div className="space-y-2 rounded-xl bg-surface p-4">
      <div className="font-medium">{dayExercise.exercise.name}</div>
      <div className="space-y-2">
        {dayExercise.set_groups.map((sg) => (
          <SetGroupRow
            key={sg.id}
            setGroup={sg}
            currentWeek={currentWeek}
            weeklyTargets={weeklyTargets}
            loggedSets={loggedSets}
            onCellClick={onCellClick}
          />
        ))}
      </div>
    </div>
  )
}

export function ProgramTable({
  program,
  template,
  currentWeek,
  weeklyTargets,
  loggedSets,
  onCellClick,
  onManage,
}: {
  program: Program
  template: DayWithExercises[]
  currentWeek: WeekNumber
  weeklyTargets: WeeklyTarget[]
  loggedSets: LoggedSet[]
  onCellClick: (setGroup: SetGroup, week: WeekNumber) => void
  onManage: () => void
}) {
  const [startYear, startMonth, startDay] = program.start_date.split('-')
  const formattedStart = `${startMonth}/${startDay}/${startYear}`

  const todaysDay = scheduledDayName(template)
  const [selectedDayName, setSelectedDayName] = useState(todaysDay ?? template[0]?.name)
  const day = template.find((d) => d.name === selectedDayName) ?? template[0]

  return (
    <div className="page-enter mx-auto max-w-md space-y-6 p-4 pb-24">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Program</h1>
          <p className="mt-1 text-sm text-text">
            Week {currentWeek} of 6{currentWeek === 6 ? ' (Deload)' : ''}
          </p>
          <p className="text-xs text-text-muted">Started {formattedStart}</p>
        </div>
        <button
          onClick={onManage}
          aria-label="Manage program"
          className="-m-2.5 flex h-11 w-11 shrink-0 items-center justify-center text-text-muted"
        >
          <Settings className="h-5 w-5" />
        </button>
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
          {day.day_exercises.map((de) => (
            <ExerciseCard
              key={de.id}
              dayExercise={de}
              currentWeek={currentWeek}
              weeklyTargets={weeklyTargets}
              loggedSets={loggedSets}
              onCellClick={onCellClick}
            />
          ))}
        </div>
      )}
    </div>
  )
}
