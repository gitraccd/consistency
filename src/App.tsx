import { useEffect, useState } from 'react'
import type { DayWithExercises, Exercise, LoggedSet, Program, SetGroup, WeeklyTarget } from './lib/api'
import { fetchTemplate, fetchTestableExercises, fetchLatestProgram, fetchWeeklyTargets, fetchLoggedSets } from './lib/api'
import { currentWeekNumber } from './lib/weeks'
import type { WeekNumber } from './lib/calc'
import { NewProgramFlow } from './components/NewProgramFlow'
import { ProgramTable } from './components/ProgramTable'
import { LogPopover } from './components/LogPopover'
import { Home } from './components/Home'
import { BottomNav, type NavView } from './components/BottomNav'

interface AppData {
  template: DayWithExercises[]
  testableExercises: Exercise[]
  program: Program | null
  weeklyTargets: WeeklyTarget[]
  loggedSets: LoggedSet[]
}

async function loadData(): Promise<AppData> {
  const [template, testableExercises] = await Promise.all([fetchTemplate(), fetchTestableExercises()])
  const program = await fetchLatestProgram()
  if (!program) return { template, testableExercises, program: null, weeklyTargets: [], loggedSets: [] }
  const [weeklyTargets, loggedSets] = await Promise.all([fetchWeeklyTargets(program.id), fetchLoggedSets(program.id)])
  return { template, testableExercises, program, weeklyTargets, loggedSets }
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

export default function App() {
  const [data, setData] = useState<AppData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<NavView>('home')
  const [showNewProgram, setShowNewProgram] = useState(false)
  const [activeCell, setActiveCell] = useState<ActiveCell | null>(null)

  function refresh() {
    loadData()
      .then((d) => {
        setData(d)
        setShowNewProgram(false)
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }

  useEffect(refresh, [])

  if (error) {
    return (
      <div className="p-4 text-danger">
        <p>Failed to load: {error}</p>
      </div>
    )
  }

  if (!data) {
    return <div className="flex min-h-screen items-center justify-center text-text-muted">Loading…</div>
  }

  if (showNewProgram) {
    return <NewProgramFlow testableExercises={data.testableExercises} template={data.template} onCreated={refresh} />
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
    <div className="min-h-screen">
      {view === 'home' && (
        <Home
          program={data.program}
          currentWeek={currentWeek}
          loggedSets={data.loggedSets}
          onViewProgram={() => setView('program')}
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
          />
        ) : (
          <div className="p-4 text-text-muted">No active block yet — create one from Home.</div>
        ))}

      <BottomNav active={view} onNavigate={setView} />

      {activeCell && (
        <LogPopover
          programId={data.program!.id}
          setGroup={activeCell.setGroup}
          week={activeCell.week}
          label={`${findDayName(data.template, activeCell.setGroup.id)} · ${findExerciseName(data.template, activeCell.setGroup.id)}`}
          targetWeight={activeTarget != null ? String(activeTarget) : null}
          existingLogs={activeLogs}
          onLogged={() => {
            refresh()
            setView('program')
          }}
          onClose={() => setActiveCell(null)}
        />
      )}
    </div>
  )
}
