// What Claude can do with Manna: read the person's money journal and record what they tell it. Every tool works on
// one person's rows (the connector key decides whose), through the small Db interface, so the same code runs against
// Supabase in the Edge Function and against in-memory rows in the tests.
import {
  type Account, type Category, type CategoryKind, type Data, type Debt, type Note, type Settings, type TableName, type Tables, type Tx,
  addDays, balances, cardStatus, debtLeft, debtPaid, daysBetween, dueLabel, endOfMonth, frequencyLabel, goalSaved, isDate, monthOf, monthPlan,
  moneyPicture, monthTotals, nextDue, round2, shiftMonth, tithe, withinDay,
} from './money.ts'

export interface Db {
  /** Every row of the person's Manna (personal scale: the app loads it all too). */
  load(): Promise<Data>
  insert<T extends TableName>(table: T, row: Partial<Tables[T]>): Promise<Tables[T]>
  update<T extends TableName>(table: T, id: string, patch: Partial<Tables[T]>): Promise<Tables[T]>
  remove(table: TableName, id: string): Promise<void>
  saveSettings(patch: Partial<Settings>): Promise<Settings>
  /** A signed link to a photo in the receipts bucket (an hour), or null. */
  photoUrl(path: string): Promise<string | null>
  removePhoto(path: string): Promise<void>
  links(): Promise<Link[]>
  updateLink(id: string, patch: { label?: string; revoked_at?: string }): Promise<void>
}

export type Link = { id: string; label: string; key_hint: string; created_at: string; last_used_at: string | null; revoked_at: string | null }

export type Ctx = { db: Db; today: string }

/** A mistake Claude can fix and retry: shown to it as the tool's answer, not as a server failure. */
export class ToolError extends Error {}

export type Args = Record<string, unknown>
export type Tool = {
  name: string
  title: string
  description: string
  inputSchema: Record<string, unknown>
  /** reads only; anything else adds or changes rows */
  readOnly: boolean
  /** deletes or revokes something for good */
  destructive?: boolean
  run: (args: Args, ctx: Ctx) => Promise<unknown>
}

// ---------------------------------------------------------------- arguments

export const S = (description: string, extra: Record<string, unknown> = {}) => ({ type: 'string', description, ...extra })
export const N = (description: string, extra: Record<string, unknown> = {}) => ({ type: 'number', description, ...extra })
export const DATE = (description: string) => S(`${description} YYYY-MM-DD.`, { pattern: '^\\d{4}-\\d{2}-\\d{2}$' })
export const obj = (properties: Record<string, unknown>, required: string[] = []) => ({ type: 'object', properties, required, additionalProperties: false })

export function text(a: Args, key: string, opts: { required?: boolean; max?: number } = {}): string | null {
  const v = a[key]
  if (v == null || (typeof v === 'string' && !v.trim())) {
    if (opts.required) throw new ToolError(`"${key}" is required.`)
    return null
  }
  if (typeof v !== 'string') throw new ToolError(`"${key}" should be text.`)
  const t = v.trim()
  if (opts.max && t.length > opts.max) throw new ToolError(`"${key}" is too long (${opts.max} characters at most).`)
  return t
}

export function money(a: Args, key: string, opts: { required?: boolean; allowNegative?: boolean } = {}): number | null {
  const v = a[key]
  if (v == null || v === '') {
    if (opts.required) throw new ToolError(`"${key}" is required (pesos).`)
    return null
  }
  const n = typeof v === 'string' ? Number(v.replace(/[,\s₱]/g, '')) : v
  if (typeof n !== 'number' || !Number.isFinite(n)) throw new ToolError(`"${key}" should be a number of pesos.`)
  const r = round2(n)
  if (opts.allowNegative ? r === 0 : r <= 0) throw new ToolError(`"${key}" should be ${opts.allowNegative ? 'more or less than zero' : 'more than zero'}.`)
  if (Math.abs(r) >= 1e12) throw new ToolError(`"${key}" is too large.`)
  return r
}

export function day(a: Args, key: string, fallback: string | null = null): string | null {
  const v = a[key]
  if (v == null || v === '') return fallback
  if (!isDate(v)) throw new ToolError(`"${key}" should be a date like 2026-11-18.`)
  return v
}

export function oneOf<T extends string>(a: Args, key: string, values: readonly T[], fallback?: T): T {
  const v = a[key] ?? fallback
  if (typeof v !== 'string' || !values.includes(v as T)) throw new ToolError(`"${key}" must be one of: ${values.join(', ')}.`)
  return v as T
}

function flag(a: Args, key: string): boolean | null {
  const v = a[key]
  if (v == null) return null
  if (typeof v === 'boolean') return v
  // some clients send booleans as text
  if (v === 'true' || v === 'false') return v === 'true'
  throw new ToolError(`"${key}" should be true or false.`)
}

/** history_only: a past entry the balances already reflect. Only sent to the database when true, so rows keep the default. */
const HISTORY_ONLY = {
  type: 'boolean',
  description:
    'true for a past entry that the account balances already reflect (e.g. spent before they started tracking, or before they last set their balances): it still counts in the month\'s totals, budgets, tithe and loans, but leaves account balances alone. Default false.',
}
const historyRow = (a: Args) => (flag(a, 'history_only') ? { affects_balance: false } : {})

export function limit(a: Args, fallback: number, max: number): number {
  const v = a.limit
  if (v == null) return fallback
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) throw new ToolError('"limit" should be a whole number above zero.')
  return Math.min(v, max)
}

// ---------------------------------------------------------------- lookups by id or name

export const lower = (s: string) => s.trim().toLowerCase()

