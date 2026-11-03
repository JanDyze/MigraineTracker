import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAttacks } from '../lib/store'
import { labelFor, level, levelLabel, type Attack, type TagField } from '../lib/attacks'
import { attackDuration, daysTouched, formatDuration } from '../lib/format'
import { Tile } from '../components/Journal'
import { Boat } from '../components/Boat'

const RANGES = [
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
  { days: 0, label: 'All' },
]

const DAY = 86_400_000

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
        <p className="empty">A few more pages and patterns start to show.</p>
      ) : (
        <>
          <Bars title="Usual suspects" rows={rank(inRange, 'triggers', inRange.length)} empty="No triggers ticked yet." />
          <Onset attacks={inRange} />
          <Bars title="How it feels" rows={rank(inRange, 'symptoms', inRange.length)} empty="No symptoms ticked yet." />
          <Bars title="What helped" rows={meds(inRange)} empty="No medication noted yet." />
        </>
      )}
    </div>
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
    for (const v of a.medications) {
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
    .map(([v, e]) => ({ label: v.toLowerCase(), count: e.took, note: e.rated ? `helped ${e.helped} of ${e.rated}` : `${e.took}×` }))
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
