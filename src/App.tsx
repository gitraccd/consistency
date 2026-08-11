import { useEffect, useState } from 'react'
import type { Lift, LoggedSet, Program, WeeklyTarget } from './lib/api'
import { fetchLifts, fetchLatestProgram, fetchWeeklyTargets, fetchLoggedSets } from './lib/api'
import { currentWeekNumber } from './lib/weeks'
import { NewProgramFlow } from './components/NewProgramFlow'
import { Dashboard } from './components/Dashboard'
import { LogSetForm } from './components/LogSetForm'

interface AppData {
  lifts: Lift[]
  program: Program | null
  weeklyTargets: WeeklyTarget[]
  loggedSets: LoggedSet[]
}

async function loadData(): Promise<AppData> {
  const lifts = await fetchLifts()
  const program = await fetchLatestProgram()
  if (!program) return { lifts, program: null, weeklyTargets: [], loggedSets: [] }
  const [weeklyTargets, loggedSets] = await Promise.all([fetchWeeklyTargets(program.id), fetchLoggedSets(program.id)])
  return { lifts, program, weeklyTargets, loggedSets }
}

export default function App() {
  const [data, setData] = useState<AppData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showNewProgram, setShowNewProgram] = useState(false)
  const [logSetLiftId, setLogSetLiftId] = useState<string | null>(null)

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
      <div className="p-4 text-red-400">
        <p>Failed to load: {error}</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-400">
        Loading…
      </div>
    )
  }

  if (showNewProgram || !data.program) {
    return <NewProgramFlow lifts={data.lifts} onCreated={refresh} />
  }

  const currentWeek = currentWeekNumber(data.program.start_date)

  return (
    <div className="min-h-screen">
      <Dashboard
        program={data.program}
        lifts={data.lifts}
        currentWeek={currentWeek}
        weeklyTargets={data.weeklyTargets}
        loggedSets={data.loggedSets}
        onLogSet={setLogSetLiftId}
      />

      <button
        onClick={() => setShowNewProgram(true)}
        className="fixed bottom-4 right-4 rounded-full bg-slate-800 px-4 py-3 text-sm font-medium shadow-lg"
      >
        New block
      </button>

      {logSetLiftId && (
        <LogSetForm
          programId={data.program.id}
          lifts={data.lifts}
          currentWeek={currentWeek}
          defaultLiftId={logSetLiftId}
          onLogged={() => {
            setLogSetLiftId(null)
            refresh()
          }}
          onCancel={() => setLogSetLiftId(null)}
        />
      )}
    </div>
  )
}
