import { useId } from 'react'

type LogoProps = {
  size?: number
  tile?: boolean
  /**
   * 'once': the line traces itself, throbbing (a fading ghost ripple) as it hits each peak.
   * 'pulse': the finished mark keeps throbbing from both peaks (loading states).
   */
  animate?: 'once' | 'pulse'
}

const STORM = 'M180,660 L272,384 L362,592 L452,384 L530,572'

/** The "Calm" mark: a jagged M (the storm) that settles into a flat line (the calm). */
export function LogoMark({ size = 32, tile = true, animate }: LogoProps) {
  const id = 'logo' + useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const stroke = {
    fill: 'none',
    stroke: `url(#${id})`,
    strokeWidth: 80,
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
        <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="180" y1="0" x2="844" y2="0">
          <stop offset="0.35" style={{ stopColor: 'var(--coral)' }} />
          <stop offset="0.85" style={{ stopColor: 'var(--teal)' }} />
        </linearGradient>
      </defs>
      {tile && <rect className="logo-tile" width="1024" height="1024" rx="228" style={{ fill: 'var(--tile)' }} />}
      {/* Ghosts: copies of the storm that swell from each peak and fade — the throb.
          Thinner stroke so they stay about line-weight as they grow. */}
      {animate && (
        <>
          <path className="logo-ghost logo-ghost-a" pathLength={1} d={STORM} {...stroke} strokeWidth={54} />
          <path className="logo-ghost logo-ghost-b" pathLength={1} d={STORM} {...stroke} strokeWidth={54} />
        </>
      )}
      {/* Storm and calm meet at (530,572) */}
      <path className="logo-calm" pathLength={1} d="M530,572 C590,520 640,512 700,512 L844,512" {...stroke} />
      <path className="logo-storm" pathLength={1} d={STORM} {...stroke} />
    </svg>
  )
}

/** Wordmark: "mi" and "t" are highlighted for MIgraine Tracker. */
export function Wordmark() {
  return (
    <span className="wordmark" aria-label="Might">
      <span className="accent">mi</span>gh<span className="accent">t</span>
    </span>
  )
}
