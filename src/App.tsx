import { useEffect, useState } from 'react'
import type {
  DayWithExercises,
  Exercise,
  ExerciseTest,
  LoggedSet,
  NutritionGoal,
  NutritionLog,
  Program,
  SetGroup,
  WeeklyTarget,
} from './lib/api'
import {
  fetchTemplate,
  fetchTestableExercises,
  fetchLatestProgram,
  fetchAllPrograms,
  fetchAllExerciseTests,
  fetchWeeklyTargets,
  fetchLoggedSets,
  fetchRecentNutritionLogs,
  fetchNutritionGoal,
  insertLoggedSet,
  bootstrapStarterTemplate,
  errorMessage,
} from './lib/api'
import { currentWeekNumber } from './lib/weeks'
import type { WeekNumber } from './lib/calc'
import { isoDateDaysAgo, todayIsoDate } from './lib/schedule'
import { NewProgramFlow } from './components/NewProgramFlow'
import { ManageTemplate } from './components/ManageTemplate'
import { ProgramTable } from './components/ProgramTable'
import { LogPopover } from './components/LogPopover'
import { Nutrition } from './components/Nutrition'
import { Home } from './components/Home'
import { LiftTracker } from './components/LiftTracker'
import { History } from './components/History'
import { RestTimer } from './components/RestTimer'
import { BottomNav, type NavView } from './components/BottomNav'

interface AppData {
  template: DayWithExercises[]
  testableExercises: Exercise[]
  program: Program | null
  weeklyTargets: WeeklyTarget[]
  loggedSets: LoggedSet[]
  recentNutritionLogs: NutritionLog[]
  nutritionGoal: NutritionGoal | null
  allPrograms: Program[]
  allExerciseTests: ExerciseTest[]
}

async function loadData(): Promise<AppData> {
  const [template, testableExercises, recentNutritionLogs, nutritionGoal, allPrograms, allExerciseTests] =
    await Promise.all([
      fetchTemplate(),
      fetchTestableExercises(),
      fetchRecentNutritionLogs(isoDateDaysAgo(29)),
      fetchNutritionGoal(),
      fetchAllPrograms(),
      fetchAllExerciseTests(),
    ])
  const program = await fetchLatestProgram()
  if (!program) {
    return {
      template,
      testableExercises,
      program: null,
      weeklyTargets: [],
      loggedSets: [],
      recentNutritionLogs,
      nutritionGoal,
      allPrograms,
      allExerciseTests,
    }
  }
  const [weeklyTargets, loggedSets] = await Promise.all([fetchWeeklyTargets(program.id), fetchLoggedSets(program.id)])
  return {
    template,
    testableExercises,
    program,
    weeklyTargets,
    loggedSets,
    recentNutritionLogs,
    nutritionGoal,
    allPrograms,
    allExerciseTests,
  }
}

function findDayName(template: DayWithExercises[], setGroupId: string): string {
  for (const day of template) {
    if (day.day_exercises.some((de) => de.set_groups.some((sg) => sg.id === setGroupId))) return day.name
  }
  return ''
}

function findExerciseName(template: DayWithExercises[], setGroupId: string): string {
  for (const day of template) {
    for (const de of day.day_exercises) {
      if (de.set_groups.some((sg) => sg.id === setGroupId)) return de.exercise.name
    }
  }
  return ''
}

interface ActiveCell {
  setGroup: SetGroup
  week: WeekNumber
}

/** Fallback rest duration when a set-group has no rest_seconds override set (see Manage Program's set-group editor). */
const REST_DURATION_SECONDS = 120

