import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma';
import {
  WalletResponseDto,
  UserWalletsResponseDto,
  PlatformWalletResponseDto,
  PlatformWalletsResponseDto,
  PlatformWalletBalancesResponseDto,
  WalletBalancesDto,
  ChainBalanceDto,
  TokenBalanceDto,
} from './dto';
import {
  EvmExecutorService,
  SolanaExecutorService,
  TronExecutorService,
} from '../crypto';
import {
  ETH_TOKENS,
  SOL_TOKENS,
  TRC_TOKENS,
  type WalletChainId,
} from '../config';

@Injectable()
export class WalletsService {
  private readonly logger = new Logger(WalletsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly evmExecutor: EvmExecutorService,
    private readonly solanaExecutor: SolanaExecutorService,
    private readonly tronExecutor: TronExecutorService,
  ) {}

  async getWalletsByUserId(userId: string): Promise<UserWalletsResponseDto | null> {
    const wallets = await this.prisma.userWallet.findMany({
      where: { userId },
      select: {
        id: true,
        chain: true,
        depositAddress: true,
        publicKey: true,
        createdAt: true,
      },
      orderBy: { chain: 'asc' },
    });

    if (wallets.length === 0) return null;

    return {
      userId,
      wallets: wallets.map((w) => this.toWalletResponse(w)),
    };
  }

  async getPlatformWallets(): Promise<PlatformWalletsResponseDto> {
    const platformKeys = await this.prisma.platformKey.findMany({
      select: {
        chain: true,
        walletType: true,
        publicAddress: true,
      },
      orderBy: [{ walletType: 'asc' }, { chain: 'asc' }],
    });

    const hot: PlatformWalletResponseDto[] = [];
    const cold: PlatformWalletResponseDto[] = [];
    const funding: PlatformWalletResponseDto[] = [];

    for (const key of platformKeys) {
      const wallet: PlatformWalletResponseDto = {
        chain: key.chain,
        walletType: key.walletType,
        publicAddress: key.publicAddress,
      };

      switch (key.walletType) {
        case 'hot': hot.push(wallet); break;
        case 'cold': cold.push(wallet); break;
        case 'funding': funding.push(wallet); break;
      }
    }

    return {
      wallets: { hot, cold, funding },
      total: platformKeys.length,
    };
  }

  async getPlatformWalletBalances(): Promise<PlatformWalletBalancesResponseDto> {
    const platformKeys = await this.prisma.platformKey.findMany({
      select: {
        chain: true,
        walletType: true,
        publicAddress: true,
      },
    });

    const walletsByType: Record<string, { chain: string; publicAddress: string }[]> = {
      hot: [],
      cold: [],
      funding: [],
    };

    for (const key of platformKeys) {
      if (walletsByType[key.walletType]) {
        walletsByType[key.walletType].push({
          chain: key.chain,
          publicAddress: key.publicAddress,
        });
      }
    }

    const [hotBalances, coldBalances, fundingBalances] = await Promise.all([
      this.fetchWalletBalances(walletsByType.hot, true),
      this.fetchWalletBalances(walletsByType.cold, true),
      this.fetchWalletBalances(walletsByType.funding, false),
    ]);

    return {
      hot: { walletType: 'hot', chains: hotBalances },
      cold: { walletType: 'cold', chains: coldBalances },
      funding: { walletType: 'funding', chains: fundingBalances },
      fetchedAt: new Date().toISOString(),
    };
  }

  private async fetchWalletBalances(
    wallets: { chain: string; publicAddress: string }[],
    includeTokens: boolean,
  ): Promise<ChainBalanceDto[]> {
    const balances: ChainBalanceDto[] = [];

    for (const wallet of wallets) {
      if (wallet.chain === 'evm') {
        // EVM expands to eth, bnb, poly
        for (const network of ['eth', 'bnb', 'poly'] as const) {
          try {
            const chainBalance = await this.fetchEvmNetworkBalance(network, wallet.publicAddress, includeTokens);
            balances.push(chainBalance);
          } catch (error: any) {
            this.logger.error(`Failed to fetch ${network} balance: ${error.message}`);
            balances.push({
              chain: network,
              address: wallet.publicAddress,
              nativeBalance: '0',
              nativeSymbol: network === 'eth' ? 'ETH' : network === 'bnb' ? 'BNB' : 'MATIC',
              tokens: includeTokens ? [] : undefined,
            });
          }
        }
      } else {
        try {
          const chainBalance = await this.fetchChainBalance(
            wallet.chain as WalletChainId,
            wallet.publicAddress,
            includeTokens,
          );
          balances.push(chainBalance);
        } catch (error: any) {
          this.logger.error(`Failed to fetch balance for ${wallet.chain}:${wallet.publicAddress}: ${error.message}`);
          balances.push({
            chain: wallet.chain,
            address: wallet.publicAddress,
            nativeBalance: '0',
            nativeSymbol: this.getNativeSymbol(wallet.chain as WalletChainId),
            tokens: includeTokens ? [] : undefined,
          });
        }
      }
    }

    return balances;
  }

