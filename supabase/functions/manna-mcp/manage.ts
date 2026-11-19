// Everything else the app can do, so Claude has the same reach as the person holding the phone: set up and change
// accounts, categories, budgets, bills, people, loans, goals and settings, run the month-end check, look at receipt
// photos, manage connector links, and delete anything. The friendly everyday tools (add_entry, pay_bill…) live in
// tools.ts; these build on the same helpers and the same Db, so every row stays pinned to the key's owner.
import {
  type Account, type AccountKind, type BalanceCheck, type BillKind, type Category, type CategoryKind, type Data, type Debt, type Frequency,
  type Goal, type Recurring, type Tx, balances, cardStatus, debtPaid, goalSaved, isDate, monthOf, round2, shiftMonth, withinDay,
} from './money.ts'
import {
  type Args, type Tool, DATE, N, S, ToolError, billView, day, entryView, goalView, loanView, lower, money, names,
  noteView, obj, oneOf, pickAccount, pickById, pickCategory, text,
} from './tools.ts'

const B = (description: string) => ({ type: 'boolean', description })
const ACCOUNT_KINDS = ['cash', 'bank', 'ewallet', 'card', 'savings'] as const
const CATEGORY_KINDS = ['expense', 'income', 'giving'] as const
const FREQUENCIES = ['weekly', 'monthly', 'yearly'] as const
// the icons the app can draw (app/src/components/Glyph.tsx PICKABLE)
const ICONS = ['food', 'coffee', 'transport', 'bolt', 'home', 'basket', 'heart', 'people', 'bag', 'spark', 'repeat', 'school', 'phone', 'gift', 'plane', 'laptop', 'shield', 'piggy', 'briefcase', 'tool', 'wheat', 'envelope', 'globe', 'hands', 'wallet', 'bank', 'card', 'dot', 'jar'] as const
const ICON = (fallback: string) => S(`Icon (default "${fallback}").`, { enum: [...ICONS] })

const now = () => new Date().toISOString()
const has = (a: Args, key: string) => a[key] !== undefined
/** A nullable field: an empty string or null clears it. */
const clears = (a: Args, key: string) => a[key] === '' || a[key] === null

function whole(a: Args, key: string, min: number, max: number): number | null {
  const v = a[key]
  if (v == null || v === '') return null
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) throw new ToolError(`"${key}" should be a whole number from ${min} to ${max}.`)
  return v
}

/** Pesos that may be zero or negative (opening balances, card debt). */
function signed(a: Args, key: string): number | null {
  const v = a[key]
  if (v === 0 || v === '0') return 0
  return money(a, key, { allowNegative: true })
}

function bool(a: Args, key: string): boolean | null {
  const v = a[key]
  if (v == null) return null
  if (typeof v !== 'boolean') throw new ToolError(`"${key}" should be true or false.`)
  return v
}

function nothing(patch: object, fields: string) {
  if (!Object.keys(patch).length) throw new ToolError(`Nothing to change: give at least one of ${fields}.`)
}

function accountView(a: Account, d: Data) {
  const bal = balances(d.accounts, d.transactions)
  const entries = d.transactions.filter((t) => t.account_id === a.id || t.to_account_id === a.id).length
  const balance = bal.get(a.id) ?? 0
  const card = a.kind === 'card' ? cardStatus(a, balance) : null
  return {
    id: a.id, name: a.name, kind: a.kind, opening_balance: a.opening_balance, balance,
    ...(card && { owed: card.owed, credit_limit: card.limit, ...(card.left != null && { left_to_spend: card.left }) }),
    hidden: a.archived, position: a.sort, entries,
  }
}

function categoryView(c: Category, d: Data) {
  const budget = d.budgets.find((b) => b.category_id === c.id)
  return {
    id: c.id, name: c.name, kind: c.kind, icon: c.icon, hidden: c.archived, position: c.sort,
    entries: d.transactions.filter((t) => t.category_id === c.id).length,
    ...(c.kind === 'expense' && { monthly_budget: budget?.amount ?? null }),
  }
}

function pickPerson(d: Data, ref: string | null) {
  return pickById(d.people, ref, 'person', (p) => p.name, 'get_setup (people)')
}

function uniqueName<T extends { id: string; name: string }>(rows: T[], name: string, self: string | null, what: string) {
  if (rows.some((r) => r.id !== self && lower(r.name) === lower(name))) throw new ToolError(`There's already ${what} called "${name}".`)
}

// ---------------------------------------------------------------- entries

const getEntry: Tool = {
  name: 'get_entry',
  title: 'Look at one entry',
  description: 'One entry in full, by the id list_entries gives, with a link to its receipt photo when it has one (the link works for an hour).',
  inputSchema: obj({ id: S('The entry\'s id.') }, ['id']),
  readOnly: true,
  async run(a, { db }) {
    const d = await db.load()
    const t = d.transactions.find((x) => x.id === text(a, 'id', { required: true }))
    if (!t) throw new ToolError('No entry with that id. Find it with list_entries.')
    return {
      ...entryView(t, names(d)),
      recorded_at: t.created_at ?? null,
      receipt_photo_url: t.receipt_path ? await db.photoUrl(t.receipt_path) : null,
    }
  },
}

const deleteEntry: Tool = {
  name: 'delete_entry',
  title: 'Delete an entry',
  description:
    'Permanently delete an entry (and its receipt photo), the way the app\'s Delete does. Balances, budgets and the tithe change at once. Deleting a loan payment reopens a loan that it had closed. Confirm with the person first.',
  inputSchema: obj({ id: S('The entry\'s id (from list_entries).') }, ['id']),
  readOnly: false,
  destructive: true,
  async run(a, { db }) {
    const d = await db.load()
    const t = d.transactions.find((x) => x.id === text(a, 'id', { required: true }))
    if (!t) throw new ToolError('No entry with that id. Find it with list_entries.')
    const n = names(d)
    const deleted = entryView(t, n)
    await db.remove('transactions', t.id)
    if (t.receipt_path) await db.removePhoto(t.receipt_path).catch(() => {})
    let reopened: string | null = null
    const loan = t.debt_id ? d.debts.find((x) => x.id === t.debt_id) : undefined
    if (loan?.closed_at) {
      const rest = d.transactions.filter((x) => x.id !== t.id)
      if (debtPaid(loan, rest) < loan.principal - 0.005) {
        await db.update('debts', loan.id, { closed_at: null })
        reopened = loan.title
      }
    }
    const bal = balances(d.accounts, d.transactions.filter((x) => x.id !== t.id))
    return {
      deleted,
      balance_now: { [n.account.get(t.account_id) ?? 'account']: bal.get(t.account_id), ...(t.to_account_id && { [n.account.get(t.to_account_id) ?? 'to account']: bal.get(t.to_account_id) }) },
      ...(reopened && { reopened_loan: reopened }),
    }
  },
}

