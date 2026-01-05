---
name: Refactor Deposit Sweep to Use Pending Transactions
overview: Refactor the deposit sweep cron job to query pending deposit_transactions instead of checking balances for all wallets. Process each pending transaction individually, transferring the exact amount specified in the deposit_transaction record.
todos: []
---

# Refactor Deposit Sweep Cron to Use Pending Transactions

## Overview

Change the deposit sweep cron from balance-based to transaction-based. Instead of checking balances for all wallets, query pending `deposit_transactions` and sweep the exact amounts specified in each transaction.

## Current Flow (Balance-Based)

```javascript
1. Fetch all user_wallets
2. For each wallet, check on-chain token balances
3. If balance > 0, sweep entire balance
4. Update deposit_transactions after sweep
```



## New Flow (Transaction-Based)

```javascript
1. Query pending deposit_transactions
2. For each transaction, transfer exact amount
3. Update transaction status on success
4. Skip failed transactions (retry in next sweep)
```



## Changes Required

### 1. Update `deposit-sweep.cron.ts`

**File**: `services/wallet/src/cron/deposit-sweep.cron.ts`

#### Replace `sweepEvmWallets()` method:

- Remove: Balance checking logic (lines 74-163)
- Add: Query pending deposit_transactions where `chain IN ('eth', 'bnb', 'poly')` and `status IN ('pending')`
- For each transaction:
- Get token address using `getTokenAddress(deposit.chain, deposit.asset)` from chain-config
- Get wallet's encrypted private key from `user_wallets` table using `deposit.walletId`
- Map `deposit.chain` ('eth'|'bnb'|'poly') to EvmNetwork type for `evmExecutor.transferToken()`
- Check gas funding (same as current logic)
- Transfer exact `deposit.amount` (not balance)
- On success: Update `deposit_transaction.status = 'processed'`
- On failure: Log error and continue to next transaction

#### Replace `sweepSolanaWallets()` method:

- Similar changes: Query pending transactions where `chain = 'sol'`
- Use `solanaExecutor.transferToken()` with exact amount

#### Replace `sweepTronWallets()` method:

- Similar changes: Query pending transactions where `chain = 'trc'`
- Use `tronExecutor.transferToken()` with exact amount

### 2. Import Required Functions

Add imports to `deposit-sweep.cron.ts`:

- `getTokenAddress` from `@escrowly/chain-config` (via chain.config.ts)
- `getTokenConfig` to get token decimals

### 3. Helper Function for Chain Mapping

Create helper to map deposit_transaction.chain to executor network parameter:

- EVM: 'eth'/'bnb'/'poly' → 'eth'|'bnb'|'poly' (direct mapping)
- Solana: 'sol' → 'sol' (direct)
- Tron: 'trc' → 'trc' (direct)

### 4. Update Transaction Processing Logic

For each pending deposit_transaction:

1. Join with `user_wallets` to get `encryptedPrivateKey`
2. Get token config: `getTokenConfig(deposit.chain, deposit.asset)` for address and decimals
3. Validate token is supported
4. Check gas/native token funding (same as current)
5. Transfer: `transferToken(network, tokenAddress, encryptedKey, hotWallet, deposit.amount, decimals)`
6. Update status: `deposit_transaction.status = 'processed'` on success

### 5. Error Handling

- Wrap each transaction processing in try-catch
- On failure: Log error with transaction ID, continue to next
- Failed transactions remain in 'pending'/'confirmed' status for next sweep cycle

## Implementation Details

### Query Structure

```typescript
const pendingDeposits = await this.prisma.depositTransaction.findMany({
  where: {
    status: { in: ['pending', 'confirmed'] },
    chain: 'eth', // or 'bnb', 'poly', 'sol', 'trc'
  },
  include: {
    wallet: true, // Join user_wallets for encryptedPrivateKey
  },
  take: 50, // Process in batches
  orderBy: {
    createdAt: 'asc', // Process oldest first
  },
});
```



### Chain Mapping

- `deposit.chain = 'eth'` → `network = 'eth'` for evmExecutor
- `deposit.chain = 'bnb'` → `network = 'bnb'` for evmExecutor  
- `deposit.chain = 'poly'` → `network = 'poly'` for evmExecutor
- `deposit.chain = 'sol'` → use solanaExecutor
- `deposit.chain = 'trc'` → use tronExecutor

### Amount Handling

- Use `deposit.amount` (Decimal type) directly
- Convert to string: `deposit.amount.toString()`