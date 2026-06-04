import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IncidentSeverity, IncidentState, UserRole } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, Roles } from '@/platform/security/decorators';
import { AuthenticatedUser } from '@/platform/security/auth.types';
import { SafetyService } from '../application/safety.service';
import { CreateIncidentDto, TransitionIncidentDto } from '../application/dto/safety.dto';

@ApiTags('safety')
@Controller('safety')
export class SafetyController {
  constructor(private readonly safety: SafetyService) {}

  // Any authenticated user can report; the queue is restricted.
  @Throttle({ default: { limit: 10, ttl: 60 * 60 * 1000 } })
  @Post('incidents')
  submit(@CurrentUser('id') userId: string, @Body() dto: CreateIncidentDto) {
    return this.safety.submit(userId, dto);
  }

  @Roles(UserRole.MODERATOR)
  @Get('incidents')
  list(
    @Query('state') state?: IncidentState,
    @Query('severity') severity?: IncidentSeverity,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
  ) {
    return this.safety.list({ state, severity }, cursor, limit);
  }

  @Roles(UserRole.MODERATOR)
  @Patch('incidents/:id')
  transition(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: TransitionIncidentDto,
  ) {
    return this.safety.transition(actor, id, dto);
  }
}