export default function App() {
  const [data, setData] = useState<AppData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<NavView>('home')
  const [showNewProgram, setShowNewProgram] = useState(false)
  const [showManageTemplate, setShowManageTemplate] = useState(false)
  const [activeCell, setActiveCell] = useState<ActiveCell | null>(null)
  const [liftTrackerDay, setLiftTrackerDay] = useState<string | null>(null)
  const [nutritionFocusAdd, setNutritionFocusAdd] = useState(false)
  const [restTimerEndsAt, setRestTimerEndsAt] = useState<number | null>(null)
  const [bootstrapping, setBootstrapping] = useState(false)
  const [bootstrapError, setBootstrapError] = useState<string | null>(null)

  function refresh() {
    setError(null)
    loadData()
      .then((d) => {
        setData(d)
        setShowNewProgram(false)
      })
      .catch((e) => setError(errorMessage(e)))
  }

  function startRestTimer(setGroup: SetGroup) {
    const seconds = setGroup.rest_seconds ?? REST_DURATION_SECONDS
    setRestTimerEndsAt(Date.now() + seconds * 1000)
  }

  function handleSetLogged(setGroup: SetGroup) {
    refresh()
    startRestTimer(setGroup)
  }

  async function handleQuickLog(setGroup: SetGroup, weight: number, reps: number) {
    await insertLoggedSet({
      programId: data!.program!.id,
      setGroupId: setGroup.id,
      weekNumber: currentWeek,
      weight,
      reps,
      rpe: null,
      isMaxEffort: false,
    })
    handleSetLogged(setGroup)
  }

  useEffect(refresh, [])

  if (error) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
        <div>
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="mt-2 text-sm text-danger">{error}</p>
        </div>
        <button
          onClick={refresh}
          className="rounded-xl bg-accent px-6 py-3 font-medium text-accent-text transition-transform active:scale-[0.98]"
        >
          Try again
        </button>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex min-h-dvh items-center justify-center gap-1.5">
        <span className="pulse-dot h-2 w-2 rounded-full bg-text-muted" style={{ animationDelay: '0ms' }} />
        <span className="pulse-dot h-2 w-2 rounded-full bg-text-muted" style={{ animationDelay: '150ms' }} />
        <span className="pulse-dot h-2 w-2 rounded-full bg-text-muted" style={{ animationDelay: '300ms' }} />
      </div>
    )
  }

  if (data.template.length === 0) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
        <div>
          <h1 className="text-xl font-semibold">Welcome to Consistency</h1>
          <p className="mt-2 text-sm text-text-muted">
            Your account is new -- there's no training program set up yet. Get a starter program (Squat, Bench,
            Deadlift, Weighted Pull-up, Weighted Dip) you can then edit or delete however you like via Manage
            Program.
          </p>
        </div>
        {bootstrapError && <p className="text-sm text-danger">{bootstrapError}</p>}
        <button
          onClick={() => {
            setBootstrapping(true)
            setBootstrapError(null)
            bootstrapStarterTemplate()
              .then(() => refresh())
              .catch((e) => setBootstrapError(errorMessage(e)))
              .finally(() => setBootstrapping(false))
          }}
          disabled={bootstrapping}
          className="rounded-xl bg-accent px-6 py-3 font-medium text-accent-text transition-transform active:scale-[0.98] disabled:opacity-40"
        >
          {bootstrapping ? 'Setting up…' : 'Set up starter program'}
        </button>
      </div>
    )
  }

  if (showNewProgram) {
    return (
      <NewProgramFlow
        testableExercises={data.testableExercises}
        template={data.template}
        latestProgram={data.program}
        onCreated={refresh}
        onCancel={() => setShowNewProgram(false)}
      />
    )
  }

  if (showManageTemplate) {
    return <ManageTemplate onClose={() => setShowManageTemplate(false)} onSaved={refresh} />
  }

  const currentWeek = data.program ? currentWeekNumber(data.program.start_date) : (1 as WeekNumber)

  const activeTarget = activeCell
    ? (data.weeklyTargets.find((t) => t.set_group_id === activeCell.setGroup.id && t.week_number === activeCell.week)
        ?.target_weight ?? null)
    : null
  const activeLogs = activeCell
    ? data.loggedSets.filter((s) => s.set_group_id === activeCell.setGroup.id && s.week_number === activeCell.week)
    : []

  return (
    <div className="min-h-dvh">
      {view === 'home' && (
        <Home
          program={data.program}
          template={data.template}
          currentWeek={currentWeek}
          loggedSets={data.loggedSets}
          todaysNutritionLogs={data.recentNutritionLogs.filter((log) => log.log_date === todayIsoDate())}
          onOpenLiftTracker={(dayName) => {
            setLiftTrackerDay(dayName)
            setView('lift-tracker')
          }}
          onOpenNutrition={(focusAdd) => {
            setNutritionFocusAdd(focusAdd ?? false)
            setView('nutrition')
          }}
          onNewProgram={() => setShowNewProgram(true)}
        />
      )}

      {view === 'program' &&
        (data.program ? (
          <ProgramTable
            program={data.program}
            template={data.template}
            currentWeek={currentWeek}
            weeklyTargets={data.weeklyTargets}
            loggedSets={data.loggedSets}
            onCellClick={(setGroup, week) => setActiveCell({ setGroup, week })}
            onManage={() => setShowManageTemplate(true)}
          />
        ) : (
          <div className="p-4 text-text-muted">No active block yet — create one from Home.</div>
        ))}

      {view === 'lift-tracker' &&
        data.program &&
        (() => {
          const day = data.template.find((d) => d.name === liftTrackerDay)
          return day ? (
            <LiftTracker
              day={day}
              currentWeek={currentWeek}
              weeklyTargets={data.weeklyTargets}
              loggedSets={data.loggedSets}
              onCellClick={(setGroup) => setActiveCell({ setGroup, week: currentWeek })}
              onQuickLog={handleQuickLog}
              onBack={() => setView('home')}
            />
          ) : null
        })()}

      {view === 'history' && (
        <History
          programs={data.allPrograms}
          exerciseTests={data.allExerciseTests}
          testableExercises={data.testableExercises}
          onSaved={refresh}
        />
      )}

      {view === 'nutrition' && (
        <Nutrition
          recent={data.recentNutritionLogs}
          goal={data.nutritionGoal}
          autoFocusAdd={nutritionFocusAdd}
          onSaved={refresh}
          onBack={() => setView('home')}
        />
      )}

      <BottomNav active={view} onNavigate={setView} />

      {restTimerEndsAt != null && (
        <RestTimer
          endsAt={restTimerEndsAt}
          onAdjust={(delta) => setRestTimerEndsAt((prev) => (prev != null ? prev + delta * 1000 : prev))}
          onDismiss={() => setRestTimerEndsAt(null)}
        />
      )}

      {activeCell && (
        <LogPopover
          programId={data.program!.id}
          setGroup={activeCell.setGroup}
          week={activeCell.week}
          label={`${findDayName(data.template, activeCell.setGroup.id)} · ${findExerciseName(data.template, activeCell.setGroup.id)}`}
          targetWeight={activeTarget != null ? String(activeTarget) : null}
          existingLogs={activeLogs}
          onLogged={refresh}
          onSetAdded={handleSetLogged}
          onClose={() => setActiveCell(null)}
        />
      )}
    </div>
  )
}
