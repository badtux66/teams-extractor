import { Module } from '@nestjs/common';
import { ModerationService } from './application/moderation.service';
import { ModerationController } from './presentation/moderation.controller';

@Module({
  controllers: [ModerationController],
  providers: [ModerationService],
})
export class ModerationModule {}
