import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import {
  ModerationState,
  ReportReason,
  ReportTargetType,
  SanctionType,
} from '@prisma/client';

export const CreateReportSchema = z.object({
  targetType: z.nativeEnum(ReportTargetType),
  targetId: z.string().uuid(),
  reason: z.nativeEnum(ReportReason),
  details: z.string().trim().max(1000).optional(),
});
export class CreateReportDto extends createZodDto(CreateReportSchema) {}

export const UpdateCaseSchema = z.object({
  state: z.nativeEnum(ModerationState).optional(),
  resolution: z.string().trim().max(1000).optional(),
  assignToSelf: z.boolean().optional(),
});
export class UpdateCaseDto extends createZodDto(UpdateCaseSchema) {}

export const SanctionSchema = z.object({
  type: z.nativeEnum(SanctionType),
  reason: z.string().trim().min(3).max(500),
  expiresAt: z.coerce.date().optional(),
});
export class SanctionDto extends createZodDto(SanctionSchema) {}
