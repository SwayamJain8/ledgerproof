

########## RESULT 1 (21064 chars) ##########

I read all ten section files in full. Findings below, worst first.

---

**1. `section_02_accounting-101.md` — an UNBALANCED journal entry inside the paragraph that teaches balancing.**
§2.8, the trap warning box: *"a judge posts a manual journal entry — *Dr Cash 50,000 / Cr Capital 5,00,000* — and your Balance Sheet doesn't move"*. Debit ₹50,000, credit ₹5,00,000. A zero-knowledge reader who is trying to trust this document will either not notice (and learn the wrong thing) or notice and lose confidence in every other number. **Fix:** change to `Dr Cash 5,00,000 / Cr Capital 5,00,000` to match §2.11 and Section 1 §6.

**2. All sections — money storage is specified three incompatible ways, and no section flags the conflict.**
- `section_04_data-model.md` §4.4: *"Money is `Decimal(14,2)`. Never `Float`."* + `amountTotal Decimal @db.Decimal(14, 2)`
- `section_08_architecture.md` §8.2: *"`Decimal(14,2)` in Postgres, `Prisma.Decimal` in TS"* and *"use `.add()`, `.sub()` … never `+`, `*`, `===`"*
- `section_05_core-engine.md` §5.2.1: *"Money is stored as integer paise. Not floats. **Not decimals-in-JS**."* + `debit_paise BIGINT`
- `section_06` §D1 and `section_09` §2 both say BIGINT paise, *"non-negotiable"*.

Sections 5/6/9 explicitly reject what sections 4/8 mandate. The reader cannot start Phase 2 without picking one, and every code sample they copy after that will be from the wrong half of the document. **Fix:** pick one (BIGINT paise wins on vote count and on the "exact equality" argument in §5.2.1), then rewrite §4.4, §4.5–4.7 schema blocks, and §8.2's Money row and §8.7's `Number(i.debit)` example to match. Add one line in whichever section keeps it: "the other option is Decimal(14,2); we rejected it because…".

**3. `section_09_build-plan.md` vs `section_10_demo-and-judge.md` — the demo script references seed data the seed plan does not create.**
Section 9 §5 seeds: `DEMO_TODAY=2026-09-05`, `demo/bank_statement_05sep2026.csv` (10 rows), budget `"August 2026"`/`"August 2026 Revised"`, analytic `"Showroom-West Fitout"`, `Bill/2026/0014`, 96 entries / 412 items, FY starting 01-Jan-2026.
Section 10 §10.1–10.3 demos: dates to **15-Sep-2026**, `bank_statement_15sep.csv` (**8 rows**), budget `"Q2 Furniture Procurement"`, analytic `"Project 1"`, `PO0007` / `SO0006` / `INV/2026/0009`, **41 entries / 352 items**, FY **1 April 2026**.
Nothing in the script exists in the seed. **Fix:** Section 10 is the one that is internally arithmetically consistent (9,92,000 → 10,81,792 all ties). Make Section 9 §5 the servant: rewrite its volume table, its ten edge cases, and its CSV table to produce exactly the records Section 10 names, and change `DEMO_TODAY` to `2026-09-15`. Add a line at the top of Section 9 §5: "Every number here is dictated by the demo script — if you change one, change both."

**4. `section_06_differentiators.md` vs `section_09_build-plan.md` — the hour budgets for the same four features differ by 4+ hours.**
Section 6 §2: D1 Books Integrity **2.5 h**, D2 bank reconciliation **3.0 h**, D3 slider 0.75 h, D4 drill-down 1.5 h = **7.75 h**.
Section 9: Phase 12 gives slider **+ integrity page together 0.75 h**; Phase 13 gives bank reconciliation **1.0 h**; Phase 10 folds drill-down into a 1.25 h block.
Time is the document's hard constraint, so a 4-hour discrepancy on the four "never cut" features is the most dangerous number in the document. **Fix:** reconcile in Section 9 (it owns the clock) and have Section 6 §2 cite Section 9's figures with a one-line note on what the smaller number buys (e.g. "1.0 h gets exact-amount + reference matching only; the trigram partner matcher is the second hour"). Section 6 §10 rule 5 already hints at this graceful degradation — surface it in the hours table.

