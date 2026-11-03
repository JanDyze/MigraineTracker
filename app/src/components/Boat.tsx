import { useId } from 'react'

/*
 * Grami, Might's little companion: a round white mochi sitting in a paper boat, paws curled over
 * the rim, with a teal flag poking up behind its head.
 *   calm – bobs on a gentle swell, breathes, blinks and glances around now and then
 *   hurt – rocks in choppy water with its eyes squeezed shut, a bead of sweat and a scribble of pain
 *   talk – hops a little and chatters while it answers
 * Each sea layer is a long strip that slides one wavelength and loops, so the water keeps moving.
 * Animations live in index.css (.boat-*) and switch off with reduced motion.
 */

export type BoatMood = 'calm' | 'hurt' | 'talk'

const INK = '#1b3a57'
const SHADE = '#d6e6f1'
const MOUTH = '#7a2f3a'

// round crown, then chubby cheeks that puff out below the eyes before tucking into the boat
const BODY = 'M44 76C28 72 23 53 30 42C32.5 38.5 35 35 37 32C42 19 59 11 80 11C101 11 118 19 123 32C125 35 127.5 38.5 130 42C137 53 132 72 116 76Z'
const HULL = 'M10 54Q46 64 80 69Q114 64 150 54L121 93Q80 97 39 93Z'
const FLAG = 'M103.5 -10C111 -14 117 -7 127 -11L121 -3.5L127 4C117 8 111 0 103 4Z'
const SMILE = 'M74 43.5Q80 45 86 43.5Q85.5 51.5 80 51.5Q74.5 51.5 74 43.5Z'
// a mitten that curls over the rim; drawn around (0,0) and placed on each side
const PAW = 'M-8 1.5C-8.5-5-4-7.5 0-7.5S8.5-5 8 1.5C7.5 4.5 4 5.5 0 5.5S-7.5 4.5-8 1.5Z'

/** Sea surface from x=-80 to 240 around baseline y, plus a curl of foam under every crest. */
function sea(rough: boolean, y: number) {
  const step = rough ? 20 : 40
  const crest = rough ? y - 7.5 : y - 3.75
  let d = `M-80 ${y}`
  let foam = ''
  for (let x = -80, up = true; x < 240; x += step, up = !up) {
    d += rough
      ? `Q${x + 10} ${up ? y - 15 : y + 15} ${x + 20} ${y}`
      : `C${x + 14} ${up ? y - 5 : y + 5} ${x + 26} ${up ? y - 5 : y + 5} ${x + 40} ${y}`
    if (up) foam += rough ? `M${x + 6} ${crest + 5}q4-2.5 8 0` : `M${x + 12} ${crest + 4.5}q8-4 16 0`
  }
  return { d, foam }
}
const SEAS = {
  calm: { back: sea(false, 87), front: sea(false, 95) },
  rough: { back: sea(true, 85), front: sea(true, 95) },
}

type Props = { mood?: BoatMood; size?: number; water?: boolean; title?: string }

