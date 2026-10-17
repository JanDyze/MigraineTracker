import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { level, levelLabel, labelFor, type Attack } from '../lib/attacks'
import { attackDuration, formatDuration } from '../lib/format'
import { Glyph } from './Glyph'

/** Five rising bars, filled up to the level — a tiny signal meter. */
export function LevelBars({ intensity, size = 'sm' }: { intensity: number; size?: 'sm' | 'lg' }) {
  const lvl = level(intensity)
  return (
    <span className={`levelbars levelbars-${size}`} role="img" aria-label={`${levelLabel(intensity)} (${lvl} of 5)`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= lvl ? 'on' : ''} style={{ height: `${20 + i * 16}%` }} />
      ))}
    </span>
  )
}

/** Boxed instrument readout: tiny mono label over a big mono value. */
export function Readout({ label, value, unit }: { label: string; value: ReactNode; unit?: string }) {
  return (
    <div className="readout">
      <span className="readout-label">{label}</span>
      <span className="readout-value">
        {value}
        {unit && <small>{unit}</small>}
      </span>
    </div>
  )
}

/** Figure caption, lab-notebook style: "FIG. 1 — LAST 30 DAYS". */
export function Fig({ n, children }: { n?: number; children: ReactNode }) {
  return (
    <p className="fig">
      {n !== undefined && <b>Fig. {n}</b>}
      {n !== undefined && ' — '}
      {children}
    </p>
  )
}

const dayMonth = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' })
const weekday = new Intl.DateTimeFormat(undefined, { weekday: 'short' })
const clock = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })

/** One entry as a log line: timestamp, level meter, duration, then what was noted. */
export function EntryRow({ attack }: { attack: Attack }) {
  const notes = [...attack.triggers, ...attack.symptoms].map(labelFor)
  return (
    <Link to={`/log/${attack.id}`} className="entry">
      <span className="entry-when">
        {dayMonth.format(new Date(attack.started_at))}
        <small>
          {weekday.format(new Date(attack.started_at))} {clock.format(new Date(attack.started_at))}
        </small>
      </span>
      <span className="entry-main">
        <span className="entry-level">
          <LevelBars intensity={attack.intensity} />
          {levelLabel(attack.intensity)}
          <span className="entry-dur">
            {attack.ended_at ? formatDuration(attackDuration(attack.started_at, attack.ended_at)) : <b>ongoing</b>}
          </span>
        </span>
        {(notes.length > 0 || attack.medications.length > 0) && (
          <span className="entry-notes">
            {notes.join(', ')}
            {attack.medications.length > 0 && (
              <>
                {notes.length > 0 && ' · '}
                <Glyph name="pill" size={14} /> {attack.medications.join(', ')}
              </>
            )}
          </span>
        )}
      </span>
      <Glyph name="right" size={18} className="entry-go" />
    </Link>
  )
}
