import { useState, type FormEvent } from 'react'
import { errorMessage } from '../lib/api'
import { supabase } from '../lib/supabase'

/** Shown after landing on a password-recovery link -- supabase-js already has a session at this point, this just sets a new password for it. */
export function ResetPassword({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const valid = password.length >= 6 && password === confirm

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!valid) return
    setSubmitting(true)
    setError(null)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      onDone()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <div className="page-enter w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">Set a new password</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 rounded-xl bg-surface p-4">
          <label className="block space-y-1">
            <span className="text-sm text-text-muted">New password</span>
            <input
              type="password"
              autoComplete="new-password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg bg-surface-2 px-3 py-2 text-lg"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm text-text-muted">Confirm password</span>
            <input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-lg bg-surface-2 px-3 py-2 text-lg"
            />
            {confirm !== '' && confirm !== password && <span className="text-xs text-danger">Doesn't match</span>}
          </label>

          {error && <p className="text-sm text-danger">{error}</p>}

          <button
            type="submit"
            disabled={!valid || submitting}
            className="w-full rounded-xl bg-accent py-3 font-medium text-accent-text transition-transform active:scale-[0.98] disabled:opacity-40"
          >
            {submitting ? 'Saving…' : 'Save password'}
          </button>
        </form>
      </div>
    </div>
  )
}
