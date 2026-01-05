import { Injectable } from '@nestjs/common';
import { CreateTransferDto } from '../dto/create-transfer.dto';
import { AccountRepository } from '../repository';
import { PrismaTransactionClient } from '../../../common/types';

/**
 * Account Resolver Service
 *
 * Single Responsibility: Resolves accounts for transfers
 * Follows Single Responsibility Principle (SRP)
 *
 * Note: While we inject concrete classes (required by NestJS DI), they implement interfaces
 * which provides type safety and allows for easy substitution in tests or future implementations.
 */
@Injectable()
export class AccountResolverService {
  constructor(private readonly accountRepository: AccountRepository) {}

  /**
   * Get or create sender's account
   * For escrow_released transfers, sender account is reserved (buyer's reserved account)
   */
  async getSenderAccount(
    senderId: string,
    createTransferDto: CreateTransferDto,
    tx?: PrismaTransactionClient,
  ) {
    // If senderId is null/undefined (platform-origin transfer), fallback to platform account
    if (!senderId || senderId === 'platform') {
      return this.accountRepository.findOrCreate(
        {
          ownerType: 'platform',
          ownerId: null,
          asset: createTransferDto.asset,
          chain: createTransferDto.chain,
          purpose: 'treasury_hot',
        },
        tx,
      );
    }

    // For escrow_released transfers, sender account is reserved (buyer's reserved account)
    const purpose = createTransferDto.type === 'escrow_released' ? 'reserved' : 'spendable';

    return this.accountRepository.findOrCreate(
      {
        ownerType: 'user',
        ownerId: senderId,
        asset: createTransferDto.asset,
        chain: createTransferDto.chain,
        purpose,
      },
      tx,
    );
  }

  /**
   * Get account to credit based on transfer type
   * Follows Open/Closed Principle - can be extended for new transfer types
   */
  async getCreditAccount(
    createTransferDto: CreateTransferDto,
    tx?: PrismaTransactionClient,
  ) {
    if (createTransferDto.type === 'internal' || createTransferDto.type === 'escrow_released') {
      return this.getInternalCreditAccount(createTransferDto, tx);
    }

    return this.getExternalCreditAccount(createTransferDto, tx);
  }

  /**
   * Get credit account for internal transfers
   */
  private async getInternalCreditAccount(
    createTransferDto: CreateTransferDto,
    tx?: PrismaTransactionClient,
  ) {
    // Platform-directed internal transfers
    if (createTransferDto.destinationPurpose === 'fees') {
      return this.accountRepository.findOrCreate(
        {
          ownerType: 'platform',
          ownerId: null,
          asset: createTransferDto.asset,
          chain: createTransferDto.destinationChain || createTransferDto.chain,
          purpose: 'fees',
        },
        tx,
      );
    }

    if (createTransferDto.destinationPurpose === 'escrow_holding') {
      return this.accountRepository.findOrCreate(
        {
          ownerType: 'platform',
          ownerId: null,
          asset: createTransferDto.asset,
          chain: createTransferDto.destinationChain || createTransferDto.chain,
          purpose: 'treasury_hot', // reuse treasury_hot as escrow holding pool
        },
        tx,
      );
    }

    return this.accountRepository.findOrCreate(
      {
        ownerType: 'user',
        ownerId: createTransferDto.destinationUserId!,
        asset: createTransferDto.asset,
        chain: createTransferDto.destinationChain,
        purpose: 'spendable',
      },
      tx,
    );
  }

  /**
   * Get credit account for external transfers
   */
  private async getExternalCreditAccount(
    createTransferDto: CreateTransferDto,
    tx?: PrismaTransactionClient,
  ) {
    // Route platform-directed transfers by purpose
    if (createTransferDto.destinationPurpose === 'fees') {
      return this.accountRepository.findOrCreate(
        {
          ownerType: 'platform',
          ownerId: null,
          asset: createTransferDto.asset,
          chain: createTransferDto.destinationChain,
          purpose: 'fees',
        },
        tx,
      );
    }

    if (createTransferDto.destinationPurpose === 'escrow_holding') {
      return this.accountRepository.findOrCreate(
        {
          ownerType: 'platform',
          ownerId: null,
          asset: createTransferDto.asset,
          chain: createTransferDto.destinationChain,
          purpose: 'treasury_hot', // reuse treasury_hot for escrow holding pool
        },
        tx,
      );
    }

    return this.accountRepository.findOrCreate(
      {
        ownerType: 'platform',
        ownerId: null,
        asset: createTransferDto.asset,
        chain: createTransferDto.destinationChain,
        purpose: 'treasury_hot',
      },
      tx,
    );
  }
}

