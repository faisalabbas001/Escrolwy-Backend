-- CreateTable
CREATE TABLE "escrow_fee_splits" (
    "id" TEXT NOT NULL,
    "escrowId" TEXT NOT NULL,
    "feeAmount" DECIMAL(18,6) NOT NULL,
    "buyerPays" DECIMAL(18,6) NOT NULL,
    "sellerPays" DECIMAL(18,6) NOT NULL,
    "brokerPays" DECIMAL(18,6),
    "buyerPercent" DECIMAL(5,2),
    "sellerPercent" DECIMAL(5,2),
    "brokerPercent" DECIMAL(5,2),
    "paidBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "escrow_fee_splits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "escrow_fee_splits_escrowId_key" ON "escrow_fee_splits"("escrowId");

-- CreateIndex
CREATE INDEX "escrow_fee_splits_escrowId_idx" ON "escrow_fee_splits"("escrowId");

-- AddForeignKey
ALTER TABLE "escrow_fee_splits" ADD CONSTRAINT "escrow_fee_splits_escrowId_fkey" FOREIGN KEY ("escrowId") REFERENCES "escrows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
