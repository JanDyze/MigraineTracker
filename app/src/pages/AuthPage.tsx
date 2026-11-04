import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { enabledProviders, supabase } from '../lib/supabase'
import { Wordmark } from '../components/Logo'
import { GramiBack } from '../components/GramiBack'
import { Glyph } from '../components/Glyph'
import { QuietSea, Sky } from '../components/Sky'

function GoogleG() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}

/**
 * The welcome screen (after Mighty screen 8): a lavender sunset, Grami seen from behind as a backlit
 * silhouette, sailing away into a big glowing sun, "Take care.", and what Might is.
 * Get started / I already have an account shrink the sunset to a band at the top, and a sheet with
 * the sign-in form rises up underneath it.
 */
const icon = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }
const MailIcon = () => (
  <svg {...icon}>
    <rect x="3" y="5" width="18" height="14" rx="3" />
    <path d="m4 7 8 6 8-6" />
  </svg>
)
const UserIcon = () => (
  <svg {...icon}>
    <circle cx="12" cy="8.5" r="3.8" />
    <path d="M4.5 20c1.2-3.6 4-5.4 7.5-5.4s6.3 1.8 7.5 5.4" />
  </svg>
)
const LockIcon = () => (
  <svg {...icon}>
    <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
    <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
  </svg>
)
const EyeIcon = ({ open }: { open: boolean }) => (
  <svg {...icon}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="3" />
    {!open && <path d="M4 20 20 4" />}
  </svg>
)

