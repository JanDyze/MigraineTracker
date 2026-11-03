import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAttacks } from '../lib/store'
import { levelLabel } from '../lib/attacks'
import { attackDuration, formatDuration } from '../lib/format'
import { clearDays } from '../lib/days'
import { DiaryLine, Tile } from '../components/Journal'
import { Wave } from '../components/Wave'
import { Boat } from '../components/Boat'
import { Glyph } from '../components/Glyph'
import { LogoMark, Wordmark } from '../components/Logo'

const DAY = 86_400_000
const longDate = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
const shortDate = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' })
const hm = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })

/** Re-render every minute so "rough waters for 2 h 10 m" stays current. */
function useNow() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])
  return now
}

export function HomePage() {
  const { attacks, loading, error, save } = useAttacks()
  const now = useNow()
  const [ending, setEnding] = useState(false)

  const ongoing = attacks.find((a) => !a.ended_at)
  const from = new Date(now - 13 * DAY)
  from.setHours(0, 0, 0, 0)
  const monthStart = new Date(now)
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)
  const thisMonth = attacks.filter((a) => new Date(a.started_at) >= monthStart).length
  const lengths = attacks
    .filter((a) => a.ended_at)
    .slice(0, 20)
    .map((a) => attackDuration(a.started_at, a.ended_at))
    .sort((a, b) => a - b)
  const usual = lengths.length ? formatDuration(lengths[Math.floor(lengths.length / 2)]) : '–'
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

  let headline = 'Calm waters'
  let sub = 'Nothing logged yet. Tap below when a migraine hits.'
  if (ongoing) {
    headline = 'Rough waters'
    sub = `${levelLabel(ongoing.intensity)}, for ${formatDuration(attackDuration(ongoing.started_at, null, now))}. Grami's here with you.`
  } else if (streak === 0 && lastEnd) {
    headline = 'Calm again'
    sub = `since ${hm.format(new Date(lastEnd))}. Take it easy today.`
  } else if (streak !== null) {
    headline = `${streak} calm ${streak === 1 ? 'day' : 'days'}`
    sub = streak >= 3 ? 'in a row. Smooth sailing.' : 'in a row. Nice.'
  }

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">
          <LogoMark size={30} tile={false} />
          <Wordmark />
        </div>
        <Link to="/settings" className="icon-btn" aria-label="Settings">
          <Glyph name="settings" size={22} />
        </Link>
      </header>

      {error && <p className="notice">Couldn't load your journal: {error}</p>}

      <section className="hello" aria-live="polite">
        <span className="hand-date">{longDate.format(now)}</span>
        <h1 className="headline">
          <mark key={loading ? 'loading' : headline}>{loading ? ' ' : headline}</mark>
        </h1>
        <p className="sub">{loading ? ' ' : sub}</p>
      </section>

      <section className="card sea-card">
        <div className="card-head">
          <h2>Last two weeks</h2>
          {/* Grami floats in the corner of the tide; tap to chat */}
          <Link to="/chat" className="grami" aria-label="Ask Grami about your migraines">
            <span className="grami-hint" aria-hidden="true">
              ask me!
            </span>
            <Boat mood={ongoing ? 'hurt' : 'calm'} size={120} />
          </Link>
        </div>
        <Wave attacks={attacks} from={from} days={14} label="Your last two weeks" />
        <div className="tide-ticks" aria-hidden="true">
          <span>{shortDate.format(from)}</span>
          <span>{shortDate.format(new Date(from.getTime() + 7 * DAY))}</span>
          <span>today</span>
        </div>
      </section>

      {ongoing ? (
        <div className="btn-row">
          <button className="btn btn-deep" onClick={endOngoing} disabled={ending}>
            {ending ? 'Saving…' : 'It’s over'}
          </button>
          <Link to={`/log/${ongoing.id}`} className="btn btn-soft">
            Update
          </Link>
        </div>
      ) : (
        <Link to="/log" className="btn btn-deep btn-big">
          <span className="btn-plus">
            <Glyph name="plus" size={18} />
          </span>
          I have a migraine
        </Link>
      )}

      <section className="tiles">
        <Tile value={thisMonth} label="this month" />
        <Tile value={usual} label="usual length" />
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Recent</h2>
          {attacks.length > 3 && <Link to="/diary">see journal</Link>}
        </div>
        {loading ? (
          <p className="muted">Loading…</p>
        ) : attacks.length === 0 ? (
          <p className="empty">Your journal is empty. Hopefully it stays that way!</p>
        ) : (
          <div className="diary">
            {attacks.slice(0, 3).map((a) => (
              <DiaryLine key={a.id} attack={a} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
