# @escrowly/chain-config

Centralized blockchain configuration package for Escrowly services.

## Overview

The `@escrowly/chain-config` package provides a single source of truth for all blockchain-related configuration across Escrowly services. This includes:

- **Token Addresses** - Contract addresses for supported tokens on all chains
- **RPC Configuration** - Unified RPC management with automatic failover
- **Chain Metadata** - Block times, native currencies, explorers
- **ABIs** - Smart contract ABIs for token interactions
- **Utility Functions** - Helpers for chain mapping and validation

## Installation

The package is already linked in the monorepo. Add it to your service's `package.json`:

```json
{
  "dependencies": {
    "@escrowly/chain-config": "file:../../packages/chain-config"
  }
}
```

## Directory Structure

```
packages/chain-config/
├── src/
│   ├── index.ts          # Main exports
│   ├── types/
│   │   └── index.ts      # TypeScript type definitions
│   ├── tokens/
│   │   └── index.ts      # Token addresses per chain
│   ├── rpc/
│   │   └── index.ts      # RPC configuration & failover
│   ├── chains/
│   │   └── index.ts      # Chain metadata & configs
│   └── abis/
│       └── index.ts      # Smart contract ABIs
├── package.json
└── tsconfig.json
```

## Usage

### Importing

```typescript
import {
  // Types
  ListenerChainId,
  WalletChainId,
  TokenConfig,

  // Chain configs
  getChainConfig,
  CHAIN_CONFIGS,

  // Tokens
  getTokensForChain,
  getTokenConfig,
  ETH_TOKENS,

  // RPC
  getRpcUrls,
  getRpcUrl,
  RpcManager,

  // ABIs
  ERC20_ABI,
  ERC20_TRANSFER_TOPIC,

  // Utilities
  mapListenerChainToWalletChain,
  isValidListenerChainId,
} from '@escrowly/chain-config';
```

### Chain IDs

Two types of chain identifiers are used:

1. **ListenerChainId** - Granular chain IDs: `'eth' | 'bnb' | 'poly' | 'sol' | 'trc'`
2. **WalletChainId** - Grouped chain IDs: `'evm' | 'sol' | 'trc'`

```typescript
// Convert between chain ID types
const walletChain = mapListenerChainToWalletChain('eth'); // 'evm'
const walletChain2 = mapListenerChainToWalletChain('bnb'); // 'evm'
const walletChain3 = mapListenerChainToWalletChain('sol'); // 'sol'
```

### Getting Chain Configuration

```typescript
// Get full chain configuration
const ethConfig = getChainConfig('eth');
console.log(ethConfig.metadata.name); // 'Ethereum'
console.log(ethConfig.metadata.blockTimeMs); // 12000
console.log(ethConfig.tokens); // Array of TokenConfig

// Get chain metadata only
const metadata = getChainMetadata('eth');
console.log(metadata.nativeCurrency); // 'ETH'
console.log(metadata.explorerUrl); // 'https://etherscan.io'
```

### Token Configuration

```typescript
// Get all tokens for a chain
const ethTokens = getTokensForChain('eth');
// [{ symbol: 'USDT', address: '0x...', decimals: 6 }, ...]

// Get specific token config
const usdtConfig = getTokenConfig('eth', 'USDT');
// { symbol: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 }

// Get token address
const usdtAddress = getTokenAddress('eth', 'USDT');
// '0xdAC17F958D2ee523a2206206994597C13D831ec7'

// Check if token is supported
const isSupported = isTokenSupported('eth', 'USDT'); // true
```

### RPC Configuration

The RPC system supports multiple endpoints with automatic failover.

#### Environment Variables

For each chain, you can set either:

- Single URL: `ETH_RPC_URL`
- Multiple URLs (comma-separated): `ETH_RPC_URLS`

```bash
# Single RPC
ETH_RPC_URL=https://eth.llamarpc.com

# Multiple RPCs (comma-separated)
ETH_RPC_URLS=https://eth.llamarpc.com,https://rpc.ankr.com/eth,https://ethereum.publicnode.com
```

#### Getting RPC URLs

```typescript
// Get all configured RPC URLs for a chain
const rpcUrls = getRpcUrls('eth', (key) => process.env[key]);
// ['https://eth.llamarpc.com', 'https://rpc.ankr.com/eth', ...]

// Get single RPC URL (first available)
const rpcUrl = getRpcUrl('eth', (key) => process.env[key]);
// 'https://eth.llamarpc.com'

// With NestJS ConfigService
const rpcUrls = getRpcUrls('eth', (key) => configService.get<string>(key));
```

#### RPC Manager (Stateful Failover)

```typescript
// Create an RPC manager with automatic failover
const rpcManager = new RpcManager('eth', (key) => process.env[key]);

// Get current URL
console.log(rpcManager.currentUrl);

// Rotate to next RPC
const newUrl = rpcManager.rotate();

// Execute with automatic failover on errors
const result = await rpcManager.withFailover(async (url) => {
  const provider = new JsonRpcProvider(url);
  return provider.getBlockNumber();
});
```

### ABIs and Event Topics

