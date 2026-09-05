# Build the books from nothing — step by step

Start empty, enter everything by hand, and watch each number appear.

```bash
npm run seed:empty     # clears everything, keeps only the pre-configured setup
npm run dev
```

Sign in as **`adminuf` / `Admin@2026x`**.

> **To go back to the finished demo at any time:** `npm run seed`
> **To empty it again:** `npm run seed:empty`

---

## What you start with

`seed:empty` leaves exactly what the problem statement says is pre-configured:

- **15 accounts** — the chart of accounts
- **4 journals** — Sales, Purchase, Bank, Cash
- **1 tax** — GST 18%
- **2 logins**, company settings, document numbering

and **nothing else**. No contacts, no products, no transactions.

**Look now:** `/` — every card reads **Rs. 0.00**. That is correct: nothing has happened yet.

---

# Part 1 — Set up the business

### Step 1 · Look at the Chart of Accounts

**Go to** `/accounts`

Fifteen buckets. Every rupee that ever moves lands in one of them.

| Read this | Meaning |
|---|---|
| Bank, Cash, Debtors, Input GST | **Assets** — things we have or are owed |
| Creditors, Output GST | **Liabilities** — what we owe others |
| Capital, Retained Earnings, Current Year Earnings | **Capital** — what the owner has in it |
| Sales Income | **Income** |
| Purchase Expense, Other Expense | **Expenses** |

> **The idea:** the *type* drives the reports, not the name. The Balance Sheet reads Asset/Liability/Capital. The P&L reads Income/Expense.

---

### Step 2 · Look at the Journals

**Go to** `/journals`

Four books, each with a default account. Sales posts to Sales Income, Purchase posts to Purchase Expense.

> **Remember this page.** It is your best proof later: change the default here and the next invoice posts somewhere else, with no code change.

---

### Step 3 · Create your contacts

**Go to** `/contacts` → **New contact**

Create four. Leave the control accounts on *Company default*.

| Name | Type | City |
|---|---|---|
| Nimesh Pathak | Customer | Ahmedabad |
| Joey Wills | Customer | Mumbai |
| Azure Furniture | Vendor | Jaipur |
| Open Wood | Vendor | Nagpur |

**Look after:** `/contacts` — four rows. Click **Kanban** in the top right and the same data becomes cards.

**Look also:** `/` — still all zeros. **Say why:** *creating a contact is not a transaction. Nothing has moved.*

---

### Step 4 · Create your products

**Go to** `/products` → **New product**

Set **Sales tax** and **Purchase tax** to *GST 18%* on each. Leave the accounts on *Inherit*.

| Name | Type | Sells at | Costs |
|---|---|---|---|
| Wooden Table | Goods | 10000 | 6000 |
| Office Chair | Goods | 2000 | 1000 |
| Sofa Set | Goods | 30000 | 18000 |

**Look after:** `/products` — the Income and Expense columns say **Inherit**.

> **This is deliberate.** Nothing here names an account. When you post an invoice the engine walks a chain — product, then category, then journal default — and records which rung it used. You will see that trace in Step 12.

---

### Step 5 · Create an analytic account

**Go to** `/analytics` → **New analytic account**

| Name | Code | Type |
|---|---|---|
| Showroom Fitout | FIT | Expense |

> **What it is:** a second label on top of the chart of accounts. "Purchase Expense" says *what kind of cost*; "Showroom Fitout" says *what it was for*. Tag a line with it and a budget can find it later.

---

### Step 6 · Create a budget

**Go to** `/budgets` → **New budget**

| Name | Starts | Ends | Analytic | Planned |
|---|---|---|---|---|
| Showroom Fitout Q1 | 2026-04-01 | 2026-06-30 | Showroom Fitout | 100000 |

Then press **Confirm** on the row.

**Look after:** `/reports/budget` — Committed **₹1,00,000**, Achieved **₹0**, **0%**.

> **Say:** *only the plan is stored. Achieved is summed from the ledger every time you open this page — which is why it currently reads zero.*

---

# Part 2 — Put money in

### Step 7 · The owner's capital ⭐

**Go to** `/journal-entries` → **New journal entry**

| Journal | Date | Reference |
|---|---|---|
| BNK · Bank | 2026-04-01 | Owner capital introduced |

