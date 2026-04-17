/**
 * Event Handler Interface
 *
 * Common interface for all event handlers.
 * Follows Single Responsibility Principle (SRP).
 */
export interface IEventHandler<T> {
    handle(event: T): Promise<void>;
}