  private async fetchEvmNetworkBalance(
    network: 'eth' | 'bnb' | 'poly',
    address: string,
    includeTokens: boolean,
  ): Promise<ChainBalanceDto> {
    const nativeSymbol = network === 'eth' ? 'ETH' : network === 'bnb' ? 'BNB' : 'MATIC';
    const nativeBalance = await this.evmExecutor.getNativeBalance(network, address);
    let tokens: TokenBalanceDto[] | undefined;

    if (includeTokens) {
      tokens = await this.fetchEvmTokenBalances(network, address);
    }

    return {
      chain: network,
      address,
      nativeBalance,
      nativeSymbol,
      tokens,
    };
  }

  private async fetchChainBalance(
    chain: WalletChainId,
    address: string,
    includeTokens: boolean,
  ): Promise<ChainBalanceDto> {
    let nativeBalance: string;
    let nativeSymbol: string;
    let tokens: TokenBalanceDto[] | undefined;

    switch (chain) {
      case 'sol':
        nativeSymbol = 'SOL';
        nativeBalance = await this.solanaExecutor.getSolBalance(address);
        if (includeTokens) {
          tokens = await this.fetchSolanaTokenBalances(address);
        }
        break;

      case 'trc':
        nativeSymbol = 'TRX';
        nativeBalance = await this.tronExecutor.getTrxBalance(address);
        if (includeTokens) {
          tokens = await this.fetchTronTokenBalances(address);
        }
        break;

      default:
        throw new Error(`Unsupported chain: ${chain}`);
    }

    return {
      chain,
      address,
      nativeBalance,
      nativeSymbol,
      tokens,
    };
  }

  private async fetchEvmTokenBalances(network: 'eth' | 'bnb' | 'poly', address: string): Promise<TokenBalanceDto[]> {
    const tokens: TokenBalanceDto[] = [];
    const tokenConfigs = ETH_TOKENS; // Same tokens for all EVM networks

    for (const token of tokenConfigs) {
      try {
        const { balance, decimals } = await this.evmExecutor.getTokenBalance(network, token.address, address);
        tokens.push({
          symbol: token.symbol,
          balance,
          decimals: Number(decimals),
        });
        await this.delay(150);
      } catch (error: any) {
        this.logger.warn(`Failed to fetch ${network} ${token.symbol} balance: ${error.message}`);
        tokens.push({ symbol: token.symbol, balance: '0', decimals: token.decimals });
      }
    }

    return tokens;
  }

  private async fetchSolanaTokenBalances(address: string): Promise<TokenBalanceDto[]> {
    const tokens: TokenBalanceDto[] = [];

    for (const token of SOL_TOKENS) {
      try {
        const { balance, decimals } = await this.solanaExecutor.getTokenBalance(token.address, address);
        tokens.push({
          symbol: token.symbol,
          balance,
          decimals: Number(decimals),
        });
        await this.delay(100);
      } catch (error: any) {
        this.logger.warn(`Failed to fetch Solana ${token.symbol} balance: ${error.message}`);
        tokens.push({ symbol: token.symbol, balance: '0', decimals: token.decimals });
      }
    }

    return tokens;
  }

  private async fetchTronTokenBalances(address: string): Promise<TokenBalanceDto[]> {
    const tokens: TokenBalanceDto[] = [];

    for (const token of TRC_TOKENS) {
      try {
        const { balance, decimals } = await this.tronExecutor.getTokenBalance(token.address, address);
        tokens.push({
          symbol: token.symbol,
          balance,
          decimals: Number(decimals),
        });
        await this.delay(100);
      } catch (error: any) {
        this.logger.warn(`Failed to fetch Tron ${token.symbol} balance: ${error.message}`);
        tokens.push({ symbol: token.symbol, balance: '0', decimals: token.decimals });
      }
    }

    return tokens;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private getNativeSymbol(chain: WalletChainId): string {
    switch (chain) {
      case 'evm': return 'ETH';
      case 'sol': return 'SOL';
      case 'trc': return 'TRX';
      default: return 'UNKNOWN';
    }
  }

  private toWalletResponse(wallet: {
    id: string;
    chain: string;
    depositAddress: string;
    publicKey: string | null;
    createdAt: Date;
  }): WalletResponseDto {
    return {
      id: wallet.id,
      chain: wallet.chain,
      depositAddress: wallet.depositAddress,
      publicKey: wallet.publicKey || undefined,
      createdAt: wallet.createdAt.toISOString(),
    };
  }
}
