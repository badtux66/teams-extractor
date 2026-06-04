import { ScoringConfig } from '@/platform/config/scoring-config';

/** The nine structured rating categories (1..5 each). */
export interface CategoryRatings {
  security: number;
  staffBehavior: number;
  fairPricing: number;
  crowdQuality: number;
  musicQuality: number;
  soundSystem: number;
  cleanliness: number;
  safetyForWomen: number;
  atmosphere: number;
}

export interface ScoreInputReview {
  ratings: CategoryRatings;
  /** Author reputation score (>= 0). */
  reputation: number;
  /** Review creation time, used for recency decay. */
  createdAt: Date;
}

export interface VenueScoreResult {
  /** Composite score on a 0..100 scale. */
  score: number;
  reviewCount: number;
  categoryAverages: CategoryRatings;
  safetyAdvisory: boolean;
}

const CATEGORY_KEYS: (keyof CategoryRatings)[] = [
  'security',
  'staffBehavior',
  'fairPricing',
  'crowdQuality',
  'musicQuality',
  'soundSystem',
  'cleanliness',
  'safetyForWomen',
  'atmosphere',
];

const DAY_MS = 24 * 60 * 60 * 1000;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Pure domain service implementing the canonical ClubScan scoring algorithm
 * (Phase 3 §11). Deterministic, framework-free, fully unit-testable.
 *
 * - Per-review weight = recency decay × reputation weight
 * - Per-category weighted average across reviews
 * - Composite = Σ categoryWeight × categoryAvg
 * - Bayesian shrinkage toward the global mean for low-volume venues
 * - Scaled to 0..100; safety advisory derived from safety signal + incidents
 */
export class ScoreCalculator {
  constructor(private readonly config: ScoringConfig) {}

  calculate(
    reviews: ScoreInputReview[],
    openIncidentCount = 0,
    now: Date = new Date(),
  ): VenueScoreResult {
    const emptyAverages = this.zeroAverages();

    if (reviews.length === 0) {
      return {
        score: 0,
        reviewCount: 0,
        categoryAverages: emptyAverages,
        safetyAdvisory: openIncidentCount >= this.config.openIncidentThreshold,
      };
    }

    const weights = reviews.map((r) => this.reviewWeight(r, now));
    const totalWeight = weights.reduce((a, b) => a + b, 0) || 1;

    // Weighted per-category averages (1..5).
    const categoryAverages = this.zeroAverages();
    for (const key of CATEGORY_KEYS) {
      let acc = 0;
      reviews.forEach((review, i) => {
        acc += weights[i] * review.ratings[key];
      });
      categoryAverages[key] = round2(acc / totalWeight);
    }

    // Composite (1..5) using configured category weights.
    const cw = this.config.categoryWeights;
    const rawComposite =
      cw.security * categoryAverages.security +
      cw.staffBehavior * categoryAverages.staffBehavior +
      cw.fairPricing * categoryAverages.fairPricing +
      cw.crowdQuality * categoryAverages.crowdQuality +
      cw.musicQuality * categoryAverages.musicQuality +
      cw.soundSystem * categoryAverages.soundSystem +
      cw.cleanliness * categoryAverages.cleanliness +
      cw.safetyForWomen * categoryAverages.safetyForWomen +
      cw.atmosphere * categoryAverages.atmosphere;

    // Bayesian shrinkage toward the global mean using effective sample size.
    const effectiveN = totalWeight;
    const m = this.config.bayesianPriorM;
    const shrunk = (effectiveN * rawComposite + m * this.config.globalMean) / (effectiveN + m);

    // Scale 1..5 -> 0..100.
    const score = round2(((shrunk - 1) / 4) * 100);

    const safetyAdvisory =
      (categoryAverages.safetyForWomen < this.config.safetyAdvisoryMaxAvg &&
        reviews.length >= this.config.safetyAdvisoryMinReviews) ||
      openIncidentCount >= this.config.openIncidentThreshold;

    return {
      score: clamp(score, 0, 100),
      reviewCount: reviews.length,
      categoryAverages,
      safetyAdvisory,
    };
  }

  private reviewWeight(review: ScoreInputReview, now: Date): number {
    const ageDays = Math.max(0, (now.getTime() - review.createdAt.getTime()) / DAY_MS);
    const recency = Math.pow(0.5, ageDays / this.config.halfLifeDays);
    const reputation = clamp(
      1 + Math.log10(1 + Math.max(0, review.reputation)) / this.config.reputationK,
      1,
      this.config.reputationCap,
    );
    return recency * reputation;
  }

  private zeroAverages(): CategoryRatings {
    return {
      security: 0,
      staffBehavior: 0,
      fairPricing: 0,
      crowdQuality: 0,
      musicQuality: 0,
      soundSystem: 0,
      cleanliness: 0,
      safetyForWomen: 0,
      atmosphere: 0,
    };
  }
}
