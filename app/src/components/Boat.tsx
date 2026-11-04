import { useId, type CSSProperties } from 'react'
import type { BoatMood } from '../lib/mood'
import { presetFor } from '../lib/attacks'
import { Glyph } from './Glyph'

/*
 * Grami, Might's little companion: a soft white mochi sitting in a paper boat, paws curled over
 * the rim, with a teal flag poking up behind its head. Its faces follow the sticker sheet:
 *   happy, calm, tired, recovering – calm water; eyes, mouth and sometimes a little extra (sparkles…)
 *   mild → moderate → severe → attack – the worse the migraine, the rougher the sea: squeezed eyes,
 *     red zaps, tears, and at worst a storm cloud overhead
 *   thinking, talk – for the chat: looking up with "…", or chattering
 * Each sea layer is a long strip that slides one wavelength and loops, so the water keeps moving.
 * Animations live in index.css (.boat-*) and switch off with reduced motion.
 */

export type { BoatMood }

const ROUGH: BoatMood[] = ['moderate', 'severe', 'attack']
const STORMY: BoatMood[] = ['severe', 'attack']
// Grami is drawn a size smaller than the boat and sits low in it, so only the head peeks over the
// rim: head coordinates are scaled around (80, 69) and placed so the neck sits at the rim
const SMALL = 'translate(76 63) scale(0.9) translate(-80 -69)'
// Grami is drawn turned a little to the right (a three-quarter view, as in the Mighty sheet):
// the face sits right of centre, and the boat tips its bow up on the right
const FACE_TURN = 'translate(11 -7)'
const BOAT_TILT = 'rotate(-8 80 72)'

const INK = '#2b4766'
const SHADE = '#d6e6f1'
const MOUTH = '#7a2f3a'

// The head, as in Mighty screen 1: a round dome; on the side Grami faces, a smaller second curve
// low down rounds out as the cheek before tucking into the boat. The back of the head stays a
// smooth curve. No neck or chin: Grami is one soft mochi blob.
const BODY =
  'M 35.5 74 C 32 64.5 31.8 52 34.6 41.5 C 40 19.5 56.8 6 80 6' +
  'C 103.3 6 119.1 19 122.2 38.5 C 122.6 41 122.8 43 122.8 45 C 127 46.5 129.8 50 130.2 56 C 130.7 63 128.4 70 123.7 74Z'
// the flag waves between these two shapes, streaming out to the right
const FLAG_A = 'M109 -17C116 -21 124 -13 135 -17L130 -10.5L135 -4C124 -0.5 116 -8.5 109 -4.5Z'
const FLAG_B = 'M109 -17C116 -13 125 -21 135 -15.5L130.5 -9.5L135 -3C125 -8 116 -0.5 109 -4.5Z'
// a small, soft fin on top of the head, leaning back: a hint of shark, not a costume
const FIN = 'M62.5 13C63 6 61 0.5 57 -3.2C56 -4.2 56.8 -5.6 58.2 -5.4C67 -4.3 74.5 1.2 79 9Z'
/** true when the phone asks for less motion (the flag then hangs still) */
const stillFlag = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
// the rim dips low and flat in the middle, like the sheet's boat
const RIM = 'M10 54C24 64 46 69.5 80 69.5C114 69.5 136 64 150 54'
const HULL = RIM + 'L121 93Q80 97 39 93Z'
// Might's logo (swell settling into a calm line), in the logo's own 1024 grid
const LOGO = 'M168,622 C212,622 236,402 296,402 C356,402 360,622 412,622 C464,622 476,472 528,472 C580,472 596,622 648,622 L856,622'
const SMILE = 'M74.5 55.5Q80 57 85.5 55.5Q85 63 80 63Q75 63 74.5 55.5Z'
// a mitten that curls over the rim; drawn around (0,0) and placed on each side
const PAW = 'M-7.5 1C-7.5-4.5-4-7 0-7S7.5-4.5 7.5 1C7.5 4.5 4 6 0 6S-7.5 4.5-7.5 1Z'

/** Sea surface from x=-320 to 480 around baseline y (long enough to reach both edges of a wide,
 *  short scene), plus a curl of foam under every crest. */
