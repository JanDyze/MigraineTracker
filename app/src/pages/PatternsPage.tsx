import { useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { useAttacks } from '../lib/store'
import { LOCATIONS, labelFor, level, levelLabel, type Attack, type TagField } from '../lib/attacks'
import { attackDuration, daysTouched, formatDuration } from '../lib/format'
import { attacksByDay, dayKey, worstLevel } from '../lib/days'
import { Glyph } from '../components/Glyph'
import { Tile } from '../components/Journal'
import { Boat } from '../components/Boat'

/*
 * Everything the journal can tell you, on one page:
 *   the chosen range (30 days, 90 days, all) – the headline numbers, then what sets migraines off,
 *     when they start, which weekdays, where it hurts, how they feel and what helped
 *   the long view – migraine days per month against the 15-day line doctors use, and a calendar
 *     of the last 20 weeks
 *   a summary of the last 3 months to show a doctor
 * Tapping or hovering a bar or a day writes its exact value into the chart's readout.
 */

const RANGES = [
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
  { days: 0, label: 'All' },
]

const DAY = 86_400_000
const CHRONIC = 15 // headache days a month at which doctors speak of chronic migraine
const monthShort = new Intl.DateTimeFormat(undefined, { month: 'narrow' })
const monthLong = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' })
const monthName = new Intl.DateTimeFormat(undefined, { month: 'short' })
const dayLong = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function PatternsPage() {
  const { attacks, loading } = useAttacks()
  const [rangeDays, setRangeDays] = useState(30)

  const inRange = useMemo(() => {
    if (!rangeDays) return attacks
    const since = Date.now() - rangeDays * DAY
    return attacks.filter((a) => new Date(a.started_at).getTime() >= since)
  }, [attacks, rangeDays])

  if (loading) return <div className="page muted">Loading…</div>

  const days = new Set(inRange.flatMap((a) => daysTouched(a.started_at, a.ended_at))).size
  const avg = inRange.length ? inRange.reduce((s, a) => s + level(a.intensity), 0) / inRange.length : null
  const finished = inRange.filter((a) => a.ended_at)
  const avgLength = finished.length ? finished.reduce((s, a) => s + attackDuration(a.started_at, a.ended_at), 0) / finished.length : null

  return (
    <div className="page">
      <header className="topbar">
        <h1 className="hand-title">Patterns</h1>
      </header>
      {attacks.length === 0 ? (
        <p className="empty">Log your first migraine and your charts show up here.</p>
      ) : (
        <>
          <div className="pills" role="radiogroup" aria-label="Time range">
            {RANGES.map((r) => (
              <button key={r.days} type="button" role="radio" aria-checked={rangeDays === r.days} onClick={() => setRangeDays(r.days)}>
                {r.label}
              </button>
            ))}
          </div>

          <section className="tiles">
            <Tile value={inRange.length} label="migraines" />
            <Tile value={days} label="days hit" />
            <Tile value={avg === null ? '–' : levelLabel(Math.round(avg) * 2).toLowerCase()} label="usually" />
            <Tile value={avgLength === null ? '–' : formatDuration(avgLength)} label="average length" />
          </section>

          <Link to="/chat" className="card ask-grami">
            <Boat mood="talk" size={92} water={false} />
            <span>
              <b>Want it in words?</b>
              <span className="muted">Ask Grami what triggered you or what helped.</span>
            </span>
          </Link>

          {inRange.length < 3 ? (
            <p className="empty">A few more pages in this range and patterns start to show.</p>
          ) : (
            <>
              <Bars title="Usual suspects" rows={rank(inRange, 'triggers', inRange.length)} empty="No triggers ticked yet." />
              <Onset attacks={inRange} />
              <Weekdays attacks={inRange} />
              <Where attacks={inRange} />
              <Bars title="How it feels" rows={rank(inRange, 'symptoms', inRange.length)} empty="No symptoms ticked yet." />
              <Bars title="What helped" rows={meds(inRange)} empty="No medicine or remedies noted yet." />
            </>
          )}

          <Trend attacks={attacks} />
          <Calendar attacks={attacks} />
          <DoctorSummary attacks={attacks} />
        </>
      )}
    </div>
  )
}

/** Migraine days per month for the last 12 months, with the chronic line. */
function Trend({ attacks }: { attacks: Attack[] }) {
  const days = [...attacksByDay(attacks).keys()]
  const now = new Date()
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1)
    const key = dayKey(d).slice(0, 7)
    return { d, n: days.filter((k) => k.startsWith(key)).length, current: i === 11 }
  })
  const top = Math.max(CHRONIC + 3, ...months.map((m) => m.n))
  const say = (m: (typeof months)[number]) =>
    `${monthLong.format(m.d)}: ${m.n} migraine ${m.n === 1 ? 'day' : 'days'}${m.current ? ' so far' : ''}`
  const [readout, setReadout] = useState(() => say(months[11]))
  const avg = months.slice(-4, -1).reduce((s, m) => s + m.n, 0) / 3

  return (
    <section className="card chart">
      <h2 className="hand">Migraine days a month</h2>
      <p className="chart-sub muted">Last 3 full months: {avg.toFixed(1)} a month on average</p>
      <div className="trend" style={{ '--chronic': `${(CHRONIC / top) * 100}%` } as CSSProperties}>
        <span className="trend-line" aria-hidden="true">
          <span>{CHRONIC} days: chronic</span>
        </span>
        {months.map((m) => (
          <button
            key={m.d.getTime()}
            type="button"
            className="trend-col"
            aria-label={say(m)}
            onPointerEnter={() => setReadout(say(m))}
            onFocus={() => setReadout(say(m))}
            onClick={() => setReadout(say(m))}
          >
            <span className={`trend-bar${m.current ? ' is-partial' : ''}`} style={{ height: `${(m.n / top) * 100}%` }} />
            <span className="trend-label">{monthShort.format(m.d)}</span>
          </button>
        ))}
      </div>
      <p className="readout" aria-live="polite">
        {readout}
      </p>
    </section>
  )
}

