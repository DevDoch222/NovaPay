import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import { IS_PUBLIC_KEY, type AuthUser } from '../decorators';
import type { Env } from '../../config/env.validation';
import { PublicApiService } from '../../modules/public-api/public-api.service';
import { eq } from 'drizzle-orm';
import { users } from '../../database/schema';
import { DRIZZLE, type Database } from '../../database/database.module';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    private readonly config: ConfigService<Env, true>,
    private readonly moduleRef: ModuleRef,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: AuthUser;
    }>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const token = header.slice('Bearer '.length).trim();

    if (token.startsWith('np_test_') || token.startsWith('np_live_')) {
      return this.authenticateApiKey(token, request);
    }

    try {
      const payload = this.jwt.verify<{
        sub: string;
        phone: string;
        kycTier: string;
        platformRole?: string;
        typ?: string;
      }>(token, {
        secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
      });
      if (payload.typ && payload.typ !== 'access') {
        throw new UnauthorizedException('Invalid token type');
      }
      request.user = {
        userId: payload.sub,
        phone: payload.phone,
        kycTier: payload.kycTier,
        platformRole:
          payload.platformRole === 'admin' ||
          payload.platformRole === 'support'
            ? payload.platformRole
            : 'customer',
        authType: 'jwt',
      };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private async authenticateApiKey(
    token: string,
    request: { user?: AuthUser },
  ): Promise<boolean> {
    try {
      const api = this.moduleRef.get(PublicApiService, { strict: false });
      const key = await api.resolveApiKey(token);
      const db = this.moduleRef.get<Database>(DRIZZLE, { strict: false });
      const user = await db.query.users.findFirst({
        where: eq(users.id, key.userId!),
      });
      if (!user) throw new UnauthorizedException('User not found');
      request.user = {
        userId: user.id,
        phone: user.phone,
        kycTier: user.kycTier,
        platformRole:
          user.platformRole === 'admin' || user.platformRole === 'support'
            ? user.platformRole
            : 'customer',
        authType: 'api_key',
        apiKeyId: key.id,
        scopes: key.scopes ?? [],
        organizationId: key.organizationId ?? undefined,
      };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid API key');
    }
  }
}
