import { level, type Attack, type Level } from './attacks'
import { dayKey, daysTouched } from './format'

/** Local day key -> the attacks touching that day (a 2-day migraine appears on both days). */
export function attacksByDay(attacks: Attack[]): Map<string, Attack[]> {
  const map = new Map<string, Attack[]>()
  for (const a of attacks) for (const k of daysTouched(a.started_at, a.ended_at)) map.set(k, [...(map.get(k) ?? []), a])
  return map
}

export function worstLevel(list: Attack[] | undefined): Level | null {
  return list?.length ? level(Math.max(...list.map((a) => a.intensity))) : null
}

/** The last `n` days ending today, oldest first. */
export function lastDays(n: number): Date[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() - (n - 1 - i))
    return d
  })
}

/** Whole calendar days between the end of the latest attack and today (0 = it was today). */
export function clearDays(attacks: Attack[]): number | null {
  const last = attacks.find((a) => a.ended_at) // attacks are newest first
  if (!last) return null
  const end = new Date(last.ended_at!)
  end.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((today.getTime() - end.getTime()) / 86_400_000)
}

export { dayKey }