export function pickAccount(d: Data, ref: string, field = 'account'): Account {
  const r = lower(ref)
  const a = d.accounts.find((x) => x.id === ref) ?? d.accounts.find((x) => !x.archived && lower(x.name) === r) ?? d.accounts.find((x) => lower(x.name) === r)
  if (!a) throw new ToolError(`No account called "${ref}" (${field}). Accounts: ${d.accounts.filter((x) => !x.archived).map((x) => x.name).join(', ') || 'none yet'}.`)
  return a
}

export function pickCategory(d: Data, ref: string, kind?: CategoryKind): Category {
  const r = lower(ref)
  const pool = d.categories.filter((c) => !kind || c.kind === kind)
  const c = pool.find((x) => x.id === ref) ?? pool.find((x) => !x.archived && lower(x.name) === r) ?? pool.find((x) => lower(x.name) === r)
  if (!c) {
    const valid = pool.filter((x) => !x.archived).map((x) => (kind ? x.name : `${x.name} (${x.kind})`))
    throw new ToolError(`No ${kind ? `${kind} ` : ''}category called "${ref}". Categories: ${valid.join(', ') || 'none'}.`)
  }
  return c
}

export function pickById<T extends { id: string }>(rows: T[], id: string | null, what: string, label: (r: T) => string, hint: string): T {
  if (!id) throw new ToolError(`Say which ${what} (its id from ${hint}).`)
  const exact = rows.find((r) => r.id === id) ?? rows.filter((r) => lower(label(r)) === lower(id)).at(0)
  if (!exact) throw new ToolError(`No ${what} with id or name "${id}". Look it up with ${hint}.`)
  return exact
}

export function names(d: Data) {
  const account = new Map(d.accounts.map((a) => [a.id, a.name]))
  const category = new Map(d.categories.map((c) => [c.id, c.name]))
  const person = new Map(d.people.map((p) => [p.id, p.name]))
  const debt = new Map(d.debts.map((x) => [x.id, x]))
  const bill = new Map(d.recurring.map((r) => [r.id, r.title]))
  return { account, category, person, debt, bill }
}
type Names = ReturnType<typeof names>

export const KIND_LABEL: Record<Tx['kind'], string> = {
  expense: 'expense', income: 'income', giving: 'giving', transfer: 'transfer', debt_out: 'loan money out', debt_in: 'loan money in',
}

export function entryView(t: Tx, n: Names) {
  const loan = t.debt_id ? n.debt.get(t.debt_id) : undefined
  return {
    id: t.id,
    date: t.occurred_on,
    kind: t.kind,
    kind_label: KIND_LABEL[t.kind],
    amount: t.amount,
    account: n.account.get(t.account_id) ?? null,
    ...(t.to_account_id && { to_account: n.account.get(t.to_account_id) ?? null }),
    ...(t.category_id && { category: n.category.get(t.category_id) ?? null }),
    ...(loan && { loan: { id: loan.id, title: loan.title, person: n.person.get(loan.person_id) ?? null } }),
    ...(t.recurring_id && { bill: n.bill.get(t.recurring_id) ?? null }),
    note: t.note,
    ...(t.affects_balance === false && { history_only: true }),
    ...(t.receipt_path && { has_receipt_photo: true }),
  }
}

export function loanView(x: Debt, d: Data, n: Names, today: string, withPayments = false) {
  const paid = debtPaid(x, d.transactions)
  const left = debtLeft(x, d.transactions)
  const back = x.direction === 'owed_to_me' ? 'debt_in' : 'debt_out'
  return {
    id: x.id,
    person: n.person.get(x.person_id) ?? null,
    direction: x.direction,
    direction_label: x.direction === 'owed_to_me' ? 'they owe me (I lent it)' : 'I owe them (I borrowed it)',
    title: x.title,
    principal: x.principal,
    paid,
    left,
    started_on: x.started_on,
    due_on: x.due_on,
    ...(x.due_on && !x.closed_at && { due: dueLabel(x.due_on, today) }),
    status: x.closed_at ? (paid >= x.principal - 0.005 ? 'paid' : 'closed (forgiven or settled)') : 'open',
    note: x.note,
    ...(withPayments && {
      payments: d.transactions
        .filter((t) => t.debt_id === x.id && t.kind === back)
        .sort((a, b) => b.occurred_on.localeCompare(a.occurred_on))
        .map((t) => ({ id: t.id, date: t.occurred_on, amount: t.amount, account: n.account.get(t.account_id) ?? null })),
    }),
  }
}

export function billView(r: Tables['recurring'], n: Names, today: string) {
  return {
    id: r.id,
    title: r.title,
    kind: r.kind,
    amount: r.amount,
    repeats: frequencyLabel(r),
    next_due: r.next_due,
    status: r.active ? dueLabel(r.next_due, today) : r.payments_left === 0 ? 'fully paid' : 'paused',
    account: r.account_id ? n.account.get(r.account_id) ?? null : null,
    ...(r.kind === 'transfer' && { card_payment: true, to_card: r.to_account_id ? n.account.get(r.to_account_id) ?? null : null }),
    ...(r.payments_left != null && { payments_left: r.payments_left }),
    category: r.category_id ? n.category.get(r.category_id) ?? null : null,
    note: r.note,
  }
}

export function noteView(x: Note, today: string) {
  return {
    id: x.id,
    body: x.body,
    person: x.person,
    amount: x.amount,
    remind_on: x.remind_on,
    ...(x.remind_on && !x.done_at && x.remind_on <= today && { reminder_due: true }),
    noted_on: x.created_at?.slice(0, 10) ?? null,
    done: Boolean(x.done_at),
  }
}

