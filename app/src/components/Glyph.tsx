import type { ReactNode } from 'react'

/*
 * Might's own icon set. Every glyph is drawn on a 32×32 grid with one chunky round stroke
 * (currentColor) over an optional pastel "sticker" fill (var(--fill), set by the parent).
 * <F> marks the fill layer; plain paths are the ink line.
 */

const F = ({ d }: { d: string }) => <path d={d} fill="var(--fill, transparent)" stroke="none" />
const Dot = ({ x, y, r = 1.6 }: { x: number; y: number; r?: number }) => (
  <circle cx={x} cy={y} r={r} fill="currentColor" stroke="none" />
)

/** Mini head for location glyphs. `hit` is the sore area; `back` draws the head from behind. */
function Zone({ hit, back, face = 'calm', side }: { hit: ReactNode; back?: boolean; face?: 'calm' | 'eyes-open'; side?: 'L' | 'R' }) {
  return (
    <>
      <path d="M13 25.5V30M19 25.5V30" />
      <ellipse cx="16" cy="14.5" rx="10" ry="11.5" fill="var(--fill, transparent)" stroke="none" />
      <g fill="var(--hit, #e8664f)" stroke="none">{hit}</g>
      {back ? (
        <path d="M9 9.5c3-3.5 11-3.5 14 0M16 6v5" strokeWidth="1.8" /> // hair parting = seen from behind
      ) : face === 'eyes-open' ? (
        <path d="M14 21.3q2 1.4 4 0" strokeWidth="1.8" />
      ) : (
        <path d="M10.8 15q1.4 1.2 2.8 0M18.4 15q1.4 1.2 2.8 0M14 21q2 1.4 4 0" strokeWidth="1.8" />
      )}
      {face === 'eyes-open' && (
        <>
          <Dot x={12} y={14.5} r={1.2} />
          <Dot x={20} y={14.5} r={1.2} />
        </>
      )}
      <ellipse cx="16" cy="14.5" rx="10" ry="11.5" />
      {side && (
        <text x={side === 'L' ? 3 : 29} y="30" textAnchor="middle" fontSize="7.5" fontWeight="800" fill="currentColor" stroke="none" fontFamily="var(--font-fun)">
          {side}
        </text>
      )}
    </>
  )
}

