import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MediaStatus } from '@prisma/client';
import { PrismaService } from '@/platform/prisma/prisma.service';
import { DomainError } from '@/shared/errors/domain-error';
import { newId } from '@/shared/ids/uuid';
import { STORAGE, StoragePort } from './ports/storage.port';
import { ALLOWED_MIME_TYPES, MAX_UPLOAD_SIZE, PresignDto } from './dto/media.dto';

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(STORAGE) private readonly storage: StoragePort,
  ) {}

  async presign(userId: string, dto: PresignDto) {
    const assetId = newId();
    const ext = dto.mime.split('/')[1];
    const key = `uploads/${userId}/${assetId}.${ext}`;

    const { uploadUrl } = await this.storage.presignUpload({
      key,
      mime: dto.mime,
      maxSize: MAX_UPLOAD_SIZE,
    });

    await this.prisma.mediaAsset.create({
      data: {
        id: assetId,
        ownerId: userId,
        bucket: this.config.get<string>('S3_BUCKET', 'clubscan-media'),
        key,
        mime: dto.mime,
        size: dto.size,
        status: MediaStatus.PENDING,
      },
    });

    return { assetId, uploadUrl, key };
  }

  /** Finalizes an upload after the client PUT, validating the object server-side. */
  async complete(userId: string, assetId: string) {
    const asset = await this.prisma.mediaAsset.findFirst({
      where: { id: assetId, ownerId: userId },
    });
    if (!asset) throw DomainError.notFound('Media asset', assetId);

    const head = await this.storage.headObject(asset.key);
    if (!head) throw DomainError.validation('Upload not found in storage');
    if (!ALLOWED_MIME_TYPES.includes(head.mime as (typeof ALLOWED_MIME_TYPES)[number])) {
      throw DomainError.validation('Unsupported media type');
    }
    if (head.size > MAX_UPLOAD_SIZE) {
      throw DomainError.validation('Uploaded file exceeds size limit');
    }

    const updated = await this.prisma.mediaAsset.update({
      where: { id: assetId },
      data: { status: MediaStatus.READY, size: head.size, mime: head.mime },
    });
    return { id: updated.id, status: updated.status, url: this.storage.publicUrl(updated.key) };
  }
}
