/*
 * Little sound effects, made on the fly with the Web Audio API: no audio files, so they work offline.
 *   tap  – a water drop when you tap Grami
 *   pop  – a bubble when Grami answers
 *   send – a soft tick when you send a message
 *   save – a two-note chime when a finished entry is saved
 *   calm – a slow rising chime when a migraine is over
 * Migraines often come with sound sensitivity, so every sound is short and quiet, callers stay
 * silent while a migraine is ongoing, and the whole thing can be switched off in Settings.
 */

export type Sound = 'tap' | 'pop' | 'send' | 'save' | 'calm'

const KEY = 'might.sound'

export function getSoundOn(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off'
  } catch {
    return true
  }
}

export function setSoundOn(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off')
  } catch {
    // storage blocked: the choice lasts until reload
  }
}

let ctx: AudioContext | null = null

/** One soft note that glides from `from` to `to` Hz and fades away over `length` seconds. */
function note(c: AudioContext, at: number, from: number, to: number, length: number, volume: number, type: OscillatorType = 'sine') {
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(from, at)
  osc.frequency.exponentialRampToValueAtTime(to, at + length)
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(volume, at + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length)
  osc.connect(gain).connect(c.destination)
  osc.start(at)
  osc.stop(at + length + 0.05)
}

export function play(sound: Sound) {
  if (!getSoundOn()) return
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    const t = ctx.currentTime + 0.01
    switch (sound) {
      case 'tap':
        note(ctx, t, 620, 240, 0.2, 0.09)
        break
      case 'pop':
        note(ctx, t, 360, 820, 0.1, 0.07)
        break
      case 'send':
        note(ctx, t, 1100, 800, 0.06, 0.035, 'triangle')
        break
      case 'save': // G5, then C6
        note(ctx, t, 784, 784, 0.3, 0.05)
        note(ctx, t + 0.1, 1047, 1047, 0.45, 0.05)
        break
      case 'calm': // C5, E5, G5, slowly
        ;[523, 659, 784].forEach((f, i) => note(ctx!, t + i * 0.14, f, f, 0.7, 0.045))
        break
    }
  } catch {
    // no audio available: stay silent
  }
}
