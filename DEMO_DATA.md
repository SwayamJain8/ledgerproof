# The Demo Data — one page

Thirteen journal entries. Four months. Every number below is verified live.

Reset with **`npm run seed`**, prove it with **`npm run audit`**.
Start from nothing instead: **`npm run seed:empty`** (see WALKTHROUGH.md).

---

## Sign in

| Role | Login | Password |
|---|---|---|
| Administrator | `adminuf` | `Admin@2026x` |
| Accountant | `priyaacc` | `Priya@2026x` |

---

## Four numbers to memorise

| | |
|---|---|
| **Total assets** | **Rs 5,79,360** — and liabilities + capital is the same |
| **Net income** | **Rs 32,000** |
| **Owner put in** | **Rs 5,00,000** |
| **Books** | **35 journal items across 13 entries** |

---

## The story

| # | Date | What happened | Covers |
|---|---|---|---|
| 1 | 01 Apr | Owner puts in Rs 5,00,000 (4,50,000 bank + 50,000 cash) | Manual entry, Capital |
| 2 | 10 Apr | PO0001 to Azure: 12 tables @ 6,000 | Order posts nothing |
| 3 | 18 Apr | Only 10 arrive -> BILL/0001 Rs 70,800 | **Partial** PO conversion |
| 4 | 25 Apr | Azure paid in full, bank | Bill -> PAID |
| 5 | 05 May | Open Wood bill Rs 23,600, **no PO**, unpaid | Creditors, hidden PO button |
| 6 | 12 May | SO0001 -> INV/0001 Rs 61,360 (**2 lines**: 5 tables + delivery) | Per-line GST, service product |
| 7 | 25 May | Nimesh pays Rs 61,360 | Invoice -> PAID |
| 8 | 10 Jun | INV/0002 Joey Rs 70,800, **no SO** | Hidden SO button |
| 9 | 28 Jun | Joey pays Rs 30,000 (bank) | **PARTIAL** |
| 10 | 15 Jul | Joey pays Rs 10,000 (**cash**) | One invoice, **two payments, two journals** |
| 11 | 05 Jul | INV/0003 Rs 23,600, left open | For reconciliation |
| 12 | 20 Jul | INV/0004 raised in error -> **cancelled by reversal** | **No delete, only reversal** |
| 13 | 31 Jul | Rent Rs 20,000 cash | Other Expense |

**Left unfinished on purpose:** PO0001 has **2 tables** unbilled, and **SO0002**
(Joey, 3 tables, Rs 35,400) was never invoiced. Do both live.

---

## The books

| Assets | | Liabilities & Capital | |
|---|---|---|---|
| Bank | Rs 4,70,560 | Creditors | Rs 23,600 |
| Cash | Rs 40,000 | Output GST | Rs 23,760 |
| Debtors | Rs 54,400 | Capital | Rs 5,00,000 |
| Input GST | Rs 14,400 | **Current Year Earnings** | **Rs 32,000** |
| **Total** | **Rs 5,79,360** | **Total** | **Rs 5,79,360** |

Debtors Rs 54,400 = Joey's Rs 30,800 + Nimesh's Rs 23,600.

```
Income                    1,32,000
  Purchase Expense         -80,000
  Other Expense (rent)     -20,000
Net income                  32,000   <- same as Current Year Earnings
```

**Budget** "Showroom Fitout Q1": committed Rs 1,00,000, achieved Rs 80,000, **80%**.

---

## Bank reconciliation

`demo/bank_statement_aug2026.csv` — 4 lines:

| Line | Result |
|---|---|
| `NEFT/N PATHAK/INV-2026-0003` Rs 23,600 | auto, **100%** |
| `RTGS DR OPEN WOOD BILL-2026-0002` -Rs 23,600 | auto, **100%** |
| `NEFT CR JOEY WILLS INV-2026-0002 PART` Rs 20,000 | **77% - asks you** |
| `BANK CHARGES AUG QTR` -Rs 350 | **no match**, says so |

The first two are both Rs 23,600 - one in, one out - and it never confuses an
invoice for a bill.

---

## Prove it

```bash
npm run audit            # 39 checks
npm test                 # 78 unit tests
npm run check:chain      # tamper with the DB, watch it get caught
npm run check:orders     # PO -> partial bill -> remainder
npm run check:reconcile  # score the statement without settling it
npm run check:budget     # revision rules
```

---

## If something breaks mid-demo

```bash
npm run seed && npm run audit
```
