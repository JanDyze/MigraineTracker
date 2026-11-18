// Manna as an MCP server, so Claude can read and record a person's Manna: "how much is left for food this month?",
// "paid Meralco 1,850 from BDO", "Ana paid back 500". Add it to Claude as a custom connector with the link made in
// Manna → Settings → Claude:
//
//   https://<project>.supabase.co/functions/v1/manna-mcp/mk_…        (cloud)
//   http://127.0.0.1:54321/functions/v1/manna-mcp/mk_…               (local stack, for the MCP Inspector or mcp-remote)
//
// The mk_… key says whose Manna it is (only its hash is stored, in manna.connector_keys) and can be revoked in
// Settings. It also works as "Authorization: Bearer mk_…" for clients that send headers. The function runs with the
// service role, so every query below is pinned to that one person with user_id; the database's same-owner triggers
// still stop a row from pointing at someone else's account or category.
//
// Deploy:  npx supabase functions deploy manna-mcp --no-verify-jwt   (Claude sends no Supabase login; the key is the login)
import { createClient } from 'npm:@supabase/supabase-js@2'
import { handleBody } from './mcp.ts'
import { clean, type Data, type Settings, TABLES, type TableName, todayIn } from './money.ts'
import type { Db } from './tools.ts'

const TZ = Deno.env.get('MANNA_TZ') ?? 'Asia/Manila'
const KEY_RE = /^mk_[0-9a-f]{48}$/
const BUCKET = 'manna-receipts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, accept, mcp-protocol-version, mcp-session-id, last-event-id',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Expose-Headers': 'mcp-session-id, mcp-protocol-version',
}
const send = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(body == null ? null : JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json', ...extra } })

// Supabase hands every function its URL and service key; newer projects may carry the secret key in SUPABASE_SECRET_KEYS.
function serviceKey(): string {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (legacy) return legacy
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}') as Record<string, string>
    const k = keys.default ?? Object.values(keys)[0]
    if (k) return k
  } catch { /* fall through */ }
  throw new Error('no service key in the function environment (SUPABASE_SERVICE_ROLE_KEY)')
}
const connect = () =>
  createClient(Deno.env.get('SUPABASE_URL')!, serviceKey(), {
    db: { schema: 'manna' },
    auth: { persistSession: false, autoRefreshToken: false },
  })
let admin: ReturnType<typeof connect> | null = null
const sb = () => (admin ??= connect())

/** The key from the link's last path segment, ?key=, or a Bearer header. */
function keyFrom(req: Request): string | null {
  const url = new URL(req.url)
  const fromPath = url.pathname.split('/').filter(Boolean).at(-1) ?? ''
  const bearer = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  return [fromPath, url.searchParams.get('key') ?? '', bearer].find((k) => KEY_RE.test(k)) ?? null
}

// a key's owner, remembered briefly so a burst of calls is one lookup (revoking takes effect within a minute)
const owners = new Map<string, { uid: string; at: number }>()
async function ownerOf(key: string): Promise<string | null> {
  const hit = owners.get(key)
  if (hit && Date.now() - hit.at < 60_000) return hit.uid
  const { data, error } = await sb().rpc('connector_user', { p_key: key })
  if (error) throw new Error(error.message)
  if (!data) return null
  owners.set(key, { uid: data as string, at: Date.now() })
  return data as string
}

/** Every row of one table for one person, a page at a time (the API returns at most 1,000 rows per request). */
async function all(table: TableName, uid: string) {
  const rows: unknown[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb().from(table).select('*').eq('user_id', uid).order('id').range(from, from + 999)
    if (error) throw new Error(`${table}: ${error.message}`)
    rows.push(...(data ?? []).map(clean))
    if (!data || data.length < 1000) return rows
  }
}

function db(uid: string): Db {
  return {
    async load() {
      const [settings, ...tables] = await Promise.all([
        sb().from('settings').select('user_id, currency, tithe_percent, onboarded_at').eq('user_id', uid).maybeSingle(),
        ...TABLES.map((t) => all(t, uid)),
      ])
      if (settings.error) throw new Error(settings.error.message)
      const data = {
        settings: settings.data ? clean(settings.data as Settings) : { user_id: uid, currency: 'PHP', tithe_percent: 10, onboarded_at: null },
      } as Data
      TABLES.forEach((t, i) => ((data[t] as unknown[]) = tables[i] as unknown[]))
      return data
    },
    async insert(table, row) {
      const { data, error } = await sb().from(table).insert({ ...row, user_id: uid } as never).select('*').single()
      if (error) throw new Error(error.message)
      return clean(data)
    },
    async update(table, id, patch) {
      const { data, error } = await sb().from(table).update(patch as never).eq('id', id).eq('user_id', uid).select('*').single()
      if (error) throw new Error(error.message)
      return clean(data)
    },
    async remove(table, id) {
      const { error } = await sb().from(table).delete().eq('id', id).eq('user_id', uid)
      if (error) throw new Error(error.message)
    },
    async saveSettings(patch) {
      const { data, error } = await sb().from('settings').upsert({ ...patch, user_id: uid } as never, { onConflict: 'user_id' })
        .select('user_id, currency, tithe_percent, onboarded_at').single()
      if (error) throw new Error(error.message)
      return clean(data as Settings)
    },
    // photos live in the private bucket under <user id>/…; never reach outside that folder
    async photoUrl(path) {
      if (!path.startsWith(`${uid}/`)) return null
      const { data, error } = await sb().storage.from(BUCKET).createSignedUrl(path, 3600)
      return error ? null : data.signedUrl
    },
    async removePhoto(path) {
      if (!path.startsWith(`${uid}/`)) return
      const { error } = await sb().storage.from(BUCKET).remove([path])
      if (error) throw new Error(error.message)
    },
    async links() {
      const { data, error } = await sb().from('connector_keys').select('id, label, key_hint, created_at, last_used_at, revoked_at')
        .eq('user_id', uid).order('created_at', { ascending: false })
      if (error) throw new Error(error.message)
      return data ?? []
    },
    async updateLink(id, patch) {
      const { error } = await sb().from('connector_keys').update(patch).eq('id', id).eq('user_id', uid)
      if (error) throw new Error(error.message)
      if (patch.revoked_at) owners.clear() // the revoked key stops at once here, not after the minute's cache
    },
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  // stateless: no server-sent event stream to open, no session to end
  if (req.method !== 'POST') return send({ error: 'Manna’s MCP server takes POST requests. Add this link to Claude as a custom connector.' }, 405, { Allow: 'POST, OPTIONS' })

  const key = keyFrom(req)
  const uid = key ? await ownerOf(key).catch((e) => (console.error('manna-mcp key lookup', e), undefined)) : null
  if (uid === undefined) return send({ jsonrpc: '2.0', id: null, error: { code: -32603, message: 'Manna couldn’t check the link just now. Try again.' } }, 503)
  if (!uid) {
    return send({ jsonrpc: '2.0', id: null, error: { code: -32001, message: 'This Manna connector link isn’t valid or was revoked. Make a new one in Manna → Settings → Claude.' } }, 403)
  }

  const out = await handleBody(await req.text(), async () => ({ db: db(uid), today: todayIn(TZ) }))
  return out == null ? new Response(null, { status: 202, headers: CORS }) : send(out)
})
