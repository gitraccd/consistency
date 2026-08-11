import type { TestLiftMode } from './database.types'

export const PLATE_INCREMENT = 5
export const DEFAULT_WEEK1_PERCENTAGE = 0.75

export type WeekNumber = 1 | 2 | 3 | 4 | 5

/**
 * Rounds to the nearest loadable plate increment, with exact ties rounding
 * down (e.g. 232.5 -> 230, not 235). Confirmed against the PRD's real
 * spreadsheet values: Squat 300x1->310, Bench 225x1->230, OHP 135x1->140,
 * Deadlift 375x1->385.
 */
export function roundToIncrement(value: number, increment = PLATE_INCREMENT): number {
  const q = value / increment
  // guard against binary floating-point noise (e.g. 232.5 stored as
  // 232.50000000000003) before applying the half-down tie rule
  const clean = Math.round(q * 1e8) / 1e8
  return Math.ceil(clean - 0.5) * increment
}

export function epley1RM(weight: number, reps: number): number {
  return weight * (1 + reps / 30)
}

/** RPE-based E1RM: converts RPE to reps-in-reserve, then applies Epley to the estimated reps-to-failure. */
export function rpeBased1RM(weight: number, reps: number, rpe: number): number {
  const repsInReserve = Math.max(0, 10 - rpe)
  return epley1RM(weight, reps + repsInReserve)
}

export interface TestLiftInput {
  mode: TestLiftMode
  weight?: number
  reps?: number
  rpe?: number
  manualE1rm?: number
  manualWeek1Weight?: number
  week1Percentage?: number
}

export interface ResolvedTestLift {
  computedE1rm: number | null
  week1Weight: number
}

/** Turns a TestLift entry (whichever of the 4 modes) into an E1RM (if applicable) and a Week 1 target weight. */
export function resolveTestLift(input: TestLiftInput): ResolvedTestLift {
  const pct = input.week1Percentage ?? DEFAULT_WEEK1_PERCENTAGE

  switch (input.mode) {
    case 'raw_epley': {
      if (input.weight == null || input.reps == null) {
        throw new Error('raw_epley mode requires weight and reps')
      }
      const e1rm = epley1RM(input.weight, input.reps)
      return { computedE1rm: e1rm, week1Weight: roundToIncrement(e1rm * pct) }
    }
    case 'rpe_based': {
      if (input.weight == null || input.reps == null || input.rpe == null) {
        throw new Error('rpe_based mode requires weight, reps, and rpe')
      }
      const e1rm = rpeBased1RM(input.weight, input.reps, input.rpe)
      return { computedE1rm: e1rm, week1Weight: roundToIncrement(e1rm * pct) }
    }
    case 'manual_e1rm': {
      if (input.manualE1rm == null) {
        throw new Error('manual_e1rm mode requires manualE1rm')
      }
      return { computedE1rm: input.manualE1rm, week1Weight: roundToIncrement(input.manualE1rm * pct) }
    }
    case 'manual_week1_weight': {
      if (input.manualWeek1Weight == null) {
        throw new Error('manual_week1_weight mode requires manualWeek1Weight')
      }
      return { computedE1rm: null, week1Weight: roundToIncrement(input.manualWeek1Weight) }
    }
  }
}

/**
 * Weeks 2-5 are cumulative additive increments over the Week 1 weight
 * (e.g. increments [10,10,5,5] -> week2 = week1+10, week3 = week1+20, ...),
 * each rounded to the nearest loadable plate increment.
 */
export function computeWeeklyTargets(
  week1Weight: number,
  increments: [number, number, number, number],
): Record<WeekNumber, number> {
  const week1 = roundToIncrement(week1Weight)
  const targets: Record<WeekNumber, number> = { 1: week1, 2: 0, 3: 0, 4: 0, 5: 0 }
  let cumulative = week1
  increments.forEach((inc, i) => {
    cumulative += inc
    targets[(i + 2) as WeekNumber] = roundToIncrement(cumulative)
  })
  return targets
}
