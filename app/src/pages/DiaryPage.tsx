import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAttacks } from '../lib/store'
import type { Attack } from '../lib/attacks'
import { dayKey, daysTouched } from '../lib/format'
import { DiaryLine } from '../components/Journal'
import { Wave } from '../components/Wave'
import { Glyph } from '../components/Glyph'

const PAGE = 6
const monthFmt = new Intl.DateTimeFormat(undefined, { month: 'long' })
const yearFmt = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' })

/** The journal: one tide per month (newest first) with that month's pages underneath. */
export function DiaryPage() {
  const { attacks, loading } = useAttacks()
  const [shown, setShown] = useState(PAGE)

  // Every month from the oldest entry up to this month, newest first.
  const months: Date[] = []
  const cur = new Date()
  const first = attacks.length ? new Date(attacks[attacks.length - 1].started_at) : cur
  for (let d = new Date(cur.getFullYear(), cur.getMonth(), 1); d >= new Date(first.getFullYear(), first.getMonth(), 1); d.setMonth(d.getMonth() - 1))
    months.push(new Date(d))

  return (
    <div className="page">
      <header className="topbar">
        <h1 className="hand-title">Journal</h1>
        <Link to="/log" className="icon-btn icon-btn-deep" aria-label="Log a migraine">
          <Glyph name="plus" size={22} />
        </Link>
      </header>

      {loading ? <p className="muted">Loading…</p> : months.slice(0, shown).map((m) => <Month key={m.getTime()} month={m} attacks={attacks} />)}

      {months.length > shown && (
        <button className="btn btn-soft" onClick={() => setShown(shown + PAGE)}>
          Earlier months
        </button>
      )}
    </div>
  )
}

function Month({ month, attacks }: { month: Date; attacks: Attack[] }) {
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 1).getTime()
  const isThisYear = month.getFullYear() === new Date().getFullYear()
  const list = attacks.filter((a) => {
    const t = new Date(a.started_at).getTime()
    return t >= month.getTime() && t < end
  })
  const monthKey = dayKey(month).slice(0, 7)
  const hitDays = new Set(list.flatMap((a) => daysTouched(a.started_at, a.ended_at)).filter((k) => k.startsWith(monthKey))).size
  const name = isThisYear ? monthFmt.format(month) : yearFmt.format(month)

  return (
    <section className="month">
      <div className="month-head">
        <h2 className="hand">{name}</h2>
        <span className="muted">{list.length ? `${list.length} migraine${list.length === 1 ? '' : 's'} · ${hitDays} day${hitDays === 1 ? '' : 's'}` : 'all calm'}</span>
      </div>
      <div className="card sea-card">
        <Wave attacks={attacks} from={month} days={days} label={`${name}: ${list.length} migraines`} />
      </div>
      {list.length > 0 ? (
        <div className="card diary">
          {list.map((a) => (
            <DiaryLine key={a.id} attack={a} />
          ))}
        </div>
      ) : (
        <p className="empty">Not a ripple this month.</p>
      )}
    </section>
  )
}
