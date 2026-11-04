import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAttacks } from '../lib/store'
import { SUGGESTIONS, answer } from '../lib/insights'
import { Boat } from '../components/Boat'
import { Glyph } from '../components/Glyph'
import { useLeave } from '../lib/motion'
import { play } from '../lib/sound'

type Msg = { from: 'grami' | 'me'; text: string }

const GREETING: Msg = {
  from: 'grami',
  text: "Hi, I'm Grami! Ask me about your migraines: what set them off, what helped, which days were rough. Tap a bubble or type.",
}

/** Chat with Grami. Answers come from the journal on this device (see lib/insights.ts). */
export function ChatPage() {
  const { attacks, loading } = useAttacks()
  const navigate = useNavigate()
  const [msgs, setMsgs] = useState<Msg[]>([GREETING])
  const [draft, setDraft] = useState('')
  const [thinking, setThinking] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  // block body on purpose: newer browsers return a Promise from scrollIntoView, and an effect
  // must not return anything but a cleanup function
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [msgs, thinking])

  const { leaving, leave } = useLeave()
  const goBack = () => leave(() => ((window.history.state?.idx ?? 0) > 0 ? navigate(-1) : navigate('/', { replace: true })))

  function ask(q: string) {
    const text = q.trim()
    if (!text || thinking) return
    // quiet while a migraine is on
    const hush = attacks.some((a) => !a.ended_at)
    if (!hush) play('send')
    setMsgs((m) => [...m, { from: 'me', text }])
    setDraft('')
    setThinking(true)
    // a short pause so it feels like Grami is thinking, not a lookup table
    setTimeout(() => {
      setMsgs((m) => [...m, { from: 'grami', text: answer(text, attacks) }])
      if (!hush) play('pop')
      setThinking(false)
    }, 650)
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    ask(draft)
  }

  const asked = new Set(msgs.filter((m) => m.from === 'me').map((m) => m.text))

  return (
    <div className={`sheet-page chat-page${leaving ? ' leaving' : ''}`}>
      <div className="sheet">
        <div className="sheet-handle" />
        <header className="chat-head">
          <Boat mood={thinking ? 'thinking' : 'happy'} size={96} title="Grami in its paper boat" />
          <div className="chat-title">
            <h1>Grami</h1>
            <span className="muted">knows your journal</span>
          </div>
          <button type="button" className="icon-btn" onClick={goBack} aria-label="Close chat">
            <Glyph name="close" size={20} />
          </button>
        </header>

        <div className="chat-log" role="log" aria-live="polite">
          {msgs.map((m, i) => (
            <p key={i} className={`bubble bubble-${m.from}`}>
              {m.text}
            </p>
          ))}
          {thinking && (
            <p className="bubble bubble-grami bubble-typing" aria-label="Grami is thinking">
              <span />
              <span />
              <span />
            </p>
          )}
          <div ref={endRef} />
        </div>

        <div className="chat-suggest" aria-label="Questions you can ask">
          {SUGGESTIONS.filter((s) => !asked.has(s)).map((s) => (
            <button key={s} type="button" className="suggest" onClick={() => ask(s)} disabled={loading || thinking}>
              {s}
            </button>
          ))}
        </div>

        <form className="chat-input" onSubmit={submit}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask Grami…"
            aria-label="Ask Grami a question"
            disabled={loading}
          />
          <button className="send" aria-label="Send" disabled={!draft.trim() || thinking}>
            <Glyph name="send" size={20} />
          </button>
        </form>
      </div>
    </div>
  )
}
