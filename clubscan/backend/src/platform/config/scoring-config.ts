/**
 * Default ClubScan scoring configuration (Phase 1 §4.2 / Phase 3 §11).
 * These values are seeded into the `app_config` table and are tunable at
 * runtime without a deploy. The ScoreCalculator domain service reads them.
 */
export interface ScoringConfig {
  /** Category weights — must sum to 1.0. Safety-for-women & security are elevated. */
  categoryWeights: {
    security: number;
    staffBehavior: number;
    fairPricing: number;
    crowdQuality: number;
    musicQuality: number;
    soundSystem: number;
    cleanliness: number;
    safetyForWomen: number;
    atmosphere: number;
  };
  /** Recency decay half-life in days. */
  halfLifeDays: number;
  /** Bayesian prior strength (pseudo-reviews pulling toward the global mean). */
  bayesianPriorM: number;
  /** Assumed global mean rating (1..5) used as the Bayesian prior. */
  globalMean: number;
  /** Reputation weighting log divisor and cap. */
  reputationK: number;
  reputationCap: number;
  /** Safety advisory thresholds. */
  safetyAdvisoryMaxAvg: number;
  safetyAdvisoryMinReviews: number;
  openIncidentThreshold: number;
}

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  categoryWeights: {
    safetyForWomen: 0.18,
    security: 0.16,
    staffBehavior: 0.12,
    crowdQuality: 0.1,
    fairPricing: 0.1,
    cleanliness: 0.1,
    musicQuality: 0.1,
    soundSystem: 0.08,
    atmosphere: 0.06,
  },
  halfLifeDays: 180,
  bayesianPriorM: 8,
  globalMean: 3.5,
  reputationK: 3,
  reputationCap: 2.0,
  safetyAdvisoryMaxAvg: 2.5,
  safetyAdvisoryMinReviews: 5,
  openIncidentThreshold: 3,
};
