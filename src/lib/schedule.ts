/** A day with enough fields to resolve which one (if any) falls on a given date. */
interface ScheduleDay {
  name: string
  day_of_week: number | null
}

/** Which training day (if any) is scheduled for the given date, per each day's day_of_week (JS Date#getDay(): 0=Sun..6=Sat). */
export function scheduledDayName(days: ScheduleDay[], date: Date = new Date()): string | null {
  return days.find((d) => d.day_of_week === date.getDay())?.name ?? null
}

/** YYYY-MM-DD in local time -- not toISOString(), which is UTC and can roll to the wrong calendar date near midnight. */
export function todayIsoDate(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** YYYY-MM-DD for N days before the given date (local time). */
export function isoDateDaysAgo(days: number, date: Date = new Date()): string {
  const d = new Date(date)
  d.setDate(d.getDate() - days)
  return todayIsoDate(d)
}
