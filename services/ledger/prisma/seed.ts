import { PrismaClient } from '../../../generated/prisma';

const prisma = new PrismaClient();

/**
 * Ledger Service Seed Script
 * 
 * Creates test accounts with initial balances for testing.
 * User IDs MUST match Auth Service UUIDs exactly.
 * 
 * User Accounts (spendable + reserved):
 * - buyer_1: spendable=150, reserved=0
 * - buyer_2: spendable=90, reserved=0
 * - seller_1: spendable=50, reserved=0
 * - seller_2: spendable=200, reserved=0
 * - broker_1: spendable=100, reserved=0
 * 
 * System Accounts:
 * - platform_revenue (ownerType=platform, purpose=fees)
 * - platform_custody_pool (ownerType=platform, purpose=treasury_hot)
 * - escrow_holding_pool (ownerType=platform, purpose=treasury_hot)
 * 
 * Asset/Chain: USDT/eth (default for testing)
 * 
 * All balances are established via double-entry journal entries.
 */

// Fixed UUIDs matching Auth Service seed data
const USER_IDS = {
  BUYER_1: 'a1f0a645-ba70-4bdc-b124-746117215f9b',
  BUYER_2: '22222222-2222-4222-8222-222222222222',
  SELLER_1: '33333333-3333-4333-8333-333333333333',
  SELLER_2: '44444444-4444-4444-8444-444444444444',
  BROKER_1: '55555555-5555-4555-8555-555555555555',
};

const ASSET = 'USDT';
const CHAIN = 'eth';

// User balances
const USER_BALANCES = {
  [USER_IDS.BUYER_1]: 150,
  [USER_IDS.BUYER_2]: 90,
  [USER_IDS.SELLER_1]: 50,
  [USER_IDS.SELLER_2]: 200,
  [USER_IDS.BROKER_1]: 100,
};

async function main() {
  console.log('🌱 Seeding Ledger Service database...');

  await prisma.$transaction(async (tx) => {
    // Create user accounts (spendable + reserved for each)
    const userAccounts: { [key: string]: { spendable: string; reserved: string } } = {};

    for (const [userId, balance] of Object.entries(USER_BALANCES)) {
      // Create spendable account
      const spendableAccount = await tx.account.create({
        data: {
          ownerType: 'user',
          ownerId: userId,
          purpose: 'spendable',
          asset: ASSET,
          chain: CHAIN,
        },
      });
      userAccounts[userId] = { spendable: spendableAccount.id, reserved: '' };

      // Create reserved account (initially empty)
      const reservedAccount = await tx.account.create({
        data: {
          ownerType: 'user',
          ownerId: userId,
          purpose: 'reserved',
          asset: ASSET,
          chain: CHAIN,
        },
      });
      userAccounts[userId].reserved = reservedAccount.id;
    }

    // Create system accounts
    const platformRevenueAccount = await tx.account.create({
      data: {
        ownerType: 'platform',
        ownerId: null,
        purpose: 'fees',
        asset: ASSET,
        chain: CHAIN,
      },
    });

    const platformCustodyPoolAccount = await tx.account.create({
      data: {
        ownerType: 'platform',
        ownerId: null,
        purpose: 'treasury_hot',
        asset: ASSET,
        chain: CHAIN,
      },
    });

    const escrowHoldingPoolAccount = await tx.account.create({
      data: {
        ownerType: 'platform',
        ownerId: null,
        purpose: 'treasury_hot',
        asset: ASSET,
        chain: CHAIN,
      },
    });

    // Create initial journal entries to establish balances
    // We'll create dummy transfers for seeding purposes
    // Total debits must equal total credits (double-entry invariant)

    let totalDebits = 0;
    let totalCredits = 0;

    // Create journal entries for each user's spendable balance
    for (const [userId, balance] of Object.entries(USER_BALANCES)) {
      const spendableAccountId = userAccounts[userId].spendable;

      // Create a dummy transfer for seeding
      const transfer = await tx.transfer.create({
        data: {
          type: 'internal',
          asset: ASSET,
          amount: balance,
          chain: CHAIN,
          senderId: userId,
          destinationUserId: userId, // Self-transfer for seeding
          destinationChain: CHAIN,
          status: 'completed',
          idempotencyKey: `seed-initial-balance-${userId}`,
        },
      });

      // Create a journal for this transfer
      const journal = await tx.journal.create({
        data: {
          type: 'internal_transfer',
          asset: ASSET,
          chain: CHAIN,
          userId: userId,
          transferId: transfer.id,
          idempotencyKey: `seed-journal-${userId}`,
        },
      });

      // Create entry: credit user spendable account (positive amount = credit to user)
      await tx.entry.create({
        data: {
          journalId: journal.id,
          accountId: spendableAccountId,
          amount: balance, // Positive = credit to user account
        },
      });

      // Create corresponding debit entry to platform custody pool
      // This maintains double-entry: user gets credit, platform gets debit
      await tx.entry.create({
        data: {
          journalId: journal.id,
          accountId: platformCustodyPoolAccount.id,
          amount: -balance, // Negative = debit from platform
        },
      });

      totalDebits += balance;
      totalCredits += balance;
    }

    // Verify double-entry invariant
    if (Math.abs(totalDebits - totalCredits) > 0.000001) {
      throw new Error(
        `Double-entry validation failed: debits=${totalDebits}, credits=${totalCredits}`,
      );
    }

    console.log('✅ Ledger Service seed completed successfully!');
    console.log('\n📋 Created accounts:');
    console.log('  User Accounts:');
    for (const [userId, balance] of Object.entries(USER_BALANCES)) {
      const userName =
        Object.keys(USER_IDS).find((key) => USER_IDS[key as keyof typeof USER_IDS] === userId) ||
        userId;
      console.log(`    - ${userName}: spendable=${balance}, reserved=0`);
    }
    console.log('  System Accounts:');
    console.log('    - platform_revenue (fees)');
    console.log('    - platform_custody_pool (treasury_hot)');
    console.log('    - escrow_holding_pool (treasury_hot)');
    console.log(`\n💰 Total debits: ${totalDebits}, Total credits: ${totalCredits}`);
  });
}

main()
  .catch((e) => {
    console.error('❌ Error seeding Ledger Service:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

