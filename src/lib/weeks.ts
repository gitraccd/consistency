import type { WeekNumber } from './calc'

/** Which week (1-5, clamped) of a program a given date falls in, based on its start date. */
export function currentWeekNumber(startDate: string, today: Date = new Date()): WeekNumber {
  const start = new Date(startDate + 'T00:00:00')
  const diffDays = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  const week = Math.floor(diffDays / 7) + 1
  return Math.min(5, Math.max(1, week)) as WeekNumber
}