const arrangeDay: Tool = {
  name: 'arrange_day',
  title: 'Arrange a day\'s entries',
  description:
    'Put one day\'s entries in a new order, the way dragging them in the app\'s Activity does: list every entry of that day by id, top first (list_entries with from and to set to that date gives them in their current order). Only the order changes; no amounts or balances.',
  inputSchema: obj({
    date: DATE('The day.'),
    ids: { type: 'array', items: { type: 'string' }, minItems: 1, description: 'Every entry id of that day, top first.' },
  }, ['date', 'ids']),
  readOnly: false,
  async run(a, { db }) {
    const date = day(a, 'date')
    if (!date || !isDate(date)) throw new ToolError('"date" is required (YYYY-MM-DD).')
    if (!Array.isArray(a.ids) || !a.ids.every((x) => typeof x === 'string')) throw new ToolError('"ids" should be a list of entry ids.')
    const ids = a.ids as string[]
    if (new Set(ids).size !== ids.length) throw new ToolError('An id is listed twice.')
    const d = await db.load()
    const n = names(d)
    const onDay = d.transactions.filter((t) => t.occurred_on === date).sort(withinDay)
    const known = new Set(onDay.map((t) => t.id))
    const stray = ids.filter((id) => !known.has(id))
    if (stray.length) throw new ToolError(`Not entries of ${date}: ${stray.join(', ')}. Find that day's entries with list_entries.`)
    const left = onDay.filter((t) => !ids.includes(t.id))
    if (left.length) {
      throw new ToolError(`List every entry of ${date}. Missing: ${left.map((t) => `${t.id} (${entryView(t, n).note ?? KIND(t)} ${t.amount})`).join('; ')}.`)
    }
    const byId = new Map(onDay.map((t) => [t.id, t]))
    await Promise.all(ids.map((id, i) => (byId.get(id)!.day_order === i + 1 ? null : db.update('transactions', id, { day_order: i + 1 }))))
    return { date, order: ids.map((id, i) => ({ place: i + 1, ...entryView(byId.get(id)!, n) })) }
  },
}
const KIND = (t: Tx) => t.kind.replace('debt_', 'loan ')

const removeReceipt: Tool = {
  name: 'remove_receipt_photo',
  title: 'Remove a receipt photo',
  description: 'Delete the receipt photo attached to an entry. The entry itself stays.',
  inputSchema: obj({ id: S('The entry\'s id.') }, ['id']),
  readOnly: false,
  destructive: true,
  async run(a, { db }) {
    const d = await db.load()
    const t = d.transactions.find((x) => x.id === text(a, 'id', { required: true }))
    if (!t) throw new ToolError('No entry with that id. Find it with list_entries.')
    if (!t.receipt_path) throw new ToolError('That entry has no receipt photo.')
    await db.update('transactions', t.id, { receipt_path: null })
    await db.removePhoto(t.receipt_path).catch(() => {})
    return { removed_photo_from: entryView(t, names(d)) }
  },
}

// ---------------------------------------------------------------- accounts

const listAccounts: Tool = {
  name: 'list_accounts',
  title: 'Accounts in detail',
  description: 'Every account, hidden ones too, with its kind, opening balance, current balance, position and how many entries use it.',
  inputSchema: obj({}),
  readOnly: true,
  async run(_a, { db }) {
    const d = await db.load()
    return { accounts: [...d.accounts].sort((x, y) => x.sort - y.sort).map((x) => accountView(x, d)) }
  },
}

const addAccount: Tool = {
  name: 'add_account',
  title: 'Add an account',
  description: 'A new place money sits: cash, bank, ewallet (GCash, Maya, Wise), card (a credit card or pay-later like Atome or SPayLater) or savings. opening_balance is what it holds now; for a card give what is owed as a negative number, and credit_limit if known so the app can show what\'s left to spend. Bank, e-wallet and pay-later names (BDO, GCash, GoTyme, Atome…) get their logo in the app.',
  inputSchema: obj({
    name: S('Name, like "BDO" or "GCash".', { maxLength: 60 }),
    kind: S('What kind of account.', { enum: [...ACCOUNT_KINDS] }),
    opening_balance: N('What it holds now, in pesos (default 0; negative for card debt).'),
    credit_limit: N('Cards only: the total spending limit in pesos.'),
  }, ['name', 'kind']),
  readOnly: false,
  async run(a, { db }) {
    const d = await db.load()
    const name = text(a, 'name', { required: true, max: 60 })!
    uniqueName(d.accounts, name, null, 'an account')
    const kind = oneOf(a, 'kind', ACCOUNT_KINDS) as AccountKind
    const limit = money(a, 'credit_limit')
    if (limit != null && kind !== 'card') throw new ToolError('Only cards have a "credit_limit".')
    const saved = await db.insert('accounts', {
      name, kind, opening_balance: signed(a, 'opening_balance') ?? 0,
      sort: d.accounts.length ? Math.max(...d.accounts.map((x) => x.sort)) + 1 : 0, archived: false,
      ...(limit != null && { credit_limit: limit }),
    })
    return { added: accountView(saved, { ...d, accounts: [...d.accounts, saved] }) }
  },
}

const updateAccount: Tool = {
  name: 'update_account',
  title: 'Change an account',
  description: 'Rename an account, change its kind, opening balance or credit limit (cards), hide or show it (hidden accounts keep their history), or move it in the list. Changing the opening balance shifts its current balance by the same amount.',
  inputSchema: obj({
    account: S('Account name or id.'),
    name: S('New name.', { maxLength: 60 }),
    kind: S('New kind.', { enum: [...ACCOUNT_KINDS] }),
    opening_balance: N('New opening balance in pesos (0 allowed; negative for card debt).'),
    credit_limit: N('Cards only: the total spending limit in pesos; empty string or 0 clears it.'),
    hidden: B('true to hide it, false to show it again.'),
    position: N('Place in the list, 0 first.'),
  }, ['account']),
  readOnly: false,
  async run(a, { db }) {
    const d = await db.load()
    const acc = pickAccount(d, text(a, 'account', { required: true })!)
    const patch: Partial<Account> = {}
    const name = text(a, 'name', { max: 60 })
    if (name) (uniqueName(d.accounts, name, acc.id, 'an account'), (patch.name = name))
    if (has(a, 'kind')) patch.kind = oneOf(a, 'kind', ACCOUNT_KINDS) as AccountKind
    if (has(a, 'opening_balance')) {
      const v = signed(a, 'opening_balance')
      if (v == null) throw new ToolError('"opening_balance" should be a number of pesos.')
      patch.opening_balance = v
    }
    if (clears(a, 'credit_limit') || a.credit_limit === 0) patch.credit_limit = null
    else if (has(a, 'credit_limit')) {
      if ((patch.kind ?? acc.kind) !== 'card') throw new ToolError('Only cards have a "credit_limit".')
      patch.credit_limit = money(a, 'credit_limit', { required: true })!
    }
    const hidden = bool(a, 'hidden')
    if (hidden != null) patch.archived = hidden
    const pos = whole(a, 'position', 0, 999)
    if (pos != null) patch.sort = pos
    nothing(patch, 'name, kind, opening_balance, credit_limit, hidden or position')
    const saved = await db.update('accounts', acc.id, patch)
    const after = { ...d, accounts: d.accounts.map((x) => (x.id === acc.id ? saved : x)) }
    return { before: accountView(acc, d), after: accountView(saved, after) }
  },
}

