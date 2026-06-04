import { describe, expect, it } from 'vitest';
import { DEFAULT_SCORING_CONFIG } from '@/platform/config/scoring-config';
import { CategoryRatings, ScoreCalculator, ScoreInputReview } from './score-calculator';

const calc = new ScoreCalculator(DEFAULT_SCORING_CONFIG);

function ratings(value: number): CategoryRatings {
  return {
    security: value,
    staffBehavior: value,
    fairPricing: value,
    crowdQuality: value,
    musicQuality: value,
    soundSystem: value,
    cleanliness: value,
    safetyForWomen: value,
    atmosphere: value,
  };
}

function review(value: number, overrides: Partial<ScoreInputReview> = {}): ScoreInputReview {
  return {
    ratings: ratings(value),
    reputation: 0,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('ScoreCalculator', () => {
  const now = new Date('2026-06-04T00:00:00Z');

  it('returns 0 with no reviews', () => {
    const result = calc.calculate([], 0, now);
    expect(result.score).toBe(0);
    expect(result.reviewCount).toBe(0);
  });

  it('shrinks a single perfect review toward the global mean', () => {
    const result = calc.calculate([review(5, { createdAt: now })], 0, now);
    // A lone 5/5 must not yield 100 due to Bayesian shrinkage.
    expect(result.score).toBeLessThan(100);
    expect(result.score).toBeGreaterThan(50);
  });

  it('approaches the true mean as review volume grows', () => {
    const many = Array.from({ length: 200 }, () => review(5, { createdAt: now }));
    const result = calc.calculate(many, 0, now);
    expect(result.score).toBeGreaterThan(95);
  });

  it('weights recent reviews more than old ones', () => {
    const old = review(1, { createdAt: new Date('2024-01-01T00:00:00Z') });
    const fresh = review(5, { createdAt: now });
    const result = calc.calculate([old, fresh], 0, now);
    // Fresh 5 should dominate the decayed old 1.
    expect(result.categoryAverages.security).toBeGreaterThan(3.5);
  });

  it('weights higher-reputation reviewers more', () => {
    const lowRep = review(1, { reputation: 0, createdAt: now });
    const highRep = review(5, { reputation: 100000, createdAt: now });
    const result = calc.calculate([lowRep, highRep], 0, now);
    expect(result.categoryAverages.security).toBeGreaterThan(3);
  });

  it('raises a safety advisory when safety-for-women is low with enough reviews', () => {
    const reviews = Array.from({ length: 6 }, () =>
      review(4, {
        createdAt: now,
        ratings: { ...ratings(4), safetyForWomen: 2 },
      }),
    );
    const result = calc.calculate(reviews, 0, now);
    expect(result.safetyAdvisory).toBe(true);
  });

  it('raises a safety advisory when open incidents exceed the threshold', () => {
    const result = calc.calculate([review(5, { createdAt: now })], 3, now);
    expect(result.safetyAdvisory).toBe(true);
  });
});
