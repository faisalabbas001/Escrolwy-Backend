import { PrismaClient } from '../generated/prisma';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

/**
 * Auth Service Seed Script
 * 
 * Creates test users with fixed UUIDs for consistent testing across services.
 * All users share the same password: Test123!@# (for testing convenience)
 * Admin user password: Admin123!@#
 * 
 * Users created:
 * - buyer_1, buyer_2 (role: user)
 * - seller_1, seller_2 (role: user)
 * - broker_1 (role: user)
 * - admin_1 (role: super-admin)
 */

// Fixed UUIDs matching Ledger Service seed data
const USER_IDS = {
  BUYER_1: '11111111-1111-4111-8111-111111111111',
  BUYER_2: '22222222-2222-4222-8222-222222222222',
  SELLER_1: '33333333-3333-4333-8333-333333333333',
  SELLER_2: '44444444-4444-4444-8444-444444444444',
  BROKER_1: '55555555-5555-4555-8555-555555555555',
  ADMIN_1: '99999999-9999-4999-8999-999999999999',
};

const TEST_PASSWORD = 'Test123!@#';
const ADMIN_PASSWORD = 'Admin123!@#';

async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MB
    timeCost: 3,
    parallelism: 4,
  });
}

async function main() {
  console.log('🌱 Seeding Auth Service database...');

  // Hash passwords once
  const testPasswordHash = await hashPassword(TEST_PASSWORD);
  const adminPasswordHash = await hashPassword(ADMIN_PASSWORD);

  // Create users in transaction
  await prisma.$transaction(async (tx) => {
    // Buyer 1
    await tx.user.create({
      data: {
        id: USER_IDS.BUYER_1,
        email: 'buyer1@test.com',
        role: 'user',
        authCredential: {
          create: {
            passwordHash: testPasswordHash,
            passwordAlgo: 'argon2id',
          },
        },
        userProfile: {
          create: {
            status: 'active',
            kycStatus: 'approved',
            displayName: 'Buyer 1',
            preferredLanguage: 'en',
            walletReady: true,
          },
        },
        kycStatusRecord: {
          create: {
            status: 'approved',
            level: 'tier1',
          },
        },
      },
    });

    // Buyer 2
    await tx.user.create({
      data: {
        id: USER_IDS.BUYER_2,
        email: 'buyer2@test.com',
        role: 'user',
        authCredential: {
          create: {
            passwordHash: testPasswordHash,
            passwordAlgo: 'argon2id',
          },
        },
        userProfile: {
          create: {
            status: 'active',
            kycStatus: 'approved',
            displayName: 'Buyer 2',
            preferredLanguage: 'en',
            walletReady: true,
          },
        },
        kycStatusRecord: {
          create: {
            status: 'approved',
            level: 'tier1',
          },
        },
      },
    });

    // Seller 1
    await tx.user.create({
      data: {
        id: USER_IDS.SELLER_1,
        email: 'seller1@test.com',
        role: 'user',
        authCredential: {
          create: {
            passwordHash: testPasswordHash,
            passwordAlgo: 'argon2id',
          },
        },
        userProfile: {
          create: {
            status: 'active',
            kycStatus: 'approved',
            displayName: 'Seller 1',
            preferredLanguage: 'en',
            walletReady: true,
          },
        },
        kycStatusRecord: {
          create: {
            status: 'approved',
            level: 'tier1',
          },
        },
      },
    });

    // Seller 2
    await tx.user.create({
      data: {
        id: USER_IDS.SELLER_2,
        email: 'seller2@test.com',
        role: 'user',
        authCredential: {
          create: {
            passwordHash: testPasswordHash,
            passwordAlgo: 'argon2id',
          },
        },
        userProfile: {
          create: {
            status: 'active',
            kycStatus: 'approved',
            displayName: 'Seller 2',
            preferredLanguage: 'en',
            walletReady: true,
          },
        },
        kycStatusRecord: {
          create: {
            status: 'approved',
            level: 'tier1',
          },
        },
      },
    });

    // Broker 1
    await tx.user.create({
      data: {
        id: USER_IDS.BROKER_1,
        email: 'broker1@test.com',
        role: 'user',
        authCredential: {
          create: {
            passwordHash: testPasswordHash,
            passwordAlgo: 'argon2id',
          },
        },
        userProfile: {
          create: {
            status: 'active',
            kycStatus: 'approved',
            displayName: 'Broker 1',
            preferredLanguage: 'en',
            walletReady: true,
          },
        },
        kycStatusRecord: {
          create: {
            status: 'approved',
            level: 'tier1',
          },
        },
      },
    });

    // Admin 1
    await tx.user.create({
      data: {
        id: USER_IDS.ADMIN_1,
        email: 'admin@test.com',
        role: 'super-admin',
        authCredential: {
          create: {
            passwordHash: adminPasswordHash,
            passwordAlgo: 'argon2id',
          },
        },
        userProfile: {
          create: {
            status: 'active',
            kycStatus: 'approved',
            displayName: 'Admin',
            preferredLanguage: 'en',
            walletReady: true,
          },
        },
        kycStatusRecord: {
          create: {
            status: 'approved',
            level: 'tier1',
          },
        },
      },
    });
  });

  console.log('✅ Auth Service seed completed successfully!');
  console.log('\n📋 Created users:');
  console.log('  - buyer_1: buyer1@test.com (password: Test123!@#)');
  console.log('  - buyer_2: buyer2@test.com (password: Test123!@#)');
  console.log('  - seller_1: seller1@test.com (password: Test123!@#)');
  console.log('  - seller_2: seller2@test.com (password: Test123!@#)');
  console.log('  - broker_1: broker1@test.com (password: Test123!@#)');
  console.log('  - admin_1: admin@test.com (password: Admin123!@#)');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding Auth Service:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

