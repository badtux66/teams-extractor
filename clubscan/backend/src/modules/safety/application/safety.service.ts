import { Inject, Injectable } from '@nestjs/common';
import { IncidentSeverity, IncidentState, Prisma } from '@prisma/client';
import { PrismaService } from '@/platform/prisma/prisma.service';
import { AuditService } from '@/platform/audit/audit.service';
import { EVENT_BUS, EventBusPort } from '@/platform/event-bus/event-bus.port';
import { buildPage, clampLimit, decodeCursor } from '@/platform/pagination/cursor';
import { AuthenticatedUser } from '@/platform/security/auth.types';
import { DomainEvent } from '@/shared/domain/domain-event';
import { DomainError } from '@/shared/errors/domain-error';
import { newId } from '@/shared/ids/uuid';
import { CreateIncidentDto, TransitionIncidentDto } from './dto/safety.dto';

class IncidentSubmittedEvent extends DomainEvent<{ incidentId: string; severity: IncidentSeverity }> {
  readonly name = 'incident.submitted';
  constructor(readonly payload: { incidentId: string; severity: IncidentSeverity }) {
    super();
  }
}

// SLA windows by severity (hours) — drive escalation due dates (Phase 1 §11).
const SLA_HOURS: Record<IncidentSeverity, number> = {
  LOW: 72,
  MEDIUM: 48,
  HIGH: 12,
  CRITICAL: 2,
};

// Allowed escalation state machine transitions (Phase 3 §11 / Phase 1 §11).
const TRANSITIONS: Record<IncidentState, IncidentState[]> = {
  SUBMITTED: ['TRIAGED', 'DISMISSED'],
  TRIAGED: ['INVESTIGATING', 'DISMISSED'],
  INVESTIGATING: ['ACTIONED', 'DISMISSED'],
  ACTIONED: ['CLOSED'],
  DISMISSED: ['CLOSED'],
  CLOSED: [],
};

@Injectable()
export class SafetyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(EVENT_BUS) private readonly bus: EventBusPort,
  ) {}

  /** Submits a private incident report and opens an escalation with an SLA. */
  async submit(reporterId: string, dto: CreateIncidentDto) {
    const incidentId = newId();
    const slaDueAt = new Date(Date.now() + SLA_HOURS[dto.severity] * 60 * 60 * 1000);
    // CRITICAL/HIGH (e.g. violence) fast-path to escalation level 2.
    const level = dto.severity === IncidentSeverity.CRITICAL ? 2 : 1;

    await this.prisma.$transaction([
      this.prisma.incidentReport.create({
        data: {
          id: incidentId,
          reporterId: dto.isAnonymous ? null : reporterId,
          venueId: dto.venueId,
          category: dto.category,
          severity: dto.severity,
          description: dto.description,
          occurredAt: dto.occurredAt,
          isAnonymous: dto.isAnonymous,
        },
      }),
      this.prisma.escalation.create({
        data: { id: newId(), incidentId, level, slaDueAt },
      }),
    ]);

    await this.bus.publish(new IncidentSubmittedEvent({ incidentId, severity: dto.severity }));
    // The reporter only receives a confirmation id — never the queue.
    return { ok: true, referenceId: incidentId };
  }

  async list(
    filters: { state?: IncidentState; severity?: IncidentSeverity },
    cursor?: string,
    limit?: number,
  ) {
    const take = clampLimit(limit);
    const decoded = decodeCursor(cursor);
    const where: Prisma.IncidentReportWhereInput = {
      ...(filters.state ? { state: filters.state } : {}),
      ...(filters.severity ? { severity: filters.severity } : {}),
      ...(decoded ? { createdAt: { lt: new Date(decoded.createdAt) } } : {}),
    };
    const rows = await this.prisma.incidentReport.findMany({
      where,
      include: { escalation: true, venue: { select: { name: true, slug: true } } },
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
    });
    return buildPage(rows, take);
  }

  async transition(actor: AuthenticatedUser, incidentId: string, dto: TransitionIncidentDto) {
    const incident = await this.prisma.incidentReport.findUnique({
      where: { id: incidentId },
      include: { escalation: true },
    });
    if (!incident) throw DomainError.notFound('Incident', incidentId);

    const allowed = TRANSITIONS[incident.state];
    if (!allowed.includes(dto.state)) {
      throw DomainError.validation(
        `Cannot transition incident from ${incident.state} to ${dto.state}`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.incidentReport.update({ where: { id: incidentId }, data: { state: dto.state } });
      if (incident.escalation) {
        await tx.escalation.update({
          where: { incidentId },
          data: {
            handledById: actor.id,
            escalatedAt: new Date(),
            outcome: dto.outcome ?? incident.escalation.outcome,
          },
        });
      }
    });

    await this.audit.record({
      actorId: actor.id,
      action: 'safety.incident.transition',
      targetType: 'IncidentReport',
      targetId: incidentId,
      metadata: { from: incident.state, to: dto.state },
    });
    return { ok: true };
  }
}
