-- Proof, at the database level, that the ledger rules are not merely hopes.
-- Run:  docker exec -i odoo-pg psql -U postgres -d urbanfurniture < scripts/sql/smoke-integrity.sql
--
-- Every block is wrapped so the script leaves the database exactly as it found
-- it. Four of the seven blocks are SUPPOSED to fail; the expected error name is
-- printed above each one.

\set ON_ERROR_STOP off
\timing off

-- ── fixture ────────────────────────────────────────────────────────────────
BEGIN;
INSERT INTO account (id, code, name, type, subtype, reconcilable, active, created_at, updated_at) VALUES
  ('smoke_bank', 'Z1100', 'Smoke Bank A/c',    'BANK',    'NONE', false, true, now(), now()),
  ('smoke_cap',  'Z3100', 'Smoke Capital A/c', 'CAPITAL', 'NONE', false, true, now(), now());
INSERT INTO journal (id, code, name, type, sequence_prefix, active) VALUES
  ('smoke_jrn', 'ZBNK', 'Smoke Bank', 'BANK', 'ZBNK', true);
COMMIT;


\echo ''
\echo '=== 1. UNBALANCED POSTED ENTRY -- expect journal_entry_must_balance ==='
BEGIN;
INSERT INTO journal_entry (id, name, journal_id, date, state, source_type, total_debit_paise, total_credit_paise, created_at)
VALUES ('smoke_je1', 'SMOKE/0001', 'smoke_jrn', DATE '2026-09-15', 'POSTED', 'MANUAL', 500000, 500000, now());
INSERT INTO journal_item (id, entry_id, line_no, account_id, debit_paise, credit_paise, date, state, journal_id, created_at) VALUES
  ('smoke_ji1', 'smoke_je1', 1, 'smoke_bank', 500000,      0, DATE '2026-09-15', 'POSTED', 'smoke_jrn', now()),
  ('smoke_ji2', 'smoke_je1', 2, 'smoke_cap',       0, 400000, DATE '2026-09-15', 'POSTED', 'smoke_jrn', now());
COMMIT;   -- <-- the deferred trigger fires here, not on the INSERTs
ROLLBACK;


\echo ''
\echo '=== 2. NEGATIVE DEBIT -- expect journal_item_one_sided ==='
BEGIN;
INSERT INTO journal_entry (id, name, journal_id, date, state, source_type, total_debit_paise, total_credit_paise, created_at)
VALUES ('smoke_je2', 'SMOKE/0002', 'smoke_jrn', DATE '2026-09-15', 'DRAFT', 'MANUAL', 0, 0, now());
INSERT INTO journal_item (id, entry_id, line_no, account_id, debit_paise, credit_paise, date, state, journal_id, created_at)
VALUES ('smoke_ji3', 'smoke_je2', 1, 'smoke_bank', -500000, 0, DATE '2026-09-15', 'DRAFT', 'smoke_jrn', now());
ROLLBACK;


\echo ''
\echo '=== 3. UNBALANCED *DRAFT* -- expect SUCCESS (drafts are exempt) ==='
BEGIN;
INSERT INTO journal_entry (id, name, journal_id, date, state, source_type, total_debit_paise, total_credit_paise, created_at)
VALUES ('smoke_je3', 'SMOKE/0003', 'smoke_jrn', DATE '2026-09-15', 'DRAFT', 'MANUAL', 500000, 0, now());
INSERT INTO journal_item (id, entry_id, line_no, account_id, debit_paise, credit_paise, date, state, journal_id, created_at)
VALUES ('smoke_ji4', 'smoke_je3', 1, 'smoke_bank', 500000, 0, DATE '2026-09-15', 'DRAFT', 'smoke_jrn', now());
COMMIT;
\echo '    ^ committed, as it must: the mockup lets you type a JE and post it later'
BEGIN;
DELETE FROM journal_entry WHERE id = 'smoke_je3';
COMMIT;


\echo ''
\echo '=== 4. BALANCED POSTED ENTRY -- expect SUCCESS ==='
BEGIN;
INSERT INTO journal_entry (id, name, journal_id, date, state, source_type, total_debit_paise, total_credit_paise, created_at)
VALUES ('smoke_je4', 'SMOKE/0004', 'smoke_jrn', DATE '2026-09-15', 'POSTED', 'MANUAL', 500000, 500000, now());
INSERT INTO journal_item (id, entry_id, line_no, account_id, debit_paise, credit_paise, date, state, journal_id, created_at) VALUES
  ('smoke_ji5', 'smoke_je4', 1, 'smoke_bank', 500000,      0, DATE '2026-09-15', 'POSTED', 'smoke_jrn', now()),
  ('smoke_ji6', 'smoke_je4', 2, 'smoke_cap',       0, 500000, DATE '2026-09-15', 'POSTED', 'smoke_jrn', now());
COMMIT;


\echo ''
\echo '=== 5. TAMPER WITH A POSTED ITEM -- expect journal_item_is_append_only ==='
UPDATE journal_item SET debit_paise = 9999900 WHERE id = 'smoke_ji5';


\echo ''
\echo '=== 6. DEMOTE A POSTED ENTRY TO DRAFT -- expect journal_entry_is_append_only ==='
\echo '    (the back door: unfreeze the parent, then edit its lines freely)'
BEGIN;
UPDATE journal_entry SET state = 'DRAFT' WHERE id = 'smoke_je4';
ROLLBACK;


\echo ''
\echo '=== 7. THE SAME DEMOTION, VIA THE AUDITED ESCAPE HATCH -- expect SUCCESS ==='
BEGIN;
SET LOCAL app.allow_reset = 'on';
UPDATE journal_entry SET state = 'DRAFT' WHERE id = 'smoke_je4';
UPDATE journal_item  SET state = 'DRAFT' WHERE entry_id = 'smoke_je4';
COMMIT;
\echo '    ^ this is what Reset to Draft does, after checking admin rights,'
\echo '      the period lock and outstanding payments, and writing an audit row.'


\echo ''
\echo '=== cleanup ==='
DELETE FROM journal_entry WHERE id LIKE 'smoke!_%' ESCAPE '!';
DELETE FROM journal WHERE id = 'smoke_jrn';
DELETE FROM account WHERE id LIKE 'smoke!_%' ESCAPE '!';
\echo 'done.'
