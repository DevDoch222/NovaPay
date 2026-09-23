import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS } from '../../redis/redis.module';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.validation';

@Injectable()
export class VelocityService {
  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async assertWithinLimit(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<void> {
    const now = Date.now();
    const clearBefore = now - windowSeconds * 1000;
    const member = `${now}-${Math.random().toString(36).slice(2)}`;

    const pipeline = this.redis.multi();
    pipeline.zremrangebyscore(key, 0, clearBefore);
    pipeline.zadd(key, now, member);
    pipeline.zcard(key);
    pipeline.expire(key, windowSeconds);
    const results = await pipeline.exec();
    const count = Number(results?.[2]?.[1] ?? 0);
    if (count > limit) {
      throw new ForbiddenException(
        'Velocity limit exceeded — try again later',
      );
    }
  }

  checkOtp(phone: string) {
    const limit = this.config.get('AML_VELOCITY_OTP_LIMIT', { infer: true });
    const window = this.config.get('AML_VELOCITY_OTP_WINDOW', { infer: true });
    return this.assertWithinLimit(`vel:otp:${phone}`, limit, window);
  }

  checkPayout(userId: string) {
    const limit = this.config.get('AML_VELOCITY_PAYOUT_LIMIT', { infer: true });
    const window = this.config.get('AML_VELOCITY_PAYOUT_WINDOW', {
      infer: true,
    });
    return this.assertWithinLimit(`vel:payout:${userId}`, limit, window);
  }

  checkCardAuth(userId: string) {
    const limit = this.config.get('AML_VELOCITY_CARD_LIMIT', { infer: true });
    const window = this.config.get('AML_VELOCITY_CARD_WINDOW', { infer: true });
    return this.assertWithinLimit(`vel:card:${userId}`, limit, window);
  }
}
