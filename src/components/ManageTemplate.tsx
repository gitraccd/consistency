import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, Pencil, Plus } from 'lucide-react'
import {
  createDay,
  createDayExercise,
  createExercise,
  createSetGroup,
  deleteDay,
  deleteDayExercise,
  deleteExercise,
  deleteSetGroup,
  errorMessage,
  fetchAllDataForExport,
  fetchAllExercises,
  fetchTemplate,
  updateDay,
  updateDayExerciseOrder,
  updateExercise,
  updateSetGroup,
  type DayExerciseWithDetails,
  type DayWithExercises,
  type Exercise,
  type SetGroup,
  type SetGroupInput,
} from '../lib/api'
import { supabase } from '../lib/supabase'

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

type ExerciseKind = 'tested' | 'borrows' | 'freeform'

function kindOf(exercise: Exercise): ExerciseKind {
  if (exercise.requires_test) return 'tested'
  if (exercise.e1rm_source_exercise_id) return 'borrows'
  return 'freeform'
}

function exerciseBadge(exercise: Exercise, exercises: Exercise[]): string {
  switch (kindOf(exercise)) {
    case 'tested':
      return 'Tested'
    case 'borrows':
      return `Borrows from ${exercises.find((e) => e.id === exercise.e1rm_source_exercise_id)?.name ?? '?'}`
    case 'freeform':
      return 'Freeform'
  }
}

function setGroupSummary(sg: SetGroup): string {
  const scheme = sg.num_sets > 0 ? `${sg.num_sets}x${sg.reps}` : 'freeform log'
  const rest = sg.rest_seconds != null ? ` · ${sg.rest_seconds}s rest` : ''
  if (sg.is_freeform || sg.week1_percentage == null) return `${scheme}${rest}`
  return `${scheme} · week 1 @ ${(sg.week1_percentage * 100).toFixed(2)}%${rest}`
}

function iconBtn(className = '') {
  return `-m-1.5 flex h-8 w-8 shrink-0 items-center justify-center text-text-muted ${className}`
}

