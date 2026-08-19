/** Fixed weekday -> training day mapping (JS Date#getDay(): 0=Sun..6=Sat). */
const WEEKDAY_SCHEDULE: Record<number, string> = {
  1: 'Heavy', // Monday
  4: 'Volume', // Thursday
  5: 'Deadlift', // Friday
  6: 'Technique', // Saturday
}

/** Which training day (if any) is scheduled for the given date. */
export function scheduledDayName(date: Date = new Date()): string | null {
  return WEEKDAY_SCHEDULE[date.getDay()] ?? null
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
