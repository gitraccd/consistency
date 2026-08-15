/** Fixed weekday -> training day mapping (JS Date#getDay(): 0=Sun..6=Sat). */
const WEEKDAY_SCHEDULE: Record<number, string> = {
  1: 'Heavy', // Monday
  4: 'Volume', // Thursday
  6: 'Technique', // Saturday
}

/** Which training day (if any) is scheduled for the given date. */
export function scheduledDayName(date: Date = new Date()): string | null {
  return WEEKDAY_SCHEDULE[date.getDay()] ?? null
}
