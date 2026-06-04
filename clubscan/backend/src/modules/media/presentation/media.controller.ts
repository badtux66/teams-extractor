import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '@/platform/security/decorators';
import { MediaService } from '../application/media.service';
import { PresignDto } from '../application/dto/media.dto';

@ApiTags('media')
@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Throttle({ default: { limit: 30, ttl: 60 * 60 * 1000 } })
  @Post('presign')
  presign(@CurrentUser('id') userId: string, @Body() dto: PresignDto) {
    return this.media.presign(userId, dto);
  }

  @Post(':assetId/complete')
  complete(@CurrentUser('id') userId: string, @Param('assetId') assetId: string) {
    return this.media.complete(userId, assetId);
  }
}
