import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAttacks } from '../lib/store'
import type { Attack } from '../lib/attacks'
import { dayKey, daysTouched } from '../lib/format'
import { play } from '../lib/sound'
import { DiaryLine } from '../components/Journal'
import { Wave } from '../components/Wave'
import { Glyph } from '../components/Glyph'

const monthFmt = new Intl.DateTimeFormat(undefined, { month: 'long' })
const yearFmt = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' })
const shortFmt = new Intl.DateTimeFormat(undefined, { month: 'short' })
const monthKey = (d: Date) => dayKey(d).slice(0, 7)
const TURN_MS = 550
const stillPages = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

type Turn = { from: number; dir: 'next' | 'back'; n: number }

/**
 * The journal is a little book, one month to a page. It opens on this month; flip back (swipe
 * right, ‹, or the left arrow key) for older months. The open page is kept in the address
 * (?m=2026-10), so coming back from an entry lands on the same page.
 */
export function DiaryPage() {
  const { attacks, loading } = useAttacks()
  const [params, setParams] = useSearchParams()
  const [turn, setTurn] = useState<Turn | null>(null)
  const swipe = useRef<{ x: number; y: number } | null>(null)
  const swiped = useRef(false)

  // the book's pages: every month from the oldest entry up to this month, oldest first
  const months: Date[] = []
  const now = new Date()
  const first = attacks.length ? new Date(attacks[attacks.length - 1].started_at) : now
  for (let d = new Date(first.getFullYear(), first.getMonth(), 1); d <= now; d.setMonth(d.getMonth() + 1)) months.push(new Date(d))
  const last = months.length - 1
  const asked = months.findIndex((m) => monthKey(m) === params.get('m'))
  const at = asked >= 0 ? asked : last
  const ongoing = attacks.some((a) => !a.ended_at)

  function go(to: number) {
    if (to < 0 || to > last || to === at) return
    if (!stillPages()) setTurn({ from: at, dir: to > at ? 'next' : 'back', n: Date.now() })
    setParams(to === last ? {} : { m: monthKey(months[to]) }, { replace: true })
    if (!ongoing) play('page')
  }

  // the turning page is only there while it turns
  useEffect(() => {
    if (!turn) return
    const t = setTimeout(() => setTurn(null), TURN_MS)
    return () => clearTimeout(t)
  }, [turn])

  // arrow keys flip too
  const goRef = useRef(go)
  goRef.current = go
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goRef.current(at - 1)
      if (e.key === 'ArrowRight') goRef.current(at + 1)
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [at])

  // while a page turns back, the page you were on stays put underneath until the older one covers it
  const under = turn?.dir === 'back' ? months[turn.from] : months[at]

  return (
    <div className="page">
      <header className="topbar">
        <h1 className="hand-title">Journal</h1>
        <Link to="/log" className="icon-btn icon-btn-deep" aria-label="Log a migraine">
          <Glyph name="plus" size={22} />
        </Link>
      </header>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <>
          <div
            className="jr-book"
            onPointerDown={(e) => {
              swipe.current = { x: e.clientX, y: e.clientY }
              swiped.current = false
            }}
            onPointerUp={(e) => {
              const s = swipe.current
              swipe.current = null
              if (!s) return
              const dx = e.clientX - s.x
              if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(e.clientY - s.y) * 1.5) {
                swiped.current = true
                go(dx > 0 ? at - 1 : at + 1)
              }
            }}
            onPointerCancel={() => (swipe.current = null)}
            // with a mouse, dragging across an entry would pick the link up instead of swiping
            onDragStart={(e) => e.preventDefault()}
            // a swipe that starts on an entry shouldn't also open it
            onClickCapture={(e) => {
              if (swiped.current) {
                e.preventDefault()
                e.stopPropagation()
                swiped.current = false
              }
            }}
          >
            <MonthPage month={under} attacks={attacks} />
            {turn && <MonthPage key={turn.n} month={turn.dir === 'next' ? months[turn.from] : months[at]} attacks={attacks} turning={turn.dir} />}
          </div>

          <nav className="jr-pager" aria-label="Turn the page">
            <button type="button" onClick={() => go(at - 1)} disabled={at === 0}>
              <Glyph name="left" size={18} />
              {at > 0 && shortFmt.format(months[at - 1])}
            </button>
            <span>
              page {at + 1} of {months.length}
            </span>
            <button type="button" onClick={() => go(at + 1)} disabled={at === last}>
              {at < last && shortFmt.format(months[at + 1])}
              <Glyph name="right" size={18} />
            </button>
          </nav>
        </>
      )}
    </div>
  )
}

/** One page of the book: the month's tide, then its migraines in the order they came. */
function MonthPage({ month, attacks, turning }: { month: Date; attacks: Attack[]; turning?: 'next' | 'back' }) {
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 1).getTime()
  const isThisYear = month.getFullYear() === new Date().getFullYear()
  const list = attacks
    .filter((a) => {
      const t = new Date(a.started_at).getTime()
      return t >= month.getTime() && t < end
    })
    .reverse()
  const key = monthKey(month)
  const hitDays = new Set(list.flatMap((a) => daysTouched(a.started_at, a.ended_at)).filter((k) => k.startsWith(key))).size
  const name = isThisYear ? monthFmt.format(month) : yearFmt.format(month)

  return (
    <article
      className={`jr-page${turning ? ` jr-turn-${turning}` : ''}`}
      aria-label={name}
      aria-hidden={turning ? true : undefined}
      inert={turning ? true : undefined}
    >
      <header className="jr-head">
        <h2 className="hand">{name}</h2>
        <span className="muted">{list.length ? `${list.length} migraine${list.length === 1 ? '' : 's'} · ${hitDays} day${hitDays === 1 ? '' : 's'}` : 'all calm'}</span>
      </header>
      <div className="jr-sea">
        <Wave attacks={attacks} from={month} days={days} label={`${name}: ${list.length} migraines`} />
      </div>
      {list.length > 0 ? (
        <div className="diary">
          {list.map((a) => (
            <DiaryLine key={a.id} attack={a} />
          ))}
        </div>
      ) : (
        <p className="empty">Not a ripple this month.</p>
      )}
    </article>
  )
}
