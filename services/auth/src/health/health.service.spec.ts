import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { HealthService } from './health.service';
import { PrismaService } from '../prisma';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '../../generated/prisma';

/**
 * Health Service Unit Tests
 *
 * Tests the health check logic without hitting the real database.
 * Demonstrates TDD approach with mocked dependencies.
 */
describe('HealthService', () => {
  let service: HealthService;
  let prisma: DeepMockProxy<PrismaClient>;
  let config: ConfigService;

  beforeEach(async () => {
    // Create mock Prisma instance
    prisma = mockDeep<PrismaClient>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config = {
                SERVICE_NAME: 'auth-service',
                NODE_ENV: 'test',
              };
              return config[key] || defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<HealthService>(HealthService);
    config = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('check', () => {
    it('should return basic health status', () => {
      const result = service.check();

      expect(result).toHaveProperty('status', 'ok');
      expect(result).toHaveProperty('service', 'auth-service');
      expect(result).toHaveProperty('timestamp');
      expect(new Date(result.timestamp)).toBeInstanceOf(Date);
    });
  });

  describe('ready', () => {
    it('should return ready status when database is connected', async () => {
      // Mock successful database query
      prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      const result = await service.ready();

      expect(result).toHaveProperty('status', 'ready');
      expect(result).toHaveProperty('service', 'auth-service');
      expect(result).toHaveProperty('database', 'connected');
      expect(result).toHaveProperty('timestamp');
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    });

    it('should throw ServiceUnavailableException when database is disconnected', async () => {
      // Mock failed database query
      const dbError = new Error('Connection refused');
      prisma.$queryRaw.mockRejectedValue(dbError);

      await expect(service.ready()).rejects.toThrow(
        ServiceUnavailableException,
      );
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    });
  });

  describe('live', () => {
    it('should return alive status', () => {
      const result = service.live();

      expect(result).toHaveProperty('status', 'alive');
      expect(result).toHaveProperty('service', 'auth-service');
      expect(result).toHaveProperty('timestamp');
      expect(new Date(result.timestamp)).toBeInstanceOf(Date);
    });
  });
});
