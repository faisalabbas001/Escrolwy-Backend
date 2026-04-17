-- CreateTable
CREATE TABLE "Escrow" (
    "id" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "brokerId" TEXT,
    "amount" DECIMAL(18,6) NOT NULL,
    "asset" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "platformFee" DECIMAL(18,6) NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'agreement',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "disputedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "disputedBy" TEXT,

    CONSTRAINT "Escrow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscrowTransition" (
    "id" TEXT NOT NULL,
    "escrowId" TEXT NOT NULL,
    "previousState" TEXT NOT NULL,
    "newState" TEXT NOT NULL,
    "changedBy" TEXT NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EscrowTransition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscrowFees" (
    "id" TEXT NOT NULL,
    "escrowId" TEXT NOT NULL,
    "feeAmount" DECIMAL(18,6) NOT NULL,
    "feePercentage" DECIMAL(5,2),
    "paidBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EscrowFees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscrowReminder" (
    "id" TEXT NOT NULL,
    "escrowId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EscrowReminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscrowOutbox" (
    "id" TEXT NOT NULL,
    "escrowId" TEXT,
    "eventType" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EscrowOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Escrow_buyerId_idx" ON "Escrow"("buyerId");

-- CreateIndex
CREATE INDEX "Escrow_sellerId_idx" ON "Escrow"("sellerId");

-- CreateIndex
CREATE INDEX "Escrow_state_idx" ON "Escrow"("state");

-- CreateIndex
CREATE INDEX "Escrow_createdAt_idx" ON "Escrow"("createdAt");

-- CreateIndex
CREATE INDEX "EscrowTransition_escrowId_idx" ON "EscrowTransition"("escrowId");

-- CreateIndex
CREATE INDEX "EscrowTransition_createdAt_idx" ON "EscrowTransition"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EscrowFees_escrowId_key" ON "EscrowFees"("escrowId");

-- CreateIndex
CREATE INDEX "EscrowFees_escrowId_idx" ON "EscrowFees"("escrowId");

-- CreateIndex
CREATE INDEX "EscrowReminder_escrowId_idx" ON "EscrowReminder"("escrowId");

-- CreateIndex
CREATE INDEX "EscrowReminder_scheduledAt_idx" ON "EscrowReminder"("scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "EscrowOutbox_eventKey_key" ON "EscrowOutbox"("eventKey");

-- CreateIndex
CREATE INDEX "EscrowOutbox_escrowId_idx" ON "EscrowOutbox"("escrowId");

-- CreateIndex
CREATE INDEX "EscrowOutbox_eventType_idx" ON "EscrowOutbox"("eventType");

-- CreateIndex
CREATE INDEX "EscrowOutbox_status_idx" ON "EscrowOutbox"("status");

-- CreateIndex
CREATE INDEX "EscrowOutbox_createdAt_idx" ON "EscrowOutbox"("createdAt");

-- AddForeignKey
ALTER TABLE "EscrowTransition" ADD CONSTRAINT "EscrowTransition_escrowId_fkey" FOREIGN KEY ("escrowId") REFERENCES "Escrow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscrowFees" ADD CONSTRAINT "EscrowFees_escrowId_fkey" FOREIGN KEY ("escrowId") REFERENCES "Escrow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscrowReminder" ADD CONSTRAINT "EscrowReminder_escrowId_fkey" FOREIGN KEY ("escrowId") REFERENCES "Escrow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscrowOutbox" ADD CONSTRAINT "EscrowOutbox_escrowId_fkey" FOREIGN KEY ("escrowId") REFERENCES "Escrow"("id") ON DELETE SET NULL ON UPDATE CASCADE;
