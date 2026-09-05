# LedgerProof — the pitch, page by page

Everything here is **verified against the live database**, not aspirational.
Every figure below is what the app actually renders right now.

---

## The one sentence

> **Every number in this application is derived from one immutable table — `journal_item`.
> Nothing is ever summed from invoices.**

If you say nothing else, say that. It is the whole architecture, and it is the
thing most competing teams will get wrong.

---

## The 60-second version

> "This is an accounting system for a furniture shop. The interesting part is not
> the screens — it's that there is exactly **one source of truth**. Every
> document you post — a bill, an invoice, a payment — goes through a single
> posting engine that writes balanced double-entry lines into one table. Every
> report on this site, the Balance Sheet, the P&L, the budget actuals, is a
> *query over that table*. Nothing is cached, nothing is stored twice, nothing
> is summed off the invoice list.
>
> That sounds like an implementation detail until you try to break it. Post a
> manual journal entry — the Balance Sheet moves. Change which account the Sales
> journal points at — the next invoice posts differently. Edit a posted row
> directly in Postgres with the triggers switched off — the hash chain tells you
> which entry was touched.
>
> The books are ₹5,77,000 on both sides, and there are 13 live checks on the
> Books Integrity page that re-derive that in front of you."

---

## Page by page

### 1. Dashboard — `/`

**What it is:** four figures, all re-derived from the ledger on every load.

| Card | Value | Where it comes from |
|---|---|---|
| Money we hold | **₹4,98,200** | sum of BANK + CASH account balances |
| Customers owe us | **₹64,400** across 2 invoices | the Debtors control account |
| We owe suppliers | **₹23,600** across 1 bill | the Creditors control account |
| Profit so far · FY 2026–27 | **₹30,000** | ₹1,30,000 earned less ₹1,00,000 spent |

**Say:** *"Nothing on this page is stored. Every card is a fresh aggregation over
journal items as of today's date."*

**If they ask why profit is only ₹30,000 on ₹1,30,000 of sales:** because we
bought ₹80,000 of stock and paid ₹20,000 rent. Purchases are expensed when
billed — that is the method the problem statement's own P&L formula describes.

---

### 2. Chart of Accounts — `/accounts`

**What it is:** the 15 buckets every transaction is classified into. Eight are
the ones the spec mandates; the rest are ones the engine cannot work without
(Current Year Earnings, Retained Earnings, rounding).

**Say:** *"Account **type** is what drives the reports — not the name. Balance
Sheet reads Asset, Liability and Capital; P&L reads Income, Expense and Other
Expense. You could rename every account here and no report would break."*

---

### 3. Journals — `/journals`

**What it is:** Sales, Purchase, Bank, Cash — and the default account each one
posts to.

**This is your best 20 seconds.** The Sales journal's default income account is
editable on this page.

**Do:** change it, then post a new invoice, then open the entry. It posts to the
new account.

**Say:** *"That is the difference between a posting engine and a pile of
if-statements. The accounts are resolved from configuration at post time — I
didn't write 'Sales Income' anywhere in the code."*

---

### 4. Contacts / Products / Analytic Accounts

Masters. Each has **List and Kanban** views (the spec asks for both).

**Products** matter more than they look: each product can name its own income
and expense account. If it doesn't, the category is tried, then the journal
default. That is a real three-rung resolution chain, and the trace on every
entry shows which rung fired.

---

### 5. Purchase Orders — `/purchase-orders`

**PO0001 · Azure Furniture · PARTIALLY_BILLED · 12 ordered, 10 billed, 2 remaining**

**Say:** *"An order is a commitment, not a transaction. It posts nothing. Watch —"*

**Do:** open it, click **Create bill**. It carries the vendor, product, price and
quantity forward, and copies **only the 2 units still unbilled**.

**Say:** *"Bill part of an order and it stays open for the rest. The quantities
are tracked per line, so this can be done in as many instalments as the supplier
delivers in."*

> Profit dips ₹30,000 → ₹18,000 when you do this. **Say why:** buying stock is an
> expense the moment it is billed. It comes back when the stock sells.

---

### 6. Vendor Bills — `/bills`

