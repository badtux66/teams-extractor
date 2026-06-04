import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const EventQuerySchema = z.object({
  city: z.string().trim().min(1).max(80).optional(),
  genre: z.string().trim().min(1).max(40).optional(),
  q: z.string().trim().min(1).max(80).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});
export class EventQueryDto extends createZodDto(EventQuerySchema) {}
