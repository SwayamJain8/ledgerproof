# The running order — sign in to close

Screens in the order that makes each one **explain the next**. Follow it top to
bottom and you never have to say "I'll come back to that."

Before you start: `npm run seed` · `npm run dev` · two terminal tabs ready.

---

## Why this order

Most demos go **masters → documents → reports**, which is the order you *built*
it in, not the order it *makes sense* in. The audience sits through twenty
minutes of empty forms before a single number appears.

This order is inverted on one principle:

> **Prove the books are trustworthy first. Then show what fills them.**

Once someone believes the ledger is real, everything after it lands. If you
leave the proof to the end, they have spent the whole demo quietly wondering
whether the numbers are typed in.

---

# ACT 1 — Trust (60 seconds)

## 1. `/reports/integrity` — **start here, not the dashboard**

**Say:** *"Before I show you anything, here is the system checking itself."*

Thirteen checks. Point at three:

- **Total debits equal total credits** — ₹10,13,120 both sides
- **Open invoices equal the Debtors control account** — *"documents and ledger, two completely different routes, same ₹54,400"*
- **The P&L and the Balance Sheet agree on profit** — *"two reports, one answer"*

**Say:** *"These aren't assertions I typed. Each one re-derives its number by a different route than the screen that displays it."*

---

## 2. `/reports/trial-balance`

**Say:** *"The oldest check in accounting. Every rupee written twice, both sides equal. If this doesn't hold, nothing else matters."*

Ten seconds. Move on.

---

# ACT 2 — What the business looks like (90 seconds)

## 3. `/` Dashboard

Now the four numbers mean something, because they've seen the books are sound.

| Card | Say |
|---|---|
| Money we hold ₹5,10,560 | *"Bank plus cash"* |
| Customers owe us ₹54,400 | *"Two invoices not paid in full"* |
| We owe suppliers ₹23,600 | *"One bill outstanding"* |
| Profit ₹32,000 | *"₹1,32,000 earned, ₹1,00,000 spent"* |

**Say:** *"Nothing here is stored. Every card is a fresh query over the ledger."*

---

## 4. `/reports/balance-sheet` — **the money slide**

₹5,79,360 on both sides.

**Then point at Current Year Earnings ₹32,000 and say the important line:**

> *"This one is not an account anybody posts to. It's income minus expenses, computed and injected into the equity side. **That is why it balances.** Most submissions store a number here to force it — and you can tell, because their Balance Sheet doesn't move when you post a manual entry."*

**Then click Debtors ₹54,400** → partner ledger → an invoice → its journal entry → the payment.

**Say:** *"Every number on every report is clickable all the way down to the entry that produced it."*

---

## 5. `/reports/profit-loss`

Income ₹1,32,000 − Purchases ₹80,000 − Other ₹20,000 = **₹32,000**.

**Say:** *"Same ₹32,000 as Current Year Earnings on the Balance Sheet. Two reports, computed separately, from the same table."*

> **If asked what was hardest:** *"Making these two reports two different aggregations over one table and having them agree. The Balance Sheet is cumulative to a date. The P&L is a range, sign-flipped by account type. Closing the equation with Current Year Earnings is where most implementations quietly give up."*

---

# ACT 3 — How it gets filled (2 minutes)

## 6. `/journals` — **the 20-second proof**

**Say:** *"The Sales journal's default income account lives here."*

**Do:** change it. Post a new invoice. Open the entry. It went somewhere else.

**Say:** *"I never wrote 'Sales Income' anywhere in the code. Accounts are resolved from configuration at post time."*

Set it back.

---

## 7. `/purchase-orders` → **PO0001** — do this live

12 tables ordered, **10 billed, 2 remaining**.

**Say first:** *"An order posts nothing. It's a promise, not a transaction."*

**Do:** press **Create bill** → only the remaining **2** carry across → Confirm.

**Say:** *"Bill part of an order and it stays open for the rest."*

> Profit dips ₹32,000 → ₹20,000. **Say why immediately:** *"Buying stock is an expense the moment it's billed. It comes back when the stock sells."*

---

## 8. `/bills` → **BILL/2026/0001** → its journal entry → **Explain**

```
Dr Purchase Expense  60,000
Dr Input GST         10,800
   Cr Creditors          70,800
```

**Say:** *"Input GST isn't an expense — it's an asset, because the government gives it back. Lots of people get that wrong and under-report their profit."*

**Then Explain:** *"This shows which rule produced each account — the product had none, so it fell to the category, then the journal default. Recorded at post time, not reconstructed for the screen."*

**Also point out:** BILL/0001 has a **PO button**. BILL/0002 doesn't — it was raised fresh.

---

## 9. `/invoices` — the four stories

| Invoice | Shows |
|---|---|
| INV/0001 ₹61,360 **PAID** | Two lines — 5 tables + delivery. GST computed **per line**: ₹9,000 + ₹360 |
| INV/0002 ₹70,800 **PARTIAL** | ⭐ ₹30,000 bank + ₹10,000 cash, ₹30,800 left |
| INV/0003 ₹23,600 **NOT PAID** | For the reconciliation next |
| INV/0004 **CANCELLED** | ⭐⭐ The mistake |

**On INV/0002 say:** *"One invoice, two payments, two different journals. Most systems store a paid/unpaid flag — that design can't express this. We store allocations and derive the residual."*

**On INV/0004 → open its entry → show the reversal:**

