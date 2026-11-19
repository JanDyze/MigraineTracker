// Manna's rows, dates and money maths for the MCP server. A port of app/src/lib/{types,dates,money}.ts, so
// Claude sees the same balances, budgets, tithe and loan figures as the app. Keep the two in step.

export type AccountKind = 'cash' | 'bank' | 'ewallet' | 'card' | 'savings'
export type CategoryKind = 'expense' | 'income' | 'giving'
export type TxKind = CategoryKind | 'transfer' | 'debt_out' | 'debt_in'
export type Frequency = 'weekly' | 'monthly' | 'yearly'
export type Direction = 'owed_to_me' | 'i_owe'

export type Settings = { user_id: string; currency: string; tithe_percent: number; onboarded_at: string | null }
export type Account = { id: string; name: string; kind: AccountKind; opening_balance: number; sort: number; archived: boolean }
export type Category = { id: string; name: string; kind: CategoryKind; icon: string; sort: number; archived: boolean }
export type Budget = { id: string; category_id: string; amount: number }
export type Person = { id: string; name: string; note: string | null }
export type Debt = {
  id: string; person_id: string; direction: Direction; title: string; principal: number
  started_on: string; due_on: string | null; note: string | null; closed_at: string | null
}
export type Goal = { id: string; name: string; target: number; target_on: string | null; icon: string; closed_at: string | null }
export type GoalEntry = { id: string; goal_id: string; amount: number; occurred_on: string; note: string | null }
/** A bill's kind: a category kind, or 'transfer' for a card payment (bank or e-wallet → card / pay-later account) */
export type BillKind = CategoryKind | 'transfer'
export type Recurring = {
  id: string; title: string; kind: BillKind; amount: number; account_id: string | null; category_id: string | null
  frequency: Frequency; every: number; next_due: string; active: boolean; note: string | null
  /** card payments: the card or pay-later account the money goes to */
  to_account_id?: string | null
  /** payments still to make; counts down when paid and the bill finishes at 0. null = it doesn't end */
  payments_left?: number | null
}
export type Tx = {
  id: string; kind: TxKind; amount: number; occurred_on: string; account_id: string; to_account_id: string | null
  category_id: string | null; debt_id: string | null; recurring_id: string | null; note: string | null
  receipt_path?: string | null; created_at?: string
  /** false = history only: counted in totals, budgets and the tithe, but not in account balances */
  affects_balance?: boolean
  /** place within its day once arranged (1 = top); null = never arranged */
  day_order?: number | null
}

/** Order inside one day, as the app shows it (app/src/lib/money.ts withinDay): entries never arranged come first,
 * newest first, then the arranged ones in their set order. */
export function withinDay(a: Tx, b: Tx): number {
  const ao = a.day_order ?? null
  const bo = b.day_order ?? null
  if (ao === null && bo === null) return (b.created_at ?? '').localeCompare(a.created_at ?? '')
  if (ao === null) return -1
  if (bo === null) return 1
  return ao - bo || (b.created_at ?? '').localeCompare(a.created_at ?? '')
}
export type Note = {
  id: string; body: string; person: string | null; amount: number | null; remind_on: string | null; done_at: string | null
  image_path?: string | null; created_at?: string
}

export type BalanceCheck = {
  id: string; checked_on: string; month: string; account_id: string; recorded: number; actual: number
  adjustment_id: string | null; note: string | null
}

export type Tables = {
  accounts: Account; categories: Category; budgets: Budget; people: Person; debts: Debt; goals: Goal
  goal_entries: GoalEntry; recurring: Recurring; transactions: Tx; notes: Note; balance_checks: BalanceCheck
}
export type TableName = keyof Tables
export type Data = { settings: Settings } & { [T in TableName]: Tables[T][] }
export const TABLES: TableName[] = ['accounts', 'categories', 'budgets', 'people', 'debts', 'goals', 'goal_entries', 'recurring', 'transactions', 'notes', 'balance_checks']

// Postgres numeric arrives as a string; keep money as numbers everywhere.
const MONEY = ['opening_balance', 'amount', 'principal', 'target', 'tithe_percent', 'recorded', 'actual'] as const
export function clean<T>(row: T): T {
  const r = { ...(row as Record<string, unknown>) }
  for (const k of MONEY) if (k in r && r[k] != null) r[k] = Number(r[k])
  return r as T
}

export const round2 = (n: number) => Math.round(n * 100) / 100

// ---- dates: calendar days as 'YYYY-MM-DD', worked in UTC so the server's own zone never matters ----

const pad = (n: number) => String(n).padStart(2, '0')
const toISO = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
const fromISO = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

/** Today where the person lives (Manna is used in the Philippines). */
export function todayIn(tz: string, now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

export function isDate(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  return toISO(fromISO(s)) === s
}

export function addDays(s: string, n: number): string {
  const d = fromISO(s)
  d.setUTCDate(d.getUTCDate() + n)
  return toISO(d)
}

/** Add months, keeping the day but clamping to the month's end (Jan 31 + 1 month = Feb 28). */
export function addMonths(s: string, n: number): string {
  const d = fromISO(s)
  const day = d.getUTCDate()
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() + n)
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  d.setUTCDate(Math.min(day, last))
  return toISO(d)
}