function sea(rough: boolean, y: number) {
  const step = rough ? 20 : 40
  const crest = rough ? y - 7.5 : y - 3.75
  let d = `M-320 ${y}`
  let foam = ''
  for (let x = -320, up = true; x < 480; x += step, up = !up) {
    d += rough
      ? `Q${x + 10} ${up ? y - 15 : y + 15} ${x + 20} ${y}`
      : `C${x + 14} ${up ? y - 5 : y + 5} ${x + 26} ${up ? y - 5 : y + 5} ${x + 40} ${y}`
    if (up) foam += rough ? `M${x + 6} ${crest + 5}q4-2.5 8 0` : `M${x + 12} ${crest + 4.5}q8-4 16 0`
  }
  return { d, foam }
}
const SEAS = {
  calm: { back: sea(false, 87), front: sea(false, 95), deep: sea(false, 106) },
  rough: { back: sea(true, 85), front: sea(true, 95), deep: sea(true, 106) },
}
// in the scene the sea runs higher, so the waves wash over the lower half of the boat
const SCENE_SEAS = {
  calm: { back: sea(false, 78), front: sea(false, 85), deep: sea(false, 97) },
  rough: { back: sea(true, 76), front: sea(true, 85), deep: sea(true, 97) },
}

/** A puffy cloud of three bumps, sitting on (x, y). */
const cloud = (x: number, y: number, r: number) =>
  `M${x - 2 * r} ${y}a${r} ${r} 0 0 1 ${r * 0.9}-${r * 1.2}a${r * 1.25} ${r * 1.25} 0 0 1 ${r * 2.2}-${r * 0.4}a${r} ${r} 0 0 1 ${r * 0.9} ${r * 1.6}Z`
// rain for the stormy sky: short slanted streaks spread over the circle
const RAIN = Array.from({ length: 24 }, (_, i) => `M${-100 + i * 15} ${-30 + ((i * 37) % 60)}l-3 9`).join('')

/** water: the strip of sea under the boat; scene: the full picture (round sky, clouds, sparkles, big waves) for Today. */
/**
 * water: the strip of sea under the boat; scene: the full picture for Today.
 * pains: where it hurts (location values from the log); symptoms: how else it feels. Both show on
 * Grami: a pulsing glow on that part of the head, and a little sign for each symptom.
 */
type Props = {
  mood?: BoatMood
  size?: number
  water?: boolean
  scene?: boolean
  title?: string
  pains?: string[]
  symptoms?: string[]
  /** what might have set it off: shown as icons in a thought bubble */
  triggers?: string[]
  /** medicine taken: Grami holds a little capsule */
  meds?: string[]
}

