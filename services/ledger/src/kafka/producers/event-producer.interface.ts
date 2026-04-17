import { PrismaTransactionClient } from './types';

/**
 * Event Producer Interface
 *
 * Defines contract for event producers.
 * Follows Dependency Inversion Principle (DIP)
 * Follows DRY principle - uses shared PrismaTransactionClient type
 */
export interface IEventProducer<T = unknown> {
  /**
   * Produce an event
   * @param data Data needed to create the event
   * @param tx Optional transaction client
   */
  produce(data: T, tx?: PrismaTransactionClient): Promise<void>;
}

