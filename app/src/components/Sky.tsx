import type { CSSProperties, ReactNode } from 'react'
import type { Scene } from '../lib/scene'

/*
 * The sky and sea edge behind Today. Sky: what's up there at this time of day (moon and stars,
 * the sun, soft clouds, birds, or rain clouds during a migraine), drawn over the page's own
 * gradient. SeaBack / SeaFront: the swells behind Grami's boat and the wave over its front.
 * Colours come from the scene's CSS variables (index.css, .td-*); motion lives there too.
 */

/** A puffy three-bump cloud sitting on (x, y). */
const cloud = (x: number, y: number, r: number) =>
  `M${x - 2 * r} ${y}a${r} ${r} 0 0 1 ${r * 0.9}-${r * 1.2}a${r * 1.25} ${r * 1.25} 0 0 1 ${r * 2.2}-${r * 0.4}a${r} ${r} 0 0 1 ${r * 0.9} ${r * 1.6}Z`

const STARS = [
  [34, 40, 1.4], [92, 22, 1], [150, 64, 1.6], [214, 30, 1.1], [262, 96, 1.3], [356, 48, 1.5],
  [40, 150, 1], [118, 118, 1.2], [300, 22, 1], [190, 140, 0.9], [70, 230, 1.1], [372, 190, 1],
  [24, 300, 0.9], [240, 210, 1.2], [140, 260, 0.8],
]
const RAIN = Array.from({ length: 26 }, (_, i) => `M${(i * 37) % 390} ${30 + ((i * 53) % 380)}l-5 14`).join('')

export function Sky({ scene }: { scene: Scene }) {
  return (
    <svg className="td-sky" viewBox="0 0 390 520" preserveAspectRatio="xMidYMin slice" aria-hidden="true">
      {scene === 'night' && (
        <>
          <g className="td-stars">
            {STARS.map(([x, y, r]) => (
              <circle key={`${x}-${y}`} cx={x} cy={y} r={r} />
            ))}
          </g>
          <path className="td-shooting" d="M226 92l52-26" />
          <path className="td-moon" d="M318 150a26 26 0 1 0 22 40a21 21 0 1 1-22-40z" />
          <path className="td-cloud" d={cloud(52, 330, 16)} opacity="0.7" />
        </>
      )}
      {scene === 'day' && (
        <>
          <circle cx="318" cy="168" r="62" className="td-sun-glow" />
          <circle cx="318" cy="168" r="34" className="td-sun" />
          <path className="td-cloud td-drift" d={cloud(70, 300, 18)} />
          <path className="td-cloud td-drift-slow" d={cloud(290, 350, 22)} />
          <path className="td-cloud" d={cloud(200, 250, 10)} opacity="0.85" />
          <path className="td-birds" d="M120 210q5-6 10 0q5-6 10 0M150 196q4-4.5 8 0q4-4.5 8 0" />
        </>
      )}
      {scene === 'morning' && (
        <>
          <path className="td-cloud td-drift" d={cloud(64, 330, 20)} />
          <path className="td-cloud td-cloud-warm td-drift-slow" d={cloud(300, 380, 24)} />
          <path className="td-cloud td-cloud-warm" d={cloud(210, 290, 11)} />
          <path className="td-birds" d="M86 240q5-6 10 0q5-6 10 0" />
        </>
      )}
      {scene === 'evening' && (
        <>
          <g className="td-stars td-stars-faint">
            {STARS.slice(0, 7).map(([x, y, r]) => (
              <circle key={`${x}-${y}`} cx={x} cy={y} r={r} />
            ))}
          </g>
          <path className="td-cloud td-cloud-warm td-drift" d={cloud(70, 360, 20)} />
          <path className="td-cloud td-cloud-warm td-drift-slow" d={cloud(310, 330, 24)} />
          <path className="td-birds" d="M250 250q5-6 10 0q5-6 10 0M276 236q4-4.5 8 0q4-4.5 8 0" />
        </>
      )}
      {scene === 'storm' && (
        <>
          <path className="td-cloud td-cloud-storm td-drift" d={cloud(90, 200, 30)} />
          <path className="td-cloud td-cloud-storm td-drift-slow" d={cloud(300, 260, 34)} />
          <path className="td-rain" d={RAIN} />
        </>
      )}
    </svg>
  )
}

/*
 * Natural-looking waves: each line is a few overlapping swells of different lengths, heights and
 * offsets, so crests come out uneven (big and small, near and far apart). Every swell fits a whole
 * number of times into 400 units, so the 800-wide strip still loops seamlessly as it slides. The
 * line always has the same number of points, so one sea can ease smoothly into another.
 */
type Swell = [k: number, calm: number, rough: number, phase: number] // waves per 400, weights, offset

