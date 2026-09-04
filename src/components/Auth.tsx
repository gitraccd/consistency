import { useState } from 'react'
import { errorMessage } from '../lib/api'
import { supabase } from '../lib/supabase'

export function Auth() {
  const [mode, setMode] = useState<'signup' | 'login'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [signedUpNotice, setSignedUpNotice] = useState(false)

  const valid = email.trim() !== '' && password.length >= 6

  async function handleSubmit() {
    if (!valid) return
    setSubmitting(true)
    setError(null)
    setSignedUpNotice(false)
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password })
        if (error) throw error
        // If email confirmation is required, there's no session yet -- let them know to check their inbox.
        if (!data.session) setSignedUpNotice(true)
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
      }
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
          <h1 className="text-2xl font-bold tracking-tight">Consistency</h1>
          <p className="mt-1 text-sm text-text-muted">Percentage-based strength training, built around a real block.</p>
        </div>

        <div className="space-y-3 rounded-xl bg-surface p-4">
          <div className="flex gap-2">
            <button
              onClick={() => setMode('login')}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-transform active:scale-95 ${
                mode === 'login' ? 'bg-text text-bg' : 'bg-surface-2 text-text-muted'
              }`}
            >
              Log in
            </button>
            <button
              onClick={() => setMode('signup')}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-transform active:scale-95 ${
                mode === 'signup' ? 'bg-text text-bg' : 'bg-surface-2 text-text-muted'
              }`}
            >
              Sign up
            </button>
          </div>

          <label className="block space-y-1">
            <span className="text-sm text-text-muted">Email</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg bg-surface-2 px-3 py-2 text-lg"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm text-text-muted">Password</span>
            <input
              type="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg bg-surface-2 px-3 py-2 text-lg"
            />
            {mode === 'signup' && password !== '' && password.length < 6 && (
              <span className="text-xs text-text-muted">At least 6 characters</span>
            )}
          </label>

          {error && <p className="text-sm text-danger">{error}</p>}
          {signedUpNotice && (
            <p className="text-sm text-success">Account created — check your email to confirm before logging in.</p>
          )}

          <button
            onClick={handleSubmit}
            disabled={!valid || submitting}
            className="w-full rounded-xl bg-accent py-3 font-medium text-accent-text transition-transform active:scale-[0.98] disabled:opacity-40"
          >
            {submitting ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Log in'}
          </button>
        </div>
      </div>
    </div>
  )
}