const deleteAccount: Tool = {
  name: 'delete_account',
  title: 'Delete an account',
  description:
    'Permanently delete an account. If entries use it, either move them to another account with move_entries_to, or hide the account instead (update_account hidden: true) to keep its history. Its month-end check rows go with it. Confirm with the person first.',
  inputSchema: obj({
    account: S('Account name or id.'),
    move_entries_to: S('Another account (name or id) to move its entries and bills to before deleting.'),
  }, ['account']),
  readOnly: false,
  destructive: true,
  async run(a, { db }) {
    const d = await db.load()
    const acc = pickAccount(d, text(a, 'account', { required: true })!)
    const used = d.transactions.filter((t) => t.account_id === acc.id || t.to_account_id === acc.id)
    const target = text(a, 'move_entries_to') ? pickAccount(d, text(a, 'move_entries_to')!, 'move_entries_to') : null
    if (target?.id === acc.id) throw new ToolError('"move_entries_to" must be a different account.')
    if (used.length && !target) {
      throw new ToolError(`${acc.name} has ${used.length} entr${used.length === 1 ? 'y' : 'ies'}. Give move_entries_to (another account), or hide it with update_account instead to keep its history.`)
    }
    if (target) {
      const clash = used.find((t) => t.kind === 'transfer' && (t.account_id === target.id || t.to_account_id === target.id))
      if (clash) throw new ToolError(`A transfer between ${acc.name} and ${target.name} (${clash.occurred_on}, ₱${clash.amount}) would become a transfer to itself. Delete that entry first, or move to another account.`)
      for (const t of used) {
        await db.update('transactions', t.id, t.account_id === acc.id ? { account_id: target.id } : { to_account_id: target.id })
      }
      for (const r of d.recurring.filter((x) => x.account_id === acc.id)) await db.update('recurring', r.id, { account_id: target.id })
    }
    await db.remove('accounts', acc.id)
    return { deleted: acc.name, ...(target && { moved_to: target.name, entries_moved: used.length }) }
  },
}

// ---------------------------------------------------------------- categories and budgets

const listCategories: Tool = {
  name: 'list_categories',
  title: 'Categories in detail',
  description: 'Every category, hidden ones too, with its kind, icon, position, monthly budget (spending only) and how many entries use it.',
  inputSchema: obj({ kind: S('Only this kind.', { enum: [...CATEGORY_KINDS] }) }),
  readOnly: true,
  async run(a, { db }) {
    const d = await db.load()
    const kind = a.kind ? oneOf(a, 'kind', CATEGORY_KINDS) : null
    return { categories: d.categories.filter((c) => !kind || c.kind === kind).sort((x, y) => x.kind.localeCompare(y.kind) || x.sort - y.sort).map((c) => categoryView(c, d)) }
  },
}

const addCategory: Tool = {
  name: 'add_category',
  title: 'Add a category',
  description: 'A new spending (expense), income or giving category. Giving categories (tithe, offering, missions, helping others) are counted apart from spending; the tithe is compared with the one named "Tithe".',
  inputSchema: obj({
    name: S('Name.', { maxLength: 40 }),
    kind: S('Which kind.', { enum: [...CATEGORY_KINDS] }),
    icon: ICON('dot'),
    monthly_budget: N('Spending only: a monthly limit in pesos.'),
  }, ['name', 'kind']),
  readOnly: false,
  async run(a, { db }) {
    const d = await db.load()
    const kind = oneOf(a, 'kind', CATEGORY_KINDS) as CategoryKind
    const name = text(a, 'name', { required: true, max: 40 })!
    uniqueName(d.categories.filter((c) => c.kind === kind), name, null, `a ${kind} category`)
    const budget = money(a, 'monthly_budget')
    if (budget != null && kind !== 'expense') throw new ToolError('Only spending (expense) categories have a monthly budget.')
    const same = d.categories.filter((c) => c.kind === kind)
    const saved = await db.insert('categories', {
      name, kind, icon: a.icon ? oneOf(a, 'icon', ICONS) : 'dot', archived: false, sort: same.length ? Math.max(...same.map((c) => c.sort)) + 1 : 0,
    })
    const b = budget != null ? await db.insert('budgets', { category_id: saved.id, amount: budget }) : null
    return { added: categoryView(saved, { ...d, categories: [...d.categories, saved], budgets: b ? [...d.budgets, b] : d.budgets }) }
  },
}

const updateCategory: Tool = {
  name: 'update_category',
  title: 'Change a category',
  description: 'Rename a category, change its icon, hide or show it (hidden ones keep their history but aren\'t offered for new entries), or move it in the list. Its kind can\'t change.',
  inputSchema: obj({
    category: S('Category name or id.'),
    kind: S('Which kind, when the same name exists for more than one.', { enum: [...CATEGORY_KINDS] }),
    name: S('New name.', { maxLength: 40 }),
    icon: ICON('dot'),
    hidden: B('true to hide it, false to show it again.'),
    position: N('Place in the list, 0 first.'),
  }, ['category']),
  readOnly: false,
  async run(a, { db }) {
    const d = await db.load()
    const c = pickCategory(d, text(a, 'category', { required: true })!, a.kind ? oneOf(a, 'kind', CATEGORY_KINDS) as CategoryKind : undefined)
    const patch: Partial<Category> = {}
    const name = text(a, 'name', { max: 40 })
    if (name) (uniqueName(d.categories.filter((x) => x.kind === c.kind), name, c.id, `a ${c.kind} category`), (patch.name = name))
    if (a.icon) patch.icon = oneOf(a, 'icon', ICONS)
    const hidden = bool(a, 'hidden')
    if (hidden != null) patch.archived = hidden
    const pos = whole(a, 'position', 0, 999)
    if (pos != null) patch.sort = pos
    nothing(patch, 'name, icon, hidden or position')
    const saved = await db.update('categories', c.id, patch)
    return { before: categoryView(c, d), after: categoryView(saved, { ...d, categories: d.categories.map((x) => (x.id === c.id ? saved : x)) }) }
  },
}

