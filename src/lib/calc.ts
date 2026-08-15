import type { ExerciseTestMode } from './database.types'

export const PLATE_INCREMENT = 5

/** Any loggable week, including the unprogrammed deload week. */
export type WeekNumber = 1 | 2 | 3 | 4 | 5 | 6

/** A week with a computed weekly_targets number (deload week 6 has none). */
export type TargetWeek = 1 | 2 | 3 | 4 | 5

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

export interface ExerciseTestInput {
  mode: ExerciseTestMode
  weight?: number
  reps?: number
  rpe?: number
  manualE1rm?: number
}

/** Turns an exercise test entry (whichever of the 3 modes) into an E1RM. */
export function resolveExerciseE1RM(input: ExerciseTestInput): number {
  switch (input.mode) {
    case 'raw_epley': {
      if (input.weight == null || input.reps == null) {
        throw new Error('raw_epley mode requires weight and reps')
      }
      return epley1RM(input.weight, input.reps)
    }
    case 'rpe_based': {
      if (input.weight == null || input.reps == null || input.rpe == null) {
        throw new Error('rpe_based mode requires weight, reps, and rpe')
      }
      return rpeBased1RM(input.weight, input.reps, input.rpe)
    }
    case 'manual_e1rm': {
      if (input.manualE1rm == null) {
        throw new Error('manual_e1rm mode requires manualE1rm')
      }
      return input.manualE1rm
    }
  }
}

/**
 * Weeks 2-5 are cumulative additive increments over the Week 1 weight
 * (e.g. increments [10,10,5,5] -> week2 = week1+10, week3 = week1+20, ...),
 * each rounded to the nearest loadable plate increment. week1Weight is
 * typically e1rm * a set-group's own week1_percentage.
 */
export function computeWeeklyTargets(
  week1Weight: number,
  increments: [number, number, number, number],
): Record<TargetWeek, number> {
  const week1 = roundToIncrement(week1Weight)
  const targets: Record<TargetWeek, number> = { 1: week1, 2: 0, 3: 0, 4: 0, 5: 0 }
  let cumulative = week1
  increments.forEach((inc, i) => {
    cumulative += inc
    targets[(i + 2) as TargetWeek] = roundToIncrement(cumulative)
  })
  return targets
}

/** How much an EMA update weights the newest data point vs. calibration history. */
export const CALIBRATION_ALPHA = 0.25

/** RPE-tagged data points needed before a calibration's correction_factor is trusted for programming. */
export const CALIBRATION_TRUST_THRESHOLD = 3

/**
 * Exponential moving average update for a per-exercise correction factor:
 * recent data outweighs old data, so genuine strength changes are tracked
 * over months while a single noisy/misjudged RPE reading doesn't swing it.
 */
export function updateCorrectionFactor(oldFactor: number, newRatio: number, alpha = CALIBRATION_ALPHA): number {
  return oldFactor * (1 - alpha) + newRatio * alpha
}
