import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { DevicePlatform } from '@prisma/client';

export const RegisterDeviceSchema = z.object({
  platform: z.nativeEnum(DevicePlatform),
  pushToken: z.string().min(10).max(512),
  name: z.string().max(80).optional(),
});
export class RegisterDeviceDto extends createZodDto(RegisterDeviceSchema) {}
