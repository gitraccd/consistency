import type { Lift, LoggedSet, Program, WeeklyTarget } from '../lib/api'
import type { WeekNumber } from '../lib/calc'

export function Dashboard({
  program,
  lifts,
  currentWeek,
  weeklyTargets,
  loggedSets,
  onLogSet,
}: {
  program: Program
  lifts: Lift[]
  currentWeek: WeekNumber
  weeklyTargets: WeeklyTarget[]
  loggedSets: LoggedSet[]
  onLogSet: (liftId: string) => void
}) {
  return (
    <div className="mx-auto max-w-md space-y-6 p-4 pb-24">
      <div>
        <h1 className="text-xl font-semibold">Week {currentWeek} of 5</h1>
        <p className="text-sm text-slate-400">Block started {program.start_date}</p>
      </div>

      <div className="space-y-3">
        {lifts.map((lift) => {
          const target = weeklyTargets.find((t) => t.lift_id === lift.id && t.week_number === currentWeek)
          const setsThisWeek = loggedSets.filter((s) => s.lift_id === lift.id && s.week_number === currentWeek)
          const bestSet = setsThisWeek.reduce<LoggedSet | null>(
            (best, s) => (best === null || s.weight > best.weight ? s : best),
            null,
          )

          return (
            <div key={lift.id} className="rounded-xl bg-slate-900 p-4">
              <div className="flex items-center justify-between">
                <h2 className="font-medium">{lift.name}</h2>
                <button
                  onClick={() => onLogSet(lift.id)}
                  className="rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-medium text-slate-950"
                >
                  Log set
                </button>
              </div>

              <div className="mt-2 flex items-baseline gap-4 text-sm">
                <span className="text-slate-400">
                  Target: <span className="text-slate-100">{target ? `${target.target_weight} lb` : '—'}</span>
                </span>
                <span className="text-slate-400">
                  Best: <span className="text-slate-100">{bestSet ? `${bestSet.weight} lb x ${bestSet.reps}` : '—'}</span>
                </span>
              </div>

              {setsThisWeek.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm text-slate-400">
                  {setsThisWeek.map((s) => (
                    <li key={s.id}>
                      {s.weight} lb x {s.reps}
                      {s.rpe != null ? ` @ RPE ${s.rpe}` : ''}
                      {s.is_max_effort ? ' — max effort' : ''}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
