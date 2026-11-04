import { useNavigate } from 'react-router-dom'
import { level, levelLabel, type Attack } from '../lib/attacks'
import { attacksByDay, dayKey } from '../lib/days'

/*
 * The tide: one soft wave over a run of days. Calm days sit on the waterline; each migraine day
 * swells up, taller for worse days, with a coral dot on its crest. A handwritten note points at
 * the roughest swell. Drawn in a fixed 350×150 box (scaled uniformly), so dots stay round and
 * the handwriting stays in place; `short` draws a flatter 350×112 version for tight spaces.
 */

const W = 350
const H = 150
const BASE = 122
// the first and last days sit in from the edges, so a migraine on either still gets a whole swell
const PAD = 22

type Props = {
  attacks: Attack[]
  from: Date // local midnight of the first day
  days: number
  note?: boolean // write "rough one" over the biggest swell
  short?: boolean // the flatter version, for Today
  label: string
}

type Pt = { x: number; y: number }

/** Smooth curve through points (Catmull-Rom → cubic Bézier). */
function smooth(pts: Pt[], base: number) {
  let d = `M${pts[0].x} ${pts[0].y}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    // clamp control points to the waterline so calm stretches never dip below it
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: Math.min(p1.y + (p2.y - p0.y) / 6, base) }
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: Math.min(p2.y - (p3.y - p1.y) / 6, base) }
    d += ` C${c1.x.toFixed(1)} ${c1.y.toFixed(1)} ${c2.x.toFixed(1)} ${c2.y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
  }
  return d
}

export function Wave({ attacks, from, days, note = true, short = false, label }: Props) {
  const navigate = useNavigate()
  const h = short ? 112 : H
  const base = short ? 92 : BASE
  const step = short ? 11 : 15
  const byDay = attacksByDay(attacks)
  const dw = (W - 2 * PAD) / days

  const crests = Array.from({ length: days }, (_, i) => {
    const d = new Date(from)
    d.setDate(d.getDate() + i)
    const list = byDay.get(dayKey(d)) ?? []
    const worst = list.length ? list.reduce((a, b) => (b.intensity > a.intensity ? b : a)) : null
    const lvl = worst ? level(worst.intensity) : 0
    return { i, date: d, worst, x: PAD + (i + 0.5) * dw, y: base - (lvl ? 16 + lvl * step : 0) }
  })

  // a calm day just beyond each end, so the first and last swells are shaped like all the others
  const line = smooth([
    { x: 0, y: base },
    { x: PAD - dw / 2, y: base },
    ...crests.map(({ x, y }) => ({ x, y })),
    { x: W - PAD + dw / 2, y: base },
    { x: W, y: base },
  ], base)
  const peaks = crests.filter((c) => c.worst)
  const roughest = peaks.reduce<(typeof peaks)[number] | null>((a, b) => (!a || b.y < a.y ? b : a), null)
  const noteLeft = roughest ? roughest.x < W * 0.62 : true

  return (
    <div className="wave">
      <svg viewBox={`0 0 ${W} ${h}`} role="img" aria-label={label}>
        <path d={`${line} L${W} ${h} L0 ${h} Z`} className="wave-fill" />
        <path d={line} className="wave-line" pathLength={1} />
        <path d={`M0 ${base + 12} C${W * 0.12} ${base + 8} ${W * 0.24} ${base + 16} ${W * 0.36} ${base + 12} S${W * 0.6} ${base + 8} ${W * 0.72} ${base + 12} S${W * 0.9} ${base + 16} ${W} ${base + 12}`} className="wave-ripple" />
        {peaks.map((c) => (
          <circle key={c.i} cx={c.x} cy={c.y} r={3 + level(c.worst!.intensity) * 0.6} className="wave-crest" style={{ animationDelay: `${0.55 + (c.x / W) * 0.7}s` }} />
        ))}
        {note && roughest && (
          <g className="wave-note">
            <text x={noteLeft ? roughest.x + 14 : roughest.x - 14} y={Math.max(roughest.y - 16, 18)} textAnchor={noteLeft ? 'start' : 'end'}>
              rough one
            </text>
            <path
              d={
                noteLeft
                  ? `M${roughest.x + 12} ${Math.max(roughest.y - 21, 13)} C${roughest.x + 4} ${roughest.y - 20} ${roughest.x + 1} ${roughest.y - 14} ${roughest.x} ${roughest.y - 8}`
                  : `M${roughest.x - 12} ${Math.max(roughest.y - 21, 13)} C${roughest.x - 4} ${roughest.y - 20} ${roughest.x - 1} ${roughest.y - 14} ${roughest.x} ${roughest.y - 8}`
              }
            />
          </g>
        )}
      </svg>
      {peaks.map((c) => (
        <button
          key={c.i}
          type="button"
          className="wave-hit"
          style={{ left: `${(c.x / W) * 100}%`, width: `${(dw / W) * 100}%` }}
          aria-label={`${c.date.toDateString()}: ${levelLabel(c.worst!.intensity)}`}
          onClick={() => navigate(`/log/${c.worst!.id}`)}
        />
      ))}
    </div>
  )
}
