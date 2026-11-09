import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fullName, useAuth } from '../lib/auth'
import { useAttacks } from '../lib/store'
import { RELIEF, levelLabel, type Attack } from '../lib/attacks'
import { applyTheme, getThemePref, type ThemePref } from '../lib/theme'
import { getSoundOn, play, setSoundOn } from '../lib/sound'
import { Glyph } from '../components/Glyph'
import { Wordmark } from '../components/Logo'

const THEMES: { value: ThemePref; label: string }[] = [
  { value: 'system', label: 'Auto' },
  { value: 'light', label: 'Day' },
  { value: 'dark', label: 'Night' },
]

function toCsv(attacks: Attack[]) {
  const header = ['started_at', 'ended_at', 'intensity', 'how_bad', 'locations', 'symptoms', 'triggers', 'medications', 'other_remedies', 'helped', 'notes']
  const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const rows = attacks.map((a) =>
    [
      a.started_at,
      a.ended_at,
      a.intensity,
      levelLabel(a.intensity),
      a.locations.join('; '),
      a.symptoms.join('; '),
      a.triggers.join('; '),
      a.medications.join('; '),
      a.remedies.join('; '),
      a.relief === null ? '' : RELIEF[a.relief].label,
      a.notes,
    ]
      .map(cell)
      .join(','),
  )
  return [header.join(','), ...rows].join('\n')
}

export function SettingsPage() {
  const { session } = useAuth()
  const { attacks } = useAttacks()
  const navigate = useNavigate()
  const [theme, setTheme] = useState<ThemePref>(getThemePref)
  const [sound, setSound] = useState(getSoundOn)
  // what Grami calls you; saved in the account's metadata
  const savedName = fullName(session)
  const [name, setName] = useState(savedName)
  const [savingName, setSavingName] = useState(false)

  async function saveName() {
    setSavingName(true)
    await supabase.auth.updateUser({ data: { full_name: name.trim() } })
    setSavingName(false)
  }

  function chooseTheme(t: ThemePref) {
    setTheme(t)
    applyTheme(t)
  }

  function chooseSound(on: boolean) {
    setSound(on)
    setSoundOn(on)
    if (on) play('pop')
  }

  function exportCsv() {
    const blob = new Blob([toCsv(attacks)], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `might-journal-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  return (
    <div className="page">
      <header className="topbar">
        <button type="button" className="icon-btn" onClick={() => navigate('/')} aria-label="Back">
          <Glyph name="back" size={22} />
        </button>
        <h1 className="hand-title">Settings</h1>
      </header>

      <section className="card stack">
        <h2 className="hand">Look</h2>
        <p className="muted">Night is gentler on the eyes mid-migraine.</p>
        <div className="pills" role="radiogroup" aria-label="Theme">
          {THEMES.map((t) => (
            <button key={t.value} type="button" role="radio" aria-checked={theme === t.value} onClick={() => chooseTheme(t.value)}>
              {t.label}
            </button>
          ))}
        </div>
      </section>

      <section className="card stack">
        <h2 className="hand">Sounds</h2>
        <p className="muted">Soft little sounds for taps and saves. Always silent during a migraine.</p>
        <div className="pills" role="radiogroup" aria-label="Sounds">
          {[true, false].map((on) => (
            <button key={String(on)} type="button" role="radio" aria-checked={sound === on} onClick={() => chooseSound(on)}>
              {on ? 'On' : 'Off'}
            </button>
          ))}
        </div>
      </section>

      <section className="card stack">
        <h2 className="hand">Your journal</h2>
        <p className="muted">Download every page as a spreadsheet, handy for doctor visits.</p>
        <button className="btn btn-soft btn-block" onClick={exportCsv} disabled={!attacks.length}>
          <Glyph name="download" size={18} />
          Export {attacks.length} {attacks.length === 1 ? 'page' : 'pages'}
        </button>
      </section>

      <section className="card stack">
        <h2 className="hand">Account</h2>
        <label className="field">
          Your name
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="name" placeholder="What should Grami call you?" />
        </label>
        {name.trim() !== savedName && (
          <button className="btn btn-block" onClick={saveName} disabled={savingName || !name.trim()}>
            <Glyph name="check" size={18} />
            Save name
          </button>
        )}
        <p className="muted">{session?.user.email}</p>
        <button className="btn btn-soft btn-block" onClick={() => supabase.auth.signOut()}>
          <Glyph name="door" size={18} />
          Sign out
        </button>
      </section>

      <p className="about muted">
        <Wordmark /> = <b>mi</b>graine <b>t</b>racker
      </p>
    </div>
  )
}
