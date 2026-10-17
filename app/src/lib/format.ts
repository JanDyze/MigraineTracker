const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })
const monthFmt = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' })

export const formatDay = (iso: string) => dayFmt.format(new Date(iso))
export const formatTime = (iso: string) => timeFmt.format(new Date(iso))
export const formatMonth = (d: Date) => monthFmt.format(d)

export function formatDuration(ms: number): string {
  const mins = Math.max(0, Math.round(ms / 60000))
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h < 24) return m ? `${h}h ${m}m` : `${h}h`
  const d = Math.floor(h / 24)
  return h % 24 ? `${d}d ${h % 24}h` : `${d}d`
}

export function attackDuration(started: string, ended: string | null, now = Date.now()): number {
  return (ended ? new Date(ended).getTime() : now) - new Date(started).getTime()
}

/** ISO string -> value for <input type="datetime-local"> in the device's timezone. */
export function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export const fromLocalInput = (value: string) => new Date(value).toISOString()

/** Local calendar-day key, e.g. "2026-10-17". */
export function dayKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Every local day an attack touches, so a 2-day attack counts on both days. */
export function daysTouched(started: string, ended: string | null): string[] {
  const end = ended ? new Date(ended) : new Date()
  const cur = new Date(started)
  cur.setHours(0, 0, 0, 0)
  const keys: string[] = []
  while (cur <= end && keys.length < 31) {
    keys.push(dayKey(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return keys
}
