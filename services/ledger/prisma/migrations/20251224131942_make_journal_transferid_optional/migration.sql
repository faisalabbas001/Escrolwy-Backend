-- AlterTable: Make transferId nullable in journals table
ALTER TABLE "ledger_db"."journals" ALTER COLUMN "transferId" DROP NOT NULL;