/** The last 20 weeks, one square per day, coloured by the worst migraine that day. */
function Calendar({ attacks }: { attacks: Attack[] }) {
  const byDay = attacksByDay(attacks)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = new Date(today)
  start.setDate(start.getDate() - ((today.getDay() + 6) % 7) - 19 * 7) // Monday, 19 weeks before this one
  const cells = Array.from({ length: 20 * 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    const list = byDay.get(dayKey(d))
    return { d, future: d > today, lvl: worstLevel(list), list }
  })
  const say = (c: (typeof cells)[number]) =>
    `${dayLong.format(c.d)}: ${c.list?.length ? levelLabel(Math.max(...c.list.map((a) => a.intensity))) : 'calm'}`
  const [readout, setReadout] = useState('Tap a day to see it.')
  const hit = cells.filter((c) => !c.future && c.lvl).length

  return (
    <section className="card chart">
      <h2 className="hand">Last 20 weeks</h2>
      <p className="chart-sub muted">
        {hit} of {cells.filter((c) => !c.future).length} days had a migraine
      </p>
      {/* one grid: a column of weekday letters, then a column per week, filled top to bottom */}
      <div className="heat-months" aria-hidden="true">
        <span />
        {(() => {
          // label the week each month starts in, skipping one that would crowd the previous label
          let last = -9
          return Array.from({ length: 20 }, (_, w) => {
            const first = cells[w * 7].d
            const startsMonth = w === 0 || first.getMonth() !== cells[(w - 1) * 7].d.getMonth()
            const show = startsMonth && w - last >= 3
            if (show) last = w
            return <span key={w}>{show ? monthName.format(first) : ''}</span>
          })
        })()}
      </div>
      <div className="heat" role="img" aria-label={`${hit} migraine days in the last 20 weeks`}>
        {WEEKDAYS.map((w, i) => (
          <span key={w} className="heat-wd">
            {i % 2 === 0 ? w[0] : ''}
          </span>
        ))}
        {cells.map((c) => (
          <span
            key={c.d.getTime()}
            className={c.future ? 'is-future' : c.lvl ? `lvl-${c.lvl}` : ''}
            onPointerEnter={() => !c.future && setReadout(say(c))}
            onClick={() => !c.future && setReadout(say(c))}
          />
        ))}
      </div>
      <div className="heat-legend" aria-hidden="true">
        <span>calm</span>
        <i />
        {[1, 2, 3, 4, 5].map((l) => (
          <i key={l} className={`lvl-${l}`} />
        ))}
        <span>worst</span>
      </div>
      <p className="readout" aria-live="polite">
        {readout}
      </p>
    </section>
  )
}

