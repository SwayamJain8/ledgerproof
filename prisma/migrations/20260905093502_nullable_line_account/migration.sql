-- DropForeignKey
ALTER TABLE "customer_invoice_line" DROP CONSTRAINT "customer_invoice_line_account_id_fkey";

-- DropForeignKey
ALTER TABLE "vendor_bill_line" DROP CONSTRAINT "vendor_bill_line_account_id_fkey";

-- AlterTable
ALTER TABLE "customer_invoice_line" ALTER COLUMN "account_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "vendor_bill_line" ALTER COLUMN "account_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "vendor_bill_line" ADD CONSTRAINT "vendor_bill_line_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_invoice_line" ADD CONSTRAINT "customer_invoice_line_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
