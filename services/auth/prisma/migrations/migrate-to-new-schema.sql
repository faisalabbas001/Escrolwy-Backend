-- Migration: Move fields from users table to user_profiles table
-- This aligns the database with the new Prisma schema design

BEGIN;

-- Step 1: Add new columns to user_profiles if they don't exist
ALTER TABLE auth_db.user_profiles 
ADD COLUMN IF NOT EXISTS kyc_status TEXT NOT NULL DEFAULT 'not_started',
ADD COLUMN IF NOT EXISTS kyc_level TEXT,
ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Step 2: Add CHECK constraint for kyc_status on user_profiles
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'chk_user_profiles_kyc_status'
    ) THEN
        ALTER TABLE auth_db.user_profiles 
        ADD CONSTRAINT chk_user_profiles_kyc_status 
        CHECK (kyc_status = ANY (ARRAY['not_started'::text, 'pending'::text, 'approved'::text, 'rejected'::text]));
    END IF;
END $$;

-- Step 3: Migrate existing data from users to user_profiles
UPDATE auth_db.user_profiles up
SET 
    kyc_status = COALESCE(u.kyc_status, 'not_started'),
    kyc_level = u.kyc_level,
    display_name = u.display_name,
    company_name = COALESCE(up.company_name, u.company_name),
    company_representative_name = COALESCE(up.company_representative_name, u.company_representative_name),
    company_billing_address = COALESCE(up.company_billing_address, u.company_billing_address),
    preferred_language = COALESCE(up.preferred_language, u.preferred_language, 'en')
FROM auth_db.users u
WHERE up.user_id = u.id;

-- Step 4: Drop columns from users table that are now in user_profiles
ALTER TABLE auth_db.users 
DROP COLUMN IF EXISTS kyc_status,
DROP COLUMN IF EXISTS kyc_level,
DROP COLUMN IF EXISTS compliance_case_id,
DROP COLUMN IF EXISTS display_name,
DROP COLUMN IF EXISTS company_name,
DROP COLUMN IF EXISTS company_representative_name,
DROP COLUMN IF EXISTS company_billing_address,
DROP COLUMN IF EXISTS preferred_language,
DROP COLUMN IF EXISTS accept_terms_at,
DROP COLUMN IF EXISTS last_login_at,
DROP COLUMN IF EXISTS status,
DROP COLUMN IF EXISTS wallet_ready;

-- Step 5: Drop old constraints and indexes that referenced dropped columns
DROP INDEX IF EXISTS auth_db.idx_users_status;

COMMIT;
