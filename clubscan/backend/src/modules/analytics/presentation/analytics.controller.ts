import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser, Public, Roles } from '@/platform/security/decorators';
import { AnalyticsService } from '../application/analytics.service';
import { IngestDto } from '../application/dto/analytics.dto';

@ApiTags('analytics')
@Controller()
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  // Accepts anonymous beacons too (session_started before login).
  @Public()
  @HttpCode(202)
  @Post('analytics/events')
  ingest(@Body() dto: IngestDto, @CurrentUser('id') userId?: string) {
    void this.analytics.ingest(userId, dto);
    return { accepted: dto.events.length };
  }

  @Roles(UserRole.ADMIN)
  @Get('admin/analytics/overview')
  overview(@Query('days') days?: number) {
    return this.analytics.overview(days ? Number(days) : 7);
  }
}
