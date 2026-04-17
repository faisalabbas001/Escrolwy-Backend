-- Create two_factor_backup_codes table
CREATE TABLE "auth_db"."two_factor_backup_codes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "code_hash" TEXT NOT NULL,
    "used_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "two_factor_backup_codes_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX "idx_backup_codes_user" ON "auth_db"."two_factor_backup_codes"("user_id");
CREATE INDEX "idx_backup_codes_used_at" ON "auth_db"."two_factor_backup_codes"("used_at");

-- Add foreign key constraint
ALTER TABLE "auth_db"."two_factor_backup_codes" 
    ADD CONSTRAINT "two_factor_backup_codes_user_id_fkey" 
    FOREIGN KEY ("user_id") 
    REFERENCES "auth_db"."auth_credentials"("user_id") 
    ON DELETE RESTRICT 
    ON UPDATE CASCADE;