> *"This was raised against the wrong customer. There is no Edit button and no Delete button anywhere in this application. It's cancelled by posting the mirror image — both entries stay in the books forever. In accounting a Delete button is a fraud tool: it removes the evidence along with the mistake."*

---

# ACT 4 — The loud part (60 seconds)

## 10. `/reconcile` ⭐⭐ — **protect this segment**

Import `demo/bank_statement_aug2026.csv`.

| Line | Result |
|---|---|
| `NEFT/N PATHAK/INV-2026-0003` ₹23,600 | ✅ **100%** |
| `RTGS DR OPEN WOOD BILL-2026-0002` −₹23,600 | ✅ **100%** |
| `NEFT CR JOEY WILLS INV-2026-0002 PART` ₹20,000 | ⚠️ **77% — asks you** |
| `BANK CHARGES AUG QTR` −₹350 | ⬜ **no match** |

**Three lines, in order:**

1. *"The first two are both ₹23,600 — one in, one out. It never confuses an invoice for a bill, because direction filters the candidates before anything is scored."*
2. *"Every point is shown. Amount, reference, partner name, date. Nothing guessed — and the matcher has unit tests."*
3. *"The third it refuses to clear, because the amount is short. Ambiguity goes to a human, not a coin toss."*

**If asked about AI:** *"Deliberately deterministic. AI would rank the leftovers — it would never override a deterministic match and never post anything."*

---

# ACT 5 — The close (45 seconds)

## 11. `/reports/budget`

Committed ₹1,00,000 · Achieved ₹80,000 · **80%**

**Say:** *"Achieved is summed from journal items carrying the analytic tag — not from the bills. Post a manual entry against that tag and this moves too."*

---

## 12. Terminal — the tamper proof ⭐⭐⭐

```bash
npm run check:chain
```

```
entry #4 BILL/2026/0002 — changing a debit of Rs. 20,000 to Rs. 99,999
  PASS  The chain now reports itself broken
        first break: entry #4    reason: HASH_MISMATCH
```

**Say:** *"That edited a posted row directly in Postgres with the append-only triggers switched off — how an insider would do it. Every entry is sealed with sha256 of the previous hash plus its own contents, so each one commits to the whole history before it. You can't quietly edit the middle of the book. Odoo ships this for fiscal compliance."*

**Then, if there's time:**

```bash
npm run audit    # 39 checks, restated independently
npm test         # 78 unit tests
```

---

# ADMIN vs ACCOUNTANT

Two logins. **The difference is real and demonstrable, not cosmetic.**

| | **Administrator** `adminuf` | **Accountant** `priyaacc` |
|---|---|---|
| Record transactions | ✅ | ✅ |
| Create master data | ✅ | ✅ |
| View every report | ✅ | ✅ |
| **Settings** | ✅ Sees it | ❌ **Not even in the sidebar** |
| **Reset to draft** | ✅ On the newest entry | ❌ Button never appears |

### The principle

> **An accountant records what happened. An administrator sets the rules the accountant works inside.**

That's why Settings is the dividing line. It holds:

- **Books locked to** — the period lock. Once set, nobody posts before that date. Not even an admin.
- **Fallback accounts** — the last rung of the resolution chain
- **Users** — who exists and what they may do
- **Document numbering** — the sequences

None of those are day-to-day work. All of them change what every future transaction does.

### How to show it in 20 seconds

1. Signed in as **`adminuf`** — point at **Settings** at the bottom of the sidebar.
2. Sign out. Sign in as **`priyaacc` / `Priya@2026x`**.
3. **Settings is gone from the sidebar.** Type `/settings` in the URL bar directly — it redirects to the dashboard.
4. Open the newest journal entry — **no "Reset to draft" button**.
5. Sign back in as admin — the button is there.

**Say:** *"It isn't hidden in the UI and open underneath. The page itself checks, so typing the URL gets you nothing."*

### The nuance worth mentioning

> *"Reset to draft only works on the **newest** entry. Anything older is cancelled by reversal instead — because pulling an entry out of the middle of a sealed chain would leave every later seal pointing at something that isn't there. That constraint fell out of the design; we didn't decide it."*

That answer tells a judge you understood the interaction between two features rather than bolting them on separately.

---

# The 5-minute cut

If you only have five minutes, drop steps 2, 5, 11 and the second half of 9:

| Time | Screen |
|---|---|
| 0:00–0:40 | `/reports/integrity` — 13 checks |
| 0:40–1:20 | `/reports/balance-sheet` — Current Year Earnings + drill-down |
| 1:20–1:50 | `/journals` — change the default, post, show it moved |
| 1:50–2:40 | `/purchase-orders` → Create bill (partial), then Explain |
| 2:40–3:20 | `/invoices` — PARTIAL, then the cancelled one and its reversal |
| 3:20–4:15 | `/reconcile` — **the loudest bit** |
| 4:15–4:45 | Terminal — `npm run check:chain` |
| 4:45–5:00 | Admin vs accountant in one sign-out |

---

# Rules for the room

- **Open on Books Integrity.** Not the dashboard, not a login form.
- **Never fill in a form on camera** except the PO→Bill conversion.
- **When profit dips, say why before anyone asks.**
- **End on proof, not on a form.**
- If something breaks: `npm run seed && npm run audit` — fifteen seconds.

### Never say

- ❌ *"That part is hardcoded for the demo."*
- ❌ *"We didn't have time for that."*
- ❌ *"I think that's how it works."*
