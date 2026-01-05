-- Migration Script: Update UUIDs and Chain Values
-- Updates existing seeded data to use valid UUIDs and chain 'eth'
-- Run this script AFTER clearing old data or to update existing records

BEGIN;

-- ==========================================
-- AUTH DB: Update User UUIDs
-- ==========================================

-- Update users table
UPDATE auth_db.users 
SET id = '11111111-1111-4111-8111-111111111111'
WHERE id = '00000000-0000-0000-0000-000000000001';

UPDATE auth_db.users 
SET id = '22222222-2222-4222-8222-222222222222'
WHERE id = '00000000-0000-0000-0000-000000000002';

UPDATE auth_db.users 
SET id = '33333333-3333-4333-8333-333333333333'
WHERE id = '00000000-0000-0000-0000-000000000003';

UPDATE auth_db.users 
SET id = '44444444-4444-4444-8444-444444444444'
WHERE id = '00000000-0000-0000-0000-000000000004';

UPDATE auth_db.users 
SET id = '55555555-5555-4555-8555-555555555555'
WHERE id = '00000000-0000-0000-0000-000000000005';

UPDATE auth_db.users 
SET id = '99999999-9999-4999-8999-999999999999'
WHERE id = '00000000-0000-0000-0000-000000000010';

-- Update auth_credentials table
UPDATE auth_db.auth_credentials 
SET user_id = '11111111-1111-4111-8111-111111111111'
WHERE user_id = '00000000-0000-0000-0000-000000000001';

UPDATE auth_db.auth_credentials 
SET user_id = '22222222-2222-4222-8222-222222222222'
WHERE user_id = '00000000-0000-0000-0000-000000000002';

UPDATE auth_db.auth_credentials 
SET user_id = '33333333-3333-4333-8333-333333333333'
WHERE user_id = '00000000-0000-0000-0000-000000000003';

UPDATE auth_db.auth_credentials 
SET user_id = '44444444-4444-4444-8444-444444444444'
WHERE user_id = '00000000-0000-0000-0000-000000000004';

UPDATE auth_db.auth_credentials 
SET user_id = '55555555-5555-4555-8555-555555555555'
WHERE user_id = '00000000-0000-0000-0000-000000000005';

UPDATE auth_db.auth_credentials 
SET user_id = '99999999-9999-4999-8999-999999999999'
WHERE user_id = '00000000-0000-0000-0000-000000000010';

-- Update user_profiles table
UPDATE auth_db.user_profiles 
SET user_id = '11111111-1111-4111-8111-111111111111'
WHERE user_id = '00000000-0000-0000-0000-000000000001';

UPDATE auth_db.user_profiles 
SET user_id = '22222222-2222-4222-8222-222222222222'
WHERE user_id = '00000000-0000-0000-0000-000000000002';

UPDATE auth_db.user_profiles 
SET user_id = '33333333-3333-4333-8333-333333333333'
WHERE user_id = '00000000-0000-0000-0000-000000000003';

UPDATE auth_db.user_profiles 
SET user_id = '44444444-4444-4444-8444-444444444444'
WHERE user_id = '00000000-0000-0000-0000-000000000004';

UPDATE auth_db.user_profiles 
SET user_id = '55555555-5555-4555-8555-555555555555'
WHERE user_id = '00000000-0000-0000-0000-000000000005';

UPDATE auth_db.user_profiles 
SET user_id = '99999999-9999-4999-8999-999999999999'
WHERE user_id = '00000000-0000-0000-0000-000000000010';

-- Update kyc_status table
UPDATE auth_db.kyc_status 
SET user_id = '11111111-1111-4111-8111-111111111111'
WHERE user_id = '00000000-0000-0000-0000-000000000001';

UPDATE auth_db.kyc_status 
SET user_id = '22222222-2222-4222-8222-222222222222'
WHERE user_id = '00000000-0000-0000-0000-000000000002';

UPDATE auth_db.kyc_status 
SET user_id = '33333333-3333-4333-8333-333333333333'
WHERE user_id = '00000000-0000-0000-0000-000000000003';

UPDATE auth_db.kyc_status 
SET user_id = '44444444-4444-4444-8444-444444444444'
WHERE user_id = '00000000-0000-0000-0000-000000000004';

UPDATE auth_db.kyc_status 
SET user_id = '55555555-5555-4555-8555-555555555555'
WHERE user_id = '00000000-0000-0000-0000-000000000005';

