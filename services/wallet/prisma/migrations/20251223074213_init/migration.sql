-- CreateTable
CREATE TABLE "user_wallets" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "chain" VARCHAR(10) NOT NULL,
    "deposit_address" TEXT NOT NULL,
    "encrypted_private_key" TEXT NOT NULL,
    "public_key" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deposit_transactions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "wallet_id" UUID NOT NULL,
    "chain" VARCHAR(10) NOT NULL,
    "asset" VARCHAR(10) NOT NULL,
    "amount" DECIMAL(36,18) NOT NULL,
    "tx_hash" TEXT NOT NULL,
    "block_number" BIGINT NOT NULL,
    "deposit_address" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "detected_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deposit_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payout_requests" (
    "id" UUID NOT NULL,
    "event_id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "chain" VARCHAR(10) NOT NULL,
    "asset" VARCHAR(10) NOT NULL,
    "amount" DECIMAL(36,18) NOT NULL,
    "destination_address" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "tx_hash" TEXT,
    "block_number" BIGINT,
    "gas_used" DECIMAL(36,18),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payout_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payout_attempts" (
    "id" UUID NOT NULL,
    "payout_request_id" UUID NOT NULL,
    "attempt_number" INTEGER NOT NULL,
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payout_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processed_events" (
    "id" UUID NOT NULL,
    "event_id" TEXT NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "topic" TEXT NOT NULL,
    "partition_key" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "next_retry_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMPTZ,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_user_wallets_deposit_address" ON "user_wallets"("deposit_address");

-- CreateIndex
CREATE INDEX "idx_user_wallets_user_id" ON "user_wallets"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_wallets_chain_deposit_address_key" ON "user_wallets"("chain", "deposit_address");

-- CreateIndex
CREATE INDEX "idx_deposit_tx_deposit_address" ON "deposit_transactions"("deposit_address");

-- CreateIndex
CREATE INDEX "idx_deposit_tx_user_id" ON "deposit_transactions"("user_id");

-- CreateIndex
CREATE INDEX "idx_deposit_tx_status" ON "deposit_transactions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "deposit_transactions_chain_tx_hash_key" ON "deposit_transactions"("chain", "tx_hash");

-- CreateIndex
CREATE UNIQUE INDEX "payout_requests_event_id_key" ON "payout_requests"("event_id");

-- CreateIndex
CREATE INDEX "idx_payout_requests_user_id" ON "payout_requests"("user_id");

-- CreateIndex
CREATE INDEX "idx_payout_requests_status" ON "payout_requests"("status");

-- CreateIndex
CREATE INDEX "idx_payout_attempts_request_id" ON "payout_attempts"("payout_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "processed_events_event_id_key" ON "processed_events"("event_id");

-- CreateIndex
CREATE INDEX "idx_processed_events_event_id" ON "processed_events"("event_id");

-- CreateIndex
CREATE INDEX "idx_outbox_events_status" ON "outbox_events"("status");

-- CreateIndex
CREATE INDEX "idx_outbox_events_created_at" ON "outbox_events"("created_at");

-- CreateIndex
CREATE INDEX "idx_outbox_events_next_retry_at" ON "outbox_events"("next_retry_at");
