export type Attack = {
  id: string
  started_at: string
  ended_at: string | null
  intensity: number
  locations: string[]
  symptoms: string[]
  triggers: string[]
  medications: string[]
  relief: number | null
  notes: string | null
}

export type AttackInput = Omit<Attack, 'id'>

export type TagField = 'locations' | 'symptoms' | 'triggers' | 'medications'

/** A preset tag: `value` is what's stored, `label` is the short sticker text, `icon` names a glyph. */
export type Preset = { value: string; label: string; icon: string }

export const TRIGGERS: Preset[] = [
  { value: 'Stress', label: 'Stress', icon: 'stress' },
  { value: 'Poor sleep', label: 'Bad sleep', icon: 'sleep' },
  { value: 'Skipped meal', label: 'Skipped meal', icon: 'meal' },
  { value: 'Dehydration', label: 'Thirsty', icon: 'drop' },
  { value: 'Screen time', label: 'Screens', icon: 'screen' },
  { value: 'Bright light', label: 'Bright light', icon: 'bulb' },
  { value: 'Weather change', label: 'Weather', icon: 'weather' },
  { value: 'Caffeine', label: 'Caffeine', icon: 'coffee' },
  { value: 'Alcohol', label: 'Alcohol', icon: 'wine' },
  { value: 'Hormonal', label: 'Hormones', icon: 'cycle' },
  { value: 'Strong smell', label: 'Smells', icon: 'smell' },
  { value: 'Loud noise', label: 'Noise', icon: 'noise' },
]

export const SYMPTOMS: Preset[] = [
  { value: 'Nausea', label: 'Queasy', icon: 'queasy' },
  { value: 'Vomiting', label: 'Threw up', icon: 'vomit' },
  { value: 'Light sensitivity', label: 'Light hurts', icon: 'eye' },
  { value: 'Sound sensitivity', label: 'Sound hurts', icon: 'ear' },
  { value: 'Smell sensitivity', label: 'Smells hurt', icon: 'smell' },
  { value: 'Aura', label: 'Aura', icon: 'aura' },
  { value: 'Dizziness', label: 'Dizzy', icon: 'dizzy' },
  { value: 'Fatigue', label: 'Wiped out', icon: 'battery' },
  { value: 'Brain fog', label: 'Foggy', icon: 'fog' },
]

/** Where it hurts. Each icon is a tiny head with that area highlighted. */
export const LOCATIONS: Preset[] = [
  { value: 'Forehead', label: 'Forehead', icon: 'z-forehead' },
  { value: 'Behind eyes', label: 'Behind eyes', icon: 'z-eyes' },
  { value: 'Temples', label: 'Temples', icon: 'z-temples' },
  { value: 'Left side', label: 'Left side', icon: 'z-left' },
  { value: 'Right side', label: 'Right side', icon: 'z-right' },
  { value: 'All over', label: 'All over', icon: 'z-all' },
  { value: 'Back of head', label: 'Back', icon: 'z-back' },
  { value: 'Neck', label: 'Neck', icon: 'z-neck' },
]

export const MEDICATIONS = ['Ibuprofen', 'Paracetamol', 'Naproxen', 'Aspirin', 'Sumatriptan', 'Rizatriptan']

const ALL_PRESETS = [...TRIGGERS, ...SYMPTOMS, ...LOCATIONS]

export function presetFor(value: string): Preset | undefined {
  return ALL_PRESETS.find((p) => p.value === value)
}

export const labelFor = (value: string) => presetFor(value)?.label ?? value

export const RELIEF = [
  { value: 0, label: 'Nope' },
  { value: 1, label: 'A bit' },
  { value: 2, label: 'Mostly' },
  { value: 3, label: 'Gone!' },
] as const

/**
 * Five levels instead of 1–10 (drawn as swell height on the wave). Stored as even intensities so
 * the old 1–10 scale keeps working; any stored value maps to its nearest level with `level()`.
 */
export const LEVELS = [
  { level: 1, intensity: 2, label: 'Mild' },
  { level: 2, intensity: 4, label: 'Ouch' },
  { level: 3, intensity: 6, label: 'Bad' },
  { level: 4, intensity: 8, label: 'Awful' },
  { level: 5, intensity: 10, label: 'Worst' },
] as const

export type Level = 1 | 2 | 3 | 4 | 5

export function level(intensity: number): Level {
  return Math.min(5, Math.max(1, Math.ceil(intensity / 2))) as Level
}

export const levelLabel = (intensity: number) => LEVELS[level(intensity) - 1].label

/** Custom values the user has typed before, most used first (presets excluded). */
export function customValues(field: TagField, attacks: Attack[], presets: string[]): string[] {
  const counts = new Map<string, number>()
  for (const a of attacks) for (const t of a[field]) if (!presets.includes(t)) counts.set(t, (counts.get(t) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t)
}

export function emptyAttack(): AttackInput {
  return {
    started_at: new Date().toISOString(),
    ended_at: null,
    intensity: 6,
    locations: [],
    symptoms: [],
    triggers: [],
    medications: [],
    relief: null,
    notes: null,
  }
}
