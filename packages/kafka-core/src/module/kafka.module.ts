import { Module, DynamicModule, Global, Provider } from '@nestjs/common';
import { KafkaService, KafkaServiceConfig } from '../services';

export const KAFKA_CONFIG = 'KAFKA_CONFIG';

export interface KafkaModuleOptions {
  clientId: string;
  groupId: string;
  brokers: string;
  enabled?: boolean;
  ssl?: boolean;
  sasl?: {
    mechanism: 'plain' | 'scram-sha-256' | 'scram-sha-512';
    username: string;
    password: string;
  };
}

export interface KafkaModuleAsyncOptions {
  imports?: any[];
  useFactory: (...args: any[]) => Promise<KafkaModuleOptions> | KafkaModuleOptions;
  inject?: any[];
}

/**
 * Kafka Module
 *
 * NestJS module for Kafka integration.
 * Provides KafkaService, KafkaProducer, and KafkaConsumer.
 *
 * @example
 * ```typescript
 * // Sync registration
 * KafkaModule.forRoot({
 *   clientId: 'escrow-service',
 *   groupId: 'escrow-consumer-group',
 *   brokers: 'localhost:9092',
 *   enabled: true,
 * })
 *
 * // Async registration with ConfigService
 * KafkaModule.forRootAsync({
 *   imports: [ConfigModule],
 *   useFactory: (config: ConfigService) => ({
 *     clientId: 'escrow-service',
 *     groupId: 'escrow-consumer-group',
 *     brokers: config.get('KAFKA_BROKERS', 'localhost:9092'),
 *     enabled: config.get('KAFKA_ENABLED', false),
 *   }),
 *   inject: [ConfigService],
 * })
 * ```
 */
@Global()
@Module({})
export class KafkaModule {
  /**
   * Register module with static config
   */
  static forRoot(options: KafkaModuleOptions): DynamicModule {
    const kafkaServiceProvider: Provider = {
      provide: KafkaService,
      useFactory: () => new KafkaService(options),
    };

    return {
      module: KafkaModule,
      providers: [kafkaServiceProvider],
      exports: [KafkaService],
    };
  }

  /**
   * Register module with async config (e.g., from ConfigService)
   */
  static forRootAsync(options: KafkaModuleAsyncOptions): DynamicModule {
    const kafkaServiceProvider: Provider = {
      provide: KafkaService,
      useFactory: async (...args: any[]) => {
        const config = await options.useFactory(...args);
        return new KafkaService(config);
      },
      inject: options.inject || [],
    };

    return {
      module: KafkaModule,
      imports: options.imports || [],
      providers: [kafkaServiceProvider],
      exports: [KafkaService],
    };
  }
}