export function goalView(g: Tables['goals'], d: Data, today: string) {
  const saved = goalSaved(g, d.goal_entries)
  const left = Math.max(0, round2(g.target - saved))
  const months = g.target_on && g.target_on > today ? Math.max(1, Math.ceil(daysBetween(today, g.target_on) / 30.44)) : null
  return {
    id: g.id,
    name: g.name,
    target: g.target,
    saved,
    left,
    pct: Math.round((saved / g.target) * 100),
    target_on: g.target_on,
    ...(months && left > 0 && { per_month_to_reach_it: round2(left / months) }),
    status: g.closed_at ? 'closed' : saved >= g.target ? 'reached' : 'saving',
  }
}

export const accountsView = (d: Data) => {
  const bal = balances(d.accounts, d.transactions)
  return d.accounts
    .filter((a) => !a.archived)
    .sort((a, b) => a.sort - b.sort)
    .map((a) => {
      const balance = bal.get(a.id) ?? 0
      if (a.kind !== 'card') return { id: a.id, name: a.name, kind: a.kind, balance }
      const c = cardStatus(a, balance)
      return { id: a.id, name: a.name, kind: a.kind, balance, owed: c.owed, ...(c.limit != null && { credit_limit: c.limit, left_to_spend: c.left }) }
    })
}

// ---------------------------------------------------------------- read tools

const overview: Tool = {
  name: 'overview',
  title: 'Overview of my money',
  description:
    'Start here. Today\'s date (Philippine time), every account with its balance, this month\'s income, spending, giving and budget left (with a daily allowance), the tithe, bills due within a week or late, money owed either way, savings goals, and KATY\'s notes that are due.',
  inputSchema: obj({}),
  readOnly: true,
  async run(_a, { db, today }) {
    const d = await db.load()
    const n = names(d)
    const month = monthOf(today)
    const totals = monthTotals(d.transactions, month)
    const accounts = accountsView(d)
    const open = d.debts.filter((x) => !x.closed_at)
    const sum = (xs: Debt[]) => round2(xs.reduce((s, x) => s + debtLeft(x, d.transactions), 0))
    const owedToMe = open.filter((x) => x.direction === 'owed_to_me')
    const iOwe = open.filter((x) => x.direction === 'i_owe')
    const bills = d.recurring
      .filter((r) => r.active && r.next_due <= addDays(today, 7))
      .sort((a, b) => a.next_due.localeCompare(b.next_due))
    const notes = d.notes.filter((x) => !x.done_at)
    return {
      today,
      month,
      currency: d.settings.currency,
      total_balance: round2(accounts.reduce((s, a) => s + a.balance, 0)),
      ...(() => {
        const p = moneyPicture(d.accounts.filter((x) => !x.archived), balances(d.accounts, d.transactions))
        return p.owed > 0 ? { money: { in_accounts: p.have, owed_on_cards: p.owed, free_to_use: p.free } } : {}
      })(),
      accounts,
      this_month: {
        income: totals.income,
        spent: totals.spent,
        given: totals.given,
        plan: monthPlan(d.budgets, totals, today, month),
      },
      tithe: tithe(d.transactions, d.categories, month, d.settings.tithe_percent),
      bills_due_within_7_days_or_late: bills.map((r) => billView(r, n, today)),
      loans: {
        owed_to_me: { total_left: sum(owedToMe), count: owedToMe.length },
        i_owe: { total_left: sum(iOwe), count: iOwe.length },
        overdue: open.filter((x) => x.due_on && x.due_on < today).map((x) => loanView(x, d, n, today)),
      },
      goals: d.goals.filter((g) => !g.closed_at).map((g) => goalView(g, d, today)),
      notes: {
        open: notes.length,
        reminders_due: notes.filter((x) => x.remind_on && x.remind_on <= today).map((x) => noteView(x, today)),
      },
    }
  },
}

const getSetup: Tool = {
  name: 'get_setup',
  title: 'Accounts, categories and people',
  description:
    'The names to use when recording: accounts (with balances), spending/income/giving categories, the people in loans, the tithe percentage and the currency. Hidden accounts and categories are listed separately; they keep their history but are not offered for new entries.',
  inputSchema: obj({}),
  readOnly: true,
  async run(_a, { db, today }) {
    const d = await db.load()
    const bal = balances(d.accounts, d.transactions)
    const cats = (k: CategoryKind) => d.categories.filter((c) => c.kind === k && !c.archived).sort((a, b) => a.sort - b.sort).map((c) => ({ id: c.id, name: c.name }))
    const budget = new Map(d.budgets.map((b) => [b.category_id, b.amount]))
    return {
      today,
      currency: d.settings.currency,
      tithe_percent: d.settings.tithe_percent,
      accounts: accountsView(d),
      categories: {
        expense: cats('expense').map((c) => ({ ...c, monthly_budget: budget.get(c.id) ?? null })),
        income: cats('income'),
        giving: cats('giving'),
      },
      people: d.people.map((p) => ({ id: p.id, name: p.name })),
      hidden: {
        accounts: d.accounts.filter((a) => a.archived).map((a) => ({ id: a.id, name: a.name, balance: bal.get(a.id) ?? 0 })),
        categories: d.categories.filter((c) => c.archived).map((c) => ({ id: c.id, name: c.name, kind: c.kind })),
      },
    }
  },
}

