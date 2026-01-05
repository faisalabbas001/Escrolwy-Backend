import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma';
import { WalletEventProducer } from '../kafka';
import { WalletConfigService, getTokenConfig, type EvmNetwork, type ListenerChainId } from '../config';
import {
  EvmExecutorService,
  SolanaExecutorService,
  TronExecutorService,
  WalletGeneratorService,
  PlatformKeyService,
} from '../crypto';
import { HotToColdService } from './hot-to-cold.service';

/**
 * Deposit Sweep Cron
 *
 * Periodically sweeps tokens from user deposit wallets to hot wallet.
 *
 * Schedule: Every minute (configurable via DEPOSIT_SWEEP_CRON)
 *
 * Flow:
 * 1. Query pending deposit_transactions
 * 2. For each transaction, transfer exact amount specified
 * 3. Check gas/native token funding if needed
 * 4. Execute token transfer to hot wallet
 * 5. Update deposit_transaction status to 'processed' on success
 * 6. Emit wallet.sweep.completed event
 */
@Injectable()
export class DepositSweepCron {
  private readonly logger = new Logger(DepositSweepCron.name);
  private isProcessing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletConfig: WalletConfigService,
    private readonly walletEventProducer: WalletEventProducer,
    private readonly walletGenerator: WalletGeneratorService,
    private readonly evmExecutor: EvmExecutorService,
    private readonly solanaExecutor: SolanaExecutorService,
    private readonly tronExecutor: TronExecutorService,
    private readonly hotToColdService: HotToColdService,
    private readonly platformKeyService: PlatformKeyService,
  ) {}

  /**
   * Sweep deposits every 5 minutes
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleDepositSweep() {
    // Prevent concurrent execution
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      this.logger.log('Starting deposit sweep...');

      // Process each chain type
      await this.sweepEvmWallets();
      await this.sweepSolanaWallets();
      await this.sweepTronWallets();

      this.logger.log('Deposit sweep completed');
    } catch (error: any) {
      this.logger.error(`Deposit sweep error: ${error.message}`);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Sweep EVM wallets (eth, bnb, poly)
   */
  private async sweepEvmWallets(): Promise<void> {
    const evmChains: ListenerChainId[] = ['eth', 'bnb', 'poly'];
    const hotWallet = await this.platformKeyService.getHotWalletAddress('evm');

    for (const chain of evmChains) {
      try {
        // Query pending deposit transactions for this EVM chain
        const pendingDeposits = await this.prisma.depositTransaction.findMany({
          where: {
            chain,
            status: { in: ['pending', 'confirmed'] },
          },
          take: 50, // Process 50 at a time
          orderBy: {
            createdAt: 'asc', // Process oldest first
          },
        });

        if (pendingDeposits.length === 0) {
          continue;
        }

        this.logger.log(`Found ${pendingDeposits.length} pending deposits for ${chain}`);

        for (const deposit of pendingDeposits) {
          try {
            // Get wallet to retrieve encrypted private key
            const wallet = await this.prisma.userWallet.findUnique({
              where: { id: deposit.walletId },
            });

            if (!wallet) {
              this.logger.error(`Wallet not found for deposit ${deposit.id}`);
              continue;
            }

            // Get token config for address and decimals
            const tokenConfig = getTokenConfig(chain, deposit.asset);
            if (!tokenConfig) {
              this.logger.error(`Token ${deposit.asset} not supported on ${chain}`);
              continue;
            }

            // Map chain to EvmNetwork type
            const network = this.mapChainToEvmNetwork(chain);
            if (!network) {
              this.logger.error(`Invalid EVM chain: ${chain}`);
              continue;
            }

            this.logger.log(
              `Processing deposit ${deposit.id}: ${deposit.amount} ${deposit.asset} from ${deposit.depositAddress}`,
            );

            // Check if wallet needs gas funding
            const needsFunding = await this.evmExecutor.needsGasFunding(network, deposit.depositAddress);

            if (needsFunding) {
              this.logger.log(`Funding wallet ${deposit.depositAddress} with gas`);
              const fundResult = await this.evmExecutor.fundWalletWithGas(network, deposit.depositAddress);
              if (!fundResult.success) {
                this.logger.error(`Failed to fund wallet: ${fundResult.error}`);
                continue;
              }
              // Wait for funding transaction to confirm
              await new Promise((resolve) => setTimeout(resolve, 15000));
            }

            // Transfer exact amount from deposit transaction
            // Amount in DB is already in smallest unit (e.g., 100000000 for 100 tokens with 6 decimals)
            // Convert Decimal to string without decimal part
            const amountInSmallestUnit = deposit.amount.toFixed(0);
            const result = await this.evmExecutor.transferToken(
              network,
              tokenConfig.address,
              wallet.encryptedPrivateKey,
              hotWallet,
              amountInSmallestUnit,
              tokenConfig.decimals,
            );

            if (result.success) {
              // Update deposit transaction status to processed
              await this.prisma.depositTransaction.update({
                where: { id: deposit.id },
                data: { status: 'processed' },
              });

              // Emit sweep completed event
              // Convert smallest unit back to human-readable format for event
              const amountHumanReadable = (Number(amountInSmallestUnit) / Math.pow(10, tokenConfig.decimals)).toString();
              await this.walletEventProducer.sweepCompleted(
                wallet.id,
                wallet.userId,
                'evm',
                deposit.asset,
                amountHumanReadable,
                deposit.depositAddress,
                hotWallet,
                result.txHash!,
              );

              this.logger.log(
                `Swept ${amountHumanReadable} ${deposit.asset} from ${deposit.depositAddress}: ${result.txHash}`,
              );

              // Check and transfer to cold wallet if threshold exceeded
              await this.hotToColdService.checkAndTransfer(
                'evm',
                deposit.asset,
                tokenConfig.address,
                tokenConfig.decimals,
              );
            } else {
              this.logger.error(`Failed to sweep deposit ${deposit.id}: ${result.error}`);

              // Emit sweep failed event
              const amountHumanReadable = (Number(amountInSmallestUnit) / Math.pow(10, tokenConfig.decimals)).toString();
              await this.walletEventProducer.sweepFailed(
                wallet.id,
                deposit.id,
                wallet.userId,
                chain,
                deposit.asset,
                amountHumanReadable,
                deposit.depositAddress,
                hotWallet,
                result.error || 'Unknown error',
              );

              // Continue to next transaction - failed ones will be retried in next sweep
            }
          } catch (error: any) {
            this.logger.error(`Error processing deposit ${deposit.id}: ${error.message}`);
            // Continue to next transaction
          }
        }
      } catch (error: any) {
        this.logger.error(`Error sweeping EVM chain ${chain}: ${error.message}`);
      }
    }
  }

  /**
   * Sweep Solana wallets
   */
  private async sweepSolanaWallets(): Promise<void> {
    const hotWallet = await this.platformKeyService.getHotWalletAddress('sol');

    try {
      // Query pending deposit transactions for Solana
      const pendingDeposits = await this.prisma.depositTransaction.findMany({
        where: {
          chain: 'sol',
          status: { in: ['pending', 'confirmed'] },
        },
        take: 50, // Process 50 at a time
        orderBy: {
          createdAt: 'asc', // Process oldest first
        },
      });

      if (pendingDeposits.length === 0) {
        return;
      }

      this.logger.log(`Found ${pendingDeposits.length} pending Solana deposits`);

      for (const deposit of pendingDeposits) {
        try {
          // Get wallet to retrieve encrypted private key
          const wallet = await this.prisma.userWallet.findUnique({
            where: { id: deposit.walletId },
          });

          if (!wallet) {
            this.logger.error(`Wallet not found for deposit ${deposit.id}`);
            continue;
          }

          // Get token config for address and decimals
          const tokenConfig = getTokenConfig('sol', deposit.asset);
          if (!tokenConfig) {
            this.logger.error(`Token ${deposit.asset} not supported on Solana`);
            continue;
          }

          this.logger.log(
            `Processing Solana deposit ${deposit.id}: ${deposit.amount} ${deposit.asset} from ${deposit.depositAddress}`,
          );

          // Check if wallet needs SOL funding
          const needsFunding = await this.solanaExecutor.needsFunding(deposit.depositAddress);

          if (needsFunding) {
            this.logger.log(`Funding Solana wallet ${deposit.depositAddress} with SOL`);
            const fundResult = await this.solanaExecutor.fundWalletWithSol(deposit.depositAddress);
            if (!fundResult.success) {
              this.logger.error(`Failed to fund wallet: ${fundResult.error}`);
              continue;
            }
            // Wait for funding transaction to confirm
            await new Promise((resolve) => setTimeout(resolve, 5000));
          }

          // Transfer exact amount from deposit transaction
          // Amount in DB is already in smallest unit (e.g., 100000000 for 100 tokens with 6 decimals)
          // Convert Decimal to string without decimal part
          const amountInSmallestUnit = deposit.amount.toFixed(0);
          const result = await this.solanaExecutor.transferToken(
            tokenConfig.address,
            wallet.encryptedPrivateKey,
            hotWallet,
            amountInSmallestUnit,
            tokenConfig.decimals,
          );

          if (result.success) {
            // Update deposit transaction status to processed
            await this.prisma.depositTransaction.update({
              where: { id: deposit.id },
              data: { status: 'processed' },
            });

            // Convert smallest unit back to human-readable format for event
            const amountHumanReadable = (Number(amountInSmallestUnit) / Math.pow(10, tokenConfig.decimals)).toString();
            await this.walletEventProducer.sweepCompleted(
              wallet.id,
              wallet.userId,
              'sol',
              deposit.asset,
              amountHumanReadable,
              deposit.depositAddress,
              hotWallet,
              result.txHash!,
            );

            this.logger.log(
              `Swept ${amountHumanReadable} ${deposit.asset} from Solana wallet ${deposit.depositAddress}: ${result.txHash}`,
            );

            // Check and transfer to cold wallet if threshold exceeded
            await this.hotToColdService.checkAndTransfer(
              'sol',
              deposit.asset,
              tokenConfig.address,
              tokenConfig.decimals,
            );
          } else {
            this.logger.error(`Failed to sweep Solana deposit ${deposit.id}: ${result.error}`);

            // Emit sweep failed event
            const amountHumanReadable = (Number(amountInSmallestUnit) / Math.pow(10, tokenConfig.decimals)).toString();
            await this.walletEventProducer.sweepFailed(
              wallet.id,
              deposit.id,
              wallet.userId,
              'sol',
              deposit.asset,
              amountHumanReadable,
              deposit.depositAddress,
              hotWallet,
              result.error || 'Unknown error',
            );

            // Continue to next transaction - failed ones will be retried in next sweep
          }
        } catch (error: any) {
          this.logger.error(`Error processing Solana deposit ${deposit.id}: ${error.message}`);
          // Continue to next transaction
        }
      }
    } catch (error: any) {
      this.logger.error(`Error sweeping Solana wallets: ${error.message}`);
    }
  }

  /**
   * Sweep Tron wallets
   */
  private async sweepTronWallets(): Promise<void> {
    const hotWallet = await this.platformKeyService.getHotWalletAddress('trc');

    try {
      // Query pending deposit transactions for Tron
      const pendingDeposits = await this.prisma.depositTransaction.findMany({
        where: {
          chain: 'trc',
          status: { in: ['pending', 'confirmed'] },
        },
        take: 50, // Process 50 at a time
        orderBy: {
          createdAt: 'asc', // Process oldest first
        },
      });

      if (pendingDeposits.length === 0) {
        return;
      }

      this.logger.log(`Found ${pendingDeposits.length} pending Tron deposits`);

      for (const deposit of pendingDeposits) {
        try {
          // Get wallet to retrieve encrypted private key
          const wallet = await this.prisma.userWallet.findUnique({
            where: { id: deposit.walletId },
          });

          if (!wallet) {
            this.logger.error(`Wallet not found for deposit ${deposit.id}`);
            continue;
          }

          // Get token config for address and decimals
          const tokenConfig = getTokenConfig('trc', deposit.asset);
          if (!tokenConfig) {
            this.logger.error(`Token ${deposit.asset} not supported on Tron`);
            continue;
          }

          this.logger.log(
            `Processing Tron deposit ${deposit.id}: ${deposit.amount} ${deposit.asset} from ${deposit.depositAddress}`,
          );

          // Check if wallet needs TRX funding
          const needsFunding = await this.tronExecutor.needsFunding(deposit.depositAddress);

          if (needsFunding) {
            this.logger.log(`Funding Tron wallet ${deposit.depositAddress} with TRX`);
            const fundResult = await this.tronExecutor.fundWalletWithTrx(deposit.depositAddress);
            if (!fundResult.success) {
              this.logger.error(`Failed to fund wallet: ${fundResult.error}`);
              continue;
            }
            // Wait for funding transaction to confirm
            await new Promise((resolve) => setTimeout(resolve, 5000));
          }

          // Transfer exact amount from deposit transaction
          // Amount in DB is already in smallest unit (e.g., 100000000 for 100 tokens with 6 decimals)
          // Convert Decimal to string without decimal part
          const amountInSmallestUnit = deposit.amount.toFixed(0);
          const result = await this.tronExecutor.transferToken(
            tokenConfig.address,
            wallet.encryptedPrivateKey,
            hotWallet,
            amountInSmallestUnit,
            tokenConfig.decimals,
          );

          if (result.success) {
            // Update deposit transaction status to processed
            await this.prisma.depositTransaction.update({
              where: { id: deposit.id },
              data: { status: 'processed' },
            });

            // Convert smallest unit back to human-readable format for event
            const amountHumanReadable = (Number(amountInSmallestUnit) / Math.pow(10, tokenConfig.decimals)).toString();
            await this.walletEventProducer.sweepCompleted(
              wallet.id,
              wallet.userId,
              'trc',
              deposit.asset,
              amountHumanReadable,
              deposit.depositAddress,
              hotWallet,
              result.txHash!,
            );

            this.logger.log(
              `Swept ${amountHumanReadable} ${deposit.asset} from Tron wallet ${deposit.depositAddress}: ${result.txHash}`,
            );

            // Check and transfer to cold wallet if threshold exceeded
            await this.hotToColdService.checkAndTransfer(
              'trc',
              deposit.asset,
              tokenConfig.address,
              tokenConfig.decimals,
            );
          } else {
            this.logger.error(`Failed to sweep Tron deposit ${deposit.id}: ${result.error}`);

            // Emit sweep failed event
            const amountHumanReadable = (Number(amountInSmallestUnit) / Math.pow(10, tokenConfig.decimals)).toString();
            await this.walletEventProducer.sweepFailed(
              wallet.id,
              deposit.id,
              wallet.userId,
              'trc',
              deposit.asset,
              amountHumanReadable,
              deposit.depositAddress,
              hotWallet,
              result.error || 'Unknown error',
            );

            // Continue to next transaction - failed ones will be retried in next sweep
          }
        } catch (error: any) {
          this.logger.error(`Error processing Tron deposit ${deposit.id}: ${error.message}`);
          // Continue to next transaction
        }
      }
    } catch (error: any) {
      this.logger.error(`Error sweeping Tron wallets: ${error.message}`);
    }
  }

  /**
   * Helper function to map listener chain ID to EvmNetwork type
   */
  private mapChainToEvmNetwork(chain: ListenerChainId): EvmNetwork | null {
    switch (chain) {
      case 'eth':
        return 'eth';
      case 'bnb':
        return 'bnb';
      case 'poly':
        return 'poly';
      default:
        return null;
    }
  }
}

