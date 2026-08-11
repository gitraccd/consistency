import { supabase } from './supabase'
import { computeWeeklyTargets, resolveTestLift, type TestLiftInput } from './calc'
import type { Database } from './database.types'

export type Lift = Database['public']['Tables']['lifts']['Row']
export type Program = Database['public']['Tables']['programs']['Row']
export type TestLift = Database['public']['Tables']['test_lifts']['Row']
export type WeeklyTarget = Database['public']['Tables']['weekly_targets']['Row']
export type LoggedSet = Database['public']['Tables']['logged_sets']['Row']

export async function fetchLifts(): Promise<Lift[]> {
  const { data, error } = await supabase.from('lifts').select('*').order('sort_order')
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

export async function fetchTestLifts(programId: string): Promise<TestLift[]> {
  const { data, error } = await supabase.from('test_lifts').select('*').eq('program_id', programId)
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
  liftId: string
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
      lift_id: input.liftId,
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

export interface LiftTestPlan {
  liftId: string
  input: TestLiftInput
  increments: [number, number, number, number]
}

/**
 * Creates a program, resolves each lift's test into a Week 1 weight,
 * generates Weeks 2-5 off the lift's increment sequence, and persists
 * test_lifts + weekly_targets. Also updates each lift's stored defaults
 * so a confirmed percentage/increments becomes the new default going
 * forward (mirrors how the PRD's Bench numbers went from draft to locked).
 */
export async function createProgram(startDate: string, plans: LiftTestPlan[]): Promise<Program> {
  const { data: program, error: programError } = await supabase
    .from('programs')
    .insert({ start_date: startDate })
    .select()
    .single()
  if (programError) throw programError

  for (const plan of plans) {
    const resolved = resolveTestLift(plan.input)

    const { error: testLiftError } = await supabase.from('test_lifts').insert({
      program_id: program.id,
      lift_id: plan.liftId,
      mode: plan.input.mode,
      input_weight: plan.input.weight ?? null,
      input_reps: plan.input.reps ?? null,
      input_rpe: plan.input.rpe ?? null,
      manual_e1rm: plan.input.manualE1rm ?? null,
      manual_week1_weight: plan.input.manualWeek1Weight ?? null,
      week1_percentage: plan.input.week1Percentage ?? null,
      computed_e1rm: resolved.computedE1rm,
    })
    if (testLiftError) throw testLiftError

    const targets = computeWeeklyTargets(resolved.week1Weight, plan.increments)
    const rows = (Object.entries(targets) as [string, number][]).map(([week, weight]) => ({
      program_id: program.id,
      lift_id: plan.liftId,
      week_number: Number(week),
      target_weight: weight,
    }))
    const { error: targetsError } = await supabase.from('weekly_targets').insert(rows)
    if (targetsError) throw targetsError

    if (plan.input.week1Percentage != null) {
      await supabase
        .from('lifts')
        .update({ default_week1_percentage: plan.input.week1Percentage, default_increments: plan.increments })
        .eq('id', plan.liftId)
    } else {
      await supabase.from('lifts').update({ default_increments: plan.increments }).eq('id', plan.liftId)
    }
  }

  return program
}
