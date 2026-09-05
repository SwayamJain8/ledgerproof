-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'ACCOUNTANT', 'PORTAL');

-- CreateEnum
CREATE TYPE "ContactType" AS ENUM ('CUSTOMER', 'VENDOR', 'BOTH');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('GOODS', 'SERVICE', 'COMBO');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('ASSET', 'LIABILITY', 'BANK', 'CAPITAL', 'CASH', 'INCOME', 'EXPENSE', 'OTHER_EXPENSE');

-- CreateEnum
CREATE TYPE "AccountSubtype" AS ENUM ('NONE', 'RECEIVABLE', 'PAYABLE', 'TAX_COLLECTED', 'TAX_PAID', 'INVENTORY', 'COGS', 'RETAINED_EARNINGS', 'CURRENT_YEAR_EARNINGS', 'ROUNDING');

-- CreateEnum
CREATE TYPE "JournalType" AS ENUM ('SALES', 'PURCHASE', 'BANK', 'CASH');

-- CreateEnum
CREATE TYPE "EntryState" AS ENUM ('DRAFT', 'POSTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EntrySource" AS ENUM ('MANUAL', 'VENDOR_BILL', 'CUSTOMER_INVOICE', 'PAYMENT', 'STOCK_MOVE', 'REVERSAL', 'OPENING_BALANCE');

-- CreateEnum
CREATE TYPE "TaxScope" AS ENUM ('SALE', 'PURCHASE', 'BOTH');

-- CreateEnum
CREATE TYPE "TaxComputation" AS ENUM ('EXCLUSIVE', 'INCLUSIVE');

-- CreateEnum
CREATE TYPE "OrderState" AS ENUM ('DRAFT', 'CONFIRMED', 'PARTIALLY_BILLED', 'BILLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DocState" AS ENUM ('DRAFT', 'POSTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentState" AS ENUM ('NOT_PAID', 'PARTIAL', 'PAID');

-- CreateEnum
CREATE TYPE "PaymentDirection" AS ENUM ('SEND', 'RECEIVE');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('BANK', 'CASH');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AnalyticType" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "BudgetState" AS ENUM ('DRAFT', 'CONFIRMED', 'REVISED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StockDirection" AS ENUM ('IN', 'OUT');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "login_id" VARCHAR(12) NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'PORTAL',
    "contact_id" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ContactType" NOT NULL DEFAULT 'CUSTOMER',
    "email" TEXT,
    "mobile" VARCHAR(15),
    "street1" TEXT,
    "street2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT DEFAULT 'India',
    "pincode" VARCHAR(6),
    "image_url" TEXT,
    "receivable_account_id" TEXT,
    "payable_account_id" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "income_account_id" TEXT,
    "expense_account_id" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "product_category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ProductType" NOT NULL DEFAULT 'GOODS',
    "sales_price_paise" BIGINT NOT NULL DEFAULT 0,
    "cost_paise" BIGINT NOT NULL DEFAULT 0,
    "category_id" TEXT,
    "image_url" TEXT,
    "income_account_id" TEXT,
    "expense_account_id" TEXT,
    "sales_tax_id" TEXT,
    "purchase_tax_id" TEXT,
    "trackInventory" BOOLEAN NOT NULL DEFAULT true,
    "avg_cost_paise" BIGINT NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "subtype" "AccountSubtype" NOT NULL DEFAULT 'NONE',
    "reconcilable" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(8) NOT NULL,
    "name" TEXT NOT NULL,
    "type" "JournalType" NOT NULL,
    "default_account_id" TEXT,
    "default_debit_account_id" TEXT,
    "default_credit_account_id" TEXT,
    "sequence_prefix" VARCHAR(8) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "journal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entry" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "journal_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "ref" TEXT,
    "partner_id" TEXT,
    "state" "EntryState" NOT NULL DEFAULT 'DRAFT',
    "source_type" "EntrySource" NOT NULL DEFAULT 'MANUAL',
    "source_id" TEXT,
    "reversal_of_id" TEXT,
    "total_debit_paise" BIGINT NOT NULL DEFAULT 0,
    "total_credit_paise" BIGINT NOT NULL DEFAULT 0,
    "chain_index" INTEGER,
    "prev_hash" VARCHAR(64),
    "hash" VARCHAR(64),
    "posted_at" TIMESTAMP(3),
    "posted_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_item" (
    "id" TEXT NOT NULL,
    "entry_id" TEXT NOT NULL,
    "line_no" INTEGER NOT NULL,
    "account_id" TEXT NOT NULL,
    "label" TEXT,
    "debit_paise" BIGINT NOT NULL DEFAULT 0,
    "credit_paise" BIGINT NOT NULL DEFAULT 0,
    "date" DATE NOT NULL,
    "state" "EntryState" NOT NULL DEFAULT 'DRAFT',
    "journal_id" TEXT NOT NULL,
    "partner_id" TEXT,
    "analytic_account_id" TEXT,
    "product_id" TEXT,
    "tax_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rate_bp" INTEGER NOT NULL,
    "scope" "TaxScope" NOT NULL DEFAULT 'BOTH',
    "computation" "TaxComputation" NOT NULL DEFAULT 'EXCLUSIVE',
    "collected_account_id" TEXT,
    "paid_account_id" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "tax_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sequence" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "prefix" VARCHAR(16) NOT NULL,
    "fiscal_year" INTEGER NOT NULL,
    "padding" INTEGER NOT NULL DEFAULT 4,
    "use_year" BOOLEAN NOT NULL DEFAULT true,
    "next_number" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "sequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "order_date" DATE NOT NULL,
    "state" "OrderState" NOT NULL DEFAULT 'DRAFT',
    "untaxed_paise" BIGINT NOT NULL DEFAULT 0,
    "tax_paise" BIGINT NOT NULL DEFAULT 0,
    "total_paise" BIGINT NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_line" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "line_no" INTEGER NOT NULL,
    "product_id" TEXT NOT NULL,
    "description" TEXT,
    "analytic_account_id" TEXT,
    "quantity_milli" BIGINT NOT NULL,
    "unit_price_paise" BIGINT NOT NULL,
    "tax_id" TEXT,
    "subtotal_paise" BIGINT NOT NULL DEFAULT 0,
    "qty_billed_milli" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "purchase_order_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_bill" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "purchase_order_id" TEXT,
    "vendor_id" TEXT NOT NULL,
    "bill_reference" TEXT,
    "bill_date" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "state" "DocState" NOT NULL DEFAULT 'DRAFT',
    "untaxed_paise" BIGINT NOT NULL DEFAULT 0,
    "tax_paise" BIGINT NOT NULL DEFAULT 0,
    "total_paise" BIGINT NOT NULL DEFAULT 0,
    "residual_paise" BIGINT NOT NULL DEFAULT 0,
    "payment_state" "PaymentState" NOT NULL DEFAULT 'NOT_PAID',
    "journal_entry_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_bill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_bill_line" (
    "id" TEXT NOT NULL,
    "bill_id" TEXT NOT NULL,
    "line_no" INTEGER NOT NULL,
    "product_id" TEXT NOT NULL,
    "description" TEXT,
    "account_id" TEXT NOT NULL,
    "analytic_account_id" TEXT,
    "quantity_milli" BIGINT NOT NULL,
    "unit_price_paise" BIGINT NOT NULL,
    "tax_id" TEXT,
    "subtotal_paise" BIGINT NOT NULL DEFAULT 0,
    "purchase_order_line_id" TEXT,

    CONSTRAINT "vendor_bill_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_order" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "order_date" DATE NOT NULL,
    "state" "OrderState" NOT NULL DEFAULT 'DRAFT',
    "untaxed_paise" BIGINT NOT NULL DEFAULT 0,
    "tax_paise" BIGINT NOT NULL DEFAULT 0,
    "total_paise" BIGINT NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_order_line" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "line_no" INTEGER NOT NULL,
    "product_id" TEXT NOT NULL,
    "description" TEXT,
    "analytic_account_id" TEXT,
    "quantity_milli" BIGINT NOT NULL,
    "unit_price_paise" BIGINT NOT NULL,
    "tax_id" TEXT,
    "subtotal_paise" BIGINT NOT NULL DEFAULT 0,
    "qty_invoiced_milli" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "sales_order_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_invoice" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sales_order_id" TEXT,
    "customer_id" TEXT NOT NULL,
    "invoice_reference" TEXT,
    "invoice_date" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "state" "DocState" NOT NULL DEFAULT 'DRAFT',
    "untaxed_paise" BIGINT NOT NULL DEFAULT 0,
    "tax_paise" BIGINT NOT NULL DEFAULT 0,
    "total_paise" BIGINT NOT NULL DEFAULT 0,
    "residual_paise" BIGINT NOT NULL DEFAULT 0,
    "payment_state" "PaymentState" NOT NULL DEFAULT 'NOT_PAID',
    "journal_entry_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_invoice_line" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "line_no" INTEGER NOT NULL,
    "product_id" TEXT NOT NULL,
    "description" TEXT,
    "account_id" TEXT NOT NULL,
    "analytic_account_id" TEXT,
    "quantity_milli" BIGINT NOT NULL,
    "unit_price_paise" BIGINT NOT NULL,
    "tax_id" TEXT,
    "subtotal_paise" BIGINT NOT NULL DEFAULT 0,
    "sales_order_line_id" TEXT,

    CONSTRAINT "customer_invoice_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "direction" "PaymentDirection" NOT NULL,
    "partner_id" TEXT NOT NULL,
    "payment_date" DATE NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'BANK',
    "journal_id" TEXT NOT NULL,
    "amount_paise" BIGINT NOT NULL,
    "allocated_paise" BIGINT NOT NULL DEFAULT 0,
    "note" TEXT,
    "state" "PaymentStatus" NOT NULL DEFAULT 'DRAFT',
    "journal_entry_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_allocation" (
    "id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "customer_invoice_id" TEXT,
    "vendor_bill_id" TEXT,
    "amount_paise" BIGINT NOT NULL,
    "allocated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" TEXT,

    CONSTRAINT "payment_allocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytic_account" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" VARCHAR(16),
    "type" "AnalyticType" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytic_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "responsible_id" TEXT,
    "state" "BudgetState" NOT NULL DEFAULT 'DRAFT',
    "revision_of_id" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_line" (
    "id" TEXT NOT NULL,
    "budget_id" TEXT NOT NULL,
    "analytic_account_id" TEXT NOT NULL,
    "type" "AnalyticType" NOT NULL,
    "committed_paise" BIGINT NOT NULL,

    CONSTRAINT "budget_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_move" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "direction" "StockDirection" NOT NULL,
    "quantity_milli" BIGINT NOT NULL,
    "unit_cost_paise" BIGINT NOT NULL,
    "source_type" "EntrySource" NOT NULL,
    "source_id" TEXT,
    "journal_entry_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_move_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT NOT NULL DEFAULT 'Urban Furniture',
    "currency" VARCHAR(3) NOT NULL DEFAULT 'INR',
    "fiscal_year_start_month" INTEGER NOT NULL DEFAULT 4,
    "lock_date" DATE,
    "retained_earnings_account_id" TEXT,
    "current_year_earnings_account_id" TEXT,
    "rounding_account_id" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_statement_line" (
    "id" TEXT NOT NULL,
    "statement_id" TEXT,
    "date" DATE NOT NULL,
    "narration" TEXT NOT NULL,
    "amount_paise" BIGINT NOT NULL,
    "matched_payment_id" TEXT,
    "confidence" INTEGER,
    "state" TEXT NOT NULL DEFAULT 'UNMATCHED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_statement_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "record_id" TEXT NOT NULL,
    "detail" TEXT,
    "user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_login_id_key" ON "user"("login_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "user_role_active_idx" ON "user"("role", "active");

-- CreateIndex
CREATE UNIQUE INDEX "contact_email_key" ON "contact"("email");

-- CreateIndex
CREATE INDEX "contact_type_active_idx" ON "contact"("type", "active");

-- CreateIndex
CREATE INDEX "contact_name_idx" ON "contact"("name");

-- CreateIndex
CREATE UNIQUE INDEX "product_category_name_key" ON "product_category"("name");

-- CreateIndex
CREATE INDEX "product_category_id_active_idx" ON "product"("category_id", "active");

-- CreateIndex
CREATE INDEX "product_name_idx" ON "product"("name");

-- CreateIndex
CREATE UNIQUE INDEX "account_code_key" ON "account"("code");

-- CreateIndex
CREATE INDEX "account_type_active_idx" ON "account"("type", "active");

-- CreateIndex
CREATE INDEX "account_subtype_idx" ON "account"("subtype");

-- CreateIndex
CREATE UNIQUE INDEX "journal_code_key" ON "journal"("code");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entry_reversal_of_id_key" ON "journal_entry"("reversal_of_id");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entry_chain_index_key" ON "journal_entry"("chain_index");

-- CreateIndex
CREATE INDEX "journal_entry_state_date_idx" ON "journal_entry"("state", "date");

-- CreateIndex
CREATE INDEX "journal_entry_source_type_source_id_idx" ON "journal_entry"("source_type", "source_id");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entry_journal_id_name_key" ON "journal_entry"("journal_id", "name");

-- CreateIndex
CREATE INDEX "journal_item_state_date_account_id_idx" ON "journal_item"("state", "date", "account_id");

-- CreateIndex
CREATE INDEX "journal_item_account_id_date_idx" ON "journal_item"("account_id", "date");

-- CreateIndex
CREATE INDEX "journal_item_partner_id_date_idx" ON "journal_item"("partner_id", "date");

-- CreateIndex
CREATE INDEX "journal_item_analytic_account_id_date_idx" ON "journal_item"("analytic_account_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "journal_item_entry_id_line_no_key" ON "journal_item"("entry_id", "line_no");

-- CreateIndex
CREATE UNIQUE INDEX "tax_name_key" ON "tax"("name");

-- CreateIndex
CREATE UNIQUE INDEX "sequence_code_fiscal_year_key" ON "sequence"("code", "fiscal_year");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_order_name_key" ON "purchase_order"("name");

-- CreateIndex
CREATE INDEX "purchase_order_state_order_date_idx" ON "purchase_order"("state", "order_date");

-- CreateIndex
CREATE INDEX "purchase_order_vendor_id_idx" ON "purchase_order"("vendor_id");

-- CreateIndex
CREATE INDEX "purchase_order_line_analytic_account_id_idx" ON "purchase_order_line"("analytic_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_order_line_order_id_line_no_key" ON "purchase_order_line"("order_id", "line_no");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_bill_name_key" ON "vendor_bill"("name");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_bill_journal_entry_id_key" ON "vendor_bill"("journal_entry_id");

-- CreateIndex
CREATE INDEX "vendor_bill_state_bill_date_idx" ON "vendor_bill"("state", "bill_date");

-- CreateIndex
CREATE INDEX "vendor_bill_vendor_id_due_date_idx" ON "vendor_bill"("vendor_id", "due_date");

-- CreateIndex
CREATE INDEX "vendor_bill_line_analytic_account_id_idx" ON "vendor_bill_line"("analytic_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_bill_line_bill_id_line_no_key" ON "vendor_bill_line"("bill_id", "line_no");

-- CreateIndex
CREATE UNIQUE INDEX "sales_order_name_key" ON "sales_order"("name");

-- CreateIndex
CREATE INDEX "sales_order_state_order_date_idx" ON "sales_order"("state", "order_date");

-- CreateIndex
CREATE INDEX "sales_order_customer_id_idx" ON "sales_order"("customer_id");

-- CreateIndex
CREATE INDEX "sales_order_line_analytic_account_id_idx" ON "sales_order_line"("analytic_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_order_line_order_id_line_no_key" ON "sales_order_line"("order_id", "line_no");

-- CreateIndex
CREATE UNIQUE INDEX "customer_invoice_name_key" ON "customer_invoice"("name");

-- CreateIndex
CREATE UNIQUE INDEX "customer_invoice_journal_entry_id_key" ON "customer_invoice"("journal_entry_id");

-- CreateIndex
CREATE INDEX "customer_invoice_state_invoice_date_idx" ON "customer_invoice"("state", "invoice_date");

-- CreateIndex
CREATE INDEX "customer_invoice_customer_id_due_date_idx" ON "customer_invoice"("customer_id", "due_date");

-- CreateIndex
CREATE INDEX "customer_invoice_line_analytic_account_id_idx" ON "customer_invoice_line"("analytic_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_invoice_line_invoice_id_line_no_key" ON "customer_invoice_line"("invoice_id", "line_no");

-- CreateIndex
CREATE UNIQUE INDEX "payment_name_key" ON "payment"("name");

-- CreateIndex
CREATE UNIQUE INDEX "payment_journal_entry_id_key" ON "payment"("journal_entry_id");

-- CreateIndex
CREATE INDEX "payment_state_payment_date_idx" ON "payment"("state", "payment_date");

-- CreateIndex
CREATE INDEX "payment_partner_id_state_idx" ON "payment"("partner_id", "state");

-- CreateIndex
CREATE INDEX "payment_allocation_customer_invoice_id_idx" ON "payment_allocation"("customer_invoice_id");

-- CreateIndex
CREATE INDEX "payment_allocation_vendor_bill_id_idx" ON "payment_allocation"("vendor_bill_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_allocation_payment_id_customer_invoice_id_key" ON "payment_allocation"("payment_id", "customer_invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_allocation_payment_id_vendor_bill_id_key" ON "payment_allocation"("payment_id", "vendor_bill_id");

-- CreateIndex
CREATE UNIQUE INDEX "analytic_account_name_key" ON "analytic_account"("name");

-- CreateIndex
CREATE INDEX "analytic_account_type_active_idx" ON "analytic_account"("type", "active");

-- CreateIndex
CREATE UNIQUE INDEX "budget_revision_of_id_key" ON "budget"("revision_of_id");

-- CreateIndex
CREATE INDEX "budget_state_start_date_end_date_idx" ON "budget"("state", "start_date", "end_date");

-- CreateIndex
CREATE INDEX "budget_line_analytic_account_id_idx" ON "budget_line"("analytic_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "budget_line_budget_id_analytic_account_id_key" ON "budget_line"("budget_id", "analytic_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_move_journal_entry_id_key" ON "stock_move"("journal_entry_id");

-- CreateIndex
CREATE INDEX "stock_move_product_id_date_idx" ON "stock_move"("product_id", "date");

-- CreateIndex
CREATE INDEX "stock_move_date_idx" ON "stock_move"("date");

-- CreateIndex
CREATE INDEX "bank_statement_line_state_date_idx" ON "bank_statement_line"("state", "date");

-- CreateIndex
CREATE INDEX "audit_log_model_record_id_idx" ON "audit_log"("model", "record_id");

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact" ADD CONSTRAINT "contact_receivable_account_id_fkey" FOREIGN KEY ("receivable_account_id") REFERENCES "account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact" ADD CONSTRAINT "contact_payable_account_id_fkey" FOREIGN KEY ("payable_account_id") REFERENCES "account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_category" ADD CONSTRAINT "product_category_income_account_id_fkey" FOREIGN KEY ("income_account_id") REFERENCES "account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_category" ADD CONSTRAINT "product_category_expense_account_id_fkey" FOREIGN KEY ("expense_account_id") REFERENCES "account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product" ADD CONSTRAINT "product_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "product_category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product" ADD CONSTRAINT "product_income_account_id_fkey" FOREIGN KEY ("income_account_id") REFERENCES "account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product" ADD CONSTRAINT "product_expense_account_id_fkey" FOREIGN KEY ("expense_account_id") REFERENCES "account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product" ADD CONSTRAINT "product_sales_tax_id_fkey" FOREIGN KEY ("sales_tax_id") REFERENCES "tax"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product" ADD CONSTRAINT "product_purchase_tax_id_fkey" FOREIGN KEY ("purchase_tax_id") REFERENCES "tax"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal" ADD CONSTRAINT "journal_default_account_id_fkey" FOREIGN KEY ("default_account_id") REFERENCES "account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal" ADD CONSTRAINT "journal_default_debit_account_id_fkey" FOREIGN KEY ("default_debit_account_id") REFERENCES "account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal" ADD CONSTRAINT "journal_default_credit_account_id_fkey" FOREIGN KEY ("default_credit_account_id") REFERENCES "account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entry" ADD CONSTRAINT "journal_entry_journal_id_fkey" FOREIGN KEY ("journal_id") REFERENCES "journal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entry" ADD CONSTRAINT "journal_entry_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entry" ADD CONSTRAINT "journal_entry_reversal_of_id_fkey" FOREIGN KEY ("reversal_of_id") REFERENCES "journal_entry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entry" ADD CONSTRAINT "journal_entry_posted_by_id_fkey" FOREIGN KEY ("posted_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_item" ADD CONSTRAINT "journal_item_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "journal_entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_item" ADD CONSTRAINT "journal_item_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_item" ADD CONSTRAINT "journal_item_journal_id_fkey" FOREIGN KEY ("journal_id") REFERENCES "journal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_item" ADD CONSTRAINT "journal_item_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_item" ADD CONSTRAINT "journal_item_analytic_account_id_fkey" FOREIGN KEY ("analytic_account_id") REFERENCES "analytic_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_item" ADD CONSTRAINT "journal_item_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_item" ADD CONSTRAINT "journal_item_tax_id_fkey" FOREIGN KEY ("tax_id") REFERENCES "tax"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax" ADD CONSTRAINT "tax_collected_account_id_fkey" FOREIGN KEY ("collected_account_id") REFERENCES "account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax" ADD CONSTRAINT "tax_paid_account_id_fkey" FOREIGN KEY ("paid_account_id") REFERENCES "account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_line" ADD CONSTRAINT "purchase_order_line_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "purchase_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_line" ADD CONSTRAINT "purchase_order_line_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_line" ADD CONSTRAINT "purchase_order_line_analytic_account_id_fkey" FOREIGN KEY ("analytic_account_id") REFERENCES "analytic_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_line" ADD CONSTRAINT "purchase_order_line_tax_id_fkey" FOREIGN KEY ("tax_id") REFERENCES "tax"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_bill" ADD CONSTRAINT "vendor_bill_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_bill" ADD CONSTRAINT "vendor_bill_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_bill_line" ADD CONSTRAINT "vendor_bill_line_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "vendor_bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_bill_line" ADD CONSTRAINT "vendor_bill_line_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_bill_line" ADD CONSTRAINT "vendor_bill_line_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_bill_line" ADD CONSTRAINT "vendor_bill_line_analytic_account_id_fkey" FOREIGN KEY ("analytic_account_id") REFERENCES "analytic_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_bill_line" ADD CONSTRAINT "vendor_bill_line_tax_id_fkey" FOREIGN KEY ("tax_id") REFERENCES "tax"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_bill_line" ADD CONSTRAINT "vendor_bill_line_purchase_order_line_id_fkey" FOREIGN KEY ("purchase_order_line_id") REFERENCES "purchase_order_line"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order" ADD CONSTRAINT "sales_order_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_line" ADD CONSTRAINT "sales_order_line_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "sales_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_line" ADD CONSTRAINT "sales_order_line_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_line" ADD CONSTRAINT "sales_order_line_analytic_account_id_fkey" FOREIGN KEY ("analytic_account_id") REFERENCES "analytic_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_line" ADD CONSTRAINT "sales_order_line_tax_id_fkey" FOREIGN KEY ("tax_id") REFERENCES "tax"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_invoice" ADD CONSTRAINT "customer_invoice_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_invoice" ADD CONSTRAINT "customer_invoice_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_invoice_line" ADD CONSTRAINT "customer_invoice_line_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "customer_invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_invoice_line" ADD CONSTRAINT "customer_invoice_line_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_invoice_line" ADD CONSTRAINT "customer_invoice_line_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_invoice_line" ADD CONSTRAINT "customer_invoice_line_analytic_account_id_fkey" FOREIGN KEY ("analytic_account_id") REFERENCES "analytic_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_invoice_line" ADD CONSTRAINT "customer_invoice_line_tax_id_fkey" FOREIGN KEY ("tax_id") REFERENCES "tax"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_invoice_line" ADD CONSTRAINT "customer_invoice_line_sales_order_line_id_fkey" FOREIGN KEY ("sales_order_line_id") REFERENCES "sales_order_line"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_journal_id_fkey" FOREIGN KEY ("journal_id") REFERENCES "journal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocation" ADD CONSTRAINT "payment_allocation_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocation" ADD CONSTRAINT "payment_allocation_customer_invoice_id_fkey" FOREIGN KEY ("customer_invoice_id") REFERENCES "customer_invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocation" ADD CONSTRAINT "payment_allocation_vendor_bill_id_fkey" FOREIGN KEY ("vendor_bill_id") REFERENCES "vendor_bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocation" ADD CONSTRAINT "payment_allocation_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget" ADD CONSTRAINT "budget_responsible_id_fkey" FOREIGN KEY ("responsible_id") REFERENCES "contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget" ADD CONSTRAINT "budget_revision_of_id_fkey" FOREIGN KEY ("revision_of_id") REFERENCES "budget"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_line" ADD CONSTRAINT "budget_line_budget_id_fkey" FOREIGN KEY ("budget_id") REFERENCES "budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_line" ADD CONSTRAINT "budget_line_analytic_account_id_fkey" FOREIGN KEY ("analytic_account_id") REFERENCES "analytic_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_move" ADD CONSTRAINT "stock_move_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
