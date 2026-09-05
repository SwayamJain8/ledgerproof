# The Accounting Engine

How Urban Furniture's ledger actually works — the stack, the design decisions,
the posting logic, and the three independent layers that stop a wrong number
from ever reaching a report.

---

## 1. What this is

A double-entry accounting system. Every financial event becomes a **journal
entry** made of **journal items**, where the debits equal the credits, and every
report in the application is a differently-shaped query over that one table.

The system covers the full cycle:

```
Purchase Order ──▶ Vendor Bill ──▶ Payment (Send)
Sales Order    ──▶ Customer Invoice ──▶ Payment (Receive)
                        │
                        ▼
                  journal_item  ──▶  Balance Sheet · P&L · Trial Balance
                                     Partner Ledger · Budget Actuals
```

Three rules shape every line of code in it:

| Rule | Consequence |
| --- | --- |
| `journal_item` is the only source of truth | No report reads an invoice or bill total. Ever. |
| The engine contains no account names | Accounts are resolved through configurable chains, so behaviour changes without code changes. |
| Posted entries are append-only | Cancellation writes a mirror-image reversal. There is no Delete. |

---

## 2. Stack

| Layer | Choice | Why this one |
| --- | --- | --- |
| Language | **TypeScript 5** (strict) | The money type is `bigint`. Strict mode is what stops a `number` leaking into a paise field. |
| Runtime | **Node 22** | — |
| Framework | **Next.js 15**, App Router | Server Components let report pages query the ledger directly, with no API layer to keep in sync. Server Actions give the Confirm buttons a transactional server call without hand-rolled endpoints. |
| Database | **PostgreSQL 16** (Docker) | Chosen specifically for `DEFERRABLE INITIALLY DEFERRED` constraint triggers, partial indexes and covering indexes. The balance rule genuinely cannot be enforced correctly without deferred triggers. |
| ORM | **Prisma 7** with `@prisma/adapter-pg` | Prisma 7 retired the Rust query engine, so the `pg` driver adapter is mandatory — which also means the connection pool is ours to reason about. |
| Migrations | Prisma Migrate + **hand-written SQL** | Prisma's schema language cannot express CHECK constraints, triggers, or partial/covering indexes. Everything that enforces an accounting rule is hand-written SQL. |
| Validation | **Zod 4** | Server Action input parsing. |
| Styling | **Tailwind CSS 4** | — |
| Tests | **Vitest 5** | 42 unit tests over the arithmetic and the balancing logic. |
| Auth | **bcryptjs** + signed session cookie | — |

`target` in `tsconfig.json` is **ES2020**, not Next's default ES2017 — BigInt
literals (`0n`) do not compile below ES2020, and this codebase is built on them.

---

## 3. How money is represented

**All money is `BIGINT` paise. No floats, no decimal library, anywhere.**

```
Rs 47,200.00  ->  4_720_000n
```

The reason is narrow and specific. The posting engine's central assertion is
`sum(debits) === sum(credits)`. With floats that comparison fails at 3 a.m. for
no visible reason. With a Decimal library it needs `.equals()`, and one `===`
slipping through is a silent wrong answer that still looks plausible. With
`bigint`, `===` is exact and a mistake is a type error.

The same discipline applies to the other two numeric kinds:

| Kind | Storage | Example |
| --- | --- | --- |
| Money | `BIGINT` paise | `Rs 5,000.00` → `500000n` |
| Quantity | `BIGINT` milli-units | `2.5 units` → `2500n` |
| Tax rate | `INT` basis points | `18.00%` → `1800` |

### Parsing, not multiplying

`rupeesToPaise()` parses the string form rather than multiplying by 100,
because `19.99 * 100` is `1998.9999999999998`:

```ts
export function rupeesToPaise(rupees: number | string): Paise {
  const text = typeof rupees === "number" ? rupees.toFixed(2) : rupees.trim();
  const match = /^(-)?(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) throw new Error(`rupeesToPaise: "${rupees}" is not a rupee amount`);
  const [, sign, whole, frac = "0"] = match;
  const paise = BigInt(whole) * 100n + BigInt(frac.padEnd(2, "0"));
  return sign ? -paise : paise;
}
```

