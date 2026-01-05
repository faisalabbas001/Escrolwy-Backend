import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HealthService } from './health.service';
import { PrismaService } from '../prisma';

describe('HealthService', () => {
  let service: HealthService;
  let prismaService: PrismaService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        {
          provide: PrismaService,
          useValue: {
            $queryRaw: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              if (key === 'SERVICE_NAME') {
                return 'admin-service';
              }
              return defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<HealthService>(HealthService);
    prismaService = module.get<PrismaService>(PrismaService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('check', () => {
    it('should return health status', () => {
      const result = service.check();
      expect(result.status).toBe('ok');
      expect(result.service).toBe('admin-service');
      expect(result.timestamp).toBeDefined();
    });
  });

  describe('ready', () => {
    it('should return ready status when database is connected', async () => {
      jest.spyOn(prismaService, '$queryRaw').mockResolvedValue([{ '?column?': 1 }]);

      const result = await service.ready();
      expect(result.status).toBe('ready');
      expect(result.database).toBe('connected');
    });

    it('should throw ServiceUnavailableException when database is not connected', async () => {
      jest.spyOn(prismaService, '$queryRaw').mockRejectedValue(new Error('Connection failed'));

      await expect(service.ready()).rejects.toThrow();
    });
  });

  describe('live', () => {
    it('should return alive status', () => {
      const result = service.live();
      expect(result.status).toBe('alive');
      expect(result.service).toBe('admin-service');
    });
  });
});