export function Boat({ mood = 'calm', size = 120, water = true, title }: Props) {
  const id = useId().replace(/[^\w-]/g, '')
  const url = (name: string) => `url(#${id}-${name})`
  const hurt = mood === 'hurt'
  const { back, front } = SEAS[hurt ? 'rough' : 'calm']
  const box = water ? [0, -18, 160, 134] : [4, -18, 152, 118]
  const ink = { stroke: INK, strokeWidth: 3, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
  return (
    <svg
      width={size}
      height={(size * box[3]) / box[2]}
      viewBox={box.join(' ')}
      className={`boat boat-${mood}`}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        <radialGradient id={`${id}-skin`} cx="0.38" cy="0.3" r="0.8">
          <stop offset="0.55" stopColor="#ffffff" />
          <stop offset="1" stopColor="#d9e8f2" />
        </radialGradient>
        <radialGradient id={`${id}-blush`}>
          <stop offset="0" stopColor="#f7918f" stopOpacity="0.95" />
          <stop offset="0.6" stopColor="#f7918f" stopOpacity="0.6" />
          <stop offset="1" stopColor="#f59a96" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-paper`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#e6eff6" />
        </linearGradient>
        <linearGradient id={`${id}-flag`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#45bfd0" />
          <stop offset="1" stopColor="#2689a8" />
        </linearGradient>
        <linearGradient id={`${id}-sea`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4cc4d6" />
          <stop offset="1" stopColor="#2a8fb0" />
        </linearGradient>
        <clipPath id={`${id}-pool`}>
          <path d="M0 -20H160V96Q160 112 80 114Q0 112 0 96Z" />
        </clipPath>
        <clipPath id={`${id}-mouth`}>
          <path d={SMILE} />
        </clipPath>
      </defs>

      {water && (
        <g clipPath={url('pool')}>
          <g className="boat-sea boat-sea-back">
            <path d={`${back.d}L240 120L-80 120Z`} fill="#a3dfe8" />
            <path d={back.d} fill="none" stroke="#7fcfdc" strokeWidth="2" strokeLinecap="round" />
          </g>
        </g>
      )}

      <g className="boat-body">
        {/* the inside of the boat, showing past Grami at both ends */}
        <path d="M10 54L80 45L150 54Q114 64 80 69Q46 64 10 54Z" fill={SHADE} />
        <path d="M10 54L80 45L150 54" fill="none" {...ink} />

        <g className="boat-buddy">
          {/* mast and flag, planted behind the head */}
          <path d="M100 24L104 -12" {...ink} />
          <circle cx="104.2" cy="-14" r="2.6" fill="#f4c04e" stroke={INK} strokeWidth="2" />
          <g className="boat-flag">
            <path d={FLAG} fill={url('flag')} {...ink} strokeWidth={2.4} />
            <path d="M107.5 -5q2.5-2 5 0t5 0M108.5 -0.8q2.2-1.8 4.4 0t4.4 0" fill="none" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" opacity="0.95" />
          </g>

          <path d={BODY} fill={url('skin')} {...ink} />
          {/* a soft gleam on the crown */}
          <path d="M55 27Q62 18 73 16" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.9" />

          {/* big rosy cheeks, each with a little shine */}
          <ellipse cx="49" cy="46" rx="10.5" ry="7.5" fill={url('blush')} />
          <ellipse cx="111" cy="46" rx="10.5" ry="7.5" fill={url('blush')} />
          <circle cx="46" cy="43.5" r="1.5" fill="#fff" opacity="0.9" />
          <circle cx="108" cy="43.5" r="1.5" fill="#fff" opacity="0.9" />

          {hurt ? (
            <g fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M61 32.5l7 4-7 4M99 32.5l-7 4 7 4" />
              <path d="M72.5 47.5q1.9-2.4 3.8 0t3.8 0 3.8 0 3.8 0" strokeWidth="2.2" />
              <path className="boat-sweat" d="M133 20q-4.5 6.5 0 9.5q4.5-3 0-9.5z" fill="#8fd3e4" strokeWidth="1.6" />
              <path className="boat-scribble" d="M24 8c-5-5 3-10 8-6s-6 8-7 2 9-8 12-3-4 8-8 5 2-9 7-7" stroke={`var(--ink, ${INK})`} strokeWidth="1.8" />
            </g>
          ) : (
            <g>
              <g className="boat-glance">
                <g className="boat-eyes" fill={INK}>
                  <ellipse cx="66" cy="36" rx="4.3" ry="5.1" />
                  <ellipse cx="94" cy="36" rx="4.3" ry="5.1" />
                  <circle cx="67.5" cy="34" r="1.7" fill="#fff" />
                  <circle cx="95.5" cy="34" r="1.7" fill="#fff" />
                  <circle cx="64.8" cy="38.3" r="0.8" fill="#fff" />
                  <circle cx="92.8" cy="38.3" r="0.8" fill="#fff" />
                </g>
              </g>
              {mood === 'talk' ? (
                <ellipse className="boat-mouth" cx="80" cy="46.5" rx="3.8" ry="3.6" fill={MOUTH} stroke={INK} strokeWidth="1.6" />
              ) : (
                <g>
                  <path d={SMILE} fill={MOUTH} />
                  <ellipse cx="80" cy="52" rx="4" ry="3" fill="#f2878a" clipPath={url('mouth')} />
                  <path d={SMILE} fill="none" stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
                </g>
              )}
            </g>
          )}
        </g>

        {/* the paper boat: lit on the left, the fold's shade on the right, ends folded in */}
        <path d={HULL} fill={url('paper')} />
        <path d="M80 69Q114 64 150 54L121 93Q100.5 95.5 80 96Z" fill="#dbe8f2" opacity="0.55" />
        <path d="M10 54L33 60L39 93ZM150 54L127 60L121 93Z" fill={SHADE} />
        <path d="M33 60L39 93M127 60L121 93M80 69V96" fill="none" stroke={INK} strokeWidth="1.5" strokeLinecap="round" opacity="0.35" />
        <path d={HULL} fill="none" {...ink} />

        {/* paws curled over the rim */}
        <g className="boat-buddy" stroke={INK} strokeLinecap="round" strokeLinejoin="round">
          {['translate(61 65.5) rotate(9)', 'translate(99 65.5) rotate(-9)'].map((t) => (
            <g key={t} transform={t}>
              <path d={PAW} fill="#ffffff" strokeWidth="2.4" />
              <path d="M-2.6 2.2v2.2M2.6 2.2v2.2" fill="none" strokeWidth="1.4" />
            </g>
          ))}
        </g>
      </g>

      {water && (
        <g>
          {hurt && (
            <path className="boat-spray" d="M2 61q2.5-7 5 0M153 61q2.5-7 5 0" fill="none" stroke="#3bb5c9" strokeWidth="2.6" strokeLinecap="round" />
          )}
          <g clipPath={url('pool')}>
            <g className="boat-sea">
              <path d={`${front.d}L240 120L-80 120Z`} fill={url('sea')} />
              <path d={front.d} fill="none" stroke="#1f7894" strokeWidth="2.6" strokeLinecap="round" />
              <path d={front.foam} fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" opacity="0.85" />
            </g>
          </g>
        </g>
      )}
    </svg>
  )
}
