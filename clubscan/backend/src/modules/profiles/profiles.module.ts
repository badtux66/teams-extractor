import { Module } from '@nestjs/common';
import { ProfilesService } from './application/profiles.service';
import { ReputationService } from './application/reputation.service';
import { ReputationReactor } from './application/reputation.reactor';
import { ProfilesController } from './presentation/profiles.controller';

@Module({
  controllers: [ProfilesController],
  providers: [ProfilesService, ReputationService, ReputationReactor],
  exports: [ReputationService],
})
export class ProfilesModule {}
