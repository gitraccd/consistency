import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { Auth } from './components/Auth'
import App from './App'

/** Gates the real app behind a session -- logged out sees Auth, logged in sees App. */
export function AuthGate() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => setSession(newSession))
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) {
    return (
      <div className="flex min-h-dvh items-center justify-center gap-1.5">
        <span className="pulse-dot h-2 w-2 rounded-full bg-text-muted" style={{ animationDelay: '0ms' }} />
        <span className="pulse-dot h-2 w-2 rounded-full bg-text-muted" style={{ animationDelay: '150ms' }} />
        <span className="pulse-dot h-2 w-2 rounded-full bg-text-muted" style={{ animationDelay: '300ms' }} />
      </div>
    )
  }

  return session ? <App /> : <Auth />
}
