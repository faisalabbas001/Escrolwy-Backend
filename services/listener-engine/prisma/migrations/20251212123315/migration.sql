-- CreateTable
CREATE TABLE "listener_state" (
    "id" UUID NOT NULL,
    "chain" VARCHAR(10) NOT NULL,
    "listener_type" VARCHAR(20) NOT NULL DEFAULT 'deposit',
    "last_processed_block" BIGINT NOT NULL DEFAULT 0,
    "confirmations" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listener_state_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_listener_state_chain" ON "listener_state"("chain");

-- CreateIndex
CREATE UNIQUE INDEX "listener_state_chain_listener_type_key" ON "listener_state"("chain", "listener_type");
