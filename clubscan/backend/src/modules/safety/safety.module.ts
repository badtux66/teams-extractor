import { Module } from '@nestjs/common';
import { SafetyService } from './application/safety.service';
import { SafetyController } from './presentation/safety.controller';

@Module({
  controllers: [SafetyController],
  providers: [SafetyService],
})
export class SafetyModule {}
