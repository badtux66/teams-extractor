import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ModerationState, UserRole } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, Roles } from '@/platform/security/decorators';
import { AuthenticatedUser } from '@/platform/security/auth.types';
import { ModerationService } from '../application/moderation.service';
import { CreateReportDto, SanctionDto, UpdateCaseDto } from '../application/dto/moderation.dto';

@ApiTags('moderation')
@Controller()
export class ModerationController {
  constructor(private readonly moderation: ModerationService) {}

  // Any authenticated user may report content.
  @Throttle({ default: { limit: 10, ttl: 60 * 60 * 1000 } })
  @Post('reports')
  report(@CurrentUser('id') userId: string, @Body() dto: CreateReportDto) {
    return this.moderation.fileReport(userId, dto);
  }

  @Roles(UserRole.MODERATOR)
  @Get('moderation/queue')
  queue(
    @Query('state') state?: ModerationState,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
  ) {
    return this.moderation.queue(state, cursor, limit);
  }

  @Roles(UserRole.MODERATOR)
  @Get('moderation/cases/:id')
  getCase(@Param('id') id: string) {
    return this.moderation.getCase(id);
  }

  @Roles(UserRole.MODERATOR)
  @Patch('moderation/cases/:id')
  updateCase(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateCaseDto,
  ) {
    return this.moderation.updateCase(actor, id, dto);
  }

  @Roles(UserRole.MODERATOR)
  @Post('moderation/cases/:id/sanction')
  sanction(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SanctionDto,
  ) {
    return this.moderation.sanction(actor, id, dto);
  }
}
