import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!url || !key) {
  throw new Error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.local.')
}

// The Supabase project is shared by several apps; Might's tables live in their own schema.
export const supabase = createClient(url, key, { db: { schema: 'might' } })

/** Which OAuth providers are switched on in Supabase (so buttons only appear when they'll work). */
export async function enabledProviders(): Promise<Record<string, boolean>> {
  try {
    const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key! } })
    if (!res.ok) return {}
    const settings = (await res.json()) as { external?: Record<string, boolean> }
    return settings.external ?? {}
  } catch {
    return {}
  }
}
