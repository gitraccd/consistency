import { supabase } from './supabase'
import {
  CALIBRATION_TRUST_THRESHOLD,
  computeWeeklyTargets,
  resolveExerciseE1RM,
  rpeBased1RM,
  updateCorrectionFactor,
  type ExerciseTestInput,
  type TargetWeek,
} from './calc'
import type { Database, WeeklyPlanEntry } from './database.types'

/**
 * Supabase/Postgrest errors are plain objects with a .message string, NOT
 * instances of the JS Error class -- `e instanceof Error ? e.message :
 * String(e)` silently collapses them to the useless "[object Object]".
 * Use this everywhere a caught error gets shown to the user instead.
 */
export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === 'object' && e !== null && 'message' in e && typeof (e as { message: unknown }).message === 'string') {
    return (e as { message: string }).message
  }
  return String(e)
}

export type Exercise = Database['public']['Tables']['exercises']['Row']
export type Day = Database['public']['Tables']['days']['Row']
export type SetGroup = Database['public']['Tables']['set_groups']['Row']
export type Program = Database['public']['Tables']['programs']['Row']
export type WeeklyTarget = Database['public']['Tables']['weekly_targets']['Row']
export type LoggedSet = Database['public']['Tables']['logged_sets']['Row']
export type Calibration = Database['public']['Tables']['calibrations']['Row']
export type NutritionLog = Database['public']['Tables']['nutrition_logs']['Row']
export type NutritionGoal = Database['public']['Tables']['nutrition_goals']['Row']
export type ExerciseTest = Database['public']['Tables']['exercise_tests']['Row']
export type DayExercise = Database['public']['Tables']['day_exercises']['Row']

export interface DayExerciseWithDetails {
  id: string
  sort_order: number
  exercise: Exercise
  set_groups: SetGroup[]
}

export interface DayWithExercises extends Day {
  day_exercises: DayExerciseWithDetails[]
}

/** The fixed Day > Exercise > SetGroup template every block reuses. */
export async function fetchTemplate(): Promise<DayWithExercises[]> {
  const { data, error } = await supabase
    .from('days')
    .select('*, day_exercises(id, sort_order, exercise:exercises(*), set_groups(*))')
    .order('sort_order')
  if (error) throw error

  const days = data as unknown as DayWithExercises[]
  for (const day of days) {
    day.day_exercises.sort((a, b) => a.sort_order - b.sort_order)
    for (const de of day.day_exercises) {
      de.set_groups.sort((a, b) => a.sort_order - b.sort_order)
    }
  }
  return days
}

export async function fetchTestableExercises(): Promise<Exercise[]> {
  const { data, error } = await supabase.from('exercises').select('*').eq('requires_test', true)
  if (error) throw error
  return data
}

/** Every exercise in the catalog, tested or not -- for the Manage Program editor. */
export async function fetchAllExercises(): Promise<Exercise[]> {
  const { data, error } = await supabase.from('exercises').select('*').order('name')
  if (error) throw error
  return data
}

export interface ExerciseInput {
  name: string
  requiresTest: boolean
  e1rmSourceExerciseId: string | null
}

/**
 * Ensures a calibrations row exists for a requires_test exercise. The SQL
 * seed always pairs these (`insert into calibrations select id from
 * exercises where requires_test = true`) -- this keeps that invariant true
 * for exercises created/edited through the app too, since updateCalibration
 * (triggered by any RPE-tagged logged set) assumes the row exists and
 * throws via `.single()` if it doesn't.
 */
async function ensureCalibration(exerciseId: string): Promise<void> {
  const { data: existing, error: fetchError } = await supabase
    .from('calibrations')
    .select('id')
    .eq('exercise_id', exerciseId)
    .maybeSingle()
  if (fetchError) throw fetchError
  if (existing) return
  const { error: insertError } = await supabase.from('calibrations').insert({ exercise_id: exerciseId })
  if (insertError) throw insertError
}

export async function createExercise(input: ExerciseInput): Promise<Exercise> {
  const { data, error } = await supabase
    .from('exercises')
    .insert({
      name: input.name,
      requires_test: input.requiresTest,
      e1rm_source_exercise_id: input.e1rmSourceExerciseId,
    })
    .select()
    .single()
  if (error) throw error
  if (input.requiresTest) await ensureCalibration(data.id)
  return data
}