UPDATE auth_db.kyc_status 
SET user_id = '99999999-9999-4999-8999-999999999999'
WHERE user_id = '00000000-0000-0000-0000-000000000010';

-- ==========================================
-- LEDGER DB: Update UUIDs and Chain Values
-- ==========================================

-- Update accounts table: ownerId and chain
UPDATE ledger_db.accounts 
SET "ownerId" = '11111111-1111-4111-8111-111111111111',
    chain = 'eth'
WHERE "ownerId" = '00000000-0000-0000-0000-000000000001';

UPDATE ledger_db.accounts 
SET "ownerId" = '22222222-2222-4222-8222-222222222222',
    chain = 'eth'
WHERE "ownerId" = '00000000-0000-0000-0000-000000000002';

UPDATE ledger_db.accounts 
SET "ownerId" = '33333333-3333-4333-8333-333333333333',
    chain = 'eth'
WHERE "ownerId" = '00000000-0000-0000-0000-000000000003';

UPDATE ledger_db.accounts 
SET "ownerId" = '44444444-4444-4444-8444-444444444444',
    chain = 'eth'
WHERE "ownerId" = '00000000-0000-0000-0000-000000000004';

UPDATE ledger_db.accounts 
SET "ownerId" = '55555555-5555-4555-8555-555555555555',
    chain = 'eth'
WHERE "ownerId" = '00000000-0000-0000-0000-000000000005';

-- Update chain for platform accounts (no ownerId change needed)
UPDATE ledger_db.accounts 
SET chain = 'eth'
WHERE chain = 'evm' AND "ownerType" = 'platform';

-- Update transfers table: senderId, destinationUserId, and chain
-- Note: Prisma converts camelCase to snake_case, so senderId becomes "senderId" in DB
-- But PostgreSQL convention is snake_case, so using "senderId" (actual column name may vary)
UPDATE ledger_db.transfers 
SET "senderId" = '11111111-1111-4111-8111-111111111111',
    chain = 'eth',
    "destinationChain" = 'eth'
WHERE "senderId" = '00000000-0000-0000-0000-000000000001';

UPDATE ledger_db.transfers 
SET "senderId" = '22222222-2222-4222-8222-222222222222',
    chain = 'eth',
    "destinationChain" = 'eth'
WHERE "senderId" = '00000000-0000-0000-0000-000000000002';

UPDATE ledger_db.transfers 
SET "senderId" = '33333333-3333-4333-8333-333333333333',
    chain = 'eth',
    "destinationChain" = 'eth'
WHERE "senderId" = '00000000-0000-0000-0000-000000000003';

UPDATE ledger_db.transfers 
SET "senderId" = '44444444-4444-4444-8444-444444444444',
    chain = 'eth',
    "destinationChain" = 'eth'
WHERE "senderId" = '00000000-0000-0000-0000-000000000004';

UPDATE ledger_db.transfers 
SET "senderId" = '55555555-5555-4555-8555-555555555555',
    chain = 'eth',
    "destinationChain" = 'eth'
WHERE "senderId" = '00000000-0000-0000-0000-000000000005';

-- Update destinationUserId in transfers
UPDATE ledger_db.transfers 
SET "destinationUserId" = '11111111-1111-4111-8111-111111111111',
    "destinationChain" = 'eth'
WHERE "destinationUserId" = '00000000-0000-0000-0000-000000000001';

UPDATE ledger_db.transfers 
SET "destinationUserId" = '22222222-2222-4222-8222-222222222222',
    "destinationChain" = 'eth'
WHERE "destinationUserId" = '00000000-0000-0000-0000-000000000002';

UPDATE ledger_db.transfers 
SET "destinationUserId" = '33333333-3333-4333-8333-333333333333',
    "destinationChain" = 'eth'
WHERE "destinationUserId" = '00000000-0000-0000-0000-000000000003';

UPDATE ledger_db.transfers 
SET "destinationUserId" = '44444444-4444-4444-8444-444444444444',
    "destinationChain" = 'eth'
WHERE "destinationUserId" = '00000000-0000-0000-0000-000000000004';

UPDATE ledger_db.transfers 
SET "destinationUserId" = '55555555-5555-4555-8555-555555555555',
    "destinationChain" = 'eth'
WHERE "destinationUserId" = '00000000-0000-0000-0000-000000000005';

-- Update chain for all transfers (catch any remaining 'evm')
UPDATE ledger_db.transfers 
SET chain = 'eth',
    "destinationChain" = 'eth'
