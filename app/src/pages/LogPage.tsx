import { useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAttacks } from '../lib/store'
import { LOCATIONS, MEDICATIONS, RELIEF, SYMPTOMS, TRIGGERS, customValues, emptyAttack, levelLabel, type AttackInput } from '../lib/attacks'
import { attackDuration, formatDuration } from '../lib/format'
import { Chips, PainFaces, WhenPicker, niceWhen } from '../components/LogPickers'
import { QuietSea } from '../components/Sky'
import { Boat } from '../components/Boat'
import { Glyph } from '../components/Glyph'
import { useLeave } from '../lib/motion'
import { play } from '../lib/sound'
import { moodFor } from '../lib/mood'

const HOUR = 3_600_000
/** Today at the given hour (for "This morning"). */
const atToday = (h: number) => {
  const d = new Date()
  d.setHours(h, 0, 0, 0)
  return d.toISOString()
}

export function LogPage() {
  const { id } = useParams()
  const { attacks, loading } = useAttacks()
  const existing = id ? attacks.find((a) => a.id === id) : undefined

  if (id && loading) return <div className="lg"><p className="lg-empty">Loading…</p></div>
  if (id && !existing) return <div className="lg"><p className="lg-empty">This migraine is no longer in your journal.</p></div>

  // key resets the form when switching between entries
  return <LogForm key={id ?? 'new'} id={id} initial={existing ?? emptyAttack()} />
}

const MED_OPTIONS = MEDICATIONS.map((m) => ({ value: m, label: m }))
const RELIEF_OPTIONS = RELIEF.map((r) => ({ value: String(r.value), label: r.label }))

