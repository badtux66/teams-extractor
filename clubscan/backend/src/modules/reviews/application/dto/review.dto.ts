import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const rating = z.number().int().min(1).max(5);

export const ReviewRatingsSchema = z.object({
  security: rating,
  staffBehavior: rating,
  fairPricing: rating,
  crowdQuality: rating,
  musicQuality: rating,
  soundSystem: rating,
  cleanliness: rating,
  safetyForWomen: rating,
  atmosphere: rating,
});

export const CreateReviewSchema = z.object({
  ratings: ReviewRatingsSchema,
  body: z.string().trim().min(10).max(4000),
  photoAssetIds: z.array(z.string().uuid()).max(8).optional(),
});
export class CreateReviewDto extends createZodDto(CreateReviewSchema) {}

export const UpdateReviewSchema = z.object({
  ratings: ReviewRatingsSchema.optional(),
  body: z.string().trim().min(10).max(4000).optional(),
});
export class UpdateReviewDto extends createZodDto(UpdateReviewSchema) {}
