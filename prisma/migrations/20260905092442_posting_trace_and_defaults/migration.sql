-- DropIndex
DROP INDEX "ji_account_ledger_idx";

-- AlterTable
ALTER TABLE "company_settings" ADD COLUMN     "default_payable_account_id" TEXT,
ADD COLUMN     "default_receivable_account_id" TEXT,
ADD COLUMN     "default_tax_collected_account_id" TEXT,
ADD COLUMN     "default_tax_paid_account_id" TEXT;

-- AlterTable
ALTER TABLE "journal_entry" ADD COLUMN     "posting_trace" JSONB;
