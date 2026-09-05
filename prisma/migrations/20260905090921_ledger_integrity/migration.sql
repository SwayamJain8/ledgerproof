-- ═══════════════════════════════════════════════════════════════════════════
--  LEDGER INTEGRITY
--
--  Application code can be argued with. A database constraint cannot.
--  Everything in this file exists so that a wrong number is not merely a bug
--  we hope to catch, but a transaction Postgres refuses to commit.
--
--  Written by hand because Prisma's schema language cannot express CHECK
--  constraints, triggers, or partial/covering indexes.
--
--  NOTE ON CHECK vs GENERATED: line subtotals and payment-state badges are
--  enforced with CHECK constraints rather than GENERATED ALWAYS columns.
--  Same guarantee ("you cannot write a wrong value"), but Prisma's migration
--  diff ignores CHECKs while it *does* diff generated columns -- which would
--  put the schema in permanent drift.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
--  1. A journal item is one-sided, non-negative, and non-empty.
--
--  Without this, the tempting "fix" for an unbalanced entry is a negative
--  debit. A negative debit is a credit wearing a disguise and it makes every
--  report's sign handling wrong in a way that is almost impossible to find.
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE journal_item
  ADD CONSTRAINT journal_item_one_sided CHECK (
        debit_paise  >= 0
    AND credit_paise >= 0
    AND (debit_paise = 0 OR credit_paise = 0)
    AND (debit_paise + credit_paise) > 0
  );


-- ───────────────────────────────────────────────────────────────────────────
--  2. Header totals must balance -- but ONLY once posted.
--
--  The mockup draws a manual Journal Entry form where the user types lines and
--  THEN presses Post. An unconditional CHECK would make it impossible to save
--  a half-typed draft. Drafts are exempt; posting is absolute.
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE journal_entry
  ADD CONSTRAINT journal_entry_must_balance CHECK (
    state <> 'POSTED' OR total_debit_paise = total_credit_paise
  );


-- ───────────────────────────────────────────────────────────────────────────
--  3. The deferred balance assertion.
--
--  A journal entry is built line by line, so after inserting only the debit
--  line the entry is temporarily unbalanced -- that is normal and correct.
--  DEFERRABLE INITIALLY DEFERRED moves the check to COMMIT, which means the
--  *transaction* must balance. That is the actual accounting rule.
--
--  It also asserts that the four denormalised columns on journal_item really
--  do agree with their parent, which is what makes it safe for every report to
--  read journal_item without ever joining upward.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION assert_entry_consistent(p_entry TEXT) RETURNS void AS $$
DECLARE
  v_state    TEXT;
  v_date     DATE;
  v_journal  TEXT;
  v_hd       BIGINT;
  v_hc       BIGINT;
  v_debit    BIGINT;
  v_credit   BIGINT;
  v_bad      BIGINT;
  v_count    BIGINT;
BEGIN
  SELECT state::text, date, journal_id, total_debit_paise, total_credit_paise
    INTO v_state, v_date, v_journal, v_hd, v_hc
    FROM journal_entry WHERE id = p_entry;

  -- Entry was cascade-deleted in this same transaction; nothing to assert.
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- The denormalised columns must mirror the parent, always, in every state.
  SELECT COUNT(*) INTO v_bad
    FROM journal_item
   WHERE entry_id = p_entry
     AND (state::text <> v_state OR date <> v_date OR journal_id <> v_journal);

  IF v_bad > 0 THEN
    RAISE EXCEPTION
      'journal_item_denormalisation_mismatch: % item(s) on entry % disagree with the header on state/date/journal',
      v_bad, p_entry
      USING ERRCODE = '23514';
  END IF;

  -- Balance is only asserted for POSTED entries. Drafts may be lopsided.
  IF v_state <> 'POSTED' THEN
    RETURN;
  END IF;

  SELECT COUNT(*), COALESCE(SUM(debit_paise), 0), COALESCE(SUM(credit_paise), 0)
    INTO v_count, v_debit, v_credit
    FROM journal_item WHERE entry_id = p_entry;

  -- Double entry needs two sides. A one-line entry is never valid.
  IF v_count < 2 THEN
    RAISE EXCEPTION
      'journal_entry_needs_two_lines: posted entry % has only % line(s)',
      p_entry, v_count
      USING ERRCODE = '23514';
  END IF;

  IF v_debit <> v_credit THEN
    RAISE EXCEPTION
      'journal_entry_must_balance: entry % is unbalanced - debit %, credit %, difference %',
      p_entry, v_debit, v_credit, (v_debit - v_credit)
      USING ERRCODE = '23514';
  END IF;

  IF v_debit <> v_hd OR v_credit <> v_hc THEN
    RAISE EXCEPTION
      'journal_entry_totals_mismatch: header %/% does not match items %/%',
      v_hd, v_hc, v_debit, v_credit
      USING ERRCODE = '23514';
  END IF;