export async function updateExercise(id: string, input: ExerciseInput): Promise<void> {
  const { error } = await supabase
    .from('exercises')
    .update({
      name: input.name,
      requires_test: input.requiresTest,
      e1rm_source_exercise_id: input.e1rmSourceExerciseId,
    })
    .eq('id', id)
  if (error) throw error
  if (input.requiresTest) await ensureCalibration(id)
}

/**
 * Fails with a FK violation if anything still references this exercise:
 * a day_exercise, its own calibrations row (tested exercises always have
 * one), an exercise_tests row from a past program, or another exercise's
 * e1rm_source_exercise_id (a variant borrowing its E1RM).
 */
export async function deleteExercise(id: string): Promise<void> {
  const { error } = await supabase.from('exercises').delete().eq('id', id)
  if (error) throw error
}

export interface DayInput {
  name: string
  sortOrder: number
  dayOfWeek: number | null
}

export async function createDay(input: DayInput): Promise<Day> {
  const { data, error } = await supabase
    .from('days')
    .insert({ name: input.name, sort_order: input.sortOrder, day_of_week: input.dayOfWeek })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateDay(id: string, input: DayInput): Promise<void> {
  const { error } = await supabase
    .from('days')
    .update({ name: input.name, sort_order: input.sortOrder, day_of_week: input.dayOfWeek })
    .eq('id', id)
  if (error) throw error
}

/** Cascades through day_exercises -> set_groups -> weekly_targets/logged_sets. Destructive. */
export async function deleteDay(id: string): Promise<void> {
  const { error } = await supabase.from('days').delete().eq('id', id)
  if (error) throw error
}

export async function createDayExercise(dayId: string, exerciseId: string, sortOrder: number): Promise<DayExercise> {
  const { data, error } = await supabase
    .from('day_exercises')
    .insert({ day_id: dayId, exercise_id: exerciseId, sort_order: sortOrder })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateDayExerciseOrder(id: string, sortOrder: number): Promise<void> {
  const { error } = await supabase.from('day_exercises').update({ sort_order: sortOrder }).eq('id', id)
  if (error) throw error
}

/** Cascades through set_groups -> weekly_targets/logged_sets for this one day_exercise. Destructive. */
export async function deleteDayExercise(id: string): Promise<void> {
  const { error } = await supabase.from('day_exercises').delete().eq('id', id)
  if (error) throw error
}

export interface SetGroupInput {
  dayExerciseId: string
  reps: number
  numSets: number
  isFreeform: boolean
  intensityNote: string | null
  week1Percentage: number | null
  increments: [number, number, number, number] | null
  sortOrder: number
  /** Rest-timer override in seconds; null = use the app-wide default. */
  restSeconds: number | null
  /** RPE-autoregulated alternative to week1Percentage/increments -- not exposed in Manage Program's UI (see ManageTemplate.tsx), but bootstrapStarterTemplate uses it. Omit for the common case. */
  weeklyPlan?: WeeklyPlanEntry[] | null
}

export async function createSetGroup(input: SetGroupInput): Promise<SetGroup> {
  const { data, error } = await supabase
    .from('set_groups')
    .insert({
      day_exercise_id: input.dayExerciseId,
      reps: input.reps,
      num_sets: input.numSets,
      is_freeform: input.isFreeform,
      intensity_note: input.intensityNote,
      week1_percentage: input.week1Percentage,
      increments: input.increments,
      sort_order: input.sortOrder,
      rest_seconds: input.restSeconds,
      weekly_plan: input.weeklyPlan ?? null,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * Edits a set-group's fields in place -- the row's id is unchanged, so any
 * weekly_targets/logged_sets rows already referencing it stay intact. Prefer
 * this over delete+recreate, which silently wipes that lift's history.
 */
export async function updateSetGroup(id: string, input: SetGroupInput): Promise<void> {
  const { error } = await supabase
    .from('set_groups')
    .update({
      reps: input.reps,
      num_sets: input.numSets,
      is_freeform: input.isFreeform,
      intensity_note: input.intensityNote,
      week1_percentage: input.week1Percentage,
      increments: input.increments,
      sort_order: input.sortOrder,
      rest_seconds: input.restSeconds,
    })
    .eq('id', id)
  if (error) throw error
}

/** Cascades to this set-group's weekly_targets/logged_sets across every program, past and present. Destructive. */
export async function deleteSetGroup(id: string): Promise<void> {
  const { error } = await supabase.from('set_groups').delete().eq('id', id)
  if (error) throw error
}

/** Most recently started program, if any. */
export async function fetchLatestProgram(): Promise<Program | null> {
  const { data, error } = await supabase
    .from('programs')
    .select('*')
    .order('start_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

/** Every program ever created, oldest first -- for the History view's block list and E1RM trend. */
export async function fetchAllPrograms(): Promise<Program[]> {
  const { data, error } = await supabase
    .from('programs')
    .select('*')
    .order('start_date', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

/** Cascades to that program's exercise_tests/weekly_targets/logged_sets. Destructive -- for cleaning up a mistaken/test block. */
export async function deleteProgram(id: string): Promise<void> {
  const { error } = await supabase.from('programs').delete().eq('id', id)
  if (error) throw error
}

/** Every exercise_tests row ever recorded -- one per (program, tested exercise). Drives the History view. */
export async function fetchAllExerciseTests(): Promise<ExerciseTest[]> {
  const { data, error } = await supabase.from('exercise_tests').select('*')
  if (error) throw error
  return data
}

export async function fetchWeeklyTargets(programId: string): Promise<WeeklyTarget[]> {
  const { data, error } = await supabase.from('weekly_targets').select('*').eq('program_id', programId)
  if (error) throw error
  return data
}

/**
 * Overwrites a single week's computed target with a hand-entered weight --
 * lets a bad E1RM test or a mid-block adjustment be corrected from the
 * app itself instead of editing the weekly_targets row in Supabase directly.
 * Week 6 (deload) and freeform set-groups have no target row, so callers
 * must not offer this for those.
 */
export async function upsertWeeklyTarget(
  programId: string,
  setGroupId: string,
  week: TargetWeek,
  weight: number,
): Promise<void> {
  const { error } = await supabase
    .from('weekly_targets')
    .upsert(
      { program_id: programId, set_group_id: setGroupId, week_number: week, target_weight: weight },
      { onConflict: 'program_id,set_group_id,week_number' },
    )
  if (error) throw error
}

export async function fetchLoggedSets(programId: string): Promise<LoggedSet[]> {
  const { data, error } = await supabase
    .from('logged_sets')
    .select('*')
    .eq('program_id', programId)
    .order('logged_at', { ascending: false })
  if (error) throw error
  return data
}

export async function insertLoggedSet(input: {
  programId: string
  setGroupId: string
  weekNumber: number
  weight: number
  reps: number
  rpe: number | null
  isMaxEffort: boolean
}): Promise<LoggedSet> {
  const { data, error } = await supabase
    .from('logged_sets')
    .insert({
      program_id: input.programId,
      set_group_id: input.setGroupId,
      week_number: input.weekNumber,
      weight: input.weight,
      reps: input.reps,
      rpe: input.rpe,
      is_max_effort: input.isMaxEffort,
    })
    .select()
    .single()
  if (error) throw error

  const effectiveRpe = input.rpe ?? (input.isMaxEffort ? 10 : null)
  if (effectiveRpe != null) {
    await updateCalibration(input.programId, input.setGroupId, input.weight, input.reps, effectiveRpe)
  }

  return data
}

/** Deletes a logged set. Does not reverse any calibration update it may have triggered. */
export async function deleteLoggedSet(id: string): Promise<void> {
  const { error } = await supabase.from('logged_sets').delete().eq('id', id)
  if (error) throw error
}

interface SetGroupWithExercise {
  day_exercise: {
    exercise: Pick<Exercise, 'id' | 'requires_test'>
  }
}

/**
 * Nudges the logged set-group's exercise calibration toward this set's
 * implied E1RM via an EMA, but only for sets logged directly against a
 * requires_test exercise (not variants like Paused Bench) -- variants have a
 * different strength curve and shouldn't be conflated with the source lift.
 */
async function updateCalibration(
  programId: string,
  setGroupId: string,
  weight: number,
  reps: number,
  rpe: number,
): Promise<void> {
  const { data: setGroup, error: setGroupError } = await supabase
    .from('set_groups')
    .select('day_exercise:day_exercises(exercise:exercises(id, requires_test))')
    .eq('id', setGroupId)
    .single()
  if (setGroupError) throw setGroupError

  const exercise = (setGroup as unknown as SetGroupWithExercise).day_exercise.exercise
  if (!exercise.requires_test) return

  const { data: test, error: testError } = await supabase
    .from('exercise_tests')
    .select('computed_e1rm')
    .eq('program_id', programId)
    .eq('exercise_id', exercise.id)
    .maybeSingle()
  if (testError) throw testError
  if (!test || test.computed_e1rm == null) return

  const { data: calibration, error: calibrationError } = await supabase
    .from('calibrations')
    .select('*')
    .eq('exercise_id', exercise.id)
    .single()
  if (calibrationError) throw calibrationError

  const impliedE1rm = rpeBased1RM(weight, reps, rpe)
  const newRatio = impliedE1rm / test.computed_e1rm
  const newFactor = updateCorrectionFactor(calibration.correction_factor, newRatio)

  const { error: updateError } = await supabase
    .from('calibrations')
    .update({ correction_factor: newFactor, data_point_count: calibration.data_point_count + 1, updated_at: new Date().toISOString() })
    .eq('exercise_id', exercise.id)
  if (updateError) throw updateError
}

export interface ExerciseTestPlan {
  exerciseId: string
  input: ExerciseTestInput
}

interface SetGroupWithSourceExercise extends SetGroup {
  day_exercise: {
    exercise: Pick<Exercise, 'id' | 'requires_test' | 'e1rm_source_exercise_id'>
  }
}

/**
 * Creates a program, resolves each tested exercise's E1RM, and generates
 * Weeks 1-5 weekly_targets for every non-freeform set_group derived from
 * that E1RM -- including set-groups belonging to a variant exercise (e.g.
 * "Paused Bench") that borrows another exercise's test via
 * e1rm_source_exercise_id. Week 6 (deload) gets no target row.
 */
export async function createProgram(startDate: string, plans: ExerciseTestPlan[]): Promise<Program> {
  const { data: program, error: programError } = await supabase
    .from('programs')
    .insert({ start_date: startDate })
    .select()
    .single()
  if (programError) throw programError

  const e1rmByExerciseId = new Map<string, number>()

  for (const plan of plans) {
    const computedE1rm = resolveExerciseE1RM(plan.input)

    const { error: testError } = await supabase.from('exercise_tests').insert({
      program_id: program.id,
      exercise_id: plan.exerciseId,
      mode: plan.input.mode,
      input_weight: plan.input.weight ?? null,
      input_reps: plan.input.reps ?? null,
      input_rpe: plan.input.rpe ?? null,
      manual_e1rm: plan.input.manualE1rm ?? null,
      computed_e1rm: computedE1rm,
    })
    if (testError) throw testError

    const { data: calibration, error: calibrationError } = await supabase
      .from('calibrations')
      .select('correction_factor, data_point_count')
      .eq('exercise_id', plan.exerciseId)
      .maybeSingle()
    if (calibrationError) throw calibrationError

    const appliedE1rm =
      calibration && calibration.data_point_count >= CALIBRATION_TRUST_THRESHOLD
        ? computedE1rm * calibration.correction_factor
        : computedE1rm
    e1rmByExerciseId.set(plan.exerciseId, appliedE1rm)
  }

  const { data: setGroups, error: sgError } = await supabase
    .from('set_groups')
    .select('*, day_exercise:day_exercises(exercise:exercises(id, requires_test, e1rm_source_exercise_id))')
  if (sgError) throw sgError

  const targetRows: Database['public']['Tables']['weekly_targets']['Insert'][] = []
  for (const sg of setGroups as unknown as SetGroupWithSourceExercise[]) {
    if (sg.is_freeform || sg.week1_percentage == null || sg.increments == null) continue

    const exercise = sg.day_exercise.exercise
    const sourceExerciseId = exercise.requires_test ? exercise.id : exercise.e1rm_source_exercise_id
    if (!sourceExerciseId) continue

    const e1rm = e1rmByExerciseId.get(sourceExerciseId)
    if (e1rm == null) continue

    const week1Weight = e1rm * sg.week1_percentage
    const targets = computeWeeklyTargets(week1Weight, sg.increments)
    for (const [week, weight] of Object.entries(targets)) {
      targetRows.push({
        program_id: program.id,
        set_group_id: sg.id,
        week_number: Number(week),
        target_weight: weight,
      })
    }
  }

  if (targetRows.length > 0) {
    const { error: targetsError } = await supabase.from('weekly_targets').insert(targetRows)
    if (targetsError) throw targetsError
  }

  return program
}

/** All nutrition_logs rows from sinceDate (inclusive) onward, most recent first. */
export async function fetchRecentNutritionLogs(sinceDate: string): Promise<NutritionLog[]> {
  const { data, error } = await supabase
    .from('nutrition_logs')
    .select('*')
    .gte('log_date', sinceDate)
    .order('logged_at', { ascending: false })
  if (error) throw error
  return data
}

/** Appends one meal/snack entry -- multiple per day accumulate into that day's total. */
export async function insertNutritionLog(input: {
  logDate: string
  label: string | null
  calories: number | null
  protein: number | null
}): Promise<NutritionLog> {
  const { data, error } = await supabase
    .from('nutrition_logs')
    .insert({ log_date: input.logDate, label: input.label, calories: input.calories, protein: input.protein })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteNutritionLog(id: string): Promise<void> {
  const { error } = await supabase.from('nutrition_logs').delete().eq('id', id)
  if (error) throw error
}

export async function updateNutritionLog(
  id: string,
  input: { label: string | null; calories: number | null; protein: number | null },
): Promise<void> {
  const { error } = await supabase
    .from('nutrition_logs')
    .update({ label: input.label, calories: input.calories, protein: input.protein })
    .eq('id', id)
  if (error) throw error
}

/** One row per user (RLS + the unique user_id constraint enforce that) -- no id filter needed, RLS already scopes this to the caller. */
export async function fetchNutritionGoal(): Promise<NutritionGoal | null> {
  const { data, error } = await supabase.from('nutrition_goals').select('*').maybeSingle()
  if (error) throw error
  return data
}

export async function upsertNutritionGoal(input: {
  calories: number | null
  protein: number | null
}): Promise<NutritionGoal> {
  const { data, error } = await supabase
    .from('nutrition_goals')
    .upsert(
      { calories: input.calories, protein: input.protein, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    )
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * Every row in the database, for a client-side backup export. There's no
 * server-side backup and RLS is wide open on just a publishable key (see
 * schema.sql's RLS note) -- this is the user's only way to get their own
 * data out independently of Supabase.
 */
export async function fetchAllDataForExport(): Promise<Record<string, unknown>> {
  const [
    exercises,
    days,
    dayExercises,
    setGroups,
    programs,
    exerciseTests,
    weeklyTargets,
    loggedSets,
    calibrations,
    nutritionLogs,
    nutritionGoal,
  ] = await Promise.all([
    supabase.from('exercises').select('*').then(unwrap),
    supabase.from('days').select('*').then(unwrap),
    supabase.from('day_exercises').select('*').then(unwrap),
    supabase.from('set_groups').select('*').then(unwrap),
    supabase.from('programs').select('*').then(unwrap),
    supabase.from('exercise_tests').select('*').then(unwrap),
    supabase.from('weekly_targets').select('*').then(unwrap),
    supabase.from('logged_sets').select('*').then(unwrap),
    supabase.from('calibrations').select('*').then(unwrap),
    supabase.from('nutrition_logs').select('*').then(unwrap),
    fetchNutritionGoal(),
  ])
  return {
    exportedAt: new Date().toISOString(),
    exercises,
    days,
    day_exercises: dayExercises,
    set_groups: setGroups,
    programs,
    exercise_tests: exerciseTests,
    weekly_targets: weeklyTargets,
    logged_sets: loggedSets,
    calibrations,
    nutrition_logs: nutritionLogs,
    nutrition_goal: nutritionGoal,
  }
}

function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw error
  return data as T
}

/**
 * Creates a starter program for a brand-new, empty account: the same
 * Squat/Bench/Deadlift/Weighted Pull-up/Weighted Dip setup Connor built by
 * hand, as an editable starting point (per-user now, not global -- see
 * schema.sql's RLS note). This is the ONE place that data lives; it used to
 * be schema.sql's seed inserts, moved here once exercises/days/set_groups
 * became per-user rows a plain SQL seed can't target.
 *
 * Idempotent for exercises/days: reuses an existing row by name instead of
 * inserting a duplicate, so retrying after a partial failure (this function
 * isn't transactional -- it's a plain sequence of inserts) doesn't pile up
 * duplicates. day_exercises/set_groups aren't de-duped -- they're only ever
 * reached after every exercise and day already succeeded.
 */
export async function bootstrapStarterTemplate(): Promise<void> {
  const existingExercises = await fetchAllExercises()
  const existingDays = await fetchTemplate()

  async function getOrCreateExercise(input: ExerciseInput): Promise<Exercise> {
    const existing = existingExercises.find((e) => e.name === input.name)
    if (existing) return existing
    const created = await createExercise(input)
    existingExercises.push(created)
    return created
  }

  async function getOrCreateDay(input: DayInput): Promise<Day> {
    const existing = existingDays.find((d) => d.name === input.name)
    if (existing) return existing
    const created = await createDay(input)
    existingDays.push({ ...created, day_exercises: [] })
    return created
  }

  const bench = await getOrCreateExercise({ name: 'Bench', requiresTest: true, e1rmSourceExerciseId: null })
  const pausedBench = await getOrCreateExercise({
    name: 'Paused Bench',
    requiresTest: false,
    e1rmSourceExerciseId: bench.id,
  })
  const deadlift = await getOrCreateExercise({ name: 'Deadlift', requiresTest: true, e1rmSourceExerciseId: null })
  const squat = await getOrCreateExercise({ name: 'Squat', requiresTest: true, e1rmSourceExerciseId: null })
  const weightedPullup = await getOrCreateExercise({
    name: 'Weighted Pull-up',
    requiresTest: true,
    e1rmSourceExerciseId: null,
  })
  const pullup = await getOrCreateExercise({ name: 'Pull-up', requiresTest: false, e1rmSourceExerciseId: null })
  const inclineDb = await getOrCreateExercise({ name: 'Incline DB', requiresTest: false, e1rmSourceExerciseId: null })
  const chestSupportedRow = await getOrCreateExercise({
    name: 'Chest-Supported Row',
    requiresTest: false,
    e1rmSourceExerciseId: null,
  })
  const weightedDip = await getOrCreateExercise({ name: 'Weighted Dip', requiresTest: true, e1rmSourceExerciseId: null })

  for (const ex of [bench, deadlift, squat, weightedPullup, weightedDip]) {
    await ensureCalibration(ex.id)
  }

  const heavy = await getOrCreateDay({ name: 'Heavy', sortOrder: 1, dayOfWeek: 1 })
  const volume = await getOrCreateDay({ name: 'Volume', sortOrder: 2, dayOfWeek: 4 })
  const deadliftDay = await getOrCreateDay({ name: 'Deadlift', sortOrder: 3, dayOfWeek: 5 })
  const technique = await getOrCreateDay({ name: 'Technique', sortOrder: 4, dayOfWeek: 6 })
  const squatDay = await getOrCreateDay({ name: 'Squat', sortOrder: 5, dayOfWeek: null })

  const heavyBench = await createDayExercise(heavy.id, bench.id, 1)
  const heavyPullup = await createDayExercise(heavy.id, weightedPullup.id, 2)
  const heavyInclineDb = await createDayExercise(heavy.id, inclineDb.id, 3)
  const heavyRow = await createDayExercise(heavy.id, chestSupportedRow.id, 4)
  const deadliftDe = await createDayExercise(deadliftDay.id, deadlift.id, 1)
  const squatDe = await createDayExercise(squatDay.id, squat.id, 1)
  const volumeBench = await createDayExercise(volume.id, bench.id, 1)
  const volumePullup = await createDayExercise(volume.id, weightedPullup.id, 2)
  const volumeDip = await createDayExercise(volume.id, weightedDip.id, 3)
  const volumeRow = await createDayExercise(volume.id, chestSupportedRow.id, 4)
  const techniquePausedBench = await createDayExercise(technique.id, pausedBench.id, 1)
  const techniquePullup = await createDayExercise(technique.id, pullup.id, 2)
  const techniqueInclineDb = await createDayExercise(technique.id, inclineDb.id, 3)
  const techniqueRow = await createDayExercise(technique.id, chestSupportedRow.id, 4)

  const noIncrements = null
  const base = (dayExerciseId: string, sortOrder: number) => ({ dayExerciseId, sortOrder, restSeconds: null })

  // Heavy
  await createSetGroup({ ...base(heavyBench.id, 1), reps: 1, numSets: 1, isFreeform: false, intensityNote: null, week1Percentage: 0.8125, increments: [5, 10, 10, 15] })
  await createSetGroup({ ...base(heavyBench.id, 2), reps: 3, numSets: 4, isFreeform: false, intensityNote: null, week1Percentage: 0.75, increments: [10, 10, 5, 10] })
  await createSetGroup({ ...base(heavyPullup.id, 1), reps: 1, numSets: 1, isFreeform: false, intensityNote: null, week1Percentage: 0.8, increments: [2, 2, 3, 3] })
  await createSetGroup({ ...base(heavyPullup.id, 2), reps: 3, numSets: 2, isFreeform: false, intensityNote: null, week1Percentage: 0.7, increments: [1, 1, 2, 2] })
  await createSetGroup({ ...base(heavyInclineDb.id, 1), reps: 8, numSets: 2, isFreeform: true, intensityNote: null, week1Percentage: null, increments: noIncrements })
  await createSetGroup({ ...base(heavyRow.id, 1), reps: 8, numSets: 2, isFreeform: true, intensityNote: null, week1Percentage: null, increments: noIncrements })

  // Deadlift
  await createSetGroup({ ...base(deadliftDe.id, 1), reps: 1, numSets: 1, isFreeform: false, intensityNote: null, week1Percentage: 0.8, increments: [15, 15, 15, 25] })
  await createSetGroup({ ...base(deadliftDe.id, 2), reps: 3, numSets: 3, isFreeform: false, intensityNote: null, week1Percentage: 0.72, increments: [5, 5, 5, 5] })

  // Squat -- template numbers, not fit to a real squat E1RM yet (see product-backlog memory)
  await createSetGroup({ ...base(squatDe.id, 1), reps: 1, numSets: 1, isFreeform: false, intensityNote: null, week1Percentage: 0.8, increments: [15, 15, 15, 25] })
  await createSetGroup({ ...base(squatDe.id, 2), reps: 3, numSets: 3, isFreeform: false, intensityNote: null, week1Percentage: 0.72, increments: [5, 5, 5, 5] })

  // Volume
  await createSetGroup({ ...base(volumeBench.id, 1), reps: 5, numSets: 5, isFreeform: false, intensityNote: null, week1Percentage: 0.770833, increments: [5, 5, 5, 5] })
  await createSetGroup({
    ...base(volumePullup.id, 1),
    reps: 6,
    numSets: 3,
    isFreeform: true,
    intensityNote: null,
    week1Percentage: null,
    increments: noIncrements,
    weeklyPlan: [
      { week: 1, sets: 3, reps: 6, target_rpe: 'RIR 3', note: null },
      { week: 2, sets: 4, reps: 6, target_rpe: 'RIR 2-3', note: null },
      { week: 3, sets: 5, reps: 6, target_rpe: 'RIR 2-3', note: null },
      { week: 4, sets: 4, reps: 6, target_rpe: 'RIR 2', note: 'Last set to RIR 1' },
      { week: 5, sets: 2, reps: 5, target_rpe: 'RIR 3', note: 'Deload' },
    ],
  })
  await createSetGroup({ ...base(volumeDip.id, 0), reps: 1, numSets: 1, isFreeform: false, intensityNote: null, week1Percentage: 0.8, increments: [3, 3, 4, 5] })
  await createSetGroup({ ...base(volumeDip.id, 1), reps: 3, numSets: 3, isFreeform: false, intensityNote: null, week1Percentage: 0.72, increments: [2, 2, 3, 3] })
  await createSetGroup({ ...base(volumeRow.id, 1), reps: 8, numSets: 2, isFreeform: true, intensityNote: null, week1Percentage: null, increments: noIncrements })

  // Technique
  await createSetGroup({ ...base(techniquePausedBench.id, 1), reps: 5, numSets: 4, isFreeform: false, intensityNote: null, week1Percentage: 0.729167, increments: [5, 5, 5, 5] })
  await createSetGroup({ ...base(techniquePullup.id, 1), reps: 0, numSets: 0, isFreeform: true, intensityNote: null, week1Percentage: null, increments: noIncrements })
  await createSetGroup({ ...base(techniqueInclineDb.id, 1), reps: 8, numSets: 2, isFreeform: true, intensityNote: null, week1Percentage: null, increments: noIncrements })
  await createSetGroup({ ...base(techniqueRow.id, 1), reps: 8, numSets: 2, isFreeform: true, intensityNote: null, week1Percentage: null, increments: noIncrements })
}