### Rounding is half-up, and it happens per line

```ts
divRoundHalfUp(n, d) = (n * 2n + d) / (d * 2n)
```

Tax is rounded **per line and then summed** — never computed on the document
total. These are genuinely different answers. Two lines of Rs 1.30 at 5%:

- per line: `round(6.5) = 7` paise, twice → **14 paise**
- on total: `round(13.0)` → **13 paise**

Round the total instead and the document prints a tax figure that its own line
taxes do not add up to, and then the journal entry refuses to balance. There is
a test asserting exactly this pair of numbers.

---

## 4. The data model, in brief

Twenty-six models. The three that carry the design:

### `JournalItem` — the source of truth

One row per debit or credit. It carries **four denormalised columns copied from
its parent entry** — `date`, `state`, `journalId`, `partnerId` — plus
`analyticAccountId`, `productId` and `taxId`.

That denormalisation is deliberate: it means **every report reads one table and
never joins upward**. A deferred trigger asserts the copies always agree with
the parent, so the shortcut is safe rather than a bug waiting to happen.

Carrying `analyticAccountId` down into the ledger is the join most
implementations skip. Without it, budget actuals have to be computed from
invoice tables — which means a manual journal entry or a reversal is invisible
to the budget report.

### `PaymentAllocation` — the table that makes "Partial" real

Payments and documents are many-to-many. One bank transfer often clears three
invoices; one invoice often takes four payments. So the link carries its own
amount:

```
payment ──< payment_allocation >── customer_invoice
                (amount_paise)         vendor_bill
```

`residualPaise` is then **recomputed** as `total − SUM(confirmed allocations)`
every time an allocation moves. There is no `paid` boolean anywhere in the
schema. Only `CONFIRMED` payments count — a draft payment sitting on screen must
not move a residual.

### `JournalEntry` — append-only, with a resolution trace

Posted entries are immutable. `postingTrace` is a JSON column holding the record
of which configuration rung produced each account, which the "Explain this
entry" panel renders verbatim.

---

## 5. The posting engine

### 5.1 The pipeline

Every document type collapses to the same shape and runs the same five steps:

```
   1. Resolve the journal        by type (SALES / PURCHASE / BANK / CASH)
   2. Load posting context       company settings + all accounts, once
   3. Assert the period is open  no posting on or before the lock date
   4. Build lines                walk a resolution chain per amount
   5. Close the entry            derive the balancing line by subtraction
   6. Write                      insert entry + items, both POSTED
```

Steps 4 and 5 are where the interesting decisions live.

### 5.2 The resolution chains — why there are no account names in the engine

A hardcoded posting engine and a config-driven one produce **identical output on
the happy path**. A demo video cannot tell them apart. A judge can, with one
edit: change a setting, post again, and see whether the entry lands somewhere
else.

Every amount that needs an account walks one of five chains. The first non-null
rung wins.

| Chain | What it resolves | Rungs, in order |
| --- | --- | --- |
| **R1** | Sales line net | `line.accountId` → `product.income` → `category.income` → `journal.default` |
| **R2** | Purchase line net | `line.accountId` → `product.expense` → `category.expense` → `journal.default` |
| **R3** | Tax | `tax.collected/paid` → company default |
| **R4** | Counterparty | `contact.receivable/payable` → company default |
| **R5** | Money | `journal.default` of the Bank or Cash journal |

The implementation is a chain of `??`, and each rung records itself as it fires:

```ts
const resolved =
  hit(ctx, "R2.1", "bill_line.account_id",             line.accountId,              amt) ??
  hit(ctx, "R2.2", "product.expense_account_id",       p.expenseAccountId,          amt) ??
  hit(ctx, "R2.3", "product_category.expense_account_id", p.categoryExpenseAccountId, amt) ??
  hit(ctx, "R2.4", "journal.default_account_id",       ctx.journal.defaultAccountId, amt);

if (!resolved) throw new PostingError("NO_EXPENSE_ACCOUNT", { label: line.label });
```

