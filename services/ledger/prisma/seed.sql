-- Ledger Service Seed SQL Script
-- Creates test accounts with initial balances for testing
-- User IDs MUST match Auth Service UUIDs exactly
-- 
-- User Accounts (spendable + reserved):
-- buyer_1: spendable=150, reserved=0
-- buyer_2: spendable=90, reserved=0
-- seller_1: spendable=50, reserved=0
-- seller_2: spendable=200, reserved=0
-- broker_1: spendable=100, reserved=0
-- 
-- System Accounts:
-- platform_revenue (ownerType=platform, purpose=fees)
-- platform_custody_pool (ownerType=platform, purpose=treasury_hot)
-- escrow_holding_pool (ownerType=platform, purpose=treasury_hot)
-- 
-- Asset/Chain: USDT/eth
-- All balances established via double-entry journal entries

BEGIN;

-- Fixed UUIDs matching Auth Service
-- buyer_1: 11111111-1111-4111-8111-111111111111
-- buyer_2: 22222222-2222-4222-8222-222222222222
-- seller_1: 33333333-3333-4333-8333-333333333333
-- seller_2: 44444444-4444-4444-8444-444444444444
-- broker_1: 55555555-5555-4555-8555-555555555555

-- Create user accounts (spendable + reserved)
-- Buyer 1
INSERT INTO ledger_db.accounts (id, "ownerType", "ownerId", purpose, asset, chain, "createdAt", "updatedAt")
VALUES 
  (gen_random_uuid(), 'user', '11111111-1111-4111-8111-111111111111', 'spendable', 'USDT', 'eth', NOW(), NOW()),
  (gen_random_uuid(), 'user', '11111111-1111-4111-8111-111111111111', 'reserved', 'USDT', 'eth', NOW(), NOW());

-- Buyer 2
INSERT INTO ledger_db.accounts (id, "ownerType", "ownerId", purpose, asset, chain, "createdAt", "updatedAt")
VALUES 
  (gen_random_uuid(), 'user', '22222222-2222-4222-8222-222222222222', 'spendable', 'USDT', 'eth', NOW(), NOW()),
  (gen_random_uuid(), 'user', '22222222-2222-4222-8222-222222222222', 'reserved', 'USDT', 'eth', NOW(), NOW());

-- Seller 1
INSERT INTO ledger_db.accounts (id, "ownerType", "ownerId", purpose, asset, chain, "createdAt", "updatedAt")
VALUES 
  (gen_random_uuid(), 'user', '33333333-3333-4333-8333-333333333333', 'spendable', 'USDT', 'eth', NOW(), NOW()),
  (gen_random_uuid(), 'user', '33333333-3333-4333-8333-333333333333', 'reserved', 'USDT', 'eth', NOW(), NOW());

-- Seller 2
INSERT INTO ledger_db.accounts (id, "ownerType", "ownerId", purpose, asset, chain, "createdAt", "updatedAt")
VALUES 
  (gen_random_uuid(), 'user', '44444444-4444-4444-8444-444444444444', 'spendable', 'USDT', 'eth', NOW(), NOW()),
  (gen_random_uuid(), 'user', '44444444-4444-4444-8444-444444444444', 'reserved', 'USDT', 'eth', NOW(), NOW());

-- Broker 1
INSERT INTO ledger_db.accounts (id, "ownerType", "ownerId", purpose, asset, chain, "createdAt", "updatedAt")
VALUES 
  (gen_random_uuid(), 'user', '55555555-5555-4555-8555-555555555555', 'spendable', 'USDT', 'eth', NOW(), NOW()),
  (gen_random_uuid(), 'user', '55555555-5555-4555-8555-555555555555', 'reserved', 'USDT', 'eth', NOW(), NOW());

-- Create system accounts
INSERT INTO ledger_db.accounts (id, "ownerType", "ownerId", purpose, asset, chain, "createdAt", "updatedAt")
VALUES 
  (gen_random_uuid(), 'platform', NULL, 'fees', 'USDT', 'eth', NOW(), NOW()),
  (gen_random_uuid(), 'platform', NULL, 'treasury_hot', 'USDT', 'eth', NOW(), NOW()),
  (gen_random_uuid(), 'platform', NULL, 'treasury_hot', 'USDT', 'eth', NOW(), NOW());

-- Note: Creating journal entries and entries requires account IDs
-- For SQL script, you would need to:
-- 1. Query account IDs after creation
-- 2. Create journals for each user
-- 3. Create entries (debit platform_custody_pool, credit user spendable)
-- 4. Ensure total debits = total credits
-- 
-- This is complex in raw SQL, so prefer using the TypeScript seed.ts script
-- which handles the double-entry accounting automatically

COMMIT;

-- Example of how to create journal entries (requires account IDs):
-- 
-- INSERT INTO ledger_db.journals (id, type, asset, chain, "userId", "transferId", "idempotencyKey", "createdAt")
-- VALUES (gen_random_uuid(), 'internal_transfer', 'USDT', 'eth', '11111111-1111-4111-8111-111111111111', 'seed-initial', 'seed-buyer1', NOW());
-- 
-- INSERT INTO ledger_db.entries (id, "journalId", "accountId", amount, "createdAt")
-- VALUES 
--   (gen_random_uuid(), <journal_id>, <buyer1_spendable_account_id>, 150.000000, NOW()),
--   (gen_random_uuid(), <journal_id>, <platform_custody_pool_account_id>, -150.000000, NOW());

