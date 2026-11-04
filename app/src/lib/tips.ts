import { labelFor, type Attack } from './attacks'
import { clearDays } from './days'
import { dayKey } from './format'

/*
 * Grami's tip: one short line from your own journal, shown under Grami on Today. During a
 * migraine it's about getting through it; otherwise it picks one finding (worst weekday, a
 * frequent trigger, the medicine that helps most, your calm streak) and changes day to day.
 */

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAY = 86_400_000
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** The medicine that helped most often (relief "mostly" or better), if it was rated at least twice. */
function bestMedicine(attacks: Attack[]): string | null {
  const stats = new Map<string, { rated: number; helped: number }>()
  for (const a of attacks)
    for (const m of a.medications) {
      if (a.relief === null) continue
      const s = stats.get(m) ?? { rated: 0, helped: 0 }
      s.rated++
      if (a.relief >= 2) s.helped++
      stats.set(m, s)
    }
  const ranked = [...stats.entries()].filter(([, s]) => s.rated >= 2 && s.helped / s.rated >= 0.5)
  ranked.sort((a, b) => b[1].helped / b[1].rated - a[1].helped / a[1].rated)
  return ranked[0]?.[0] ?? null
}

/** The longest run of whole calm days between two migraines. */
function longestCalm(attacks: Attack[]): number {
  const done = attacks.filter((a) => a.ended_at).sort((a, b) => a.started_at.localeCompare(b.started_at))
  let best = 0
  for (let i = 1; i < done.length; i++) {
    const end = new Date(done[i - 1].ended_at!)
    const next = new Date(done[i].started_at)
    end.setHours(0, 0, 0, 0)
    next.setHours(0, 0, 0, 0)
    best = Math.max(best, Math.round((next.getTime() - end.getTime()) / DAY) - 1)
  }
  return best
}

export function gramiTip(attacks: Attack[], now: Date): string {
  if (attacks.some((a) => !a.ended_at)) {
    const med = bestMedicine(attacks)
    return med ? `${med} has helped you most before. Rest somewhere dark if you can.` : 'Rest somewhere dark and quiet. I’ll keep watch.'
  }
  if (!attacks.length) return 'Log a migraine when one comes, and I’ll look for patterns.'

  const tips: string[] = []
  const perDay = Array<number>(7).fill(0)
  for (const a of attacks) perDay[new Date(a.started_at).getDay()]++
  const worst = perDay.indexOf(Math.max(...perDay))
  if (perDay[worst] >= 3 && perDay[worst] / attacks.length >= 0.25)
    tips.push(
      (now.getDay() + 1) % 7 === worst
        ? `Tomorrow’s a ${WEEKDAYS[worst]}, often a rough day for you. Early night?`
        : `${WEEKDAYS[worst]}s are often rough for you.`,
    )

  const recent = attacks.slice(0, 8)
  const triggers = new Map<string, number>()
  for (const a of recent) for (const t of a.triggers) triggers.set(t, (triggers.get(t) ?? 0) + 1)
  const [trigger, times] = [...triggers.entries()].sort((a, b) => b[1] - a[1])[0] ?? []
  if (trigger && times >= 3) tips.push(`${cap(labelFor(trigger).toLowerCase())} came before ${times} of your last ${recent.length} migraines.`)

  const med = bestMedicine(attacks)
  if (med) tips.push(`${med} has helped you the most so far.`)

  const streak = clearDays(attacks)
  const longest = longestCalm(attacks)
  if (streak !== null && streak >= 2 && longest >= 2)
    tips.push(streak >= longest ? `${streak} calm days, your longest run yet!` : `${streak} calm days so far. Your best run is ${longest}.`)

  if (!tips.length) return 'Ask me what sets your migraines off.'
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / DAY)
  return tips[dayOfYear % tips.length]
}

/** Days this calendar month with a migraine where you took medicine. */
export function medicineDays(attacks: Attack[], now: Date): number {
  const month = dayKey(now).slice(0, 7)
  return new Set(attacks.filter((a) => a.medications.length).map((a) => dayKey(new Date(a.started_at))).filter((k) => k.startsWith(month))).size
}
