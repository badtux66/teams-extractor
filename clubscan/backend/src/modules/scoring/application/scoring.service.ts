import { Injectable, Logger } from '@nestjs/common';
import { Prisma, ReviewStatus, UserStatus } from '@prisma/client';
import { PrismaService } from '@/platform/prisma/prisma.service';
import { AppConfigService } from '@/platform/config/app-config.service';
import { ScoreCalculator, ScoreInputReview } from '../domain/score-calculator';

/**
 * Recomputes and persists the VenueScore CQRS read model from the write-side
 * reviews. Only PUBLISHED reviews by non-shadow-banned, active authors are
 * included (Phase 3 §11). Idempotent and safe to call repeatedly.
 */
@Injectable()
export class ScoringService {
  private readonly logger = new Logger(ScoringService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly appConfig: AppConfigService,
  ) {}

  async recomputeVenue(venueId: string): Promise<void> {
    const reviews = await this.prisma.review.findMany({
      where: {
        venueId,
        status: ReviewStatus.PUBLISHED,
        deletedAt: null,
        user: { status: { notIn: [UserStatus.SHADOW_BANNED, UserStatus.BANNED, UserStatus.DELETED] } },
      },
      select: {
        createdAt: true,
        rating: true,
        user: { select: { reputationScore: true } },
      },
    });

    const openIncidentCount = await this.prisma.incidentReport.count({
      where: { venueId, state: { notIn: ['DISMISSED', 'CLOSED'] } },
    });

    const inputs: ScoreInputReview[] = reviews
      .filter((r) => r.rating)
      .map((r) => ({
        reputation: r.user.reputationScore,
        createdAt: r.createdAt,
        ratings: {
          security: r.rating!.security,
          staffBehavior: r.rating!.staffBehavior,
          fairPricing: r.rating!.fairPricing,
          crowdQuality: r.rating!.crowdQuality,
          musicQuality: r.rating!.musicQuality,
          soundSystem: r.rating!.soundSystem,
          cleanliness: r.rating!.cleanliness,
          safetyForWomen: r.rating!.safetyForWomen,
          atmosphere: r.rating!.atmosphere,
        },
      }));

    const calculator = new ScoreCalculator(this.appConfig.getScoringConfig());
    const result = calculator.calculate(inputs, openIncidentCount);
    const avg = result.categoryAverages;

    const data: Prisma.VenueScoreUncheckedCreateInput = {
      venueId,
      score: new Prisma.Decimal(result.score),
      reviewCount: result.reviewCount,
      avgSecurity: new Prisma.Decimal(avg.security),
      avgStaffBehavior: new Prisma.Decimal(avg.staffBehavior),
      avgFairPricing: new Prisma.Decimal(avg.fairPricing),
      avgCrowdQuality: new Prisma.Decimal(avg.crowdQuality),
      avgMusicQuality: new Prisma.Decimal(avg.musicQuality),
      avgSoundSystem: new Prisma.Decimal(avg.soundSystem),
      avgCleanliness: new Prisma.Decimal(avg.cleanliness),
      avgSafetyForWomen: new Prisma.Decimal(avg.safetyForWomen),
      avgAtmosphere: new Prisma.Decimal(avg.atmosphere),
      safetyAdvisory: result.safetyAdvisory,
      lastComputedAt: new Date(),
    };

    await this.prisma.venueScore.upsert({
      where: { venueId },
      create: data,
      update: data,
    });

    this.logger.debug(`Recomputed score for venue ${venueId}: ${result.score}`);
  }
}
