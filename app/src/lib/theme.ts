export type ThemePref = 'system' | 'light' | 'dark'

const KEY = 'might.theme'

export function getThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'light' || v === 'dark') return v
  } catch {
    // storage blocked: fall back to system
  }
  return 'system'
}

export function applyTheme(pref: ThemePref) {
  const root = document.documentElement
  if (pref === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', pref)
  try {
    localStorage.setItem(KEY, pref)
  } catch {
    // ignore
  }
}
