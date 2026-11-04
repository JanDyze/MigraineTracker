import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

type AuthState = { session: Session | null; loading: boolean }

const AuthContext = createContext<AuthState>({ session: null, loading: true })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, loading: true })

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setState({ session: data.session, loading: false }))
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setState({ session, loading: false }))
    return () => data.subscription.unsubscribe()
  }, [])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)

/** The name they gave at sign-up (or Google's), as written; '' if none. */
export function fullName(session: Session | null): string {
  const meta = session?.user.user_metadata
  return String(meta?.full_name ?? meta?.name ?? '').trim()
}

/** Just the first name, for Grami to greet them by; null if we don't know it. */
export const firstName = (session: Session | null) => fullName(session).split(/\s+/)[0] || null