END;
$$ LANGUAGE plpgsql;


-- Fired from the item side. TG_OP is branched explicitly because on DELETE the
-- NEW record is unassigned and touching NEW.entry_id would itself error.
CREATE OR REPLACE FUNCTION trg_item_entry_consistent() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM assert_entry_consistent(OLD.entry_id);
  ELSE
    PERFORM assert_entry_consistent(NEW.entry_id);
    -- An UPDATE that re-parents a line must validate both entries.
    IF TG_OP = 'UPDATE' AND OLD.entry_id <> NEW.entry_id THEN
      PERFORM assert_entry_consistent(OLD.entry_id);
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Fired from the header side. This one is essential and easy to forget: the
-- posting routine's final statement is `UPDATE journal_entry SET state='POSTED'`,
-- which touches no journal_item row at all. Without this trigger the balance
-- assertion would never run on the one transition that matters.
CREATE OR REPLACE FUNCTION trg_entry_consistent() RETURNS trigger AS $$
BEGIN
  PERFORM assert_entry_consistent(NEW.id);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER journal_item_entry_must_balance
  AFTER INSERT OR UPDATE OR DELETE ON journal_item
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION trg_item_entry_consistent();

CREATE CONSTRAINT TRIGGER journal_entry_must_balance_on_post
  AFTER INSERT OR UPDATE ON journal_entry
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION trg_entry_consistent();


-- ───────────────────────────────────────────────────────────────────────────
--  4. Posted entries are append-only.
--
--  In accounting a Delete button is a fraud tool. Cancelling a posted entry
--  writes a mirror-image reversal; both rows stay in the books forever.
--
--  ORDERING RULE, and it will lock you out of your own posting routine if you
--  get it backwards: the posting service must flip journal_item.state to
--  POSTED *before* journal_entry.state, because this trigger reads the parent.
--  Reset-to-draft runs the same two statements in the opposite order.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION forbid_posted_item_mutation() RETURNS trigger AS $$
DECLARE
  v_state TEXT;
BEGIN
  SELECT state::text INTO v_state FROM journal_entry WHERE id = OLD.entry_id;

  IF v_state = 'POSTED' THEN
    RAISE EXCEPTION
      'journal_item_is_append_only: item % belongs to POSTED entry % - cancel it with a reversal entry instead',
      OLD.id, OLD.entry_id
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER journal_item_is_append_only
  BEFORE UPDATE OR DELETE ON journal_item
  FOR EACH ROW EXECUTE FUNCTION forbid_posted_item_mutation();


-- ───────────────────────────────────────────────────────────────────────────
--  5. Payment allocations are well-formed and cannot exceed either side.
--
--  A bug in the allocation service becomes a loud failure in development
--  rather than a quietly wrong Debtors figure on stage.
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE payment_allocation
  ADD CONSTRAINT allocation_exactly_one_target CHECK (
    (customer_invoice_id IS NOT NULL)::int + (vendor_bill_id IS NOT NULL)::int = 1
  );

ALTER TABLE payment_allocation
  ADD CONSTRAINT allocation_amount_positive CHECK (amount_paise > 0);

ALTER TABLE payment
  ADD CONSTRAINT payment_amount_positive CHECK (amount_paise > 0);

ALTER TABLE payment
  ADD CONSTRAINT payment_not_over_allocated CHECK (
    allocated_paise >= 0 AND allocated_paise <= amount_paise
  );

ALTER TABLE customer_invoice
  ADD CONSTRAINT invoice_residual_in_range CHECK (
    residual_paise >= 0 AND residual_paise <= total_paise
  );

ALTER TABLE vendor_bill
  ADD CONSTRAINT bill_residual_in_range CHECK (
    residual_paise >= 0 AND residual_paise <= total_paise
  );


