import { useNavigate } from 'react-router-dom'
import { level, levelLabel, type Attack } from '../lib/attacks'
import { attackDuration, formatDay, formatDuration } from '../lib/format'

/*
 * The Trace: Might's chart-recorder strip. One continuous pen line runs along the baseline and
 * spikes for each migraine — spike height = level (1–5), spike width = how long it lasted. The
 * spike shape is the logo's double peak. Drawn in a stretchy viewBox (24 units per day) with
 * non-scaling strokes; anything that must stay round (the pen nib) or tappable is HTML on top.
 */

const DAY_W = 24
const H = 100
const BASE = 86 // baseline y
const DAY = 86_400_000

const peakY = (lvl: number) => BASE - (lvl / 5) * 74

type Props = {
  attacks: Attack[]
  from: Date // start of the first day shown (local midnight)
  days: number
  now?: number // pen position; omit for a fully past strip
  ticks: { day: number; label: string }[]
  height?: number
  label: string
}

export function Trace({ attacks, from, days, now, ticks, height = 132, label }: Props) {
  const navigate = useNavigate()
  const W = days * DAY_W
  const t0 = from.getTime()
  const t1 = t0 + days * DAY
  const x = (t: number) => ((Math.min(Math.max(t, t0), t1) - t0) / DAY) * DAY_W
  const penX = now === undefined ? W : x(now)

  const visible = attacks
    .filter((a) => new Date(a.started_at).getTime() < t1 && (a.ended_at ? new Date(a.ended_at).getTime() : (now ?? t1)) > t0)
    .sort((a, b) => a.started_at.localeCompare(b.started_at))

  // One continuous path: baseline, spike, baseline, spike… up to the pen.
  let d = `M0 ${BASE}`
  let cursor = 0
  const spikes = visible.map((a) => {
    const end = a.ended_at ? new Date(a.ended_at).getTime() : (now ?? t1)
    let s = Math.max(x(new Date(a.started_at).getTime()), cursor)
    const e = Math.max(x(end), s + 10) // at least ~10h wide so short ones still read
    if (s < cursor) s = cursor
    const w = e - s
    const A = BASE - peakY(level(a.intensity))
    d += ` L${s} ${BASE} L${s + w * 0.25} ${BASE - A} L${s + w * 0.45} ${BASE - A * 0.35} L${s + w * 0.65} ${BASE - A * 0.7} L${e} ${BASE}`
    cursor = e
    return { a, s, e, peak: BASE - A }
  })
  if (penX > cursor) d += ` L${penX} ${BASE}`

  const ongoing = visible.find((a) => !a.ended_at)
  const nibY = ongoing && now !== undefined ? peakY(level(ongoing.intensity)) * 0.55 + BASE * 0.45 : BASE

  return (
    <figure className="trace">
      <div className="trace-plot" style={{ height }}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={label}>
          {Array.from({ length: days + 1 }, (_, i) => (
            <line key={i} className={`trace-grid${i % 7 === 0 ? ' trace-grid-major' : ''}`} x1={i * DAY_W} x2={i * DAY_W} y1="4" y2={BASE} />
          ))}
          {[1, 2, 3, 4, 5].map((l) => (
            <line key={l} className="trace-level" x1="0" x2={W} y1={peakY(l)} y2={peakY(l)} />
          ))}
          <line className="trace-axis" x1="0" x2={W} y1={BASE} y2={BASE} />
          <path className="trace-line" d={d} pathLength={1} />
        </svg>

        {spikes.map(({ a, s, e, peak }) => (
          <button
            key={a.id}
            type="button"
            className="trace-hit"
            style={{ left: `${(((s + e) / 2) / W) * 100}%`, width: `${((e - s) / W) * 100}%` }}
            aria-label={`${formatDay(a.started_at)}: ${levelLabel(a.intensity)}, ${
              a.ended_at ? formatDuration(attackDuration(a.started_at, a.ended_at)) : 'ongoing'
            }`}
            onClick={() => navigate(`/log/${a.id}`)}
          >
            <span className="trace-hit-mark" style={{ top: `${(peak / H) * 100}%` }} />
          </button>
        ))}

        {now !== undefined && (
          <span
            className={`trace-nib${ongoing ? ' trace-nib-live' : ''}`}
            style={{ left: `${(penX / W) * 100}%`, top: `${(nibY / H) * 100}%` }}
            aria-hidden="true"
          />
        )}
      </div>
      <div className="trace-ticks" aria-hidden="true">
        {ticks.map((t) => (
          <span key={t.day} style={{ left: `${(t.day / days) * 100}%` }}>
            {t.label}
          </span>
        ))}
      </div>
    </figure>
  )
}