const listEntries: Tool = {
  name: 'list_entries',
  title: 'Find entries',
  description:
    'Entries (every movement of money), newest day first and, within a day, in the order the app shows them (arrange_day changes it), with totals for everything that matched. With no dates it covers the current month. Filter by kind, account, category, person (for loans) or words in the note. Capped by "limit"; if "truncated" comes back true, narrow the filters before treating the list as complete (the totals always cover every match).',
  inputSchema: obj({
    from: DATE('First day to include.'),
    to: DATE('Last day to include.'),
    kind: S('Only this kind.', { enum: ['expense', 'income', 'giving', 'transfer', 'loan'] }),
    account: S('Account name or id (matches money leaving or arriving).'),
    category: S('Category name or id.'),
    person: S('Person in a loan.'),
    search: S('Words to look for in the note, category, account, person or bill.'),
    limit: N('How many to return (default 50, at most 200).'),
  }),
  readOnly: true,
  async run(a, { db, today }) {
    const d = await db.load()
    const n = names(d)
    const month = monthOf(today)
    let from = day(a, 'from')
    let to = day(a, 'to')
    if (!from && !to) {
      from = `${month}-01`
      to = endOfMonth(month)
    }
    from ??= '0000-01-01'
    to ??= '9999-12-31'
    if (from > to) throw new ToolError('"from" is after "to".')
    const kind = a.kind == null ? null : oneOf(a, 'kind', ['expense', 'income', 'giving', 'transfer', 'loan'] as const)
    const account = text(a, 'account') ? pickAccount(d, text(a, 'account')!) : null
    const category = text(a, 'category') ? pickCategory(d, text(a, 'category')!) : null
    const person = text(a, 'person')
    const words = text(a, 'search')?.toLowerCase() ?? null
    const max = limit(a, 50, 200)

    const matched = d.transactions
      .filter((t) => t.occurred_on >= from! && t.occurred_on <= to!)
      .filter((t) => !kind || (kind === 'loan' ? t.kind === 'debt_in' || t.kind === 'debt_out' : t.kind === kind))
      .filter((t) => !account || t.account_id === account.id || t.to_account_id === account.id)
      .filter((t) => !category || t.category_id === category.id)
      .filter((t) => {
        if (!person) return true
        const loan = t.debt_id ? n.debt.get(t.debt_id) : undefined
        return Boolean(loan && lower(n.person.get(loan.person_id) ?? '').includes(lower(person)))
      })
      .filter((t) => {
        if (!words) return true
        const loan = t.debt_id ? n.debt.get(t.debt_id) : undefined
        const hay = [t.note, t.category_id && n.category.get(t.category_id), n.account.get(t.account_id), t.to_account_id && n.account.get(t.to_account_id),
          loan?.title, loan && n.person.get(loan.person_id), t.recurring_id && n.bill.get(t.recurring_id)].filter(Boolean).join(' ').toLowerCase()
        return hay.includes(words)
      })
      .sort((x, y) => y.occurred_on.localeCompare(x.occurred_on) || withinDay(x, y))

    const total = (k: Tx['kind']) => round2(matched.filter((t) => t.kind === k).reduce((s, t) => s + t.amount, 0))
    return {
      from: from === '0000-01-01' ? null : from,
      to: to === '9999-12-31' ? null : to,
      matched: matched.length,
      ...(matched.some((t) => t.affects_balance === false) && { history_only_entries: matched.filter((t) => t.affects_balance === false).length }),
      truncated: matched.length > max,
      totals: { income: total('income'), spent: total('expense'), given: total('giving'), transferred: total('transfer'), loan_money_out: total('debt_out'), loan_money_in: total('debt_in') },
      entries: matched.slice(0, max).map((t) => entryView(t, n)),
    }
  },
}

const spendingReport: Tool = {
  name: 'spending_report',
  title: 'Month report',
  description:
    'One month by category: what was spent against each budget (and categories without a budget), income, giving, the tithe, and the same totals for the month before. Defaults to the current month.',
  inputSchema: obj({ month: S('The month, YYYY-MM.', { pattern: '^\\d{4}-\\d{2}$' }) }),
  readOnly: true,
  async run(a, { db, today }) {
    const d = await db.load()
    const month = text(a, 'month') ?? monthOf(today)
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new ToolError('"month" should look like 2026-11.')
    const totals = monthTotals(d.transactions, month)
    const prev = monthTotals(d.transactions, shiftMonth(month, -1))
    const budget = new Map(d.budgets.map((b) => [b.category_id, b.amount]))
    const rows = d.categories
      .filter((c) => c.kind !== 'income' && (budget.has(c.id) || totals.byCategory.has(c.id)))
      .sort((x, y) => (x.kind === y.kind ? x.sort - y.sort : x.kind === 'expense' ? -1 : 1))
      .map((c) => {
        const spent = round2(totals.byCategory.get(c.id) ?? 0)
        const b = budget.get(c.id) ?? null
        return {
          category: c.name,
          kind: c.kind,
          spent,
          last_month: round2(prev.byCategory.get(c.id) ?? 0),
          budget: b,
          ...(b != null && { left: round2(b - spent), pct_used: Math.round((spent / b) * 100), over_budget: spent > b }),
        }
      })
    const uncategorised = round2(d.transactions.filter((t) => monthOf(t.occurred_on) === month && t.kind === 'expense' && !t.category_id).reduce((s, t) => s + t.amount, 0))
    return {
      month,
      income: totals.income,
      spent: totals.spent,
      given: totals.given,
      last_month: { income: prev.income, spent: prev.spent, given: prev.given },
      plan: monthPlan(d.budgets, totals, today, month),
      tithe: tithe(d.transactions, d.categories, month, d.settings.tithe_percent),
      by_category: rows,
      ...(uncategorised > 0 && { spent_without_category: uncategorised }),
      income_by_category: d.categories
        .filter((c) => c.kind === 'income' && totals.byCategory.has(c.id))
        .map((c) => ({ category: c.name, amount: round2(totals.byCategory.get(c.id)!) })),
    }
  },
}

