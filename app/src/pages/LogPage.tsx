import { useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAttacks } from '../lib/store'
import { LOCATIONS, MEDICATIONS, RELIEF, SYMPTOMS, TRIGGERS, customValues, emptyAttack, type AttackInput } from '../lib/attacks'
import { fromLocalInput, toLocalInput } from '../lib/format'
import { LevelPicker, TagPicker } from '../components/Pickers'
import { Glyph } from '../components/Glyph'

export function LogPage() {
  const { id } = useParams()
  const { attacks, loading } = useAttacks()
  const existing = id ? attacks.find((a) => a.id === id) : undefined

  if (id && loading) return <div className="page log-page muted">Loading…</div>
  if (id && !existing) return <div className="page log-page">This entry no longer exists.</div>

  // key resets the form when switching between entries
  return <LogForm key={id ?? 'new'} id={id} initial={existing ?? emptyAttack()} />
}

const MED_PRESETS = MEDICATIONS.map((m) => ({ value: m, label: m, icon: 'pill' }))

/** A numbered section of the entry sheet: "01 — How bad". */
function Step({ n, title, optional, children }: { n: number; title: string; optional?: boolean; children: ReactNode }) {
  return (
    <section className="step">
      <h2 className="step-head">
        <span className="step-n">{String(n).padStart(2, '0')}</span>
        {title}
        {optional && <span className="step-opt">optional</span>}
      </h2>
      {children}
    </section>
  )
}

function LogForm({ id, initial }: { id?: string; initial: AttackInput }) {
  const { attacks, save, remove } = useAttacks()
  const navigate = useNavigate()
  const [form, setForm] = useState<AttackInput>(initial)
  const [ongoing, setOngoing] = useState(initial.ended_at === null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Go back if we came from inside the app, otherwise home (e.g. /log opened directly).
  const goBack = () => ((window.history.state?.idx ?? 0) > 0 ? navigate(-1) : navigate('/', { replace: true }))

  const set = <K extends keyof AttackInput>(key: K, value: AttackInput[K]) => setForm((f) => ({ ...f, [key]: value }))

  function toggleOngoing(next: boolean) {
    setOngoing(next)
    set('ended_at', next ? null : new Date().toISOString())
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (form.ended_at && form.ended_at < form.started_at) {
      setError('It can’t end before it started.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await save({ ...form, notes: form.notes?.trim() || null }, id)
      goBack()
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  async function onDelete() {
    if (!id || !confirm('Delete this entry? This can’t be undone.')) return
    setBusy(true)
    try {
      await remove(id)
      navigate('/diary', { replace: true })
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  const customs = (field: 'locations' | 'symptoms' | 'triggers', presets: { value: string }[]) =>
    customValues(field, attacks, presets.map((p) => p.value))

  return (
    <form className="page log-page" onSubmit={submit}>
      <header className="topbar">
        <button type="button" className="icon-btn" onClick={goBack} aria-label="Back">
          <Glyph name="back" size={22} />
        </button>
        <h1 className="title">{id ? 'Edit entry' : 'New entry'}</h1>
      </header>

      <Step n={1} title="How bad">
        <LevelPicker value={form.intensity} onChange={(v) => set('intensity', v)} />
      </Step>

      <Step n={2} title="When">
        <div className="when">
          <label className="when-row">
            <span className="label">Started</span>
            <input
              type="datetime-local"
              required
              value={toLocalInput(form.started_at)}
              onChange={(e) => e.target.value && set('started_at', fromLocalInput(e.target.value))}
            />
          </label>
          <label className="when-row switch-row">
            <span className="label">Still going</span>
            <input type="checkbox" role="switch" checked={ongoing} onChange={(e) => toggleOngoing(e.target.checked)} />
          </label>
          {!ongoing && form.ended_at && (
            <label className="when-row">
              <span className="label">Ended</span>
              <input
                type="datetime-local"
                required
                value={toLocalInput(form.ended_at)}
                onChange={(e) => e.target.value && set('ended_at', fromLocalInput(e.target.value))}
              />
            </label>
          )}
        </div>
      </Step>

      <Step n={3} title="Where" optional>
        <TagPicker presets={LOCATIONS} customs={customs('locations', LOCATIONS)} value={form.locations} onChange={(v) => set('locations', v)} addLabel="Other" icon="head" />
      </Step>

      <Step n={4} title="Possible triggers" optional>
        <TagPicker presets={TRIGGERS} customs={customs('triggers', TRIGGERS)} value={form.triggers} onChange={(v) => set('triggers', v)} addLabel="Other" />
      </Step>

      <Step n={5} title="Symptoms" optional>
        <TagPicker presets={SYMPTOMS} customs={customs('symptoms', SYMPTOMS)} value={form.symptoms} onChange={(v) => set('symptoms', v)} addLabel="Other" />
      </Step>

      <Step n={6} title="Medication" optional>
        <TagPicker
          presets={MED_PRESETS}
          customs={customValues('medications', attacks, MEDICATIONS)}
          value={form.medications}
          onChange={(v) => set('medications', v)}
          addLabel="Add"
          icon="pill"
        />
        {form.medications.length > 0 && (
          <div className="relief">
            <span className="label">Did it help?</span>
            <div className="segmented" role="radiogroup" aria-label="Did it help?">
              {RELIEF.map((r) => (
                <button key={r.value} type="button" role="radio" aria-checked={form.relief === r.value} onClick={() => set('relief', form.relief === r.value ? null : r.value)}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </Step>

      <Step n={7} title="Notes" optional>
        <textarea rows={3} placeholder="Anything worth remembering?" value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)} />
      </Step>

      {id && (
        <button type="button" className="btn btn-quiet btn-danger" onClick={onDelete} disabled={busy}>
          <Glyph name="trash" size={18} />
          Delete entry
        </button>
      )}

      <div className="save-bar">
        {error && <p className="notice">{error}</p>}
        <button className="btn btn-ink btn-block" disabled={busy}>
          {busy ? 'Saving…' : 'Save entry'}
        </button>
      </div>
    </form>
  )
}