function LogForm({ id, initial }: { id?: string; initial: AttackInput }) {
  const { attacks, save, remove } = useAttacks()
  const navigate = useNavigate()
  const [form, setForm] = useState<AttackInput>(initial)
  const [ongoing, setOngoing] = useState(initial.ended_at === null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // one question per screen, like a story; the progress bars on top jump between them
  const [step, setStep] = useState(0)

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
      // a migraine that's still going gets saved in silence
      if (form.ended_at) play('save')
      goBack()
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  async function onDelete() {
    if (!id || !confirm('Delete this migraine? This can’t be undone.')) return
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

  const steps: { title: string; body: ReactNode }[] = [
    { title: id ? 'How bad was it?' : 'How’s your headache?', body: <PainFaces value={form.intensity} onChange={(v) => set('intensity', v)} /> },
    {
      title: 'Where does it hurt?',
      body: <Chips show={8} options={LOCATIONS} customs={customs('locations', LOCATIONS)} value={form.locations} onChange={(v) => set('locations', v)} />,
    },
    {
      title: 'Any symptoms?',
      body: <Chips show={9} options={SYMPTOMS} customs={customs('symptoms', SYMPTOMS)} value={form.symptoms} onChange={(v) => set('symptoms', v)} />,
    },
    {
      title: 'Maybe because…',
      body: <Chips show={8} options={TRIGGERS} customs={customs('triggers', TRIGGERS)} value={form.triggers} onChange={(v) => set('triggers', v)} />,
    },
    {
      title: 'Took anything?',
      body: (
        <>
          <Chips show={6} options={MED_OPTIONS} customs={customValues('medications', attacks, MEDICATIONS)} value={form.medications} onChange={(v) => set('medications', v)} />
          {form.medications.length > 0 && (
            <div className="lg-relief">
              <span>Did it help?</span>
              <Chips single options={RELIEF_OPTIONS} value={form.relief === null ? [] : [String(form.relief)]} onChange={(v) => set('relief', v.length ? Number(v[0]) : null)} />
            </div>
          )}
        </>
      ),
    },
    {
      title: 'When did it start?',
      body: (
        <WhenPicker
            label="Started"
            value={form.started_at}
            onChange={(v) => set('started_at', v)}
            quick={[
              { label: 'Just now', iso: new Date().toISOString() },
              { label: '1 hour ago', iso: new Date(Date.now() - HOUR).toISOString() },
              { label: '3 hours ago', iso: new Date(Date.now() - 3 * HOUR).toISOString() },
              { label: 'This morning', iso: atToday(8) },
            ]}
          />
      ),
    },
    {
      title: ongoing ? 'Is it still going?' : 'How long did it last?',
      body: (
        <>
          <label className="lg-when-row switch-row lg-still">
            <span>Still going</span>
            <input type="checkbox" role="switch" checked={ongoing} onChange={(e) => toggleOngoing(e.target.checked)} />
          </label>
          {!ongoing && form.ended_at && (
            <>
              <WhenPicker
                label="Ended"
                value={form.ended_at}
                min={form.started_at}
                onChange={(v) => set('ended_at', v)}
                quick={[1, 2, 4, 8]
                  .map((h) => ({ label: `Lasted ${h}h`, iso: new Date(new Date(form.started_at).getTime() + h * HOUR).toISOString() }))
                  .filter((q) => q.iso <= new Date().toISOString())}
              />
              <p className="lg-lasted">Lasted {formatDuration(attackDuration(form.started_at, form.ended_at))}</p>
            </>
          )}
          <textarea className="lg-notes" rows={2} placeholder="Anything worth remembering?" aria-label="Notes" value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)} />
          {id && (
            <button type="button" className="lg-delete" onClick={onDelete} disabled={busy}>
              <Glyph name="trash" size={18} />
              Delete this migraine
            </button>
          )}
        </>
      ),
    },
  ]
  const last = step === steps.length - 1
  const current = steps[step]

  return (
    <div className={`lg${leaving ? ' leaving' : ''}`}>
      <form className="lg-form" onSubmit={submit}>
        {/* story-style progress: one bar per question, tap one to jump there */}
        <div className="lg-progress" role="tablist" aria-label="Questions" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
          {steps.map((st, i) => (
            <button
              key={st.title}
              type="button"
              role="tab"
              aria-selected={i === step}
              aria-label={`${i + 1}. ${st.title}`}
              className={i <= step ? 'is-done' : undefined}
              onClick={() => setStep(i)}
            />
          ))}
        </div>

        <header className="lg-top">
          <button type="button" className="lg-close" onClick={goBack} aria-label="Close">
            <Glyph name="close" size={22} />
          </button>
          <span className="lg-count">
            {step + 1} of {steps.length}
          </span>
          {/* after the first answer you can stop any time: useful in the middle of a migraine */}
          {step > 0 && !last ? (
            <button className="lg-save-now" disabled={busy}>
              Save now
            </button>
          ) : (
            <span className="lg-top-spacer" />
          )}
        </header>

        <section key={step} className="lg-step" aria-live="polite">
          <h1>{current.title}</h1>
          {step === 0 && (
            <p className="lg-ask-sub">
              <b key={form.intensity}>{levelLabel(form.intensity)}</b> · started {niceWhen(form.started_at).replace(/^./, (c) => c.toLowerCase())}
              {ongoing ? ', still going' : ''}
            </p>
          )}
          {current.body}
        </section>

        <div className="lg-save">
          {error && <p className="notice">{error}</p>}
          <div className="lg-nav">
            {step > 0 && (
              <button type="button" className="lg-back" onClick={() => setStep(step - 1)}>
                Back
              </button>
            )}
            {/* separate keys: reusing one button and turning it into a submit mid-tap would save early */}
            {last ? (
              <button key="save" className="lg-save-btn" disabled={busy}>
                {busy ? 'Saving…' : 'Save Entry'}
              </button>
            ) : (
              <button key="next" type="button" className="lg-save-btn" onClick={() => setStep(step + 1)}>
                Next
              </button>
            )}
          </div>
        </div>
      </form>

      {/* Grami floats by on a quiet sea; the face shows how bad it is, the water stays calm */}
      <QuietSea>
        <span className="lg-grami">
          <Boat mood={moodFor(form.intensity)} size={84} water={false} />
        </span>
      </QuietSea>
    </div>
  )
}
