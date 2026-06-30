import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/platform/prisma/prisma.service';
import { buildPage, clampLimit, decodeCursor } from '@/platform/pagination/cursor';
import { newId } from '@/shared/ids/uuid';

/**
 * Activity feed read model (Phase 2 §3.7). Fan-out-on-write: when an actor does
 * something, an entry is written to each follower's feed. Simple and fast to
 * read; swap to fan-out-on-read for celebrity accounts later if needed.
 */
@Injectable()
export class FeedService {
  constructor(private readonly prisma: PrismaService) {}

  async fanOut(params: {
    actorId: string;
    verb: string;
    objectType: string;
    objectId: string;
    includeActor?: boolean;
  }): Promise<void> {
    const followers = await this.prisma.follow.findMany({
      where: { followingId: params.actorId },
      select: { followerId: true },
    });

    const ownerIds = followers.map((f) => f.followerId);
    if (params.includeActor) ownerIds.push(params.actorId);
    if (ownerIds.length === 0) return;

    await this.prisma.feedEntry.createMany({
      data: ownerIds.map((ownerId) => ({
        id: newId(),
        ownerId,
        actorId: params.actorId,
        verb: params.verb,
        objectType: params.objectType,
        objectId: params.objectId,
      })),
      skipDuplicates: true,
    });
  }

  async list(userId: string, cursor?: string, limit?: number) {
    const take = clampLimit(limit);
    const decoded = decodeCursor(cursor);
    const rows = await this.prisma.feedEntry.findMany({
      where: {
        ownerId: userId,
        ...(decoded ? { createdAt: { lt: new Date(decoded.createdAt) } } : {}),
      },
      include: {
        actor: { select: { id: true, profile: { select: { username: true, avatarUrl: true } } } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
    });
    return buildPage(rows, take);
  }
}