const LAYERS: Record<'far' | 'mid' | 'near', Swell[]> = {
  far: [[1, 0.55, 0.35, 0.4], [2, 0.3, 0.3, 2.1], [3, 0.15, 0.2, 4.4], [5, 0, 0.18, 1.2], [8, 0, 0.1, 3.3]],
  mid: [[2, 0.45, 0.3, 1.1], [3, 0.3, 0.25, 3.6], [5, 0.15, 0.22, 0.2], [7, 0, 0.15, 2.7], [11, 0, 0.08, 5.1]],
  near: [[3, 0.45, 0.28, 2.6], [4, 0.3, 0.25, 0.7], [7, 0.15, 0.22, 4.9], [9, 0, 0.16, 1.9], [13, 0, 0.09, 3.8]],
}

/** Points of one wave line from x=0 to 800, around height y; t = 0 calm … 1 rough. */
function swellPoints(layer: Swell[], y: number, height: number, t: number) {
  const pts: string[] = []
  for (let x = 0; x <= 800; x += 4) {
    let v = 0
    for (const [k, calm, rough, phase] of layer) v += (calm + (rough - calm) * t) * Math.sin((2 * Math.PI * k * x) / 400 + phase)
    pts.push(`${x} ${(y - v * height).toFixed(1)}`)
  }
  return pts
}
const swellLine = (layer: Swell[], y: number, height: number, t: number) => 'M' + swellPoints(layer, y, height, t).join('L')
const swellFill = (layer: Swell[], y: number, height: number, t: number, bottom: number) =>
  swellLine(layer, y, height, t) + `L800 ${bottom}L0 ${bottom}Z`

/**
 * The big swells behind Grami's boat: a far, pale swell and a nearer one. Each strip is twice as
 * wide as it shows and slides one width, so it loops; the layers roll at different speeds.
 */
export function SeaBack({ rough }: { rough: boolean }) {
  const t = rough ? 1 : 0.15
  return (
    <div className="td-seaback" aria-hidden="true">
      <svg className="td-roll td-roll-slow" viewBox="0 0 800 96" preserveAspectRatio="none">
        <path className="td-swell-far" d={swellFill(LAYERS.far, 38, rough ? 24 : 22, t, 96)} />
        <path className="td-swell-crest" d={swellLine(LAYERS.far, 38, rough ? 24 : 22, t)} />
      </svg>
      <svg className="td-roll" viewBox="0 0 800 96" preserveAspectRatio="none">
        <path className="td-swell-mid" d={swellFill(LAYERS.mid, 62, rough ? 20 : 17, t, 96)} />
        <path className="td-swell-crest" d={swellLine(LAYERS.mid, 62, rough ? 20 : 17, t)} />
      </svg>
    </div>
  )
}

/** The wave in front of the boat, washing over its bottom; it fades into the sea below. */
export function SeaFront({ rough }: { rough: boolean }) {
  const t = rough ? 1 : 0.15
  return (
    <svg className="td-seafront td-roll td-roll-fast" viewBox="0 0 800 60" preserveAspectRatio="none" aria-hidden="true">
      <path className="td-swell-near" d={swellFill(LAYERS.near, 25, rough ? 16 : 13, t, 60)} />
      <path className="td-swell-foam" d={swellLine(LAYERS.near, 25, rough ? 16 : 13, t)} />
    </svg>
  )
}

/**
 * A sea for the bottom of a page (the Log page): three layers of waves with whatever floats on it
 * (Grami) tucked between the back and front layers. `pain` (1–10) sets the water: nearly glassy
 * at 1, taller and choppier as it rises, and it eases from one to the other.
 */
export function QuietSea({ pain = 1, children }: { pain?: number; children?: ReactNode }) {
  const t = (Math.min(10, Math.max(1, pain)) - 1) / 9 // 0 calm … 1 worst
  const h = (calm: number, worst: number) => calm + (worst - calm) * t
  return (
    <div className="qs" aria-hidden="true" style={{ '--qs-t': t } as CSSProperties}>
      <svg className="qs-layer qs-back" viewBox="0 0 800 140" preserveAspectRatio="none">
        <path className="qs-far" d={swellFill(LAYERS.far, 30, h(4, 17), t, 140)} />
        <path className="qs-mid" d={swellFill(LAYERS.mid, 56, h(3.5, 15), t, 140)} />
      </svg>
      {children}
      <svg className="qs-layer qs-front" viewBox="0 0 800 140" preserveAspectRatio="none">
        <path className="qs-near" d={swellFill(LAYERS.near, 86, h(3, 13), t, 140)} />
        <path className="qs-foam" d={swellLine(LAYERS.near, 86, h(3, 13), t)} />
      </svg>
    </div>
  )
}
