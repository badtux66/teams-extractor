import { Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, Public } from '@/platform/security/decorators';
import { EventsService } from '../application/events.service';
import { EventQueryDto } from '../application/dto/event-query.dto';

@ApiTags('events')
@Controller()
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Public()
  @Get('events')
  discover(@Query() query: EventQueryDto) {
    return this.events.discover(query);
  }

  @Public()
  @Get('events/:id')
  detail(@Param('id') id: string) {
    return this.events.getById(id);
  }

  @Public()
  @Get('events/:id/share')
  share(@Param('id') id: string) {
    return this.events.share(id);
  }

  @Get('me/saved-events')
  listSaved(
    @CurrentUser('id') userId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
  ) {
    return this.events.listSaved(userId, cursor, limit);
  }

  @Post('me/saved-events/:eventId')
  save(@CurrentUser('id') userId: string, @Param('eventId') eventId: string) {
    return this.events.save(userId, eventId);
  }

  @Delete('me/saved-events/:eventId')
  unsave(@CurrentUser('id') userId: string, @Param('eventId') eventId: string) {
    return this.events.unsave(userId, eventId);
  }
}