export function Boat({ mood = 'calm', size = 120, water = true, scene = false, title, pains = [], symptoms = [], triggers = [], meds = [] }: Props) {
  const id = useId().replace(/[^\w-]/g, '')
  const url = (name: string) => `url(#${id}-${name})`
  const rough = ROUGH.includes(mood)
  const stormy = STORMY.includes(mood)
  const { back, front, deep } = (scene ? SCENE_SEAS : SEAS)[rough ? 'rough' : 'calm']
  const box = scene ? [-30, -34, 220, 158] : water ? [0, -20, 160, 136] : [4, -20, 152, 120]
  const pool = scene ? 'scene-pool' : 'pool'
  const ink = { stroke: INK, strokeWidth: 2.8, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
  const bold = { ...ink, strokeWidth: 3.4 }
  return (
    <svg
      width={size}
      height={(size * box[3]) / box[2]}
      viewBox={box.join(' ')}
      className={`boat boat-${mood}${rough ? ' boat-rough' : ''}${stormy ? ' boat-rock' : ''}`}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        <radialGradient id={`${id}-skin`} cx="0.4" cy="0.28" r="0.78">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.7" stopColor="#fdfefe" />
          <stop offset="0.92" stopColor="#f0f5f9" />
          <stop offset="1" stopColor="#e3ebf2" />
        </radialGradient>
        <filter id={`${id}-soft`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
        <filter id={`${id}-blush`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.2" />
        </filter>
        <filter id={`${id}-softer`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4.5" />
        </filter>
        <clipPath id={`${id}-body`}>
          <path d={BODY} />
        </clipPath>
        <linearGradient id={`${id}-inside`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c3d6e6" />
          <stop offset="1" stopColor="#e4edf5" />
        </linearGradient>
        <linearGradient id={`${id}-paper`} x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.5" stopColor="#f2f7fb" />
          <stop offset="1" stopColor="#cfdeeb" />
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
          <path d="M0 -30H160V96Q160 112 80 114Q0 112 0 96Z" />
        </clipPath>
        {/* the scene runs well past its viewBox on both sides, so on a wide screen the sky and
            sea reach the screen edges while Grami stays the same size */}
        <clipPath id={`${id}-scene-pool`}>
          <rect x="-320" y="-60" width="800" height="184" />
        </clipPath>
        <radialGradient
          id={`${id}-air`}
          gradientUnits="userSpaceOnUse"
          cx="80"
          cy="44"
          r="96"
          gradientTransform="translate(80 44) scale(1.7 1) translate(-80 -44)"
        >
          <stop offset="0" style={{ stopColor: stormy ? 'var(--storm-1)' : 'var(--sky-1)' }} />
          <stop offset="0.55" style={{ stopColor: stormy ? 'var(--storm-2)' : 'var(--sky-2)' }} stopOpacity="0.75" />
          <stop offset="1" style={{ stopColor: stormy ? 'var(--storm-3)' : 'var(--sky-3)' }} stopOpacity="0" />
        </radialGradient>
        {/* the sea fades out softly at the bottom instead of ending in a hard edge */}
        <linearGradient id={`${id}-fade-y`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.82" stopColor="#fff" />
          <stop offset="1" stopColor="#000" />
        </linearGradient>
        <mask id={`${id}-fade`} maskUnits="userSpaceOnUse" x="-320" y="-60" width="800" height="184">
          <rect x="-320" y="-60" width="800" height="184" fill={url('fade-y')} />
        </mask>
        <clipPath id={`${id}-mouth`}>
          <path d={SMILE} />
        </clipPath>
      </defs>

      {scene && (
        <g>
          <rect x="-320" y="-60" width="800" height="184" fill={url('air')} />
          {!stormy && (
            <g className="boat-night">
              <path d="M150 -44a11 11 0 1 0 9 18a9 9 0 1 1-9-18z" fill="#f3e3a6" />
              <g className="boat-twinkle" fill="#f3e3a6">
                <circle cx="-6" cy="-30" r="1.3" />
                <circle cx="24" cy="-42" r="1" />
                <circle cx="60" cy="-38" r="1.4" />
                <circle cx="112" cy="-44" r="1.1" />
                <circle cx="176" cy="2" r="1.2" />
                <circle cx="-18" cy="16" r="1" />
                <circle cx="132" cy="-16" r="0.9" />
              </g>
            </g>
          )}
          <g style={{ fill: stormy ? 'var(--storm-cloud)' : 'var(--cloud)' }} opacity="0.95">
            <path className="boat-cloud" d={cloud(-2, 36, 9)} />
            <path className="boat-cloud boat-cloud-2" d={cloud(150, 12, 8)} />
            <path className="boat-cloud" d={cloud(36, -22, 5)} />
          </g>
          {mood === 'attack' ? (
            <path className="boat-rain" d={RAIN} fill="none" stroke="#6c86ab" strokeWidth="1.6" strokeLinecap="round" opacity="0.7" />
          ) : stormy ? null : (
            <path className="boat-birds" d="M54 -30q3-3.5 6 0q3-3.5 6 0M70 -38q2.2-2.6 4.4 0q2.2-2.6 4.4 0" fill="none" stroke="#4cb8cf" strokeWidth="1.8" strokeLinecap="round" />
          )}
        </g>
      )}

      {(water || scene) && (
        <g clipPath={url(pool)} mask={scene ? url('fade') : undefined}>
          <g className="boat-sea boat-sea-back">
            <path d={`${back.d}L480 140L-320 140Z`} fill="#a3dfe8" />
            <path d={back.d} fill="none" stroke="#7fcfdc" strokeWidth="2" strokeLinecap="round" />
          </g>
        </g>
      )}

      <g className="boat-body">
        {/* the inside of the boat, showing past Grami at both ends */}
        <g transform={BOAT_TILT}>
          <path d="M10 54L80 45L150 54C136 64 114 69.5 80 69.5C46 69.5 24 64 10 54Z" fill={url('inside')} />
          <path d="M10 54L80 45L150 54" fill="none" {...ink} />
        </g>

        <g transform={SMALL}>
        <g className="boat-buddy">
          {/* a little flag stuck in the top of the head, waving in the wind, with Might's logo */}
          <path d="M104 20L109 -18" {...ink} strokeWidth={3} />
          <circle cx="109.2" cy="-19.4" r="2.6" fill={INK} />
          <path d={FLAG_A} fill={url('flag')} {...ink} strokeWidth={2.4}>
            {!stillFlag() && (
              <animate attributeName="d" dur={rough ? '0.7s' : '1.8s'} repeatCount="indefinite" values={`${FLAG_A};${FLAG_B};${FLAG_A}`} calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1" />
            )}
          </path>
          <g transform="translate(114.5 -10.5) scale(0.022) translate(-168 -622)">
            <path d={LOGO} fill="none" stroke="#fff" strokeWidth="80" strokeLinecap="round" strokeLinejoin="round">
              {!stillFlag() && <animateTransform attributeName="transform" type="translate" dur={rough ? '0.7s' : '1.8s'} repeatCount="indefinite" values="0 0;0 40;0 0" />}
            </path>
          </g>

          <path d={FIN} fill={url('skin')} {...bold} />
          <path d="M60.5 2.5Q66 2.5 70.5 7" fill="none" stroke="#c9d8e6" strokeWidth="2.4" strokeLinecap="round" />
          <path d={BODY} fill={url('skin')} />
          {/* soft light and shade, so Grami reads as a squishy ball rather than a flat shape;
              a little shadow inside each cheek lobe makes the cheeks look plump */}
          <g clipPath={url('body')}>
            <ellipse cx="80" cy="74" rx="52" ry="10" fill="#a9bfd4" opacity="0.4" filter={url('softer')} />
            <ellipse cx="40" cy="52" rx="9" ry="22" fill="#c9d8e6" opacity="0.7" filter={url('softer')} />
            {/* soft shade under each cheek, so both read as plump: the near one round, the far one puffing out */}
            <path d="M50 59Q62 67.5 74 59M108 58.5Q119 66 128 58" fill="none" stroke="#c3d3e2" strokeWidth="3.6" strokeLinecap="round" filter={url('soft')} />
            {/* the sailor's scarf, just showing above the rim (the colour follows the scene) */}
            <g transform={BOAT_TILT}>
              <path d="M24 57Q80 73 136 57L136 70Q80 86 24 70Z" style={{ fill: 'var(--scarf, #5ccbdc)' }} />
              <path d="M24 57Q80 73 136 57" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
              <path d="M28 63Q80 78.5 132 63" fill="none" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" opacity="0.45" />
            </g>
          </g>
          <path d={BODY} fill="none" {...bold} />

          {/* rosy blush on the plumpest part of the cheeks */}
          <ellipse cx="62" cy="52.5" rx="8.5" ry="5.4" fill="#f59c9a" opacity="0.9" filter={url('blush')} />
          <ellipse cx="118.5" cy="52.5" rx="7.5" ry="5.2" fill="#f59c9a" opacity="0.9" filter={url('blush')} />
          <ellipse cx="59" cy="50" rx="3" ry="1.6" fill="#ffffff" opacity="0.85" />
          <ellipse cx="116" cy="50" rx="2.4" ry="1.4" fill="#ffffff" opacity="0.8" />

          {/* where it hurts glows on the head, and feeling sick turns Grami a little green */}
          <g clipPath={url('body')}>
            {(symptoms.includes('Nausea') || symptoms.includes('Vomiting')) && (
              <g>
                <ellipse cx="94" cy="30" rx="36" ry="20" fill="#9edca4" opacity={symptoms.includes('Vomiting') ? 0.55 : 0.4} filter={url('softer')} />
                <path d="M84 14v9M92 12v12M100 14v9" fill="none" stroke="#5aa86a" strokeWidth="2.2" strokeLinecap="round" opacity="0.75" />
              </g>
            )}
            {symptoms.includes('Brain fog') && <ellipse cx="80" cy="14" rx="50" ry="12" fill="#e3e9f0" opacity="0.7" filter={url('softer')} />}
            {pains.flatMap((spot) => PAIN_SPOTS[spot] ?? []).map(([cx, cy, rx, ry], i) => (
              <ellipse key={i} className="boat-pain" cx={cx} cy={cy} rx={rx} ry={ry} fill="#ff6f61" opacity="0.45" filter={url('softer')} />
            ))}
          </g>

          <g transform={FACE_TURN}>
            <Face mood={mood} url={url} />
            {symptoms.includes('Light sensitivity') && (
              <g>
                <path d="M57 46.5h13.5a2 2 0 0 1 2 2.2l-.6 4.2a4 4 0 0 1-4 3.4H62a4.5 4.5 0 0 1-4.4-3.6Z" fill={INK} />
                <path d="M89.5 46.5H103a2 2 0 0 1 2 2.2l-.6 4.2a4 4 0 0 1-4 3.4h-5.4a4.5 4.5 0 0 1-4.4-3.6Z" fill={INK} />
                <path d="M72.5 49q8.5-3 17 0M57 48l-6-2.5M105 48l5-2.5" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
                <path d="M60 49l3.5 0M92.5 49l3.5 0" stroke="#ffffff" strokeWidth="1.4" strokeLinecap="round" opacity="0.7" />
              </g>
            )}
          </g>
        </g>
        </g>

        {/* the paper boat: lit on the left, the fold's shade on the right, ends folded in */}
        <g transform={BOAT_TILT}>
          <path d={HULL} fill={url('paper')} />
          <path d="M10 54L33 60L39 93ZM150 54L127 60L121 93Z" fill={SHADE} opacity="0.8" />
          <path d="M33 60L39 93M127 60L121 93M80 69.5V96" fill="none" stroke={INK} strokeWidth="1.2" strokeLinecap="round" opacity="0.22" />
          {/* the paws' soft shadows on the paper */}
          <ellipse cx="62" cy="75" rx="6" ry="2.4" fill="#8fa9c2" opacity="0.5" filter={url('soft')} />
          <ellipse cx="112" cy="70" rx="5" ry="2.2" fill="#8fa9c2" opacity="0.4" filter={url('soft')} />
          <path d={HULL} fill="none" {...ink} />
        </g>

        {/* paws curled over the rim */}
        <g className="boat-buddy" stroke={INK} strokeLinecap="round" strokeLinejoin="round">
          {['translate(62 71) rotate(0) scale(0.95)', 'translate(112 64) rotate(-14) scale(0.82)'].map((t) => (
            <g key={t} transform={t}>
              <path d={PAW} fill={url('skin')} strokeWidth="2.8" />
            </g>
          ))}
        </g>
        {/* a capsule held up by the front paw, once medicine is noted */}
        {meds.length > 0 && (
          <g className="boat-buddy" transform="translate(51 51) rotate(-25) scale(0.62)" style={{ color: INK }}>
            <Glyph name="pill" size={32} />
          </g>
        )}
      </g>

      {/* the mood marks (zzz, zaps, notes, the storm cloud) stay put while Grami bobs and rocks */}
      <g transform={SMALL}>
        {/* the thought bubble takes the mood marks' corner, so they don't crowd each other */}
        {triggers.length ? <TriggerThought triggers={triggers} /> : <Extras mood={mood} />}
        <SymptomMarks symptoms={symptoms} />
        <PainMarks pains={pains} />
      </g>

      {(water || scene) && (
        <g>
          <g clipPath={url(pool)} mask={scene ? url('fade') : undefined}>
            <g className="boat-sea">
              <path d={`${front.d}L480 140L-320 140Z`} fill={url('sea')} />
              <path d={front.d} fill="none" stroke="#1f7894" strokeWidth="2.6" strokeLinecap="round" />
              <path d={front.foam} fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" opacity="0.85" />
            </g>
            {scene && (
              <g className="boat-sea boat-sea-deep">
                <path d={`${deep.d}L480 140L-320 140Z`} fill="#2a95b8" />
                <path d={deep.d} fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" opacity="0.75" />
                <path d={deep.foam} fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" opacity="0.6" />
              </g>
            )}
          </g>
        </g>
      )}
    </svg>
  )
}

const line = { fill: 'none', stroke: INK, strokeWidth: 2.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
const ZAP = 'M30 -6l-6 9h5l-4 9 10-12h-5l4-6z'
const STAR = 'M0-6Q1-1 6 0Q1 1 0 6Q-1 1-6 0Q-1-1 0-6Z'

/** Grami's eyes and mouth for each mood: big solid eyes set wide and low, as on the sheet. */
function Face({ mood, url }: { mood: BoatMood; url: (name: string) => string }) {
  const open = (
    <g>
      <path d={SMILE} fill={MOUTH} />
      <ellipse cx="80" cy="62" rx="3.6" ry="2.5" fill="#f2878a" clipPath={url('mouth')} />
      <path d={SMILE} fill="none" stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
    </g>
  )
  const smile = <path d="M75 57q5 4.2 10 0" {...line} />
  const wavy = <path d="M72.5 59q1.9-2.3 3.75 0t3.75 0 3.75 0 3.75 0" {...line} strokeWidth={2.2} />
  const restEyes = <path d="M54 52q6.5 6 13 0M93 52q6.5 6 13 0" {...line} />
  const squeezed = <path d="M56 47.5l8 4.5-8 4.5M104 47.5l-8 4.5 8 4.5" {...line} />
  const dots = (
    <g className="boat-eyes" fill={INK}>
      <ellipse cx="60.5" cy="52" rx="4.5" ry="5.5" />
      <ellipse cx="99.5" cy="52" rx="4.5" ry="5.5" />
      <circle cx="62" cy="50" r="1.6" fill="#fff" />
      <circle cx="101" cy="50" r="1.6" fill="#fff" />
    </g>
  )
  switch (mood) {
    case 'happy': // open, shining eyes and a smile
      return (
        <>
          {dots}
          {open}
        </>
      )
    case 'calm':
      return (
        <>
          {restEyes}
          {smile}
        </>
      )
    case 'recovering':
      return (
        <>
          {restEyes}
          {open}
        </>
      )
    case 'tired': // heavy lids over half-closed eyes
      return (
        <>
          <path d="M56 51.5h9a4.5 4.6 0 0 1-9 0ZM95 51.5h9a4.5 4.6 0 0 1-9 0Z" fill={INK} />
          <path d="M54.5 51.1h12M93.5 51.1h12" {...line} />
          <ellipse cx="80" cy="59" rx="2.2" ry="1.9" fill={MOUTH} />
        </>
      )
    case 'mild': // one eye wincing
      return (
        <>
          <path d="M55 52.5h11" {...line} />
          <path d="M104 47.5l-8 4.5 8 4.5" {...line} />
          {wavy}
        </>
      )
    case 'moderate':
      return (
        <>
          {squeezed}
          {wavy}
        </>
      )
    case 'severe':
    case 'attack':
      return (
        <>
          {squeezed}
          <path d="M74.5 62.5Q80 55 85.5 62.5Z" fill={MOUTH} stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
          <path className="boat-tears" d="M54 56q-2.8 4.5 0 6q2.8-1.5 0-6ZM106 56q-2.8 4.5 0 6q2.8-1.5 0-6Z" fill="#7cc8de" stroke={INK} strokeWidth="1" strokeLinejoin="round" />
        </>
      )
    case 'thinking': // looking up and to the side, mouth a little "o"
      return (
        <>
          <g transform="translate(1.5 -1.5)">{dots}</g>
          <ellipse cx="80" cy="59" rx="2.2" ry="1.9" fill={MOUTH} />
        </>
      )
    case 'talk':
      return (
        <>
          <g className="boat-glance">{dots}</g>
          <ellipse className="boat-mouth" cx="80" cy="58.5" rx="3.2" ry="3" fill={MOUTH} stroke={INK} strokeWidth="1.6" />
        </>
      )
  }
}

/** The little marks around Grami's head that go with each mood. */
function Extras({ mood }: { mood: BoatMood }) {
  switch (mood) {
    case 'happy':
      return (
        <g className="boat-sparkle" fill="none" strokeLinecap="round">
          <path d="M20 4L13-4M14 12L4 10M27 0L26-9" stroke="#b8860b" strokeWidth="6.4" />
          <path d="M20 4L13-4M14 12L4 10M27 0L26-9" stroke="#f6c234" strokeWidth="4.2" />
        </g>
      )
    case 'tired':
      return (
        <g className="boat-float" fill="none" stroke="#7cc8de" strokeWidth="1.8">
          <circle cx="30" cy="8" r="4" />
          <circle cx="21" cy="-2" r="2.4" />
        </g>
      )
    case 'mild':
      return <path className="boat-float" d="M22 3h7l-7 7h7M31-6h5l-5 5h5" {...line} strokeWidth={1.8} />
    case 'moderate':
      return (
        <g>
          <path className="boat-zap" d={ZAP} fill="#ef5b4c" stroke={INK} strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M20 30q-5 7 0 14M13 33q-3 4 0 8" {...line} strokeWidth={1.5} opacity="0.5" />
          <path className="boat-sweat" d="M140 12q-4.5 6.5 0 9.5q4.5-3 0-9.5z" fill="#8fd3e4" stroke={INK} strokeWidth="1.4" />
        </g>
      )
    case 'severe':
      return (
        <g>
          <path className="boat-zap" d={ZAP} fill="#ef5b4c" stroke={INK} strokeWidth="1.2" strokeLinejoin="round" />
          <path className="boat-zap" d={ZAP} transform="translate(166 12) scale(-1 1)" fill="#ef5b4c" stroke={INK} strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M20 30q-5 7 0 14M13 33q-3 4 0 8M140 30q5 7 0 14M147 33q3 4 0 8" {...line} strokeWidth={1.5} opacity="0.5" />
        </g>
      )
    case 'attack': // a storm cloud right over Grami's head
      return (
        <g className="boat-storm">
          <path className="boat-rain" d="M56 8l-2.5 7M64 11l-2.5 7M98 11l-2.5 7M106 8l-2.5 7" stroke="#6c86ab" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M84 -2l-6 10h5l-3 9 10-13h-5l3-6z" fill="#f6c234" stroke={INK} strokeWidth="1.2" strokeLinejoin="round" />
          <path d={cloud(80, 2, 13)} fill="#5a6982" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
        </g>
      )
    case 'recovering': // little stars: the storm has passed
      return (
        <g className="boat-sparkle" fill="#f6c234" stroke="#b8860b" strokeWidth="0.8" strokeLinejoin="round">
          <path d={STAR} transform="translate(26 4) scale(1.1)" />
          <path d={STAR} transform="translate(16 20) scale(0.6)" />
          <path d={STAR} transform="translate(140 22) scale(0.8)" />
        </g>
      )
    case 'thinking':
      return (
        <g className="boat-think" fill={INK}>
          <circle cx="128" cy="26" r="2" />
          <circle cx="135" cy="22" r="2" />
          <circle cx="142" cy="18" r="2" />
        </g>
      )
    default:
      return null
  }
}

/** Where each pain location glows on Grami's head (head coordinates, face turned right). */
const PAIN_SPOTS: Record<string, [number, number, number, number][]> = {
  Forehead: [[92, 24, 17, 7]],
  'Behind eyes': [[72, 40, 8, 6], [109, 40, 8, 6]],
  Temples: [[54, 34, 7, 8], [124, 32, 5, 8]],
  'Left side': [[46, 40, 13, 20]],
  'Right side': [[120, 38, 10, 18]],
  'All over': [[80, 30, 36, 20]],
  'Back of head': [[42, 22, 12, 12]],
  Neck: [[96, 66, 22, 6]],
}


/** Three little comic "ouch" lines fanning out from (x, y) at the given angle (degrees). */
function ouch(x: number, y: number, angle: number) {
  return [-30, 0, 30]
    .map((d) => {
      const r = ((angle + d) * Math.PI) / 180
      const [c, sn] = [Math.cos(r), Math.sin(r)]
      return `M${(x + c * 2).toFixed(1)} ${(y + sn * 2).toFixed(1)}L${(x + c * (d ? 7 : 9)).toFixed(1)} ${(y + sn * (d ? 7 : 9)).toFixed(1)}`
    })
    .join('')
}

/** Where the "ouch" lines go for each pain location: just outside the head, pointing away. */
const OUCH_AT: Record<string, [number, number, number][]> = {
  Forehead: [[104, 3, -70]],
  'Behind eyes': [[132, 34, -10]],
  Temples: [[33, 28, -150], [128, 22, -40]],
  'Left side': [[27, 46, 180]],
  'Right side': [[135, 46, 0]],
  'All over': [[80, -1, -90], [27, 40, 180], [135, 40, 0]],
  'Back of head': [[36, 14, -135]],
  Neck: [[133, 62, 20]],
}

function PainMarks({ pains }: { pains: string[] }) {
  const spots = [...new Set(pains)].flatMap((p) => OUCH_AT[p] ?? [])
  if (!spots.length) return null
  return (
    <g fill="none" stroke="#ef5b4c" strokeWidth="2.2" strokeLinecap="round">
      {spots.map(([x, y, ang], i) => (
        <path key={i} className="boat-ouch" d={ouch(x, y, ang)} style={{ animationDelay: `${i * 0.25}s` }} />
      ))}
    </g>
  )
}

/** A little sign around Grami for each symptom ticked in the log. */
function SymptomMarks({ symptoms }: { symptoms: string[] }) {
  const has = (v: string) => symptoms.includes(v)
  const move = !stillFlag()
  return (
    <g>
      {has('Vomiting') && (
        <path className="boat-float" d="M140 54q-4 6 0 9q4-3 0-9z" fill="#9edca4" stroke="#4f9a5e" strokeWidth="1.4" strokeLinejoin="round" />
      )}
      {has('Sound sensitivity') && (
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 40q4 5 0 10M8 36q7 9 0 18" stroke={INK} strokeWidth="2" />
          <circle cx="11" cy="45" r="9.5" stroke="#ef5b4c" strokeWidth="2" />
          <path d="M4.3 51.7l13.4-13.4" stroke="#ef5b4c" strokeWidth="2" />
        </g>
      )}
      {has('Smell sensitivity') && (
        <path className="boat-float" d="M141 66q-3-3 0-6t0-6t0-6M147 64q-3-3 0-6t0-6M153 66q-3-3 0-6t0-6t0-6" fill="none" stroke="#7fa35a" strokeWidth="1.9" strokeLinecap="round" />
      )}
      {has('Aura') && (
        <g className="boat-aura" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M24 36l3-6 4 4 3-7 4 4 3-7 4 3 3-6 4 3" stroke="#f6c234" strokeWidth="2.6" />
          <path d="M24 36l3-6 4 4 3-7 4 4 3-7 4 3 3-6 4 3" stroke="#5fd3c4" strokeWidth="1" transform="translate(1.5 2.5)" />
        </g>
      )}
      {has('Fatigue') && (
        <g className="boat-float" fill="none" stroke={INK} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M139 26h7l-7 7h7" />
          <path d="M148 15h5l-5 5h5" strokeWidth="1.5" />
        </g>
      )}
      {has('Brain fog') && (
        <g className="boat-cloud" opacity="0.9">
          <path d="M56 -4a7 7 0 0 1 12-5a9 9 0 0 1 16 1a6 6 0 0 1 7 7H56Z" fill="#dfe6ee" />
          <path d="M84 -1a5 5 0 0 1 9-3a6 6 0 0 1 10 2a4 4 0 0 1 4 4H84Z" fill="#cfd8e3" />
        </g>
      )}
      {has('Dizziness') && (
        <g fill="#f6c234" stroke="#b8860b" strokeWidth="0.8" strokeLinejoin="round">
          {[0, 1, 2].map((i) => (
            <path key={i} d={STAR} transform={move ? undefined : `translate(${50 + i * 26} ${i === 1 ? -8 : 0}) scale(0.7)`}>
              {move && <animateMotion dur="3.6s" repeatCount="indefinite" begin={`${-i * 1.2}s`} path="M80 -6a30 7 0 1 0 0.1 0" />}
            </path>
          ))}
        </g>
      )}
    </g>
  )
}

/** A thought bubble at Grami's top left with the icons of up to three triggers, and "+N" for more. */
function TriggerThought({ triggers }: { triggers: string[] }) {
  const icons = [...new Set(triggers)].map((t) => presetFor(t)?.icon ?? 'question')
  const shown = icons.slice(0, 3)
  const more = icons.length - shown.length
  const w = shown.length * 15 + (more ? 13 : 0) + 6
  return (
    <g className="boat-float">
      <circle cx="44" cy="20" r="2.2" fill="#ffffff" stroke={INK} strokeWidth="1.4" />
      <circle cx="38" cy="14" r="3.2" fill="#ffffff" stroke={INK} strokeWidth="1.5" />
      <rect x={34 - w} y="-13" width={w} height="21" rx="10.5" fill="#ffffff" stroke={INK} strokeWidth="1.8" />
      {shown.map((icon, i) => (
        <g key={icon} transform={`translate(${37 - w + i * 15} -10.5)`} style={{ color: INK, '--fill': '#ffe3a6' } as CSSProperties}>
          <Glyph name={icon} size={16} />
        </g>
      ))}
      {more > 0 && (
        <text x={27} y="2" textAnchor="middle" fontSize="8.5" fontWeight="700" fill={INK}>
          +{more}
        </text>
      )}
    </g>
  )
}
