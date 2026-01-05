import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/database/prisma.service';
import { EscrowEntity } from '../entities/escrow.entity';
import { CreateEscrowDto } from '../dto/create-escrow.dto';
import { UpdateEscrowDto } from '../dto/create-escrow.dto';

/**
 * Escrow Repository
 *
 * Data access layer for escrow operations
 * Encapsulates all database queries
 */
@Injectable()
export class EscrowRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Map Prisma escrow to EscrowEntity
   */
  private mapToEntity(prismaEscrow: any): EscrowEntity {
    return {
      ...prismaEscrow,
      amount: typeof prismaEscrow.amount === 'number' 
        ? prismaEscrow.amount 
        : prismaEscrow.amount.toNumber(),
      platformFee: typeof prismaEscrow.platformFee === 'number' 
        ? prismaEscrow.platformFee 
        : prismaEscrow.platformFee.toNumber(),
      buyerPaidAmount: prismaEscrow.buyerPaidAmount 
        ? (typeof prismaEscrow.buyerPaidAmount === 'number' 
          ? prismaEscrow.buyerPaidAmount 
          : prismaEscrow.buyerPaidAmount.toNumber())
        : undefined,
      sellerPaidAmount: prismaEscrow.sellerPaidAmount 
        ? (typeof prismaEscrow.sellerPaidAmount === 'number' 
          ? prismaEscrow.sellerPaidAmount 
          : prismaEscrow.sellerPaidAmount.toNumber())
        : undefined,
    };
  }

  /**
   * Create a new escrow
   */
  async create(
    createEscrowDto: CreateEscrowDto | any,
    userId: string,
  ): Promise<EscrowEntity> {
    const feeAmount = createEscrowDto.platformFeeAmount || 0;
    const feePaidBy = createEscrowDto.feePaidBy || 'buyer';
    const feeSplitPercentages = createEscrowDto.feeSplitPercentages;

    // Create escrow with fees and fee split records
    const escrow = await this.prisma.$transaction(async (tx) => {
      // Create the escrow
      const escrowRecord = await tx.escrow.create({
        data: {
          buyerId: createEscrowDto.buyerId,
          sellerId: createEscrowDto.sellerId,
          brokerId: createEscrowDto.brokerId,
          amount: createEscrowDto.amount,
          asset: createEscrowDto.asset,
          chain: createEscrowDto.chain,
          platformFee: feeAmount,
          description: createEscrowDto.description,
          expiresAt: createEscrowDto.expiresAt
            ? new Date(createEscrowDto.expiresAt)
            : undefined,
          createdBy: userId,
          state: 'agreement',
        },
      });

      // Always create EscrowFees record
      await tx.escrowFees.create({
        data: {
          escrowId: escrowRecord.id,
          feeAmount: feeAmount,
          feePercentage: createEscrowDto.platformFeePercentage || null,
          paidBy: feePaidBy,
        },
      });

      // Create EscrowFeeSplit record if feePaidBy is 'split'
      if (feePaidBy === 'split' && feeSplitPercentages) {
        const buyerPercent = feeSplitPercentages.buyer || 0;
        const sellerPercent = feeSplitPercentages.seller || 0;
        const brokerPercent = feeSplitPercentages.broker || 0;

        // Calculate amounts based on percentages
        const buyerPays = (feeAmount * buyerPercent) / 100;
        const sellerPays = (feeAmount * sellerPercent) / 100;
        const brokerPays = brokerPercent > 0 ? (feeAmount * brokerPercent) / 100 : null;

        await tx.escrowFeeSplit.create({
          data: {
            escrowId: escrowRecord.id,
            feeAmount: feeAmount,
            buyerPays: buyerPays,
            sellerPays: sellerPays,
            brokerPays: brokerPays,
            buyerPercent: buyerPercent > 0 ? buyerPercent : null,
            sellerPercent: sellerPercent > 0 ? sellerPercent : null,
            brokerPercent: brokerPercent > 0 ? brokerPercent : null,
            paidBy: 'split',
          },
        });
      }

      return escrowRecord;
    });

    return this.mapToEntity(escrow);
  }

  /**
   * Find escrow by ID
   */
  async findById(id: string): Promise<EscrowEntity | null> {
    const escrow = await this.prisma.escrow.findUnique({
      where: { id },
    });
    return escrow ? this.mapToEntity(escrow) : null;
  }

  /**
   * Find escrow by ID with fee information (EscrowFees and EscrowFeeSplit)
   */
  async findByIdWithFees(id: string): Promise<{
    escrow: EscrowEntity;
    fees: {
      feeAmount: number;
      feePercentage: number | null;
      paidBy: string;
    } | null;
    feeSplit: {
      feeAmount: number;
      buyerPays: number;
      sellerPays: number;
      brokerPays: number | null;
      buyerPercent: number | null;
      sellerPercent: number | null;
      brokerPercent: number | null;
      paidBy: string;
    } | null;
  } | null> {
    const escrow = await this.prisma.escrow.findUnique({
      where: { id },
      include: {
        fees: true,
        feeSplit: true,
      },
    });

    if (!escrow) {
      return null;
    }

    const escrowEntity = this.mapToEntity(escrow);
    
    const fees = escrow.fees ? {
      feeAmount: typeof escrow.fees.feeAmount === 'number' 
        ? escrow.fees.feeAmount 
        : escrow.fees.feeAmount.toNumber(),
      feePercentage: escrow.fees.feePercentage 
        ? (typeof escrow.fees.feePercentage === 'number' 
          ? escrow.fees.feePercentage 
          : escrow.fees.feePercentage.toNumber())
        : null,
      paidBy: escrow.fees.paidBy,
    } : null;

    const feeSplit = escrow.feeSplit ? {
      feeAmount: typeof escrow.feeSplit.feeAmount === 'number' 
        ? escrow.feeSplit.feeAmount 
        : escrow.feeSplit.feeAmount.toNumber(),
      buyerPays: typeof escrow.feeSplit.buyerPays === 'number' 
        ? escrow.feeSplit.buyerPays 
        : escrow.feeSplit.buyerPays.toNumber(),
      sellerPays: typeof escrow.feeSplit.sellerPays === 'number' 
        ? escrow.feeSplit.sellerPays 
        : escrow.feeSplit.sellerPays.toNumber(),
      brokerPays: escrow.feeSplit.brokerPays 
        ? (typeof escrow.feeSplit.brokerPays === 'number' 
          ? escrow.feeSplit.brokerPays 
          : escrow.feeSplit.brokerPays.toNumber())
        : null,
      buyerPercent: escrow.feeSplit.buyerPercent 
        ? (typeof escrow.feeSplit.buyerPercent === 'number' 
          ? escrow.feeSplit.buyerPercent 
          : escrow.feeSplit.buyerPercent.toNumber())
        : null,
      sellerPercent: escrow.feeSplit.sellerPercent 
        ? (typeof escrow.feeSplit.sellerPercent === 'number' 
          ? escrow.feeSplit.sellerPercent 
          : escrow.feeSplit.sellerPercent.toNumber())
        : null,
      brokerPercent: escrow.feeSplit.brokerPercent 
        ? (typeof escrow.feeSplit.brokerPercent === 'number' 
          ? escrow.feeSplit.brokerPercent 
          : escrow.feeSplit.brokerPercent.toNumber())
        : null,
      paidBy: escrow.feeSplit.paidBy,
    } : null;

    return {
      escrow: escrowEntity,
      fees,
      feeSplit,
    };
  }

  /**
   * Find all escrows for a user (as buyer, seller, or creator)
   * Uses distinct to prevent duplicates when user is both creator and buyer/seller
   */
  async findByUserId(userId: string): Promise<EscrowEntity[]> {
    const escrows = await this.prisma.escrow.findMany({
      where: {
        OR: [
          { buyerId: userId },
          { sellerId: userId },
          { createdBy: userId },
        ],
      },
      orderBy: { createdAt: 'desc' },
      distinct: ['id'],
    });
    return escrows.map(e => this.mapToEntity(e));
  }

  /**
   * Find all escrows (admin)
   */
  async findAll(
    skip: number = 0,
    take: number = 50,
  ): Promise<{ data: EscrowEntity[]; total: number }> {
    const [data, total] = await this.prisma.$transaction([
      this.prisma.escrow.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.escrow.count(),
    ]);

    return {
      data: data.map(e => this.mapToEntity(e)),
      total,
    };
  }

  /**
   * Update escrow details
   */
  async update(
    id: string,
    updateEscrowDto: UpdateEscrowDto,
  ): Promise<EscrowEntity> {
    const escrow = await this.prisma.escrow.update({
      where: { id },
      data: {
        description: updateEscrowDto.description,
        expiresAt: updateEscrowDto.expiresAt
          ? new Date(updateEscrowDto.expiresAt)
          : undefined,
      },
    });
    return this.mapToEntity(escrow);
  }

  /**
   * Update escrow state
   */
  async updateState(
    id: string,
    newState: string,
    additionalData?: Record<string, any>,
  ): Promise<EscrowEntity> {
    const escrow = await this.prisma.escrow.update({
      where: { id },
      data: {
        state: newState,
        ...additionalData,
      },
    });
    return this.mapToEntity(escrow);
  }

  /**
   * Find escrows by state
   */
  async findByState(state: string): Promise<EscrowEntity[]> {
    const escrows = await this.prisma.escrow.findMany({
      where: { state },
      orderBy: { createdAt: 'desc' },
    });
    return escrows.map(e => this.mapToEntity(e));
  }

  /**
   * Find expired escrows
   */
  async findExpired(): Promise<EscrowEntity[]> {
    const escrows = await this.prisma.escrow.findMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
        state: { not: 'closed' },
      },
    });
    return escrows.map(e => this.mapToEntity(e));
  }

  /**
   * Count escrows by state
   */
  async countByState(state: string): Promise<number> {
    return this.prisma.escrow.count({
      where: { state },
    });
  }

  /**
   * Get escrow statistics
   */
  async getStatistics(): Promise<Record<string, number>> {
    const states = [
      'agreement',
      'funded',
      'delivery',
      'inspection',
      'closed',
      'disputed',
    ];
    const stats: Record<string, number> = {};

    for (const state of states) {
      stats[state] = await this.countByState(state);
    }

    return stats;
  }
}
