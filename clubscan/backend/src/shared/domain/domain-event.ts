import { newId } from '../ids/uuid';

/**
 * Base shape for all domain events published on the internal event bus.
 * Reactors (scoring recompute, search reindex, feed fan-out, notifications,
 * analytics) subscribe to these. Keep payloads small and id-referential.
 */
export abstract class DomainEvent<T = unknown> {
  readonly eventId: string = newId();
  readonly occurredAt: Date = new Date();
  abstract readonly name: string;
  abstract readonly payload: T;
}
