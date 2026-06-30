import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { IncidentCategory, IncidentSeverity, IncidentState } from '@prisma/client';

export const CreateIncidentSchema = z.object({
  category: z.nativeEnum(IncidentCategory),
  severity: z.nativeEnum(IncidentSeverity).default(IncidentSeverity.MEDIUM),
  venueId: z.string().uuid().optional(),
  description: z.string().trim().min(10).max(4000),
  occurredAt: z.coerce.date().optional(),
  isAnonymous: z.boolean().default(false),
});
export class CreateIncidentDto extends createZodDto(CreateIncidentSchema) {}

export const TransitionIncidentSchema = z.object({
  state: z.nativeEnum(IncidentState),
  outcome: z.string().trim().max(2000).optional(),
});
export class TransitionIncidentDto extends createZodDto(TransitionIncidentSchema) {}
