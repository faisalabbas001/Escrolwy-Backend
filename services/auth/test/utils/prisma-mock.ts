import { PrismaClient } from '@prisma/client';
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
 * it('should create user', async () => {
 *   prismaMock.user.create.mockResolvedValue(mockUser);
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
