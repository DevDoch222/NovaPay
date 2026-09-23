import {
  CallHandler,
  ConflictException,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import Redis from 'ioredis';
import { Observable, from, of, throwError } from 'rxjs';
import { catchError, mergeMap } from 'rxjs/operators';
import { REDIS } from '../../redis/redis.module';
import { IS_PUBLIC_KEY } from '../decorators';
import type { Env } from '../../config/env.validation';

export const IDEMPOTENCY_HEADER = 'idempotency-key';
export const IDEMPOTENCY_LOCK_PREFIX = 'idem:lock:';
export const IDEMPOTENCY_RESULT_PREFIX = 'idem:result:';

type CachedResult = {
  statusCode: number;
  body: unknown;
};

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    private readonly config: ConfigService<Env, true>,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();

    if (req.method !== 'POST') {
      return next.handle();
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return next.handle();
    }

    const key = this.readKey(req);
    if (!key) {
      return next.handle();
    }

    const scope = this.scopeKey(req, key);
    const ttl = this.config.get('IDEMPOTENCY_TTL_SECONDS', { infer: true });

    return from(this.resolve(scope, ttl)).pipe(
      mergeMap((cached) => {
        if (cached === 'in_progress') {
          throw new ConflictException({
            message: 'Idempotent request already in progress',
            code: 'IDEMPOTENCY_IN_PROGRESS',
          });
        }
        if (cached) {
          res.status(cached.statusCode);
          return of(cached.body);
        }

        return next.handle().pipe(
          mergeMap((body) =>
            from(this.storeResult(scope, res.statusCode, body, ttl)).pipe(
              mergeMap(() => of(body)),
            ),
          ),
          catchError((err: unknown) =>
            from(this.redis.del(`${IDEMPOTENCY_LOCK_PREFIX}${scope}`)).pipe(
              mergeMap((): Observable<never> => throwError(() => err)),
            ),
          ),
        );
      }),
    );
  }

  private readKey(req: Request): string | null {
    const header = req.headers[IDEMPOTENCY_HEADER];
    if (typeof header === 'string' && header.trim().length >= 8) {
      return header.trim();
    }
    return null;
  }

  private scopeKey(req: Request, key: string): string {
    const user = (req as Request & { user?: { userId?: string } }).user;
    const userId = user?.userId ?? 'anonymous';
    return `${userId}:${req.method}:${req.path}:${key}`;
  }

  private async resolve(
    scope: string,
    ttl: number,
  ): Promise<CachedResult | 'in_progress' | null> {
    const resultKey = `${IDEMPOTENCY_RESULT_PREFIX}${scope}`;
    const cached = await this.redis.get(resultKey);
    if (cached) {
      return JSON.parse(cached) as CachedResult;
    }

    const lockKey = `${IDEMPOTENCY_LOCK_PREFIX}${scope}`;
    const acquired = await this.redis.set(lockKey, '1', 'EX', ttl, 'NX');
    if (!acquired) {
      const retry = await this.redis.get(resultKey);
      if (retry) return JSON.parse(retry) as CachedResult;
      return 'in_progress';
    }

    return null;
  }

  private async storeResult(
    scope: string,
    statusCode: number,
    body: unknown,
    ttl: number,
  ) {
    const payload: CachedResult = { statusCode, body };
    await this.redis.set(
      `${IDEMPOTENCY_RESULT_PREFIX}${scope}`,
      JSON.stringify(payload),
      'EX',
      ttl,
    );
    await this.redis.del(`${IDEMPOTENCY_LOCK_PREFIX}${scope}`);
  }
}
