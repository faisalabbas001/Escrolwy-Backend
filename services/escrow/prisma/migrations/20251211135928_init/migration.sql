/*
  Warnings:

  - You are about to drop the `Escrow` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `EscrowFees` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `EscrowOutbox` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `EscrowReminder` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `EscrowTransition` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "EscrowFees" DROP CONSTRAINT "EscrowFees_escrowId_fkey";

-- DropForeignKey
ALTER TABLE "EscrowOutbox" DROP CONSTRAINT "EscrowOutbox_escrowId_fkey";

-- DropForeignKey
ALTER TABLE "EscrowReminder" DROP CONSTRAINT "EscrowReminder_escrowId_fkey";

-- DropForeignKey
ALTER TABLE "EscrowTransition" DROP CONSTRAINT "EscrowTransition_escrowId_fkey";

-- DropTable
DROP TABLE "Escrow";

-- DropTable
DROP TABLE "EscrowFees";

-- DropTable
DROP TABLE "EscrowOutbox";

-- DropTable
DROP TABLE "EscrowReminder";

-- DropTable
DROP TABLE "EscrowTransition";

-- CreateTable
CREATE TABLE "escrows" (
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

    CONSTRAINT "escrows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escrow_transitions" (
    "id" TEXT NOT NULL,
    "escrowId" TEXT NOT NULL,
    "previousState" TEXT NOT NULL,
    "newState" TEXT NOT NULL,
    "changedBy" TEXT NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "escrow_transitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escrow_fees" (
    "id" TEXT NOT NULL,
    "escrowId" TEXT NOT NULL,
    "feeAmount" DECIMAL(18,6) NOT NULL,
    "feePercentage" DECIMAL(5,2),
    "paidBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "escrow_fees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escrow_reminders" (
    "id" TEXT NOT NULL,
    "escrowId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "escrow_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escrow_outbox" (
    "id" TEXT NOT NULL,
    "escrowId" TEXT,
    "eventType" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "escrow_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "escrows_buyerId_idx" ON "escrows"("buyerId");

-- CreateIndex
CREATE INDEX "escrows_sellerId_idx" ON "escrows"("sellerId");

-- CreateIndex
CREATE INDEX "escrows_state_idx" ON "escrows"("state");

-- CreateIndex
CREATE INDEX "escrows_createdAt_idx" ON "escrows"("createdAt");

-- CreateIndex
CREATE INDEX "escrow_transitions_escrowId_idx" ON "escrow_transitions"("escrowId");

-- CreateIndex
CREATE INDEX "escrow_transitions_createdAt_idx" ON "escrow_transitions"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "escrow_fees_escrowId_key" ON "escrow_fees"("escrowId");

-- CreateIndex
CREATE INDEX "escrow_fees_escrowId_idx" ON "escrow_fees"("escrowId");

-- CreateIndex
CREATE INDEX "escrow_reminders_escrowId_idx" ON "escrow_reminders"("escrowId");

-- CreateIndex
CREATE INDEX "escrow_reminders_scheduledAt_idx" ON "escrow_reminders"("scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "escrow_outbox_eventKey_key" ON "escrow_outbox"("eventKey");

-- CreateIndex
CREATE INDEX "escrow_outbox_escrowId_idx" ON "escrow_outbox"("escrowId");

-- CreateIndex
CREATE INDEX "escrow_outbox_eventType_idx" ON "escrow_outbox"("eventType");

-- CreateIndex
CREATE INDEX "escrow_outbox_status_idx" ON "escrow_outbox"("status");

-- CreateIndex
CREATE INDEX "escrow_outbox_createdAt_idx" ON "escrow_outbox"("createdAt");

-- AddForeignKey
ALTER TABLE "escrow_transitions" ADD CONSTRAINT "escrow_transitions_escrowId_fkey" FOREIGN KEY ("escrowId") REFERENCES "escrows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escrow_fees" ADD CONSTRAINT "escrow_fees_escrowId_fkey" FOREIGN KEY ("escrowId") REFERENCES "escrows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escrow_reminders" ADD CONSTRAINT "escrow_reminders_escrowId_fkey" FOREIGN KEY ("escrowId") REFERENCES "escrows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escrow_outbox" ADD CONSTRAINT "escrow_outbox_escrowId_fkey" FOREIGN KEY ("escrowId") REFERENCES "escrows"("id") ON DELETE SET NULL ON UPDATE CASCADE;