**5. `section_10_demo-and-judge.md` demos features that `section_09_build-plan.md` puts on the optional bench.**
Section 10 §10.3 lists under *"Never cut, under any circumstances"*: **"The reversal on cancel"**, and its Control Moment also demos the **lock date** and the **hash chain / tamper self-attack**. Section 9 §GATE 3 lists *"Reversal on cancel (~40 min)"* and *"Period lock date (~25 min)"* on the **bench** — items you take *only* if you are ahead, one item, 60 minutes. Section 9's cut list also puts *"Hash chain + tamper demo"* at #7 of 10 things to drop.
So the reader can follow the build plan exactly and arrive at a demo script that is 40% impossible. **Fix:** either move reversal + lock date into a numbered phase in Section 9 (they are ~65 min combined and they carry two of Section 10's four cheat-sheet moments), or add a paragraph to Section 10 §10.3 headed "If reversal / lock date / hash chain were not built" with the substitute beat and the substitute sentence.

**6. Every section — the worked example numbers never match, so the reader cannot follow one continuous story.**
| Section | Total Assets | Current Year Earnings | entries/items |
|---|---|---|---|
| 02 §2.7 | 5,23,000 | 19,000 | 7 / 14 |
| 04 §4.6 | (invoice 47,200) | — | — |
| 05 §5.5.6 | 5,50,992 | 35,000 | 8 (text says "nine") |
| 06 §D1 | 8,42,310 | 2,18,400 | 41 / 352 |
| 08 §8.8 | 8,42,310 | (Capital+CYE 6,45,000) | 41 / 352 |
| 09 §4 | **18,42,310** | (Capital 16,45,000) | 96 / 412 |
| 10 §10.1 | 9,92,000 → 10,81,792 | 2,35,600 | 41 / 352 |

Six of these are internally correct; that is not the problem. The problem is that a reader spending an hour will read §2's ₹19,000 profit, then §5's ₹35,000 profit, then §6's ₹2,18,400, and conclude they have misunderstood something. **Fix:** declare Section 10's figures canonical (they are the ones spoken aloud). Leave §2.7's small seven-transaction set as a deliberate teaching example, but add one sentence: *"These seven transactions are a teaching set, deliberately tiny. The real seed data — the numbers you will actually demo — is in the Demo section."* Then change §5.5.6, §6 D1, §8.8 and §9's audit block to print Section 10's numbers verbatim.

**7. `section_02_accounting-101.md` teaches "eight accounts, no tax"; every later section silently uses ten, twelve or fifteen accounts and GST on every entry.**
§2.4 gives the eight seed accounts as a closed set and works all four examples with no tax at all (₹6,000 sale = 2 lines). Then §4.6 seeds **15** accounts including Input GST / Output GST / COGS / Retained Earnings / Rounding Difference; §5.3.2 says **ten**; §9 §5 says **8 + 4 = 12**. The reader's first three-line journal entry with `Output GST A/c` arrives in §4.6 with GST never having been defined, and with no explanation of *why tax is not income*.
**Fix (three edits):** (a) add a short §2.4.1 "Tax, and why it is not income" — one worked ₹40,000 + 18% = ₹47,200 invoice, the sentence *"the ₹7,200 is money you are holding for the government, so it is a liability, not revenue"*, and the two extra accounts. (b) Make §4.6, §5.3.2 and §9 §5 agree on one account count — say which of the 15 are actually seeded in a 19-hour build. (c) Every account list should mark the mockup's 8 as mandated and the rest as `[ADDITION]`, which only §4.6 currently does.

**8. `section_04_data-model.md` invents an `AccountSubtype` field that no other section uses, while three sections resolve the same ambiguity three different ways.**
§4.6 resolves "Debtors is not in the dropdown" with *"Two fields: `type` … plus `subtype` (`NONE | RECEIVABLE | PAYABLE | TAX_COLLECTED | …`)"*. But §2.4 resolves the identical ambiguity with **no subtype** (*"Debtors A/c gets type `Asset`"*), §3 §12.2 also with no subtype, and §5.1.2's account-type table has no subtype column. A reader building from §2 or §5 then hitting §4's `subtype = 'RECEIVABLE'` filters will not know whether they are missing a column. **Fix:** decide once. If subtype stays, add one sentence to §2.4's resolution box and §5.1.2's table pointing at it ("we also carry a `subtype` role tag — see Data Model §4.6 — so the posting engine can ask for 'the receivable account' rather than matching a name"). If it goes, delete it from §4.6 and the seed table.

**9. `section_08_architecture.md` and `section_09_build-plan.md` give opposite instructions on PDF generation, and on auth.**
§8.2: *"PDF — `@react-pdf/renderer` … no headless Chrome, no 300 MB Puppeteer"*, with `window.print()` as the *fallback*.
§9 Phase 10: *"**Do not** install a PDF library. Use `window.print()` with a `@media print` stylesheet … This is 15 minutes instead of 60"*, and §9's cut list #6 says *"Take this one **always**, even if you are ahead."*
Same pattern for auth: §8.2 *"Cookie session + `bcryptjs`"*; §9 Phase 6 *"NextAuth credentials provider"*. **Fix:** Section 9 owns the clock, so its 15-minute answer should win on PDF; edit §8.2's PDF row to say `window.print()` + print stylesheet with `@react-pdf/renderer` as the fallback, and make the auth row name one option instead of two.

**10. `section_06`, `section_07` and `section_09` describe the bank matcher with three different scoring systems.**
§6 D2: weights normalised to 1.0 (`amount .40, reference .30, partner .20, date .10`), auto-threshold **0.90**, margin rule 0.15.
§7 AI-1: points out of 100 (`ref 50, amount 30, tolerance 12, partner 0–20, date 0–10`), auto-clear **≥85**.
§9 Phase 13: different points again (`amount 45, tolerance 25, reference 35, partner 20, date 10, −30 wrong direction`), auto-clear **>80**.
Three sections, one feature, three algorithms. **Fix:** pick §7's version (it is the only one that also specifies the AI fallback stage and the "reading, not a match" boundary), and have §6 D2 and §9 Phase 13 quote it by reference rather than restating numbers.

**11. `section_09_build-plan.md` puts the hash chain on `journal_item`; `section_04` and `section_06` put it on `journal_entry`.**
§9 Phase 2 schema: `model JournalItem { … prevHash String?  hash String? }` and §12 says *"Each posted journal **item** stores `sha256(prevHash + canonicalJson(row))`"*, audit prints `Hash chain VALID (412/412)`.
§4.6: `model JournalEntry { chainIndex Int? … prevHash … hash }`. §6 D1: `journal_entry` gains three columns, verify prints `41 of 41 entries verified`.
§10's tamper output says `HASH CHAIN BROKEN at journal_item #217` — item-level — while §6's says `BROKEN at chain_seq #217 (INV/2026/0006)` — entry-level. **Fix:** entry-level is correct (an entry is the atomic accounting event and §6's canonical-JSON includes all its lines). Change §9 Phase 2 and §9's audit line to entries, and change §10's tamper output to match §6's wording.

**12. `section_05_core-engine.md` §5.10.1 contradicts a MUST requirement about "Reset to Draft".**
The table row reads: *"Press **Reset to Draft** on a *posted* entry with no payments | Allowed **only** if you also delete its items — safer default: **forbid it** and offer Cancel."*
But §3 R-D12-02 marks *"`Reset to Draft` action exists on entries"* as **MUST** (it is drawn on the mockup), and §4.3(c) gives a proper guarded implementation (lock-date check, no allocations, ADMIN only, AuditLog row). Three sections, three answers, and one of them tells the reader to skip a mockup button. **Fix:** replace §5.10.1's row with a pointer to §4.3(c)'s three guards, so the answer is "allowed, guarded, logged" everywhere.

**13. `section_02_accounting-101.md` §2.10 diagram contradicts `section_05` on whether manual entries go through the posting engine.**
§2.10's mermaid has `MAN --> LEDGER` (bypassing `ENG`), and the prose says *"the Manual Journal Entry line **bypasses** the documents entirely and goes straight into the ledger"*. §5.3.4's `BUILDERS` registry includes `MANUAL: (doc) => ({ lines: doc.lines, control: null, trace: [] })` and §5.7's diagram draws `MAN -->|post()| JI`. §8.4's THE RULE — *"Nothing … writes a `journal_entry` or `journal_item` row except `lib/services/posting.ts`"* — makes §2's arrow an architecture violation. **Fix:** redraw §2.10 as `MAN --> ENG` and change the prose to *"bypasses the **documents**, but still goes through the posting engine — which is what makes the balance rule apply to it too."* That is also a stronger sentence for the judge.

**14. `section_03_requirements.md` §3.4 is a 62-row spec dump with no explanation of which rows matter.**
H-01 through H-62 are listed flat, each one line, no "why", no priority. A reader who "knows nothing" reads 62 rows and retains none. §3.11 then says *"MUST | ~92% of everything above"*, which tells them nothing either. **Fix:** add a 6-line lead-in before Category 1: *"Of these 62, a judge can test **nine** in under 30 seconds each. Those nine are H-45 (auto journal entry on confirm), H-49 (blocking balance check), H-50 (non-blocking budget warning on two buttons), H-51 (computed badge), H-53 (conditional smart button), H-20 (type routes the report), H-23/H-26 (revise copies and appends " Revised"), H-36 (pie inside the list row), H-60 (Balance Sheet totals). Build those nine first; the other 53 are cheap once the scaffold exists."* Then bold those nine rows in the tables.

**15. `section_03_requirements.md` §3.14 — a 180-item flat checklist with no priority carried through.**
The section opens by defining MUST / SHOULD / NICE / `[ADDITION]`, and Section 1 §5 defines Tier 0 / 1 / 2 / 3 — but §3.14's 180 checkboxes carry **no marks at all**. Under time pressure at hour 16, the reader cannot tell that "Balance Sheet footers tie" and "Analyticals kanban view" are not the same kind of item. **Fix:** prefix each checkbox with its tier (`[T0]`, `[T1]`, `[T2]`) using Section 1 §5's tiers, and add one sentence at the top: *"Work top-down within each tier, never across tiers."*

**16. `section_01_decision.md` §2 uses eight pieces of undefined jargon in the comparison table.**
Row "Genuinely hard engines" reads: *"discount risk routing, approval chain, warehouse split optimiser, stock reservation, proration, hybrid billing, live margin, upsell ranking from co-purchase lift, anomaly z-score"* and *"a salary-rule interpreter (a mini programming language with a dependency graph)"*. This is on page 2 of a document that promises to define every term at first use, and the reader is told to assume zero knowledge. **Fix:** cut the enumerations to three examples each and append a plain gloss, e.g. *"nine separate decision engines — things like 'which warehouse should ship these 8 chairs?' and 'does this discount need finance approval?'. Each one is its own set of edge cases."* The list's job is to convey *count*, not content.

**17. `section_01_decision.md` uses "equity", "smart button", "kanban", "deferred constraint" before any definition.**
§5 Tier 0: *"including Current Year Earnings pushed into the **equity** side"* — equity is first defined in §2.12's glossary, one whole section later. Same for *"Conditional **smart buttons**"* and *"**kanban** views"* in Tier 1, and *"A **deferred constraint** / trigger"* in §3.5. Section 1 is explicitly the first thing read (*"Read this section first… Nothing here needs any accounting knowledge"*), so it cannot borrow from later. **Fix:** add four parenthetical glosses in place: *equity (the owner's side of the Balance Sheet — Capital plus profit)*; *smart button (a button in a form's top corner that jumps to a related record)*; *kanban (the same records shown as cards instead of table rows)*; *deferred constraint (a database rule checked at the end of the transaction, not after each row)*.

**18. `section_05_core-engine.md` uses "analytic" / "Budget Analytics" in §5.2.2 and §5.4.1 but defines it in §5.8.1 — 400 lines later.**
`analytic_id INT REFERENCES analytic_account(id), -- budget tag, §5.7` appears in the DDL, then §5.4.1's worked invoice has a column *"Budget Analytics | Showroom-West"* with no explanation, and only §5.8.1 says *"An **Analytic Account** answers … 'which project or department was this for?'"* **Fix:** move the two-sentence definition from §5.8.1 up into §5.1 as §5.1.7, and leave a pointer at §5.8.1. The same fix applies to "residual", which §5.4.3 uses (*"Residual becomes 4,200.00"*) before §5.9 defines it.

**19. `section_02_accounting-101.md` §2.6 Step 4 loses the reader in algebra with no numeric version alongside.**
*"Move the debit-natured families to the left and the credit-natured families to the right: `(Dr_A − Cr_A) + (Dr_E − Cr_E) = (Cr_L − Dr_L) + (Cr_C − Dr_C) + (Cr_I − Dr_I)`"*. This is the "most valuable line in this entire document" by the section's own claim, and it is the one place the section stops using rupees. **Fix:** run the proof twice — once symbolically as it stands, and once immediately after with the §2.7 general-ledger numbers substituted in, so the reader watches `5,50,000 = 5,50,000` fall out of the same four steps. Three extra lines, and it converts the section's key claim from "trust the algebra" to "check it yourself".

**20. `section_04_data-model.md` §4.5–4.7 is ~900 lines of Prisma schema with no reading guide.**
The section opens *"Read this section slowly"* and then presents six unbroken schema blocks. A reader budgeting an hour for the whole document will either read all of it (30 minutes gone) or skip it entirely and miss §4.3, which is genuinely load-bearing. **Fix:** add a short box after §4.2: *"How to read the rest of this section. §4.3 is the only part you must read now — three decisions you cannot retrofit. §4.5–4.7 are the schema itself; skim the code comments and come back when you run `prisma migrate`. §4.8 (constraints) and §4.10 (judge Q&A) are worth ten minutes each."* Same treatment needed at the top of `section_03_requirements.md`, which is 1,400 lines.

**21. The document has no one-hour reading path.**
Ten files, ~645 KB, roughly 160,000 words — about ten hours of reading, against a reader who said *"I will be reading it for at least an hour"*. No section tells them what to read in that hour. **Fix:** add a boxed reading path at the top of `section_01_decision.md`, before §1: *"**Your first hour:** Section 1 (12 min) → Section 2 §§2.1–2.8 (25 min, skip the glossary) → Section 5 §§5.1, 5.3.6, 5.4, 5.13 (15 min) → Section 10 §10.9 cheat sheet (5 min). Everything else is reference you open while building. Section 3 is a checklist, not reading."*

**22. `section_05_core-engine.md` and `section_04_data-model.md` use different spellings of the same account-type enum.**
§5.1.2 and §5.2.2: `'ASSET','LIABILITY','BANK','CAPITAL','CASH','INCOME','**EXPENSES**','**OTHER_EXPENSES**'`. §4.6 and §2.6: `EXPENSE`, `OTHER_EXPENSE` (singular). §6 D1's TypeScript uses the display strings `['Income', 'Expenses', 'Other Expenses']`. A reader copying the §5 DDL and then the §4.6 `ACCOUNT_TYPE_META` map gets a silent mismatch that makes the P&L's Other Expense row print ₹0.00 — exactly the bug §4.6 warns about elsewhere. **Fix:** one spelling, applied in §2.6's table, §4.6's enum and meta map, §5.1.2's table and §5.2.2's `CREATE TYPE`, and §6's `net([...])` calls.

**23. `section_06_differentiators.md` §10 and `section_01_decision.md` §5 disagree on the feature-freeze time.**
§1: *"features freeze at **T−4 hours**"*. §6 §10 rule 1: *"Freeze all features at **T−6 hours**"*. §9 Gate 3: freeze at **T+18** of 24, i.e. T−6. Two against one. **Fix:** change Section 1 §5's line to T−6 and to *"the last six hours are hardening, deployment and three timed rehearsals"* to match Section 9's actual schedule.

**24. `section_05_core-engine.md` §5.5.6 miscounts its own worked example and quietly adds rows the mockup does not have.**
*"**Nine** posted entries"* precedes a table listing E1–E8. And the resulting Balance Sheet prints `Input GST Receivable A/c` and `Output GST Payable A/c` as rows, where the mockup's Balance Sheet has exactly five rows (Bank, Cash, Debtors | Capital, Creditors) — no note that this is a deviation. **Fix:** correct "nine" to "eight", and add one sentence: *"The two GST rows are ours — the mockup's Balance Sheet has five rows. Tax has to appear somewhere or the sheet cannot tie; see Requirements §12.5."*

**25. `section_07_ai-features.md` — small header/table mismatch.**
*"Before anything else, **four** accounting words you will need"* introduces a table with **six** rows (Ledger, Journal entry, Debit/Credit, Draft vs Posted, Reconciliation, Analytic account). **Fix:** change "four" to "six". Otherwise this section is the cleanest in the document — the filter, the rejected-ideas table, and the `app_ai` database-role demo all explain *why* before *what*, and the offline-fallback table is exactly the kind of concrete detail the brief asked for. No other changes needed.

---

**Sections that are genuinely fine:** `section_02` is the best-written section in the document and needs only findings 1, 7, 13 and 19 — its "credit = where value came from" rule, the book/page/line metaphor and the §2.7 tie-out are exactly right for a zero-knowledge reader. `section_07` needs only finding 25. `section_10` is the only section whose arithmetic ties end to end (9,92,000 → 10,81,792, Net Income = CYE = 2,35,600, all verified) — it should be treated as the canonical number source for findings 3 and 6 rather than edited to match the others.

########## RESULT 2 (28750 chars) ##########

I've read both sources in full and all ten section files. Findings below, worst first.

---

**FINDINGS — Completeness & Consistency Audit**

---

**1. `section_04_data-model.md` vs `section_05_core-engine.md` vs `section_09_build-plan.md` — the money type is specified three incompatible ways. This is the single most expensive contradiction in the document.**

- §4.4 (data-model): "**Money is `Decimal(14,2)`. Never `Float`.** … `amountTotal Decimal @db.Decimal(14, 2)`" and every schema block uses `debit Decimal` / `credit Decimal`.
- §5.2.1 (core-engine): "**Money is stored as integer paise. Not floats. Not decimals-in-JS.**" with `debit_paise BIGINT`, `credit_paise BIGINT`.
- §8.2 (architecture): "Money | **`Decimal(14,2)`** in Postgres, `Prisma.Decimal` in TS".
- §2 Assumptions (build-plan): "Money | **Integers in paise, `BIGINT`**" and `debitPaise BigInt`.
- §6 D1 (differentiators): "Money is stored as integer paise (`BIGINT`), never as a float".

A developer following §4 writes `journal_item.debit`; a developer following §5/§9 writes `journal_item.debit_paise`. Every SQL snippet, every trigger, every report query and every test in the document is written against one or the other and will not compile against the other.

**Fix (assign to one editor, then cascade):** pick **integer paise `BIGINT`** (3 sections already use it, and §9's risk table names float drift as Risk 3 with the `roundPaise()` guard). Then: (a) §4 editor rewrite §4.4 "Money is `Decimal(14,2)`" → `BIGINT` paise, change every `Decimal @db.Decimal(14,2)` money field to `BigInt`, rewrite §4.8 constraints 4/5/6 and §4.9 index `INCLUDE (debit, credit)` to `(debit_paise, credit_paise)`, and delete the §4.4 paragraph beginning "Prisma returns these as `Decimal.js` objects"; (b) §8 editor change the §8.2 stack row, the §8.3 "Requirement 3 — Exact rupees" argument (keep the float argument, change the conclusion to "BIGINT paise"), the §8.7 §2 raw SQL (`SUM(ji.debit)` → `SUM(ji.debit_paise)`), and the §8.8 `schema.prisma` block. If instead you keep `Decimal`, §5, §6 and §9 all need the inverse edit — but do it once, in one direction, in a single pass.

---

**2. `section_04_data-model.md` — the balance constraint as written makes it impossible to save an unbalanced DRAFT journal entry, which breaks the mockup's manual Journal Entry screen.**

§4.8 item 2 Layer A: `ALTER TABLE journal_entry ADD CONSTRAINT journal_entry_must_balance CHECK (total_debit = total_credit);` — unconditional. And the `assert_entry_balanced()` trigger in §4.8 has no state check; it raises whenever `v_debit <> v_credit` for any entry.

The mockup draws a manual Journal Entry form where a user types Account/Partner/Debit/Credit lines and *then* presses **Post**, with the annotation "**Blocking warning if the debit and credit amount don't match**" — i.e. the check fires at Post, not at every intermediate save. §5.2.3(a) and §8.8 both explicitly exempt drafts (§8.8: "**Drafts are exempt.** … Balance is enforced at the moment of posting, which is exactly right"). §4 contradicts both, and a user could not even save a half-typed entry.

**Fix (§4 editor):** add the draft exemption to `assert_entry_balanced()` — `SELECT state INTO v_state FROM journal_entry WHERE id = v_entry; IF v_state IS DISTINCT FROM 'POSTED' THEN RETURN NULL; END IF;` — matching §5.2.3(a) exactly. Change Layer A from a table CHECK to `CHECK (state <> 'POSTED' OR total_debit = total_credit)`. Add one sentence: "Drafts may be lopsided; the rule binds at POST, which is what the mockup's blocking warning on Post means."

---

**3. `section_04_data-model.md` vs `section_05_core-engine.md`/`section_06_differentiators.md` — `payment_allocation` is designed two mutually exclusive ways, and §4 explicitly argues that §5's design is wrong.**

- §4.7: `PaymentAllocation { customerInvoiceId String?  vendorBillId String? }` with `CHECK ((customer_invoice_id IS NOT NULL)::int + (vendor_bill_id IS NOT NULL)::int = 1)`, and §4.7 argues against the alternative: "a polymorphic `(docType, docId)` pair **cannot have a foreign key at all** — you throw away referential integrity, which is precisely the thing you are trying to prove to the judge."
- §5.2.2 ships exactly that rejected design: `payment_allocation (… document_type TEXT NOT NULL, document_id INT NOT NULL …)`, and §5.9.2's residual query joins `ON pa.document_type = 'CUSTOMER_INVOICE' AND pa.document_id = d.id`. §6 D2's schema block repeats it.

**Fix:** §5 and §6 editors change `payment_allocation` to the two-nullable-FK shape from §4 and update the §5.9.2 residual SQL (`LEFT JOIN payment_allocation pa ON pa.customer_invoice_id = d.id`) and §5.9.4 `allocate()` signature. Alternatively §4's editor drops the "cannot have a foreign key" paragraph — but do **not** leave the document arguing against its own schema.

---

**4. `section_09_build-plan.md` — the 24-hour timeline allocates zero minutes to AI, while `section_07_ai-features.md` commits to 2 hours of AI work.**

§7 §2.6: "Realistic plan: **build 1 and 2 (2 hours)**. Add 3 if you are ahead at T−8." §7's gate says "if those are not done by **T−8 hours**, ship zero AI features" — implying AI is built after T+16.

§9's master Gantt and Phases 0–22 contain no AI block at all. The only AI mention in §9 is a passing "AI pair programmer". Phase 13 (T+17→18) is bank reconciliation with a purely deterministic matcher; Phase 12 is slider+integrity; T+18 is an unconditional feature freeze. There is nowhere for AI-1 (70 min) or AI-4 (50 min) to go.

**Fix (§9 editor):** either (a) add AI-1 into Phase 13 as a 30-minute sub-item ("stage F fallback ranker on unmatched rows, per the AI section") and AI-4 into Phase 12, extending Phase 12–13 to T+18:30 and shifting the endgame by 30 min; or (b) state explicitly in Phase 13 and in the Cut Lines section: "AI features are the first thing cut; if the reconciliation matcher is deterministic-only at T+18, ship it that way and say the sentence in the AI section." Right now the document promises AI in one section and silently drops it in the plan the developer actually works from.

---

**5. `section_06_differentiators.md` vs `section_09_build-plan.md` — the same differentiators are costed at 7.75 hours in one section and ~2.5 hours in the other.**

| Item | §6 estimate | §9 allocation |
|---|---|---|
| D1 Books Integrity | **2.5 h** | Phase 12, **0.5 h** |
| D2 Bank reconciliation | **3.0 h** | Phase 13, **1.0 h** |
| D3 As-of slider | 0.75 h | Phase 12, 0.25 h |
| D4 Drill-down | **1.5 h** | folded into Phase 10's 1.25 h |

§6 states "The envelope: 6.25 hours for the TOP 3, plus 1.5 hours for D4 = ~7.75 hours of the ~19." §9's whole payoff block (Phases 10–13, T+14→T+18) is 4 hours *including* the required report screens, the budget workflow, PDF and the pie chart.

Separately, §5.12 costs the engine at **≈10:30** and says it leaves "~8.5 h of the 19 for screens, seed data, polish and rehearsal" — but §9 gives the headless core 8 hours flat and reserves 6 hours for the endgame. 10.5 (engine) + 7.75 (differentiators) + 2 (AI) = 20.25 hours before a single CRUD screen.

**Fix:** one editor must own the reconciliation. Recommend §9 (the clock) becomes authoritative: §6's editor rewrites the §2 hours column to match §9's blocks and changes the envelope sentence to "~4 hours inside Phases 10–13, because D1/D3/D4 are mostly instrumentation of code the engine section already produces"; §5's editor changes the §5.12 total line to reconcile with §9's 8-hour Gate 1 (steps 1–5 = 6:00 is already stated as "the irreducible spine" — say that steps 6–9 land inside §9's Phases 9, 11, 12). Otherwise the developer will believe two different budgets at hour 14.

---

**6. `section_09_build-plan.md` (Phase 8) — instructs building a Chart of Accounts column on the Purchase Order and Sales Order line grids, which `section_03_requirements.md` §12.7 explicitly rules against.**

§9 Phase 8: "**One shared line-grid component** used by all four documents. Columns: `Sr. No. | Product | Chart of Account | Budget Analytics | Qty | Unit Price | Total`".

§3 R-D1-06: "the PO line grid has **no Chart of Accounts column**. Only the Bill and the Invoice do. **Do not add one.** (Verified on tile `acc_r5c0`/`acc_r6c0`.)" and §3 §12.7 rules: "**No CoA column on PO or SO.**" The mockup transcription confirms the PO grid is `Sr. No. | Product | Budget Analytics | Qty | Unit Price | Total`.

**Fix (§9 editor):** change the Phase 8 sentence to: "One shared line-grid component, column set driven by config. PO and SO: `Sr. No. | Product | Budget Analytics | Qty | Unit Price | Total`. Bill and Invoice add a `Chart of Account` column, defaulted to the Purchase / Sales account respectively (see the requirements section §12.7)."

---

**7. `section_06_differentiators.md` §10 rule 4 tells the developer to cut PDF print and kanban views, which `section_03_requirements.md` §13 lists under "NEVER cut".**

§6 §10 rule 4: "If you are so far behind that these are threatened, cut *required screens* instead — the portal, **the kanban views, the PDF print**".

§3 §13 "**NEVER cut, no matter what:** … **Three Budget Report views with a working switcher** … P&L and Balance Sheet computed from journal items, by account type, **with working PDF Print**". The mockup annotates "**Pdf download on click**" on the P&L Print button, and §3 H-59 records it as an explicit hidden requirement. §9's cut list also protects PDF (item 6 is a *substitution* to `window.print()`, not a cut).

**Fix (§6 editor):** rewrite rule 4's cut candidates to: "cut the **portal**, the **Analyticals kanban** (the one kanban whose card content the mockup never draws), the **payment gear Send action**, and the **Forgot Password page** — never the two reports' Print, never the Budget Report's three views, both of which the mockup annotates explicitly." That aligns it with §3 §13 and §9's bench.

---

**8. `section_10_demo-and-judge.md` — every seed number contradicts `sections 03/04/06/08`, and the demo date and file name contradict `section_09`.**

Four sections agree on one seeded state (§3 §3.0.3, §4.1, §6 D1 audit output, §8.8 verify output): **41 entries · 352 journal items · Assets ₹8,42,310 = Liabilities ₹1,97,310 + Capital ₹6,45,000** (§6 splits that as Capital 4,26,600 + CYE 2,18,400).

- §10 §10.1: "41 journal entries, 352 journal items" but **Assets ₹9,92,000 = Liabilities ₹1,82,000 + Capital ₹6,00,000 + CYE ₹2,10,000**, and a whole cheat sheet of memorised figures built on it.
- §9 §5: "**96** entries · **412** journal items · Assets **18,42,310** = Liabilities 1,97,310 + Capital **16,45,000**", with `npm run audit` output printing those.
- §9: `DEMO_TODAY=2026-09-05`, seed spans 01-Jan-2026 → 05-Sep-2026, file `demo/bank_statement_05sep2026.csv`, seed budget "**August 2026**" (2,00,000 → 2,18,400).
- §10: seed spans "1 April 2026 to 15 September 2026", file `bank_statement_15sep.csv`, seed budget "**Q2 Furniture Procurement**" (1,60,000 → 1,62,400).

Both §9 and §10 are internally self-consistent; they are consistent with nothing else. The developer memorises §10's cheat sheet and then runs §9's seed script.

**Fix:** make **§10 §10.1 authoritative for the demo numbers** (it is the only place they are used out loud) and have the **§9 editor rewrite §5 "Seed Data Strategy"** to produce exactly §10's state: opening entry dated 01-Apr-2026, `DEMO_TODAY=2026-09-15`, `demo/bank_statement_15sep.csv`, budget "Q2 Furniture Procurement" 01-Jul→30-Sep-2026 committed ₹1,60,000 achieved ₹1,48,000, and change the `npm run audit` sample output to `Trial balance … DIFF 0.00 / Assets 9,92,000 = Liabilities 1,82,000 + Capital 8,10,000`. Then §3 §3.0.3, §4.1, §6 D1's audit block and §8.8's verify block must be re-quoted to the same figures (8,42,310 → 9,92,000 etc.). §10 already carries the right guard — "Run your final seed script at T-2 hours … if any number differs, rewrite it in the cheat sheet by hand" — but three sections printing three different balance sheets is a rehearsal hazard.

---

**9. `section_04_data-model.md` / `section_05_core-engine.md` / `section_08_architecture.md` / `section_09_build-plan.md` — four incompatible identifier and naming conventions for the same tables.**

- **Primary keys:** §4 `String @id @default(cuid())`; §5 `SERIAL` / `BIGSERIAL` integers (and `entry_id INT`); §8's trigger declares `v_entry uuid` and its `schema.prisma` block uses `@default(uuid())`; §9 `@default(cuid())`; §7's `ai_suggestion` uses `uuid`.
- **Table names:** §4/§5/§6/§8 use snake_case (`journal_item`, `journal_entry`); §9 uses PascalCase quoted identifiers — `ALTER TABLE "JournalItem"`, `UPDATE "JournalItem" SET "debitPaise" = …`. §10's tamper command is `UPDATE journal_item SET debit = 99999` — a third variant that matches neither §9's column name nor §9's table name.
- **State column:** §4/§5/§9 `state`; §8 `status` throughout (`WHERE je.status = 'POSTED'`, `CREATE INDEX idx_je_status_date ON journal_entry (status, date)`, `SELECT status INTO v_state`). Enum casing also splits: `'POSTED'` (§4/§5/§8) vs `'posted'` (§1 §3.2, §6 D1/D3).
- **User table:** §4 `model User` → `@@map("user")`; §5 and §7 reference `app_user(id)`.

**Fix:** §4 is the schema owner — declare its conventions in one boxed note at the top of §4 ("cuid string ids; snake_case tables via `@@map`; the state column is `state`; enum values are UPPERCASE") and have §5, §6, §7, §8, §9, §10 editors do a find/replace pass. In particular: §8 editor `status` → `state` (7 occurrences incl. two index definitions and the trigger) and `uuid` → `text` in the trigger declaration; §9 editor `"JournalItem"` → `journal_item`; §10 editor make the terminal tamper command byte-identical to §9's, since both claim to be the command sitting in shell history.

---

**10. `section_04_data-model.md` / `section_05_core-engine.md` — the account-type enum has two spellings, and `section_07` uses a third.**

§4 §4.6: `EXPENSE`, `OTHER_EXPENSE` (and `ACCOUNT_TYPE_META` keys use them). §2 §2.4's seed table agrees: `EXPENSE`, `OTHER_EXPENSE`. §5 §5.1.2 and its DDL: `'EXPENSES','OTHER_EXPENSES'`, and §5.6.3's `SECTIONS` map and §5.6.3's `g('EXPENSES')` depend on the plural. §6 D1 uses display strings `['Income','Expenses','Other Expenses']`. §7 AI-2's intent enum uses `"expense","other_expense"`.

**Fix (§5 editor):** change the `account_type` ENUM in §5.2.2 DDL, the §5.1.2 table, the `SECTIONS` constant and `g('EXPENSES')` / `g('OTHER_EXPENSES')` in §5.6.3, and the §5.8.4 SQL to the singular `EXPENSE` / `OTHER_EXPENSE`. §6 editor change the `net([...])` call in D1 to the enum values, not the display labels.

---

**11. `section_06_differentiators.md` — the append-only trigger in D1 references a column that exists in no schema and will fail to migrate.**

```sql
CREATE TRIGGER journal_item_append_only
  BEFORE UPDATE OR DELETE ON journal_item
  FOR EACH ROW WHEN (OLD.posted) EXECUTE FUNCTION forbid_posted_mutation();
```

There is no `journal_item.posted` boolean anywhere. §4 uses `journal_item.state` (denormalised) and §5's version reads the parent entry's state. As written, `CREATE TRIGGER` fails and, worse, `forbid_posted_mutation()` in §6 raises unconditionally with no state check at all — it would block editing draft entries.

**Fix (§6 editor):** replace both objects with the §5.2.3(b) version verbatim (`block_posted_mutation()` reading `SELECT state FROM journal_entry WHERE id = OLD.entry_id`), or with §4.8 item 3's `forbid_posted_mutation()`. Then update the "gotcha" paragraph below it — the `SET session_replication_role = replica` demo note is still correct and worth keeping.

---

**12. `section_09_build-plan.md` — Phase 10 forbids a PDF library; `section_08_architecture.md` §8.2 mandates one.**

§8.2: "PDF | **`@react-pdf/renderer`** … 'Print → Pdf download on click' is a hard requirement on both P&L and Balance Sheet. This renders React components to a PDF buffer inside a Node route". §8.5's folder tree contains `app/api/reports/[name]/pdf/route.ts   # @react-pdf/renderer`.

§9 Phase 10: "**Print → PDF.** Do *not* install a PDF library. Use `window.print()` with a `@media print` stylesheet… This is 15 minutes instead of 60". §9's cut list item 6 says take this substitution "**always**, even if you are ahead".

**Fix:** §8 editor adopt §9's position — change the §8.2 PDF row to "`window.print()` + a `@media print` stylesheet (15 min); `@react-pdf/renderer` only if a server-rendered buffer is genuinely needed", and delete `app/api/reports/[name]/pdf/route.ts` from the §8.5 tree (or relabel it as the print-view route). §8 already hedges — "Fallback if it misbehaves: a `@media print` stylesheet plus `window.print()`" — so promote the fallback to the primary and note that a judge cannot tell the difference in the output.

---

**13. `section_01_decision.md` — the feature-freeze deadline is T−4; `sections 06` and `09` both say T−6.**

§1 §5: "**Non-negotiable process gate:** features freeze at **T−4 hours**."
§6 §10 rule 1: "**Freeze all features at T−6 hours.** No exceptions."
§9 GATE 3: "**T+18:00 — FEATURE FREEZE** … No new features after this line. None."

**Fix (§1 editor):** change "T−4 hours" to "**T+18 (T−6)**" and add "— see the build-plan section's Gate 3", so the one number appears identically in all three places. Two hours is the difference between one and three rehearsals.

---

**14. `section_09_build-plan.md` — the plan never schedules the admin "Create User" screen or the Receipt / Payment list menu entries, both MUST items in `section_03`.**

- "Create User" appears **zero** times in §9. §3 A1 marks it **MUST** ("*Purpose:* an Admin creates a system user and assigns a role. Tile `acc_r0c1`") with seven fields, three role radios and five rules (R-A1-01…05). §9 Phase 6 covers only Login and Sign Up.
- "Receipt" appears **zero** times in §9. The mockup's mega-menu has `Receipt` under Sales and `Payment` under Purchase — §3 R-A6-02 marks both **MUST** ("one `payments` table, two filtered menu entries"), and §3 D6 lists them. §9 Phase 9 builds only the payment wizard.

**Fix (§9 editor):** add to Phase 6's auth deliverable: "**Create User (admin)** — Name, Login id, E-mail id, three Role radios (Admin / Accountant / User), Password, Re-Enter Password, `Create` / `Cancel`; same credential rules as Sign Up. 15 min, reuses the scaffold form." Add to Phase 9: "**Payment list and Receipt list** — one `payments` table, two `nav.ts` entries filtered by `direction`. 10 min." Both are cheap and both are named menu destinations, and §9's own Phase 7 checkpoint is "Every one of the seven master menu entries opens without a 404" — dead menu items are the exact failure §9 warns about.

---

**15. `section_05_core-engine.md` §5.10.1 recommends forbidding "Reset to Draft" on posted entries — a MUST in `section_03` and a drawn button in the mockup.**

§5.10.1 table: "Press **Reset to Draft** on a *posted* entry with no payments | Allowed **only** if you also delete its items — safer default: **forbid it and offer Cancel**."

The mockup draws `Reset to Draft` on the Demo Journal Entry card; §3 R-D12-02 marks it **MUST**; §3 H-48 lists it as a hidden requirement; §4 §4.3(c) delivers a correct guarded implementation ("refused if … the entry's date is on or before `CompanySettings.lockDate` … the source document has any `PaymentAllocation` rows … the caller is not `ADMIN`. If it passes, the service writes an `AuditLog` row and flips `state` to `DRAFT`").

**Fix (§5 editor):** replace that table row with §4's three-guard rule and cross-reference it: "Allowed for ADMIN when the entry is after the lock date and the source document has no confirmed allocations; the transition is logged. This is the mockup's drawn button, implemented honestly — see the data-model section §4.3(c)." Leaving "forbid it" in the engine section risks the developer shipping a form without a button the mockup draws.

---

**16. `section_10_demo-and-judge.md` — the demo script and Q&A present five features as built that `section_06`/`section_09` place on the bench or in Tier 2/3.**

- §10.3 [3:55–4:35] demos **lock date** ("Open Settings → Lock Date. Set 31-Mar-2026") — §6 ranks it D6 **Tier 2**, §9 puts it on the Gate 3 bench as item 2 ("only if every checkpoint is green and you are ahead").
- §10.3 demos **Cancel → reversal** — §6 D6 Tier 2, §9 bench item 1.
- §10.3's budget table shows an **"Open PO ₹9,600"** column — §6 D8 **Tier 3**, and §9 Phase 11 mentions only "% of period elapsed" pacing.
- §10.6 **Q30**: "the stock side is a movement ledger with moving-average cost" — §6 D9 is **Bench** ("Build only if you are ahead of schedule at T−8"), §9 cut-list item 2.
- §10.6 **Q31**: "Portal access is filtered at the query level … **I can show you that in five seconds**" — §9 cut-list item 1 ("the cheapest to drop"), §6 §8 "Cut without guilt".

§10's own "Never say" table forbids narrating uncertainty, so these must be either built or removed.

**Fix (§10 editor):** tag each of these with a conditional marker the way §10 already tags additions, e.g. "*[only if the bench item was built — see the build-plan Gate 3]*", and add fallback wording to Q30/Q31 for the cut case: Q31 → "Portal access is designed as a query-level filter on the contact linked to the login; we prioritised ledger correctness and scoped the portal out — here's the role model in the schema." Also add "portal", "lock date" and "Open PO column" to the §10.3 "Cuts if running long" list (lock date is already there at #3; the others are not).

---

**17. `section_03_requirements.md` — the stated count of hidden requirements is wrong, and two group headers miscount their screens.**

- §3.4 opening: "There are **52** of them." The table then runs **H-01 through H-62** — 7+7+8+9+6+7+10+6+2 = **62**. The judge-facing line at the end of §3.4 also says "about **fifty** requirements the PDF never mentions".
- "GROUP D — Transactions (**14** screens)" contains D1–D12; even counting D6 as two lists that is **13**.
- §3.11 says "SHOULD | … | **12 items**" but lists 8 bullet groups; "`[ADDITION]` | … | **8 items**" against a list of 8 — that one is right.

**Fix (§3 editor):** change "There are 52 of them" → "There are **62** of them", change the judge line to "about **sixty** requirements", and change the Group D header to "(13 screens)". Getting the count right matters because "62 hidden requirements we found in the drawing" is a number the developer will say out loud.

---

**18. `section_04_data-model.md`, `section_05_core-engine.md`, `section_07_ai-features.md` — six cross-references point at sections that do not exist.**

| File:line | Dangling reference | Actual home |
|---|---|---|
| §4:2021 | "*The Posting Engine* section" | section 05, "The Core Engine" |
| §4:2022 | "*The Reporting Engine* section" | section 05 |
| §4:2023, §4:472 | "*The UI Scaffold* section" | section 08 §8.6 |
| §4:2024 | "*Seed Data & Demo Prep*" | **no such section** — seed data lives in §9 §5 and §10 §10.1 |
| §4:359 | "the Auth section" | **no such section** — auth rules are §3 A1–A4, build in §9 Phase 6 |
| §5:1369 | "the Master Data section", "the Transaction Flow section", "the UI section" | §3 Groups B/D; §8 §8.6 |
| §7:466 | "see the UX section" | **no such section** |
| §6:73 | "see the scope section" | §3 |
| §10:38 | "see the seed-data section" | §9 §5 |

**Fix:** each section's editor replace with the real names from the ten-file list: *The Decision*, *Accounting Explained From Zero*, *Complete Requirements*, *The Data Model*, *The Core Engine*, *What Makes Us Win*, *Where AI Genuinely Makes This Better*, *Tech Stack, Architecture and Optimizations*, *The 24-Hour Build Plan*, *The Demo Script and Judge Q&A*. For "Seed Data & Demo Prep" and "the Auth section" — those topics have no owner; point them at §9 §5 and §3 Group A / §9 Phase 6 respectively.

---

**19. `section_02_accounting-101.md` §2.10 — the diagram routes manual journal entries around the posting engine, contradicting the architecture rule in `section_08`.**

The mermaid diagram has `MAN --> LEDGER` (manual entry straight to the ledger) while `VB / INV / PAYO / PAYI --> ENG --> LEDGER`. §8.4 states **THE RULE**: "**Nothing in this codebase writes a `journal_entry` or `journal_item` row except `lib/services/posting.ts`.**" and backs it with an architecture test that greps for offenders. §5.3.4's rule registry includes `MANUAL: (doc) => ({ lines: doc.lines, control: null, trace: [] })` — i.e. manual entries *do* go through the engine.

**Fix (§2 editor):** change the edge to `MAN --> ENG` and adjust the prose below ("**The Manual Journal Entry line bypasses the documents entirely**" is correct and should stay — change "goes straight into the ledger" to "goes through the same posting engine, but with the lines the user typed rather than lines derived from a document"). The point the paragraph is making — that a manual entry is invisible to a fake system — survives intact.

---

**20. `section_05_core-engine.md` / `section_09_build-plan.md` / `section_06_differentiators.md` — the posting trace is stored three different ways.**

§5.3.4: `await tx.postingTrace.create({ data: { entryId: entry.id, json: trace } })` — a separate `posting_trace` table. §9 Phase 2 schema: `trace Json?` as a column on `JournalEntry`. §6 D5: "Store as `journal_entry.posting_trace JSONB`." §4's `JournalEntry` model has **no** trace field at all, and §4 is the schema owner.

**Fix:** §4 editor add `postingTrace Json?` to the `JournalEntry` model with the comment "the D5 Explain panel renders this; populated by the posting engine at post time — see the core-engine section §5.3.7". §5 editor change `tx.postingTrace.create(...)` to `trace` on the entry create call. §6 and §9 already agree on the column form.

---

**21. `section_03_requirements.md` / `section_04_data-model.md` / `section_10_demo-and-judge.md` — partial PO→Bill conversion is demoed and schematised but never labelled as an addition beyond the spec.**

§4.7 adds `qtyBilled Decimal` with "Enables PARTIAL PO→Bill conversion: bill 12 of 20 units, PO stays open showing 8 still billable", plus `OrderState.PARTIALLY_BILLED` and a `po_line_not_over_billed` CHECK. §10.3 demos it as a headline beat: "We received twelve of the twenty. So we bill twelve. The purchase order stays open with eight still billable — it isn't a one-shot clone."

The mockup says only "Bill Created from PO fetch Vendor name, Product, Price, Quantity". §3 H-40 records exactly that and nothing about partial conversion; §3's `[ADDITION]` register in §3.11 (8 items) does not include it.

**Fix:** §3 editor add a ninth `[ADDITION]` row to §3.11 and a line under D1: "**R-D1-07 `[ADDITION]`** — partial PO→Bill conversion (`qty_billed` per line). *Reason:* the mockup's Create Bill copies quantity but says nothing about receiving less than ordered; carrying `qty_billed` costs one column and one CHECK, and it is the difference between a Convert button and a real procurement flow. Demoed in the demo section at [0:35–1:35]." §10 editor add the `🏷️ Addition` tag it already uses elsewhere to that beat. The document's own rule — "NEVER invent a requirement that is not in the sources; if you add something, label it clearly" — currently isn't honoured here.

---

**22. `section_05_core-engine.md` — payment numbering uses a prefix (`RCPT/`) that no other section defines.**

§5.4.3 posts **RCPT/2026/0001** for a customer receipt while §5.4.4 uses **PAY/2026/0001** for a vendor payment. §3 §3.6 specifies one payment sequence as an addition: "`[ADDITION]` **PAY/2026/0001** for consistency". §4's `Payment.name` comment says `// "PAY/2026/0003"`. §4's `Sequence.code` list has a single `"payment"` entry, so two prefixes are not expressible without a second sequence row.

**Fix (§5 editor):** either use `PAY/2026/xxxx` for both directions (simplest, matches §3 and §4), or — if the RCPT/PAY split is intentional — say so and have §3 §3.6 and §4's `Sequence` seed add a second row (`code = 'receipt'`, `prefix = 'RCPT/'`). One line either way; leaving it ambiguous produces a demo where the receipt number doesn't match the numbering rule the developer just explained.

---

**Sections that are genuinely fine:** `section_02_accounting-101.md` (only finding 19, a diagram edge) and `section_07_ai-features.md` (only findings 4 and 18, both cross-section) are clean, internally consistent and complete against the sources. `section_03_requirements.md` is the strongest file in the set — I found no requirement, field, button, annotation or hidden requirement from either source that it omits, which is why findings 14, 6 and 16 are framed as *other* sections drifting from it rather than as gaps in the spec.

########## RESULT 3 (32302 chars) ##########

I read all ten section files plus the source material. Findings below, worst first.

---

## CRITICAL — will break in front of a judge

**1. `section_05_core-engine.md` §5.9.3 — the partial-payment walkthrough numbers are off by ₹10,000 and contradict §5.5.6.**
§5.5.6's seeded Debtors of `51,400` **already includes** entry E6 (the ₹10,000 receipt). §5.9.3 then presents that same receipt as new: *"Balance Sheet: Debtors 51,400 → 41,400 · Bank 4,40,000 → 4,50,000"*. The Bank pair is the correct before→after; the Debtors pair is not — before must be `61,400` (14,200 + 47,200) and after `51,400`. State 2 inherits the error: *"Debtors 41,400 → 37,200"* should be `51,400 → 47,200`.
**Fix:** rewrite State 1 as `Debtors 61,400 → 51,400 · Bank 4,40,000 → 4,50,000` and State 2 as `Debtors 51,400 → 47,200 · Cash 47,000 → 51,200`, and add one line saying "these are the figures *before* E6/E8 are applied" so the reader can reconcile with §5.5.6.

**2. `section_10_demo-and-judge.md` §10.3 [3:55–4:35] — the tamper demo will be blocked by your own trigger and die on stage.**
The script runs `UPDATE journal_item SET debit = 99999 WHERE id = 217;` in psql. But §5.2.3(b), §4.8(3) and §6-D1 all install a `BEFORE UPDATE` trigger on `journal_item` that refuses exactly this. On stage you will get `posted_ledger_is_immutable`, not a broken hash chain — the beat inverts into a permissions error. Section 06 flags this and prescribes the fix; section 10 omits it.
**Fix:** replace the tamper command in §10.3 and in the §10.2 shell-history checklist with the three-line form from `section_06` D1:
```sql
SET session_replication_role = replica;
UPDATE journal_item SET debit_paise = 9999900 WHERE id = 217;
SET session_replication_role = origin;
```
and add the narration line ("that's my own superuser, with triggers switched off"). Also add the **restore** command to shell history immediately after it.

**3. All sections — four mutually incompatible demo datasets. A judge who hears two of them will assume you made both up.**
- §05 §5.5.6 / §5.11: Assets **5,50,992**, Liabilities 15,992, Capital 5,00,000, CYE 35,000, 352 items / 41 entries
- §06 D1 / §08 §8.8: Assets **8,42,310**, Liab 1,97,310, Capital 4,26,600, CYE 2,18,400, 352 items / 41 entries
- §09 §4 audit block: Assets **18,42,310**, Liab 1,97,310, Capital **16,45,000**, 412 items / 96 entries
- §10 §10.1: Assets **9,92,000** → 10,81,792, Liab 1,82,000, Capital 6,00,000, CYE 2,10,000, 352 items / 41 entries

§10's set is the only one that is fully worked through and it ties everywhere I checked (opening 9,92,000; closing 10,81,792 = 1,96,192 + 8,85,600; Net Income 2,35,600 = CYE; Debtors 3,05,200 → 1,00,000; budget 1,62,400 / 101.5% / −2,400; 8 chairs × 1,200 = 9,600; 77/92 days ≈ 84%).
**Fix:** declare §10's figures the single canonical seed. Then: replace §05 §5.5.6/§5.5.7/§5.10.3/§5.11 numbers, §06 D1's audit block and §7 Test 2, §08 §8.8's verify output, and §09 §4's audit block and §5's volume table, all with §10's. Anywhere a section needs an illustrative mini-ledger (§02 §2.7), label it explicitly *"teaching example, not the seed data."*

**4. `section_08` §8.8, `section_04` §4.8(2), `section_05` §5.2.3(a) — the balance trigger function crashes on DELETE.**
All three write `COALESCE(NEW.entry_id, OLD.entry_id)` (or read `NEW.entry_id`) inside a trigger declared `AFTER INSERT OR UPDATE OR DELETE`. In PL/pgSQL, `NEW` is unassigned in a DELETE trigger; touching `NEW.entry_id` raises *"record 'new' is not assigned yet"*. The same bug is in §04's `forbid_posted_mutation`, which returns `CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END`.
**Fix:** in every copy, replace the assignment with
```sql
IF TG_OP = 'DELETE' THEN v_entry := OLD.entry_id; ELSE v_entry := NEW.entry_id; END IF;
```
and replace the `CASE` return with `IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;`.

**5. `section_05` §5.2.3(a) — the balance trigger has a hole the whole architecture rests on.**
`assert_entry_balanced()` starts with `IF st <> 'POSTED' THEN RETURN NEW; END IF;` and is attached **only to `journal_item`**. So the sequence *(1) create entry as DRAFT, (2) insert unbalanced items, (3) `UPDATE journal_entry SET state='POSTED'`* never fires the check. Your headline claim — "I can't write a bad entry even from psql" — is false as written.
**Fix:** either drop the state test entirely (as `section_04` §4.8 does — the entry must balance at COMMIT regardless of state), or keep it and add a second constraint trigger on `journal_entry` `AFTER UPDATE OF state`, `DEFERRABLE INITIALLY DEFERRED`, that runs the same check when the new state is `POSTED`. Say which in the text.

**6. `section_05` §5.9.2 — the residual query counts draft and cancelled payments.**
```sql
LEFT JOIN payment p ON p.id = pa.payment_id AND p.state = 'CONFIRMED'
```
Because this is a LEFT JOIN, the allocation row survives when the payment isn't confirmed and `SUM(pa.amount_paise)` still includes it. That directly falsifies the claim two paragraphs below ("Unconfirm the payment and the invoice goes back to Not Paid on its own"). The same defect is in `section_06` D2's `CREATE VIEW invoice_residual`, which has **no payment-state filter at all**.
**Fix:** in §5.9.2, change every aggregate to a filtered aggregate:
`COALESCE(SUM(pa.amount_paise) FILTER (WHERE p.state='CONFIRMED'), 0)` (and the same on the cash/bank splits, combining `p.state='CONFIRMED' AND j.type='CASH'`). In §06 D2, add `JOIN payment p ON p.id = pa.payment_id AND p.state='CONFIRMED'` and note in the text that the view is `LEFT JOIN`-ed from invoice but `INNER`-joined to confirmed payments.

**7. `section_04` §4.7 + §4.8(5) — every brand-new invoice will display the badge **Paid**.**
`amountResidual Decimal @default(0)` combined with the generated column `WHEN amount_residual = 0 THEN 'PAID'` means an invoice created with `amountTotal = 6000` and residual left at its default renders as **Paid** until some service writes the residual. A judge creating one invoice on stage sees it.
**Fix:** remove `@default(0)` from `amountResidual` on `VendorBill` and `CustomerInvoice`, make it required, and state that the create/update service always writes `amountResidual = amountTotal − SUM(confirmed allocations)` in the same transaction as any line edit. Add a guard clause to the generated column: `WHEN amount_total = 0 THEN 'NOT_PAID'` first.

**8. `section_04` §4.8(9) — `nextDocumentNumber()` cannot produce `PO0001` or `SO0001`.**
It returns `` `${row.prefix}${fiscalYear}/${padded}` `` unconditionally, so a PO comes out `PO2026/0001`. The mockup (and `section_03` §3.6) explicitly says **no year segment** on PO/SO.
**Fix:** add a `useYear Boolean @default(true)` column to `Sequence` and change the return to
```ts
return row.useYear
  ? `${row.prefix}${fiscalYear}/${String(row.allocated).padStart(row.padding,'0')}`
  : `${row.prefix}${String(row.allocated).padStart(row.padding,'0')}`;
```
Seed `purchase_order` and `sales_order` with `useYear = false`, prefix `PO`/`SO`, padding 4.

**9. `section_02` §2.8, line 569 — an unbalanced journal entry is printed as an example inside the section arguing debits must equal credits.**
> *"a judge posts a manual journal entry — Dr Cash 50,000 / Cr Capital 5,00,000 — and your Balance Sheet doesn't move"*

50,000 ≠ 5,00,000. §2.11 of the same section uses the correct balanced pair.
**Fix:** change to `Dr Cash 50,000 / Cr Capital 50,000`.

---

## HIGH — the hour budget does not fit, and the plan contradicts itself

**10. Sections 05, 06, 07 and 09 allocate ~28 hours into a 19-hour build.**
- §05 §5.12: engine total **≈10:30**, "leaving ~8.5 h for screens, seed data, polish and rehearsal"
- §06 §2: TOP 3 + D4 = **7.75 h marginal**, on top of required scope
- §07 §2.6: AI-1 + AI-2 = **2 h** minimum
- §09's Gantt allots the same work far less: Books Integrity **30 min** (vs §06's 2.5 h), bank reconciliation **1.0 h** (vs §06's 3.0 h), report screens + PDF + five-level drill-down together **1.25 h** (vs §06's 1.5 h for drill-down alone), and **zero minutes for any AI feature**.

10.5 + 7.75 + 2 = 20.25 hours before a single CRUD screen exists.
**Fix:** §09 is the clock and must win. In `section_05` §5.12, cut the engine table to the ~6 h "irreducible spine" it already names and move steps 7–9 into §09's Phases 11–13, restating the total as ≈6:30. In `section_06` §2, re-cost D1 to 1.0 h (audit queries + page; hash chain moves to the bench), D2 to 1.5 h (exact-amount + reference matching only; trigram + AI is the stretch), and change "6.25 hours for the TOP 3" to "≈3.25 h". In `section_07` §2.6, add one line: *"§09's timeline contains no AI block. AI is bench work taken from the T+18 exception slot; if Phase 13 slips, ship zero AI."*

**11. `section_09` §6 Cut Line 1 step 3 directly contradicts `section_03` §3.13.**
§09 says *"drop Purchase Orders and Sales Orders entirely."* That deletes four MUST items §03 lists under **NEVER cut**: the two non-blocking budget warnings (PO confirm is one of the two hook points), the conditional `PO` smart button, `Create Bill` carry-forward, and the `PO0001` sequence.
**Fix:** rewrite §09 Cut Line 1 step 3 as: *"Drop the **Sales Order** screen only (Invoice-direct). Keep the Purchase Order — it carries the PO-confirm budget warning, the `Create Bill` conversion and the conditional smart button, all of which §03 lists as never-cut. Saves ~40 min, not 80."*

**12. Feature-freeze time is stated three ways.**
`section_01` §5: *"features freeze at **T−4 hours**"*. `section_06` §10: *"Freeze all features at **T−6 hours**"* (then says spend "the last 3 hours" rehearsing — which leaves 3 hours unaccounted). `section_09` GATE 3: **T+18** (= T−6).
**Fix:** T+18 / T−6 everywhere. Edit `section_01` §5's last line and `section_06` §10 rule 1 (change "the last 3 hours" to "the last six hours: harden, deploy, three timed rehearsals").

**13. Sections 04 and 05 are two different, incompatible database blueprints — and 08 and 09 add two more.**
| | §04 | §05 | §08 | §09 |
|---|---|---|---|---|
| money | `Decimal(14,2)` | `BIGINT` paise | `Decimal(14,2)` | `BIGINT` paise |
| ids | `cuid()` string | `SERIAL` int | `uuid()` string | `cuid()` string |
| table names | `journal_item` (snake, `@@map`) | `journal_item` | `journal_item` | `"JournalItem"` (quoted PascalCase) |
| does `journal_item` carry `date`/`state`? | yes, denormalised; *"reports NEVER join"* | no; every report joins `journal_entry` | no | yes (`date` only) |
| hash chain on | `journal_entry` | — | — | `journal_item` |

A developer at hour 2 cannot build from this.
**Fix:** pick **`section_04`'s** schema as canonical (it is the most complete and it is the only one whose denormalised `journal_item` makes the covering index and the as-of slider work), then: rewrite `section_05` §5.2.2 as a short pointer to §04 with only the paise-vs-Decimal decision restated; change §05's `debit_paise/credit_paise` to `debit/credit` throughout §5.3–§5.11 or, if you keep paise, change §04 §4.4 to match — but say so in one place, once. Delete the duplicate schema blocks in `section_08` §8.8 and `section_09` Phase 2 and replace them with "see the Data Model section". Standardise `journal_item` (snake_case) and put the hash chain on **`journal_entry`** (fewer rows, and §06's canonical-JSON hash is entry-shaped).

---

## HIGH — accounting semantics that are stated two different ways

**14. Budget "Achieved" is defined three incompatible ways, and one of them double-counts GST.**
- `section_03` §3.5 + R-C1-04: `Σ` **invoice/bill line totals** where analytic matches
- `section_04` §4.7 + `section_05` §5.8.4: `Σ` **journal items** tagged with the analytic, P&L accounts only
- `section_05` §5.8.4 correctly notes this yields ₹12,400, not ₹14,200, for INV/2026/0009

With tax, the two methods differ by exactly the GST. §03's version is the one a judge reads off the mockup; §04/§05's is the correct one.
**Fix:** in `section_03` §3.5, change both Achieved rows to *"`Σ (credit−debit)` for INCOME / `Σ (debit−credit)` for EXPENSE over `journal_item` where `analytic_account_id = line.analytic` and `journal_entry.date` within the budget period and `source_type` in {CUSTOMER_INVOICE} / {VENDOR_BILL}"*, and add the one-line justification §04 already wrote ("the mockup describes searching invoices; we compute the same figure from the ledger, which also excludes GST correctly").

**15. Same section, the over-budget test mixes gross and net.**
`section_03` §3.5: *"Over-budget test: `document_total > (committed − achieved)`"*. `document_total` includes GST; `achieved` (per fix 14) excludes it. On the §10 demo the PO is ₹24,000 net but ₹28,320 gross — the warning would fire on the wrong number.
**Fix:** change to `Σ(untaxed line subtotals for that analytic) > (committed − achieved)`, matching `section_05` §5.8.6's `groupLinesByAnalytic(doc)`.

**16. Three contradictory rounding strategies.**
- `section_05` §5.4.5: *"Compute tax per line, round each line, then sum. Never round the total"* + *"derive the control line by subtraction, so a rounding error can only shift a paisa onto the receivable"*
- `section_06` §7 Test 9: *"explicit **largest-remainder allocation**… the engine emits a **Rounding Difference** line"*
- `section_09` Phase 3 item 6 / Risk 3: *"Any rounding difference is **pushed onto the largest line**"*

Pushing a rounding difference onto the largest revenue line silently misstates income; §05's derive-by-subtraction is right for exclusive tax and needs no rounding account at all.
**Fix:** adopt §05's rule everywhere. Rewrite `section_09` Phase 3 item 6 to *"round tax per line in paise; the control (receivable/payable) line is derived by subtraction, so the entry cannot be lopsided."* Rewrite `section_06` Test 9's answer to the same, keeping the Rounding Difference account **only** for price-inclusive taxes, as §05 §5.4.5 already scopes it. Delete "largest-remainder allocation" and "pushed onto the largest line".

**17. `section_06` §7 Test 7 — the inclusive-tax answer is arithmetically wrong and will be caught.**
> *"if I change that tax to inclusive, the same ₹47,200 invoice posts ₹40,000 / ₹7,200 differently — ₹7,200 becomes the tax inside the ₹47,200, so income drops to ₹40,000 minus the difference."*

If the unit price of ₹8,000 × 5 becomes tax-inclusive, the invoice total becomes **₹40,000**, not ₹47,200: net `40,000 / 1.18 = ₹33,898.31`, tax `₹6,101.69`. "₹40,000 minus the difference" is not a number.
**Fix:** replace with: *"Flip the tax to inclusive and the same ₹8,000 unit price now contains the GST. The invoice total drops from ₹47,200 to ₹40,000, of which ₹33,898.31 is income and ₹6,101.69 is Output GST. The engine reads the flag; nothing in the code changed."*

**18. Analytic `type` is per-account in the schema but per-line in the worked examples.**
`section_04` seeds `AnalyticAccount.type` as a single value and adds `@@unique([budgetId, analyticAccountId])`. But `section_05` §5.8.3's lookup table shows **"Project 1 | Income"** and **"Project 1 | Expense"** as two rows — impossible under that schema, and impossible to put on one budget under that unique constraint.
**Fix:** rule it once. Recommended: `AnalyticAccount.type` stays the single source (matching `section_02` §2.9 and the mockup's two-value dropdown), `BudgetLine.type` is a mirror not a choice, and `section_05` §5.8.3's table gets a note: *"the mockup draws Project 1 twice to illustrate both directions; in our model an analytic account has one type, so Project 1 is Expense and Showroom-West is Income."* Otherwise move `type` off the analytic account and relax the unique index to `(budgetId, analyticAccountId, type)`.

**19. Fiscal year is April–March in two sections and January–December in three.**
`section_02` §2.6 (*"In India the financial year runs 1 April to 31 March"*, CYE covering 01-Apr→05-Sep) and `section_04` (`fiscalYearStartMonth Int @default(4)`) vs `section_05` §5.5.3 (*"set it to 1 to match the mockup's calendar-year 2026 selector"*, and §5.5.7's rollover assumes Jan), `section_09` §5 (*"FY starting 01-Jan-2026 to match the mockup's 2026 year selector"*) and `section_10` §10.1 (seed 1-Apr→15-Sep, i.e. April). This changes what CYE contains, which is the number your whole demo hangs on.
**Fix:** pick **1 April – 31 March** (India, and it's what §10's seed uses), set `fiscalYearStartMonth = 4`, and add one line to `section_05` §5.5.3 and §5.5.7: *"the mockup's 'Year 2026' selector maps to FY 2026-27, i.e. 01-Apr-2026 → 31-Mar-2027; the label on screen stays '2026'."* Fix §5.5.7's rollover dates accordingly (2027 CYE starts 01-Apr-2027, so E9/E10 dated Feb-2027 are still FY2026 and would **not** roll — that example needs new dates, e.g. 10-May-2027 and 12-May-2027).

**20. Chart of Accounts seed count is stated as 8, 10, 12 and 15.**
`section_03` §3.9 (8) · `section_05` §5.3.2 (8 + 2 GST = 10) · `section_09` §5 (8 + 4 = 12) · `section_04` §4.6 (15, adding Inventory, COGS, Rounding). `section_10` Q15 then says *"You only have eight accounts"* and answers that CYE is not an account — while `section_04` seeds a `Current Year Earnings` account.
**Fix:** standardise on **12**: the 8 mandated + Input GST + Output GST + Retained Earnings + Current Year Earnings (the last two as non-postable placeholder accounts so the report can label its rows). Move Inventory / COGS / Rounding into §04's table with an explicit *"only if the stock differentiator is built"* marker. Update §10 Q15's answer to *"twelve — the eight the mockup mandates plus two GST accounts and two equity placeholders; CYE is computed at report time and the account exists only so the row has a label."*

---

## MEDIUM — code that will not run as written

**21. `section_08` §8.6 — Next.js 15 makes `params` and `searchParams` Promises. Every code sample here is a compile error.**
```tsx
{ params }: { params: { model: string } }  // then params.model
```
In App Router on `next@15` these are `Promise`s and must be awaited.
**Fix:** in both the page and the route-handler samples, change the type to `{ params: Promise<{ model: string }>, searchParams: Promise<Record<string,string|undefined>> }` and open the function with `const { model } = await params; const sp = await searchParams;`. Add one sentence to §8.2's Framework row flagging it.

**22. `section_08` §8.7(3) — the in-memory report cache produces exactly the stale-number failure the section says it prevents.**
`ledgerVersion` and `cache` are module-level in a Node process. On Vercel each lambda instance has its own; `bumpLedger()` in the instance that handled the POST does not clear the cache in the instance that serves the next GET. The judge posts an entry, the Balance Sheet doesn't move — the fake's exact symptom.
**Fix:** either (a) delete the cache — at ~400 journal items the query is sub-millisecond and the debounce in §8.7(3)(a) is sufficient — or (b) derive the version from the database instead of memory: `SELECT count(*)||':'||coalesce(max(posted_at)::text,'') FROM journal_entry WHERE state='POSTED'` as the cache key suffix, one cheap indexed query per request. Recommend (a) and say why.

**23. `section_04` §4.8(5) and (6) — Prisma-managed columns dropped and re-added as `GENERATED ALWAYS` will fight `prisma migrate` and can break inserts.**
`payment_state` is declared as a Prisma enum field and then dropped/re-added as generated `TEXT`; `line_subtotal` is declared `Decimal @default(0)` and re-added generated. Prisma's next `migrate dev` sees drift and offers a reset; and any `create()` that passes `lineSubtotal` gets Postgres's *"cannot insert a non-DEFAULT value into column"*.
**Fix:** replace both generated columns with ordinary columns plus a CHECK, which keeps the "physically unsettable" demo line without the drift:
```sql
ALTER TABLE customer_invoice_line ADD CONSTRAINT line_subtotal_correct
  CHECK (line_subtotal = ROUND(quantity * unit_price, 2));
ALTER TABLE customer_invoice ADD CONSTRAINT payment_state_correct
  CHECK (payment_state = CASE WHEN amount_total = 0 THEN 'NOT_PAID'
                              WHEN amount_residual = 0 THEN 'PAID'
                              WHEN amount_residual = amount_total THEN 'NOT_PAID'
                              ELSE 'PARTIAL' END);
```
Update the "Say this to a judge" line to *"there is no way to **store** a wrong payment status — a CHECK constraint rejects it."*

**24. `section_06` D1 — the append-only trigger references a column that exists in no schema.**
```sql
CREATE TRIGGER journal_item_append_only
  BEFORE UPDATE OR DELETE ON journal_item
  FOR EACH ROW WHEN (OLD.posted) EXECUTE FUNCTION forbid_posted_mutation();
```
`journal_item.posted` does not exist in §04 (`state EntryState`), §05 (no state column) or §08.
**Fix:** change the `WHEN` clause to `WHEN (OLD.state = 'POSTED')` and align with §04's schema; or drop the `WHEN` and use §04's function body, which looks the state up on the parent entry.

**25. `section_05` §5.3.4 — two BigInt bugs in the invoice builder.**
- `BigInt(l.qty) * BigInt(l.unitPricePaise)` — `qty` is `Decimal(12,3)` in §04. `BigInt(2.5)` throws `RangeError`.
- `roundPaise(subtotal * BigInt(t.rateBp) / 10000n)` — BigInt division **truncates**; `roundPaise` applied afterwards is a no-op. Tax of ₹333.335 silently becomes ₹333.33 always, never rounding up.

**Fix:**
```ts
const subtotal = (BigInt(Math.round(l.qty * 1000)) * BigInt(l.unitPricePaise)) / 1000n;
const amount = (subtotal * BigInt(t.rateBp) + 5000n) / 10000n;   // round-half-up in BigInt
```
and delete `roundPaise` from that line (keep it as the shared helper the two expressions use).

**26. `section_05` §5.3.4 — an unbalanced manual entry throws the wrong error, breaking the mockup's blocking-warning requirement.**
`BUILDERS.MANUAL` returns `control: null`; `closeEntry` then throws `PostingError('NO_CONTROL_ACCOUNT')` when `diff !== 0`. The mockup demands *"Blocking warning if the debit and credit amount don't match"* — the user gets "no control account" instead.
**Fix:** add before the `!control` check:
```ts
if (!control && docType === 'MANUAL')
  throw new PostingError('DEBIT_CREDIT_MISMATCH',
    { debit: dr, credit: cr, difference: diff });
```
and map it to a 422 whose message is *"Total debit and total credit must match. Difference: ₹X."*

**27. `section_06` D3 — the month-end grid query has holes, so the slider will show stale numbers.**
```sql
SUM(delta) OVER (PARTITION BY account_id ORDER BY month_end)
```
only emits rows for `(account, month)` pairs that had movement. Bank had no activity in June → no June row → dragging to June reads whatever the UI last had.
**Fix:** cross-join accounts against a month series before the window:
```sql
FROM (SELECT a.id AS account_id, m.month_end,
             COALESCE(d.delta,0) AS delta
      FROM account a
      CROSS JOIN generate_series(date '2026-04-30', date '2027-03-31', interval '1 month') AS m(month_end)
      LEFT JOIN (...per-month deltas...) d
             ON d.account_id = a.id AND d.month_end = m.month_end) x
```

**28. `section_08` §8.8 — the trigger declares `v_entry uuid` but ids are text.**
`JournalItem.entryId` is `String` in Prisma → `text` in Postgres (whether `cuid()` or `uuid()`). Assigning it into a `uuid` variable will error at runtime.
**Fix:** `v_entry text;` and `WHERE id = v_entry` (Postgres will compare text to text).

**29. `section_04` §4.9 — "heap fetches: 0" needs a VACUUM you never run.**
An index-only scan only skips the heap where the visibility map is set. Immediately after seeding, freshly-inserted pages are not all-visible, so your stage `EXPLAIN` will show non-zero heap fetches.
**Fix:** add to the seed script and to the §8.9 pre-demo checklist: `VACUUM (ANALYZE) journal_item;` after seeding, with one line of text saying why.

---

## MEDIUM — cross-section inconsistencies a judge could notice

**30. The bank matcher is specified three different ways.**
`section_06` D2: normalised weights `{amount .40, reference .30, partner .20, date .10}`, auto ≥ 0.90, margin ≥ 0.15. `section_07` AI-1: raw points `{ref 50, amount 30, tolerance 12, partner 0–20, date 0–10}` summing to 122, auto ≥ 85. `section_09` Phase 13: `{amount 45, tolerance 25, ref 35, partner 20, date 10, −30 wrong direction}`, auto > 80.
**Fix:** adopt `section_07`'s raw-point version (it has the direction penalty and the deterministic-first framing), delete the weight tables from §06 D2 and §09 Phase 13 and replace both with a pointer. Then recheck the confidence numbers quoted in §06's table, §09's CSV table and §10's demo table against the chosen scale — `section_09` CSV row 10 claims 92% for a ₹2 difference, which under §06's `scoreAmount` falls in the 0.60 bucket.

**31. `section_09` §5 — CSV row 2 contradicts itself.**
`UPI/CR/16992/AZUREFURN` with amount **−6,992**, described as a vendor payment. `CR` in a bank narration means money in; the amount is money out; and the direction penalty would fire against the correct match.
**Fix:** change the narration to `UPI/DR/16992/AZUREFURN` and add the note *"tests that the direction signal reads the sign, not the narration keyword."*

**32. PDF export is specified three incompatible ways, and one of them doesn't satisfy the mockup.**
`section_08` §8.2: `@react-pdf/renderer`. `section_09` Phase 10: *"Do **not** install a PDF library. Use `window.print()`."* `section_09` §6 cut-list item 6 calls that substitution "always take it". `section_10` §10.3: *"Click Print → **the PDF downloads**."* The mockup's annotation is *"Pdf download on click"* — `window.print()` opens the OS print dialog and does not download.
**Fix:** rule for `@react-pdf/renderer` behind `GET /api/reports/[name]/pdf` returning `Content-Disposition: attachment` (that is what "downloads on click" means), keep `window.print()` as the documented fallback, and delete §09 §6 item 6's "take this one always". Update §09 Phase 10's bullet accordingly.

**33. `section_08` §8.8 seeded-edge-cases list contradicts its own verify output.**
The verify block prints `Capital + Current Year Earnings ₹6,45,000` (with §06 splitting that as Capital 4,26,600 + CYE 2,18,400), but the seed bullet says *"Opening balances posted as a manual entry (Dr Cash + Bank, **Cr Capital ₹6,45,000**)"*. If opening capital is 6,45,000, equity is 8,63,400 and nothing ties.
**Fix:** change the seed bullet's figure to the canonical opening capital from §10 (`Cr Capital ₹6,00,000`) once finding 3 is applied, and re-derive the verify block from §10's numbers.

**34. Journal default-account field names differ in four places.**
`section_04`: `defaultAccountId` / `defaultDebitAccountId` / `defaultCreditAccountId`. `section_05` §5.3.2: `journal.default_account_id` only, with the counterparty coming from `contact.receivable_account_id` → company default. `section_09` Phase 1: `journal.defaultReceivableAccount` / `defaultPayableAccount`. `section_10` FLOW 1's Explain panel prints `Journal PURCHASE.default_credit_account`.
**Fix:** standardise on §04's three columns and rewrite §05 §5.3.2's R4 chain to `contact override → journal.defaultDebit/CreditAccount → company default`, §09's `POSTING_RULES` rows to use `journal.defaultDebitAccount` / `journal.defaultCreditAccount`, and §10's Explain panel likewise. Also add a note in `section_03` B10 that the Journal **form** shows one Default Account (per the mockup) and the two counterparty columns are seeded, not user-editable — otherwise a judge opening the Journals screen won't find the field your demo just claimed to edit.

**35. Hash chain is on entries in §06 and on items in §09/§10.**
§06 hashes `journal_entry` (`chain_seq`, `prev_hash`, `hash`, canonical JSON of header + sorted lines); §04 agrees. §09 Phase 2/12 puts `prevHash`/`hash` on `JournalItem` and prints `412/412`; §10 prints `HASH CHAIN BROKEN at journal_item #217`.
**Fix:** entries. Change §09 Phase 2's `JournalItem` block (move `prevHash`/`hash` to `JournalEntry`), §09 Phase 12's "each posted journal *item*" → "entry", the `412/412` → `41/41`, and §10's break output to `BROKEN at chain_seq #38 (INV/2026/0009)`.

**36. `section_01` §3.2 and `section_06` D3 — the Balance Sheet SQL is missing its account filter.**
Both print a `GROUP BY a.type` with `WHERE je.state='posted' AND je.date <= T` and no account-type restriction, so income and expense accounts are included. Combined with the injected CYE row, that double-counts profit.
**Fix:** add `AND a.type IN ('ASSET','BANK','CASH','LIABILITY','CAPITAL')` to both (§05 §5.5.3 already does this correctly via `a."group" = 'BALANCE_SHEET'`).

---

## LOW — accuracy nits worth ten minutes each

**37. `section_05` §5.5.6** says *"Nine posted entries"* and lists eight (E1–E8). Change to "Eight".

**38. `section_07` §2 cost/latency table understates AI-1 and AI-2.** On `claude-opus-5` thinking is **on by default** (adaptive) — omitting the `thinking` parameter does not disable it, and thinking tokens bill as output. The 600-output-token / 3–6 s estimate for AI-1 and the 12-second `AbortController` in §3.1 are both optimistic. *Fix:* add a sentence — *"Opus 5 runs adaptive thinking by default; at `effort: 'low'` expect roughly 2–3× the output tokens shown here and up to ~10 s. The replay cache (§3.2) is what makes this a non-issue on stage; raise the abort timeout to 20 s for live mode."* (The rest of §07 checks out: `messages.parse`, `output_config.format`, top-level `strict: true` with `additionalProperties: false`, and Opus 5 pricing at $5/$25 per MTok are all correct.)

**39. `section_04` §4.10** claims *"there is no `onDelete: Cascade` anywhere that could silently remove ledger history"*, but §4.7 declares `PaymentAllocation → CustomerInvoice/VendorBill` as `onDelete: Cascade`. Either soften the sentence to *"…anywhere on the ledger tables"* or change those two relations to `Restrict`.

**40. `section_04` §4.8(8)** re-adds `UNIQUE (journal_id, name)` on `journal_entry` and `UNIQUE (code, fiscal_year)` on `sequence`, both of which Prisma already creates from `@@unique`. Delete the two `ALTER TABLE` lines or the `@@unique` attributes, not both.

**41. `section_05` §5.5.6/§5.5.7 Balance Sheets print `Input GST Receivable` and `Output GST Payable` as extra rows.** The mockup draws exactly three asset rows (Bank, Cash, Debtors) and two on the right (Capital, Creditors). Add one sentence: *"The mockup's five rows are the section headings; because rows are driven by account type, any additional account with a non-zero balance appears under the correct heading. If a judge diffs against the drawing, say that out loud."*

**42. `section_10` §10.2** lists six tabs plus window B; the §10.9 cheat sheet says *"7 tabs open in order"*. Make both say six.

**43. `section_05` §5.3.7 and §5.4** use inconsistent rung labels (`R4.2` in the Explain panel; the §5.3.2 table gives R4 only a rung 1 and a rung-4 fallback). Renumber the R4 chain as R4.1 (contact override) / R4.2 (company default) and fix §5.4.2's `R2.4` / §5.4.1's `R1.4` to match.

**44. `section_05` §5.8.3** presents a lookup table with *"Project 1 | Income | Sales Invoice | 21,000"* and *"Project 1 | Expense | Vendor Bills | 21,000"* — identical figures for both directions, which reads as copied placeholder. Replace with the canonical §10 budget figures (Project 1, Expense, achieved 1,62,400) once finding 3 is applied.

---

## Sections that are clean

`section_02_accounting-101.md` is, apart from finding 9, **arithmetically correct throughout** — I recomputed the seven-entry ledger, the trial balance (5,50,000 both sides), the P&L (46,000 − 27,000 = 19,000) and the Balance Sheet (5,23,000 = 4,000 + 5,00,000 + 19,000), and the four-step accounting-equation derivation in §2.6 is a valid proof. The debit/credit direction table, the A-E-D mnemonic, the CYE/Retained-Earnings treatment, and the photo-vs-video framing are all correct accounting.

`section_10_demo-and-judge.md` §10.1 is the strongest numeric work in the document — every beat in the delta table ties, the closing equation ties (1,96,192 + 8,85,600 = 10,81,792), Net Income equals CYE at 2,35,600, and the budget and elapsed-percentage figures check out. Its problems are the tamper command (finding 2) and the fact that the rest of the document doesn't use its numbers (finding 3).