**One schema decision exists purely to keep this honest.** `accountId` on
`VendorBillLine` and `CustomerInvoiceLine` is **nullable**. Had it been
required, rung 1 would fire on every single line and the chain below it would be
decorative. NULL means "not overridden", which is what lets the engine actually
walk to rung 2, 3 or 4. The grid still *displays* an account — it shows the
resolved one — so the screen matches the mockup while the chain stays real.

Where R3 sends tax matters and is easy to get wrong: output tax on a sale is a
**liability** (money held for the government until you file), input tax on a
purchase is an **asset** (money the government owes back). Putting either into
Sales Income overstates revenue *and still balances* — the worst kind of bug,
because everything looks fine.

### 5.3 The balancing line is derived, never computed

This is the single most important function in the engine.

```ts
export function closeEntry(lines: PostingLine[], control: ControlAccount | null): void {
  const debit  = lines.reduce((s, l) => s + l.debitPaise,  0n);
  const credit = lines.reduce((s, l) => s + l.creditPaise, 0n);
  const difference = debit - credit;

  if (difference === 0n) return;              // manual entries arrive balanced
  if (!control) throw new PostingError("NO_CONTROL_ACCOUNT", { ... });

  lines.push(
    difference > 0n
      ? { ...control, label: "Payable",    debitPaise: 0n,          creditPaise: difference }
      : { ...control, label: "Receivable", debitPaise: -difference, creditPaise: 0n },
  );
}
```

The control line is **defined as "whatever makes debits equal credits"**.
Nothing anywhere computes `total = subtotal + tax`.

That distinction is the whole point. If per-line tax rounding leaves the entry
lopsided by a paisa, the quirk lands on the receivable or payable — which is
where an accountant expects it — and the entry still posts. Compute the control
line independently and you reintroduce exactly the bug this design exists to
prevent.

### 5.4 What each document posts

**Customer invoice** — Rs 50,000 of tables plus 18% GST:

| Account | Chain | Debit | Credit |
| --- | --- | ---: | ---: |
| Debtors A/c | R4.2 | 59,000.00 | |
| Sales Income A/c | R1.4 | | 50,000.00 |
| Output GST A/c | R3.1 | | 9,000.00 |

**Vendor bill** — Rs 60,000 of chairs plus 18% GST:

| Account | Chain | Debit | Credit |
| --- | --- | ---: | ---: |
| Purchase Expense A/c | R2.4 | 60,000.00 | |
| Input GST A/c | R3.1 | 10,800.00 | |
| Creditors A/c | R4.2 | | 70,800.00 |

**Payment received** — Rs 47,200 into the bank:

| Account | Chain | Debit | Credit |
| --- | --- | ---: | ---: |
| Bank A/c | R5.1 | 47,200.00 | |
| Debtors A/c | R4.2 | | 47,200.00 |

Note what the payment entry does **not** touch: Income. The sale was earned when
the invoice posted, not when the money arrived. That is the accrual principle,
and treating a payment as revenue is precisely what a fake system gets wrong —
it double-counts revenue and the Balance Sheet stops balancing.

### 5.5 Gapless document numbering

`INV/2026/0001` is allocated **at post time, inside the posting transaction** —
never at draft creation. A draft that is abandoned burns no number, and if the
post fails the whole transaction rolls back including the counter.

The allocation is a single atomic `UPDATE ... RETURNING`, so two users
confirming at the same instant cannot collide.

One deliberate subtlety: the year segment is the **calendar** year, not the
fiscal year. An invoice dated 10-Feb-2027 is fiscal 2026, but printing
`INV/2026/0004` on it would look like a bug to everyone who is not an
accountant. Fiscal-year boundaries still govern the P&L period and retained
earnings.

### 5.6 Reset to Draft and reversal

Immutability has exactly two sanctioned escapes, both guarded:

- **Reverse** — writes a mirror-image entry. Both rows stay in the books
  forever, linked by `reversalOfId`. This is how a posted document is cancelled.
- **Reset to Draft** — admin-only. Checks the period lock, refuses if any
  payment has been allocated against the document, unlatches the database guard
  for that transaction only, and writes an audit row. Covered in §6.3.