const listBills: Tool = {
  name: 'list_bills',
  title: 'Bills and regular income',
  description:
    'Recurring bills, subscriptions and regular income, soonest first, with how many days until each is due or how late it is. By default: active ones due within 30 days (late ones included). Use the id with pay_bill.',
  inputSchema: obj({
    within_days: N('Look this many days ahead (default 30).'),
    all: { type: 'boolean', description: 'Every bill, whatever its date, paused ones included.' },
  }),
  readOnly: true,
  async run(a, { db, today }) {
    const d = await db.load()
    const n = names(d)
    const days = typeof a.within_days === 'number' && a.within_days >= 0 ? Math.min(a.within_days, 366) : 30
    const until = addDays(today, days)
    const rows = d.recurring
      .filter((r) => a.all === true || (r.active && r.next_due <= until))
      .sort((x, y) => Number(y.active) - Number(x.active) || x.next_due.localeCompare(y.next_due))
    return { today, bills: rows.map((r) => billView(r, n, today)), total_due: round2(rows.filter((r) => r.active && r.kind !== 'income' && r.next_due <= until).reduce((s, r) => s + r.amount, 0)) }
  },
}

const listLoans: Tool = {
  name: 'list_loans',
  title: 'Loans and who owes whom',
  description:
    'Money lent and borrowed: who, which way, the amount, what has been paid back, what is left and when it is due, with each payment. Open loans by default.',
  inputSchema: obj({
    status: S('Which loans (default open).', { enum: ['open', 'closed', 'all'] }),
    person: S('Only loans with this person.'),
  }),
  readOnly: true,
  async run(a, { db, today }) {
    const d = await db.load()
    const n = names(d)
    const status = oneOf(a, 'status', ['open', 'closed', 'all'] as const, 'open')
    const person = text(a, 'person')
    const rows = d.debts
      .filter((x) => status === 'all' || (status === 'open' ? !x.closed_at : Boolean(x.closed_at)))
      .filter((x) => !person || lower(n.person.get(x.person_id) ?? '').includes(lower(person)))
      .sort((x, y) => (x.due_on ?? '9999').localeCompare(y.due_on ?? '9999') || y.started_on.localeCompare(x.started_on))
    const left = (dir: Debt['direction']) => round2(rows.filter((x) => x.direction === dir).reduce((s, x) => s + debtLeft(x, d.transactions), 0))
    return {
      owed_to_me_left: left('owed_to_me'),
      i_owe_left: left('i_owe'),
      loans: rows.map((x) => loanView(x, d, n, today, true)),
    }
  },
}

const listGoals: Tool = {
  name: 'list_goals',
  title: 'Savings goals',
  description: 'Savings goals with what has been set aside, what is left, and how much a month would reach the target date. Use the id with add_to_goal.',
  inputSchema: obj({ include_closed: { type: 'boolean', description: 'Include closed goals.' } }),
  readOnly: true,
  async run(a, { db, today }) {
    const d = await db.load()
    return {
      goals: d.goals
        .filter((g) => a.include_closed === true || !g.closed_at)
        .map((g) => ({
          ...goalView(g, d, today),
          recent: d.goal_entries
            .filter((e) => e.goal_id === g.id)
            .sort((x, y) => y.occurred_on.localeCompare(x.occurred_on))
            .slice(0, 5)
            .map((e) => ({ date: e.occurred_on, amount: e.amount, note: e.note })),
        })),
    }
  },
}

const listNotes: Tool = {
  name: 'list_notes',
  title: 'KATY\'s notes',
  description:
    'Things the person asked KATY (the app\'s companion) to remember without moving money: a request for help, a promise, something to decide later. Open notes by default; "reminder_due" marks ones whose day has come.',
  inputSchema: obj({
    status: S('Which notes (default open).', { enum: ['open', 'done', 'all'] }),
    search: S('Words or a person to look for.'),
  }),
  readOnly: true,
  async run(a, { db, today }) {
    const d = await db.load()
    const status = oneOf(a, 'status', ['open', 'done', 'all'] as const, 'open')
    const words = text(a, 'search')?.toLowerCase()
    return {
      notes: d.notes
        .filter((x) => status === 'all' || (status === 'open' ? !x.done_at : Boolean(x.done_at)))
        .filter((x) => !words || `${x.body} ${x.person ?? ''}`.toLowerCase().includes(words))
        .sort((x, y) => (y.created_at ?? '').localeCompare(x.created_at ?? ''))
        .map((x) => noteView(x, today)),
    }
  },
}

// ---------------------------------------------------------------- write tools