export function ManageTemplate({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [template, setTemplate] = useState<DayWithExercises[] | null>(null)
  const [exercises, setExercises] = useState<Exercise[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [editingExerciseId, setEditingExerciseId] = useState<string | 'new' | null>(null)
  const [addingExerciseToDay, setAddingExerciseToDay] = useState<string | null>(null)
  const [addingDay, setAddingDay] = useState(false)
  const [editingSetGroup, setEditingSetGroup] = useState<{ dayExerciseId: string; setGroup: SetGroup | null } | null>(
    null,
  )
  const [exporting, setExporting] = useState(false)

  async function handleExport() {
    setExporting(true)
    setError(null)
    try {
      const data = await fetchAllDataForExport()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `consistency-export-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setExporting(false)
    }
  }

  async function reload() {
    const [t, ex] = await Promise.all([fetchTemplate(), fetchAllExercises()])
    setTemplate(t)
    setExercises(ex)
  }

  useEffect(() => {
    reload().catch((e) => setError(errorMessage(e)))
  }, [])

  async function afterSave(closeForm?: () => void) {
    try {
      await reload()
      onSaved()
      closeForm?.()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  async function runMutation(fn: () => Promise<void>, closeForm?: () => void) {
    setBusy(true)
    setError(null)
    try {
      await fn()
      await afterSave(closeForm)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  if (!template || !exercises) {
    return (
      <div className="page-enter mx-auto max-w-md space-y-4 p-4 pb-24">
        <p className="text-text-muted">Loading…</p>
      </div>
    )
  }

  return (
    <div className="page-enter mx-auto max-w-md space-y-6 p-4 pb-24">
      <div className="flex items-start justify-between">
        <h1 className="text-xl font-semibold">Manage Program</h1>
        <button
          onClick={onClose}
          aria-label="Close"
          className="-m-2.5 flex h-11 w-11 shrink-0 items-center justify-center text-text-muted"
        >
          ✕
        </button>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-text-muted">Exercises</h2>
        <div className="space-y-2 rounded-xl bg-surface p-3">
          {exercises.map((exercise) =>
            editingExerciseId === exercise.id ? (
              <ExerciseForm
                key={exercise.id}
                exercises={exercises}
                initial={exercise}
                busy={busy}
                onCancel={() => setEditingExerciseId(null)}
                onSubmit={(input) =>
                  runMutation(() => updateExercise(exercise.id, input), () => setEditingExerciseId(null))
                }
              />
            ) : (
              <div key={exercise.id} className="flex items-center justify-between gap-2 py-1">
                <div className="min-w-0">
                  <div className="font-medium">{exercise.name}</div>
                  <div className="text-xs text-text-muted">{exerciseBadge(exercise, exercises)}</div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => setEditingExerciseId(exercise.id)}
                    aria-label={`Edit ${exercise.name}`}
                    className={iconBtn()}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete ${exercise.name}? This fails if it's still used on any training day.`)) {
                        runMutation(() => deleteExercise(exercise.id))
                      }
                    }}
                    aria-label={`Delete ${exercise.name}`}
                    className={`${iconBtn()} hover:text-danger`}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ),
          )}

          {editingExerciseId === 'new' ? (
            <ExerciseForm
              exercises={exercises}
              initial={null}
              busy={busy}
              onCancel={() => setEditingExerciseId(null)}
              onSubmit={(input) => runMutation(() => createExercise(input).then(() => {}), () => setEditingExerciseId(null))}
            />
          ) : (
            <button
              onClick={() => setEditingExerciseId('new')}
              className="flex items-center gap-1.5 pt-1 text-sm text-text-muted"
            >
              <Plus className="h-4 w-4" /> Add exercise
            </button>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-text-muted">Training days</h2>

        {template.map((day) => (
          <DayCard
            key={day.id}
            day={day}
            usedWeekdays={template
              .filter((d) => d.id !== day.id)
              .map((d) => d.day_of_week)
              .filter((w): w is number => w != null)}
            exercises={exercises}
            busy={busy}
            addingExercise={addingExerciseToDay === day.id}
            onToggleAddExercise={() => setAddingExerciseToDay(addingExerciseToDay === day.id ? null : day.id)}
            onSaveDay={(input, closeForm) =>
              runMutation(() => updateDay(day.id, { ...input, sortOrder: day.sort_order }), closeForm)
            }
            onDeleteDay={() => {
              if (confirm(`Delete "${day.name}"? This removes every exercise and all logged history under it.`)) {
                runMutation(() => deleteDay(day.id))
              }
            }}
            onMoveDay={(direction) => {
              const sorted = [...template].sort((a, b) => a.sort_order - b.sort_order)
              const idx = sorted.findIndex((d) => d.id === day.id)
              const swapWith = sorted[idx + direction]
              if (!swapWith) return
              runMutation(async () => {
                await updateDay(day.id, {
                  name: day.name,
                  sortOrder: swapWith.sort_order,
                  dayOfWeek: day.day_of_week,
                })
                await updateDay(swapWith.id, {
                  name: swapWith.name,
                  sortOrder: day.sort_order,
                  dayOfWeek: swapWith.day_of_week,
                })
              })
            }}
            onAddExerciseToDay={(exerciseId) =>
              runMutation(
                () => createDayExercise(day.id, exerciseId, day.day_exercises.length).then(() => {}),
                () => setAddingExerciseToDay(null),
              )
            }
            onMoveDayExercise={(de, direction) => {
              const sorted = [...day.day_exercises].sort((a, b) => a.sort_order - b.sort_order)
              const idx = sorted.findIndex((x) => x.id === de.id)
              const swapWith = sorted[idx + direction]
              if (!swapWith) return
              runMutation(async () => {
                await updateDayExerciseOrder(de.id, swapWith.sort_order)
                await updateDayExerciseOrder(swapWith.id, de.sort_order)
              })
            }}
            onDeleteDayExercise={(de) => {
              if (
                confirm(
                  `Remove ${de.exercise.name} from ${day.name}? This deletes its set/rep schemes and all logged history for them.`,
                )
              ) {
                runMutation(() => deleteDayExercise(de.id))
              }
            }}
            onEditSetGroup={(dayExerciseId, sg) => setEditingSetGroup({ dayExerciseId, setGroup: sg })}
            onAddSetGroup={(dayExerciseId) => setEditingSetGroup({ dayExerciseId, setGroup: null })}
            onDeleteSetGroup={(sg) => {
              if (confirm('Delete this set/rep scheme? This deletes all logged history tied to it, in every program.')) {
                runMutation(() => deleteSetGroup(sg.id))
              }
            }}
          />
        ))}

        {addingDay ? (
          <DayForm
            busy={busy}
            usedWeekdays={template.map((d) => d.day_of_week).filter((w): w is number => w != null)}
            onCancel={() => setAddingDay(false)}
            onSubmit={(input) =>
              runMutation(() => createDay({ ...input, sortOrder: template.length }).then(() => {}), () =>
                setAddingDay(false),
              )
            }
          />
        ) : (
          <button onClick={() => setAddingDay(true)} className="flex items-center gap-1.5 text-sm text-text-muted">
            <Plus className="h-4 w-4" /> Add day
          </button>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-text-muted">Data</h2>
        <div className="rounded-xl bg-surface p-4">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="w-full rounded-lg bg-surface-2 py-2.5 text-sm font-medium text-text disabled:opacity-40"
          >
            {exporting ? 'Exporting…' : 'Export all data (JSON)'}
          </button>
          <p className="mt-2 text-xs text-text-muted">
            Everything in the database -- exercises, days, programs, tests, targets, logged sets, nutrition -- as one
            file you keep yourself.
          </p>
          <button
            onClick={() => supabase.auth.signOut()}
            className="mt-3 w-full rounded-lg bg-surface-2 py-2.5 text-sm font-medium text-danger"
          >
            Sign out
          </button>
        </div>
      </section>

      {editingSetGroup && (
        <SetGroupSheet
          dayExerciseId={editingSetGroup.dayExerciseId}
          setGroup={editingSetGroup.setGroup}
          nextSortOrder={
            template.flatMap((d) => d.day_exercises).find((de) => de.id === editingSetGroup.dayExerciseId)
              ?.set_groups.length ?? 0
          }
          busy={busy}
          onClose={() => setEditingSetGroup(null)}
          onSubmit={(input) =>
            runMutation(
              () =>
                editingSetGroup.setGroup
                  ? updateSetGroup(editingSetGroup.setGroup.id, input)
                  : createSetGroup(input).then(() => {}),
              () => setEditingSetGroup(null),
            )
          }
        />
      )}
    </div>
  )
}

function ExerciseForm({
  exercises,
  initial,
  busy,
  onCancel,
  onSubmit,
}: {
  exercises: Exercise[]
  initial: Exercise | null
  busy: boolean
  onCancel: () => void
  onSubmit: (input: { name: string; requiresTest: boolean; e1rmSourceExerciseId: string | null }) => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [kind, setKind] = useState<ExerciseKind>(initial ? kindOf(initial) : 'freeform')
  const [sourceId, setSourceId] = useState(initial?.e1rm_source_exercise_id ?? '')

  const testable = exercises.filter((e) => e.requires_test && e.id !== initial?.id)
  const valid = name.trim() !== '' && (kind !== 'borrows' || sourceId !== '')

  return (
    <div className="space-y-2 rounded-lg bg-surface-2/60 p-3">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Exercise name"
        className="w-full rounded-lg bg-surface-2 px-3 py-2"
      />
      <select value={kind} onChange={(e) => setKind(e.target.value as ExerciseKind)} className="w-full rounded-lg bg-surface-2 px-3 py-2">
        <option value="tested">Tracks its own E1RM test</option>
        <option value="borrows">Borrows E1RM from another exercise</option>
        <option value="freeform">No E1RM (freeform only)</option>
      </select>
      {kind === 'borrows' && (
        <select value={sourceId} onChange={(e) => setSourceId(e.target.value)} className="w-full rounded-lg bg-surface-2 px-3 py-2">
          <option value="">Select exercise…</option>
          {testable.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      )}
      <div className="flex gap-2">
        <button
          onClick={() =>
            onSubmit({ name: name.trim(), requiresTest: kind === 'tested', e1rmSourceExerciseId: kind === 'borrows' ? sourceId : null })
          }
          disabled={!valid || busy}
          className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-text disabled:opacity-40"
        >
          Save
        </button>
        <button onClick={onCancel} className="text-sm text-text-muted">
          Cancel
        </button>
      </div>
    </div>
  )
}

function DayForm({
  busy,
  initial,
  usedWeekdays,
  onCancel,
  onSubmit,
}: {
  busy: boolean
  initial?: { name: string; dayOfWeek: number | null }
  usedWeekdays: number[]
  onCancel: () => void
  onSubmit: (input: { name: string; dayOfWeek: number | null }) => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [dayOfWeek, setDayOfWeek] = useState(initial?.dayOfWeek != null ? String(initial.dayOfWeek) : '')
  const collision = dayOfWeek !== '' && usedWeekdays.includes(Number(dayOfWeek))

  return (
    <div className="space-y-2 rounded-lg bg-surface-2/60 p-3">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Day name"
        className="w-full rounded-lg bg-surface-2 px-3 py-2"
      />
      <select value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value)} className="w-full rounded-lg bg-surface-2 px-3 py-2">
        <option value="">No fixed day</option>
        {WEEKDAYS.map((w, i) => (
          <option key={i} value={i}>
            {w}
          </option>
        ))}
      </select>
      {collision && (
        <p className="text-xs text-danger">
          Another day is already set to {WEEKDAYS[Number(dayOfWeek)]} — only one of them will ever show as "today".
        </p>
      )}
      <div className="flex gap-2">
        <button
          onClick={() => onSubmit({ name: name.trim(), dayOfWeek: dayOfWeek === '' ? null : Number(dayOfWeek) })}
          disabled={name.trim() === '' || busy}
          className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-text disabled:opacity-40"
        >
          Save
        </button>
        <button onClick={onCancel} className="text-sm text-text-muted">
          Cancel
        </button>
      </div>
    </div>
  )
}

function DayCard({
  day,
  usedWeekdays,
  exercises,
  busy,
  addingExercise,
  onToggleAddExercise,
  onSaveDay,
  onDeleteDay,
  onMoveDay,
  onAddExerciseToDay,
  onMoveDayExercise,
  onDeleteDayExercise,
  onEditSetGroup,
  onAddSetGroup,
  onDeleteSetGroup,
}: {
  day: DayWithExercises
  usedWeekdays: number[]
  exercises: Exercise[]
  busy: boolean
  addingExercise: boolean
  onToggleAddExercise: () => void
  onSaveDay: (input: { name: string; dayOfWeek: number | null }, closeForm: () => void) => void
  onDeleteDay: () => void
  onMoveDay: (direction: -1 | 1) => void
  onAddExerciseToDay: (exerciseId: string) => void
  onMoveDayExercise: (de: DayExerciseWithDetails, direction: -1 | 1) => void
  onDeleteDayExercise: (de: DayExerciseWithDetails) => void
  onEditSetGroup: (dayExerciseId: string, sg: SetGroup) => void
  onAddSetGroup: (dayExerciseId: string) => void
  onDeleteSetGroup: (sg: SetGroup) => void
}) {
  const [editing, setEditing] = useState(false)
  const [pickExerciseId, setPickExerciseId] = useState('')
  const availableToAdd = exercises.filter((e) => !day.day_exercises.some((de) => de.exercise.id === e.id))
  const sortedDayExercises = [...day.day_exercises].sort((a, b) => a.sort_order - b.sort_order)

  return (
    <div className="space-y-3 rounded-xl bg-surface p-4">
      {editing ? (
        <DayForm
          busy={busy}
          initial={{ name: day.name, dayOfWeek: day.day_of_week }}
          usedWeekdays={usedWeekdays}
          onCancel={() => setEditing(false)}
          onSubmit={(input) => onSaveDay(input, () => setEditing(false))}
        />
      ) : (
        <div className="flex items-start justify-between">
          <div>
            <div className="font-medium">{day.name}</div>
            <div className="text-xs text-text-muted">
              {day.day_of_week != null ? WEEKDAYS[day.day_of_week] : 'No fixed day'}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button onClick={() => onMoveDay(-1)} aria-label={`Move ${day.name} up`} className={iconBtn()}>
              <ChevronUp className="h-4 w-4" />
            </button>
            <button onClick={() => onMoveDay(1)} aria-label={`Move ${day.name} down`} className={iconBtn()}>
              <ChevronDown className="h-4 w-4" />
            </button>
            <button onClick={() => setEditing(true)} aria-label={`Edit ${day.name}`} className={iconBtn()}>
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button onClick={onDeleteDay} aria-label={`Delete ${day.name}`} className={`${iconBtn()} hover:text-danger`}>
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2 divide-y divide-border">
        {sortedDayExercises.map((de) => (
          <div key={de.id} className="space-y-1.5 pt-2 first:pt-0">
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium">{de.exercise.name}</div>
              <div className="flex shrink-0 items-center gap-1">
                <button onClick={() => onMoveDayExercise(de, -1)} aria-label={`Move ${de.exercise.name} up`} className={iconBtn()}>
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => onMoveDayExercise(de, 1)} aria-label={`Move ${de.exercise.name} down`} className={iconBtn()}>
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => onDeleteDayExercise(de)}
                  aria-label={`Remove ${de.exercise.name} from ${day.name}`}
                  className={`${iconBtn()} hover:text-danger`}
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="space-y-1 pl-1">
              {de.set_groups
                .slice()
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((sg) => (
                  <div key={sg.id} className="flex items-center justify-between gap-2 text-sm text-text-muted">
                    <button onClick={() => onEditSetGroup(de.id, sg)} className="min-w-0 flex-1 truncate text-left">
                      {setGroupSummary(sg)}
                      {sg.intensity_note ? ` · ${sg.intensity_note}` : ''}
                    </button>
                    <button onClick={() => onDeleteSetGroup(sg)} aria-label="Delete set/rep scheme" className={`${iconBtn()} hover:text-danger`}>
                      ✕
                    </button>
                  </div>
                ))}
              <button onClick={() => onAddSetGroup(de.id)} className="flex items-center gap-1 text-xs text-text-muted">
                <Plus className="h-3 w-3" /> Add set/rep scheme
              </button>
            </div>
          </div>
        ))}
      </div>

      {addingExercise ? (
        <div className="flex items-center gap-2">
          <select
            value={pickExerciseId}
            onChange={(e) => setPickExerciseId(e.target.value)}
            className="flex-1 rounded-lg bg-surface-2 px-3 py-2 text-sm"
          >
            <option value="">Select exercise…</option>
            {availableToAdd.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => pickExerciseId && onAddExerciseToDay(pickExerciseId)}
            disabled={!pickExerciseId || busy}
            className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-text disabled:opacity-40"
          >
            Add
          </button>
          <button onClick={onToggleAddExercise} className="text-sm text-text-muted">
            Cancel
          </button>
        </div>
      ) : (
        <button onClick={onToggleAddExercise} className="flex items-center gap-1.5 text-sm text-text-muted">
          <Plus className="h-4 w-4" /> Add exercise to this day
        </button>
      )}
    </div>
  )
}

function SetGroupSheet({
  dayExerciseId,
  setGroup,
  nextSortOrder,
  busy,
  onClose,
  onSubmit,
}: {
  dayExerciseId: string
  setGroup: SetGroup | null
  nextSortOrder: number
  busy: boolean
  onClose: () => void
  onSubmit: (input: SetGroupInput) => void
}) {
  const [reps, setReps] = useState(setGroup ? String(setGroup.reps) : '')
  const [numSets, setNumSets] = useState(setGroup ? String(setGroup.num_sets) : '')
  const [intensityNote, setIntensityNote] = useState(setGroup?.intensity_note ?? '')
  const [isFreeform, setIsFreeform] = useState(setGroup?.is_freeform ?? true)
  const [week1Percentage, setWeek1Percentage] = useState(
    setGroup?.week1_percentage != null ? String(setGroup.week1_percentage * 100) : '',
  )
  const [increments, setIncrements] = useState<[string, string, string, string]>(
    setGroup?.increments ? (setGroup.increments.map(String) as [string, string, string, string]) : ['', '', '', ''],
  )
  const [restSeconds, setRestSeconds] = useState(setGroup?.rest_seconds != null ? String(setGroup.rest_seconds) : '')

  const valid =
    reps !== '' &&
    numSets !== '' &&
    (isFreeform || (week1Percentage !== '' && increments.every((i) => i !== '')))

  function handleSubmit() {
    if (!valid) return
    onSubmit({
      dayExerciseId,
      reps: Number(reps),
      numSets: Number(numSets),
      isFreeform,
      intensityNote: intensityNote.trim() === '' ? null : intensityNote.trim(),
      week1Percentage: isFreeform ? null : Number(week1Percentage) / 100,
      increments: isFreeform ? null : (increments.map(Number) as [number, number, number, number]),
      sortOrder: setGroup?.sort_order ?? nextSortOrder,
      restSeconds: restSeconds === '' ? null : Number(restSeconds),
    })
  }

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-sm space-y-3 rounded-t-2xl bg-surface p-4 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <h2 className="font-semibold">{setGroup ? 'Edit set/rep scheme' : 'New set/rep scheme'}</h2>
          <button onClick={onClose} aria-label="Close" className="-m-2.5 flex h-11 w-11 shrink-0 items-center justify-center text-text-muted">
            ✕
          </button>
        </div>

        <div className="flex gap-2">
          <label className="flex-1 space-y-1">
            <span className="text-sm text-text-muted">Sets</span>
            <input
              type="number"
              inputMode="numeric"
              value={numSets}
              onChange={(e) => setNumSets(e.target.value)}
              className="w-full rounded-lg bg-surface-2 px-3 py-2"
            />
          </label>
          <label className="flex-1 space-y-1">
            <span className="text-sm text-text-muted">Reps</span>
            <input
              type="number"
              inputMode="numeric"
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              className="w-full rounded-lg bg-surface-2 px-3 py-2"
            />
          </label>
        </div>

        <label className="block space-y-1">
          <span className="text-sm text-text-muted">Note (optional)</span>
          <input
            value={intensityNote}
            onChange={(e) => setIntensityNote(e.target.value)}
            className="w-full rounded-lg bg-surface-2 px-3 py-2"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm text-text-muted">Rest timer override, seconds (optional -- defaults to 120s)</span>
          <input
            type="number"
            inputMode="numeric"
            value={restSeconds}
            onChange={(e) => setRestSeconds(e.target.value)}
            placeholder="120"
            className="w-full rounded-lg bg-surface-2 px-3 py-2"
          />
        </label>

        <label className="flex items-center gap-2 text-sm text-text-muted">
          <input type="checkbox" checked={isFreeform} onChange={(e) => setIsFreeform(e.target.checked)} />
          Freeform (no computed weight target)
        </label>

        {!isFreeform && (
          <>
            <label className="block space-y-1">
              <span className="text-sm text-text-muted">Week 1 target (% of E1RM)</span>
              <input
                type="number"
                inputMode="decimal"
                value={week1Percentage}
                onChange={(e) => setWeek1Percentage(e.target.value)}
                placeholder="e.g. 81.25"
                className="w-full rounded-lg bg-surface-2 px-3 py-2"
              />
            </label>
            <div className="space-y-1">
              <span className="text-sm text-text-muted">Weekly increments (lb added, weeks 2-5)</span>
              <div className="flex gap-2">
                {increments.map((val, i) => (
                  <input
                    key={i}
                    type="number"
                    inputMode="decimal"
                    value={val}
                    onChange={(e) =>
                      setIncrements((prev) => {
                        const next = [...prev] as [string, string, string, string]
                        next[i] = e.target.value
                        return next
                      })
                    }
                    className="w-full min-w-0 rounded-lg bg-surface-2 px-2 py-2 text-center"
                  />
                ))}
              </div>
            </div>
          </>
        )}

        <button
          onClick={handleSubmit}
          disabled={!valid || busy}
          className="w-full rounded-xl bg-accent py-3 font-medium text-accent-text transition-transform active:scale-[0.98] disabled:opacity-40"
        >
          Save
        </button>
      </div>
    </div>
  )
}