WHERE chain = 'evm' OR "destinationChain" = 'evm';

-- Update journals table: userId and chain
UPDATE ledger_db.journals 
SET "userId" = '11111111-1111-4111-8111-111111111111',
    chain = 'eth'
WHERE "userId" = '00000000-0000-0000-0000-000000000001';

UPDATE ledger_db.journals 
SET "userId" = '22222222-2222-4222-8222-222222222222',
    chain = 'eth'
WHERE "userId" = '00000000-0000-0000-0000-000000000002';

UPDATE ledger_db.journals 
SET "userId" = '33333333-3333-4333-8333-333333333333',
    chain = 'eth'
WHERE "userId" = '00000000-0000-0000-0000-000000000003';

UPDATE ledger_db.journals 
SET "userId" = '44444444-4444-4444-8444-444444444444',
    chain = 'eth'
WHERE "userId" = '00000000-0000-0000-0000-000000000004';

UPDATE ledger_db.journals 
SET "userId" = '55555555-5555-4555-8555-555555555555',
    chain = 'eth'
WHERE "userId" = '00000000-0000-0000-0000-000000000005';

-- Update chain for all journals (catch any remaining 'evm')
UPDATE ledger_db.journals 
SET chain = 'eth'
WHERE chain = 'evm';

-- Update reservations table: userId and chain
UPDATE ledger_db.reservations 
SET "userId" = '11111111-1111-4111-8111-111111111111',
    chain = 'eth'
WHERE "userId" = '00000000-0000-0000-0000-000000000001';

UPDATE ledger_db.reservations 
SET "userId" = '22222222-2222-4222-8222-222222222222',
    chain = 'eth'
WHERE "userId" = '00000000-0000-0000-0000-000000000002';

UPDATE ledger_db.reservations 
SET "userId" = '33333333-3333-4333-8333-333333333333',
    chain = 'eth'
WHERE "userId" = '00000000-0000-0000-0000-000000000003';

UPDATE ledger_db.reservations 
SET "userId" = '44444444-4444-4444-8444-444444444444',
    chain = 'eth'
WHERE "userId" = '00000000-0000-0000-0000-000000000004';

UPDATE ledger_db.reservations 
SET "userId" = '55555555-5555-4555-8555-555555555555',
    chain = 'eth'
WHERE "userId" = '00000000-0000-0000-0000-000000000005';

-- Update chain for all reservations (catch any remaining 'evm')
UPDATE ledger_db.reservations 
SET chain = 'eth'
WHERE chain = 'evm';

-- Update external_transfers table: userId and chain
UPDATE ledger_db.external_transfers 
SET "userId" = '11111111-1111-4111-8111-111111111111',
    chain = 'eth'
WHERE "userId" = '00000000-0000-0000-0000-000000000001';

UPDATE ledger_db.external_transfers 
SET "userId" = '22222222-2222-4222-8222-222222222222',
    chain = 'eth'
WHERE "userId" = '00000000-0000-0000-0000-000000000002';

UPDATE ledger_db.external_transfers 
SET "userId" = '33333333-3333-4333-8333-333333333333',
    chain = 'eth'
WHERE "userId" = '00000000-0000-0000-0000-000000000003';

UPDATE ledger_db.external_transfers 
SET "userId" = '44444444-4444-4444-8444-444444444444',
    chain = 'eth'
WHERE "userId" = '00000000-0000-0000-0000-000000000004';

UPDATE ledger_db.external_transfers 
SET "userId" = '55555555-5555-4555-8555-555555555555',
    chain = 'eth'
WHERE "userId" = '00000000-0000-0000-0000-000000000005';

-- Update chain for all external_transfers (catch any remaining 'evm')
UPDATE ledger_db.external_transfers 
SET chain = 'eth'
WHERE chain = 'evm';

-- ==========================================
-- ESCROW DB: Update UUIDs and Chain Values
-- ==========================================

-- Update escrows table: buyerId, sellerId, brokerId, createdBy, disputedBy, and chain
-- Update buyerId
UPDATE escrow_db.escrows 
SET "buyerId" = '11111111-1111-4111-8111-111111111111'
WHERE "buyerId" = '00000000-0000-0000-0000-000000000001';

UPDATE escrow_db.escrows 
SET "buyerId" = '22222222-2222-4222-8222-222222222222'
WHERE "buyerId" = '00000000-0000-0000-0000-000000000002';

