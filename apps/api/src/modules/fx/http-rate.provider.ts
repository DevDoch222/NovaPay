import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS } from '../../redis/redis.module';
import type { Env } from '../../config/env.validation';
import type { FxRateProvider } from './rate-provider.interface';
import { StaticFxRateProvider } from './static-rate.provider';

type UsdBook = { NGN: number; EUR: number; fetchedAt: string };

/**
 * Fetches USD-based mids from a public FX HTTP API (Frankfurter by default),
 * caches in Redis, triangulates pairs, falls back to static env mids.
 */
@Injectable()
export class HttpFxRateProvider implements FxRateProvider {
  readonly name = 'http';
  private readonly logger = new Logger(HttpFxRateProvider.name);

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly staticProvider: StaticFxRateProvider,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async getMidRate(source: string, dest: string): Promise<number> {
    try {
      const book = await this.loadUsdBook();
      const usdOf = this.usdPerUnit(source, book);
      const usdOfDest = this.usdPerUnit(dest, book);
      if (usdOfDest <= 0) throw new Error(`Unsupported FX dest ${dest}`);
      return usdOf / usdOfDest;
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      this.logger.warn(`HTTP FX failed (${detail}) — using static mids`);
      return this.staticProvider.getMidRate(source, dest);
    }
  }

  private usdPerUnit(currency: string, book: UsdBook): number {
    switch (currency) {
      case 'USD':
        return 1;
      case 'NGN':
        return 1 / book.NGN;
      case 'EUR':
        return 1 / book.EUR;
      default:
        throw new Error(`Unsupported FX currency ${currency}`);
    }
  }

  private async loadUsdBook(): Promise<UsdBook> {
    const ttl = this.config.get('FX_RATE_CACHE_TTL_SECONDS', { infer: true });
    const cacheKey = 'fx:usd_book:v1';
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as UsdBook;
    }

    const url =
      this.config.get('FX_HTTP_URL', { infer: true }) ||
      'https://api.frankfurter.app/latest?from=USD&to=NGN,EUR';

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const json = (await res.json()) as {
        rates?: { NGN?: number; EUR?: number };
      };
      const ngn = Number(json.rates?.NGN);
      const eur = Number(json.rates?.EUR);
      if (
        !Number.isFinite(ngn) ||
        ngn <= 0 ||
        !Number.isFinite(eur) ||
        eur <= 0
      ) {
        throw new Error('Invalid rates payload');
      }
      const book: UsdBook = {
        NGN: ngn,
        EUR: eur,
        fetchedAt: new Date().toISOString(),
      };
      await this.redis.set(cacheKey, JSON.stringify(book), 'EX', ttl);
      return book;
    } finally {
      clearTimeout(timeout);
    }
  }
}
