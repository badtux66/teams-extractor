import { DomainEvent } from '@/shared/domain/domain-event';

interface ReviewEventPayload {
  reviewId: string;
  venueId: string;
  authorId: string;
}

export class ReviewPublishedEvent extends DomainEvent<ReviewEventPayload> {
  readonly name = 'review.published';
  constructor(readonly payload: ReviewEventPayload) {
    super();
  }
}

export class ReviewEditedEvent extends DomainEvent<ReviewEventPayload> {
  readonly name = 'review.edited';
  constructor(readonly payload: ReviewEventPayload) {
    super();
  }
}

export class ReviewRemovedEvent extends DomainEvent<ReviewEventPayload> {
  readonly name = 'review.removed';
  constructor(readonly payload: ReviewEventPayload) {
    super();
  }
}
