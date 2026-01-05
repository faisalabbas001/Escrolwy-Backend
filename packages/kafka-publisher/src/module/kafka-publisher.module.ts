import { DynamicModule, Module, Provider } from '@nestjs/common';
import { KafkaModule, KafkaService } from '@escrowly/kafka-core';
import { OutboxAdapter } from '../interfaces/outbox-adapter.interface';
import { PublisherConfig } from '../interfaces/publisher-config.interface';
import { OutboxProcessorService } from '../services/outbox-processor.service';
import { PublisherService } from '../services/publisher.service';

/**
 * Kafka Publisher Module
 *
 * Provides reliable event publishing using the Transactional Outbox Pattern.
 * Each service must provide an OutboxAdapter implementation for their database.
 *
 * @example
 * ```typescript
 * // In your service module
 * KafkaPublisherModule.forRoot({
 *   adapter: PrismaOutboxAdapter,
 *   config: {
 *     pollingIntervalMs: 2000,
 *     batchSize: 20,
 *   },
 * })
 * ```
 */
@Module({})
export class KafkaPublisherModule {
  /**
   * Register the publisher module with an adapter and configuration.
   *
   * @param options Module options
   * @param options.adapter OutboxAdapter implementation (must be Injectable)
   * @param options.config Optional publisher configuration
   */
  static forRoot(options: {
    adapter: new (...args: any[]) => OutboxAdapter;
    config?: PublisherConfig;
  }): DynamicModule {
    const adapterToken = 'OUTBOX_ADAPTER';
    const adapterProvider: Provider = {
      provide: adapterToken,
      useClass: options.adapter,
    };

    const configProvider: Provider = {
      provide: 'PUBLISHER_CONFIG',
      useValue: options.config || {},
    };

    return {
      module: KafkaPublisherModule,
      imports: [KafkaModule],
      global: true, // Make module global so all modules can access its exports
      providers: [
        adapterProvider,
        configProvider,
        {
          provide: OutboxProcessorService,
          inject: [adapterToken, KafkaService, 'PUBLISHER_CONFIG'],
          useFactory: (
            adapter: OutboxAdapter,
            kafka: KafkaService,
            config: PublisherConfig,
          ) => {
            return new OutboxProcessorService(adapter, kafka, config);
          },
        },
        PublisherService,
      ],
      exports: [PublisherService, OutboxProcessorService],
    };
  }

  /**
   * Register the publisher module asynchronously.
   * Useful when adapter or config needs to be resolved dynamically.
   *
   * @param options Async module options
   */
  static forRootAsync(options: {
    adapter: {
      useClass: new (...args: any[]) => OutboxAdapter;
      inject?: any[];
    };
    config?: {
      useFactory: (...args: any[]) => Promise<PublisherConfig> | PublisherConfig;
      inject?: any[];
    };
  }): DynamicModule {
    const adapterToken = 'OUTBOX_ADAPTER';
    const adapterProvider: Provider = options.adapter.inject
      ? {
          provide: adapterToken,
          useFactory: (...args: any[]) => {
            const AdapterClass = options.adapter.useClass;
            return new AdapterClass(...args);
          },
          inject: options.adapter.inject,
        }
      : {
          provide: adapterToken,
          useClass: options.adapter.useClass,
        };

    const configProvider: Provider = options.config
      ? {
          provide: 'PUBLISHER_CONFIG',
          useFactory: options.config.useFactory,
          inject: options.config.inject || [],
        }
      : {
          provide: 'PUBLISHER_CONFIG',
          useValue: {},
        };

    return {
      module: KafkaPublisherModule,
      imports: [KafkaModule],
      global: true, // Make module global so all modules can access its exports
      providers: [
        adapterProvider,
        configProvider,
        {
          provide: OutboxProcessorService,
          inject: [adapterToken, KafkaService, 'PUBLISHER_CONFIG'],
          useFactory: (
            adapter: OutboxAdapter,
            kafka: KafkaService,
            config: PublisherConfig,
          ) => {
            return new OutboxProcessorService(adapter, kafka, config);
          },
        },
        PublisherService,
      ],
      exports: [PublisherService, OutboxProcessorService],
    };
  }
}