const deleteCategory: Tool = {
  name: 'delete_category',
  title: 'Delete a category',
  description:
    'Permanently delete a category and its budget. Its entries and bills move to move_entries_to when given (same kind); otherwise they are left without a category. Hiding it (update_category hidden: true) keeps the history instead. Confirm with the person first.',
  inputSchema: obj({
    category: S('Category name or id.'),
    kind: S('Which kind, when the same name exists for more than one.', { enum: [...CATEGORY_KINDS] }),
    move_entries_to: S('Another category of the same kind (name or id) for its entries and bills.'),
  }, ['category']),
  readOnly: false,
  destructive: true,
  async run(a, { db }) {
    const d = await db.load()
    const c = pickCategory(d, text(a, 'category', { required: true })!, a.kind ? oneOf(a, 'kind', CATEGORY_KINDS) as CategoryKind : undefined)
    const target = text(a, 'move_entries_to') ? pickCategory(d, text(a, 'move_entries_to')!, c.kind) : null
    if (target?.id === c.id) throw new ToolError('"move_entries_to" must be a different category.')
    const used = d.transactions.filter((t) => t.category_id === c.id)
    if (target) {
      for (const t of used) await db.update('transactions', t.id, { category_id: target.id })
      for (const r of d.recurring.filter((x) => x.category_id === c.id)) await db.update('recurring', r.id, { category_id: target.id })
    }
    await db.remove('categories', c.id)
    return { deleted: `${c.name} (${c.kind})`, entries: used.length, ...(target ? { moved_to: target.name } : { left_without_category: used.length }) }
  },
}

const setBudget: Tool = {
  name: 'set_budget',
  title: 'Set a monthly budget',
  description: 'Set the standing monthly limit for a spending category (it applies to every month), or remove it with amount 0.',
  inputSchema: obj({
    category: S('Spending category name or id.'),
    amount: N('Pesos per month; 0 removes the budget.'),
  }, ['category', 'amount']),
  readOnly: false,
  async run(a, { db }) {
    const d = await db.load()
    const c = pickCategory(d, text(a, 'category', { required: true })!, 'expense')
    const old = d.budgets.find((b) => b.category_id === c.id)
    if (a.amount === 0 || a.amount === '0') {
      if (!old) throw new ToolError(`${c.name} has no budget to remove.`)
      await db.remove('budgets', old.id)
      return { category: c.name, removed_budget: old.amount }
    }
    const amount = money(a, 'amount', { required: true })!
    const saved = old ? await db.update('budgets', old.id, { amount }) : await db.insert('budgets', { category_id: c.id, amount })
    return { category: c.name, monthly_budget: saved.amount, ...(old && { was: old.amount }) }
  },
}

// ---------------------------------------------------------------- bills

function billFields(a: Args, d: Data, kind: BillKind, patch: Partial<Recurring>) {
  if (has(a, 'title')) patch.title = text(a, 'title', { required: true, max: 60 })!
  if (has(a, 'amount')) patch.amount = money(a, 'amount', { required: true })!
  if (has(a, 'frequency')) patch.frequency = oneOf(a, 'frequency', FREQUENCIES) as Frequency
  const every = whole(a, 'every', 1, 52)
  if (every != null) patch.every = every
  if (has(a, 'next_due')) patch.next_due = day(a, 'next_due')!
  if (clears(a, 'account')) patch.account_id = null
  else if (text(a, 'account')) patch.account_id = pickAccount(d, text(a, 'account')!).id
  if (kind === 'transfer') {
    if (text(a, 'category')) throw new ToolError('A card payment has no category; the purchases on the card carry them.')
    if (text(a, 'to_card')) patch.to_account_id = pickAccount(d, text(a, 'to_card')!, 'to_card').id
  } else {
    if (text(a, 'to_card')) throw new ToolError('Only card payments (kind "transfer") have a "to_card".')
    if (clears(a, 'category')) patch.category_id = null
    else if (text(a, 'category')) patch.category_id = pickCategory(d, text(a, 'category')!, kind).id
  }
  if (clears(a, 'payments_left')) patch.payments_left = null
  else {
    const left = whole(a, 'payments_left', 0, 999)
    if (left != null) patch.payments_left = left
  }
  if (clears(a, 'note')) patch.note = null
  else if (has(a, 'note')) patch.note = text(a, 'note', { max: 200 })
}

/** A card payment's two accounts must differ (the database refuses it too). */
function checkCard(bill: Partial<Recurring>) {
  if (bill.kind !== 'transfer') return
  if (!bill.to_account_id) throw new ToolError('A card payment needs "to_card": the card or pay-later account it pays (add it with add_account, kind "card", if it\'s new).')
  if (bill.account_id && bill.account_id === bill.to_account_id) throw new ToolError('Pay the card from a different account than the card itself.')
}

const BILL_KINDS = [...CATEGORY_KINDS, 'transfer'] as const

const BILL_FIELDS = {
  title: S('Name, like "Meralco" or "Salary".', { maxLength: 60 }),
  amount: N('Usual amount in pesos.'),
  frequency: S('How often.', { enum: [...FREQUENCIES] }),
  every: N('Every how many weeks/months/years (default 1).'),
  next_due: DATE('Next due date.'),
  account: S('Usual account (name or id); empty string clears it.'),
  category: S('Category of the same kind (name or id); empty string clears it. Not for card payments.'),
  to_card: S('Card payments only: the card or pay-later account it pays (name or id).'),
  payments_left: N('Payments still to make, for something that ends (installments, the last months of a loan); each payment counts it down and the last one finishes the bill. Empty string clears it (no end).'),
  note: S('Optional note; empty string clears it.', { maxLength: 200 }),
}

