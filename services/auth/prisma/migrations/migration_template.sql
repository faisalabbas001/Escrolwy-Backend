-- ====================================
-- Auth Service Migration Template
-- ====================================
-- This template includes:
-- 1. CHECK constraints for role and kyc_status
-- 2. Foreign key constraints with specific names
-- 3. Updated_at triggers for all tables
-- 
-- Usage: Copy this content into your Prisma migration SQL file
-- after running: npm run prisma:migrate:dev --name add_auth_models
-- ====================================

-- ====================================
-- 1. CHECK CONSTRAINTS
-- ====================================

-- Role constraint for users table
ALTER TABLE auth_db.users
  ADD CONSTRAINT chk_users_role
  CHECK (role IN ('user', 'super-admin', 'staff-website'));

-- KYC Status constraint for users table
ALTER TABLE auth_db.users
  ADD CONSTRAINT chk_users_kyc_status
  CHECK (kyc_status IN ('not_started', 'pending', 'approved', 'rejected'));

-- KYC Status constraint for kyc_status table
ALTER TABLE auth_db.kyc_status
  ADD CONSTRAINT chk_kyc_status_status
  CHECK (status IN ('not_started', 'pending', 'approved', 'rejected'));

-- ====================================
-- 2. FOREIGN KEY CONSTRAINTS
-- ====================================
-- NOTE: Prisma automatically creates foreign keys from relations.
-- These statements are OPTIONAL - only use if you need specific constraint names.
-- If Prisma already created the FKs, these will fail. You can either:
--   1. Skip this section (use Prisma's auto-generated FK names)
--   2. Drop Prisma's FKs first, then add these with custom names
--   3. Use DO blocks to check if constraint exists before adding

-- Uncomment if you need specific FK constraint names:

/*
-- Auth Credentials -> Users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'fk_authcred_user'
  ) THEN
    ALTER TABLE auth_db.auth_credentials
      ADD CONSTRAINT fk_authcred_user
      FOREIGN KEY (user_id) REFERENCES auth_db.users(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- User Profiles -> Users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'fk_profiles_user'
  ) THEN
    ALTER TABLE auth_db.user_profiles
      ADD CONSTRAINT fk_profiles_user
      FOREIGN KEY (user_id) REFERENCES auth_db.users(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- KYC Status -> Users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'fk_kyc_user'
  ) THEN
    ALTER TABLE auth_db.kyc_status
      ADD CONSTRAINT fk_kyc_user
      FOREIGN KEY (user_id) REFERENCES auth_db.users(id)
      ON DELETE CASCADE;
  END IF;
END $$;
*/

-- ====================================
-- 3. UPDATED_AT TRIGGERS
-- ====================================

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION auth_db.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to users table
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON auth_db.users
  FOR EACH ROW
  EXECUTE FUNCTION auth_db.update_updated_at_column();

-- Apply trigger to auth_credentials table
CREATE TRIGGER update_auth_credentials_updated_at
  BEFORE UPDATE ON auth_db.auth_credentials
  FOR EACH ROW
  EXECUTE FUNCTION auth_db.update_updated_at_column();

-- Apply trigger to user_profiles table
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON auth_db.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION auth_db.update_updated_at_column();

-- Apply trigger to kyc_status table
CREATE TRIGGER update_kyc_status_updated_at
  BEFORE UPDATE ON auth_db.kyc_status
  FOR EACH ROW
  EXECUTE FUNCTION auth_db.update_updated_at_column();

-- ====================================
-- Migration Complete
-- ====================================