export function AuthPage() {
  const [view, setView] = useState<'welcome' | 'form'>('welcome')
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  // a problem to fix (error) or good news (ok, e.g. "check your email")
  const [note, setNote] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null)
  const [showPw, setShowPw] = useState(false)
  const firstRef = useRef<HTMLInputElement>(null)
  const [google, setGoogle] = useState(false)

  useEffect(() => {
    enabledProviders().then((p) => setGoogle(!!p.google))
  }, [])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setNote(null)
    const { data, error } =
      mode === 'signin'
        ? await supabase.auth.signInWithPassword({ email, password })
        : // the name rides along in the user's metadata (Google sign-ups get theirs from Google)
          await supabase.auth.signUp({ email, password, options: { data: { full_name: name.trim() } } })
    setBusy(false)
    if (error) setNote({ kind: 'error', text: error.message })
    else if (mode === 'signup' && !data.session) setNote({ kind: 'ok', text: 'Almost there! Check your email to confirm your account.' })
  }

  async function signInWithGoogle() {
    setBusy(true)
    setNote(null)
    // Leaves the app for Google, then Supabase redirects back here with the session.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) {
      setNote({ kind: 'error', text: error.message })
      setBusy(false)
    }
  }

  const open = (m: 'signin' | 'signup') => {
    setMode(m)
    setNote(null)
    setView('form')
  }

  // the first field is ready to type in as soon as the sheet opens
  useEffect(() => {
    if (view === 'form') firstRef.current?.focus({ preventScroll: true })
  }, [view, mode])

  return (
    <div className={`welcome td-evening td-dark is-${view}`}>
      <Sky scene="evening" />

      <header className="welcome-top">
        {view === 'form' && (
          <button type="button" className="welcome-back" onClick={() => setView('welcome')} aria-label="Back">
            <Glyph name="back" size={22} />
          </button>
        )}
        <Wordmark />
      </header>

      {view === 'welcome' && (
        <div className="welcome-hello">
          <h1>Take care.</h1>
          <p>
            You’re not alone
            <br />
            in this journey.
          </p>
          <span className="welcome-heart">♡</span>
        </div>
      )}

      {/* Grami, seen from behind, sails away into the setting sun, smaller and smaller */}
      <div className="welcome-stage" aria-hidden="true">
        {/* turns Grami into a backlit silhouette: his drawing in navy tones (shapes still show),
            with a warm rim of sunlight around the edges */}
        <svg width="0" height="0" className="welcome-filter">
          <filter id="welcome-silhouette" colorInterpolationFilters="sRGB">
            <feColorMatrix type="saturate" values="0" result="grey" />
            <feComponentTransfer in="grey" result="navy">
              <feFuncR type="table" tableValues="0.11 0.36" />
              <feFuncG type="table" tableValues="0.12 0.34" />
              <feFuncB type="table" tableValues="0.27 0.58" />
            </feComponentTransfer>
            <feMorphology in="SourceAlpha" operator="dilate" radius="1.3" result="fat" />
            <feFlood floodColor="#ffd9ad" floodOpacity="0.85" />
            <feComposite in2="fat" operator="in" result="rim" />
            <feMerge>
              <feMergeNode in="rim" />
              <feMergeNode in="navy" />
            </feMerge>
          </filter>
        </svg>
        <span className="welcome-sun" />
        <span className="welcome-grami">
          <GramiBack size={84} />
          {/* his reflection on the water, fading downwards */}
          <span className="welcome-reflect">
            <GramiBack size={84} still />
          </span>
        </span>
      </div>
      <QuietSea>
        <span className="welcome-glint" />
      </QuietSea>

      {view === 'welcome' ? (
        <div className="welcome-panel">
          <p className="welcome-about">
            <b>Might</b> is a migraine tracker.
          </p>
          <button type="button" className="td-btn" onClick={() => open('signup')}>
            Get started
          </button>
          <button type="button" className="welcome-link" onClick={() => open('signin')}>
            I already have an account
          </button>
        </div>
      ) : (
        <section className="auth-sheet" aria-labelledby="auth-title">
          <div className="auth-head" key={mode}>
            <h1 id="auth-title">{mode === 'signup' ? 'Welcome aboard.' : 'Welcome back.'}</h1>
            <p>{mode === 'signup' ? 'Let’s set sail together.' : 'Grami missed you.'}</p>
          </div>

          {/* sign in or create an account: a pill slides between the two */}
          <div className="welcome-seg" role="tablist" aria-label="Sign in or create an account" style={{ '--i': mode === 'signin' ? 0 : 1 } as CSSProperties}>
            <span className="welcome-seg-pill" aria-hidden="true" />
            <button type="button" role="tab" aria-selected={mode === 'signin'} onClick={() => open('signin')}>
              Sign in
            </button>
            <button type="button" role="tab" aria-selected={mode === 'signup'} onClick={() => open('signup')}>
              Create account
            </button>
          </div>

          {google && (
            <>
              <button type="button" className="welcome-google" onClick={signInWithGoogle} disabled={busy}>
                <GoogleG />
                Continue with Google
              </button>
              <div className="welcome-or">or with email</div>
            </>
          )}

          <form className="welcome-form" onSubmit={submit}>
            {mode === 'signup' && (
              <label className="welcome-field">
                <UserIcon />
                <input ref={firstRef} type="text" autoComplete="name" required maxLength={60} placeholder=" " value={name} onChange={(e) => setName(e.target.value)} />
                <span>Your name</span>
              </label>
            )}
            <label className="welcome-field">
              <MailIcon />
              <input ref={mode === 'signin' ? firstRef : undefined} type="email" autoComplete="email" required placeholder=" " value={email} onChange={(e) => setEmail(e.target.value)} />
              <span>Email</span>
            </label>
            <label className="welcome-field">
              <LockIcon />
              <input
                type={showPw ? 'text' : 'password'}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                minLength={6}
                required
                placeholder=" "
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <span>Password</span>
              <button type="button" className="welcome-eye" onClick={() => setShowPw(!showPw)} aria-label={showPw ? 'Hide password' : 'Show password'}>
                <EyeIcon open={showPw} />
              </button>
            </label>
            {mode === 'signup' && (
              <p className={`welcome-hint${password.length >= 6 ? ' is-ok' : ''}`}>
                <span aria-hidden="true">{password.length >= 6 ? '✓' : '•'}</span> At least 6 characters
              </p>
            )}
            {note && (
              <p className={`welcome-note is-${note.kind}`} role={note.kind === 'error' ? 'alert' : 'status'}>
                {note.text}
              </p>
            )}
            <button className="td-btn welcome-submit" disabled={busy}>
              {busy ? <span className="welcome-spinner" aria-label="Please wait" /> : mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </form>
        </section>
      )}
    </div>
  )
}
