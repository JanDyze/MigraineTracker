import { useState } from 'react'
import type { Preset } from '../lib/attacks'
import { Glyph } from './Glyph'

/*
 * The Log page's pickers (after Mighty screen 6): a row of ten little faces for how bad it is,
 * and soft pill chips that show a few choices with "+ More" for the rest and your own.
 */

const MINT = [143, 222, 210]
const PEACH = [246, 196, 176]
const CORAL = [238, 124, 106]
/** Mint for a mild one, through peach, to coral at the worst. */
function faceColour(n: number) {
  const t = (n - 1) / 9
  const [a, b, k] = t < 0.5 ? [MINT, PEACH, t * 2] : [PEACH, CORAL, (t - 0.5) * 2]
  const mix = (i: number) => Math.round(a[i] + (b[i] - a[i]) * k)
  return `rgb(${mix(0)} ${mix(1)} ${mix(2)})`
}

/** One little face: smiling when it's mild, flat in the middle, squeezed eyes and a frown at the worst. */
function Face({ n }: { n: number }) {
  const ink = { fill: 'none', stroke: '#1b3a57', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  const eyes =
    n <= 6 ? (
      <g fill="#1b3a57">
        <circle cx="11.5" cy="14" r="1.6" />
        <circle cx="20.5" cy="14" r="1.6" />
      </g>
    ) : (
      <path d="M9.5 12l3 2-3 2M22.5 12l-3 2 3 2" {...ink} />
    )
  const mouth =
    n <= 3 ? <path d="M12.5 19q3.5 3 7 0" {...ink} /> : n <= 6 ? <path d="M13 20.2h6" {...ink} /> : n <= 8 ? <path d="M12.5 21.5q3.5-3 7 0" {...ink} /> : <path d="M12.5 22q3.5-4.5 7 0z" {...ink} fill="#7a2f3a" />
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <ellipse cx="16" cy="16.5" rx="13" ry="12.5" fill={faceColour(n)} />
      <ellipse cx="16" cy="11" rx="8" ry="4" fill="#ffffff" opacity="0.35" />
      {eyes}
      {mouth}
    </svg>
  )
}