const addBill: Tool = {
  name: 'add_bill',
  title: 'Add a bill or regular income',
  description: 'A recurring bill (rent, utilities, subscriptions, loans to a bank), regular income (salary), regular giving, or a card payment: kind "transfer" pays a credit card or pay-later account (Atome, SPayLater) from "account" to "to_card", so the purchases on the card aren\'t counted as spending twice. Give payments_left for something that ends. It shows in Plan → Bills and reminds before it\'s due; pay_bill records each payment.',
  inputSchema: obj({ kind: S('Expense (a bill), income, giving, or transfer (a card payment) (default expense).', { enum: [...BILL_KINDS] }), ...BILL_FIELDS }, ['title', 'amount', 'next_due']),
  readOnly: false,
  async run(a, { db, today }) {
    const d = await db.load()
    const kind = oneOf(a, 'kind', BILL_KINDS, 'expense') as BillKind
    const row: Partial<Recurring> = { kind, frequency: 'monthly', every: 1, active: true, account_id: null, category_id: null, note: null }
    billFields(a, d, kind, row)
    checkCard(row)
    if (row.payments_left === 0) throw new ToolError('"payments_left" is 0: nothing left to pay. Leave it out if the bill doesn\'t end.')
    if (!row.category_id && kind !== 'transfer') row.category_id = d.categories.find((c) => c.kind === kind && !c.archived && lower(c.name) === (kind === 'expense' ? 'bills' : kind === 'income' ? 'salary' : 'tithe'))?.id ?? null
    const saved = await db.insert('recurring', row)
    return { added: billView(saved, names(d), today) }
  },
}

const updateBill: Tool = {
  name: 'update_bill',
  title: 'Change a bill',
  description: 'Change a bill\'s name, amount, schedule, next due date, account, category, card (to_card), payments left or note, or pause/resume it. Giving a fully paid bill more payments_left starts it reminding again.',
  inputSchema: obj({ bill: S('The bill\'s id (from list_bills) or its exact title.'), ...BILL_FIELDS, paused: B('true to pause reminders, false to resume.') }, ['bill']),
  readOnly: false,
  async run(a, { db, today }) {
    const d = await db.load()
    const bill = pickById(d.recurring, text(a, 'bill'), 'bill', (r) => r.title, 'list_bills')
    const patch: Partial<Recurring> = {}
    billFields(a, d, bill.kind, patch)
    checkCard({ ...bill, ...patch })
    const paused = bool(a, 'paused')
    if (paused != null) patch.active = !paused
    else if (patch.payments_left != null) {
      if (patch.payments_left > 0 && bill.payments_left === 0) patch.active = true // more to pay after all
      if (patch.payments_left === 0) patch.active = false
    }
    nothing(patch, 'title, amount, frequency, every, next_due, account, category, to_card, payments_left, note or paused')
    const saved = await db.update('recurring', bill.id, patch)
    const n = names(d)
    return { before: billView(bill, n, today), after: billView(saved, n, today) }
  },
}

const deleteBill: Tool = {
  name: 'delete_bill',
  title: 'Delete a bill',
  description: 'Permanently delete a bill or regular income. Payments already recorded stay as ordinary entries. Pausing it (update_bill paused: true) is the gentler option. Confirm with the person first.',
  inputSchema: obj({ bill: S('The bill\'s id (from list_bills) or its exact title.') }, ['bill']),
  readOnly: false,
  destructive: true,
  async run(a, { db }) {
    const d = await db.load()
    const bill = pickById(d.recurring, text(a, 'bill'), 'bill', (r) => r.title, 'list_bills')
    await db.remove('recurring', bill.id)
    return { deleted: bill.title, payments_kept: d.transactions.filter((t) => t.recurring_id === bill.id).length }
  },
}

// ---------------------------------------------------------------- people and loans

const addPerson: Tool = {
  name: 'add_person',
  title: 'Add a person',
  description: 'Add someone to the people list used for loans (record_loan also adds new people by itself).',
  inputSchema: obj({ name: S('Their name.', { maxLength: 60 }), note: S('Optional note.', { maxLength: 200 }) }, ['name']),
  readOnly: false,
  async run(a, { db }) {
    const d = await db.load()
    const name = text(a, 'name', { required: true, max: 60 })!
    uniqueName(d.people, name, null, 'a person')
    const saved = await db.insert('people', { name, note: text(a, 'note', { max: 200 }) })
    return { added: { id: saved.id, name: saved.name, note: saved.note } }
  },
}

const updatePerson: Tool = {
  name: 'update_person',
  title: 'Change a person',
  description: 'Rename a person or change their note.',
  inputSchema: obj({ person: S('Their id or exact name.'), name: S('New name.', { maxLength: 60 }), note: S('New note; empty string clears it.', { maxLength: 200 }) }, ['person']),
  readOnly: false,
  async run(a, { db }) {
    const d = await db.load()
    const p = pickPerson(d, text(a, 'person'))
    const patch: Partial<Data['people'][number]> = {}
    const name = text(a, 'name', { max: 60 })
    if (name) (uniqueName(d.people, name, p.id, 'a person'), (patch.name = name))
    if (clears(a, 'note')) patch.note = null
    else if (has(a, 'note')) patch.note = text(a, 'note', { max: 200 })
    nothing(patch, 'name or note')
    const saved = await db.update('people', p.id, patch)
    return { before: { name: p.name, note: p.note }, after: { name: saved.name, note: saved.note } }
  },
}

const deletePerson: Tool = {
  name: 'delete_person',
  title: 'Delete a person',
  description: 'Permanently remove a person. Only possible once they have no loans; delete those first with delete_loan. Confirm with the person first.',
  inputSchema: obj({ person: S('Their id or exact name.') }, ['person']),
  readOnly: false,
  destructive: true,
  async run(a, { db }) {
    const d = await db.load()
    const p = pickPerson(d, text(a, 'person'))
    const loans = d.debts.filter((x) => x.person_id === p.id)
    if (loans.length) throw new ToolError(`${p.name} still has ${loans.length} loan${loans.length === 1 ? '' : 's'} (${loans.map((x) => x.title).join(', ')}). Delete those with delete_loan first.`)
    await db.remove('people', p.id)
    return { deleted: p.name }
  },
}

