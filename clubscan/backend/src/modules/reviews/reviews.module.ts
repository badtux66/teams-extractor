import { Module } from '@nestjs/common';
import { ReviewsService } from './application/reviews.service';
import { CONTENT_MODERATION } from './application/ports/content-moderation.port';
import { RuleBasedModerationAdapter } from './infrastructure/rule-based-moderation.adapter';
import { ReviewsController } from './presentation/reviews.controller';

@Module({
  controllers: [ReviewsController],
  providers: [
    ReviewsService,
    { provide: CONTENT_MODERATION, useClass: RuleBasedModerationAdapter },
  ],
})
export class ReviewsModule {}
