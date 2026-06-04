import { DomainEvent } from '@/shared/domain/domain-event';

export const EVENT_BUS = Symbol('EVENT_BUS');

/**
 * Abstraction over the messaging mechanism. v1 uses an in-process adapter;
 * this can be swapped for Redis Streams / SQS / Kafka without touching callers
 * (Dependency Inversion — Phase 1 §5.2).
 */
export interface EventBusPort {
  publish(event: DomainEvent): Promise<void>;
  publishAll(events: DomainEvent[]): Promise<void>;
}
