import { labelFor, level, levelLabel, type Attack, type TagField } from './attacks'
import { attackDuration, dayKey, daysTouched, formatDuration } from './format'

/*
 * Grami's answers. No AI: questions are matched to a topic by keywords, a time range is read
 * from the wording ("last month", "this week"…), and the answer is worked out from the journal.
 * Shaped so a real model could be plugged in later behind the same `answer()` call.
 */

const DAY = 86_400_000
const monthName = new Intl.DateTimeFormat(undefined, { month: 'long' })
const shortDay = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
const weekdayName = new Intl.DateTimeFormat(undefined, { weekday: 'long' })

export type Range = { from: number; to: number; label: string }

export const SUGGESTIONS = [
  'What triggered me last month?',
  'What helped me?',
  'Which days were bad?',
  'When do they usually start?',
  'Is this month better than last?',
  'How long have I been calm?',
]

export function parseRange(q: string, now = new Date()): Range {
  const t = now.getTime()
  const s = q.toLowerCase()
  if (/last month|previous month|past month/.test(s)) {
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const to = new Date(now.getFullYear(), now.getMonth(), 1)
    return { from: from.getTime(), to: to.getTime(), label: `in ${monthName.format(from)}` }
  }
  if (/this month/.test(s)) return { from: new Date(now.getFullYear(), now.getMonth(), 1).getTime(), to: t, label: 'this month' }
  if (/week/.test(s)) return { from: t - 7 * DAY, to: t, label: 'this past week' }
  if (/year/.test(s)) return { from: t - 365 * DAY, to: t, label: 'this past year' }
  if (/\b(ever|all|always|overall|total)\b/.test(s)) return { from: 0, to: t, label: 'so far' }
  return { from: t - 30 * DAY, to: t, label: 'in the past 30 days' }
}

type Topic = 'triggers' | 'helped' | 'days' | 'time' | 'symptoms' | 'count' | 'compare' | 'streak' | 'hello'