const updateLoan: Tool = {
  name: 'update_loan',
  title: 'Change a loan',
  description:
    'Change a loan\'s title, amount (principal), start or due date, note or person, or close/reopen it by hand (closed: true for a loan that was forgiven or settled some other way). Payments are recorded with record_loan_payment, not here.',
  inputSchema: obj({
    loan: S('The loan\'s id (from list_loans) or its exact title.'),
    title: S('New title.', { maxLength: 80 }),
    principal: N('New amount lent or borrowed, in pesos.'),
    started_on: DATE('New start date.'),
    due_on: S('New due date YYYY-MM-DD; empty string clears it.'),
    person: S('Another person (id or exact name).'),
    note: S('New note; empty string clears it.', { maxLength: 300 }),
    closed: B('true to close it, false to reopen it.'),
  }, ['loan']),
  readOnly: false,
  async run(a, { db, today }) {
    const d = await db.load()
    const loan = pickById(d.debts, text(a, 'loan'), 'loan', (x) => x.title, 'list_loans')
    const patch: Partial<Debt> = {}
    if (has(a, 'title')) patch.title = text(a, 'title', { required: true, max: 80 })!
    if (has(a, 'principal')) {
      patch.principal = money(a, 'principal', { required: true })!
      const paid = debtPaid(loan, d.transactions)
      if (patch.principal < paid - 0.005) throw new ToolError(`₱${paid} has already been paid back on "${loan.title}"; the amount can't be less than that.`)
    }
    if (has(a, 'started_on')) patch.started_on = day(a, 'started_on')!
    if (clears(a, 'due_on')) patch.due_on = null
    else if (has(a, 'due_on')) patch.due_on = day(a, 'due_on')
    if (text(a, 'person')) patch.person_id = pickPerson(d, text(a, 'person')).id
    if (clears(a, 'note')) patch.note = null
    else if (has(a, 'note')) patch.note = text(a, 'note', { max: 300 })
    const closed = bool(a, 'closed')
    if (closed != null) patch.closed_at = closed ? (loan.closed_at ?? now()) : null
    nothing(patch, 'title, principal, started_on, due_on, person, note or closed')
    const saved = await db.update('debts', loan.id, patch)
    const after = { ...d, debts: d.debts.map((x) => (x.id === loan.id ? saved : x)) }
    return { before: loanView(loan, d, names(d), today), after: loanView(saved, after, names(after), today, true) }
  },
}

const deleteLoan: Tool = {
  name: 'delete_loan',
  title: 'Delete a loan',
  description:
    'Permanently delete a loan together with every entry that belongs to it (the money lent or borrowed and all payments), the way the app\'s Delete does, so balances change. To keep the history, close it with update_loan instead. Confirm with the person first.',
  inputSchema: obj({ loan: S('The loan\'s id (from list_loans) or its exact title.') }, ['loan']),
  readOnly: false,
  destructive: true,
  async run(a, { db }) {
    const d = await db.load()
    const loan = pickById(d.debts, text(a, 'loan'), 'loan', (x) => x.title, 'list_loans')
    const history = d.transactions.filter((t) => t.debt_id === loan.id)
    for (const t of history) {
      await db.remove('transactions', t.id)
      if (t.receipt_path) await db.removePhoto(t.receipt_path).catch(() => {})
    }
    await db.remove('debts', loan.id)
    return { deleted: loan.title, entries_deleted: history.length }
  },
}

// ---------------------------------------------------------------- goals

const addGoal: Tool = {
  name: 'add_goal',
  title: 'Add a savings goal',
  description: 'A new savings goal with a target amount and, if they have one, a target date.',
  inputSchema: obj({ name: S('Name, like "Emergency fund".', { maxLength: 60 }), target: N('Target in pesos.'), target_on: DATE('Date to reach it by.'), icon: ICON('jar') }, ['name', 'target']),
  readOnly: false,
  async run(a, { db, today }) {
    const d = await db.load()
    const saved = await db.insert('goals', {
      name: text(a, 'name', { required: true, max: 60 })!, target: money(a, 'target', { required: true })!,
      target_on: day(a, 'target_on'), icon: a.icon ? oneOf(a, 'icon', ICONS) : 'jar', closed_at: null,
    })
    return { added: goalView(saved, d, today) }
  },
}

const updateGoal: Tool = {
  name: 'update_goal',
  title: 'Change a savings goal',
  description: 'Rename a goal, change its target, target date or icon, or close/reopen it.',
  inputSchema: obj({
    goal: S('The goal\'s id (from list_goals) or its exact name.'),
    name: S('New name.', { maxLength: 60 }),
    target: N('New target in pesos.'),
    target_on: S('New target date YYYY-MM-DD; empty string clears it.'),
    icon: ICON('jar'),
    closed: B('true to close it, false to reopen it.'),
  }, ['goal']),
  readOnly: false,
  async run(a, { db, today }) {
    const d = await db.load()
    const goal = pickById(d.goals, text(a, 'goal'), 'goal', (g) => g.name, 'list_goals')
    const patch: Partial<Goal> = {}
    if (has(a, 'name')) patch.name = text(a, 'name', { required: true, max: 60 })!
    if (has(a, 'target')) patch.target = money(a, 'target', { required: true })!
    if (clears(a, 'target_on')) patch.target_on = null
    else if (has(a, 'target_on')) patch.target_on = day(a, 'target_on')
    if (a.icon) patch.icon = oneOf(a, 'icon', ICONS)
    const closed = bool(a, 'closed')
    if (closed != null) patch.closed_at = closed ? (goal.closed_at ?? now()) : null
    nothing(patch, 'name, target, target_on, icon or closed')
    const saved = await db.update('goals', goal.id, patch)
    return { before: goalView(goal, d, today), after: goalView(saved, d, today) }
  },
}

const deleteGoal: Tool = {
  name: 'delete_goal',
  title: 'Delete a savings goal',
  description: 'Permanently delete a goal and everything set aside toward it (only the tracking; no account balance changes). Closing it (update_goal closed: true) keeps the history. Confirm with the person first.',
  inputSchema: obj({ goal: S('The goal\'s id (from list_goals) or its exact name.') }, ['goal']),
  readOnly: false,
  destructive: true,
  async run(a, { db }) {
    const d = await db.load()
    const goal = pickById(d.goals, text(a, 'goal'), 'goal', (g) => g.name, 'list_goals')
    await db.remove('goals', goal.id)
    return { deleted: goal.name, had_saved: goalSaved(goal, d.goal_entries) }
  },
}

const listGoalEntries: Tool = {
  name: 'list_goal_entries',
  title: 'A goal\'s history',
  description: 'Every amount put into or taken out of one savings goal, newest first, with ids for update_goal_entry and delete_goal_entry.',
  inputSchema: obj({ goal: S('The goal\'s id (from list_goals) or its exact name.') }, ['goal']),
  readOnly: true,
  async run(a, { db, today }) {
    const d = await db.load()
    const goal = pickById(d.goals, text(a, 'goal'), 'goal', (g) => g.name, 'list_goals')
    return {
      goal: goalView(goal, d, today),
      entries: d.goal_entries.filter((e) => e.goal_id === goal.id).sort((x, y) => y.occurred_on.localeCompare(x.occurred_on)).map((e) => ({ id: e.id, date: e.occurred_on, amount: e.amount, note: e.note })),
    }
  },
}

