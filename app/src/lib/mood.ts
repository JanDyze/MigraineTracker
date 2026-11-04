import { level } from './attacks'

/**
 * Grami's moods, from the sticker sheet. The four headache moods follow how bad a migraine is;
 * the rest are for calm days, the end of a migraine, and chatting.
 */
export type BoatMood = 'happy' | 'calm' | 'tired' | 'mild' | 'moderate' | 'severe' | 'attack' | 'recovering' | 'thinking' | 'talk'

/** Grami's face for a migraine of this intensity (1–10). */
export function moodFor(intensity: number): BoatMood {
  const l = level(intensity)
  return l <= 2 ? 'mild' : l === 3 ? 'moderate' : l === 4 ? 'severe' : 'attack'
}
