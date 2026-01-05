import { BaseEvent } from '@escrowly/kafka-core';

/**
 * Event Handler Interface
 *
 * All event handlers must implement this interface.
 * Ensures consistent event handling across the service.
 */
export interface IEventHandler<T = any> {
    /**
     * Handle an incoming Kafka event
     * @param event - The event to handle
     */
    handle(event: BaseEvent<T>): Promise<void>;
}