-- ───────────────────────────────────────────────────────────────────────────
--  6. The payment badge is the mockup's status legend, compiled into the DB.
--
--  Legend, verbatim: Paid if amount due = 0 / Partial if amount due < total /
--  Not Paid if amount due = total. As written, "Partial" also covers due = 0,
--  so the badges are evaluated in order -- which is the only reading that
--  satisfies the mockup's own "only one at a time".
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE customer_invoice
  ADD CONSTRAINT invoice_payment_state_correct CHECK (
    payment_state = (CASE
      WHEN residual_paise = 0            THEN 'PAID'
      WHEN residual_paise = total_paise  THEN 'NOT_PAID'
      ELSE                                    'PARTIAL'
    END)::"PaymentState"
  );

ALTER TABLE vendor_bill
  ADD CONSTRAINT bill_payment_state_correct CHECK (
    payment_state = (CASE
      WHEN residual_paise = 0            THEN 'PAID'
      WHEN residual_paise = total_paise  THEN 'NOT_PAID'
      ELSE                                    'PARTIAL'
    END)::"PaymentState"
  );


-- ───────────────────────────────────────────────────────────────────────────
--  7. Line totals cannot disagree with quantity x price.
--
--  Mockup annotates this twice: "Unit Price * Quantity" and "(3Qty * 2000)".
--  quantity is in milli-units and price is in paise, so the exact expression
--  is (qty_milli * price_paise + 500) / 1000 -- integer division on
--  non-negative operands, which rounds half up to the nearest paisa.
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE purchase_order_line
  ADD CONSTRAINT po_line_amounts_sane CHECK (quantity_milli >= 0 AND unit_price_paise >= 0);
ALTER TABLE purchase_order_line
  ADD CONSTRAINT po_line_subtotal_correct CHECK (
    subtotal_paise = (quantity_milli * unit_price_paise + 500) / 1000
  );

ALTER TABLE vendor_bill_line
  ADD CONSTRAINT vb_line_amounts_sane CHECK (quantity_milli >= 0 AND unit_price_paise >= 0);
ALTER TABLE vendor_bill_line
  ADD CONSTRAINT vb_line_subtotal_correct CHECK (
    subtotal_paise = (quantity_milli * unit_price_paise + 500) / 1000
  );

ALTER TABLE sales_order_line
  ADD CONSTRAINT so_line_amounts_sane CHECK (quantity_milli >= 0 AND unit_price_paise >= 0);
ALTER TABLE sales_order_line
  ADD CONSTRAINT so_line_subtotal_correct CHECK (
    subtotal_paise = (quantity_milli * unit_price_paise + 500) / 1000
  );

ALTER TABLE customer_invoice_line
  ADD CONSTRAINT ci_line_amounts_sane CHECK (quantity_milli >= 0 AND unit_price_paise >= 0);
ALTER TABLE customer_invoice_line
  ADD CONSTRAINT ci_line_subtotal_correct CHECK (
    subtotal_paise = (quantity_milli * unit_price_paise + 500) / 1000
  );


-- ───────────────────────────────────────────────────────────────────────────
--  8. Partial conversion cannot over-bill.
--
--  Bill 12 of 20 chairs, come back and bill 8 more; the constraint stops you
--  at 20. A team with a one-shot "Convert" button cannot do this at all.
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE purchase_order_line
  ADD CONSTRAINT po_line_not_over_billed CHECK (
    qty_billed_milli >= 0 AND qty_billed_milli <= quantity_milli
  );

ALTER TABLE sales_order_line
  ADD CONSTRAINT so_line_not_over_invoiced CHECK (
    qty_invoiced_milli >= 0 AND qty_invoiced_milli <= quantity_milli
  );


-- ───────────────────────────────────────────────────────────────────────────
--  9. Business rules the mockup states in words.
-- ───────────────────────────────────────────────────────────────────────────

-- "Login Id must be unique AND 6-12 characters" -- stated on both the
-- Create User form and the Sign Up form.
ALTER TABLE "user"
  ADD CONSTRAINT user_login_length CHECK (char_length(login_id) BETWEEN 6 AND 12);

-- A budget cannot revise itself, and cannot end before it starts.
ALTER TABLE budget
  ADD CONSTRAINT budget_not_self_revision CHECK (revision_of_id IS DISTINCT FROM id);
