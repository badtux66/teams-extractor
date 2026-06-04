import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '@/platform/prisma/prisma.service';
import { Public } from '@/platform/security/decorators';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  liveness() {
    return { status: 'ok', uptime: process.uptime() };
  }

  @Public()
  @Get('ready')
  async readiness() {
    const checks: Record<string, 'ok' | 'down'> = { database: 'down' };
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = 'ok';
    } catch {
      checks.database = 'down';
    }
    const ready = Object.values(checks).every((c) => c === 'ok');
    return { status: ready ? 'ready' : 'degraded', checks };
  }
}