const addEntry: Tool = {
  name: 'add_entry',
  title: 'Record an entry',
  description:
    'Record money spent (expense), received (income), given to church or others (giving: tithes, offerings, missions, help), or moved between the person\'s own accounts (transfer). For loans use record_loan, for a bill use pay_bill. Account and category take a name or an id (see get_setup). For past entries the balances already include, set history_only. Returns exactly what was saved.',
  inputSchema: obj({
    kind: S('What happened.', { enum: ['expense', 'income', 'giving', 'transfer'] }),
    amount: N('Pesos, more than zero.'),
    account: S('Account the money left (or arrived in, for income).'),
    to_account: S('Transfers only: the account it went to.'),
    category: S('A category of the same kind. Left out: "Other" when that kind has one.'),
    date: DATE('When it happened (default today).'),
    note: S('Short label, like "Lunch at Jollibee".', { maxLength: 200 }),
    history_only: HISTORY_ONLY,
  }, ['kind', 'amount', 'account']),
  readOnly: false,
  async run(a, { db, today }) {
    const d = await db.load()
    const kind = oneOf(a, 'kind', ['expense', 'income', 'giving', 'transfer'] as const)
    const amount = money(a, 'amount', { required: true })!
    const account = pickAccount(d, text(a, 'account', { required: true })!)
    const occurred_on = day(a, 'date', today)!
    const note = text(a, 'note', { max: 200 })
    const row: Partial<Tx> = { kind, amount, occurred_on, account_id: account.id, note, to_account_id: null, category_id: null, debt_id: null, recurring_id: null, ...historyRow(a) }
    let to: Account | null = null
    let cat: Category | null = null
    if (kind === 'transfer') {
      to = pickAccount(d, text(a, 'to_account', { required: true })!, 'to_account')
      if (to.id === account.id) throw new ToolError('A transfer needs two different accounts.')
      row.to_account_id = to.id
    } else {
      const ref = text(a, 'category')
      cat = ref ? pickCategory(d, ref, kind) : d.categories.find((c) => c.kind === kind && !c.archived && lower(c.name) === 'other') ?? null
      row.category_id = cat?.id ?? null
    }
    const saved = await db.insert('transactions', row)
    const after = balances(d.accounts, [...d.transactions, saved])
    const balance = { [account.name]: after.get(account.id), ...(to && { [to.name]: after.get(to.id) }) }
    return {
      recorded: entryView(saved, names(d)),
      ...(saved.affects_balance === false ? { history_only: 'counted in totals; balances unchanged', balance_now: balance } : { balance_after: balance }),
    }
  },
}

const updateEntry: Tool = {
  name: 'update_entry',
  title: 'Correct an entry',
  description:
    'Fix a mistake in an entry found with list_entries: its amount, date, account, category, note, or whether it is history only (history_only: true stops it moving a balance; false makes it count again). The kind can\'t change; to change it, delete_entry and record it again.',
  inputSchema: obj({
    id: S('The entry\'s id.'),
    amount: N('New amount in pesos.'),
    date: DATE('New date.'),
    account: S('New account (name or id).'),
    to_account: S('Transfers only: new destination account.'),
    category: S('New category of the same kind (name or id).'),
    note: S('New note; an empty string clears it.', { maxLength: 200 }),
    history_only: HISTORY_ONLY,
  }, ['id']),
  readOnly: false,
  async run(a, { db }) {
    const d = await db.load()
    const t = d.transactions.find((x) => x.id === text(a, 'id', { required: true }))
    if (!t) throw new ToolError('No entry with that id. Find it with list_entries.')
    const patch: Partial<Tx> = {}
    const amount = money(a, 'amount')
    if (amount != null) {
      if (t.debt_id) throw new ToolError('This entry belongs to a loan; delete it with delete_entry and record the payment again with record_loan_payment (or change the loan with update_loan), so the loan\'s balance stays right.')
      patch.amount = amount
    }
    const date = day(a, 'date')
    if (date) patch.occurred_on = date
    // moved to another day: it joins that day's top until it's arranged there, as in the app
    if (date && date !== t.occurred_on && t.day_order != null) patch.day_order = null
    if (text(a, 'account')) patch.account_id = pickAccount(d, text(a, 'account')!).id
    if (text(a, 'to_account')) {
      if (t.kind !== 'transfer') throw new ToolError('Only transfers have a "to_account".')
      patch.to_account_id = pickAccount(d, text(a, 'to_account')!, 'to_account').id
    }
    if (t.kind === 'transfer' && (patch.account_id ?? t.account_id) === (patch.to_account_id ?? t.to_account_id)) throw new ToolError('A transfer needs two different accounts.')
    if (text(a, 'category')) {
      if (t.kind !== 'expense' && t.kind !== 'income' && t.kind !== 'giving') throw new ToolError(`A ${KIND_LABEL[t.kind]} has no category.`)
      patch.category_id = pickCategory(d, text(a, 'category')!, t.kind).id
    }
    if (typeof a.note === 'string') patch.note = text(a, 'note', { max: 200 })
    const history = flag(a, 'history_only')
    if (history != null) patch.affects_balance = !history
    if (!Object.keys(patch).length) throw new ToolError('Nothing to change: give at least one of amount, date, account, to_account, category, note or history_only.')
    const saved = await db.update('transactions', t.id, patch)
    const n = names(d)
    const balancesMoved = ['amount', 'account_id', 'to_account_id', 'affects_balance'].some((k) => k in patch)
    if (!balancesMoved) return { before: entryView(t, n), after: entryView(saved, n) }
    const bal = balances(d.accounts, d.transactions.map((x) => (x.id === t.id ? saved : x)))
    const touched = [...new Set([t.account_id, t.to_account_id, saved.account_id, saved.to_account_id])].filter(Boolean) as string[]
    return { before: entryView(t, n), after: entryView(saved, n), balances_now: Object.fromEntries(touched.map((id) => [n.account.get(id) ?? id, bal.get(id) ?? 0])) }
  },
}

