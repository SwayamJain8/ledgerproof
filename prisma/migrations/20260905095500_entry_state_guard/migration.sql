-- ───────────────────────────────────────────────────────────────────────────
--  Close the back door in the append-only guarantee.
--
--  `journal_item_is_append_only` reads the PARENT entry's state to decide
--  whether a line is frozen. So the way around it was never to edit a posted
--  line at all -- it was to demote its entry first:
--
--      UPDATE journal_entry SET state = 'DRAFT' WHERE id = '...';   -- allowed!
--      UPDATE journal_item  SET debit_paise = 1 WHERE ...;          -- now allowed
--
--  Two statements, no application code, and the ledger is editable. The smoke
--  test's own cleanup block does exactly this, which is how it surfaced.
--
--  Reset-to-Draft is still a real feature (the mockup draws the button, and
--  Odoo ships it), so the fix is not to forbid the transition -- it is to make
--  the transition impossible to perform ANONYMOUSLY. A caller must opt in
--  within its transaction:
--
--      SET LOCAL app.allow_reset = 'on';
--
--  `resetEntryToDraft()` sets that flag after it has checked admin rights, the
--  period lock and the payment allocations, and it writes an audit row in the
--  same transaction. SET LOCAL dies with the transaction, so the escape hatch
--  can never be left propped open.
-- ───────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION forbid_posted_entry_mutation() RETURNS trigger AS $$
BEGIN
  IF OLD.state <> 'POSTED' THEN
    RETURN NEW;
  END IF;

  -- POSTED -> DRAFT: the sanctioned, flagged, audited transition.
  IF NEW.state = 'DRAFT' THEN
    IF current_setting('app.allow_reset', true) IS DISTINCT FROM 'on' THEN
      RAISE EXCEPTION
        'journal_entry_is_append_only: entry % is POSTED - use Reset to Draft, which is admin-only and audited',
        OLD.id
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  -- Anything else about a posted entry is frozen outright. Moving a posted
  -- entry's DATE would silently restate a closed period; moving its JOURNAL
  -- would relabel the source of the money.
  IF NEW.state            <> OLD.state
     OR NEW.date          <> OLD.date
     OR NEW.journal_id    <> OLD.journal_id
     OR NEW.total_debit_paise  <> OLD.total_debit_paise
     OR NEW.total_credit_paise <> OLD.total_credit_paise
  THEN
    RAISE EXCEPTION
      'journal_entry_is_append_only: entry % is POSTED - cancel it with a reversal entry instead',
      OLD.id
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER journal_entry_is_append_only
  BEFORE UPDATE ON journal_entry
  FOR EACH ROW EXECUTE FUNCTION forbid_posted_entry_mutation();

-- Deleting a posted entry would cascade its items away and leave no trace.
CREATE OR REPLACE FUNCTION forbid_posted_entry_delete() RETURNS trigger AS $$
BEGIN
  IF OLD.state = 'POSTED' AND current_setting('app.allow_reset', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION
      'journal_entry_is_append_only: entry % is POSTED and cannot be deleted',
      OLD.id
      USING ERRCODE = '23514';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER journal_entry_no_posted_delete
  BEFORE DELETE ON journal_entry
  FOR EACH ROW EXECUTE FUNCTION forbid_posted_entry_delete();
