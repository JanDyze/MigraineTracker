// The Model Context Protocol, the small part of it a tools-only server needs: JSON-RPC 2.0 over Streamable HTTP,
// stateless (no sessions, no server-sent events). Each POST carries one message (or a batch) and gets JSON back.
// Spec: https://modelcontextprotocol.io/specification
import { type Ctx, TOOLS, ToolError } from './tools.ts'

export const SERVER = { name: 'manna', title: 'Manna', version: '0.2.0' }
const PROTOCOLS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05']

export const INSTRUCTIONS = `These tools read and record one person's Manna: a money journal kept as a faithful steward (Philippine pesos).

Vocabulary, because it is not always the obvious one:
- An entry is any movement of money. Its kind is expense (spending), income, giving (tithes, offerings, missions, helping others; counted apart from spending), transfer (between their own accounts, which changes no totals), or loan money out/in.
- Accounts are where money sits: cash wallet, GCash/Maya, banks, credit cards (a negative balance is card debt), savings.
- Budgets are a standing monthly limit per spending category. "Per day left" is what can still be spent each remaining day this month.
- The tithe is a share (tithe_percent) of the month's income, compared with giving in a "Tithe" category.
- Loans go either way: "owed_to_me" when they lent it, "i_owe" when they borrowed it. What's left is the amount less repayments.
- Bills are recurring: rent, utilities, subscriptions, and regular income such as salary. Paying one moves it to its next due date.
- Goals are savings goals; adding to one only tracks it and moves no money.
- Notes are "KATY's notes": things to remember without moving money. KATY is the app's mascot and companion.
- History-only entries (history_only: true) are past entries the account balances already reflect. They count in totals, budgets, the tithe and loans, but don't change any balance.

Working practice:
- Dates are YYYY-MM-DD in Philippine time. overview reports today's date; use it rather than assuming.
- Start with overview (or get_setup for the exact account and category names). Accounts and categories can be given by name or id; loans, bills, goals, notes and entries by the id the read tools return.
- Listing tools report "truncated". If it is true, narrow the filters instead of treating the list as complete.
- This is someone's private money. Answer what was asked; don't recite balances or loans they didn't ask about.

Recording:
- Nothing here deletes. A wrong entry is corrected with update_entry; removing one is done in the app.
- Record only what the person said happened. If an amount or account is unclear, ask; if they only implied an entry, confirm before saving.
- When the person names an account or category that doesn't exist, the error lists the valid ones: pick the right one or ask, don't guess repeatedly.
- When the person says past entries are just for the record ("don't deduct", "my balances are already right", catching up on earlier days of the month), set history_only on each one. If it's unclear whether a past entry is already reflected in the balance, ask once and keep that answer for the rest of the batch.
- After saving, tell them exactly what was recorded (amount, account, category, date) so a mistake is caught while they are reading.`

type Msg = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> }
type Reply = Record<string, unknown>

const ok = (id: Msg['id'], result: unknown): Reply => ({ jsonrpc: '2.0', id, result })
const fail = (id: Msg['id'], code: number, message: string): Reply => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } })

export function toolList() {
  return TOOLS.map((t) => ({
    name: t.name,
    title: t.title,
    description: t.description,
    inputSchema: t.inputSchema,
    annotations: {
      title: t.title,
      readOnlyHint: t.readOnly,
      destructiveHint: false,
      idempotentHint: t.readOnly,
      openWorldHint: false,
    },
  }))
}

/** One JSON-RPC message in, one reply out (null for notifications, which get no reply). */
export async function handleMessage(msg: Msg, ctx: () => Promise<Ctx>): Promise<Reply | null> {
  if (!msg || typeof msg !== 'object' || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
    return fail(msg?.id, -32600, 'Invalid Request')
  }
  const { id, method, params = {} } = msg
  const isNotification = id === undefined
  if (isNotification) return null // notifications/initialized, notifications/cancelled…

  switch (method) {
    case 'initialize': {
      const asked = String(params.protocolVersion ?? '')
      return ok(id, {
        protocolVersion: PROTOCOLS.includes(asked) ? asked : PROTOCOLS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER,
        instructions: INSTRUCTIONS,
      })
    }
    case 'ping':
      return ok(id, {})
    case 'tools/list':
      return ok(id, { tools: toolList() })
    case 'tools/call': {
      const tool = TOOLS.find((t) => t.name === params.name)
      if (!tool) return fail(id, -32602, `Unknown tool: ${String(params.name)}`)
      const args = (params.arguments ?? {}) as Record<string, unknown>
      if (typeof args !== 'object' || Array.isArray(args)) return fail(id, -32602, 'Tool arguments must be an object.')
      try {
        const result = await tool.run(args, await ctx())
        return ok(id, { content: [{ type: 'text', text: JSON.stringify(result, null, 1) }], structuredContent: result, isError: false })
      } catch (e) {
        // mistakes Claude can fix go back as the tool's answer; anything else is logged and kept vague
        const known = e instanceof ToolError
        if (!known) console.error('manna-mcp', tool.name, e)
        const text = known ? e.message : `Manna couldn't do that just now (${(e as Error).message ?? 'unknown error'}). Try again in a moment.`
        return ok(id, { content: [{ type: 'text', text }], isError: true })
      }
    }
    case 'resources/list':
      return ok(id, { resources: [] })
    case 'prompts/list':
      return ok(id, { prompts: [] })
    default:
      return fail(id, -32601, `Method not found: ${method}`)
  }
}

/** A whole POST body: one message or a batch. Returns the JSON to send, or null for "202 Accepted, no body". */
export async function handleBody(raw: string, ctx: () => Promise<Ctx>): Promise<unknown | null> {
  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return fail(null, -32700, 'Parse error')
  }
  if (Array.isArray(body)) {
    if (!body.length) return fail(null, -32600, 'Invalid Request')
    const replies = (await Promise.all(body.map((m) => handleMessage(m as Msg, ctx)))).filter(Boolean)
    return replies.length ? replies : null
  }
  return handleMessage(body as Msg, ctx)
}