const payBill: Tool = {
  name: 'pay_bill',
  title: 'Mark a bill paid',
  description:
    'Record a bill (or regular income) as paid or received, the way the app\'s "Mark paid" does: it saves the entry and moves the bill to its next due date. A card payment records a transfer from the paying account to the card. A bill with payments_left counts down, and the last payment finishes it. Amount and account default to the bill\'s own.',
  inputSchema: obj({
    bill: S('The bill\'s id (from list_bills) or its exact title.'),
    account: S('Account it was paid from (default: the bill\'s account).'),
    amount: N('Amount actually paid, if different this time.'),
    date: DATE('When it was paid (default today).'),
    history_only: HISTORY_ONLY,
  }, ['bill']),
  readOnly: false,
  async run(a, { db, today }) {
    const d = await db.load()
    const bill = pickById(d.recurring, text(a, 'bill'), 'bill', (r) => r.title, 'list_bills')
    if (!bill.active) {
      throw new ToolError(bill.payments_left === 0
        ? `"${bill.title}" is fully paid. If more payments came up, give it payments_left with update_bill first.`
        : `"${bill.title}" is paused; resume it with update_bill (paused: false) first.`)
    }
    const card = bill.kind === 'transfer'
    const ref = text(a, 'account')
    const account = ref ? pickAccount(d, ref) : d.accounts.find((x) => x.id === bill.account_id) ?? d.accounts.find((x) => !x.archived && x.id !== bill.to_account_id)
    if (!account) throw new ToolError('Add an account first (add_account), so Manna knows where the money came from.')
    if (card && (!bill.to_account_id || bill.to_account_id === account.id)) throw new ToolError('A card payment needs a card (to_card on update_bill) and a different account to pay from.')
    const saved = await db.insert('transactions', {
      kind: bill.kind,
      amount: money(a, 'amount') ?? bill.amount,
      occurred_on: day(a, 'date', today)!,
      account_id: account.id,
      to_account_id: card ? bill.to_account_id! : null,
      category_id: card ? null : bill.category_id,
      debt_id: null,
      recurring_id: bill.id,
      note: bill.title,
      ...historyRow(a),
    })
    const next = nextDue(bill)
    const left = bill.payments_left == null ? null : Math.max(0, bill.payments_left - 1)
    await db.update('recurring', bill.id, { next_due: next, ...(left != null && { payments_left: left }), ...(left === 0 && { active: false }) })
    return {
      recorded: entryView(saved, names(d)),
      bill: bill.title,
      was_due: bill.next_due,
      ...(left === 0 ? { finished: 'that was the last payment; the bill is fully paid and stops reminding' } : { next_due: next }),
      ...(left != null && left > 0 && { payments_left: left }),
    }
  },
}

const recordLoan: Tool = {
  name: 'record_loan',
  title: 'Record a loan',
  description:
    'A new loan either way: "lent" when the person gave someone money to pay back, "borrowed" when someone lent to them. Adds the other person if they are new. With an account, it also records the money leaving (lent) or arriving (borrowed); with history_only too, that entry is kept for the record without changing the balance (the balance already reflects it). Leave the account out only for an old loan whose money was never in a tracked account.',
  inputSchema: obj({
    direction: S('Which way.', { enum: ['lent', 'borrowed'] }),
    person: S('The other person\'s name.', { maxLength: 60 }),
    amount: N('Pesos.'),
    account: S('Account the money left or arrived in.'),
    title: S('Short label (default "Loan to <name>" / "Borrowed from <name>").', { maxLength: 80 }),
    date: DATE('When it happened (default today).'),
    due_on: DATE('When it should be paid back, if agreed.'),
    note: S('Anything else worth keeping.', { maxLength: 300 }),
    history_only: HISTORY_ONLY,
  }, ['direction', 'person', 'amount']),
  readOnly: false,
  async run(a, { db, today }) {
    const d = await db.load()
    const direction = oneOf(a, 'direction', ['lent', 'borrowed'] as const)
    const who = text(a, 'person', { required: true, max: 60 })!
    const amount = money(a, 'amount', { required: true })!
    const account = text(a, 'account') ? pickAccount(d, text(a, 'account')!) : null
    const history = historyRow(a)
    if (!account && 'affects_balance' in history) throw new ToolError('"history_only" needs an account: it marks the money movement, and without an account none is recorded.')
    const started_on = day(a, 'date', today)!
    const due_on = day(a, 'due_on')
    if (due_on && due_on < started_on) throw new ToolError('"due_on" is before the loan started.')
    const title = text(a, 'title', { max: 80 }) ?? (direction === 'lent' ? `Loan to ${who}` : `Borrowed from ${who}`)
    let person = d.people.find((p) => lower(p.name) === lower(who))
    const newPerson = !person
    if (!person) person = await db.insert('people', { name: who, note: null })
    const debt = await db.insert('debts', {
      person_id: person.id,
      direction: direction === 'lent' ? 'owed_to_me' : 'i_owe',
      title,
      principal: amount,
      started_on,
      due_on,
      note: text(a, 'note', { max: 300 }),
      closed_at: null,
    })
    let entry: Tx | null = null
    if (account) {
      entry = await db.insert('transactions', {
        kind: direction === 'lent' ? 'debt_out' : 'debt_in',
        amount,
        occurred_on: started_on,
        account_id: account.id,
        to_account_id: null,
        category_id: null,
        debt_id: debt.id,
        recurring_id: null,
        note: title,
        ...history,
      })
    }
    const all = { ...d, people: newPerson ? [...d.people, person] : d.people, debts: [...d.debts, debt], transactions: entry ? [...d.transactions, entry] : d.transactions }
    return {
      recorded: loanView(debt, all, names(all), today),
      ...(newPerson && { added_person: person.name }),
      money_moved: entry ? entryView(entry, names(all)) : 'no account given, so no money movement was recorded',
    }
  },
}

