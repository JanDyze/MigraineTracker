import type { Attack } from './attacks'

/*
 * Mock mode: try the app in any state without touching real data. Add ?mock=<scenario> to any
 * address; it sticks for the tab until ?mock=off. While it's on, sign-in is skipped and entries
 * live in memory only, so nothing is ever saved to Supabase.
 *   empty                              – a brand-new journal
 *   calm                               – a few calm days after some history (&days=N sets how many)
 *   recovering                         – a migraine that ended a little while ago
 *   mild | moderate | severe | attack  – a migraine going on right now, at that level
 *   year                               – a year of varied history, for Patterns
 */

export const SCENARIOS = ['empty', 'calm', 'recovering', 'mild', 'moderate', 'severe', 'attack', 'year'] as const
export type Scenario = (typeof SCENARIOS)[number]
export type Mock = { scenario: Scenario; days: number }

const KEY = 'might.mock'
const HOUR = 3_600_000
const DAY = 24 * HOUR

function read(): Mock | null {
  try {
    const params = new URLSearchParams(window.location.search)
    const asked = params.get('mock')
    if (asked === 'off') {
      sessionStorage.removeItem(KEY)
      return null
    }
    if (asked && (SCENARIOS as readonly string[]).includes(asked)) {
      const days = Math.max(0, Math.min(60, Number(params.get('days')) || 5))
      sessionStorage.setItem(KEY, JSON.stringify({ scenario: asked, days }))
    }
    const kept = sessionStorage.getItem(KEY)
    return kept ? (JSON.parse(kept) as Mock) : null
  } catch {
    return null
  }
}

/** The mock this tab is in, read once when the app loads; null means real data. */
export const mock = read()

// the same "random" history every time, so a scenario always looks the same
function seeded(seed: number) {
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647
}

const TRIGGERS = ['Stress', 'Poor sleep', 'Skipped meal', 'Screen time', 'Weather change', 'Caffeine', 'Dehydration']
const LOCATIONS = ['Forehead', 'Temples', 'Behind eyes', 'Left side', 'Back of head']
const SYMPTOMS = ['Nausea', 'Light sensitivity', 'Sound sensitivity', 'Fatigue', 'Aura']
const MEDS = ['Ibuprofen', 'Sumatriptan', 'Paracetamol']

/** Past migraines spread over `span` days, the newest ending `calm` days ago. */
function history(span: number, calm: number, seed: number): Attack[] {
  const r = seeded(seed)
  const pick = <T,>(list: T[]) => list[Math.floor(r() * list.length)]
  const out: Attack[] = []
  for (let d = calm + 1; d < span; d += 3 + Math.floor(r() * 9)) {
    const start = Date.now() - d * DAY + Math.floor(r() * 10) * HOUR
    const hours = 2 + Math.floor(r() * 14)
    out.push({
      id: `mock-${seed}-${d}`,
      started_at: new Date(start).toISOString(),
      ended_at: new Date(start + hours * HOUR).toISOString(),
      intensity: 2 + Math.floor(r() * 9),
      locations: r() > 0.6 ? [pick(LOCATIONS), 'Forehead'].filter((v, i, a) => a.indexOf(v) === i) : [pick(LOCATIONS)],
      symptoms: [pick(SYMPTOMS), ...(r() > 0.5 ? [pick(SYMPTOMS)] : [])].filter((v, i, a) => a.indexOf(v) === i),
      triggers: [pick(TRIGGERS)],
      medications: r() > 0.3 ? [pick(MEDS)] : [],
      relief: r() > 0.2 ? Math.floor(r() * 4) : null,
      notes: null,
    })
  }
  return out
}

const LEVEL: Partial<Record<Scenario, number>> = { mild: 3, moderate: 6, severe: 8, attack: 10 }

/** The journal for a scenario, newest first. */
export function mockAttacks({ scenario, days }: Mock): Attack[] {
  if (scenario === 'empty') return []
  if (scenario === 'year') return history(340, 2, 7)
  if (scenario === 'calm') return history(70, days, 3)

  const past = history(60, 3, 5)
  const now = Date.now()
  const last: Attack = {
    ...past[0],
    id: 'mock-now',
    started_at: new Date(now - (scenario === 'recovering' ? 5 : 2) * HOUR).toISOString(),
    ended_at: scenario === 'recovering' ? new Date(now - HOUR).toISOString() : null,
    intensity: LEVEL[scenario] ?? 6,
    relief: null,
  }
  return [last, ...past]
}
