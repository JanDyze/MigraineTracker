// Manna's mascot, talking. Someone types "lunch 250 gcash, paid meralco 1,800 from bdo" and Claude turns it
// into entries for them to check and save. Nothing is written here: the app shows each entry as a card and
// saves only what the person confirms.
//
// The Anthropic key lives in this function's environment (ANTHROPIC_API_KEY), never in the app.
//   local:  supabase/functions/.env   →  ANTHROPIC_API_KEY=sk-ant-...
//   cloud:  supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
import { createClient } from 'npm:@supabase/supabase-js@2'

const MODEL = Deno.env.get('MANNA_MODEL') ?? 'claude-haiku-5-5'
const KEY = Deno.env.get('ANTHROPIC_API_KEY')

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

type Named = { id: string; name: string; kind?: string }
type Body = {
  message: string
  /** a photo of a receipt, shrunk on the phone first (JPEG, base64) */
  image?: { media_type: string; data: string }
  history?: { role: 'user' | 'assistant'; text: string }[]
  context: {
    today: string
    accounts: Named[]
    categories: Named[]
    people: { name: string }[]
    tithePercent: number
    notes?: { body: string; person: string | null; amount: number | null; remind_on: string | null; saved_on: string | null }[]
  }
}

// One tool, always called: Claude answers in words AND proposes zero or more entries.
const TOOL = {
  name: 'propose',
  description: 'Reply to the person and propose entries to record. Propose nothing when they are only chatting or asking something.',
  input_schema: {
    type: 'object',
    properties: {
      reply: { type: 'string', description: 'One or two short, warm sentences, in the language the person used.' },
      entries: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            kind: { type: 'string', enum: ['expense', 'income', 'giving', 'transfer', 'lend', 'borrow', 'note'], description: 'lend: they gave someone a loan. borrow: someone lent to them. note: something to remember, no money moved (a request, a promise, a decision to wait).' },
            amount: { type: 'number', description: 'Pesos, positive. For a note, only if an amount was mentioned.' },
            account_id: { type: 'string', description: 'Account the money left or entered. Use an id from the list; pick the cash/wallet account if unsaid.' },
            to_account_id: { type: 'string', description: 'Transfers only: destination account id.' },
            category_id: { type: 'string', description: 'For expense, income or giving: a category id of that kind from the list.' },
            person: { type: 'string', description: 'For lend or borrow: the person’s name.' },
            note: { type: 'string', description: 'Short label, like "Lunch at Jollibee". For a note: the full thing to remember, in their words, tidied.' },
            remind_on: { type: 'string', description: 'Notes only: YYYY-MM-DD to bring it up again, if they said when ("next week", "on payday").' },
            occurred_on: { type: 'string', description: 'YYYY-MM-DD. Today unless they said otherwise ("yesterday", "last Sunday").' },
          },
          required: ['kind'],
        },
      },
    },
    required: ['reply', 'entries'],
  },
}

