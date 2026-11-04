import { useId } from 'react'

type LogoProps = {
  size?: number
  tile?: boolean
  /**
   * 'once': the line traces itself, throbbing (a fading ghost ripple) as it crests each swell.
   * 'pulse': the finished mark keeps throbbing from both crests (loading states).
   */
  animate?: 'once' | 'pulse'
}

const SWELL = 'M168,622 C212,622 236,402 296,402 C356,402 360,622 412,622 C464,622 476,472 528,472 C580,472 596,622 648,622'

/** "Swell to calm": two swells, the second smaller, settling into a flat line of calm water. */
export function LogoMark({ size = 32, tile = true, animate }: LogoProps) {
  const id = 'logo' + useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const stroke = {
    fill: 'none',
    stroke: `url(#${id})`,
    strokeWidth: 78,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 1024 1024"
      aria-hidden="true"
      className={animate ? `logo-anim logo-anim-${animate}` : undefined}
    >
      <defs>
        <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="168" y1="0" x2="856" y2="0">
          <stop offset="0.3" style={{ stopColor: 'var(--coral)' }} />
          <stop offset="0.85" style={{ stopColor: 'var(--teal)' }} />
        </linearGradient>
      </defs>
      {tile && <rect className="logo-tile" width="1024" height="1024" rx="228" style={{ fill: 'var(--tile)' }} />}
      {/* Ghosts: copies of the swell that ripple out from each crest and fade — the throb.
          Thinner stroke so they stay about line-weight as they grow. */}
      {animate && (
        <>
          <path className="logo-ghost logo-ghost-a" pathLength={1} d={SWELL} {...stroke} strokeWidth={54} />
          <path className="logo-ghost logo-ghost-b" pathLength={1} d={SWELL} {...stroke} strokeWidth={54} />
        </>
      )}
      {/* Swell and calm meet at (648,622) */}
      <path className="logo-calm" pathLength={1} d="M648,622 L856,622" {...stroke} />
      <path className="logo-swell" pathLength={1} d={SWELL} {...stroke} />
    </svg>
  )
}

/**
 * Wordmark: the logo's double swell is the "m", and its calm line runs on from the m's last
 * stroke as the underline. "i" and "t" stay highlighted for MIgraine Tracker. Sized in em
 * (.wordmark in index.css), so it follows the font size wherever it's used.
 */
export function Wordmark() {
  const id = 'wm' + useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const line = { fill: 'none', stroke: `url(#${id})`, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  return (
    <svg className="wordmark" viewBox="0 22 252 112" role="img" aria-label="Might">
      <defs>
        <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="6" y1="0" x2="150" y2="0">
          <stop offset="0.3" style={{ stopColor: 'var(--coral)' }} />
          <stop offset="1" style={{ stopColor: 'var(--teal)' }} />
        </linearGradient>
      </defs>
      {/* the calm line: leaves the m's foot and dips under the rest of the word */}
      <path className="wordmark-line" pathLength={1} d="M110.6 100C121 100 120 115 134 115H244" {...line} strokeWidth={8} />
      {/* the logo's swell, scaled so its foot sits on the text baseline (y = 100) */}
      <path d={SWELL} transform="translate(6 100) scale(0.218) translate(-168 -622)" {...line} strokeWidth={42} />
      <text x="116" y="100" className="wordmark-text">
        <tspan className="accent">i</tspan>gh<tspan className="accent">t</tspan>
      </text>
    </svg>
  )
}
