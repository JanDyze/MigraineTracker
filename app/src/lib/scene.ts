/*
 * Today's sky. It follows the time of day (a lavender morning, a bright day, a pink sunset, a
 * moonlit night), stays night when the app is set to dark, and turns to a soft, dim rain during a
 * migraine. Add ?time=morning|day|evening|night|storm to the address to try one.
 */

export type Scene = 'morning' | 'day' | 'evening' | 'night' | 'storm'
const SCENES: Scene[] = ['morning', 'day', 'evening', 'night', 'storm']

/** Scenes dark enough to need light text and a dark tab bar. */
export const isDarkScene = (s: Scene) => s === 'evening' || s === 'night' || s === 'storm'

export function sceneFor(now: Date, ongoing: boolean, darkTheme: boolean): Scene {
  try {
    const asked = new URLSearchParams(window.location.search).get('time')
    if (asked && (SCENES as string[]).includes(asked)) return asked as Scene
  } catch {
    // no address to read: fall through to the real sky
  }
  if (ongoing) return 'storm'
  if (darkTheme) return 'night'
  const h = now.getHours()
  return h >= 5 && h < 10 ? 'morning' : h >= 10 && h < 17 ? 'day' : h >= 17 && h < 20 ? 'evening' : 'night'
}

/** The greeting for this time of day (or for the sky picked with ?time=, so tests read right). */
export function greeting(now: Date, scene: Scene): string {
  const asked = new URLSearchParams(window.location.search).get('time')
  if (asked === 'morning') return 'Good morning!'
  if (asked === 'day') return 'Good afternoon!'
  if (asked === 'evening' || (asked === 'night' && scene === 'night')) return 'Good evening!'
  const h = now.getHours()
  return h < 5 ? 'Still up?' : h < 12 ? 'Good morning!' : h < 17 ? 'Good afternoon!' : 'Good evening!'
}
