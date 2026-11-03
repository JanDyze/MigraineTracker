import { useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { LEVELS, labelFor, level, levelLabel, type Attack, type Preset } from '../lib/attacks'
import { attackDuration, formatDuration } from '../lib/format'
import { Glyph } from './Glyph'

/* Tide-journal building blocks: diary lines, tiles, and the handwritten-style pickers. */

const weekday = new Intl.DateTimeFormat(undefined, { weekday: 'short' })
/** "Mon 26", whatever order the locale would put them in. */
const dayStamp = { format: (d: Date) => `${weekday.format(d)} ${d.getDate()}` }

/** One migraine as a diary line: "Fri 23 · awful, 6 h · bad sleep, screens". */
export function DiaryLine({ attack }: { attack: Attack }) {
  const notes = [...attack.triggers, ...attack.symptoms].map((v) => labelFor(v).toLowerCase())
  const len = attack.ended_at ? formatDuration(attackDuration(attack.started_at, attack.ended_at)) : null
  return (
    <Link to={`/log/${attack.id}`} className="diary-line">
      <span className="diary-date">{dayStamp.format(new Date(attack.started_at))}</span>
      <span className={`dot lvl-${level(attack.intensity)}`} aria-hidden="true" />
      <span className="diary-text">
        <b>{levelLabel(attack.intensity)}</b>
        {len ? `, ${len}` : <em> · still going</em>}
        {notes.length > 0 && <span className="muted"> · {notes.slice(0, 3).join(', ')}</span>}
      </span>
      <Glyph name="right" size={18} className="diary-go" />
    </Link>
  )
}

/** Sand tile with a handwritten number. */
export function Tile({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="tile">
      <span className="tile-value">{value}</span>
      <span className="tile-label">{label}</span>
    </div>
  )
}

/** Wave-shaped strength slider: the swell grows as the pain does. Stores 2, 4, 6, 8 or 10. */
export function LevelSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const lvl = level(value)
  const amp = 6 + lvl * 7
  return (
    <div className="level">
      <svg viewBox="0 0 314 52" className="level-wave" aria-hidden="true">
        <path d={`M0,44 C40,44 60,44 90,${44 - amp * 0.2} C120,${44 - amp * 0.6} 135,${44 - amp} 157,${44 - amp} C179,${44 - amp} 194,${44 - amp * 0.6} 224,${44 - amp * 0.2} C254,44 274,44 314,44 L314,52 L0,52 Z`} className="level-fill" />
        <path d={`M0,44 C40,44 60,44 90,${44 - amp * 0.2} C120,${44 - amp * 0.6} 135,${44 - amp} 157,${44 - amp} C179,${44 - amp} 194,${44 - amp * 0.6} 224,${44 - amp * 0.2} C254,44 274,44 314,44`} className="level-line" />
      </svg>
      <input
        type="range"
        min={1}
        max={5}
        step={1}
        value={lvl}
        aria-label="How strong, 1 to 5"
        aria-valuetext={LEVELS[lvl - 1].label}
        onChange={(e) => onChange(Number(e.target.value) * 2)}
        style={{ '--pct': `${((lvl - 1) / 4) * 100}%` } as CSSProperties}
      />
      <div className="level-words">
        {LEVELS.map((l) => (
          <button key={l.level} type="button" aria-pressed={lvl === l.level} onClick={() => onChange(l.intensity)}>
            {l.label.toLowerCase()}
          </button>
        ))}
      </div>
    </div>
  )
}

type Option = Pick<Preset, 'value' | 'label'>

type PickProps = {
  options: Option[]
  customs?: string[]
  value: string[]
  onChange: (v: string[]) => void
  add?: string // label for "+ add your own"
}

function useItems({ options, customs = [], value }: PickProps) {
  const known = options.map((o) => o.value)
  const extra = [...customs, ...value.filter((v) => !known.includes(v) && !customs.includes(v))]
  return [...options, ...extra.map((v) => ({ value: v, label: v }))]
}

function AddOwn({ label, onAdd }: { label: string; onAdd: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const commit = () => {
    if (draft.trim()) onAdd(draft.trim())
    setDraft('')
    setOpen(false)
  }
  return open ? (
    <input
      className="add-input"
      autoFocus
      value={draft}
      placeholder="type, then Enter"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          commit()
        }
        if (e.key === 'Escape') setOpen(false)
      }}
    />
  ) : (
    <button type="button" className="add-own" onClick={() => setOpen(true)}>
      + {label}
    </button>
  )
}

const toggle = (value: string[], v: string) => (value.includes(v) ? value.filter((x) => x !== v) : [...value, v])

/** Words you circle, like a pen on paper. `marker` uses a highlighter swipe instead. */
export function CircleWords(props: PickProps & { marker?: boolean }) {
  const items = useItems(props)
  return (
    <div className={`words${props.marker ? ' words-marker' : ''}`}>
      {items.map((o, i) => (
        <button
          key={o.value}
          type="button"
          className={`word tilt-${i % 3}`}
          aria-pressed={props.value.includes(o.value)}
          onClick={() => props.onChange(toggle(props.value, o.value))}
        >
          {o.label.toLowerCase()}
        </button>
      ))}
      {props.add && <AddOwn label={props.add} onAdd={(v) => !props.value.includes(v) && props.onChange([...props.value, v])} />}
    </div>
  )
}

/** Hand-drawn checkboxes in two columns. */
export function CheckList(props: PickProps) {
  const items = useItems(props)
  return (
    <div className="checks">
      {items.map((o) => {
        const on = props.value.includes(o.value)
        return (
          <button key={o.value} type="button" className="check" aria-pressed={on} onClick={() => props.onChange(toggle(props.value, o.value))}>
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4.5 4.2l15.2.6-.4 15.1-15.3-.4z" className="check-box" />
              {on && <path d="M7 12.5l3.5 3.5L20 5" className="check-tick" pathLength={1} />}
            </svg>
            {o.label.toLowerCase()}
          </button>
        )
      })}
      {props.add && <AddOwn label={props.add} onAdd={(v) => !props.value.includes(v) && props.onChange([...props.value, v])} />}
    </div>
  )
}
