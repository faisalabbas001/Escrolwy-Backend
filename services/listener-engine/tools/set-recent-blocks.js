#!/usr/bin/env node
/**
 * Set last_processed_block to recent blocks (~1 day ago)
 * This allows listeners to start from recent blocks and see events faster
 */

const { PrismaClient } = require('../generated/prisma');

const prisma = new PrismaClient();

// Block times in seconds (average)
const BLOCK_TIMES = {
  eth: 12,      // Ethereum: ~12 seconds per block
  bnb: 3,       // BSC: ~3 seconds per block
  poly: 2.1,    // Polygon: ~2.1 seconds per block
  sol: 0.5,     // Solana: ~0.5 seconds per slot (average)
  trc: 3,       // Tron: ~3 seconds per block
};

// Calculate blocks per day for each chain
function calculateBlocksPerDay(blockTimeSeconds) {
  const secondsPerDay = 24 * 60 * 60;
  return Math.floor(secondsPerDay / blockTimeSeconds);
}

// Get current block heights (approximate - you may need to adjust)
// These are rough estimates - in production, you'd query the actual chain
const CURRENT_BLOCKS = {
  eth: 21000000,    // Approximate current Ethereum block
  bnb: 45000000,    // Approximate current BSC block
  poly: 80000000,   // Approximate current Polygon block
  sol: 280000000,   // Approximate current Solana slot
  trc: 70000000,    // Approximate current Tron block
};

async function setRecentBlocks() {
  console.log('🔄 Setting last_processed_block to ~1 day ago for all chains...\n');

  const oneDayAgo = Math.floor(Date.now() / 1000) - (24 * 60 * 60);
  console.log(`Target timestamp: ${new Date(oneDayAgo * 1000).toISOString()}\n`);

  for (const [chain, blockTime] of Object.entries(BLOCK_TIMES)) {
    const blocksPerDay = calculateBlocksPerDay(blockTime);
    const currentBlock = CURRENT_BLOCKS[chain];
    const targetBlock = Math.max(0, currentBlock - blocksPerDay);

    console.log(`${chain.toUpperCase()}:`);
    console.log(`  Current block (approx): ${currentBlock.toLocaleString()}`);
    console.log(`  Blocks per day: ${blocksPerDay.toLocaleString()}`);
    console.log(`  Target block (~1 day ago): ${targetBlock.toLocaleString()}`);

    try {
      // Update or create the listener state
      const updated = await prisma.listenerState.upsert({
        where: {
          chain_listener_type_unique: {
            chain: chain,
            listenerType: 'deposit',
          },
        },
        update: {
          lastProcessedBlock: BigInt(targetBlock),
          updatedAt: new Date(),
        },
        create: {
          chain: chain,
          listenerType: 'deposit',
          lastProcessedBlock: BigInt(targetBlock),
        },
      });

      console.log(`  ✅ Updated to block ${targetBlock.toLocaleString()}\n`);
    } catch (error) {
      console.error(`  ❌ Error updating ${chain}: ${error.message}\n`);
    }
  }

  console.log('\n📊 Final state:');
  const states = await prisma.listenerState.findMany({
    orderBy: { chain: 'asc' },
  });

  for (const state of states) {
    const blockNum = Number(state.lastProcessedBlock);
    const blocksPerDay = calculateBlocksPerDay(BLOCK_TIMES[state.chain]);
    const daysBehind = Math.floor((CURRENT_BLOCKS[state.chain] - blockNum) / blocksPerDay);
    
    console.log(
      `  ${state.chain.toUpperCase()}: Block ${blockNum.toLocaleString()} (~${daysBehind} days behind)`
    );
  }

  await prisma.$disconnect();
  console.log('\n✅ Done! Restart listeners to use new checkpoints.');
}

// Run the script
setRecentBlocks().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

