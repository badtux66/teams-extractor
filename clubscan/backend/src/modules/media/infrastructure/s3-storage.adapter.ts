import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PresignedUpload, StoragePort } from '../application/ports/storage.port';

const UPLOAD_TTL_SECONDS = 300;

/**
 * S3-compatible storage adapter (works with AWS S3 and MinIO in dev).
 * Issues presigned PUT URLs; the backend never streams file bytes (Phase 6 §5).
 */
@Injectable()
export class S3StorageAdapter implements StoragePort {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly endpoint?: string;

  constructor(private readonly config: ConfigService) {
    this.bucket = config.get<string>('S3_BUCKET', 'clubscan-media');
    this.endpoint = config.get<string>('S3_ENDPOINT');
    this.client = new S3Client({
      region: config.get<string>('S3_REGION', 'us-east-1'),
      endpoint: this.endpoint,
      forcePathStyle: !!this.endpoint, // MinIO requires path-style
      credentials:
        config.get<string>('S3_ACCESS_KEY') && config.get<string>('S3_SECRET_KEY')
          ? {
              accessKeyId: config.getOrThrow<string>('S3_ACCESS_KEY'),
              secretAccessKey: config.getOrThrow<string>('S3_SECRET_KEY'),
            }
          : undefined,
    });
  }

  async presignUpload(params: { key: string; mime: string; size: number }): Promise<PresignedUpload> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: params.key,
      ContentType: params.mime,
      ContentLength: params.size,
    });
    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn: UPLOAD_TTL_SECONDS });
    return { uploadUrl, key: params.key };
  }

  async headObject(key: string): Promise<{ size: number; mime: string } | null> {
    try {
      const res = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return { size: res.ContentLength ?? 0, mime: res.ContentType ?? 'application/octet-stream' };
    } catch {
      return null;
    }
  }

  publicUrl(key: string): string {
    if (this.endpoint) return `${this.endpoint}/${this.bucket}/${key}`;
    return `https://${this.bucket}.s3.amazonaws.com/${key}`;
  }

  /** Issues a short-lived signed read URL (used for private media via CDN). */
  signedReadUrl(key: string): Promise<string> {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn: 3600,
    });
  }
}
