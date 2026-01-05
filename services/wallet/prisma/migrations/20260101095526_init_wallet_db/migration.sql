-- CreateTable
CREATE TABLE "platform_keys" (
    "id" UUID NOT NULL,
    "chain" VARCHAR(10) NOT NULL,
    "wallet_type" VARCHAR(20) NOT NULL,
    "public_address" TEXT NOT NULL,
    "encrypted_private_key" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_platform_keys_chain" ON "platform_keys"("chain");

-- CreateIndex
CREATE UNIQUE INDEX "platform_keys_chain_wallet_type_key" ON "platform_keys"("chain", "wallet_type");
