import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
import type { Attack, AttackInput } from './attacks'
import { mock, mockAttacks } from './mock'

type Store = {
  attacks: Attack[]
  loading: boolean
  error: string | null
  save: (input: AttackInput, id?: string) => Promise<Attack>
  remove: (id: string) => Promise<void>
}

const COLUMNS = 'id, started_at, ended_at, intensity, locations, symptoms, triggers, medications, relief, notes'

const StoreContext = createContext<Store | null>(null)

const byNewest = (a: Attack, b: Attack) => b.started_at.localeCompare(a.started_at)

/**
 * Personal-scale data: load the user's whole history once and keep it in memory.
 * In mock mode (lib/mock.ts) the history is made up and saves stay in memory too.
 */
export function AttackStoreProvider({ children }: { children: ReactNode }) {
  const [attacks, setAttacks] = useState<Attack[]>(() => (mock ? mockAttacks(mock) : []))
  const [loading, setLoading] = useState(!mock)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (mock) return
    supabase
      .from('attacks')
      .select(COLUMNS)
      .order('started_at', { ascending: false })
      .limit(5000)
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setAttacks(data as Attack[])
        setLoading(false)
      })
  }, [])

  const save = useCallback(async (input: AttackInput, id?: string) => {
    if (mock) {
      const saved: Attack = { ...input, id: id ?? crypto.randomUUID() }
      setAttacks((prev) => [saved, ...prev.filter((a) => a.id !== saved.id)].sort(byNewest))
      return saved
    }
    const query = id
      ? supabase.from('attacks').update(input).eq('id', id)
      : supabase.from('attacks').insert(input)
    const { data, error } = await query.select(COLUMNS).single()
    if (error) throw new Error(error.message)
    const saved = data as Attack
    setAttacks((prev) => [saved, ...prev.filter((a) => a.id !== saved.id)].sort(byNewest))
    return saved
  }, [])

  const remove = useCallback(async (id: string) => {
    if (mock) {
      setAttacks((prev) => prev.filter((a) => a.id !== id))
      return
    }
    const { error } = await supabase.from('attacks').delete().eq('id', id)
    if (error) throw new Error(error.message)
    setAttacks((prev) => prev.filter((a) => a.id !== id))
  }, [])

  return (
    <StoreContext.Provider value={{ attacks, loading, error, save, remove }}>{children}</StoreContext.Provider>
  )
}

export function useAttacks() {
  const store = useContext(StoreContext)
  if (!store) throw new Error('useAttacks must be used inside AttackStoreProvider')
  return store
}
