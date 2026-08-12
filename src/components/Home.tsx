import type { LoggedSet, Program } from '../lib/api'
import type { WeekNumber } from '../lib/calc'

export function Home({
  program,
  currentWeek,
  loggedSets,
  onViewProgram,
  onNewProgram,
}: {
  program: Program | null
  currentWeek: WeekNumber
  loggedSets: LoggedSet[]
  onViewProgram: () => void
  onNewProgram: () => void
}) {
  const setsThisWeek = program ? loggedSets.filter((s) => s.week_number === currentWeek).length : 0

  return (
    <div className="mx-auto max-w-md space-y-6 p-4 pb-24">
      <div>
        <h1 className="text-2xl font-semibold">Consistency</h1>
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
          <p className="text-sm text-text-muted">Block started {program.start_date}</p>
          <p className="text-2xl font-semibold text-accent">{setsThisWeek} sets logged this week</p>
        </div>
      )}

      {program && (
        <button onClick={onViewProgram} className="w-full rounded-xl bg-accent py-3 font-medium text-accent-text">
          View Program
        </button>
      )}

      <button onClick={onNewProgram} className="w-full rounded-xl bg-surface-2 py-3 font-medium text-text">
        {program ? 'Start New Block' : 'Create Block'}
      </button>
    </div>
  )
}
