import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ContentModerationPort,
  ModerationVerdict,
} from '../application/ports/content-moderation.port';
import { DomainError } from '@/shared/errors/domain-error';

@Injectable()
export class GeminiModerationAdapter implements ContentModerationPort {
  private readonly logger = new Logger(GeminiModerationAdapter.name);
  private readonly apiKey: string | undefined;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('GEMINI_API_KEY');
  }

  async moderateText(text: string): Promise<ModerationVerdict> {
    if (!this.apiKey) {
      // Fallback if not configured
      this.logger.warn('GEMINI_API_KEY not configured, falling back to permissive moderation');
      return { decision: 'APPROVED', provider: 'gemini-fallback', labels: [] };
    }

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `Analyze this review for a venue. Return ONLY a JSON object with this exact structure: {"decision": "APPROVED" | "FLAGGED", "labels": string[]}. Flag it if it contains harassment, spam, hate speech, illegal acts, or extreme profanity. The review text is: "${text}"`,
                  },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: 'application/json',
            },
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.statusText}`);
      }

      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!rawText) throw new Error('No content returned from Gemini');

      const result = JSON.parse(rawText) as { decision: string; labels?: string[] };
      
      return {
        decision: result.decision === 'FLAGGED' ? 'FLAGGED' : 'APPROVED',
        labels: result.labels ?? [],
        provider: 'gemini-1.5-flash',
      };
    } catch (error: any) {
      this.logger.error(`AI Moderation failed: ${error.message}`);
      // Fail open for user experience, but flag defensively if preferred.
      // We will fail open (APPROVED) so users aren't blocked by API outages, 
      // but rely on community moderation as a fallback.
      return { decision: 'APPROVED', provider: 'gemini-error', labels: ['system_error'] };
    }
  }
}
