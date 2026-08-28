-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'TRANSFER';

-- AlterTable
ALTER TABLE "daily_summaries" ADD COLUMN     "paymentTransferSatang" INTEGER NOT NULL DEFAULT 0;
