/*
  Warnings:

  - You are about to drop the column `accept_terms_at` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `company_billing_address` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `company_name` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `company_representative_name` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `compliance_case_id` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `display_name` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `kyc_level` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `kyc_status` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `last_login_at` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `preferred_language` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `wallet_ready` on the `users` table. All the data in the column will be lost.
  - Added the required column `kyc_status` to the `user_profiles` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "idx_users_status";

-- AlterTable
ALTER TABLE "user_profiles" ADD COLUMN     "compliance_case_id" TEXT,
ADD COLUMN     "display_name" TEXT,
ADD COLUMN     "kyc_level" TEXT,
ADD COLUMN     "kyc_status" TEXT NOT NULL,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'active',
ADD COLUMN     "wallet_ready" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "accept_terms_at",
DROP COLUMN "company_billing_address",
DROP COLUMN "company_name",
DROP COLUMN "company_representative_name",
DROP COLUMN "compliance_case_id",
DROP COLUMN "display_name",
DROP COLUMN "kyc_level",
DROP COLUMN "kyc_status",
DROP COLUMN "last_login_at",
DROP COLUMN "preferred_language",
DROP COLUMN "status",
DROP COLUMN "wallet_ready";

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "used_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "partition_key" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "next_retry_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMPTZ,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_key" ON "password_reset_tokens"("token");

-- CreateIndex
CREATE INDEX "idx_password_reset_tokens_user" ON "password_reset_tokens"("user_id");

-- CreateIndex
CREATE INDEX "idx_password_reset_tokens_token" ON "password_reset_tokens"("token");

-- CreateIndex
CREATE INDEX "idx_password_reset_tokens_expires" ON "password_reset_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "idx_outbox_status" ON "outbox_events"("status");

-- CreateIndex
CREATE INDEX "idx_outbox_created_at" ON "outbox_events"("created_at");

-- CreateIndex
CREATE INDEX "idx_outbox_next_retry_at" ON "outbox_events"("next_retry_at");

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth_credentials"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
