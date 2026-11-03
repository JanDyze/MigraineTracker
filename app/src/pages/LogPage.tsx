import { useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAttacks } from '../lib/store'
import { LOCATIONS, MEDICATIONS, RELIEF, SYMPTOMS, TRIGGERS, customValues, emptyAttack, level, levelLabel, type AttackInput } from '../lib/attacks'
import { fromLocalInput, toLocalInput } from '../lib/format'
import { CheckList, CircleWords, LevelSlider } from '../components/Journal'
import { Boat } from '../components/Boat'
import { Glyph } from '../components/Glyph'
import { useLeave } from '../lib/motion'

const hm = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })

export function LogPage() {
  const { id } = useParams()
  const { attacks, loading } = useAttacks()
  const existing = id ? attacks.find((a) => a.id === id) : undefined

  if (id && loading) return <div className="sheet-page"><div className="sheet muted">Loading…</div></div>
  if (id && !existing) return <div className="sheet-page"><div className="sheet">This page no longer exists.</div></div>

  // key resets the form when switching between entries
  return <LogForm key={id ?? 'new'} id={id} initial={existing ?? emptyAttack()} />
}

const MED_OPTIONS = MEDICATIONS.map((m) => ({ value: m, label: m }))
const RELIEF_OPTIONS = RELIEF.map((r) => ({ value: String(r.value), label: r.label }))

function Part({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="part">
      <h2 className="hand">{title}</h2>
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
  const { leaving, leave } = useLeave()
  const goBack = () => leave(() => ((window.history.state?.idx ?? 0) > 0 ? navigate(-1) : navigate('/', { replace: true })))

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
    if (!id || !confirm('Tear out this page? This can’t be undone.')) return
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
    <div className={`sheet-page${leaving ? ' leaving' : ''}`}>
      <form className="sheet log-sheet" onSubmit={submit}>
        <div className="sheet-handle" />
        <header className="sheet-head">
          <div>
            <h1 className="hand-title">{id ? 'This page' : 'A new page'}</h1>
            <span className="muted">
              Started {hm.format(new Date(form.started_at))}
              {ongoing ? ' · still going' : ''}
            </span>
          </div>
          <button type="button" className="icon-btn" onClick={goBack} aria-label="Close">
            <Glyph name="close" size={20} />
          </button>
        </header>

        <section className="card strength">
          <div className="strength-head">
            <Boat mood={level(form.intensity) >= 3 ? 'hurt' : 'calm'} size={86} water={false} />
            <div>
              <span className="label-soft">How strong?</span>
              <span key={form.intensity} className="strength-word">{levelLabel(form.intensity).toLowerCase()}</span>
            </div>
          </div>
          <LevelSlider value={form.intensity} onChange={(v) => set('intensity', v)} />
        </section>

        <section className="card when">
          <label className="when-row">
            <span>Started</span>
            <input
              type="datetime-local"
              required
              value={toLocalInput(form.started_at)}
              onChange={(e) => e.target.value && set('started_at', fromLocalInput(e.target.value))}
            />
          </label>
          <label className="when-row switch-row">
            <span>Still going</span>
            <input type="checkbox" role="switch" checked={ongoing} onChange={(e) => toggleOngoing(e.target.checked)} />
          </label>
          {!ongoing && form.ended_at && (
            <label className="when-row">
              <span>Ended</span>
              <input
                type="datetime-local"
                required
                value={toLocalInput(form.ended_at)}
                onChange={(e) => e.target.value && set('ended_at', fromLocalInput(e.target.value))}
              />
            </label>
          )}
        </section>

        <Part title="Where?">
          <CircleWords options={LOCATIONS} customs={customs('locations', LOCATIONS)} value={form.locations} onChange={(v) => set('locations', v)} add="other" />
        </Part>

        <Part title="Maybe because…">
          <CheckList options={TRIGGERS} customs={customs('triggers', TRIGGERS)} value={form.triggers} onChange={(v) => set('triggers', v)} add="other" />
        </Part>

        <Part title="How else do you feel?">
          <CheckList options={SYMPTOMS} customs={customs('symptoms', SYMPTOMS)} value={form.symptoms} onChange={(v) => set('symptoms', v)} add="other" />
        </Part>

        <Part title="Took anything?">
          <CircleWords
            marker
            options={MED_OPTIONS}
            customs={customValues('medications', attacks, MEDICATIONS)}
            value={form.medications}
            onChange={(v) => set('medications', v)}
            add="add"
          />
          {form.medications.length > 0 && (
            <div className="relief">
              <span className="label-soft">Did it help?</span>
              <CircleWords
                options={RELIEF_OPTIONS}
                value={form.relief === null ? [] : [String(form.relief)]}
                onChange={(v) => {
                  const picked = v.filter((x) => x !== String(form.relief))
                  set('relief', picked.length ? Number(picked[0]) : null)
                }}
              />
            </div>
          )}
        </Part>

        <Part title="Notes">
          <textarea rows={3} placeholder="anything worth remembering?" value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)} />
        </Part>

        {id && (
          <button type="button" className="btn btn-quiet btn-danger" onClick={onDelete} disabled={busy}>
            <Glyph name="trash" size={18} />
            Tear out this page
          </button>
        )}

        <div className="save-bar">
          {error && <p className="notice">{error}</p>}
          <button className="btn btn-deep btn-block btn-big" disabled={busy}>
            {busy ? 'Saving…' : 'Save this page'}
          </button>
        </div>
      </form>
    </div>
  )
}