const updateGoalEntry: Tool = {
  name: 'update_goal_entry',
  title: 'Correct a goal entry',
  description: 'Change the amount (negative for money taken out), date or note of one entry in a goal\'s history.',
  inputSchema: obj({ id: S('The entry\'s id (from list_goal_entries).'), amount: N('New amount; negative for taken out.'), date: DATE('New date.'), note: S('New note; empty string clears it.', { maxLength: 200 }) }, ['id']),
  readOnly: false,
  async run(a, { db }) {
    const d = await db.load()
    const e = d.goal_entries.find((x) => x.id === text(a, 'id', { required: true }))
    if (!e) throw new ToolError('No goal entry with that id. Find it with list_goal_entries.')
    const patch: Partial<Data['goal_entries'][number]> = {}
    if (has(a, 'amount')) patch.amount = money(a, 'amount', { required: true, allowNegative: true })!
    if (has(a, 'date')) patch.occurred_on = day(a, 'date')!
    if (clears(a, 'note')) patch.note = null
    else if (has(a, 'note')) patch.note = text(a, 'note', { max: 200 })
    nothing(patch, 'amount, date or note')
    const saved = await db.update('goal_entries', e.id, patch)
    return { before: { date: e.occurred_on, amount: e.amount, note: e.note }, after: { date: saved.occurred_on, amount: saved.amount, note: saved.note } }
  },
}

const deleteGoalEntry: Tool = {
  name: 'delete_goal_entry',
  title: 'Delete a goal entry',
  description: 'Permanently delete one entry from a goal\'s history. Confirm with the person first.',
  inputSchema: obj({ id: S('The entry\'s id (from list_goal_entries).') }, ['id']),
  readOnly: false,
  destructive: true,
  async run(a, { db, today }) {
    const d = await db.load()
    const e = d.goal_entries.find((x) => x.id === text(a, 'id', { required: true }))
    if (!e) throw new ToolError('No goal entry with that id. Find it with list_goal_entries.')
    await db.remove('goal_entries', e.id)
    const goal = d.goals.find((g) => g.id === e.goal_id)!
    return { deleted: { date: e.occurred_on, amount: e.amount, note: e.note }, goal: goalView(goal, { ...d, goal_entries: d.goal_entries.filter((x) => x.id !== e.id) }, today) }
  },
}

// ---------------------------------------------------------------- notes

const deleteNote: Tool = {
  name: 'delete_note',
  title: 'Delete a note',
  description: 'Permanently delete one of KATY\'s notes (and its photo). To keep it but mark it settled, use update_note done: true. Confirm with the person first.',
  inputSchema: obj({ id: S('The note\'s id (from list_notes).') }, ['id']),
  readOnly: false,
  destructive: true,
  async run(a, { db, today }) {
    const d = await db.load()
    const note = d.notes.find((x) => x.id === text(a, 'id', { required: true }))
    if (!note) throw new ToolError('No note with that id. Find it with list_notes.')
    await db.remove('notes', note.id)
    if (note.image_path) await db.removePhoto(note.image_path).catch(() => {})
    return { deleted: noteView(note, today) }
  },
}

// ---------------------------------------------------------------- settings

const updateSettings: Tool = {
  name: 'update_settings',
  title: 'Change settings',
  description: 'Change the tithe percentage (0–100, default 10), the currency code, or whether first-run setup counts as done (false makes the app show KATY\'s setup again).',
  inputSchema: obj({
    tithe_percent: N('Share of income set apart as tithe, 0 to 100.'),
    currency: S('Currency code, like PHP.', { pattern: '^[A-Z]{3}$' }),
    setup_done: B('false to show the first-run setup again; true to skip it.'),
  }),
  readOnly: false,
  async run(a, { db }) {
    const d = await db.load()
    const patch: Partial<Data['settings']> = {}
    if (has(a, 'tithe_percent')) {
      const p = Number(a.tithe_percent)
      if (!Number.isFinite(p) || p < 0 || p > 100) throw new ToolError('"tithe_percent" should be from 0 to 100.')
      patch.tithe_percent = round2(p)
    }
    if (has(a, 'currency')) {
      const c = text(a, 'currency', { required: true })!.toUpperCase()
      if (!/^[A-Z]{3}$/.test(c)) throw new ToolError('"currency" should be a 3-letter code like PHP.')
      patch.currency = c
    }
    const done = bool(a, 'setup_done')
    if (done != null) patch.onboarded_at = done ? (d.settings.onboarded_at ?? now()) : null
    nothing(patch, 'tithe_percent, currency or setup_done')
    const saved = await db.saveSettings(patch)
    return {
      before: { tithe_percent: d.settings.tithe_percent, currency: d.settings.currency, setup_done: Boolean(d.settings.onboarded_at) },
      after: { tithe_percent: saved.tithe_percent, currency: saved.currency, setup_done: Boolean(saved.onboarded_at) },
    }
  },
}

// ---------------------------------------------------------------- month-end check

function checkView(c: BalanceCheck, d: Data) {
  const n = names(d)
  return {
    id: c.id, month: c.month, checked_on: c.checked_on, account: n.account.get(c.account_id) ?? null,
    recorded: c.recorded, actual: c.actual, difference: round2(c.actual - c.recorded),
    adjustment_entry: c.adjustment_id ?? null, note: c.note,
  }
}

const listChecks: Tool = {
  name: 'list_month_checks',
  title: 'Month-end checks',
  description: 'Past month-end checks: per account, what Manna had on record, what was really there, and the difference. Optionally one month.',
  inputSchema: obj({ month: S('Only this month, YYYY-MM.', { pattern: '^\\d{4}-\\d{2}$' }) }),
  readOnly: true,
  async run(a, { db }) {
    const d = await db.load()
    const month = text(a, 'month')
    const rows = d.balance_checks.filter((c) => !month || c.month === month).sort((x, y) => y.month.localeCompare(x.month) || y.checked_on.localeCompare(x.checked_on))
    return { checks: rows.map((c) => checkView(c, d)) }
  },
}

