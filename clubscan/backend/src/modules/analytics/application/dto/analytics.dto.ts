import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// Known event types (Phase 1 §11). Extensible; unknown types are rejected to
// keep the analytics stream clean.
export const AnalyticsEventType = z.enum([
  'venue_viewed',
  'event_viewed',
  'review_card_clicked',
  'review_helpful_marked',
  'search_performed',
  'session_started',
]);

export const IngestSchema = z.object({
  events: z
    .array(
      z.object({
        type: AnalyticsEventType,
        properties: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
        occurredAt: z.coerce.date().optional(),
        sessionId: z.string().max(64).optional(),
      }),
    )
    .min(1)
    .max(50),
});
export class IngestDto extends createZodDto(IngestSchema) {}