```typescript
import {
  ERC20_ABI,
  ERC20_TRANSFER_TOPIC,
  TRC20_TRANSFER_TOPIC,
  SOLANA_TOKEN_PROGRAM_ID,
} from '@escrowly/chain-config';

// Use ERC20 ABI with ethers.js
const contract = new Contract(tokenAddress, ERC20_ABI, provider);

// Filter for Transfer events
const logs = await provider.getLogs({
  topics: [ERC20_TRANSFER_TOPIC],
});
```

### Redis Queue Names

```typescript
import {
  REDIS_QUEUE_NAMES,
  getAllRedisQueueNames,
} from '@escrowly/chain-config';

// Get queue name for a specific chain
const ethQueue = REDIS_QUEUE_NAMES.eth; // 'raw_events_eth'

// Get all queue names
const allQueues = getAllRedisQueueNames();
// ['raw_events_eth', 'raw_events_bnb', 'raw_events_poly', 'raw_events_sol', 'raw_events_trc']
```

### Validation Utilities

```typescript
// Validate chain IDs
if (isValidListenerChainId(userInput)) {
  // userInput is typed as ListenerChainId
}

if (isValidWalletChainId(userInput)) {
  // userInput is typed as WalletChainId
}

// Check if chain is EVM-compatible
const isEvm = isEvmChain('eth'); // true
const isEvm2 = isEvmChain('sol'); // false

// Get all EVM chains
const evmChains = getEvmChains(); // ['eth', 'bnb', 'poly']
```

## Supported Chains

| Chain ID | Name            | Type   | Native Currency |
| -------- | --------------- | ------ | --------------- |
| `eth`    | Ethereum        | EVM    | ETH             |
| `bnb`    | BNB Smart Chain | EVM    | BNB             |
| `poly`   | Polygon         | EVM    | MATIC           |
| `sol`    | Solana          | Solana | SOL             |
| `trc`    | Tron            | Tron   | TRX             |

## Supported Tokens

| Token | ETH | BNB | POLY | SOL | TRC |
| ----- | --- | --- | ---- | --- | --- |
| USDT  | ✅  | ✅  | ✅   | ✅  | ✅  |
| USDC  | ✅  | ✅  | ✅   | ✅  | ✅  |
| DAI   | ✅  | ✅  | ✅   | ✅  | ❌  |

## Environment Variables Reference

### RPC URLs

| Variable                               | Description                     |
| -------------------------------------- | ------------------------------- |
| `ETH_RPC_URL` / `ETH_RPC_URLS`         | Ethereum RPC endpoint(s)        |
| `BSC_RPC_URL` / `BSC_RPC_URLS`         | BNB Smart Chain RPC endpoint(s) |
| `POLYGON_RPC_URL` / `POLYGON_RPC_URLS` | Polygon RPC endpoint(s)         |
| `SOLANA_RPC_URL` / `SOLANA_RPC_URLS`   | Solana RPC endpoint(s)          |
| `TRON_RPC_URL` / `TRON_RPC_URLS`       | Tron RPC endpoint(s)            |

## Default Public RPCs

If no environment variables are set, the package falls back to public RPC endpoints. **Note:** Public RPCs have rate limits and should not be used in production.

```typescript
const DEFAULT_RPC_ENDPOINTS = {
  eth: ['https://eth.llamarpc.com', 'https://rpc.ankr.com/eth', ...],
  bnb: ['https://bsc-dataseed.binance.org', ...],
  poly: ['https://polygon-rpc.com', ...],
  sol: ['https://api.mainnet-beta.solana.com', ...],
  trc: ['https://api.trongrid.io', ...],
};
```

## Migration Guide

### From listener-engine local config

**Before:**

```typescript
import { ChainConfig, getRpcUrls, ERC20_TRANSFER_TOPIC } from '../config';
```

**After:**

```typescript
import {
  type FullChainConfig,
  getRpcUrls,
  ERC20_TRANSFER_TOPIC,
} from '@escrowly/chain-config';

type ChainConfig = FullChainConfig; // Type alias for compatibility
```

### From wallet service local config

**Before:**

```typescript
import { WalletChainId, EVM_TOKENS, SOL_TOKENS } from './chain.config';
```

**After:**

```typescript
import {
  type WalletChainId,
  ETH_TOKENS as EVM_TOKENS,
  SOLANA_TOKENS as SOL_TOKENS,
} from '@escrowly/chain-config';
```

## Building

```bash
# From monorepo root
npm run build -w @escrowly/chain-config

# Or from package directory
cd packages/chain-config
npm run build
```

## Adding New Chains

1. Add the chain ID to `ListenerChainId` type in `src/types/index.ts`
2. Add token addresses in `src/tokens/index.ts`
3. Add RPC configuration in `src/rpc/index.ts`
4. Add chain metadata in `src/chains/index.ts`
5. Update exports in `src/index.ts`
6. Rebuild the package

## Adding New Tokens

1. Add the token to the appropriate chain array in `src/tokens/index.ts`
2. Rebuild the package

Example:

```typescript
export const ETH_TOKENS: TokenConfig[] = [
  // ... existing tokens
  {
    symbol: 'WETH',
    address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    decimals: 18,
  },
];
```