const GLYPHS: Record<string, ReactNode> = {
  /* ---- navigation & actions ---- */
  sun: (
    <>
      <circle cx="16" cy="16" r="5.5" fill="var(--fill, transparent)" />
      <path d="M16 3v3M16 26v3M3 16h3M26 16h3M6.8 6.8l2.1 2.1M23.1 23.1l2.1 2.1M6.8 25.2l2.1-2.1M23.1 8.9l2.1-2.1" />
    </>
  ),
  diary: (
    <>
      <F d="M9 7h14a4 4 0 0 1 4 4v12a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V11a4 4 0 0 1 4-4Z" />
      <path d="M9 7h14a4 4 0 0 1 4 4v12a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V11a4 4 0 0 1 4-4ZM5 13h22M11 4v5M21 4v5" />
      <Dot x={11.5} y={19.5} />
      <Dot x={16} y={19.5} />
      <Dot x={20.5} y={19.5} />
    </>
  ),
  patterns: (
    <>
      <path d="M5 24l6-7 5 4 8-10" />
      <path d="M25 2.5q.8 3.2 4 4-3.2.8-4 4-.8-3.2-4-4 3.2-.8 4-4Z" fill="currentColor" strokeWidth="1" />
      <Dot x={5} y={24} r={2} />
    </>
  ),
  plus: <path d="M16 7v18M7 16h18" strokeWidth="3" />,
  settings: (
    <>
      <path d="M5 10h22M5 22h22" />
      <circle cx="12" cy="10" r="3.2" fill="var(--surface)" />
      <circle cx="20" cy="22" r="3.2" fill="var(--surface)" />
    </>
  ),
  back: <path d="M19 6l-10 10 10 10" strokeWidth="2.6" />,
  left: <path d="M19 8l-8 8 8 8" />,
  right: <path d="M13 8l8 8-8 8" />,
  check: <path d="M7 16.5l6 6 12-13" strokeWidth="2.8" />,
  close: <path d="M9 9l14 14M23 9L9 23" />,
  trash: (
    <>
      <F d="M9 9l1.2 16a2 2 0 0 0 2 1.8h7.6a2 2 0 0 0 2-1.8L23 9Z" />
      <path d="M6 9h20M13 9V6h6v3M9 9l1.2 16a2 2 0 0 0 2 1.8h7.6a2 2 0 0 0 2-1.8L23 9M14 14v8M18 14v8" />
    </>
  ),
  note: (
    <>
      <F d="M7 25l1.5-5.5L20 8a2.1 2.1 0 0 1 3 0l1 1a2.1 2.1 0 0 1 0 3L12.5 23.5Z" />
      <path d="M7 25l1.5-5.5L20 8a2.1 2.1 0 0 1 3 0l1 1a2.1 2.1 0 0 1 0 3L12.5 23.5ZM18 10l4 4" />
    </>
  ),
  pill: (
    <g transform="rotate(-38 16 16)">
      <path d="M9 11h7v10H9a5 5 0 0 1 0-10Z" fill="var(--fill, transparent)" stroke="none" />
      <rect x="4" y="11" width="24" height="10" rx="5" />
      <path d="M16 11v10" />
    </g>
  ),
  clock: (
    <>
      <circle cx="16" cy="16" r="11" fill="var(--fill, transparent)" />
      <path d="M16 10v6l4 3" />
    </>
  ),
  download: <path d="M16 5v14M10 13l6 6 6-6M7 26h18" />,
  door: <path d="M13 6H8a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h5M15 16h12M22 11l5 5-5 5" />,
  moon: <path d="M18 5a11 11 0 1 0 9 15A9 9 0 0 1 18 5Z" fill="var(--fill, transparent)" />,
  auto: (
    <>
      <circle cx="16" cy="16" r="10" />
      <path d="M16 6a10 10 0 0 1 0 20Z" fill="currentColor" />
    </>
  ),

  /* ---- triggers ---- */
  stress: (
    <>
      <circle cx="15" cy="17" r="8" fill="var(--fill, transparent)" stroke="none" />
      <path d="M8 21C6 13 14 8 19 11c6 3 4 12-3 12-6 1-7-7-1-8 5-1 6 5 2 5" />
      <path d="M24 5l1.5-2M27 8.5l2.5-1M25.5 12h3" />
    </>
  ),
  sleep: (
    <>
      <path d="M17 6a10.5 10.5 0 1 0 10 14A8.5 8.5 0 0 1 17 6Z" fill="var(--fill, transparent)" />
      <path d="M21 4h5l-5 5h5" strokeWidth="1.9" />
    </>
  ),
  meal: (
    <>
      <F d="M23 5c-3 2-4.5 6-4.5 10H23Z" />
      <path d="M9 5v7a3 3 0 0 0 6 0V5M12 5v22M23 27V5c-3 2-4.5 6-4.5 10H23" />
    </>
  ),
  drop: (
    <>
      <path d="M16 4c5 7 8 11 8 15a8 8 0 0 1-16 0c0-4 3-8 8-15Z" fill="var(--fill, transparent)" />
      <path d="M12.3 19.5a4 4 0 0 0 3 3.6" />
    </>
  ),
  screen: (
    <>
      <rect x="9" y="4" width="14" height="24" rx="3.5" fill="var(--fill, transparent)" />
      <path d="M14 24h4" />
    </>
  ),
  bulb: (
    <>
      <path d="M11.5 20c-2.3-1.7-4-4.2-4-7.5a8.5 8.5 0 0 1 17 0c0 3.3-1.7 5.8-4 7.5v2.5h-9Z" fill="var(--fill, transparent)" />
      <path d="M12.5 26.5h7M14 16l2 2 2-2" />
    </>
  ),
  weather: (
    <>
      <circle cx="11" cy="11" r="4.5" />
      <path d="M11 3v1.5M3 11h1.5M5.3 5.3l1.1 1.1M16.7 5.3l-1.1 1.1" />
      <path d="M10 26h13a5 5 0 0 0 0-10 7 7 0 0 0-13.2 1.8A4.2 4.2 0 0 0 10 26Z" fill="var(--fill, var(--surface))" />
    </>
  ),
  coffee: (
    <>
      <path d="M6 13h16v6a7 7 0 0 1-7 7h-2a7 7 0 0 1-7-7Z" fill="var(--fill, transparent)" />
      <path d="M22 15h1.5a3 3 0 0 1 0 6H22M11 4c-1.5 2 1.5 3 0 5M16.5 4c-1.5 2 1.5 3 0 5" />
    </>
  ),
  wine: (
    <>
      <F d="M10.6 8h10.8l-.6 3a5 5 0 0 1-9.6 0Z" />
      <path d="M10 4h12l-1 7a5 5 0 0 1-10 0ZM16 16v10M11 27h10" />
    </>
  ),
  cycle: (
    <>
      <circle cx="16" cy="16" r="5" fill="var(--fill, transparent)" stroke="none" />
      <path d="M25.5 12.5A10 10 0 0 0 7.8 9.8M6.5 19.5a10 10 0 0 0 17.7 2.7M7 4.5v5.5h5.5M25 27.5V22h-5.5" />
    </>
  ),
  smell: (
    <>
      <path d="M6 28c4-1 16-1 20 0" />
      <path d="M10 24c-3-4 3-6 0-10s2-6 0-9M16 24c-3-4 3-6 0-10s2-6 0-9M22 24c-3-4 3-6 0-10s2-6 0-9" />
    </>
  ),
  noise: (
    <>
      <path d="M5 12h5l7-6v20l-7-6H5Z" fill="var(--fill, transparent)" />
      <path d="M21 11.5a6 6 0 0 1 0 9M24.5 8a11 11 0 0 1 0 16" />
    </>
  ),

  /* ---- symptoms ---- */
  eye: (
    <>
      <path d="M3 18c3.5-5.5 8-8 13-8s9.5 2.5 13 8c-3.5 5.5-8 8-13 8s-9.5-2.5-13-8Z" fill="var(--fill, transparent)" />
      <Dot x={16} y={18} r={3.6} />
      <path d="M16 3v3.5M8.5 5.5l1.7 2.8M23.5 5.5l-1.7 2.8" />
    </>
  ),
  ear: (
    <>
      <path d="M19 27c-2.5 1.5-6 0-6-3.5 0-3-5-4.5-5-10.5a8 8 0 0 1 16 0c0 4-3 5.5-3 8.5" fill="var(--fill, transparent)" />
      <path d="M13 13a3 3 0 0 1 6 0c0 2-2 2.5-2 4.5M27 9l2-1.5M27.5 14H30" />
    </>
  ),
  queasy: (
    <>
      <circle cx="16" cy="16" r="12" fill="var(--fill, transparent)" />
      <path d="M10.5 13.5h3.5M18 13.5h3.5M9.5 21c1.6-1.6 3.1-1.6 4.4 0s2.9 1.6 4.2 0 2.9-1.6 4.4 0" />
    </>
  ),
  vomit: (
    <>
      <circle cx="13.5" cy="13" r="10" fill="var(--fill, transparent)" />
      <path d="M8.5 11.5q1.5-1.6 3 0M14.5 11.5q1.5-1.6 3 0" />
      <ellipse cx="15.5" cy="17.6" rx="2.6" ry="2.1" fill="currentColor" stroke="none" />
      <path d="M17 19.8c1.8 3.4 4.4 5 7.5 5.2" strokeWidth="2.6" />
      <Dot x={27.5} y={23} r={1.5} />
      <Dot x={26} y={28.5} r={1.5} />
    </>
  ),

  /* ---- where it hurts: a tiny head with the sore area in coral (var(--hit)).
     Front view for face zones; Left/Right/Back are seen from behind so "left" is your left. ---- */
  'z-forehead': <Zone hit={<ellipse cx="16" cy="9" rx="7.5" ry="3.4" />} />,
  'z-eyes': (
    <Zone
      hit={
        <>
          <circle cx="12" cy="14.5" r="3" />
          <circle cx="20" cy="14.5" r="3" />
        </>
      }
      face="eyes-open"
    />
  ),
  'z-temples': (
    <Zone
      hit={
        <>
          <circle cx="7.4" cy="12.5" r="2.6" />
          <circle cx="24.6" cy="12.5" r="2.6" />
        </>
      }
    />
  ),
  'z-all': <Zone hit={<ellipse cx="16" cy="14.5" rx="10" ry="11.5" />} />,
  'z-left': <Zone back hit={<path d="M16 3a10 11.5 0 0 0 0 23Z" />} side="L" />,
  'z-right': <Zone back hit={<path d="M16 3a10 11.5 0 0 1 0 23Z" />} side="R" />,
  'z-back': <Zone back hit={<ellipse cx="16" cy="19" rx="8.5" ry="5.5" />} />,
  'z-neck': <Zone hit={<rect x="12.2" y="24" width="7.6" height="6" rx="1.5" />} />,
  aura: (
    <>
      <path d="M4 23l3.5-8 3.5 6 3.5-9 3.5 8 3.5-9 3.5 7 3.5-6" />
      <path d="M8 4.5q.6 2.4 3 3-2.4.6-3 3-.6-2.4-3-3 2.4-.6 3-3Z" fill="currentColor" strokeWidth="1" />
      <Dot x={24} y={27} r={1.5} />
    </>
  ),
  dizzy: (
    <>
      <circle cx="16" cy="16" r="12" fill="var(--fill, transparent)" stroke="none" />
      <path d="M16 16a2 2 0 0 1 4 0 4 4 0 0 1-8 0 6 6 0 0 1 12 0 8 8 0 0 1-16 0 10 10 0 0 1 20 0" />
    </>
  ),
  battery: (
    <>
      <rect x="4" y="10" width="21" height="12" rx="3.5" fill="var(--fill, transparent)" />
      <path d="M28 14v4" />
      <rect x="7" y="13" width="4" height="6" rx="1" fill="currentColor" stroke="none" />
    </>
  ),
  fog: (
    <>
      <path d="M9 17h14a5 5 0 0 0 0-10 7 7 0 0 0-13.2 1.8A4.2 4.2 0 0 0 9 17Z" fill="var(--fill, transparent)" />
      <path d="M5 21.5h17M9 26h17" />
    </>
  ),
  head: (
    <>
      <path d="M8 27v-3.5C5.5 21.6 4 18.5 4 15A11.5 11.5 0 0 1 26.6 12l2.2 4.5-2.4.9V21a3 3 0 0 1-3 3H21v3" fill="var(--fill, transparent)" />
    </>
  ),
  question: (
    <>
      <circle cx="16" cy="16" r="12" fill="var(--fill, transparent)" />
      <path d="M12.5 12.5a3.5 3.5 0 1 1 5 3.2c-1 .5-1.5 1.2-1.5 2.3v.5" />
      <Dot x={16} y={22.5} />
    </>
  ),
}

export type GlyphName = keyof typeof GLYPHS

export function Glyph({ name, size = 24, className }: { name: string; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {GLYPHS[name] ?? GLYPHS.question}
    </svg>
  )
}
