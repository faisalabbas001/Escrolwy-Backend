-- Auth Service Seed SQL Script
-- Creates test users with fixed UUIDs for consistent testing across services
-- All users share the same password hash (for testing convenience)
-- Password: Test123!@# (hashed with Argon2id)
-- Admin password: Admin123!@# (hashed with Argon2id)

-- Note: This SQL script requires manual password hashing
-- For production use, prefer the TypeScript seed.ts script which handles hashing automatically

-- Fixed UUIDs matching Ledger Service seed data
-- buyer_1: 11111111-1111-4111-8111-111111111111
-- buyer_2: 22222222-2222-4222-8222-222222222222
-- seller_1: 33333333-3333-4333-8333-333333333333
-- seller_2: 44444444-4444-4444-8444-444444444444
-- broker_1: 55555555-5555-4555-8555-555555555555
-- admin_1: 99999999-9999-4999-8999-999999999999

BEGIN;

-- Buyer 1
INSERT INTO auth_db.users (
  id, email, role, status, kyc_status, display_name, preferred_language, wallet_ready, accept_terms_at, created_at, updated_at
) VALUES (
  '11111111-1111-4111-8111-111111111111',
  'buyer1@test.com',
  'user',
  'active',
  'approved',
  'Buyer 1',
  'en',
  true,
  NOW(),
  NOW(),
  NOW()
);

INSERT INTO auth_db.auth_credentials (
  id, user_id, password_hash, password_algo, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  '11111111-1111-4111-8111-111111111111',
  '$argon2id$v=19$m=65536,t=3,p=4$REPLACE_WITH_ACTUAL_HASH',
  'argon2id',
  NOW(),
  NOW()
);

INSERT INTO auth_db.user_profiles (
  id, user_id, display_name, preferred_language, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  '11111111-1111-4111-8111-111111111111',
  'Buyer 1',
  'en',
  NOW(),
  NOW()
);

INSERT INTO auth_db.kyc_status (
  id, user_id, status, level, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  '11111111-1111-4111-8111-111111111111',
  'approved',
  'tier1',
  NOW(),
  NOW()
);

-- Buyer 2
INSERT INTO auth_db.users (
  id, email, role, status, kyc_status, display_name, preferred_language, wallet_ready, accept_terms_at, created_at, updated_at
) VALUES (
  '22222222-2222-4222-8222-222222222222',
  'buyer2@test.com',
  'user',
  'active',
  'approved',
  'Buyer 2',
  'en',
  true,
  NOW(),
  NOW(),
  NOW()
);

INSERT INTO auth_db.auth_credentials (
  id, user_id, password_hash, password_algo, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  '22222222-2222-4222-8222-222222222222',
  '$argon2id$v=19$m=65536,t=3,p=4$REPLACE_WITH_ACTUAL_HASH',
  'argon2id',
  NOW(),
  NOW()
);

INSERT INTO auth_db.user_profiles (
  id, user_id, display_name, preferred_language, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  '22222222-2222-4222-8222-222222222222',
  'Buyer 2',
  'en',
  NOW(),
  NOW()
);

INSERT INTO auth_db.kyc_status (
  id, user_id, status, level, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  '22222222-2222-4222-8222-222222222222',
  'approved',
  'tier1',
  NOW(),
  NOW()
);

-- Seller 1
INSERT INTO auth_db.users (
  id, email, role, status, kyc_status, display_name, preferred_language, wallet_ready, accept_terms_at, created_at, updated_at
) VALUES (
  '33333333-3333-4333-8333-333333333333',
  'seller1@test.com',
  'user',
  'active',
  'approved',
  'Seller 1',
  'en',
  true,
  NOW(),
  NOW(),
  NOW()
);

INSERT INTO auth_db.auth_credentials (
  id, user_id, password_hash, password_algo, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  '33333333-3333-4333-8333-333333333333',
  '$argon2id$v=19$m=65536,t=3,p=4$REPLACE_WITH_ACTUAL_HASH',
  'argon2id',
  NOW(),
  NOW()
);

