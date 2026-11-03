import { useState } from 'react'

/** True when the user asked their device for less motion. */
export const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * For sheets (log, chat): `leave(fn)` plays the slide-down exit, then runs `fn` (usually navigating
 * back). With reduced motion it runs immediately.
 */
export function useLeave(duration = 220) {
  const [leaving, setLeaving] = useState(false)
  const leave = (fn: () => void) => {
    if (reducedMotion()) return fn()
    setLeaving(true)
    setTimeout(fn, duration)
  }
  return { leaving, leave }
}