| # | Account | Debit | Credit |
|---|---|---|---|
| 1 | 1100 · Bank A/c | 450000 | |
| 2 | 1200 · Cash A/c | 50000 | |
| 3 | 3100 · Capital A/c | | 500000 |

**Try this first:** type only lines 1 and 3. The footer says *"Out by Rs. 50,000.00"* and the Post button stays **disabled**. Add line 2 and it turns green.

Press **Post entry**.

**Look after:**

| Page | What you should see |
|---|---|
| `/` | Money we hold **₹5,00,000** |
| `/reports/balance-sheet` | Bank ₹4,50,000 · Cash ₹50,000 · Capital ₹5,00,000 · **balances** |
| `/reports/trial-balance` | debits ₹5,00,000 = credits ₹5,00,000 |
| `/reports/integrity` | 13 checks, all green |

> **The pitch line:** *"That is a hand-typed entry, and the Balance Sheet moved. A system that adds up its reports from the invoice list cannot do this — there is nowhere for an entry like this to live."*

---

# Part 3 — Buy something

### Step 8 · Raise a purchase order

**Go to** `/purchase-orders` → **New purchase order**

Vendor **Azure Furniture**, date **2026-04-10**.
Line: **Wooden Table**, qty **12**, unit price **6000**, analytic **Showroom Fitout**, tax **GST 18%**.

Save, then press **Confirm order** → it becomes **PO0001**.

**Look after:** `/` — **still all zeros**.

> **Say:** *an order is a commitment, not a transaction. It posts nothing. The ledger only moves when the bill arrives.*

---

### Step 9 · Only 10 tables arrive ⭐

On **PO0001**, press **Create bill**. It opens a draft carrying vendor, product and price forward.

**Change the quantity from 12 to 10** — that is all that was delivered — then **Confirm**.

**Look after:**

| Page | What you should see |
|---|---|
| `/purchase-orders` | PO0001 is **PARTIALLY BILLED**, 10 billed, **2 remaining** |
| `/bills` | BILL/2026/0001, ₹70,800, **NOT PAID** |
| `/` | We owe suppliers **₹70,800** |

> **Say:** *bill part of an order and it stays open for the rest. Quantities are tracked per line, so this can go in as many instalments as the supplier delivers in.*

---

### Step 10 · Look at what that did to the ledger ⭐

Open **BILL/2026/0001** and click through to its journal entry, then press **Explain**.

```
Dr  Purchase Expense    60,000     <- 10 x 6,000
Dr  Input GST           10,800     <- 18%
Cr  Creditors           70,800     <- what we now owe Azure
```

> **The pitch line:** *"I never typed 'Purchase Expense' anywhere. The Explain panel shows which rule produced each account — the product had none, so it fell through to the category, then to the Purchase journal's default. That trace was recorded when it posted, not reconstructed for this screen."*

**Look also:** `/reports/budget` — Achieved is now **₹60,000**, **60%**.

> *"That came from the journal item's analytic tag, not from the bill."*

---

### Step 11 · Pay Azure

On the bill, **Register payment** — ₹70,800, method **Bank**, date **2026-04-20**.

**Look after:**

| Page | What you should see |
|---|---|
| `/bills` | badge flips to **PAID**, residual ₹0 |
| `/reports/balance-sheet` | Bank **₹3,79,200** · Creditors **₹0** |

> **Say:** *the badge is computed from the allocation table, never set by hand. Total assets fell because we spent real money — and liabilities fell by exactly the same amount.*

---

# Part 4 — Sell something

### Step 12 · Sales order → invoice

**Go to** `/sales-orders` → **New sales order**
Customer **Nimesh Pathak**, date **2026-05-12**, line: **Wooden Table** × **5** @ **10000**, tax GST 18%.

Save → **Confirm order** → **Create invoice** → **Confirm**.

**Look after:**

| Page | What you should see |
|---|---|
| `/invoices` | INV/2026/0001, ₹59,000, NOT PAID |
| its journal entry | `Dr Debtors 59,000 / Cr Sales Income 50,000 / Cr Output GST 9,000` |
| `/` | Customers owe us **₹59,000** · Profit **−₹10,000** |

