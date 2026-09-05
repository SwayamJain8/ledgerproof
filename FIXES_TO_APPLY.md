# Fixes To Apply Before Building

Three independent critics reviewed the full master plan. Sections 01 and 02 were revised;
sections 03-10 were NOT. These are the findings that still need applying.

Full critic output: `docs/KNOWN_ISSUES_from_critics.md`

---

## CRITICAL — will break in front of a judge

### 1. Money type is specified two incompatible ways
- Sections **04, 08** say `Decimal(14,2)`
- Sections **05, 06, 09** say integer paise `BIGINT`

**Decision: use `BIGINT` paise.** Reason: exact equality when checking debit == credit,
no float drift, 3 of 5 sections already assume it.

Fix in section 04: `§4.4`, all schema blocks (`Decimal @db.Decimal(14,2)` -> `BigInt`),
`§4.8` constraints 4/5/6, `§4.9` index `INCLUDE (debit, credit)` -> `(debit_paise, credit_paise)`.
Fix in section 08: `§8.2` stack row, `§8.3` "Exact rupees" conclusion, `§8.7` raw SQL
`SUM(ji.debit)` -> `SUM(ji.debit_paise)`, `§8.8` schema block.

### 2. Four incompatible demo datasets
Sections 05, 06, 09, 10 each use different figures for the same seeded books.

**Decision: Section 10's numbers are canonical.** They are the only set that fully ties out
(opening 9,92,000; closing 10,81,792 = 1,96,192 + 8,85,600; Net Income 2,35,600 = CYE;
budget 1,62,400 / 101.5% / -2,400; 352 items / 41 entries).

Replace the audit blocks and worked figures in sections 05, 06, 08, 09 with section 10's.

### 3. The tamper demo will fail on stage
Section 10 runs `UPDATE journal_item SET debit = 99999 WHERE id = 217;`
Our own BEFORE UPDATE trigger blocks exactly this -> you get `posted_ledger_is_immutable`,
not a broken hash chain. The beat dies.

Use instead:
```sql
SET session_replication_role = replica;
UPDATE journal_item SET debit_paise = 9999900 WHERE id = 217;
SET session_replication_role = origin;
```
Narration: "that's my own superuser, with triggers switched off."
Put the restore command in shell history immediately after.

### 4. The balance CHECK constraint blocks draft entries
`CHECK (total_debit = total_credit)` is unconditional in section 04 `§4.8`.
But the mockup draws a manual Journal Entry form where the user types lines and THEN
presses Post - the check must fire at Post, not at every intermediate save.

Fix: make the constraint/trigger conditional on `state = 'posted'`. Drafts exempt.

---

## IMPORTANT — will cost time or credibility

### 5. Seed data does not match the demo script
Section 09 seeds `DEMO_TODAY=2026-09-05`, `bank_statement_05sep2026.csv` (10 rows),
budget "August 2026", analytic "Showroom-West Fitout", 96 entries / 412 items, FY from 01-Jan-2026.

Section 10 demos 15-Sep-2026, `bank_statement_15sep.csv` (8 rows), budget
"Q2 Furniture Procurement", analytic "Project 1", 41 entries / 352 items, FY from 01-Apr-2026.

Fix: rewrite section 09 `§5` to produce exactly what section 10 names. Add at the top:
"Every number here is dictated by the demo script - if you change one, change both."

### 6. Hour budgets disagree
Sections 06 and 09 give different hour estimates for the same four differentiators,
differing by 4+ hours total. Reconcile against the 19-hour real build budget.

### 7. Partial-payment walkthrough arithmetic (section 05 §5.9.3)
Debtors before/after is off by Rs 10,000 - `§5.5.6`'s seeded Debtors of 51,400 already
includes the 10,000 receipt that `§5.9.3` then presents as new.
Should read: `Debtors 61,400 -> 51,400`, then State 2 `51,400 -> 47,200`.

---

## Order to apply
1, 4 (schema - do before writing any code)
2, 7 (numbers - do before rehearsing)
5 (seed script - do before hour 20)
3 (demo command - do before rehearsing)
6 (planning only)