export const daysBetween = (a: string, b: string) => Math.round((fromISO(b).getTime() - fromISO(a).getTime()) / 86_400_000)
export const monthOf = (s: string) => s.slice(0, 7)
export const shiftMonth = (month: string, n: number) => monthOf(addMonths(`${month}-01`, n))
export const endOfMonth = (month: string) => addDays(addMonths(`${month}-01`, 1), -1)

/** Days left in the month, counting today. */
export function daysLeftInMonth(s: string): number {
  const d = fromISO(s)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate() - d.getUTCDate() + 1
}

/** "due today", "in 3 days", "2 days late". */
export function dueLabel(s: string, today: string): string {
  const n = daysBetween(today, s)
  if (n === 0) return 'due today'
  if (n === 1) return 'due tomorrow'
  if (n > 1) return `in ${n} days`
  return n === -1 ? '1 day late' : `${-n} days late`
}

// ---- money ----

/** Whether an entry moves money in an account. History-only entries (affects_balance = false) don't. */
export const movesBalance = (t: Pick<Tx, 'affects_balance'>) => t.affects_balance !== false

/** How each kind of transaction moves an account's balance. History-only entries are skipped. */
export function balances(accounts: Account[], txs: Tx[]): Map<string, number> {
  const bal = new Map(accounts.map((a) => [a.id, Number(a.opening_balance)]))
  const add = (id: string | null, n: number) => {
    if (id && bal.has(id)) bal.set(id, round2(bal.get(id)! + n))
  }
  for (const t of txs) {
    if (!movesBalance(t)) continue
    switch (t.kind) {
      case 'income':
      case 'debt_in':
        add(t.account_id, t.amount)
        break
      case 'expense':
      case 'giving':
      case 'debt_out':
        add(t.account_id, -t.amount)
        break
      case 'transfer':
        add(t.account_id, -t.amount)
        add(t.to_account_id, t.amount)
        break
    }
  }
  return bal
}

export type MonthTotals = { income: number; spent: number; given: number; byCategory: Map<string, number> }

export function monthTotals(txs: Tx[], month: string): MonthTotals {
  const out: MonthTotals = { income: 0, spent: 0, given: 0, byCategory: new Map() }
  for (const t of txs) {
    if (monthOf(t.occurred_on) !== month) continue
    if (t.kind === 'income') out.income += t.amount
    else if (t.kind === 'expense') out.spent += t.amount
    else if (t.kind === 'giving') out.given += t.amount
    else continue
    if (t.category_id) out.byCategory.set(t.category_id, (out.byCategory.get(t.category_id) ?? 0) + t.amount)
  }
  out.income = round2(out.income)
  out.spent = round2(out.spent)
  out.given = round2(out.given)
  return out
}

/** The month's spending plan: budget total, spent, and a daily allowance for the days left. */
export function monthPlan(budgets: Budget[], totals: MonthTotals, today: string, month: string) {
  const total = round2(budgets.reduce((s, b) => s + b.amount, 0))
  const spent = totals.spent
  const left = round2(total - spent)
  const days = month === monthOf(today) ? daysLeftInMonth(today) : 0
  return { budget_total: total, spent, left, days_left: days, per_day_left: left > 0 && days > 0 ? round2(left / days) : 0, pct_used: total > 0 ? Math.round((spent / total) * 100) : 0 }
}

export function debtPaid(debt: Debt, txs: Tx[]): number {
  const back = debt.direction === 'owed_to_me' ? 'debt_in' : 'debt_out'
  return round2(txs.filter((t) => t.debt_id === debt.id && t.kind === back).reduce((s, t) => s + t.amount, 0))
}

export const debtLeft = (debt: Debt, txs: Tx[]) => (debt.closed_at ? 0 : Math.max(0, round2(debt.principal - debtPaid(debt, txs))))

export const goalSaved = (goal: Goal, entries: GoalEntry[]) =>
  round2(entries.filter((e) => e.goal_id === goal.id).reduce((s, e) => s + e.amount, 0))

/** The date after this one for a recurring bill. */
export function nextDue(r: Pick<Recurring, 'next_due' | 'frequency' | 'every'>): string {
  if (r.frequency === 'weekly') return addDays(r.next_due, 7 * r.every)
  if (r.frequency === 'yearly') return addMonths(r.next_due, 12 * r.every)
  return addMonths(r.next_due, r.every)
}

export function frequencyLabel(r: Pick<Recurring, 'frequency' | 'every'>): string {
  const unit = { weekly: 'week', monthly: 'month', yearly: 'year' }[r.frequency]
  return r.every === 1 ? `every ${unit}` : `every ${r.every} ${unit}s`
}

/** Tithe: a share of the month's income, against what was given in a "Tithe" category (or all giving if none). */
export function tithe(txs: Tx[], categories: Category[], month: string, percent: number) {
  const totals = monthTotals(txs, month)
  const titheCats = new Set(categories.filter((c) => c.kind === 'giving' && /tithe/i.test(c.name)).map((c) => c.id))
  const given = titheCats.size
    ? round2(txs.filter((t) => t.kind === 'giving' && monthOf(t.occurred_on) === month && t.category_id && titheCats.has(t.category_id)).reduce((s, t) => s + t.amount, 0))
    : totals.given
  const due = round2((totals.income * percent) / 100)
  return { percent, income: totals.income, due, given, left: Math.max(0, round2(due - given)), done: due > 0 && given >= due - 0.005, other_giving: round2(totals.given - given) }
}
