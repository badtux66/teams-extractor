import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/platform/prisma/prisma.service';
import { newId } from '@/shared/ids/uuid';

/** Reputation deltas (Phase 1 §4.2 — reputation weights review influence). */
export const REPUTATION_RULES = {
  REVIEW_PUBLISHED: 10,
  REVIEW_MARKED_HELPFUL: 2,
  GAINED_FOLLOWER: 1,
  REVIEW_REMOVED_BY_MOD: -25,
} as const;

/**
 * Maintains the append-only reputation ledger and the denormalized cache on
 * the user. All adjustments flow through here so the score is auditable.
 */
@Injectable()
export class ReputationService {
  constructor(private readonly prisma: PrismaService) {}

  async adjust(userId: string, delta: number, reason: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.reputationEvent.create({
        data: { id: newId(), userId, delta, reason },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { reputationScore: { increment: delta } },
      }),
    ]);
  }
}
