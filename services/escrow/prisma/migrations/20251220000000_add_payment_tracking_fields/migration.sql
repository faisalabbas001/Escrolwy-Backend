-- AlterTable
ALTER TABLE "escrow_db"."escrows" ADD COLUMN "buyerPaid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "sellerPaid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "buyerPaidAmount" DECIMAL(18,6),
ADD COLUMN "sellerPaidAmount" DECIMAL(18,6);

