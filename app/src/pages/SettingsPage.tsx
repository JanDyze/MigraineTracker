import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useAttacks } from '../lib/store'
import { RELIEF, levelLabel, type Attack } from '../lib/attacks'
import { applyTheme, getThemePref, type ThemePref } from '../lib/theme'
import { Glyph } from '../components/Glyph'
import { Wordmark } from '../components/Logo'

const THEMES: { value: ThemePref; label: string; icon: string }[] = [
  { value: 'system', label: 'Auto', icon: 'auto' },
  { value: 'light', label: 'Paper', icon: 'sun' },
  { value: 'dark', label: 'Night', icon: 'moon' },
]

function toCsv(attacks: Attack[]) {
  const header = ['started_at', 'ended_at', 'intensity', 'how_bad', 'locations', 'symptoms', 'triggers', 'medications', 'helped', 'notes']
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

  function chooseTheme(t: ThemePref) {
    setTheme(t)
    applyTheme(t)
  }

  function exportCsv() {
    const blob = new Blob([toCsv(attacks)], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `might-migraines-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  return (
    <div className="page">
      <header className="topbar">
        <button type="button" className="icon-btn" onClick={() => navigate('/')} aria-label="Back">
          <Glyph name="back" size={22} />
        </button>
        <h1 className="title">Settings</h1>
      </header>

      <section className="settings-group">
        <h2 className="label">Look</h2>
        <p className="muted">Night mode is easier on the eyes mid-migraine.</p>
        <div className="segmented" role="radiogroup" aria-label="Theme">
          {THEMES.map((t) => (
            <button key={t.value} type="button" role="radio" aria-checked={theme === t.value} onClick={() => chooseTheme(t.value)}>
              {t.label}
            </button>
          ))}
        </div>
      </section>

      <section className="settings-group">
        <h2 className="label">Your record</h2>
        <p className="muted">Download everything as a spreadsheet, handy for doctor visits.</p>
        <button className="btn btn-block" onClick={exportCsv} disabled={!attacks.length}>
          <Glyph name="download" size={18} />
          Export {attacks.length} {attacks.length === 1 ? 'entry' : 'entries'}
        </button>
      </section>

      <section className="settings-group">
        <h2 className="label">Account</h2>
        <p className="muted">{session?.user.email}</p>
        <button className="btn btn-block" onClick={() => supabase.auth.signOut()}>
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
