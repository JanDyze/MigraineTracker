import { useMemo, useState } from 'react'
import { useAttacks } from '../lib/store'
import { labelFor, level, presetFor, type Attack, type TagField } from '../lib/attacks'
import { attackDuration, daysTouched, formatDuration } from '../lib/format'
import { Fig, Readout } from '../components/Instrument'
import { Glyph } from '../components/Glyph'

const RANGES = [
  { days: 30, label: '30 D' },
  { days: 90, label: '90 D' },
  { days: 0, label: 'All' },
]

const DAY = 86_400_000

/** Findings: what the record says, as numbered figures. */
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
        <h1 className="title">Findings</h1>
        <div className="segmented" role="radiogroup" aria-label="Time range">
          {RANGES.map((r) => (
            <button key={r.days} type="button" role="radio" aria-checked={rangeDays === r.days} onClick={() => setRangeDays(r.days)}>
              {r.label}
            </button>
          ))}
        </div>
      </header>

      <section className="readouts readouts-2">
        <Readout label="Migraines" value={String(inRange.length).padStart(2, '0')} />
        <Readout label="Days hit" value={String(days).padStart(2, '0')} />
        <Readout label="Avg level" value={avg === null ? '–' : avg.toFixed(1)} unit="/5" />
        <Readout label="Avg length" value={avgLength === null ? '–' : formatDuration(avgLength)} />
      </section>

      {inRange.length < 3 ? (
        <p className="empty">A few more entries and the findings start to mean something.</p>
      ) : (
        <>
          <Ranked n={1} title="Possible triggers" field="triggers" attacks={inRange} />
          <Onset n={2} attacks={inRange} />
          <Ranked n={3} title="Symptoms" field="symptoms" attacks={inRange} />
          <Medication n={4} attacks={inRange} />
        </>
      )}
    </div>
  )
}

function topValues(attacks: Attack[], field: TagField) {
  const map = new Map<string, Attack[]>()
  for (const a of attacks) for (const v of a[field]) map.set(v, [...(map.get(v) ?? []), a])
  return [...map.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 5)
}

type Row = { value: string; icon: string; count: number; note: string }

function Bars({ n, title, rows, empty }: { n: number; title: string; rows: Row[]; empty: string }) {
  const max = Math.max(1, ...rows.map((r) => r.count))
  return (
    <section className="figure">
      <Fig n={n}>{title}</Fig>
      {rows.length === 0 ? (
        <p className="empty">{empty}</p>
      ) : (
        <ol className="bars">
          {rows.map((r) => (
            <li key={r.value}>
              <div className="bar-label">
                <Glyph name={r.icon} size={20} />
                <span>{labelFor(r.value)}</span>
                <span className="bar-note">{r.note}</span>
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

function Ranked({ n, title, field, attacks }: { n: number; title: string; field: TagField; attacks: Attack[] }) {
  const rows = topValues(attacks, field).map(([value, list]) => ({
    value,
    icon: presetFor(value)?.icon ?? 'question',
    count: list.length,
    note: `${list.length}× · ${Math.round((list.length / attacks.length) * 100)}%`,
  }))
  return <Bars n={n} title={title} rows={rows} empty="Nothing noted yet." />
}

function Medication({ n, attacks }: { n: number; attacks: Attack[] }) {
  const rows = topValues(attacks, 'medications').map(([value, list]) => {
    const rated = list.filter((a) => a.relief !== null)
    const helped = rated.filter((a) => (a.relief ?? 0) >= 2).length
    return { value, icon: 'pill', count: list.length, note: rated.length ? `helped ${helped}/${rated.length}` : `${list.length}×` }
  })
  return <Bars n={n} title="Medication taken" rows={rows} empty="No medication noted yet." />
}

/** When migraines start, in 3-hour bins. */
function Onset({ n, attacks }: { n: number; attacks: Attack[] }) {
  const bins = Array.from({ length: 8 }, () => 0)
  for (const a of attacks) bins[Math.floor(new Date(a.started_at).getHours() / 3)]++
  const max = Math.max(1, ...bins)
  const peak = bins.indexOf(Math.max(...bins))
  const hh = (h: number) => String(h).padStart(2, '0')
  return (
    <section className="figure">
      <Fig n={n}>
        Time of onset. Most often {hh(peak * 3)}:00–{hh(peak * 3 + 3)}:00
      </Fig>
      <ol className="onset">
        {bins.map((c, i) => (
          <li key={i} aria-label={`${hh(i * 3)}:00 to ${hh(i * 3 + 3)}:00: ${c}`}>
            <span className="onset-count">{c || ''}</span>
            <span className="onset-bar" style={{ height: `${(c / max) * 72}%` }} />
            <span className="onset-hour">{hh(i * 3)}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}
