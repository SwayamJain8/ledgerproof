# The Demo Data — everything on one page

Ten journal entries. Four months. Small enough to narrate line by line.

Reset it any time with **`npm run seed`**, then prove it with **`npm run audit`**.

---

## Sign in

| Role | Login | Password |
|---|---|---|
| Administrator | `adminuf` | `Admin@2026x` |
| Accountant | `priyaacc` | `Priya@2026x` |

---

## The four numbers to memorise

| | |
|---|---|
| **Total assets** | **₹5,77,000** — and liabilities + capital is the same figure |
| **Net income** | **₹30,000** |
| **Owner put in** | **₹5,00,000** |
| **Books** | **26 journal items across 10 entries** |

> If someone adds up the Balance Sheet, it ties. That is the whole point of the app.

---

## Who is in the system

**Customers** — Nimesh Pathak (Ahmedabad), Joey Wills (Mumbai)
**Vendors** — Azure Furniture (Jaipur), Open Wood (Nagpur)

**Products**

| Product | We sell at | We buy at |
|---|---|---|
| Wooden Table | ₹10,000 | ₹6,000 |
| Office Chair | ₹2,000 | ₹1,000 |
| Sofa Set | ₹30,000 | ₹18,000 |
| Delivery Charge *(service)* | ₹1,000 | — |

Everything carries **GST 18%**.

---

## The story, in order

| # | Date | What happened | Why it is there |
|---|---|---|---|
| 1 | 01 Apr | Owner puts in **₹5,00,000** (₹4,50,000 bank + ₹50,000 cash) | A real manual journal entry. Makes Capital real. |
| 2 | 10 Apr | **PO0001** to Azure: 20 tables @ ₹6,000. Only **10 delivered** → BILL/2026/0001 for **₹70,800** | PO → Bill, **partial**. 10 tables still unbilled. |
| 3 | 20 Apr | Azure paid **₹70,800** by bank | Bill goes to PAID |
| 4 | 05 May | **BILL/2026/0002** from Open Wood, **₹23,600** — raised with **no PO** | PO smart button stays hidden. Left unpaid → this *is* your Creditors figure. |
| 5 | 12 May | **SO0001** for Nimesh → **INV/2026/0001**, ₹59,000 | SO → Invoice |
| 6 | 25 May | Nimesh pays **₹59,000** by bank | Invoice goes to PAID |
| 7 | 10 Jun | **INV/2026/0002** for Joey, ₹70,800 — **no sales order** | SO smart button stays hidden |
| 8 | 28 Jun | Joey pays **₹30,000** only | **PARTIAL** badge, residual **₹40,800** |
| 9 | 05 Jul | **INV/2026/0003** for Nimesh, **₹23,600** | Left open, for the reconciliation demo |
| 10 | 31 Jul | Showroom rent **₹20,000**, cash | The only Other Expense in the P&L |

---

## Two things left unfinished on purpose

Do these **live** — they run against real data and prove the flows work:

1. **PO0001 still has 10 tables unbilled** → Purchase Orders → PO0001 → **Create bill**
2. **SO0002** (Joey, 3 tables, ₹30,000) is confirmed but never invoiced → Sales Orders → SO0002 → **Create invoice**

---

## What the reports say

**Balance Sheet** — as of any date you like

| Assets | | Liabilities & Capital | |
|---|---|---|---|
| Bank | ₹4,68,200 | Creditors | ₹23,600 |
| Cash | ₹30,000 | Output GST | ₹23,400 |
| Debtors | ₹64,400 | Capital | ₹5,00,000 |
| Input GST | ₹14,400 | Current Year Earnings | ₹30,000 |
| **Total** | **₹5,77,000** | **Total** | **₹5,77,000** |

> Debtors ₹64,400 = Joey's unpaid ₹40,800 + Nimesh's open ₹23,600. Click it and drill down.

**Profit & Loss** — 01 Apr to date

```
Income                     1,30,000
  Purchase Expense          -80,000
  Other Expense (rent)      -20,000
Net income                   30,000   <- the same figure on the Balance Sheet
```

**Budget** — "Showroom Fitout Q1", Apr–Jun

```
Committed  1,00,000
Achieved     80,000   (the two vendor bills)
To achieve   20,000
                80%
```

---

## Bank reconciliation

Import **`demo/bank_statement_aug2026.csv`** (4 lines). What happens:

| Line | Result |
|---|---|
| `NEFT/N PATHAK/INV-2026-0003` ₹23,600 | ✅ **auto, 100%** — amount + reference + name all agree |
| `RTGS DR OPEN WOOD BILL-2026-0002` −₹23,600 | ✅ **auto, 100%** — money *out*, so it can only be a bill |
| `NEFT CR JOEY WILLS INV-2026-0002 PART` ₹20,000 | ⚠️ **77% — needs you** — the amount is short, so it asks |
| `BANK CHARGES AUG QTR` −₹350 | ⬜ **no match** — says so, rather than guessing |

**The line worth saying out loud:** the first two are both ₹23,600 — same amount, opposite direction — and it never confuses an invoice for a bill.

---

## Prove it in a terminal

```bash
npm run audit              # 39 checks: the books tie out
npm test                   # 68 unit tests
npm run check:orders       # PO -> Bill -> partial -> remainder
npm run check:reconcile    # score the statement without settling it
npm run check:budget       # the revision rules
```

Anything that writes data prints a reminder — `npm run seed` puts it all back.

---

## If something goes wrong mid-demo

```bash
npm run seed && npm run audit
```

Fifteen seconds, and you are back to exactly this page.
