import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/platform/prisma/prisma.service';
import { DEFAULT_SCORING_CONFIG, ScoringConfig } from './scoring-config';

interface RuntimeConfig {
  scoring: ScoringConfig;
}

/**
 * Loads runtime-tunable configuration (scoring weights, thresholds) from the
 * `app_config` singleton row, cached in memory. Falls back to defaults so the
 * service boots even before the row is seeded (Phase 3 §11 — config over code).
 */
@Injectable()
export class AppConfigService {
  private readonly logger = new Logger(AppConfigService.name);
  private cache: RuntimeConfig = { scoring: DEFAULT_SCORING_CONFIG };

  constructor(private readonly prisma: PrismaService) {}

  async refresh(): Promise<void> {
    try {
      const row = await this.prisma.appConfig.findUnique({ where: { id: 1 } });
      if (row?.config) {
        const parsed = row.config as Partial<RuntimeConfig>;
        this.cache = {
          scoring: { ...DEFAULT_SCORING_CONFIG, ...(parsed.scoring ?? {}) },
        };
      }
    } catch (err) {
      this.logger.warn(`Falling back to default config: ${(err as Error).message}`);
    }
  }

  getScoringConfig(): ScoringConfig {
    return this.cache.scoring;
  }
}