| Bill | Vendor | Total | Residual | State | From PO? |
|---|---|---|---|---|---|
| BILL/2026/0001 | Azure Furniture | ₹70,800 | ₹0 | **PAID** | ✅ yes |
| BILL/2026/0002 | Open Wood | ₹23,600 | ₹23,600 | **NOT PAID** | ❌ no |

**Say:** *"The PO button is on the first bill and not on the second, because the
second was raised fresh. That's the spec's conditional-visibility rule."*

**The status badge is computed**, never set by hand — it is derived from the
allocation table every time.

---

### 7. Sales Orders and Invoices

**SO0002 · Joey Wills · 3 tables · ₹35,400 · never invoiced** → do this live too.

| Invoice | Customer | Total | Residual | State |
|---|---|---|---|---|
| INV/2026/0001 | Nimesh Pathak | ₹59,000 | ₹0 | PAID |
| INV/2026/0002 | Joey Wills | ₹70,800 | **₹40,800** | **PARTIAL** |
| INV/2026/0003 | Nimesh Pathak | ₹23,600 | ₹23,600 | NOT PAID |

**The PARTIAL one is the one to point at.** Joey paid ₹30,000 of ₹70,800.

**Say:** *"Most systems store a paid/unpaid flag. We store the allocations and
derive the residual, which is why a part payment is a first-class thing here
rather than an edge case."*

---

### 8. Journal Entries — `/journal-entries`

Ten entries. Open any one and click **Explain**.

**Say:** *"This panel is the answer to 'did you hardcode it?'. It shows which
rung of which resolution chain produced each account — the journal default, the
product, the category, the tax's own account. It is recorded at post time, not
reconstructed for the screen."*

---

### 9. Bank Reconciliation — `/reconcile` ⭐

**This is your loudest 45 seconds.** Import `demo/bank_statement_aug2026.csv`.

| Line | What happens |
|---|---|
| `NEFT/N PATHAK/INV-2026-0003` ₹23,600 | ✅ auto, **100%** |
| `RTGS DR OPEN WOOD BILL-2026-0002` −₹23,600 | ✅ auto, **100%** |
| `NEFT CR JOEY WILLS INV-2026-0002 PART` ₹20,000 | ⚠️ **77% — asks you** |
| `BANK CHARGES AUG QTR` −₹350 | ⬜ **no match**, and says so |

**Three things to say, in order:**

1. *"The first two are both ₹23,600 — same amount, opposite direction. It never
   confuses an invoice for a bill, because direction filters the candidates
   before scoring."*
2. *"Every point of every score is shown. Amount match, reference regex, partner
   name similarity, date proximity. Nothing is guessed — and it's covered by
   unit tests I can run right now."*
3. *"The third one it refuses to auto-clear, because the amount is short. It
   hands ambiguity to a human instead of resolving it with a coin flip."*

**If they ask about AI:** the matcher is deterministic on purpose. AI would rank
the *leftovers*, never override a deterministic match and never post anything.

---

### 10. Reports

**Trial Balance** — ₹9,27,600 debits, ₹9,27,600 credits, difference ₹0.

**Balance Sheet** — click any figure and drill down to the account ledger, then
to the entry, then to the payment.

| Assets | | Liabilities & Capital | |
|---|---|---|---|
| Bank | ₹4,68,200 | Capital | ₹5,00,000 |
| Cash | ₹30,000 | Creditors | ₹23,600 |
| Debtors | ₹64,400 | Other Liabilities (GST) | ₹23,400 |
| Other Assets (GST) | ₹14,400 | **Current Year Earnings** | **₹30,000** *(derived)* |
| **₹5,77,000** | | **₹5,77,000** | |

**The line that wins it:** *"Current Year Earnings is not an account anyone posts
to. It is computed — income minus expenses for the year — and injected into the
equity side. That is **why** it balances. Most submissions store a plug figure
here, and you can tell because their Balance Sheet doesn't move when you post a
manual entry."*

**P&L** — Income ₹1,30,000 − Purchases ₹80,000 − Other ₹20,000 = **₹30,000**, the
same number as Current Year Earnings above.

**Budget** — Showroom Fitout Q1: committed ₹1,00,000, achieved ₹80,000, **80%**.

