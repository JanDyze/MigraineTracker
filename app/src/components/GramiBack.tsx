/*
 * Grami from behind, sailing away: the back of his round head with the little fin on top, his
 * scarf, two paws on the rim, the flag fluttering, and the stern of the paper boat. Drawn flat and
 * simple: on the welcome screen it's shown as a backlit silhouette (the filter keeps these shapes
 * just visible as darker and lighter navy).
 */

const INK = '#2b4766'
const line = { stroke: INK, strokeWidth: 2.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
const FLAG_A = 'M79 -2C85 -5 91 1 99 -2L95 4L99 10C91 13 85 6 79 9Z'
const FLAG_B = 'M79 -2C85 1 92 -6 99 -0.5L95.5 5L99 11C92 7 85 13 79 9Z'

export function GramiBack({ size = 84, still = false }: { size?: number; still?: boolean }) {
  return (
    <svg width={size} height={(size * 100) / 120} viewBox="0 -8 120 100" aria-hidden="true" className="boat boat-back">
      <g className="boat-body">
        {/* far side of the boat, peeking past his head */}
        <path d="M10 50Q60 38 110 50" fill="none" {...line} strokeWidth={2} opacity="0.6" />

        {/* flag on a short pole, waving */}
        <path d="M74 26L80 -3" fill="none" {...line} />
        <path d={FLAG_A} fill="#3fb2c6" {...line} strokeWidth={2}>
          {!still && <animate attributeName="d" dur="1.8s" repeatCount="indefinite" values={`${FLAG_A};${FLAG_B};${FLAG_A}`} calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1" />}
        </path>

        {/* the fin, seen edge-on from behind, and the back of his round head */}
        <path d="M56.5 22C56.5 14 57.8 8 60 3.5C62.2 8 63.5 14 63.5 22Z" fill="#ffffff" {...line} strokeWidth={2.2} />
        <path d="M31 66C27 42 42 18 60 18C78 18 93 42 89 66Z" fill="#ffffff" {...line} />
        <path d="M44 30Q51 23 58 22" fill="none" stroke="#dbe7f1" strokeWidth="3" strokeLinecap="round" />

        {/* his scarf, tied at the back */}
        <path d="M30 56Q60 64 90 56L90 63Q60 71 30 63Z" fill="#5ccbdc" {...line} strokeWidth={2} />
        <path d="M58 64l-5 9 6-2M62 64l5 9-6-2" fill="#5ccbdc" {...line} strokeWidth={1.8} />

        {/* the stern of the paper boat: both ends point up, a fold down the middle */}
        <path d="M6 48L30 60Q60 68 90 60L114 48L98 84Q60 90 22 84Z" fill="#ffffff" {...line} />
        <path d="M60 66V88M30 60L22 84M90 60L98 84" fill="none" stroke={INK} strokeWidth="1.3" strokeLinecap="round" opacity="0.35" />

        {/* paws holding the rim */}
        <ellipse cx="37" cy="61" rx="6" ry="4.6" fill="#ffffff" {...line} strokeWidth={2.2} />
        <ellipse cx="83" cy="61" rx="6" ry="4.6" fill="#ffffff" {...line} strokeWidth={2.2} />
      </g>
    </svg>
  )
}
