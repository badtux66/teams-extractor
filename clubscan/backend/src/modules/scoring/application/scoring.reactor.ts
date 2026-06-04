import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  ReviewEditedEvent,
  ReviewPublishedEvent,
  ReviewRemovedEvent,
} from '@/modules/reviews/domain/review.events';
import { ScoringService } from './scoring.service';

/**
 * Reacts to review lifecycle events to recompute the affected venue's score
 * read model asynchronously (eventual consistency — Phase 1 §5.2).
 */
@Injectable()
export class ScoringReactor {
  private readonly logger = new Logger(ScoringReactor.name);

  constructor(private readonly scoring: ScoringService) {}

  @OnEvent('review.published')
  @OnEvent('review.edited')
  @OnEvent('review.removed')
  async onReviewChanged(
    event: ReviewPublishedEvent | ReviewEditedEvent | ReviewRemovedEvent,
  ): Promise<void> {
    try {
      await this.scoring.recomputeVenue(event.payload.venueId);
    } catch (err) {
      this.logger.error(
        `Failed to recompute score for venue ${event.payload.venueId}: ${(err as Error).message}`,
      );
    }
  }
}