**Say:** *"Achieved is summed from journal items carrying the analytic tag — not
from the bills that created them. Post a manual entry against that tag and this
number moves too."*

---

### 11. Books Integrity — `/reports/integrity` ⭐⭐

**Open the demo here, not on the dashboard.** 13 checks, all re-derived live:

- Total debits = total credits
- Every entry balances on its own
- No journal item is negative or two-sided
- Denormalised columns agree with their header
- Every posted document owns an entry
- Every document entry carries a resolution trace
- **Open invoices = the Debtors control account** *(two independent routes to one number)*
- **Open bills = the Creditors control account**
- Residuals are derived, not stored
- Assets = Liabilities + Capital
- **The P&L and the Balance Sheet agree on profit**
- **The hash chain is unbroken** — 10 entries re-hashed
- **Every posted entry is sealed**

**Say:** *"These aren't assertions I typed in. Each one re-derives its figure by a
different route than the screen that displays it. The subledger checks are the
strongest — the documents and the ledger arrive at ₹64,400 completely
separately."*

---

## The three proof moments

### Proof 1 — post a manual entry, watch the Balance Sheet move

`Dr Cash 50,000 / Cr Capital 50,000` → Balance Sheet changes immediately.

*"A system that sums its reports off the invoice table cannot do this. There is
nowhere for a manual entry to live."*

### Proof 2 — try to break the balance rule

Enter an entry where debits ≠ credits and press Post. It is **blocked** — and not
only by the app. The database has a `CHECK` constraint and a deferred trigger.

*"Even a script that skips my code entirely cannot write an unbalanced entry."*

### Proof 3 — tamper with the database itself ⭐

```bash
npm run check:chain
```

It edits a posted journal item **directly in Postgres with the append-only
triggers disabled**, re-verifies, and reports:

```
first break: entry #4 (BILL/2026/0002)
reason:      HASH_MISMATCH
```

then restores it.

*"Append-only triggers stop the application. They don't stop someone with a
database console. Every entry is sealed with sha256 of the previous hash plus
its own contents, so each entry commits to the whole history before it. You
cannot quietly edit the middle of the book. Odoo ships this for fiscal
compliance."*

---

## Prove it in a terminal — 30 seconds

```bash
npm run audit           # 39 checks, independently restated. The books tie out.
npm test                # 78 unit tests
npm run check:chain     # tamper with the DB, watch it get caught
npm run check:orders    # PO -> partial bill -> remainder
npm run check:reconcile # score the bank statement without settling it
```

---

## Questions you will get

**"Did you hardcode the accounts?"**
No — open the Explain panel on any entry, it names the rule that fired. Or change
the Sales journal's default account and post a new invoice.

**"Does your Balance Sheet actually balance?"**
₹5,77,000 both sides. Add it up. And Current Year Earnings is computed, not stored.

**"Can I edit a posted invoice?"**
There is no Edit button, by design. Cancel writes a mirror-image reversal and both
rows stay in the books forever.

**"What if two people post at once?"**
Document numbering takes a row lock and the hash chain takes an advisory lock, so
posts serialise. Gapless numbering is a hard requirement — a gap is the first
thing an auditor asks about.

**"Why Postgres and not Mongo?"**
Double-entry needs multi-row transactions and a `CHECK` constraint that debits
equal credits. Without those, "balanced" is a hope rather than a guarantee.

**"What's the hardest part of this?"**
Making the Balance Sheet and the P&L two *different* aggregations over the same
table, and having them agree. One is cumulative to a date; the other is a range,
sign-flipped by account type. Getting Current Year Earnings to close the equation
is where most implementations quietly give up and store a plug.

**"What would you build next?"**
GST return export (GSTR-1/3B), proper inventory with COGS matching so buying stock
stops reducing profit, and multi-currency.

---

## Never say

- *"That part is hardcoded for the demo."*
- *"We didn't have time for that."*
- Don't open with master-data CRUD. Open on **Books Integrity**.
- Don't fill in a form on camera unless it is the PO or SO conversion.

---

## If something goes wrong

```bash
npm run seed && npm run audit
```

Fifteen seconds, and you are back to exactly this page.