---

## 6. Integrity: three independent layers

Application code can be argued with. A constraint cannot.

### Layer 1 — TypeScript

`bigint` everywhere, `assertBalanced()` before any write, typed `PostingError`
codes that mirror the database constraint names.

### Layer 2 — the database

This is the layer that holds even against a seed script, a raw SQL session, or
a `psql` prompt. The highlights:

**One-sided items.** A journal item is non-negative, non-empty, and exactly one
side is filled:

```sql
ALTER TABLE journal_item ADD CONSTRAINT journal_item_one_sided CHECK (
      debit_paise >= 0 AND credit_paise >= 0
  AND (debit_paise = 0 OR credit_paise = 0)
  AND (debit_paise + credit_paise) > 0
);
```

Without this, the tempting "fix" for an unbalanced entry is a negative debit — a
credit wearing a disguise, which makes every report's sign handling wrong in a
way that is nearly impossible to find.

**The deferred balance assertion.** An entry is built line by line, so after
inserting the debit it is *temporarily* unbalanced — that is normal.
`DEFERRABLE INITIALLY DEFERRED` moves the check to `COMMIT`, so the assertion is
that the **transaction** balances. That is the actual accounting rule.

It fires from both sides. The item-side trigger is obvious; the **header-side**
trigger is essential and easy to forget, because the posting routine's final
statement is `UPDATE journal_entry SET state='POSTED'`, which touches no item
row at all. Without it, the balance assertion would never run on the one
transition that matters.

The same function also asserts the four denormalised columns agree with their
parent — which is what makes it safe for every report to read `journal_item`
without joining upward.

Balance is asserted **only for POSTED entries**. The mockup draws a manual
journal entry form where the user types lines and *then* presses Post; an
unconditional check would make saving a half-typed draft impossible.

**The payment badge, compiled into the schema.** The status legend is not a
render-time convention, it is a constraint:

```sql
ALTER TABLE customer_invoice ADD CONSTRAINT invoice_payment_state_correct CHECK (
  payment_state = (CASE
    WHEN residual_paise = 0           THEN 'PAID'
    WHEN residual_paise = total_paise THEN 'NOT_PAID'
    ELSE                                   'PARTIAL'
  END)::"PaymentState"
);
```

`paymentStateFor()` in TypeScript compiles the identical branch. That is not
duplication — the constraint is the proof, the function is the render path, and
a test asserts they agree. If they ever diverge, the result is a failed INSERT,
not a wrong badge that survives to the demo.

**Line totals cannot disagree with quantity × price**, using the exact integer
expression TypeScript uses, so the two can never disagree about what a line
total is:

```sql
CHECK (subtotal_paise = (quantity_milli * unit_price_paise + 500) / 1000)
```

**Also enforced:** allocations target exactly one document and are positive;
payments cannot be over-allocated; residuals stay within `[0, total]`; partial
conversion cannot over-bill a PO line; `total = untaxed + tax`; due date is
never before document date; tax rates are 0–10000 bp; login IDs are 6–12
characters; a budget cannot revise itself; and **partial unique indexes**
guarantee exactly one account holds each singleton role (Current Year Earnings,
Retained Earnings, Rounding) — because the Balance Sheet asks the database for
"the current year earnings account" and that question must have exactly one
answer.

### 6.3 Append-only, and the back door that had to be closed

Posted items are frozen by a trigger:

```
ERROR: journal_item_is_append_only: item X belongs to POSTED entry Y
       - cancel it with a reversal entry instead
```

That trigger reads the **parent entry's state** to decide whether a line is
frozen. Which meant the way around it was never to edit a posted line at all —
it was to demote its entry first:

```sql
UPDATE journal_entry SET state = 'DRAFT' WHERE id = '...';  -- was allowed
UPDATE journal_item  SET debit_paise = 1  WHERE ...;        -- now allowed
```

Two statements, no application code, and the ledger is editable. This was found
by the smoke test's own cleanup block, which was doing exactly that.

Reset-to-Draft is a real feature — the mockup draws the button and Odoo ships
it — so the fix is not to forbid the transition, but to make it impossible to
perform **anonymously**. A caller must opt in within its transaction:

```sql
SET LOCAL app.allow_reset = 'on';
```

`resetEntryToDraft()` sets that flag only *after* verifying admin rights, the
period lock and outstanding allocations, and it writes an audit row in the same
transaction. `SET LOCAL` dies with the transaction, so the escape hatch can
never be left propped open. Posted entries also cannot be deleted.

### Layer 3 — the audit harness

`npm run audit` reads the database as it stands and re-derives everything
independently. See §8.

---

## 7. Reports

Every report is a query over `journal_item WHERE state = 'POSTED'`. Nothing
reads a document total.

| Report | Derivation |
| --- | --- |
| **Trial Balance** | `SUM(debit)` vs `SUM(credit)` over everything. The single number that proves the books are real. |
| **Balance Sheet** | Asset / Liability / Capital accounts as at a date, plus two derived equity rows. |
| **Profit & Loss** | Income − Expense − Other Expense over a period. |
| **Budget actuals** | `SUM` over items tagged with an analytic account inside the budget window. |
| **Partner ledger / aging** | Items filtered by `partner_id`, bucketed by `due_date`. |

Reports are driven by `account.type` and `account.subtype`, **never by account
name**. Rename "Sales Income A/c" to anything you like and the P&L still finds
it.

Two rows on the Balance Sheet are computed rather than read:

- **Current Year Earnings** = the P&L for the current fiscal year to date
- **Retained Earnings** = the P&L for everything before it

Without those the equation cannot hold, because profit lives in income and
expense accounts that the Balance Sheet does not otherwise show. `achieved`,
`achievedPercent` and `amountToAchieve` are likewise **not columns** — they are
computed at read time, so a manual entry or a reversal is reflected too.

One deliberate correction to the spec: the mockup's chart-of-accounts list types
"Other Expense A/c" as `Expense`, but its own P&L formula says *"Other Expense —
Total of account type Other Expense"* and its type dropdown has a distinct
Other Expenses leaf. Typing it as `EXPENSE` would make that P&L row print zero
forever while double-counting into Purchase Expense. We follow the report
formula.

---

## 8. Verification

Three independent harnesses, none of which trusts the others.

### `npm run seed`

Five and a half months of trading history — 12 invoices, 6 bills, 14 payments
(including one bill settled by two separate payments across cash and bank), and
six months of rent. **Every journal item is produced by calling the real posting
engine.** Nothing is inserted into `journal_item` directly.

Result: **98 journal items across 39 entries**, debits and credits both
Rs 24,82,000.

### `npm run audit`

39 checks that re-derive every figure from the database as it stands:

```
1. Ledger integrity          trial balance ties; every entry balances on its own;
                             header totals match items; no negative or two-sided
                             items; denormalised columns agree with their parent
2. Nothing bypassed          every posted document owns an entry; every entry
   the engine                points at a document that exists; every one carries
                             a resolution trace
3. Residuals derived         residual = total − confirmed allocations; badges
                             match; open invoices sum to the Debtors control
                             account and open bills to Creditors
4. Balance Sheet             Rs 9,92,000 on both sides, every account on target
5. P&L                       net Rs 2,10,000, equal to the Balance Sheet's
                             Current Year Earnings
6. Budget                    Rs 1,48,000 of Rs 1,60,000 achieved — 92.5%
7. Numbering                 invoices, bills and payments gapless
```

Check 3 is the one that catches a faked subledger. The documents say customers
owe Rs 2,58,000; the Debtors account — built independently, line by line, by
the posting engine — must say exactly the same. Two completely separate paths
to one number.

Check 5 is the equivalent for the reports: the P&L and the Balance Sheet are
computed separately and must agree on profit.

### `npm test` — 42 unit tests

Half-up rounding, the per-line-vs-total tax divergence, Indian digit grouping,
the balancing-line derivation including the rounding-absorption property, the
payment badge's ordered evaluation, and the deliberate calendar-year /
fiscal-year split.

### `scripts/sql/smoke-integrity.sql`

