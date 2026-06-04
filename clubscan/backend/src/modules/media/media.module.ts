import { Module } from '@nestjs/common';
import { MediaService } from './application/media.service';
import { STORAGE } from './application/ports/storage.port';
import { S3StorageAdapter } from './infrastructure/s3-storage.adapter';
import { MediaController } from './presentation/media.controller';

@Module({
  controllers: [MediaController],
  providers: [MediaService, { provide: STORAGE, useClass: S3StorageAdapter }],
  exports: [STORAGE],
})
export class MediaModule {}