const recordCheck: Tool = {
  name: 'record_month_check',
  title: 'Do the month-end check',
  description:
    'Close a month the way the app\'s "Close <month>" does: for each account, what it really holds now. Each difference from the record is either logged (fix "spent": spending they forgot to log; "found": money in they forgot to log; both dated today in "Other") or left with a note ("leave"). The default fix is spent for less, found for more. Month defaults to the one being closed (last month during the first 7 days).',
  inputSchema: obj({
    month: S('The month being closed, YYYY-MM.', { pattern: '^\\d{4}-\\d{2}$' }),
    accounts: {
      type: 'array',
      description: 'One item per account counted.',
      items: obj({
        account: S('Account name or id.'),
        actual: N('What it really holds now, in pesos (negative for card debt).'),
        fix: S('What to do with a difference.', { enum: ['spent', 'found', 'leave'] }),
        note: S('Optional note.', { maxLength: 200 }),
      }, ['account', 'actual']),
    },
  }, ['accounts']),
  readOnly: false,
  async run(a, { db, today }) {
    const d = await db.load()
    const month = text(a, 'month') ?? (Number(today.slice(8, 10)) <= 7 ? shiftMonth(monthOf(today), -1) : monthOf(today))
    if (!Array.isArray(a.accounts) || !a.accounts.length) throw new ToolError('"accounts" should list at least one account with what it really holds.')
    const bal = balances(d.accounts, d.transactions)
    const other = (kind: 'expense' | 'income') =>
      d.categories.find((c) => c.kind === kind && c.name === 'Other' && !c.archived) ?? d.categories.find((c) => c.kind === kind && !c.archived)
    const label = new Date(`${month}-01T00:00:00Z`).toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    // check every account first, so a mistake in one saves nothing at all
    const plan = (a.accounts as Args[]).map((item) => {
      const acc = pickAccount(d, text(item, 'account', { required: true })!)
      const v = item.actual
      const actual = typeof v === 'string' ? Number(v.replace(/[,\s₱]/g, '')) : v
      if (typeof actual !== 'number' || !Number.isFinite(actual)) throw new ToolError(`"actual" for ${acc.name} should be a number of pesos.`)
      const recorded = round2(bal.get(acc.id) ?? 0)
      const diff = round2(round2(actual) - recorded)
      const fix = item.fix ? oneOf(item, 'fix', ['spent', 'found', 'leave'] as const) : diff < 0 ? 'spent' : diff > 0 ? 'found' : 'leave'
      if (fix === 'spent' && diff > 0) throw new ToolError(`${acc.name} has more than recorded; use fix "found" or "leave".`)
      if (fix === 'found' && diff < 0) throw new ToolError(`${acc.name} has less than recorded; use fix "spent" or "leave".`)
      return { acc, actual: round2(actual), recorded, diff, fix, note: text(item, 'note', { max: 200 }) }
    })
    if (new Set(plan.map((p) => p.acc.id)).size !== plan.length) throw new ToolError('Each account should appear once.')
    const out = []
    for (const { acc, actual, recorded, diff, fix, note } of plan) {
      let adjustment: Tx | null = null
      if (diff !== 0 && fix !== 'leave') {
        const kind = fix === 'spent' ? 'expense' : 'income'
        adjustment = await db.insert('transactions', {
          kind, amount: Math.abs(diff), occurred_on: today, account_id: acc.id, to_account_id: null, category_id: other(kind)?.id ?? null,
          debt_id: null, recurring_id: null, note: fix === 'spent' ? `Not logged (${label} check)` : `Found (${label} check)`,
        })
      }
      const saved = await db.insert('balance_checks', { checked_on: today, month, account_id: acc.id, recorded, actual, adjustment_id: adjustment?.id ?? null, note })
      out.push({ ...checkView(saved, d), logged_as: adjustment ? (fix === 'spent' ? 'spending not logged' : 'money in not logged') : 'left as is' })
    }
    return { month, checks: out }
  },
}

const deleteCheck: Tool = {
  name: 'delete_month_check',
  title: 'Delete a month-end check',
  description: 'Delete month-end check rows: one by id, or a whole month for every account. The entries it logged stay unless delete_adjustments is true. Confirm with the person first.',
  inputSchema: obj({ id: S('One check row\'s id (from list_month_checks).'), month: S('Or every row for this month, YYYY-MM.', { pattern: '^\\d{4}-\\d{2}$' }), delete_adjustments: B('Also delete the entries the check logged.') }),
  readOnly: false,
  destructive: true,
  async run(a, { db }) {
    const d = await db.load()
    const id = text(a, 'id')
    const month = text(a, 'month')
    if (!id && !month) throw new ToolError('Give the check\'s id or a month.')
    const rows = d.balance_checks.filter((c) => (id ? c.id === id : c.month === month))
    if (!rows.length) throw new ToolError('No month-end check matches. See list_month_checks.')
    const withAdj = bool(a, 'delete_adjustments') === true
    let removed = 0
    for (const c of rows) {
      await db.remove('balance_checks', c.id)
      if (withAdj && c.adjustment_id && d.transactions.some((t) => t.id === c.adjustment_id)) (await db.remove('transactions', c.adjustment_id), removed++)
    }
    return { deleted_checks: rows.map((c) => checkView(c, d)), ...(withAdj && { entries_deleted: removed }) }
  },
}

// ---------------------------------------------------------------- connector links

const listLinks: Tool = {
  name: 'list_connector_links',
  title: 'Claude connector links',
  description: 'The links that let Claude (or another MCP client) reach this Manna: name, last 4 characters, when made, when last used, and whether revoked. The keys themselves can\'t be shown.',
  inputSchema: obj({}),
  readOnly: true,
  async run(_a, { db }) {
    return { links: await db.links() }
  },
}

const updateLink: Tool = {
  name: 'update_connector_link',
  title: 'Rename or revoke a connector link',
  description: 'Rename a connector link, or revoke it (it stops working within a minute, for good). Revoking the link this conversation uses cuts Claude off too, so confirm with the person first.',
  inputSchema: obj({ id: S('The link\'s id (from list_connector_links).'), name: S('New name.', { maxLength: 40 }), revoke: B('true to revoke it.') }, ['id']),
  readOnly: false,
  destructive: true,
  async run(a, { db }) {
    const links = await db.links()
    const link = links.find((l) => l.id === text(a, 'id', { required: true }))
    if (!link) throw new ToolError('No connector link with that id. See list_connector_links.')
    const label = text(a, 'name', { max: 40 })
    const revoke = bool(a, 'revoke') === true
    if (!label && !revoke) throw new ToolError('Give a new name or revoke: true.')
    if (revoke && link.revoked_at) throw new ToolError('That link is already revoked.')
    await db.updateLink(link.id, { ...(label && { label }), ...(revoke && { revoked_at: now() }) })
    return { link: label ?? link.label, ...(label && { renamed_from: link.label }), ...(revoke && { revoked: true }) }
  },
}

export const MANAGE_TOOLS: Tool[] = [
  getEntry, deleteEntry, removeReceipt, arrangeDay,
  listAccounts, addAccount, updateAccount, deleteAccount,
  listCategories, addCategory, updateCategory, deleteCategory, setBudget,
  addBill, updateBill, deleteBill,
  addPerson, updatePerson, deletePerson, updateLoan, deleteLoan,
  addGoal, updateGoal, deleteGoal, listGoalEntries, updateGoalEntry, deleteGoalEntry,
  deleteNote, updateSettings,
  listChecks, recordCheck, deleteCheck,
  listLinks, updateLink,
]