INSERT INTO auth_db.user_profiles (
  id, user_id, display_name, preferred_language, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  '33333333-3333-4333-8333-333333333333',
  'Seller 1',
  'en',
  NOW(),
  NOW()
);

INSERT INTO auth_db.kyc_status (
  id, user_id, status, level, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  '33333333-3333-4333-8333-333333333333',
  'approved',
  'tier1',
  NOW(),
  NOW()
);

-- Seller 2
INSERT INTO auth_db.users (
  id, email, role, status, kyc_status, display_name, preferred_language, wallet_ready, accept_terms_at, created_at, updated_at
) VALUES (
  '44444444-4444-4444-8444-444444444444',
  'seller2@test.com',
  'user',
  'active',
  'approved',
  'Seller 2',
  'en',
  true,
  NOW(),
  NOW(),
  NOW()
);

INSERT INTO auth_db.auth_credentials (
  id, user_id, password_hash, password_algo, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  '44444444-4444-4444-8444-444444444444',
  '$argon2id$v=19$m=65536,t=3,p=4$REPLACE_WITH_ACTUAL_HASH',
  'argon2id',
  NOW(),
  NOW()
);

INSERT INTO auth_db.user_profiles (
  id, user_id, display_name, preferred_language, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  '44444444-4444-4444-8444-444444444444',
  'Seller 2',
  'en',
  NOW(),
  NOW()
);

INSERT INTO auth_db.kyc_status (
  id, user_id, status, level, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  '44444444-4444-4444-8444-444444444444',
  'approved',
  'tier1',
  NOW(),
  NOW()
);

-- Broker 1
INSERT INTO auth_db.users (
  id, email, role, status, kyc_status, display_name, preferred_language, wallet_ready, accept_terms_at, created_at, updated_at
) VALUES (
  '55555555-5555-4555-8555-555555555555',
  'broker1@test.com',
  'user',
  'active',
  'approved',
  'Broker 1',
  'en',
  true,
  NOW(),
  NOW(),
  NOW()
);

INSERT INTO auth_db.auth_credentials (
  id, user_id, password_hash, password_algo, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  '55555555-5555-4555-8555-555555555555',
  '$argon2id$v=19$m=65536,t=3,p=4$REPLACE_WITH_ACTUAL_HASH',
  'argon2id',
  NOW(),
  NOW()
);

INSERT INTO auth_db.user_profiles (
  id, user_id, display_name, preferred_language, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  '55555555-5555-4555-8555-555555555555',
  'Broker 1',
  'en',
  NOW(),
  NOW()
);

INSERT INTO auth_db.kyc_status (
  id, user_id, status, level, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  '55555555-5555-4555-8555-555555555555',
  'approved',
  'tier1',
  NOW(),
  NOW()
);

-- Admin 1
INSERT INTO auth_db.users (
  id, email, role, status, kyc_status, display_name, preferred_language, wallet_ready, accept_terms_at, created_at, updated_at
) VALUES (
  '99999999-9999-4999-8999-999999999999',
  'admin@test.com',
  'super-admin',
  'active',
  'approved',
  'Admin',
  'en',
  true,
  NOW(),
  NOW(),
  NOW()
);

INSERT INTO auth_db.auth_credentials (
  id, user_id, password_hash, password_algo, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  '99999999-9999-4999-8999-999999999999',
  '$argon2id$v=19$m=65536,t=3,p=4$REPLACE_WITH_ADMIN_HASH',
  'argon2id',
  NOW(),
  NOW()
);

INSERT INTO auth_db.user_profiles (
  id, user_id, display_name, preferred_language, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  '99999999-9999-4999-8999-999999999999',
  'Admin',
  'en',
  NOW(),
  NOW()
);

INSERT INTO auth_db.kyc_status (
  id, user_id, status, level, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  '99999999-9999-4999-8999-999999999999',
  'approved',
  'tier1',
  NOW(),
  NOW()
);

COMMIT;

-- Note: Password hashes in this SQL file are placeholders
-- For actual use, run the TypeScript seed.ts script which generates proper Argon2id hashes