> **Profit is negative and that is correct.** You have spent ₹60,000 on stock and only sold ₹50,000 of it so far. Say so out loud — it comes back in the next step.

---

### Step 13 · Get paid, in part ⭐

Register a payment on the invoice — but only **₹30,000**, method Bank.

**Look after:** `/invoices` — badge reads **PARTIAL**, residual **₹29,000**.

> **The pitch line:** *"Most systems store a paid/unpaid flag, so a part payment is an edge case they fake. We store the allocations and derive the residual, so it is a first-class thing."*

---

### Step 14 · One more sale, left open

New invoice directly (no sales order): `/invoices` → **New invoice**
Customer **Joey Wills**, date **2026-06-10**, **Sofa Set** × **2** @ **30000**.

Confirm it, and **do not pay it**.

**Look after:** `/invoices` — the SO smart button is on invoice 1 and **absent** on this one.

> **Say:** *that button appears only when the invoice came from a sales order. It's a conditional-visibility rule from the spec.*

---

### Step 15 · Pay the rent

`/journal-entries` → **New journal entry**, journal **CSH · Cash**, date **2026-07-31**, reference *Showroom rent*.

| Account | Debit | Credit |
|---|---|---|
| 6100 · Other Expense A/c | 20000 | |
| 1200 · Cash A/c | | 20000 |

**Look after:** `/reports/profit-loss` — an **Other Expense** row appears, separate from Purchase Expense.

---

# Part 5 — The proof

### Step 16 · Bank reconciliation ⭐

**Go to** `/reconcile`. Paste this in:

```
Date,Narration,Amount
12/08/2026,NEFT CR JOEY WILLS INV-2026-0002,70800.00
14/08/2026,NEFT/N PATHAK/INV-2026-0001 BAL,29000.00
20/08/2026,BANK CHARGES AUG QTR,-350.00
```

**Look after:** the first two match with a confidence score and every signal listed — amount, reference, partner name, date. The bank charge matches **nothing**, and says so.

> **Say:** *every point of every score is arithmetic or a regex. Nothing is guessed, and it's covered by unit tests. Where it isn't sure, it asks a human instead of tossing a coin.*

Press **Reconcile** on the confident ones and watch Debtors fall.

---

### Step 17 · Books Integrity ⭐⭐

**Go to** `/reports/integrity`

Thirteen checks, each re-deriving its figure by a different route than the screen that shows it.

The two strongest:
- **Open invoices = the Debtors control account** — documents and ledger, arrived at separately
- **The P&L and the Balance Sheet agree on profit**

---

### Step 18 · Try to break it

**Go to** `/journal-entries` → **New journal entry**. Enter a line with a debit and no matching credit.

The Post button never enables. And if you got past the screen, the database has a `CHECK` constraint and a deferred trigger that would refuse the transaction.

Then, in a terminal:

```bash
npm run check:chain
```

It edits a posted row **directly in Postgres with the append-only triggers switched off**, then reports which entry broke and restores it.

> **The closing line:** *"Triggers stop the application. They don't stop someone with a database console. Every entry is sealed with sha256 of the previous hash plus its own contents, so each one commits to the whole history before it. You cannot quietly edit the middle of the book."*

---

## Cheat sheet — where to look after each step

| You did | Look here | Should change |
|---|---|---|
| Created a contact or product | `/contacts`, `/products` | Nothing on the dashboard — not a transaction |
| Posted opening capital | `/reports/balance-sheet` | Capital and Bank appear |
| Confirmed a purchase order | `/purchase-orders` | Still nothing in the ledger |
| Confirmed a bill | `/bills`, `/reports/budget` | Creditors up, budget Achieved up |
| Registered a payment | `/reports/balance-sheet` | Bank down, Creditors down |
| Confirmed an invoice | `/`, `/reports/profit-loss` | Debtors up, Income up |
| Took a part payment | `/invoices` | Badge → PARTIAL, residual drops |
| Anything at all | `/reports/integrity` | 13 checks stay green |

---

## If you get stuck

```bash
npm run seed:empty     # back to a clean, configured, empty business
npm run seed           # back to the finished ten-entry demo
npm run audit          # 39 checks against the finished demo
```
