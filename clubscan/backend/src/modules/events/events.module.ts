import { Module } from '@nestjs/common';
import { EventsService } from './application/events.service';
import { EventsController } from './presentation/events.controller';

@Module({
  controllers: [EventsController],
  providers: [EventsService],
})
export class EventsModule {}