Attacks the database directly with `psql`, bypassing the application entirely.
Seven blocks, four of which are supposed to fail:

| # | Attack | Result |
| --- | --- | --- |
| 1 | Commit an unbalanced POSTED entry | rejected at COMMIT — `journal_entry_must_balance` |
| 2 | Insert a negative debit | rejected — `journal_item_one_sided` |
| 3 | Commit an unbalanced **draft** | **succeeds**, as it must |
| 4 | Commit a balanced POSTED entry | succeeds |
| 5 | `UPDATE` a posted item | rejected — `journal_item_is_append_only` |
| 6 | Demote a posted entry to draft | rejected — `journal_entry_is_append_only` |
| 7 | The same, with `SET LOCAL app.allow_reset` | succeeds — the audited path |

---

## 9. File map

```
prisma/
  schema.prisma                          26 models
  migrations/
    ..._init/                            tables, enums, FKs (Prisma-generated)
    ..._ledger_integrity/                CHECKs, triggers, partial/covering indexes
    ..._posting_trace_and_defaults/      postingTrace + company fallback accounts
    ..._nullable_line_account/           makes chains R1/R2 walkable
    ..._entry_state_guard/               closes the demote-to-draft back door
  seed.ts                                history posted through the real engine

src/lib/
  money.ts                               paise / milli-units / basis points
  db.ts                                  Prisma client + the `Tx` handle
  accounting/
    account-type.ts                      type -> report section, balance side
    dates.ts                             UTC-midnight dates, fiscal years
    errors.ts                            PostingError codes mirroring constraints
    sequence.ts                          gapless numbering
    resolution.ts                        chains R1-R5 + trace
    posting.ts                           closeEntry, writePostedEntry, post*()
    documents.ts                         confirm, residual, totals, order state
  reports/
    ledger.ts                            balances, trial balance, drill-down
    balance-sheet.ts
    profit-loss.ts
    budget.ts

scripts/
  audit.ts                               39-check harness
  sql/smoke-integrity.sql                direct attack on the constraints
```

---

## 10. Running it

```bash
docker run -d --name odoo-pg -p 5433:5432 \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=urbanfurniture postgres:16

npm install
npx prisma migrate deploy
npx prisma generate

npm run seed      # post five months of history through the engine
npm run audit     # 39 checks — expect "The books tie out."
npm test          # 42 unit tests
npm run dev
```

`.env`:

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/urbanfurniture?schema=public"
SESSION_SECRET="dev-only-change-me"
DEMO_TODAY="2026-09-15"
```

`DEMO_TODAY` exists so reports are reproducible: "as of today" is a fixed date,
not whenever the demo happens to be run.

---

## 11. Design decisions worth defending

| Decision | Why |
| --- | --- |
| `BIGINT` paise, not `Decimal` | `===` is exact. Balance checking is the core assertion and it must not depend on an epsilon. |
| Balance trigger is **deferred** | An entry is unbalanced mid-construction. The rule is that the *transaction* balances. |
| Balance asserted only when POSTED | The mockup lets you save a half-typed draft entry and post it later. |
| CHECK, not `GENERATED ALWAYS` | Same guarantee, but Prisma's diff engine ignores CHECKs while it *does* diff generated columns — which would put the schema in permanent drift. |
| `accountId` nullable on document lines | NULL means "not overridden", which is the only thing that makes resolution chains R1/R2 observable. |
| Denormalised columns on `journal_item` | Every report reads one table with no upward join. A trigger keeps the copies honest. |
| Control line derived by subtraction | Rounding quirks land on the receivable, and the entry cannot come out lopsided. |
| Sequence allocated at post time | Abandoned drafts burn no numbers; a failed post rolls the counter back. |
| Calendar year in document numbers | `INV/2026/xxxx` on a February 2027 invoice reads as a bug to non-accountants. |
| Payments post their own entry | Without it, Bank and Cash stay zero forever and Debtors never clears. |
| Residual and payment state recomputed | There is no `paid` boolean to drift out of sync. |
| "Other Expense" typed `OTHER_EXPENSE` | The mockup's own P&L formula demands it; its CoA list contradicts itself. |
