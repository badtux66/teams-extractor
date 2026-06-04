import { Global, Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { EVENT_BUS } from './event-bus.port';
import { InProcessEventBus } from './in-process-event-bus';

@Global()
@Module({
  imports: [EventEmitterModule.forRoot({ wildcard: false })],
  providers: [{ provide: EVENT_BUS, useClass: InProcessEventBus }],
  exports: [EVENT_BUS],
})
export class EventBusModule {}
