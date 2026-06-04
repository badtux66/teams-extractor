import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/platform/prisma/prisma.service';
import { newId } from '@/shared/ids/uuid';
import { IngestDto } from './dto/analytics.dto';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Batched, append-only ingestion (Phase 2 §3.8). PII-minimized. */
  async ingest(userId: string | undefined, dto: IngestDto): Promise<void> {
    await this.prisma.analyticsEvent.createMany({
      data: dto.events.map((e) => ({
        id: newId(),
        type: e.type,
        userId: userId ?? null,
        sessionId: e.sessionId,
        properties: (e.properties ?? {}) as Prisma.InputJsonValue,
        occurredAt: e.occurredAt ?? new Date(),
      })),
    });
  }

  /** Aggregate metrics for admin dashboards (Phase 1 §10 — ADMIN+). */
  async overview(days = 7) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [byType, activeUsers, reviewsCreated, reportsOpen] = await Promise.all([
      this.prisma.analyticsEvent.groupBy({
        by: ['type'],
        where: { occurredAt: { gte: since } },
        _count: { _all: true },
      }),
      this.prisma.analyticsEvent
        .findMany({
          where: { occurredAt: { gte: since }, userId: { not: null } },
          distinct: ['userId'],
          select: { userId: true },
        })
        .then((r) => r.length),
      this.prisma.review.count({ where: { createdAt: { gte: since } } }),
      this.prisma.moderationCase.count({ where: { state: { in: ['TRIAGE', 'INVESTIGATING'] } } }),
    ]);

    return {
      windowDays: days,
      eventCounts: Object.fromEntries(byType.map((b) => [b.type, b._count._all])),
      activeUsers,
      reviewsCreated,
      moderationBacklog: reportsOpen,
    };
  }
}
