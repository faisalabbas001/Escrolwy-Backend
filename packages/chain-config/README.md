# @escrowly/chain-config

Centralized blockchain configuration for Escrowly services.

## Features

- 🔗 **Token Addresses** - Contract addresses for USDT, USDC, DAI across all chains
- 🌐 **RPC Management** - Unified RPC configuration with automatic failover
- ⛓️ **Chain Metadata** - Block times, native currencies, explorers
- 📜 **ABIs** - ERC20/TRC20 ABIs and event topics
- 🛠️ **Utilities** - Chain validation, mapping, and helper functions

## Quick Start

```typescript
import {
  getChainConfig,
  getRpcUrls,
  getTokensForChain,
  ERC20_ABI,
} from '@escrowly/chain-config';

// Get chain configuration
const ethConfig = getChainConfig('eth');

// Get RPC URLs with fallback
const rpcUrls = getRpcUrls('eth', (key) => process.env[key]);

// Get tokens for a chain
const tokens = getTokensForChain('eth');
```

## Supported Chains

- Ethereum (eth)
- BNB Smart Chain (bnb)
- Polygon (poly)
- Solana (sol)
- Tron (trc)

## Documentation

See [packages/docs/CHAIN_CONFIG.md](../docs/CHAIN_CONFIG.md) for full documentation.

## Building

```bash
npm run build
```














