import { useEffect, useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAttacks } from '../lib/store'
import { attackDuration, dayKey, formatDuration } from '../lib/format'
import { attacksByDay, clearDays } from '../lib/days'
import { Boat } from '../components/Boat'
import { Glyph } from '../components/Glyph'
import { Wordmark } from '../components/Logo'
import { Sky, SeaBack, SeaFront } from '../components/Sky'
import { play } from '../lib/sound'
import { moodFor, type BoatMood } from '../lib/mood'
import { gramiTip, medicineDays } from '../lib/tips'
import { isDarkScene, sceneFor } from '../lib/scene'

const DAY = 86_400_000
const BAR_DAYS = 9

/** Re-render every minute so "Severe · 2 h 10 m" and the sky stay current. */
function useNow() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])
  return now
}

/** Whether the app is showing its dark theme (chosen in Settings, or the phone's own setting). */
function useDarkTheme() {
  const read = () => {
    const t = document.documentElement.dataset.theme
    return t ? t === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
  }
  const [dark, setDark] = useState(read)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const update = () => setDark(read())
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return dark
}

/**
 * Today, "week at a glance" (Mighty screen 3): this week's episodes, average pain and hours over
 * a bar chart of recent days; Grami in the waves; one insight from your
 * own journal; and the big log button. The sky behind follows the time of day.
 */