ALTER TABLE budget
  ADD CONSTRAINT budget_period_ordered CHECK (end_date >= start_date);

ALTER TABLE budget_line
  ADD CONSTRAINT budget_line_committed_non_negative CHECK (committed_paise >= 0);

-- Due date is never before the document date.
ALTER TABLE customer_invoice
  ADD CONSTRAINT invoice_due_after_date CHECK (due_date >= invoice_date);
ALTER TABLE vendor_bill
  ADD CONSTRAINT bill_due_after_date CHECK (due_date >= bill_date);

-- Document totals are internally consistent.
ALTER TABLE customer_invoice
  ADD CONSTRAINT invoice_total_composition CHECK (total_paise = untaxed_paise + tax_paise);
ALTER TABLE vendor_bill
  ADD CONSTRAINT bill_total_composition CHECK (total_paise = untaxed_paise + tax_paise);
ALTER TABLE sales_order
  ADD CONSTRAINT so_total_composition CHECK (total_paise = untaxed_paise + tax_paise);
ALTER TABLE purchase_order
  ADD CONSTRAINT po_total_composition CHECK (total_paise = untaxed_paise + tax_paise);

-- Tax rates are a sane percentage, in basis points.
ALTER TABLE tax
  ADD CONSTRAINT tax_rate_in_range CHECK (rate_bp >= 0 AND rate_bp <= 10000);

-- Sequence counters only move forward.
ALTER TABLE sequence
  ADD CONSTRAINT sequence_next_number_positive CHECK (next_number >= 1);


-- ───────────────────────────────────────────────────────────────────────────
--  10. Exactly one account may hold each singleton role.
--
--  The Balance Sheet's equity section asks the database for "the current year
--  earnings account". That question must have exactly one answer.
-- ───────────────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX account_one_current_year_earnings
  ON account (subtype) WHERE subtype = 'CURRENT_YEAR_EARNINGS';
CREATE UNIQUE INDEX account_one_retained_earnings
  ON account (subtype) WHERE subtype = 'RETAINED_EARNINGS';
CREATE UNIQUE INDEX account_one_rounding
  ON account (subtype) WHERE subtype = 'ROUNDING';

-- The singleton settings row really is a singleton.
ALTER TABLE company_settings
  ADD CONSTRAINT company_settings_singleton CHECK (id = 1);


-- ───────────────────────────────────────────────────────────────────────────
--  11. Report indexes.
--
--  journal_item is the only table any report reads, so every report is a
--  differently-shaped scan of the same table. These are the shapes Prisma's
--  schema language cannot express: covering (INCLUDE) and partial (WHERE).
-- ───────────────────────────────────────────────────────────────────────────

-- Balance Sheet and P&L -- the most-run query in the app. "state, then date,
-- then account" matches the filter order exactly, and INCLUDE makes it a
-- covering index so Postgres answers the aggregation without touching the heap.
CREATE INDEX ji_report_idx
  ON journal_item (date, account_id)
  INCLUDE (debit_paise, credit_paise)
  WHERE state = 'POSTED';

-- General ledger drill-down: click "Debtors" and get every line in that
-- account, in date order, with a running balance.
CREATE INDEX ji_account_ledger_idx
  ON journal_item (account_id, date)
  INCLUDE (debit_paise, credit_paise, partner_id, entry_id);

-- Partner ledger and receivables aging. Partial, because most items (income,
-- tax, bank) carry no partner.
CREATE INDEX ji_partner_idx
  ON journal_item (partner_id, date)
  INCLUDE (debit_paise, credit_paise, account_id)
  WHERE partner_id IS NOT NULL;

-- Budget actuals: sum everything tagged with one analytic between two dates.
CREATE INDEX ji_analytic_idx
  ON journal_item (analytic_account_id, date)
  INCLUDE (debit_paise, credit_paise, account_id)
  WHERE analytic_account_id IS NOT NULL;

-- The receivables aging report: open invoices bucketed by days overdue.
CREATE INDEX invoice_open_idx
  ON customer_invoice (due_date)
  WHERE state = 'POSTED' AND residual_paise > 0;

CREATE INDEX bill_open_idx
  ON vendor_bill (due_date)
  WHERE state = 'POSTED' AND residual_paise > 0;
