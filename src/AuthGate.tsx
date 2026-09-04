import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { Auth } from './components/Auth'
import { ResetPassword } from './components/ResetPassword'
import App from './App'

/** Gates the real app behind a session -- logged out sees Auth, logged in sees App, and a password-recovery link lands on ResetPassword instead of silently logging in. */
export function AuthGate() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [passwordRecovery, setPasswordRecovery] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true)
      setSession(newSession)
    })
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

  if (passwordRecovery) {
    return <ResetPassword onDone={() => setPasswordRecovery(false)} />
  }

  return session ? <App /> : <Auth />
}
