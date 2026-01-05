import { PrismaClient } from '../../generated/prisma';
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';

/**
 * Mock Prisma Client for Testing
 *
 * Usage in tests:
 * ```typescript
 * import { prismaMock } from '../test/utils/prisma-mock';
 *
 * beforeEach(() => {
 *   mockReset(prismaMock);
 * });
 *
 * it('should create record', async () => {
 *   prismaMock.outbox.create.mockResolvedValue(mockOutbox);
 *   // ... test logic
 * });
 * ```
 */

export type MockPrisma = DeepMockProxy<PrismaClient>;

export const prismaMock = mockDeep<PrismaClient>() as MockPrisma;

/**
 * Factory function to create a mock PrismaService
 */
export const createMockPrismaService = () => {
  return mockDeep<PrismaClient>();
};

