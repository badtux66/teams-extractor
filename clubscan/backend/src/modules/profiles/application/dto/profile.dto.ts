import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { SocialPlatform } from '@prisma/client';

export const UpdateProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(50).optional(),
  bio: z.string().trim().max(280).optional(),
  avatarUrl: z.string().url().optional(),
  isPrivate: z.boolean().optional(),
  socialLinks: z
    .array(
      z.object({
        platform: z.nativeEnum(SocialPlatform),
        url: z.string().url().max(300),
      }),
    )
    .max(8)
    .optional(),
});
export class UpdateProfileDto extends createZodDto(UpdateProfileSchema) {}
