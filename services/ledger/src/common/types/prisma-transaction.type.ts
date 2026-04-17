import { PrismaClient } from '../../../../../generated/prisma';

/**
 * Prisma Transaction Client Type
 *
 * Represents a Prisma transaction client with excluded methods that shouldn't be used within transactions.
 * Used consistently across all services, repositories, and event producers.
 *
 * Follows DRY principle - single source of truth for transaction client type
 */
export type PrismaTransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

