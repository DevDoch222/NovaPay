import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.validation';
import type {
  SanctionsCheckResult,
  SanctionsProvider,
} from './sanctions.interface';
import { MockSanctionsProvider } from './mock-sanctions.provider';

/**
 * Optional HTTP sanctions screening. Falls back to mock if API fails
 * (fail-open with elevated score for manual review).
 */
@Injectable()
export class HttpSanctionsProvider implements SanctionsProvider {
  private readonly logger = new Logger(HttpSanctionsProvider.name);

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly fallback: MockSanctionsProvider,
  ) {}

  async checkName(
    name: string,
    country?: string,
  ): Promise<SanctionsCheckResult> {
    const url = this.config.get('SANCTIONS_API_URL', { infer: true });
    const apiKey = this.config.get('SANCTIONS_API_KEY', { infer: true });
    if (!url) {
      return this.fallback.checkName(name, country);
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8_000);
      try {
        const res = await fetch(url, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          },
          body: JSON.stringify({ name, country }),
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const json = (await res.json()) as {
          score?: number;
          cleared?: boolean;
          matchDetails?: string;
        };
        const score = Number(json.score ?? 0);
        return {
          cleared:
            typeof json.cleared === 'boolean' ? json.cleared : score < 0.8,
          score,
          matchDetails: json.matchDetails,
          provider: 'http',
        };
      } finally {
        clearTimeout(timer);
      }
    } catch (err) {
      this.logger.warn(
        `Sanctions HTTP failed (${err instanceof Error ? err.message : String(err)}) — using mock fallback`,
      );
      const mock = await this.fallback.checkName(name, country);
      return { ...mock, provider: 'http-fallback-mock', score: Math.max(mock.score, 0.5) };
    }
  }
}
