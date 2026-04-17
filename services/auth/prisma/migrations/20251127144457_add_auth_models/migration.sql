-- CreateTable
CREATE TABLE "auth_db"."users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "role" TEXT NOT NULL,
    "kyc_status" TEXT NOT NULL,
    "kyc_level" TEXT,
    "compliance_case_id" TEXT,
    "display_name" TEXT,
    "company_name" TEXT,
    "company_representative_name" TEXT,
    "company_billing_address" TEXT,
    "preferred_language" TEXT NOT NULL DEFAULT 'en',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_db"."auth_credentials" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "password_hash" TEXT,
    "password_algo" TEXT,
    "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "mfa_type" TEXT,
    "mfa_secret_encrypted" TEXT,
    "oauth_provider" TEXT,
    "oauth_subject" TEXT,
    "last_password_rotated_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "auth_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_db"."user_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "company_name" TEXT,
    "company_representative_name" TEXT,
    "company_billing_address" TEXT,
    "primary_phone" TEXT,
    "preferred_language" TEXT NOT NULL DEFAULT 'en',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_db"."kyc_status" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "level" TEXT,
    "reference_id" TEXT,
    "updated_by_admin_id" UUID,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "kyc_status_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "auth_db"."users"("email");

-- CreateIndex
CREATE INDEX "idx_users_email" ON "auth_db"."users"("email");

-- CreateIndex
CREATE INDEX "idx_users_role" ON "auth_db"."users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "auth_credentials_user_id_key" ON "auth_db"."auth_credentials"("user_id");

-- CreateIndex
CREATE INDEX "idx_auth_credentials_user" ON "auth_db"."auth_credentials"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_user_id_key" ON "auth_db"."user_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "kyc_status_user_id_key" ON "auth_db"."kyc_status"("user_id");

-- CreateIndex
CREATE INDEX "idx_kyc_status_user" ON "auth_db"."kyc_status"("user_id");

-- AddForeignKey
ALTER TABLE "auth_db"."auth_credentials" ADD CONSTRAINT "au0th_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth_db"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_db"."user_profiles" ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth_db"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_db"."kyc_status" ADD CONSTRAINT "kyc_status_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth_db"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ====================================
-- CHECK CONSTRAINTS
-- ====================================

-- Role constraint for users table
ALTER TABLE "auth_db"."users"
  ADD CONSTRAINT "chk_users_role"
  CHECK (role IN ('user', 'super-admin', 'staff-website'));

-- KYC Status constraint for users table
ALTER TABLE "auth_db"."users"
  ADD CONSTRAINT "chk_users_kyc_status"
  CHECK (kyc_status IN ('not_started', 'pending', 'approved', 'rejected'));

-- KYC Status constraint for kyc_status table
ALTER TABLE "auth_db"."kyc_status"
  ADD CONSTRAINT "chk_kyc_status_status"
  CHECK (status IN ('not_started', 'pending', 'approved', 'rejected'));

-- ====================================
-- UPDATED_AT TRIGGERS
-- ====================================

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION "auth_db"."update_updated_at_column"()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to users table
CREATE TRIGGER "update_users_updated_at"
  BEFORE UPDATE ON "auth_db"."users"
  FOR EACH ROW
  EXECUTE FUNCTION "auth_db"."update_updated_at_column"();

-- Apply trigger to auth_credentials table
CREATE TRIGGER "update_auth_credentials_updated_at"
  BEFORE UPDATE ON "auth_db"."auth_credentials"
  FOR EACH ROW
  EXECUTE FUNCTION "auth_db"."update_updated_at_column"();

-- Apply trigger to user_profiles table
CREATE TRIGGER "update_user_profiles_updated_at"
  BEFORE UPDATE ON "auth_db"."user_profiles"
  FOR EACH ROW
  EXECUTE FUNCTION "auth_db"."update_updated_at_column"();

-- Apply trigger to kyc_status table
CREATE TRIGGER "update_kyc_status_updated_at"
  BEFORE UPDATE ON "auth_db"."kyc_status"
  FOR EACH ROW
  EXECUTE FUNCTION "auth_db"."update_updated_at_column"();