export function HomePage() {
  const { attacks, loading, error, save } = useAttacks()
  const now = useNow()
  const dark = useDarkTheme()
  const [ending, setEnding] = useState(false)
  const uid = useId().replace(/[^w-]/g, '')

  const today = new Date(now)
  const midnight = new Date(today)
  midnight.setHours(0, 0, 0, 0)
  const ongoing = attacks.find((a) => !a.ended_at)
  const streak = clearDays(attacks)
  const scene = sceneFor(today, !!ongoing, dark)
  const darkScene = isDarkScene(scene)

  // the tab bar takes on the scene's light or dark look while Today is showing
  useEffect(() => {
    document.documentElement.dataset.scene = darkScene ? 'dark' : 'light'
    return () => {
      delete document.documentElement.dataset.scene
    }
  }, [darkScene])

  // Ends every open entry (normally one, but a double-logged migraine shouldn't get stuck).
  async function endOngoing() {
    const open = attacks.filter((a) => !a.ended_at)
    if (!open.length) return
    setEnding(true)
    const endedAt = new Date().toISOString()
    try {
      await Promise.all(open.map(({ id, ...rest }) => save({ ...rest, ended_at: endedAt }, id)))
      play('calm')
    } finally {
      setEnding(false)
    }
  }

  // eyes open and smiling, except in the late-night sky, when Grami is resting
  const lateNight = scene === 'night' && (today.getHours() >= 22 || today.getHours() < 6)
  const mood: BoatMood = ongoing ? moodFor(ongoing.intensity) : streak === 0 ? 'recovering' : lateNight ? 'calm' : 'happy'

  // this week: the last 7 days, today included
  const week = attacks.filter((a) => new Date(a.started_at).getTime() >= midnight.getTime() - 6 * DAY)
  const weekPain = week.length ? (week.reduce((s, a) => s + a.intensity, 0) / week.length).toFixed(1) : '–'
  const weekHours = week.reduce((s, a) => s + attackDuration(a.started_at, a.ended_at, now), 0)
  const meds = medicineDays(attacks, today)

  // one rounded bar per day, taller for a worse migraine; calm days stay low, today is lit
  const byDay = attacksByDay(attacks)
  const bars = Array.from({ length: BAR_DAYS }, (_, i) => {
    const d = new Date(midnight)
    d.setDate(d.getDate() - (BAR_DAYS - 1 - i))
    const list = byDay.get(dayKey(d)) ?? []
    const worst = list.length ? Math.max(...list.map((a) => a.intensity)) : 0
    return { key: dayKey(d), d, worst, today: i === BAR_DAYS - 1 }
  })

  return (
    <div className={`td td-${scene} ${darkScene ? 'td-dark' : 'td-light'}`}>
      <Sky scene={scene} />

      <header className="topbar td-top">
        <div className="brand">
          <Wordmark />
        </div>
        <Link to="/settings" className="td-top-icon" aria-label="Settings">
          <Glyph name="settings" size={24} />
        </Link>
      </header>
      <h1 className="sr-only">Today</h1>

      {error && <p className="notice">Couldn't load your journal: {error}</p>}

      <Link to="/patterns" className="glass td-weekstats" aria-label="This week. Open Patterns">
        <b className="td-ws-title">This Week</b>
        <div className="td-nums">
          <span>
            <b>{week.length}</b>
            <small>{week.length === 1 ? 'Episode' : 'Episodes'}</small>
          </span>
          <span>
            <small>Avg Pain</small>
            <b>
              {weekPain}
              <i>/10</i>
            </b>
          </span>
          <span>
            <small>Total Hours</small>
            <b>{week.length ? formatDuration(weekHours) : '0h'}</b>
          </span>
        </div>
        {/* bars rise out of a little sea: soft gradients, a wave along the bottom, today glowing */}
        <svg viewBox="0 0 284 96" className="td-bars" aria-hidden="true">
          <defs>
            <linearGradient id={`${uid}-bar`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" className="td-bar-top" />
              <stop offset="1" className="td-bar-bottom" />
            </linearGradient>
            <linearGradient id={`${uid}-now`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#9ff3e6" />
              <stop offset="1" stopColor="#3fb6a8" stopOpacity="0.35" />
            </linearGradient>
            <filter id={`${uid}-glow`} x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="2.5" />
            </filter>
          </defs>
          {bars.map((b, i) => {
            const h = b.worst ? 30 + b.worst * 5.4 : 16 + ((i * 7) % 12)
            const x = 6 + i * 31
            return (
              <g key={b.key}>
                <rect x={x} y={86 - h} width="22" height={h + 10} rx="11" fill={`url(#${uid}-${b.today ? 'now' : 'bar'})`} className={b.worst || b.today ? undefined : 'td-bar-calm'} />
                {b.today && (
                  <>
                    <circle cx={x + 11} cy={86 - h + 9} r="7" fill="#fff6c9" opacity="0.8" filter={`url(#${uid}-glow)`} />
                    <circle cx={x + 11} cy={86 - h + 9} r="3.4" fill="#ffe7a0" />
                  </>
                )}
              </g>
            )
          })}
          <path className="td-bars-wave-back" d="M0 78C24 70 44 70 70 77S118 86 142 78S190 69 214 77S262 86 284 78V96H0Z" />
          <path className="td-bars-wave" d="M0 84C22 79 46 79 70 84S116 90 142 84S188 78 212 84S260 90 284 84V96H0Z" />
        </svg>
      </Link>

      {/* Grami floats in the waves; tap to chat */}
      <div className="td-stage">
        {scene === 'evening' && <span className="td-setting-sun" aria-hidden="true" />}
        {scene === 'morning' && <span className="td-rising-sun" aria-hidden="true" />}
        <SeaBack rough={!!ongoing} />
        <Link to="/chat" className="td-grami" aria-label="Ask Grami about your migraines" onClick={() => !ongoing && play('tap')}>
          <Boat mood={mood} size={210} water={false} />
        </Link>
        <SeaFront rough={!!ongoing} />
      </div>

      <div className="td-sea">
        {!loading && (
          <Link to="/chat" className="glass td-insight">
            <Glyph name="bulb" size={30} />
            <span>
              <b>Insight</b>
              <small>{gramiTip(attacks, today)}</small>
            </span>
            <Glyph name="right" size={18} className="td-chevron" />
          </Link>
        )}
        {meds >= 8 && (
          <p className="td-note">
            Pain medicine on {meds} days this month. Doctors keep an eye on 10 or more, when painkillers can start causing headaches themselves.
          </p>
        )}

        {ongoing ? (
          <div className="td-btn-row">
            <button className="td-btn" onClick={endOngoing} disabled={ending}>
              {ending ? 'Saving…' : 'It’s over'}
            </button>
            <Link to={`/log/${ongoing.id}`} className="td-btn td-btn-glass">
              Update
            </Link>
          </div>
        ) : (
          <Link to="/log" className="td-btn">
            Log Migraine
          </Link>
        )}
      </div>
    </div>
  )
}
