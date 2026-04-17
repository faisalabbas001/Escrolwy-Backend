-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "ownerType" TEXT NOT NULL,
    "ownerId" TEXT,
    "purpose" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfers" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "amount" DECIMAL(18,6) NOT NULL,
    "chain" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "destinationUserId" TEXT,
    "destinationAddress" TEXT,
    "destinationChain" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "failureReason" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journals" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "transferId" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entries" (
    "id" TEXT NOT NULL,
    "journalId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "amount" DECIMAL(18,6) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_outbox" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "nextRetryAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ledger_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "accounts_ownerType_ownerId_idx" ON "accounts"("ownerType", "ownerId");

-- CreateIndex
CREATE INDEX "accounts_asset_chain_idx" ON "accounts"("asset", "chain");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_ownerType_ownerId_asset_chain_purpose_key" ON "accounts"("ownerType", "ownerId", "asset", "chain", "purpose");

-- CreateIndex
CREATE UNIQUE INDEX "transfers_idempotencyKey_key" ON "transfers"("idempotencyKey");

-- CreateIndex
CREATE INDEX "transfers_senderId_idx" ON "transfers"("senderId");

-- CreateIndex
CREATE INDEX "transfers_status_idx" ON "transfers"("status");

-- CreateIndex
CREATE INDEX "transfers_idempotencyKey_idx" ON "transfers"("idempotencyKey");

-- CreateIndex
CREATE INDEX "transfers_createdAt_idx" ON "transfers"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "journals_idempotencyKey_key" ON "journals"("idempotencyKey");

-- CreateIndex
CREATE INDEX "journals_transferId_idx" ON "journals"("transferId");

-- CreateIndex
CREATE INDEX "journals_userId_idx" ON "journals"("userId");

-- CreateIndex
CREATE INDEX "journals_idempotencyKey_idx" ON "journals"("idempotencyKey");

-- CreateIndex
CREATE INDEX "journals_createdAt_idx" ON "journals"("createdAt");

-- CreateIndex
CREATE INDEX "entries_journalId_idx" ON "entries"("journalId");

-- CreateIndex
CREATE INDEX "entries_accountId_idx" ON "entries"("accountId");

-- CreateIndex
CREATE INDEX "entries_createdAt_idx" ON "entries"("createdAt");

-- CreateIndex
CREATE INDEX "ledger_outbox_status_idx" ON "ledger_outbox"("status");

-- CreateIndex
CREATE INDEX "ledger_outbox_eventType_idx" ON "ledger_outbox"("eventType");

-- CreateIndex
CREATE INDEX "ledger_outbox_createdAt_idx" ON "ledger_outbox"("createdAt");

-- CreateIndex
CREATE INDEX "ledger_outbox_nextRetryAt_idx" ON "ledger_outbox"("nextRetryAt");

-- AddForeignKey
ALTER TABLE "journals" ADD CONSTRAINT "journals_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "transfers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entries" ADD CONSTRAINT "entries_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "journals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entries" ADD CONSTRAINT "entries_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
