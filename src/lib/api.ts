import { supabase } from './supabase'
import { computeWeeklyTargets, resolveExerciseE1RM, type ExerciseTestInput } from './calc'
import type { Database } from './database.types'

export type Exercise = Database['public']['Tables']['exercises']['Row']
export type Day = Database['public']['Tables']['days']['Row']
export type SetGroup = Database['public']['Tables']['set_groups']['Row']
export type Program = Database['public']['Tables']['programs']['Row']
export type WeeklyTarget = Database['public']['Tables']['weekly_targets']['Row']
export type LoggedSet = Database['public']['Tables']['logged_sets']['Row']

export interface DayExerciseWithDetails {
  id: string
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
    .select('*, day_exercises(id, exercise:exercises(*), set_groups(*))')
    .order('sort_order')
  if (error) throw error

  const days = data as unknown as DayWithExercises[]
  for (const day of days) {
    day.day_exercises.sort((a, b) => a.exercise.name.localeCompare(b.exercise.name))
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

/** Most recently started program, if any. */
export async function fetchLatestProgram(): Promise<Program | null> {
  const { data, error } = await supabase
    .from('programs')
    .select('*')
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function fetchWeeklyTargets(programId: string): Promise<WeeklyTarget[]> {
  const { data, error } = await supabase.from('weekly_targets').select('*').eq('program_id', programId)
  if (error) throw error
  return data
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
  return data
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
    e1rmByExerciseId.set(plan.exerciseId, computedE1rm)

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
