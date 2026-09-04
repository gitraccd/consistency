import { useMemo, useState } from 'react'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { deleteProgram, errorMessage, type Exercise, type ExerciseTest, type Program } from '../lib/api'

interface LiftPoint {
  program: Program
  e1rm: number
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${m}/${d}/${y}`
}

/** How a test's E1RM was derived -- shown so an obviously-wrong number (bad manual entry, fat-fingered reps) is easy to spot and explain. */
function describeTest(test: ExerciseTest): string {
  switch (test.mode) {
    case 'raw_epley':
      return `${test.input_weight}x${test.input_reps}`
    case 'rpe_based':
      return `${test.input_weight}x${test.input_reps} @ RPE ${test.input_rpe}`
    case 'manual_e1rm':
      return 'Manual entry'
    default:
      return ''
  }
}

/** Deltas are computed against the previous block's test for the same exercise, not block-over-block generically. */
function priorTestFor(
  program: Program,
  exerciseId: string,
  programsAsc: Program[],
  exerciseTests: ExerciseTest[],
): ExerciseTest | null {
  const priorPrograms = programsAsc.filter(
    (p) => p.start_date < program.start_date || (p.start_date === program.start_date && p.created_at < program.created_at),
  )
  for (let i = priorPrograms.length - 1; i >= 0; i--) {
    const test = exerciseTests.find((t) => t.program_id === priorPrograms[i].id && t.exercise_id === exerciseId)
    if (test) return test
  }
  return null
}

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta == null) return <span className="text-xs text-text-muted">First test</span>
  if (delta === 0) return <span className="text-xs text-text-muted">No change</span>
  const up = delta > 0
  return (
    <span className={`flex items-center gap-0.5 text-xs font-medium ${up ? 'text-success' : 'text-danger'}`}>
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {up ? '+' : ''}
      {delta.toFixed(1)} lb
    </span>
  )
}

function TrendChart({ points }: { points: LiftPoint[] }) {
  const [selected, setSelected] = useState(points.length - 1)

  if (points.length === 0) {
    return <p className="py-8 text-center text-sm text-text-muted">No tests yet for this lift.</p>
  }

  if (points.length === 1) {
    return (
      <div className="py-6 text-center">
        <p className="text-3xl font-bold tabular-nums">{points[0].e1rm.toFixed(0)} lb</p>
        <p className="mt-1 text-sm text-text-muted">First tested block — log another to see a trend.</p>
      </div>
    )
  }

  const width = 320
  const height = 120
  const padX = 16
  const padY = 16
  const values = points.map((p) => p.e1rm)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const xStep = points.length > 1 ? (width - padX * 2) / (points.length - 1) : 0

  const coords = points.map((p, i) => ({
    x: padX + i * xStep,
    y: padY + (1 - (p.e1rm - min) / range) * (height - padY * 2),
    p,
  }))
  const pathD = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ')

  const selectedPoint = points[selected]
  const selectedIdx = Math.min(selected, points.length - 1)
  const prior = selectedIdx > 0 ? points[selectedIdx - 1].e1rm : null
  const delta = prior != null ? selectedPoint.e1rm - prior : null

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full touch-manipulation">
        <path d={pathD} fill="none" stroke="var(--color-text-muted)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {coords.map((c, i) => (
          <g key={c.p.program.id}>
            <circle cx={c.x} cy={c.y} r={12} fill="transparent" onClick={() => setSelected(i)} className="cursor-pointer" />
            <circle
              cx={c.x}
              cy={c.y}
              r={i === selectedIdx ? 5 : 3.5}
              fill={i === selectedIdx ? 'var(--color-success)' : 'var(--color-text)'}
              onClick={() => setSelected(i)}
              className="cursor-pointer"
            />
          </g>
        ))}
      </svg>
      <div className="mt-1 flex items-baseline justify-between">
        <div>
          <p className="text-2xl font-bold tabular-nums">{selectedPoint.e1rm.toFixed(0)} lb</p>
          <p className="text-xs text-text-muted">{formatDate(selectedPoint.program.start_date)}</p>
        </div>
        <DeltaBadge delta={delta} />
      </div>
    </div>
  )
}

export function History({
  programs,
  exerciseTests,
  testableExercises,
  onSaved,
}: {
  programs: Program[]
  exerciseTests: ExerciseTest[]
  testableExercises: Exercise[]
  onSaved: () => void
}) {
  const [selectedExerciseId, setSelectedExerciseId] = useState(testableExercises[0]?.id ?? null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleDeleteProgram(program: Program) {
    if (
      !confirm(
        `Delete the block started ${formatDate(program.start_date)}? This permanently deletes its tests, weekly targets, and every logged set from it.`,
      )
    ) {
      return
    }
    setDeletingId(program.id)
    setError(null)
    try {
      await deleteProgram(program.id)
      onSaved()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setDeletingId(null)
    }
  }

  const points: LiftPoint[] = useMemo(() => {
    if (!selectedExerciseId) return []
    return programs
      .map((program) => {
        const test = exerciseTests.find((t) => t.program_id === program.id && t.exercise_id === selectedExerciseId)
        return test?.computed_e1rm != null ? { program, e1rm: test.computed_e1rm } : null
      })
      .filter((pt): pt is LiftPoint => pt !== null)
  }, [programs, exerciseTests, selectedExerciseId])

  const overviewRows = useMemo(() => {
    return [...programs].reverse().map((program) => {
      const tests = exerciseTests.filter((t) => t.program_id === program.id && t.computed_e1rm != null)
      const lifts = tests.map((t) => {
        const exercise = testableExercises.find((e) => e.id === t.exercise_id)
        const prior = priorTestFor(program, t.exercise_id, programs, exerciseTests)
        return {
          name: exercise?.name ?? 'Unknown',
          e1rm: t.computed_e1rm!,
          delta: prior?.computed_e1rm != null ? t.computed_e1rm! - prior.computed_e1rm : null,
          source: describeTest(t),
        }
      })
      return { program, lifts }
    })
  }, [programs, exerciseTests, testableExercises])

  return (
    <div className="page-enter mx-auto max-w-md space-y-6 p-4 pb-24">
      <h1 className="text-2xl font-bold tracking-tight">History</h1>

      {testableExercises.length === 0 ? (
        <p className="text-text-muted">No tested exercises yet.</p>
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto">
            {testableExercises.map((e) => (
              <button
                key={e.id}
                onClick={() => setSelectedExerciseId(e.id)}
                className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-medium transition-transform active:scale-95 ${
                  e.id === selectedExerciseId ? 'bg-text text-bg' : 'bg-surface-2 text-text-muted'
                }`}
              >
                {e.name}
              </button>
            ))}
          </div>

          <div className="rounded-xl bg-surface p-4">
            <TrendChart points={points} />
          </div>
        </>
      )}

      <div className="space-y-2">
        <p className="text-sm font-medium text-text-muted">Past blocks</p>
        {error && <p className="text-sm text-danger">{error}</p>}
        {overviewRows.length === 0 ? (
          <p className="text-text-muted">No blocks tested yet — create one from Home.</p>
        ) : (
          overviewRows.map(({ program, lifts }) => (
            <div key={program.id} className="space-y-2 rounded-xl bg-surface p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-text-muted">Started {formatDate(program.start_date)}</p>
                <button
                  onClick={() => handleDeleteProgram(program)}
                  disabled={deletingId === program.id}
                  aria-label={`Delete block started ${formatDate(program.start_date)}`}
                  className="-m-1.5 flex h-8 w-8 shrink-0 items-center justify-center text-text-muted hover:text-danger disabled:opacity-40"
                >
                  ✕
                </button>
              </div>
              {lifts.length === 0 ? (
                <p className="text-sm text-text-muted">No lifts tested this block.</p>
              ) : (
                <div className="divide-y divide-border">
                  {lifts.map((lift, i) => (
                    <div key={i} className="flex items-center justify-between py-2">
                      <div>
                        <div className="font-medium">{lift.name}</div>
                        <div className="text-xs text-text-muted">{lift.source}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="tabular-nums text-text">{lift.e1rm.toFixed(0)} lb</span>
                        <DeltaBadge delta={lift.delta} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