function system(c: Body['context']) {
  const list = (xs: Named[]) => xs.map((x) => `- ${x.id}: ${x.name}${x.kind ? ` (${x.kind})` : ''}`).join('\n')
  return `You are KATY ("Keeper of All Thy Yield"; also a nod to "katiwala", Tagalog for steward), the companion inside Manna, a Christian stewardship app for tracking money in the Philippines (pesos).
Turn what the person tells you into entries they can confirm. You are a woman with the warmth of a caring ate (older sister): gentle, encouraging, a little playful, never bossy. Be brief and plain-spoken; you may gently encourage, never preach or lecture.
Understand Taglish and Filipino money words ("piso", "k" for thousand, "sweldo" = salary, "pamasahe" = transport, "ulam", "load", "utang").
Tithes and offerings are kind "giving". Moving money between their own accounts is "transfer". Never invent amounts; if the amount is missing, ask and propose nothing.
Today is ${c.today}. Their tithe is ${c.tithePercent}% of income.

Accounts:
${list(c.accounts)}

Categories:
${list(c.categories)}

People they track loans with: ${c.people.map((p) => p.name).join(', ') || 'none yet'}

Your notes (things they asked you to remember; use them to answer, and mention one gently when it matters):
${(c.notes ?? []).map((n) => `- ${n.body}${n.person ? ` [about ${n.person}]` : ''}${n.amount ? ` [₱${n.amount}]` : ''}${n.remind_on ? ` [remind ${n.remind_on}]` : ''}${n.saved_on ? ` [noted ${n.saved_on}]` : ''}`).join('\n') || 'none yet'}
When they send a photo of a receipt: read the store and the TOTAL actually paid (after discounts and VAT; never a subtotal, change or cash tendered), and the date printed on it. Propose one expense with the store and what was bought as the note (like "Puregold groceries"), the best category, the date from the receipt (today if unreadable or if it would be in the future), and the account the payment method shows (GCash, card from a bank they have) or the cash account. If it's a church or giving slip, use "giving". Split into more than one entry only if they ask. If you can't read the total, say so kindly and propose nothing. If the photo isn't a receipt, say what you see and propose nothing unless they tell you what to record.
When they tell you something to remember, or someone asks them for money and they haven't decided or said yes, propose a "note" instead of an expense. Never move money for a note.

Always answer by calling the "propose" tool.`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
  if (!KEY) return json({ error: 'The mascot isn’t set up yet: add ANTHROPIC_API_KEY to the function’s secrets.' }, 503)

  // signed-in users only
  const auth = req.headers.get('Authorization') ?? ''
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } })
  const { data: user } = await sb.auth.getUser()
  if (!user?.user) return json({ error: 'Please sign in again.' }, 401)

  let body: Body
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Bad request' }, 400)
  }
  const message = String(body.message ?? '').slice(0, 1000).trim()
  const image = body.image
  if (image && (!['image/jpeg', 'image/png', 'image/webp'].includes(image.media_type) || typeof image.data !== 'string' || image.data.length > 2_800_000))
    return json({ error: 'That photo is too big or not a picture I can read.' }, 400)
  if ((!message && !image) || !body.context) return json({ error: 'Say something first.' }, 400)
  const ask = image
    ? [{ type: 'image', source: { type: 'base64', media_type: image.media_type, data: image.data } }, { type: 'text', text: message || 'Here’s a receipt. Please record it.' }]
    : message

  // earlier photos aren't sent again; their turns say a photo was there
  const history = (body.history ?? []).slice(-8).map((m) => ({ role: m.role, content: String(m.text || '(sent a photo)').slice(0, 1000) }))
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system: system(body.context),
      tools: [TOOL],
      tool_choice: { type: 'tool', name: 'propose' },
      messages: [...history, { role: 'user', content: ask }],
    }),
  })
  if (!res.ok) {
    console.error('anthropic', res.status, await res.text())
    return json({ error: 'The mascot couldn’t think just now. Try again in a moment.' }, 502)
  }
  const out = await res.json()
  const call = (out.content ?? []).find((b: { type: string }) => b.type === 'tool_use')
  if (!call) return json({ reply: 'Sorry, I didn’t catch that.', entries: [] })

  // keep only entries that point at the person's own accounts and categories
  const acc = new Set(body.context.accounts.map((a) => a.id))
  const cat = new Map(body.context.categories.map((c) => [c.id, c.kind]))
  const entries = (call.input.entries ?? []).filter((e: Record<string, unknown>) => {
    if (e.kind === 'note') return typeof e.note === 'string' && e.note.trim().length > 0
    return (
      typeof e.amount === 'number' && e.amount > 0 && acc.has(e.account_id as string) &&
      (e.kind !== 'transfer' || acc.has(e.to_account_id as string)) &&
      (!e.category_id || cat.get(e.category_id as string) === e.kind) &&
      (!['lend', 'borrow'].includes(e.kind as string) || (typeof e.person === 'string' && e.person.trim()))
    )
  }).map((e: Record<string, unknown>) => (e.kind === 'note' ? { amount: 0, account_id: '', occurred_on: body.context.today, ...e } : e))
  return json({ reply: String(call.input.reply ?? ''), entries })
})