/** Which weekdays migraines start on. */
function Weekdays({ attacks }: { attacks: Attack[] }) {
  const counts = WEEKDAYS.map((_, i) => attacks.filter((a) => (new Date(a.started_at).getDay() + 6) % 7 === i).length)
  const max = Math.max(1, ...counts)
  const worst = counts.indexOf(Math.max(...counts))
  return (
    <section className="card chart">
      <h2 className="hand">Worst weekdays</h2>
      <p className="chart-sub muted">Most often on a {WEEKDAYS[worst]}</p>
      <ol className="onset onset-7">
        {WEEKDAYS.map((w, i) => (
          <li key={w} aria-label={`${w}: ${counts[i]}`}>
            <span className="onset-n">{counts[i] || ''}</span>
            <span className="onset-bar" style={{ height: `${(counts[i] / max) * 70}%` }} />
            <span className="onset-label">{w.slice(0, 2)}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

/** Where it hurts, with the little head icons from the log screen. */
function Where({ attacks }: { attacks: Attack[] }) {
  const m = new Map<string, number>()
  for (const a of attacks) for (const v of a.locations) m.set(v, (m.get(v) ?? 0) + 1)
  const rows = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
  const max = Math.max(1, ...rows.map((r) => r[1]))
  return (
    <section className="card chart">
      <h2 className="hand">Where it hurts</h2>
      {rows.length === 0 ? (
        <p className="empty">No pain spots ticked yet.</p>
      ) : (
        <ol className="bars">
          {rows.map(([v, n]) => (
            <li key={v} className="where-row">
              <Glyph name={LOCATIONS.find((l) => l.value === v)?.icon ?? 'head'} size={30} />
              <div>
                <div className="bar-label">
                  <span>{labelFor(v)}</span>
                  <span className="muted">
                    {n} of {attacks.length}
                  </span>
                </div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${(n / max) * 100}%` }} />
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

/** The last 3 months in the terms a doctor asks about, with a button to copy it as text. */
function DoctorSummary({ attacks }: { attacks: Attack[] }) {
  const [copied, setCopied] = useState(false)
  const since = Date.now() - 90 * DAY
  const recent = attacks.filter((a) => new Date(a.started_at).getTime() >= since)
  const byDay = attacksByDay(recent)
  const perMonth = (n: number) => (n / 3).toFixed(1)
  const medDays = [...byDay.values()].filter((list) => list.some((a) => a.medications.length)).length
  const finished = recent.filter((a) => a.ended_at)
  const avgLen = finished.length ? finished.reduce((s, a) => s + attackDuration(a.started_at, a.ended_at), 0) / finished.length : null
  const avgInt = recent.length ? recent.reduce((s, a) => s + a.intensity, 0) / recent.length : null
  const count = (pick: (a: Attack) => string[]) => {
    const m = new Map<string, number>()
    for (const a of recent) for (const v of pick(a)) m.set(v, (m.get(v) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }
  const triggers = count((a) => a.triggers).slice(0, 3)
  const meds = count((a) => [...a.medications, ...a.remedies]).map(([v, took]) => {
    const rated = recent.filter((a) => (a.medications.includes(v) || a.remedies.includes(v)) && a.relief !== null)
    return { v, took, rated: rated.length, helped: rated.filter((a) => a.relief! >= 2).length }
  })

  const rows: [string, string][] = [
    ['Migraine days a month', perMonth(byDay.size)],
    ['Migraines', String(recent.length)],
    ['Usual severity', avgInt === null ? '–' : `${levelLabel(avgInt)} (${avgInt.toFixed(1)} of 10)`],
    ['Usual length', avgLen === null ? '–' : formatDuration(avgLen)],
    ['Days with medicine a month', perMonth(medDays)],
  ]
  const text = [
    'Migraine summary, last 3 months (from Might)',
    ...rows.map(([k, v]) => `${k}: ${v}`),
    `Top triggers: ${triggers.map(([v, n]) => `${labelFor(v).toLowerCase()} (${n})`).join(', ') || 'none noted'}`,
    ...meds.map((m) => `${labelFor(m.v)}: used ${m.took}×${m.rated ? `, helped ${m.helped} of ${m.rated}` : ''}`),
  ].join('\n')

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section className="card chart">
      <h2 className="hand">For your doctor</h2>
      <p className="chart-sub muted">The last 3 months</p>
      <dl className="summary">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
        <div>
          <dt>Top triggers</dt>
          <dd>{triggers.map(([v]) => labelFor(v).toLowerCase()).join(', ') || '–'}</dd>
        </div>
        {meds.map((m) => (
          <div key={m.v}>
            <dt>{labelFor(m.v)}</dt>
            <dd>
              used {m.took}×{m.rated ? `, helped ${m.helped} of ${m.rated}` : ''}
            </dd>
          </div>
        ))}
      </dl>
      <button type="button" className="btn btn-soft btn-block" onClick={copy}>
        <Glyph name="note" size={18} />
        {copied ? 'Copied' : 'Copy as text'}
      </button>
    </section>
  )
}

type Row = { label: string; count: number; note: string }

function rank(attacks: Attack[], field: TagField, total: number): Row[] {
  const m = new Map<string, number>()
  for (const a of attacks) for (const v of a[field]) m.set(v, (m.get(v) ?? 0) + 1)
  return [...m.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([v, n]) => ({ label: labelFor(v).toLowerCase(), count: n, note: `${n} of ${total}` }))
}

function meds(attacks: Attack[]): Row[] {
  const m = new Map<string, { took: number; rated: number; helped: number }>()
  for (const a of attacks)
    for (const v of [...a.medications, ...a.remedies]) {
      const e = m.get(v) ?? { took: 0, rated: 0, helped: 0 }
      e.took++
      if (a.relief !== null) {
        e.rated++
        if (a.relief >= 2) e.helped++
      }
      m.set(v, e)
    }
  return [...m.entries()]
    .sort((a, b) => b[1].took - a[1].took)
    .slice(0, 5)
    .map(([v, e]) => ({ label: labelFor(v).toLowerCase(), count: e.took, note: e.rated ? `helped ${e.helped} of ${e.rated}` : `${e.took}×` }))
}

function Bars({ title, rows, empty }: { title: string; rows: Row[]; empty: string }) {
  const max = Math.max(1, ...rows.map((r) => r.count))
  return (
    <section className="card">
      <h2 className="hand">{title}</h2>
      {rows.length === 0 ? (
        <p className="empty">{empty}</p>
      ) : (
        <ol className="bars">
          {rows.map((r) => (
            <li key={r.label}>
              <div className="bar-label">
                <span>{r.label}</span>
                <span className="muted">{r.note}</span>
              </div>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${(r.count / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

/** When migraines start: four parts of the day. */
function Onset({ attacks }: { attacks: Attack[] }) {
  const parts = [
    { label: 'morning', test: (h: number) => h >= 5 && h < 12 },
    { label: 'afternoon', test: (h: number) => h >= 12 && h < 17 },
    { label: 'evening', test: (h: number) => h >= 17 && h < 22 },
    { label: 'night', test: (h: number) => h >= 22 || h < 5 },
  ].map((p) => ({ ...p, n: attacks.filter((a) => p.test(new Date(a.started_at).getHours())).length }))
  const max = Math.max(1, ...parts.map((p) => p.n))
  return (
    <section className="card">
      <h2 className="hand">When they start</h2>
      <ol className="onset">
        {parts.map((p) => (
          <li key={p.label} aria-label={`${p.label}: ${p.n}`}>
            <span className="onset-n">{p.n || ''}</span>
            <span className="onset-bar" style={{ height: `${(p.n / max) * 70}%` }} />
            <span className="onset-label">{p.label}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}
