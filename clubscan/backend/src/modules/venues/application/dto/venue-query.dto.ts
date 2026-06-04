import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { VenueType } from '@prisma/client';

export const VenueQuerySchema = z.object({
  city: z.string().trim().min(1).max(80).optional(),
  type: z.nativeEnum(VenueType).optional(),
  genre: z.string().trim().min(1).max(40).optional(),
  q: z.string().trim().min(1).max(80).optional(),
  near: z
    .string()
    .regex(/^-?\d{1,3}(\.\d+)?,-?\d{1,3}(\.\d+)?$/, 'near must be "lat,lng"')
    .optional(),
  radiusKm: z.coerce.number().min(0.1).max(50).default(10),
  sort: z.enum(['score', 'recent', 'distance']).default('score'),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});
export class VenueQueryDto extends createZodDto(VenueQuerySchema) {}
