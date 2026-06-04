import { Inject, Injectable } from '@nestjs/common';
import {
  MediaStatus,
  ModerationStatus,
  Prisma,
  ReviewStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '@/platform/prisma/prisma.service';
import { EVENT_BUS, EventBusPort } from '@/platform/event-bus/event-bus.port';
import {
  buildPage,
  clampLimit,
  decodeCursor,
  Paginated,
} from '@/platform/pagination/cursor';
import { DomainError } from '@/shared/errors/domain-error';
import { newId } from '@/shared/ids/uuid';
import { AuthenticatedUser } from '@/platform/security/auth.types';
import {
  CONTENT_MODERATION,
  ContentModerationPort,
} from './ports/content-moderation.port';
import { CreateReviewDto, UpdateReviewDto } from './dto/review.dto';
import {
  ReviewEditedEvent,
  ReviewPublishedEvent,
  ReviewRemovedEvent,
} from '../domain/review.events';

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CONTENT_MODERATION) private readonly moderation: ContentModerationPort,
    @Inject(EVENT_BUS) private readonly bus: EventBusPort,
  ) {}

  async create(userId: string, venueId: string, dto: CreateReviewDto) {
    const venue = await this.prisma.venue.findFirst({
      where: { id: venueId, deletedAt: null },
      select: { id: true },
    });
    if (!venue) throw DomainError.notFound('Venue', venueId);

    const existing = await this.prisma.review.findUnique({
      where: { userId_venueId: { userId, venueId } },
      select: { id: true },
    });
    if (existing) {
      throw DomainError.conflict('You have already reviewed this venue');
    }

    const photoUrls = await this.resolveOwnedPhotos(userId, dto.photoAssetIds);
    const verdict = await this.moderation.moderateText(dto.body);
    const published = verdict.decision === 'APPROVED';

    const reviewId = newId();
    await this.prisma.review.create({
      data: {
        id: reviewId,
        userId,
        venueId,
        body: dto.body,
        status: published ? ReviewStatus.PUBLISHED : ReviewStatus.HELD,
        moderationStatus: published ? ModerationStatus.APPROVED : ModerationStatus.FLAGGED,
        rating: { create: { ...dto.ratings } },
        photos: {
          create: photoUrls.map((url, i) => ({ id: newId(), url, position: i })),
        },
      },
    });

    if (published) {
      await this.bus.publish(new ReviewPublishedEvent({ reviewId, venueId, authorId: userId }));
    }

    return this.getById(reviewId);
  }

  async update(user: AuthenticatedUser, reviewId: string, dto: UpdateReviewDto) {
    const review = await this.prisma.review.findFirst({
      where: { id: reviewId, deletedAt: null },
      include: { rating: true },
    });
    if (!review) throw DomainError.notFound('Review', reviewId);
    if (review.userId !== user.id && this.rank(user.role) < this.rank(UserRole.MODERATOR)) {
      throw DomainError.forbidden('You cannot edit this review');
    }

    // Snapshot prior state into immutable edit history.
    await this.prisma.reviewEdit.create({
      data: {
        id: newId(),
        reviewId,
        bodySnapshot: review.body,
        ratingSnapshot: (review.rating ?? {}) as unknown as Prisma.InputJsonValue,
      },
    });

    const verdict = dto.body ? await this.moderation.moderateText(dto.body) : null;
    const published = verdict ? verdict.decision === 'APPROVED' : review.status === ReviewStatus.PUBLISHED;

    await this.prisma.review.update({
      where: { id: reviewId },
      data: {
        ...(dto.body ? { body: dto.body } : {}),
        ...(verdict
          ? {
              status: published ? ReviewStatus.PUBLISHED : ReviewStatus.HELD,
              moderationStatus: published ? ModerationStatus.APPROVED : ModerationStatus.FLAGGED,
            }
          : {}),
        ...(dto.ratings ? { rating: { update: { ...dto.ratings } } } : {}),
      },
    });

    await this.bus.publish(
      new ReviewEditedEvent({ reviewId, venueId: review.venueId, authorId: review.userId }),
    );
    return this.getById(reviewId);
  }

  async remove(user: AuthenticatedUser, reviewId: string) {
    const review = await this.prisma.review.findFirst({
      where: { id: reviewId, deletedAt: null },
      select: { id: true, userId: true, venueId: true },
    });
    if (!review) throw DomainError.notFound('Review', reviewId);
    const isModerator = this.rank(user.role) >= this.rank(UserRole.MODERATOR);
    if (review.userId !== user.id && !isModerator) {
      throw DomainError.forbidden('You cannot delete this review');
    }

    await this.prisma.review.update({
      where: { id: reviewId },
      data: {
        deletedAt: new Date(),
        status: ReviewStatus.REMOVED,
      },
    });
    await this.bus.publish(
      new ReviewRemovedEvent({ reviewId, venueId: review.venueId, authorId: review.userId }),
    );
    return { ok: true };
  }

  async markHelpful(userId: string, reviewId: string, helpful: boolean) {
    const review = await this.prisma.review.findFirst({
      where: { id: reviewId, deletedAt: null },
      select: { id: true },
    });
    if (!review) throw DomainError.notFound('Review', reviewId);

    if (helpful) {
      await this.prisma.$transaction(async (tx) => {
        const created = await tx.reviewHelpful
          .create({ data: { id: newId(), reviewId, userId } })
          .catch(() => null);
        if (created) {
          await tx.review.update({
            where: { id: reviewId },
            data: { helpfulCount: { increment: 1 } },
          });
        }
      });
    } else {
      await this.prisma.$transaction(async (tx) => {
        const deleted = await tx.reviewHelpful
          .delete({ where: { reviewId_userId: { reviewId, userId } } })
          .catch(() => null);
        if (deleted) {
          await tx.review.update({
            where: { id: reviewId },
            data: { helpfulCount: { decrement: 1 } },
          });
        }
      });
    }
    return { ok: true };
  }

  async listForVenue(
    venueId: string,
    sort: 'recent' | 'helpful',
    cursor?: string,
    limit?: number,
  ): Promise<Paginated<unknown>> {
    const take = clampLimit(limit);
    const decoded = decodeCursor(cursor);

    const rows = await this.prisma.review.findMany({
      where: {
        venueId,
        status: ReviewStatus.PUBLISHED,
        deletedAt: null,
        ...(decoded
          ? {
              OR: [
                { createdAt: { lt: new Date(decoded.createdAt) } },
                { createdAt: new Date(decoded.createdAt), id: { lt: decoded.id } },
              ],
            }
          : {}),
      },
      include: {
        rating: true,
        photos: { orderBy: { position: 'asc' } },
        user: { select: { id: true, profile: { select: { username: true, avatarUrl: true } } } },
      },
      orderBy:
        sort === 'helpful'
          ? [{ helpfulCount: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }]
          : [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
    });

    return buildPage(rows, take);
  }

  async getById(reviewId: string) {
    const review = await this.prisma.review.findFirst({
      where: { id: reviewId, deletedAt: null },
      include: {
        rating: true,
        photos: { orderBy: { position: 'asc' } },
        user: { select: { id: true, profile: { select: { username: true, avatarUrl: true } } } },
      },
    });
    if (!review) throw DomainError.notFound('Review', reviewId);
    return review;
  }

  private async resolveOwnedPhotos(userId: string, assetIds?: string[]): Promise<string[]> {
    if (!assetIds || assetIds.length === 0) return [];
    const assets = await this.prisma.mediaAsset.findMany({
      where: { id: { in: assetIds }, ownerId: userId, status: MediaStatus.READY },
    });
    if (assets.length !== assetIds.length) {
      throw DomainError.validation('One or more photo assets are invalid or not ready');
    }
    // Preserve caller-provided order.
    const byId = new Map(assets.map((a) => [a.id, a]));
    return assetIds.map((id) => {
      const a = byId.get(id)!;
      return `${a.bucket}/${a.key}`;
    });
  }

  private rank(role: UserRole): number {
    return { USER: 0, MODERATOR: 1, ADMIN: 2, SUPER_ADMIN: 3 }[role];
  }
}
