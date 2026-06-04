import { Injectable } from '@nestjs/common';
import {
  ModerationState,
  ReportStatus,
  ReviewStatus,
  SanctionType,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '@/platform/prisma/prisma.service';
import { AuditService } from '@/platform/audit/audit.service';
import { buildPage, clampLimit, decodeCursor } from '@/platform/pagination/cursor';
import { AuthenticatedUser } from '@/platform/security/auth.types';
import { DomainError } from '@/shared/errors/domain-error';
import { newId } from '@/shared/ids/uuid';
import { CreateReportDto, SanctionDto, UpdateCaseDto } from './dto/moderation.dto';

@Injectable()
export class ModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Any user can file a report; it opens (or attaches to) a moderation case. */
  async fileReport(reporterId: string, dto: CreateReportDto) {
    const reportId = newId();
    await this.prisma.$transaction(async (tx) => {
      await tx.report.create({
        data: {
          id: reportId,
          reporterId,
          targetType: dto.targetType,
          targetId: dto.targetId,
          reason: dto.reason,
          details: dto.details,
        },
      });

      // Reuse an open case for the same target, else open a new one.
      const open = await tx.moderationCase.findFirst({
        where: {
          targetType: dto.targetType,
          targetId: dto.targetId,
          state: { notIn: [ModerationState.ACTIONED, ModerationState.DISMISSED, ModerationState.CLOSED] },
        },
      });
      if (!open) {
        await tx.moderationCase.create({
          data: {
            id: newId(),
            reportId,
            targetType: dto.targetType,
            targetId: dto.targetId,
            state: ModerationState.TRIAGE,
          },
        });
      }
    });
    return { ok: true, reportId };
  }

  async queue(state: ModerationState | undefined, cursor?: string, limit?: number) {
    const take = clampLimit(limit);
    const decoded = decodeCursor(cursor);
    const rows = await this.prisma.moderationCase.findMany({
      where: {
        ...(state ? { state } : {}),
        ...(decoded ? { createdAt: { lt: new Date(decoded.createdAt) } } : {}),
      },
      include: { report: true, sanctions: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
    });
    return buildPage(rows, take);
  }

  async getCase(id: string) {
    const found = await this.prisma.moderationCase.findUnique({
      where: { id },
      include: { report: true, sanctions: true },
    });
    if (!found) throw DomainError.notFound('Moderation case', id);
    return found;
  }

  async updateCase(actor: AuthenticatedUser, id: string, dto: UpdateCaseDto) {
    const existing = await this.getCase(id);
    const updated = await this.prisma.moderationCase.update({
      where: { id },
      data: {
        state: dto.state ?? existing.state,
        resolution: dto.resolution ?? existing.resolution,
        assignedModeratorId: dto.assignToSelf ? actor.id : existing.assignedModeratorId,
        resolvedAt:
          dto.state &&
          ([ModerationState.ACTIONED, ModerationState.DISMISSED, ModerationState.CLOSED] as ModerationState[]).includes(
            dto.state,
          )
            ? new Date()
            : existing.resolvedAt,
      },
    });

    if (dto.state) {
      // Sync linked report status with case resolution.
      const reportStatus =
        dto.state === ModerationState.ACTIONED
          ? ReportStatus.RESOLVED
          : dto.state === ModerationState.DISMISSED
            ? ReportStatus.DISMISSED
            : ReportStatus.IN_REVIEW;
      if (existing.reportId) {
        await this.prisma.report.update({
          where: { id: existing.reportId },
          data: { status: reportStatus },
        });
      }
    }

    await this.audit.record({
      actorId: actor.id,
      action: 'moderation.case.update',
      targetType: 'ModerationCase',
      targetId: id,
      metadata: { state: dto.state, resolution: dto.resolution },
    });
    return updated;
  }

  /** Issues a sanction and applies its side effects (ban/shadow-ban/removal). */
  async sanction(actor: AuthenticatedUser, caseId: string, dto: SanctionDto) {
    // Bans require ADMIN+ (Phase 6 §4); warnings/removals allowed for moderators.
    const banTypes: SanctionType[] = [
      SanctionType.PERMA_BAN,
      SanctionType.TEMP_BAN,
      SanctionType.SHADOW_BAN,
    ];
    const rank = { USER: 0, MODERATOR: 1, ADMIN: 2, SUPER_ADMIN: 3 };
    if (banTypes.includes(dto.type) && rank[actor.role] < rank[UserRole.ADMIN]) {
      throw DomainError.forbidden('Bans require an admin');
    }

    const moderationCase = await this.getCase(caseId);
    const targetUserId = await this.resolveTargetUser(moderationCase.targetType, moderationCase.targetId);
    if (!targetUserId) throw DomainError.validation('Cannot resolve a user for this case target');

    await this.prisma.$transaction(async (tx) => {
      await tx.sanction.create({
        data: {
          id: newId(),
          targetUserId,
          caseId,
          type: dto.type,
          reason: dto.reason,
          issuedById: actor.id,
          expiresAt: dto.expiresAt,
        },
      });

      if (dto.type === SanctionType.PERMA_BAN || dto.type === SanctionType.TEMP_BAN) {
        await tx.user.update({ where: { id: targetUserId }, data: { status: UserStatus.BANNED } });
      } else if (dto.type === SanctionType.SHADOW_BAN) {
        await tx.user.update({
          where: { id: targetUserId },
          data: { status: UserStatus.SHADOW_BANNED },
        });
      } else if (dto.type === SanctionType.CONTENT_REMOVAL && moderationCase.targetType === 'REVIEW') {
        await tx.review.update({
          where: { id: moderationCase.targetId },
          data: { status: ReviewStatus.REMOVED, deletedAt: new Date() },
        });
      }
    });

    await this.audit.record({
      actorId: actor.id,
      action: `moderation.sanction.${dto.type.toLowerCase()}`,
      targetType: 'User',
      targetId: targetUserId,
      metadata: { caseId, reason: dto.reason, expiresAt: dto.expiresAt },
    });
    return { ok: true };
  }

  private async resolveTargetUser(targetType: string, targetId: string): Promise<string | null> {
    if (targetType === 'USER') return targetId;
    if (targetType === 'REVIEW') {
      const review = await this.prisma.review.findUnique({
        where: { id: targetId },
        select: { userId: true },
      });
      return review?.userId ?? null;
    }
    return null;
  }
}
