import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ReviewPublishedEvent } from '@/modules/reviews/domain/review.events';
import { UserFollowedEvent } from '../domain/profile.events';
import { REPUTATION_RULES, ReputationService } from './reputation.service';

/** Translates domain events into reputation adjustments (Phase 1 §5.2). */
@Injectable()
export class ReputationReactor {
  constructor(private readonly reputation: ReputationService) {}

  @OnEvent('review.published')
  async onReviewPublished(event: ReviewPublishedEvent): Promise<void> {
    await this.reputation.adjust(
      event.payload.authorId,
      REPUTATION_RULES.REVIEW_PUBLISHED,
      'review.published',
    );
  }

  @OnEvent('user.followed')
  async onUserFollowed(event: UserFollowedEvent): Promise<void> {
    await this.reputation.adjust(
      event.payload.followingId,
      REPUTATION_RULES.GAINED_FOLLOWER,
      'gained.follower',
    );
  }
}
