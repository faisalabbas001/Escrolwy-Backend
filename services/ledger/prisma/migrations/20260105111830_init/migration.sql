-- CreateTable
CREATE TABLE "reservations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DECIMAL(18,6) NOT NULL,
    "asset" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'reserved',
    "transferId" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reservations_transferId_key" ON "reservations"("transferId");

-- CreateIndex
CREATE UNIQUE INDEX "reservations_idempotencyKey_key" ON "reservations"("idempotencyKey");

-- CreateIndex
CREATE INDEX "reservations_userId_idx" ON "reservations"("userId");

-- CreateIndex
CREATE INDEX "reservations_status_idx" ON "reservations"("status");

-- CreateIndex
CREATE INDEX "reservations_reference_idx" ON "reservations"("reference");

-- CreateIndex
CREATE INDEX "reservations_transferId_idx" ON "reservations"("transferId");

-- CreateIndex
CREATE INDEX "reservations_idempotencyKey_idx" ON "reservations"("idempotencyKey");
