import type { ReactNode } from 'react'
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

/** One rolling wave line from x=0 to 800, around height y; t-segments alternate up and down. */
const crest = (y: number, amp: number, len: number) =>
  `M0 ${y}q${len / 4} ${-amp} ${len / 2} 0` + ` t${len / 2} 0`.repeat(Math.ceil(800 / (len / 2)) - 1)
/** The same wave, filled down to the bottom of a strip h tall. */
const wave = (y: number, amp: number, len: number, h = 60) => crest(y, amp, len) + `L800 ${h}L0 ${h}Z`

/**
 * The big swells behind Grami's boat: a far, pale swell and a nearer one. Each strip is twice as
 * wide as it shows and slides one width, so it loops; the layers roll at different speeds.
 */
export function SeaBack({ rough }: { rough: boolean }) {
  return (
    <div className="td-seaback" aria-hidden="true">
      <svg className="td-roll td-roll-slow" viewBox="0 0 800 96" preserveAspectRatio="none">
        <path className="td-swell-far" d={rough ? wave(34, 20, 120, 96) : wave(36, 14, 220, 96)} />
        <path className="td-swell-crest" d={rough ? crest(34, 20, 120) : crest(36, 14, 220)} />
      </svg>
      <svg className="td-roll" viewBox="0 0 800 96" preserveAspectRatio="none">
        <path className="td-swell-mid" d={rough ? wave(58, 16, 90, 96) : wave(60, 11, 170, 96)} />
        <path className="td-swell-crest" d={rough ? crest(58, 16, 90) : crest(60, 11, 170)} />
      </svg>
    </div>
  )
}

/** The wave in front of the boat, washing over its bottom; it fades into the sea below. */
export function SeaFront({ rough }: { rough: boolean }) {
  return (
    <svg className="td-seafront td-roll td-roll-fast" viewBox="0 0 800 60" preserveAspectRatio="none" aria-hidden="true">
      <path className="td-swell-near" d={rough ? wave(22, 14, 80, 60) : wave(22, 9, 150, 60)} />
      <path className="td-swell-foam" d={rough ? crest(22, 14, 80) : crest(22, 9, 150)} />
    </svg>
  )
}


/**
 * A quiet sea for the bottom of a page (the Log page): three layers of soft waves that drift very
 * slowly, with whatever floats on it (Grami) tucked between the back and front layers.
 */
export function QuietSea({ children }: { children?: ReactNode }) {
  return (
    <div className="qs" aria-hidden="true">
      <svg className="qs-layer qs-back" viewBox="0 0 800 140" preserveAspectRatio="none">
        <path className="qs-far" d={wave(30, 9, 200, 140)} />
        <path className="qs-mid" d={wave(56, 8, 100, 140)} />
      </svg>
      {children}
      <svg className="qs-layer qs-front" viewBox="0 0 800 140" preserveAspectRatio="none">
        <path className="qs-near" d={wave(86, 7, 80, 140)} />
        <path className="qs-foam" d={crest(86, 7, 80)} />
      </svg>
    </div>
  )
}
