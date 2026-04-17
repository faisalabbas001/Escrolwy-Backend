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
 * Manages database connection lifecycle for the Compliance Service.
 * Connects to compliance_db schema in the shared PostgreSQL instance.
 */
@Injectable()
export class PrismaService
    extends PrismaClient
    implements OnModuleInit, OnModuleDestroy {
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
            this.logger.log('✅ Connected to PostgreSQL (compliance_db schema)');
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
}
