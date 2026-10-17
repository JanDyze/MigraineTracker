import { useState } from 'react'
import { LEVELS, level, type Preset } from '../lib/attacks'
import { Glyph } from './Glyph'

/** Five rising bars — tap the height that matches the pain. Stores 2, 4, 6, 8 or 10. */
export function LevelPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const current = level(value)
  return (
    <div className="levelpick">
      <p className="levelpick-word" aria-live="polite">
        {LEVELS[current - 1].label}
      </p>
      <div className="levelpick-bars" role="radiogroup" aria-label="How bad is it?">
        {LEVELS.map((l) => (
          <button
            key={l.level}
            type="button"
            role="radio"
            aria-checked={current === l.level}
            aria-label={l.label}
            className={`levelpick-btn${l.level <= current ? ' is-on' : ''}`}
            onClick={() => onChange(l.intensity)}
          >
            <span className="levelpick-bar" style={{ height: `${l.level * 20}%` }} />
            <span className="levelpick-num">{l.level}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

type TagProps = {
  presets: Preset[]
  customs: string[]
  value: string[]
  onChange: (v: string[]) => void
  addLabel: string
  icon?: string // for custom values
}

/** Annotation chips you tap on and off, plus "add your own". */
export function TagPicker({ presets, customs, value, onChange, addLabel, icon = 'question' }: TagProps) {
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')

  const known = presets.map((p) => p.value)
  const extra = [...customs, ...value.filter((v) => !known.includes(v) && !customs.includes(v))]
  const items: Preset[] = [...presets, ...extra.map((v) => ({ value: v, label: v, icon }))]

  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v])
  const commit = () => {
    const text = draft.trim()
    if (text && !value.includes(text)) onChange([...value, text])
    setDraft('')
    setAdding(false)
  }

  return (
    <div className="chips">
      {items.map((p) => (
        <button key={p.value} type="button" className="chip" aria-pressed={value.includes(p.value)} onClick={() => toggle(p.value)}>
          <Glyph name={p.icon} size={22} />
          {p.label}
        </button>
      ))}
      {adding ? (
        <input
          className="chip chip-input"
          autoFocus
          value={draft}
          placeholder="Type, then Enter"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commit()
            }
            if (e.key === 'Escape') setAdding(false)
          }}
        />
      ) : (
        <button type="button" className="chip chip-add" onClick={() => setAdding(true)}>
          <Glyph name="plus" size={18} />
          {addLabel}
        </button>
      )}
    </div>
  )
}
