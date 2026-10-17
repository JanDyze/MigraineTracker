import { useState } from 'react'
import { useAttacks } from '../lib/store'
import { dayKey, daysTouched, formatMonth } from '../lib/format'
import type { Attack } from '../lib/attacks'
import { EntryRow } from '../components/Instrument'
import { Trace } from '../components/Trace'

const PAGE = 6

/** The record: one trace strip per month (newest first) with that month's entries underneath. */
export function DiaryPage() {
  const { attacks, loading } = useAttacks()
  const [shown, setShown] = useState(PAGE)
  const now = Date.now()

  // Every month from the oldest entry up to this month, newest first.
  const months: Date[] = []
  const cur = new Date()
  const first = attacks.length ? new Date(attacks[attacks.length - 1].started_at) : cur
  for (let d = new Date(cur.getFullYear(), cur.getMonth(), 1); d >= new Date(first.getFullYear(), first.getMonth(), 1); d.setMonth(d.getMonth() - 1))
    months.push(new Date(d))

  return (
    <div className="page">
      <header className="topbar">
        <h1 className="title">Record</h1>
        <span className="topbar-date">
          {attacks.length} {attacks.length === 1 ? 'entry' : 'entries'}
        </span>
      </header>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        months.slice(0, shown).map((m) => <Month key={m.getTime()} month={m} attacks={attacks} now={now} />)
      )}

      {months.length > shown && (
        <button className="btn btn-quiet" onClick={() => setShown(shown + PAGE)}>
          Show earlier months
        </button>
      )}
    </div>
  )
}

function Month({ month, attacks, now }: { month: Date; attacks: Attack[]; now: number }) {
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 1).getTime()
  const isCurrent = now < end
  const list = attacks.filter((a) => {
    const t = new Date(a.started_at).getTime()
    return t >= month.getTime() && t < end
  })
  const monthKey = dayKey(month).slice(0, 7) // "2026-10"
  const hitDays = new Set(list.flatMap((a) => daysTouched(a.started_at, a.ended_at)).filter((k) => k.startsWith(monthKey))).size

  return (
    <section className="month">
      <div className="month-head">
        <h2 className="month-name">{formatMonth(month)}</h2>
        <span className="label">
          {String(list.length).padStart(2, '0')} migraines · {String(hitDays).padStart(2, '0')} days
        </span>
      </div>
      <Trace
        attacks={attacks}
        from={month}
        days={days}
        now={isCurrent ? now : undefined}
        ticks={[1, 8, 15, 22, 29].filter((d) => d <= days).map((d) => ({ day: d - 1, label: String(d) }))}
        height={96}
        label={`${formatMonth(month)}: ${list.length} migraines`}
      />
      {list.length === 0 ? (
        <p className="empty">{isCurrent ? 'Flat line so far this month.' : 'A flat line. Clear all month.'}</p>
      ) : (
        <div className="entries">
          {list.map((a) => (
            <EntryRow key={a.id} attack={a} />
          ))}
        </div>
      )}
    </section>
  )
}