/** How bad is it, 1 to 10: a face for each, the chosen one lifted and ringed. */
export function PainFaces({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="lg-faces" role="radiogroup" aria-label="How bad is it, 1 to 10">
      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} of 10`} className="lg-face" onClick={() => onChange(n)}>
          <Face n={n} />
          <span>{n}</span>
        </button>
      ))}
    </div>
  )
}

type Option = Pick<Preset, 'value' | 'label'> & { icon?: string }

type ChipProps = {
  options: Option[]
  customs?: string[]
  value: string[]
  onChange: (v: string[]) => void
  /** how many to show before "+ More" (chosen ones always show) */
  show?: number
  /** only one can be picked */
  single?: boolean
}

const toggle = (value: string[], v: string) => (value.includes(v) ? value.filter((x) => x !== v) : [...value, v])

/** Soft pill chips: tap to pick; "+ More" shows the rest and lets you type your own. */
export function Chips({ options, customs = [], value, onChange, show = 4, single }: ChipProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const known = options.map((o) => o.value)
  const extra = [...customs, ...value.filter((v) => !known.includes(v) && !customs.includes(v))]
  const all: Option[] = [...options, ...extra.map((v) => ({ value: v, label: v }))]
  const visible = open ? all : all.filter((o, i) => i < show || value.includes(o.value))
  const hidden = all.length - visible.length

  const pick = (v: string) => onChange(single ? (value.includes(v) ? [] : [v]) : toggle(value, v))
  const addOwn = () => {
    const v = draft.trim()
    if (v && !value.includes(v)) onChange(single ? [v] : [...value, v])
    setDraft('')
  }

  return (
    <div className="lg-chips">
      {visible.map((o) => (
        <button key={o.value} type="button" className="lg-chip" aria-pressed={value.includes(o.value)} onClick={() => pick(o.value)}>
          {o.icon && <Glyph name={o.icon} size={18} />}
          {o.label}
        </button>
      ))}
      {!single &&
        (open ? (
          <input
            className="lg-chip lg-chip-input"
            value={draft}
            placeholder="Add your own"
            aria-label="Add your own"
            onChange={(e) => setDraft(e.target.value)}
            onBlur={addOwn}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addOwn()
              }
            }}
          />
        ) : (
          <button type="button" className="lg-chip lg-chip-more" onClick={() => setOpen(true)}>
            <Glyph name="plus" size={16} />
            {hidden > 0 ? 'More' : 'Add'}
          </button>
        ))}
    </div>
  )
}

const DAY = 86_400_000
const MIN = 60_000
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })
const weekdayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short' })
const dateFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' })

const midnight = (d: Date) => {
  const m = new Date(d)
  m.setHours(0, 0, 0, 0)
  return m
}
/** Whole days between two dates' calendar days (0 = same day). */
const daysApart = (a: Date, b: Date) => Math.round((midnight(a).getTime() - midnight(b).getTime()) / DAY)

/** "Today, 11:06 PM", "Yesterday, 3:20 PM", or "Mon 2 Nov, 9:00 AM". */
export function niceWhen(iso: string, now = new Date()) {
  const d = new Date(iso)
  const ago = daysApart(now, d)
  const day = ago === 0 ? 'Today' : ago === 1 ? 'Yesterday' : dateFmt.format(d)
  return `${day}, ${timeFmt.format(d)}`
}

export type Quick = { label: string; iso: string }

type WhenProps = {
  label: string
  value: string
  onChange: (iso: string) => void
  quick: Quick[]
  /** the earliest allowed time (the end can't come before the start) */
  min?: string
}

/**
 * A friendly date and time picker: the moment written out in words, one-tap shortcuts, the last
 * seven days as chips, and the time as a big button (opens the phone's own time wheel) with
 * 15-minute nudges. It never goes into the future, or before `min`.
 */
export function WhenPicker({ label, value, onChange, quick, min }: WhenProps) {
  const now = new Date()
  const d = new Date(value)
  const clamp = (t: number) => {
    const lo = min ? new Date(min).getTime() : -Infinity
    return new Date(Math.max(lo, Math.min(t, now.getTime()))).toISOString()
  }
  const set = (t: number) => onChange(clamp(t))
  const days = Array.from({ length: 7 }, (_, i) => {
    const day = midnight(now)
    day.setDate(day.getDate() - (6 - i))
    return day
  })
  const pickDay = (day: Date) => {
    const t = new Date(day)
    t.setHours(d.getHours(), d.getMinutes(), 0, 0)
    set(t.getTime())
  }
  const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

  return (
    <div className="lg-pick">
      <div className="lg-pick-head">
        <span>{label}</span>
        <b>{niceWhen(value, now)}</b>
      </div>

      <div className="lg-chips lg-quick">
        {quick.map((q) => (
          <button key={q.label} type="button" className="lg-chip" aria-pressed={Math.abs(new Date(q.iso).getTime() - d.getTime()) < MIN} onClick={() => set(new Date(q.iso).getTime())}>
            {q.label}
          </button>
        ))}
      </div>

      <div className="lg-days" role="radiogroup" aria-label={`${label}: day`}>
        {days.map((day) => {
          const ago = daysApart(now, day)
          const off = min ? daysApart(new Date(min), day) > 0 : false
          return (
            <button key={day.getTime()} type="button" role="radio" disabled={off} aria-checked={daysApart(d, day) === 0} className="lg-day" onClick={() => pickDay(day)}>
              <small>{ago === 0 ? 'Today' : ago === 1 ? 'Yest.' : weekdayFmt.format(day)}</small>
              <b>{day.getDate()}</b>
            </button>
          )
        })}
      </div>

      <div className="lg-time-row">
        <button type="button" className="lg-nudge" aria-label="15 minutes earlier" onClick={() => set(d.getTime() - 15 * MIN)}>
          −15
        </button>
        <label className="lg-time">
          <span>{timeFmt.format(d)}</span>
          <input
            type="time"
            value={hhmm}
            aria-label={`${label}: time`}
            onClick={(e) => e.currentTarget.showPicker?.()}
            onChange={(e) => {
              const [h, m] = e.target.value.split(':').map(Number)
              if (Number.isNaN(h)) return
              const t = new Date(d)
              t.setHours(h, m, 0, 0)
              set(t.getTime())
            }}
          />
        </label>
        <button type="button" className="lg-nudge" aria-label="15 minutes later" onClick={() => set(d.getTime() + 15 * MIN)}>
          +15
        </button>
      </div>
    </div>
  )
}
