import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DomainEvent } from '@/shared/domain/domain-event';
import { EventBusPort } from './event-bus.port';

/**
 * In-process adapter backed by EventEmitter2. Reactors subscribe with
 * @OnEvent(<event.name>). Emission is fire-and-forget relative to the request
 * (handlers run async) so the write path stays fast (Phase 1 §5.2).
 */
@Injectable()
export class InProcessEventBus implements EventBusPort {
  constructor(private readonly emitter: EventEmitter2) {}

  async publish(event: DomainEvent): Promise<void> {
    this.emitter.emit(event.name, event);
  }

  async publishAll(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      this.emitter.emit(event.name, event);
    }
  }
}
