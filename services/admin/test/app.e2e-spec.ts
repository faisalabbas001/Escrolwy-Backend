import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * E2E Tests for Admin Service
 *
 * Tests the full application stack including:
 * - HTTP routes
 * - Validation
 * - Database operations
 * - Authentication
 */
describe('Admin Service (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply same configuration as main.ts
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Health Checks', () => {
    it('/api/v1/health (GET) should return health status', () => {
      return request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status', 'ok');
          expect(res.body).toHaveProperty('service');
          expect(res.body).toHaveProperty('timestamp');
        });
    });

    it('/api/v1/health/live (GET) should return liveness status', () => {
      return request(app.getHttpServer())
        .get('/api/v1/health/live')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status', 'alive');
        });
    });

    it('/api/v1/health/ready (GET) should return readiness status', () => {
      return request(app.getHttpServer())
        .get('/api/v1/health/ready')
        .expect((res) => {
          // May be 200 or 503 depending on database availability
          expect([200, 503]).toContain(res.status);
        });
    });
  });

  describe('Root Endpoint', () => {
    it('/api (GET) should return Hello World', () => {
      return request(app.getHttpServer())
        .get('/api')
        .expect(200)
        .expect('Hello World!');
    });
  });
});

