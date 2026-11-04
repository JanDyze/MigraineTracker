import type { Scene } from './scene'

/*
 * Grami's little remarks on Today: a greeting for the time of day, a cheer for a calm streak,
 * comfort during a migraine, and gentle nudges (water, food, screen breaks). Each call picks one
 * at random, never the same one twice in a row.
 */

type Context = { scene: Scene; streak: number | null; ongoing: boolean; recovering: boolean; name: string | null }

const BY_SCENE: Record<Scene, string[]> = {
  morning: ['Good morning! Did you sleep okay?', 'Morning! A glass of water to start?', 'Rise and shine, captain!', 'Fresh start today. I’m on deck.'],
  day: ['Ahoy! How’s your head today?', 'Don’t skip lunch, okay?', 'Screen break? Look at something far away for a bit.', 'A sip of water for both of us?'],
  evening: ['Good evening! Winding down soon?', 'Easy evening. Maybe dim the lights?', 'You made it through the day. Nice sailing.'],
  night: ['Still up? Rest helps the tide stay calm.', 'Time to drop anchor for the night?', 'Sweet dreams soon. I’ll keep watch.'],
  storm: ['I’m right here.', 'Rest somewhere dark if you can.', 'Small sips of water, if you can manage.', 'This will pass. Tell me when it eases.'],
}

const ANYTIME = ['Tap me any time you want to talk.', 'Log it when it hurts, and I’ll look for patterns.', 'Proud of you for keeping track. ♡', 'Remember to breathe out slowly.']

export function gramiLines({ scene, streak, ongoing, recovering, name }: Context): string[] {
  if (ongoing) return name ? [...BY_SCENE.storm, `I’m right here, ${name}.`] : BY_SCENE.storm
  const lines = [...BY_SCENE[scene], ...ANYTIME]
  if (name) lines.push(`Ahoy, ${name}!`, `Hi ${name}! How’s your head today?`, `Glad you’re aboard, ${name}. ♡`)
  if (recovering) lines.push('Glad that one’s over. Go gently today.', 'Calm water again. Take it slow.')
  if (streak !== null && streak >= 3) lines.push(`${streak} calm days! Smooth sailing.`, `${streak} days without one. Look at us go!`)
  else if (streak === 1) lines.push('One calm day. Let’s make it two!')
  return lines
}

/** A random line from the list, avoiding the one just said. */
export function pickLine(lines: string[], last: string | null): string {
  const options = lines.length > 1 ? lines.filter((l) => l !== last) : lines
  return options[Math.floor(Math.random() * options.length)]
}
