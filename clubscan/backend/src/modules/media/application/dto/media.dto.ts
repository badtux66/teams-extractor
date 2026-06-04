import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'] as const;
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export const PresignSchema = z.object({
  mime: z.enum(ALLOWED_MIME),
  size: z.number().int().positive().max(MAX_SIZE),
});
export class PresignDto extends createZodDto(PresignSchema) {}

export const ALLOWED_MIME_TYPES = ALLOWED_MIME;
export const MAX_UPLOAD_SIZE = MAX_SIZE;
