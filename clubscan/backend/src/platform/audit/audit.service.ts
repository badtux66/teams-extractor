import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/platform/prisma/prisma.service';
import { newId } from '@/shared/ids/uuid';

export interface AuditInput {
  actorId?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
}

/**
 * Writes immutable audit-log entries for privileged actions (Phase 6 §7).
 * Append-only: entries are never updated or deleted.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: AuditInput): Promise<void> {
    await this.prisma.auditLogEntry.create({
      data: {
        id: newId(),
        actorId: input.actorId ?? null,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        metadata: input.metadata as object | undefined,
        ip: input.ip,
      },
    });
  }
}
