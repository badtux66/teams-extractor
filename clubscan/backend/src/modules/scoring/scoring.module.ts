import { Module } from '@nestjs/common';
import { ScoringService } from './application/scoring.service';
import { ScoringReactor } from './application/scoring.reactor';

@Module({
  providers: [ScoringService, ScoringReactor],
  exports: [ScoringService],
})
export class ScoringModule {}
