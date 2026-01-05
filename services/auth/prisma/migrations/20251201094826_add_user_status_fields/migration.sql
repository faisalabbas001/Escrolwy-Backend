-- AlterTable
ALTER TABLE "auth_db"."users" ADD COLUMN     "accept_terms_at" TIMESTAMPTZ,
ADD COLUMN     "last_login_at" TIMESTAMPTZ,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'active',
ADD COLUMN     "wallet_ready" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "idx_users_status" ON "auth_db"."users"("status");

-- RenameForeignKey
ALTER TABLE "auth_db"."auth_credentials" RENAME CONSTRAINT "au0th_credentials_user_id_fkey" TO "auth_credentials_user_id_fkey";

-- CHECK Constraint for status
ALTER TABLE "auth_db"."users"
  ADD CONSTRAINT "chk_users_status"
  CHECK (status IN ('active', 'locked', 'disabled'));