const TOPICS: [Topic, RegExp][] = [
  ['compare', /better|worse|compare|than last|vs\.?|versus/],
  ['streak', /calm|streak|since|clear|how long have/],
  ['helped', /help|work|medic|pill|tablet|ibuprofen|paracetamol|triptan|relief|took/],
  ['triggers', /trigger|cause|caused|why|reason|suspect|set (it|them) off/],
  ['time', /time|hour|morning|afternoon|evening|night|o'?clock|start/],
  ['days', /day|date|when|which/],
  ['symptoms', /symptom|feel|nause|aura|light|sound|dizzy/],
  ['count', /how many|count|number|often|much/],
  ['hello', /^(hi|hey|hello|yo|sup)\b|thank/],
]

const inRange = (attacks: Attack[], r: Range) =>
  attacks.filter((a) => {
    const t = new Date(a.started_at).getTime()
    return t >= r.from && t < r.to
  })

function tally(attacks: Attack[], field: TagField) {
  const m = new Map<string, number>()
  for (const a of attacks) for (const v of a[field]) m.set(v, (m.get(v) ?? 0) + 1)
  return [...m.entries()].sort((a, b) => b[1] - a[1])
}

const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`
const lower = (v: string) => labelFor(v).toLowerCase()

function list(items: string[]) {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

const TIPS: Record<string, string> = {
  'Poor sleep': 'Maybe an early night tonight?',
  'Screen time': 'Little screen breaks might help.',
  Stress: 'Be extra gentle with yourself.',
  'Skipped meal': 'Snacks are your friend!',
  Dehydration: 'Keep a water bottle close.',
  Caffeine: 'Maybe watch the coffee a little.',
  'Bright light': 'Sunglasses could be worth a try.',
}

function triggers(all: Attack[], r: Range) {
  const list_ = inRange(all, r)
  if (!list_.length) return `No migraines ${r.label}, so nothing to blame!`
  const t = tally(list_, 'triggers')
  if (!t.length) return `You had ${plural(list_.length, 'migraine')} ${r.label}, but didn't tick any triggers. Note a few next time and I'll spot the pattern.`
  const [top, n] = t[0]
  let s = `${labelFor(top)} showed up in ${n} of your ${plural(list_.length, 'migraine')} ${r.label}.`
  if (t[1]) s += ` ${labelFor(t[1][0])} came next (${t[1][1]}×).`
  if (TIPS[top]) s += ` ${TIPS[top]}`
  return s
}

function helped(all: Attack[], r: Range) {
  const list_ = inRange(all, r)
  const meds = new Map<string, { took: number; rated: number; helped: number }>()
  for (const a of list_)
    for (const m of a.medications) {
      const e = meds.get(m) ?? { took: 0, rated: 0, helped: 0 }
      e.took++
      if (a.relief !== null) {
        e.rated++
        if (a.relief >= 2) e.helped++
      }
      meds.set(m, e)
    }
  if (!meds.size) return `You didn't note any medication ${r.label}. If you take something next time, tell me and I'll keep score.`
  const rated = [...meds.entries()].filter(([, e]) => e.rated > 0).sort((a, b) => b[1].helped / b[1].rated - a[1].helped / a[1].rated)
  if (!rated.length)
    return `You took ${list([...meds.keys()])} ${r.label}, but didn't say whether it helped. Answer "did it help?" next time and I'll tell you what works.`
  const [best, e] = rated[0]
  let s = `${best} helped you ${e.helped} of ${plural(e.rated, 'time')} ${r.label}.`
  const rest = rated.slice(1).map(([m, x]) => `${m} ${x.helped}/${x.rated}`)
  if (rest.length) s += ` For comparison: ${list(rest)}.`
  return s
}

function days(all: Attack[], r: Range) {
  const list_ = inRange(all, r)
  if (!list_.length) return `No bad days ${r.label}. Calm waters all the way.`
  const shown = list_.slice(0, 6).map((a) => shortDay.format(new Date(a.started_at)))
  let s = `You had migraines on ${list(shown)}${list_.length > 6 ? ` and ${list_.length - 6} more` : ''} ${r.label}.`
  const worst = [...list_].sort((a, b) => b.intensity - a.intensity)[0]
  s += ` The roughest was ${shortDay.format(new Date(worst.started_at))} (${levelLabel(worst.intensity).toLowerCase()}).`
  if (list_.length >= 4) {
    const wd = new Map<number, number>()
    for (const a of list_) {
      const d = new Date(a.started_at).getDay()
      wd.set(d, (wd.get(d) ?? 0) + 1)
    }
    const [day, n] = [...wd.entries()].sort((a, b) => b[1] - a[1])[0]
    if (n >= 2) s += ` ${weekdayName.format(new Date(2026, 1, 1 + day))}s seem tricky (${n}×).`
  }
  return s
}

function time(all: Attack[], r: Range) {
  const list_ = inRange(all, r)
  if (!list_.length) return `No migraines ${r.label} to time.`
  const parts = [
    { name: 'the morning', test: (h: number) => h >= 5 && h < 12 },
    { name: 'the afternoon', test: (h: number) => h >= 12 && h < 17 },
    { name: 'the evening', test: (h: number) => h >= 17 && h < 22 },
    { name: 'the night', test: (h: number) => h >= 22 || h < 5 },
  ].map((p) => ({ ...p, n: list_.filter((a) => p.test(new Date(a.started_at).getHours())).length }))
  const top = parts.sort((a, b) => b.n - a.n)[0]
  return `They usually start in ${top.name}: ${top.n} of ${plural(list_.length, 'migraine')} ${r.label}.`
}

function symptoms(all: Attack[], r: Range) {
  const list_ = inRange(all, r)
  const t = tally(list_, 'symptoms')
  if (!t.length) return `No symptoms noted ${r.label}.`
  return `Most often you felt ${list(t.slice(0, 3).map(([v, n]) => `${lower(v)} (${n}×)`))} ${r.label}.`
}

function count(all: Attack[], r: Range) {
  const list_ = inRange(all, r)
  if (!list_.length) return `Zero migraines ${r.label}. Wonderful.`
  const hit = new Set(list_.flatMap((a) => daysTouched(a.started_at, a.ended_at))).size
  const avg = list_.reduce((s, a) => s + level(a.intensity), 0) / list_.length
  const done = list_.filter((a) => a.ended_at)
  const len = done.length ? done.reduce((s, a) => s + attackDuration(a.started_at, a.ended_at), 0) / done.length : null
  return `${plural(list_.length, 'migraine')} ${r.label}, across ${plural(hit, 'day')}. Usually ${levelLabel(Math.round(avg) * 2).toLowerCase()}${len ? `, lasting about ${formatDuration(len)}` : ''}.`
}

function compare(all: Attack[], now = new Date()) {
  const thisStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  const lastStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime()
  const a = inRange(all, { from: thisStart, to: now.getTime(), label: '' }).length
  const b = inRange(all, { from: lastStart, to: thisStart, label: '' }).length
  const last = monthName.format(new Date(lastStart))
  if (a < b) return `Yes! ${plural(a, 'migraine')} so far this month vs ${b} in ${last}. Keep it up.`
  if (a > b) return `A bit rougher: ${plural(a, 'migraine')} this month vs ${b} in ${last}. Hang in there.`
  return `About the same: ${plural(a, 'migraine')} this month and ${b} in ${last}.`
}

function streak(all: Attack[], now = new Date()) {
  if (!all.length) return `You haven't logged any migraines yet. Calm waters since forever!`
  if (all.some((a) => !a.ended_at)) return `You're in the middle of one right now. I'm right here with you.`
  const hit = new Set(all.flatMap((a) => daysTouched(a.started_at, a.ended_at)))
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  let current = 0
  for (const d = new Date(today); !hit.has(dayKey(d)); d.setDate(d.getDate() - 1)) current++
  // longest calm run between the first entry and today
  const first = new Date(all[all.length - 1].started_at)
  first.setHours(0, 0, 0, 0)
  let longest = 0
  let run = 0
  for (const d = new Date(first); d <= today; d.setDate(d.getDate() + 1)) {
    run = hit.has(dayKey(d)) ? 0 : run + 1
    longest = Math.max(longest, run)
  }
  const s = `You've been calm for ${plural(current, 'day')}.`
  return current >= longest && current > 0 ? `${s} That's your longest stretch yet!` : `${s} Your longest stretch was ${plural(longest, 'day')}.`
}

export function answer(question: string, attacks: Attack[], now = new Date()): string {
  const q = question.toLowerCase().trim()
  const topic = TOPICS.find(([, re]) => re.test(q))?.[0]
  const r = parseRange(q, now)
  switch (topic) {
    case 'triggers':
      return triggers(attacks, r)
    case 'helped':
      return helped(attacks, r)
    case 'days':
      return days(attacks, r)
    case 'time':
      return time(attacks, r)
    case 'symptoms':
      return symptoms(attacks, r)
    case 'count':
      return count(attacks, r)
    case 'compare':
      return compare(attacks, now)
    case 'streak':
      return streak(attacks, now)
    case 'hello':
      return `Hi! Ask me what triggered you, what helped, or which days were rough.`
    default:
      return `Hmm, I'm a simple paper boat. I can tell you about triggers, what helped, which days, what time they start, or how this month compares. Try one of the bubbles!`
  }
}