const recordLoanPayment: Tool = {
  name: 'record_loan_payment',
  title: 'Record a loan payment',
  description:
    'Money paid back on a loan, either to the person (they repaid what they borrowed) or by them (they repaid someone). The loan closes itself once nothing is left. Use the loan id from list_loans.',
  inputSchema: obj({
    loan: S('The loan\'s id (from list_loans).'),
    amount: N('Pesos paid back this time.'),
    account: S('Account the money arrived in (repaid to me) or left (I repaid).'),
    date: DATE('When (default today).'),
    history_only: HISTORY_ONLY,
  }, ['loan', 'amount', 'account']),
  readOnly: false,
  async run(a, { db, today }) {
    const d = await db.load()
    const loan = pickById(d.debts, text(a, 'loan'), 'loan', (x) => x.title, 'list_loans')
    if (loan.closed_at) throw new ToolError(`"${loan.title}" is already closed. Reopen it with update_loan (closed: false) if more money changed hands.`)
    const amount = money(a, 'amount', { required: true })!
    const left = debtLeft(loan, d.transactions)
    if (amount > left + 0.005) throw new ToolError(`Only ₱${left} is left on "${loan.title}". Record ₱${left} or less, or record the extra separately.`)
    const account = pickAccount(d, text(a, 'account', { required: true })!)
    const entry = await db.insert('transactions', {
      kind: loan.direction === 'owed_to_me' ? 'debt_in' : 'debt_out',
      amount,
      occurred_on: day(a, 'date', today)!,
      account_id: account.id,
      to_account_id: null,
      category_id: null,
      debt_id: loan.id,
      recurring_id: null,
      note: loan.title,
      ...historyRow(a),
    })
    let closed = loan
    if (left - amount <= 0.005) closed = await db.update('debts', loan.id, { closed_at: new Date().toISOString() })
    const all = { ...d, debts: d.debts.map((x) => (x.id === loan.id ? closed : x)), transactions: [...d.transactions, entry] }
    return { recorded: entryView(entry, names(all)), loan: loanView(closed, all, names(all), today) }
  },
}

const addToGoal: Tool = {
  name: 'add_to_goal',
  title: 'Add to a savings goal',
  description: 'Set money aside for a savings goal, or take some back out with a negative amount. This only tracks the goal; it doesn\'t move money between accounts (use a transfer for that).',
  inputSchema: obj({
    goal: S('The goal\'s id (from list_goals) or its exact name.'),
    amount: N('Pesos to add; negative to take out.'),
    date: DATE('When (default today).'),
    note: S('Optional note.', { maxLength: 200 }),
  }, ['goal', 'amount']),
  readOnly: false,
  async run(a, { db, today }) {
    const d = await db.load()
    const goal = pickById(d.goals, text(a, 'goal'), 'goal', (g) => g.name, 'list_goals')
    if (goal.closed_at) throw new ToolError(`"${goal.name}" is closed.`)
    const amount = money(a, 'amount', { required: true, allowNegative: true })!
    const saved = goalSaved(goal, d.goal_entries)
    if (amount < 0 && -amount > saved + 0.005) throw new ToolError(`Only ₱${saved} is set aside for "${goal.name}".`)
    const entry = await db.insert('goal_entries', { goal_id: goal.id, amount, occurred_on: day(a, 'date', today)!, note: text(a, 'note', { max: 200 }) })
    return { recorded: { goal: goal.name, amount: entry.amount, date: entry.occurred_on, note: entry.note }, goal: goalView(goal, { ...d, goal_entries: [...d.goal_entries, entry] }, today) }
  },
}

const addNote: Tool = {
  name: 'add_note',
  title: 'Note something for KATY',
  description:
    'Keep something in mind without moving money, the way telling KATY "take note…" does: someone asked for help or a loan and it isn\'t decided, a promise, a reminder. It shows on the app\'s Today screen on its reminder day.',
  inputSchema: obj({
    body: S('The thing to remember, in the person\'s words, tidied.', { maxLength: 500 }),
    person: S('Who it\'s about, if anyone.', { maxLength: 60 }),
    amount: N('Pesos, if an amount was mentioned.'),
    remind_on: DATE('Day to bring it up again.'),
  }, ['body']),
  readOnly: false,
  async run(a, { db, today }) {
    const saved = await db.insert('notes', {
      body: text(a, 'body', { required: true, max: 500 })!,
      person: text(a, 'person', { max: 60 }),
      amount: money(a, 'amount'),
      remind_on: day(a, 'remind_on'),
      done_at: null,
    })
    return { recorded: noteView(saved, today) }
  },
}

const updateNote: Tool = {
  name: 'update_note',
  title: 'Update or settle a note',
  description: 'Tick a note off once it\'s settled (done: true), reopen it, move its reminder day, or reword it.',
  inputSchema: obj({
    id: S('The note\'s id (from list_notes).'),
    done: { type: 'boolean', description: 'true once settled or no longer needed; false to reopen.' },
    remind_on: S('New reminder day YYYY-MM-DD, or an empty string to clear it.'),
    body: S('New wording.', { maxLength: 500 }),
  }, ['id']),
  readOnly: false,
  async run(a, { db, today }) {
    const d = await db.load()
    const note = d.notes.find((x) => x.id === text(a, 'id', { required: true }))
    if (!note) throw new ToolError('No note with that id. Find it with list_notes.')
    const patch: Partial<Note> = {}
    if (typeof a.done === 'boolean') patch.done_at = a.done ? (note.done_at ?? new Date().toISOString()) : null
    if (a.remind_on === '' || a.remind_on === null) patch.remind_on = null
    else if (a.remind_on != null) patch.remind_on = day(a, 'remind_on')
    if (a.body != null) patch.body = text(a, 'body', { required: true, max: 500 })!
    if (!Object.keys(patch).length) throw new ToolError('Nothing to change: give done, remind_on or body.')
    const saved = await db.update('notes', note.id, patch)
    return { before: noteView(note, today), after: noteView(saved, today) }
  },
}

export const TOOLS: Tool[] = [
  overview, getSetup, listEntries, spendingReport, listBills, listLoans, listGoals, listNotes,
  addEntry, updateEntry, payBill, recordLoan, recordLoanPayment, addToGoal, addNote, updateNote,
]
