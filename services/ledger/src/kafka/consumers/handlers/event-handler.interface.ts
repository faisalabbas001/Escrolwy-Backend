import { BaseEvent } from '@escrowly/kafka-core';

/**
 * Event Handler Interface
 *
 * Defines contract for event handlers.
 * Follows Dependency Inversion Principle (DIP)
 */
export interface IEventHandler<T = unknown> {
  /**
   * Handle an event
   * @param event The event to handle
   */
  handle(event: BaseEvent<T>): Promise<void>;
}

