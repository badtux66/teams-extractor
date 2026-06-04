export const CONTENT_MODERATION = Symbol('CONTENT_MODERATION');

export interface ModerationVerdict {
  /** APPROVED -> publish; FLAGGED -> hold for human review. */
  decision: 'APPROVED' | 'FLAGGED';
  scores?: Record<string, number>;
  labels?: string[];
  provider: string;
}

/**
 * Pluggable content moderation (Phase 1 §15, Phase 3 §2). v1 ships a
 * deterministic rule-based adapter; an AI provider adapter can be swapped in
 * behind this port without changing the review use case.
 */
export interface ContentModerationPort {
  moderateText(text: string): Promise<ModerationVerdict>;
}