-- Update sellerId
UPDATE escrow_db.escrows 
SET "sellerId" = '33333333-3333-4333-8333-333333333333'
WHERE "sellerId" = '00000000-0000-0000-0000-000000000003';

UPDATE escrow_db.escrows 
SET "sellerId" = '44444444-4444-4444-8444-444444444444'
WHERE "sellerId" = '00000000-0000-0000-0000-000000000004';

UPDATE escrow_db.escrows 
SET "brokerId" = '55555555-5555-4555-8555-555555555555'
WHERE "brokerId" = '00000000-0000-0000-0000-000000000005';

UPDATE escrow_db.escrows 
SET "createdBy" = '11111111-1111-4111-8111-111111111111'
WHERE "createdBy" = '00000000-0000-0000-0000-000000000001';

UPDATE escrow_db.escrows 
SET "createdBy" = '22222222-2222-4222-8222-222222222222'
WHERE "createdBy" = '00000000-0000-0000-0000-000000000002';

UPDATE escrow_db.escrows 
SET "createdBy" = '33333333-3333-4333-8333-333333333333'
WHERE "createdBy" = '00000000-0000-0000-0000-000000000003';

UPDATE escrow_db.escrows 
SET "createdBy" = '44444444-4444-4444-8444-444444444444'
WHERE "createdBy" = '00000000-0000-0000-0000-000000000004';

UPDATE escrow_db.escrows 
SET "createdBy" = '55555555-5555-4555-8555-555555555555'
WHERE "createdBy" = '00000000-0000-0000-0000-000000000005';

UPDATE escrow_db.escrows 
SET "disputedBy" = '11111111-1111-4111-8111-111111111111'
WHERE "disputedBy" = '00000000-0000-0000-0000-000000000001';

UPDATE escrow_db.escrows 
SET "disputedBy" = '22222222-2222-4222-8222-222222222222'
WHERE "disputedBy" = '00000000-0000-0000-0000-000000000002';

UPDATE escrow_db.escrows 
SET "disputedBy" = '33333333-3333-4333-8333-333333333333'
WHERE "disputedBy" = '00000000-0000-0000-0000-000000000003';

UPDATE escrow_db.escrows 
SET "disputedBy" = '44444444-4444-4444-8444-444444444444'
WHERE "disputedBy" = '00000000-0000-0000-0000-000000000004';

UPDATE escrow_db.escrows 
SET "disputedBy" = '55555555-5555-4555-8555-555555555555'
WHERE "disputedBy" = '00000000-0000-0000-0000-000000000005';

-- Update chain for all escrows (catch any remaining 'evm')
UPDATE escrow_db.escrows 
SET chain = 'eth'
WHERE chain = 'evm';

-- Update escrow_transitions table: changedBy
UPDATE escrow_db.escrow_transitions 
SET "changedBy" = '11111111-1111-4111-8111-111111111111'
WHERE "changedBy" = '00000000-0000-0000-0000-000000000001';

UPDATE escrow_db.escrow_transitions 
SET "changedBy" = '22222222-2222-4222-8222-222222222222'
WHERE "changedBy" = '00000000-0000-0000-0000-000000000002';

UPDATE escrow_db.escrow_transitions 
SET "changedBy" = '33333333-3333-4333-8333-333333333333'
WHERE "changedBy" = '00000000-0000-0000-0000-000000000003';

UPDATE escrow_db.escrow_transitions 
SET "changedBy" = '44444444-4444-4444-8444-444444444444'
WHERE "changedBy" = '00000000-0000-0000-0000-000000000004';

UPDATE escrow_db.escrow_transitions 
SET "changedBy" = '55555555-5555-4555-8555-555555555555'
WHERE "changedBy" = '00000000-0000-0000-0000-000000000005';

COMMIT;

-- Verification queries (run these after migration to verify)
-- SELECT id, email FROM auth_db.users ORDER BY id;
-- SELECT "ownerId", chain, COUNT(*) FROM ledger_db.accounts WHERE "ownerType" = 'user' GROUP BY "ownerId", chain;
-- SELECT chain, COUNT(*) FROM ledger_db.accounts GROUP BY chain;
-- SELECT chain, COUNT(*) FROM ledger_db.transfers GROUP BY chain;
-- SELECT chain, COUNT(*) FROM ledger_db.journals GROUP BY chain;
-- SELECT "buyerId", "sellerId", chain, COUNT(*) FROM escrow_db.escrows GROUP BY "buyerId", "sellerId", chain;

