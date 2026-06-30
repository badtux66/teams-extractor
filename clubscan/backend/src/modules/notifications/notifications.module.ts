import { Module } from '@nestjs/common';
import { NotificationsService } from './application/notifications.service';
import { FeedService } from './application/feed.service';
import { NotificationsReactor } from './application/notifications.reactor';
import { PUSH_GATEWAY } from './application/ports/push.port';
import { FcmPushAdapter } from './infrastructure/fcm-push.adapter';
import { NotificationsController } from './presentation/notifications.controller';

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    FeedService,
    NotificationsReactor,
    { provide: PUSH_GATEWAY, useClass: FcmPushAdapter },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
