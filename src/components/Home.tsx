import type { LoggedSet, Program } from '../lib/api'
import type { WeekNumber } from '../lib/calc'
import { scheduledDayName } from '../lib/schedule'

export function Home({
  program,
  currentWeek,
  loggedSets,
  onOpenLiftTracker,
  onNewProgram,
}: {
  program: Program | null
  currentWeek: WeekNumber
  loggedSets: LoggedSet[]
  onOpenLiftTracker: (dayName: string) => void
  onNewProgram: () => void
}) {
  const weekLogs = program ? loggedSets.filter((s) => s.week_number === currentWeek) : []
  const volumeLifted = weekLogs.reduce((sum, s) => sum + s.weight * s.reps, 0)
  const todaysDay = scheduledDayName()
  const canLogToday = program != null && todaysDay != null

  return (
    <div className="mx-auto max-w-md space-y-6 p-4 pb-24">
      <div>
        <h1 className="text-2xl font-semibold">Hello, Connor</h1>
        {program ? (
          <p className="text-text-muted">
            Week {currentWeek} of 6{currentWeek === 6 ? ' (Deload)' : ''}
          </p>
        ) : (
          <p className="text-text-muted">No active block yet</p>
        )}
      </div>

      {program && (
        <div className="space-y-1 rounded-xl bg-surface p-4">
          <p className="text-sm text-text-muted">Volume lifted this week</p>
          <p className="text-2xl font-semibold text-accent">{volumeLifted.toLocaleString()} lb</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => canLogToday && onOpenLiftTracker(todaysDay!)}
          disabled={!canLogToday}
          className="rounded-xl bg-surface-2 p-4 text-left disabled:opacity-40"
        >
          <p className="font-medium">Workout Today</p>
          <p className="text-sm text-text-muted">{todaysDay ?? 'Rest day'}</p>
        </button>

        <div className="rounded-xl bg-surface-2 p-4 text-left opacity-40">
          <p className="font-medium">Calories</p>
          <p className="text-sm text-text-muted">Coming soon</p>
        </div>
      </div>

      <button onClick={onNewProgram} className="w-full rounded-xl bg-accent py-3 font-medium text-accent-text">
        {program ? 'Start New Block' : 'Create Block'}
      </button>
    </div>
  )
}
