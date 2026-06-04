import { DomainEvent } from '@/shared/domain/domain-event';

export class UserFollowedEvent extends DomainEvent<{ followerId: string; followingId: string }> {
  readonly name = 'user.followed';
  constructor(readonly payload: { followerId: string; followingId: string }) {
    super();
  }
}
