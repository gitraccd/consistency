import { useEffect, useState } from 'react'
import { Minus, Plus, X } from 'lucide-react'

/** Persistent countdown banner shown after logging a set. Lives at the top of
 * the screen (not the bottom) so it's never hidden behind LogPopover's
 * bottom sheet, which is open right when a set just got logged. */
export function RestTimer({
  endsAt,
  onAdjust,
  onDismiss,
}: {
  endsAt: number
  onAdjust: (deltaSeconds: number) => void
  onDismiss: () => void
}) {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [])

  const remaining = Math.max(0, Math.ceil((endsAt - now) / 1000))
  const done = remaining === 0

  useEffect(() => {
    if (!done) return
    try {
      navigator.vibrate?.(200)
    } catch {
      // vibration unsupported/blocked -- silently ignore
    }
  }, [done])

  const mm = Math.floor(remaining / 60)
  const ss = remaining % 60

  return (
    <div
      className="fixed inset-x-4 z-30 flex items-center justify-between gap-2 rounded-2xl bg-surface p-2.5 shadow-lg ring-1 ring-border"
      style={{ top: 'calc(env(safe-area-inset-top) + 8px)' }}
    >
      <button
        onClick={() => onAdjust(-15)}
        aria-label="Subtract 15 seconds"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-text-muted active:scale-90"
      >
        <Minus className="h-4 w-4" />
      </button>
      <div className="flex-1 text-center">
        <div className={`text-xl font-bold tabular-nums ${done ? 'text-success' : 'text-text'}`}>
          {mm}:{String(ss).padStart(2, '0')}
        </div>
        <div className="text-[10px] uppercase tracking-wide text-text-muted">{done ? 'Rest done' : 'Resting'}</div>
      </div>
      <button
        onClick={() => onAdjust(15)}
        aria-label="Add 15 seconds"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-text-muted active:scale-90"
      >
        <Plus className="h-4 w-4" />
      </button>
      <button
        onClick={onDismiss}
        aria-label="Dismiss timer"
        className="-m-1 flex h-9 w-9 shrink-0 items-center justify-center text-text-muted active:scale-90"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
