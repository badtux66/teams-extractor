import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '@/platform/prisma/prisma.service';
import { ReviewPublishedEvent } from '@/modules/reviews/domain/review.events';
import { UserFollowedEvent } from '@/modules/profiles/domain/profile.events';
import { NotificationsService } from './notifications.service';
import { FeedService } from './feed.service';

/**
 * Translates domain events into feed entries + notifications + push
 * (Phase 1 §5.2 reactors). Runs async off the write path.
 */
@Injectable()
export class NotificationsReactor {
  private readonly logger = new Logger(NotificationsReactor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly feed: FeedService,
  ) {}

  @OnEvent('review.published')
  async onReviewPublished(event: ReviewPublishedEvent): Promise<void> {
    try {
      await this.feed.fanOut({
        actorId: event.payload.authorId,
        verb: 'reviewed',
        objectType: 'venue',
        objectId: event.payload.venueId,
        includeActor: true,
      });
    } catch (err) {
      this.logger.error(`Feed fan-out failed: ${(err as Error).message}`);
    }
  }

  @OnEvent('user.followed')
  async onUserFollowed(event: UserFollowedEvent): Promise<void> {
    const followerProfile = await this.prisma.profile.findUnique({
      where: { userId: event.payload.followerId },
      select: { username: true },
    });
    await this.notifications.create({
      userId: event.payload.followingId,
      type: NotificationType.NEW_FOLLOWER,
      payload: { followerId: event.payload.followerId, username: followerProfile?.username },
      push: {
        title: 'New follower',
        body: `@${followerProfile?.username ?? 'someone'} started following you`,
      },
    });
  }
}
