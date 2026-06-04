import { Injectable } from '@nestjs/common';
import {
  ContentModerationPort,
  ModerationVerdict,
} from '../application/ports/content-moderation.port';

/**
 * Deterministic, dependency-free moderation baseline: flags content with
 * banned terms, excessive links, or shouting. Provides defense-in-depth and a
 * working default until an AI provider adapter is configured.
 */
@Injectable()
export class RuleBasedModerationAdapter implements ContentModerationPort {
  private readonly bannedTerms = [
    // Minimal illustrative list; real list is config-driven and localized.
    'kill yourself',
    'kys',
  ];

  async moderateText(text: string): Promise<ModerationVerdict> {
    const lower = text.toLowerCase();
    const labels: string[] = [];

    if (this.bannedTerms.some((t) => lower.includes(t))) labels.push('harassment');

    const linkCount = (text.match(/https?:\/\//g) ?? []).length;
    if (linkCount > 2) labels.push('spam');

    const letters = text.replace(/[^a-zA-Z]/g, '');
    const upper = text.replace(/[^A-Z]/g, '');
    if (letters.length > 20 && upper.length / letters.length > 0.7) labels.push('shouting');

    return {
      decision: labels.includes('harassment') || labels.includes('spam') ? 'FLAGGED' : 'APPROVED',
      labels,
      provider: 'rule-based-v1',
    };
  }
}
