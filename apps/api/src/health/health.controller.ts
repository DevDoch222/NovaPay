import { Controller, Get, Inject } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import {
  HealthCheck,
  HealthCheckService,
  type HealthIndicatorResult,
} from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../database/database.module';
import { REDIS } from '../redis/redis.module';
import type { Env } from '../config/env.validation';
import { Public } from '../common/decorators';

@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly config: ConfigService<Env, true>,
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  @Public()
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      async (): Promise<HealthIndicatorResult> => {
        await this.db.execute(sql`select 1`);
        return { database: { status: 'up' } };
      },
      async (): Promise<HealthIndicatorResult> => {
        const pong = await this.redis.ping();
        return { redis: { status: pong === 'PONG' ? 'up' : 'down' } };
      },
      (): Promise<HealthIndicatorResult> =>
        Promise.resolve({
          app: {
            status: 'up',
            name: this.config.get('APP_NAME', { infer: true }),
            env: this.config.get('NODE_ENV', { infer: true }),
            phase: '7',
          },
        }),
    ]);
  }

  @Public()
  @Get('live')
  live() {
    return { status: 'ok', phase: 7 };
  }
}
