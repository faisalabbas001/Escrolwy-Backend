import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/database/prisma.service';
import { EscrowTransitionEntity } from '../entities/escrow.entity';

/**
 * Escrow Transition Repository
 *
 * Data access layer for escrow state transition audit log
 */
@Injectable()
export class EscrowTransitionRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a transition record
   */
  async create(
    escrowId: string,
    previousState: string,
    newState: string,
    changedBy: string,
    reason?: string,
    metadata?: Record<string, any>,
  ): Promise<EscrowTransitionEntity> {
    return this.prisma.escrowTransition.create({
      data: {
        escrowId,
        previousState,
        newState,
        changedBy,
        reason,
        metadata,
      },
    }) as Promise<EscrowTransitionEntity>;
  }

  /**
   * Get all transitions for an escrow
   */
  async findByEscrowId(escrowId: string): Promise<EscrowTransitionEntity[]> {
    return this.prisma.escrowTransition.findMany({
      where: { escrowId },
      orderBy: { createdAt: 'asc' },
    }) as Promise<EscrowTransitionEntity[]>;
  }

  /**
   * Get transitions with pagination
   */
  async findByEscrowIdPaginated(
    escrowId: string,
    skip: number = 0,
    take: number = 50,
  ): Promise<{ data: EscrowTransitionEntity[]; total: number }> {
    const [data, total] = await this.prisma.$transaction([
      this.prisma.escrowTransition.findMany({
        where: { escrowId },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.escrowTransition.count({
        where: { escrowId },
      }),
    ]);

    return {
      data: data as EscrowTransitionEntity[],
      total,
    };
  }

  /**
   * Get all transitions (admin audit)
   */
  async findAll(
    skip: number = 0,
    take: number = 50,
  ): Promise<{ data: EscrowTransitionEntity[]; total: number }> {
    const [data, total] = await this.prisma.$transaction([
      this.prisma.escrowTransition.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.escrowTransition.count(),
    ]);

    return {
      data: data as EscrowTransitionEntity[],
      total,
    };
  }

  /**
   * Get latest transition to a specific state
   * Used for calculating elapsed time since state change
   */
  async findLatestTransitionToState(
    escrowId: string,
    state: string,
  ): Promise<EscrowTransitionEntity | null> {
    const transition = await this.prisma.escrowTransition.findFirst({
      where: {
        escrowId,
        newState: state,
      },
      orderBy: { createdAt: 'desc' },
    });

    return transition as EscrowTransitionEntity | null;
  }
}
