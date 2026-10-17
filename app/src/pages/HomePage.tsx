import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAttacks } from '../lib/store'
import { level } from '../lib/attacks'
import { daysTouched } from '../lib/format'
import { clearDays } from '../lib/days'
import { EntryRow, Fig, Readout } from '../components/Instrument'
import { Trace } from '../components/Trace'
import { Glyph } from '../components/Glyph'
import { LogoMark, Wordmark } from '../components/Logo'

const DAY = 86_400_000
const today = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
const tick = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' })
const hm = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })

/** Current time, refreshed every `ms` (every second while the stopwatch is running). */
function useNow(ms: number) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}

function stopwatch(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`
}

export function HomePage() {
  const { attacks, loading, error, save } = useAttacks()
  const ongoing = attacks.find((a) => !a.ended_at)
  const now = useNow(ongoing ? 1000 : 60_000)
  const [ending, setEnding] = useState(false)

  const from = new Date(now - 29 * DAY)
  from.setHours(0, 0, 0, 0)
  const ticks = [0, 7, 14, 21, 28].map((day) => ({ day, label: tick.format(new Date(from.getTime() + day * DAY)) }))

  const recent = attacks.filter((a) => new Date(a.started_at).getTime() >= from.getTime())
  const monthStart = new Date(now)
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)
  const thisMonth = attacks.filter((a) => new Date(a.started_at) >= monthStart).length
  const avgLevel = recent.length ? recent.reduce((s, a) => s + level(a.intensity), 0) / recent.length : null
  const migraineDays = new Set(recent.flatMap((a) => daysTouched(a.started_at, a.ended_at))).size
  const streak = clearDays(attacks)
  const lastEnd = attacks.find((a) => a.ended_at)?.ended_at

  // Ends every open entry (normally one, but a double-logged migraine shouldn't get stuck).
  async function endOngoing() {
    const open = attacks.filter((a) => !a.ended_at)
    if (!open.length) return
    setEnding(true)
    const endedAt = new Date().toISOString()
    try {
      await Promise.all(open.map(({ id, ...rest }) => save({ ...rest, ended_at: endedAt }, id)))
    } finally {
      setEnding(false)
    }
  }

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">
          <LogoMark size={30} tile={false} />
          <Wordmark />
        </div>
        <span className="topbar-date">{today.format(now)}</span>
        <Link to="/settings" className="icon-btn" aria-label="Settings">
          <Glyph name="settings" size={22} />
        </Link>
      </header>

      {error && <p className="notice">Couldn't load your record: {error}</p>}

      <section className="hero" aria-live="polite">
        {ongoing ? (
          <>
            <p className="kicker kicker-live">Recording</p>
            <h1 className="statement">Migraine in progress.</h1>
            <p className="stopwatch">{stopwatch(now - new Date(ongoing.started_at).getTime())}</p>
            <div className="btn-row">
              <button className="btn btn-pen" onClick={endOngoing} disabled={ending}>
                {ending ? 'Saving…' : 'It’s over'}
              </button>
              <Link to={`/log/${ongoing.id}`} className="btn">
                Edit entry
              </Link>
            </div>
          </>
        ) : (
          <>
            <h1 className="statement">
              {loading
                ? ' '
                : streak === null
                  ? 'Nothing recorded yet.'
                  : streak === 0
                    ? `Clear since ${hm.format(new Date(lastEnd!))}.`
                    : `Clear for ${streak} ${streak === 1 ? 'day' : 'days'}.`}
            </h1>
            <Link to="/log" className="record-btn">
              <span className="record-dot">
                <Glyph name="plus" size={28} />
              </span>
              <span className="record-text">
                Log a migraine
                <small>takes five seconds</small>
              </span>
            </Link>
          </>
        )}
      </section>

      <section>
        <Trace
          attacks={attacks}
          from={from}
          days={30}
          now={now}
          ticks={ticks}
          label={`Last 30 days: ${recent.length} migraines on ${migraineDays} days`}
        />
        <Fig n={1}>Last 30 days. Spike height is how bad; width is how long.</Fig>
      </section>

      <section className="readouts">
        <Readout label="This month" value={String(thisMonth).padStart(2, '0')} />
        <Readout label="Days hit · 30d" value={String(migraineDays).padStart(2, '0')} />
        <Readout label="Avg level" value={avgLevel === null ? '–' : avgLevel.toFixed(1)} unit="/5" />
      </section>

      <section>
        <div className="section-head">
          <h2 className="label">Latest entries</h2>
          {attacks.length > 3 && <Link to="/diary">Full record</Link>}
        </div>
        {loading ? (
          <p className="muted">Loading…</p>
        ) : attacks.length === 0 ? (
          <p className="empty">No entries yet. The line stays flat until you need it.</p>
        ) : (
          <div className="entries">
            {attacks.slice(0, 3).map((a) => (
              <EntryRow key={a.id} attack={a} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
