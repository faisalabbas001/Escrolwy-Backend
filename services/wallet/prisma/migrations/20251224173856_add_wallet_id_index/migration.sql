-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_deposit_tx_wallet_id" ON "wallet_db"."deposit_transactions"("wallet_id");
