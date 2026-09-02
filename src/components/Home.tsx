import { Fragment } from 'react'
import { Plus } from 'lucide-react'
import type { LoggedSet, NutritionLog, Program } from '../lib/api'
import type { WeekNumber } from '../lib/calc'
import { scheduledDayName, todayIsoDate } from '../lib/schedule'

interface ConsistencyDay {
  date: string
  isTrainingDay: boolean
  hasLog: boolean
  isFuture: boolean
  isToday: boolean
}

/** One row per program week, one dot per calendar day, aligned to the fixed weekday training schedule. */
function buildConsistencyWeeks(startDate: string, loggedSets: LoggedSet[]): ConsistencyDay[][] {
  const loggedDates = new Set(loggedSets.map((s) => todayIsoDate(new Date(s.logged_at))))
  const today = todayIsoDate()
  const start = new Date(startDate + 'T00:00:00')

  const weeks: ConsistencyDay[][] = []
  for (let w = 0; w < 6; w++) {
    const week: ConsistencyDay[] = []
    for (let d = 0; d < 7; d++) {
      const date = new Date(start)
      date.setDate(date.getDate() + w * 7 + d)
      const iso = todayIsoDate(date)
      week.push({
        date: iso,
        isTrainingDay: scheduledDayName(date) != null,
        hasLog: loggedDates.has(iso),
        isFuture: iso > today,
        isToday: iso === today,
      })
    }
    weeks.push(week)
  }
  return weeks
}

function ConsistencyGrid({ weeks }: { weeks: ConsistencyDay[][] }) {
  return (
    <div className="grid grid-cols-[1.5rem_repeat(7,1fr)] items-center gap-y-2.5">
      <span />
      {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
        <span key={i} className="text-center text-[11px] text-text-muted">
          {d}
        </span>
      ))}
      {weeks.map((week, i) => (
        <Fragment key={i}>
          <span className="text-xs text-text-muted">W{i + 1}</span>
          {week.map((day) => (
            <div key={day.date} className="flex justify-center">
              <span
                className={
                  day.hasLog
                    ? 'h-2.5 w-2.5 rounded-full bg-text'
                    : day.isTrainingDay
                      ? `h-2.5 w-2.5 rounded-full border ${day.isToday ? 'border-text' : 'border-text-muted/50'}`
                      : 'h-1.5 w-1.5 rounded-full bg-border'
                }
              />
            </div>
          ))}
        </Fragment>
      ))}
    </div>
  )
}

function WeekRing({ week }: { week: WeekNumber }) {
  const r = 18
  const c = 2 * Math.PI * r
  return (
    <div className="relative h-11 w-11 shrink-0">
      <svg viewBox="0 0 44 44" className="h-11 w-11 -rotate-90">
        <circle cx="22" cy="22" r={r} fill="none" stroke="var(--color-border)" strokeWidth="3" />
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          stroke="var(--color-text)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - week / 6)}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold">{week}</span>
    </div>
  )
}

export function Home({
  program,
  currentWeek,
  loggedSets,
  todaysNutritionLogs,
  onOpenLiftTracker,
  onOpenNutrition,
  onNewProgram,
}: {
  program: Program | null
  currentWeek: WeekNumber
  loggedSets: LoggedSet[]
  todaysNutritionLogs: NutritionLog[]
  onOpenLiftTracker: (dayName: string) => void
  onOpenNutrition: () => void
  onNewProgram: () => void
}) {
  const weekLogs = program ? loggedSets.filter((s) => s.week_number === currentWeek) : []
  const volumeLifted = weekLogs.reduce((sum, s) => sum + s.weight * s.reps, 0)
  const todaysDay = scheduledDayName()
  const canLogToday = program != null && todaysDay != null
  const todaysCalories = todaysNutritionLogs.reduce((sum, log) => sum + (log.calories ?? 0), 0)
  const todaysProtein = todaysNutritionLogs.reduce((sum, log) => sum + (log.protein ?? 0), 0)

  return (
    <div className="mx-auto max-w-md p-5 pb-24">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Home</h1>
        {program && (
          <button
            onClick={onNewProgram}
            aria-label="Start new block"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 text-text"
          >
            <Plus className="h-5 w-5" strokeWidth={2.5} />
          </button>
        )}
      </header>

      {program ? (
        <>
          <div className="mb-3 grid grid-cols-2 gap-3">
            <button
              onClick={() => canLogToday && onOpenLiftTracker(todaysDay!)}
              disabled={!canLogToday}
              className="flex min-h-[148px] flex-col justify-between rounded-2xl bg-surface p-4 text-left disabled:opacity-40"
            >
              <WeekRing week={currentWeek} />
              <div>
                <p className="font-semibold">{todaysDay ?? 'Rest day'}</p>
                <p className="text-sm text-text-muted">Week {currentWeek} of 6</p>
              </div>
            </button>

            <button
              onClick={onOpenNutrition}
              className="flex min-h-[148px] flex-col justify-between rounded-2xl bg-surface p-4 text-left"
            >
              <p className="text-3xl font-bold tabular-nums">
                {todaysCalories.toLocaleString()}
                <span className="text-base font-normal text-text-muted"> cal</span>
              </p>
              <div>
                <p className="font-semibold">Nutrition</p>
                <p className="text-sm text-text-muted">{todaysProtein}g protein today</p>
              </div>
            </button>
          </div>

          <div className="mb-3 rounded-2xl bg-surface p-4">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-text-muted">Consistency</p>
            <ConsistencyGrid weeks={buildConsistencyWeeks(program.start_date, loggedSets)} />
          </div>

          <div className="flex items-center justify-between rounded-2xl bg-surface p-4">
            <div>
              <p className="font-semibold">Volume lifted</p>
              <p className="text-sm text-text-muted">This week</p>
            </div>
            <p className="text-2xl font-bold tabular-nums">
              {volumeLifted.toLocaleString()} <span className="text-base font-normal text-text-muted">lb</span>
            </p>
          </div>
        </>
      ) : (
        <>
          <p className="mb-6 text-text-muted">No active block yet</p>
          <button onClick={onNewProgram} className="w-full rounded-xl bg-accent py-3.5 font-medium text-accent-text">
            Create Block
          </button>
        </>
      )}
    </div>
  )
}
