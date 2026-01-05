import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma';
import { SecretsService } from '@escrowly/shared-config';

/**
 * Prisma Service
 *
 * Manages database connection lifecycle for the Listener Engine Service.
 * Connects to listener_engine_db schema in the shared PostgreSQL instance.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(private readonly secretsService: SecretsService) {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'info' },
        { emit: 'event', level: 'warn' },
      ],
      errorFormat: 'colorless',
    });

    // Log database queries in development
    if (process.env.NODE_ENV === 'development') {
      this.$on('query' as never, (e: any) => {
        this.logger.debug(`Query: ${e.query}`);
        this.logger.debug(`Duration: ${e.duration}ms`);
      });
    }

    // Log errors
    this.$on('error' as never, (e: any) => {
      this.logger.error(`Database Error: ${e.message}`);
    });
  }

  /**
   * Connect to database on module initialization
   */
  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('✅ Connected to PostgreSQL (listener_engine_db schema)');
    } catch (error) {
      this.logger.error('❌ Failed to connect to database', error);
      throw error;
    }
  }

  /**
   * Disconnect from database on module destruction (graceful shutdown)
   */
  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('🔌 Disconnected from PostgreSQL');
  }

  /**
   * Clean database (useful for testing)
   * WARNING: Only use in test environment
   */
  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot clean database in production');
    }

    const models = Reflect.ownKeys(this).filter(
      (key) => key[0] !== '_' && key[0] !== '$',
    );

    return Promise.all(
      models.map((modelKey) => {
        const model = this[modelKey as keyof this];
        if (model && typeof model === 'object' && 'deleteMany' in model) {
          return (model as any).deleteMany();
        }
      }),
    );
  }
}

