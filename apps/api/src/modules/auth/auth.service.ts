import {
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { and, eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import type Redis from 'ioredis';
import { DRIZZLE, type Database } from '../../database/database.module';
import { kycRecords, users } from '../../database/schema';
import { REDIS } from '../../redis/redis.module';
import { NotificationsService } from '../notifications/notifications.service';
import { WalletsService } from '../ledger/wallets.service';
import {
  MVP_CURRENCY,
  USD_CURRENCY,
  EUR_CURRENCY,
  type KycTier,
} from '../../common/constants';
import type { Env } from '../../config/env.validation';
import type { SubmitKycDto, UpdateProfileDto } from './dto';
import { VelocityService } from '../compliance/velocity.service';
import {
  generateOtpCode,
  hashOtp,
  safeEqualHex,
  ttlToSeconds,
} from './auth.crypto';

@Injectable()
export class AuthService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
    private readonly notifications: NotificationsService,
    private readonly wallets: WalletsService,
    private readonly velocity: VelocityService,
  ) {}

  private otpPepper() {
    return this.config.get('OTP_PEPPER', { infer: true });
  }

  private isProdLike() {
    const env = this.config.get('NODE_ENV', { infer: true });
    return env === 'production' || env === 'staging';
  }

  /** Local sandbox only: OTP_DEV_FIXED_CODE + SMS_OTP_MODE=log */
  private allowDevFixedOtp() {
    const fixed = this.config.get('OTP_DEV_FIXED_CODE', { infer: true });
    const smsMode = this.config.get('SMS_OTP_MODE', { infer: true });
    return (
      Boolean(fixed) && smsMode === 'log' && !this.isProdLike()
    );
  }

  private devFixedCode() {
    return this.config.get('OTP_DEV_FIXED_CODE', { infer: true }) ?? '';
  }

  async requestOtp(phone: string) {
    phone = phone.trim();
    await this.velocity.checkOtp(phone);

    const lockTtl = await this.redis.ttl(`otp:lock:${phone}`);
    if (lockTtl > 0) {
      if (this.allowDevFixedOtp()) {
        await this.redis.del(
          `otp:lock:${phone}`,
          `otp:attempts:${phone}`,
          `otp:hash:${phone}`,
        );
      } else {
        throw new ForbiddenException(
          `Too many failed attempts. Try again in ${lockTtl}s`,
        );
      }
    }

    const fixed = this.devFixedCode();
    const allowFixed = this.allowDevFixedOtp();

    const code = allowFixed ? fixed! : generateOtpCode();
    const digest = hashOtp(this.otpPepper(), phone, code);

    await this.redis.set(`otp:hash:${phone}`, digest, 'EX', 300);
    await this.redis.del(`otp:attempts:${phone}`);

    await this.notifications.sendOtp(phone, code);

    return {
      phone,
      expiresInSeconds: 300,
      ...(allowFixed ? { devCode: code } : {}),
    };
  }

  async verifyOtp(phone: string, code: string) {
    phone = phone.trim();
    code = code.trim();

    const allowFixed = this.allowDevFixedOtp();
    const fixed = this.devFixedCode();

    const lockTtl = await this.redis.ttl(`otp:lock:${phone}`);
    if (lockTtl > 0) {
      if (allowFixed && code === fixed) {
        await this.redis.del(
          `otp:lock:${phone}`,
          `otp:attempts:${phone}`,
          `otp:hash:${phone}`,
        );
      } else {
        throw new ForbiddenException(
          `Too many failed attempts. Try again in ${lockTtl}s`,
        );
      }
    }

    const stored = await this.redis.get(`otp:hash:${phone}`);
    const digest = hashOtp(this.otpPepper(), phone, code);
    const devFixedOk = allowFixed && code === fixed;
    const hashOk = stored ? safeEqualHex(stored, digest) : false;

    if (!hashOk && !devFixedOk) {
      if (!stored && !allowFixed) {
        throw new UnauthorizedException('Invalid or expired OTP');
      }
      const max = this.config.get('OTP_MAX_ATTEMPTS', { infer: true });
      const attempts = await this.redis.incr(`otp:attempts:${phone}`);
      await this.redis.expire(`otp:attempts:${phone}`, 300);
      if (attempts >= max) {
        const lockSeconds = this.config.get('OTP_LOCKOUT_SECONDS', {
          infer: true,
        });
        await this.redis.set(
          `otp:lock:${phone}`,
          '1',
          'EX',
          lockSeconds,
        );
        await this.redis.del(`otp:hash:${phone}`, `otp:attempts:${phone}`);
        throw new ForbiddenException(
          `Too many failed attempts. Try again in ${lockSeconds}s`,
        );
      }
      throw new UnauthorizedException(
        stored
          ? 'Invalid or expired OTP'
          : 'Request a new OTP first, then enter the code',
      );
    }

    await this.redis.del(
      `otp:hash:${phone}`,
      `otp:attempts:${phone}`,
      `otp:lock:${phone}`,
    );

    let user = await this.db.query.users.findFirst({
      where: eq(users.phone, phone),
    });

    if (!user) {
      const tag = await this.allocateTag(phone);
      const [created] = await this.db
        .insert(users)
        .values({
          phone,
          tag,
          status: 'active',
          kycTier: 'tier_0',
        })
        .returning();
      user = created;
      await this.wallets.ensureUserWallet(user.id, MVP_CURRENCY);
      await this.wallets.ensureUserWallet(user.id, USD_CURRENCY);
      await this.wallets.ensureUserWallet(user.id, EUR_CURRENCY);
    } else if (user.status === 'suspended' || user.status === 'closed') {
      throw new UnauthorizedException('Account is not active');
    } else {
      await this.wallets.ensureUserWallet(user.id, MVP_CURRENCY);
      await this.wallets.ensureUserWallet(user.id, USD_CURRENCY);
      await this.wallets.ensureUserWallet(user.id, EUR_CURRENCY);
    }

    return this.issueTokens(user);
  }

  async refresh(refreshToken: string) {
    try {
      const payload = await this.jwt.verifyAsync<{
        sub: string;
        typ?: string;
        jti?: string;
      }>(refreshToken, {
        secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
      });
      if (payload.typ !== 'refresh' || !payload.jti) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const key = `refresh:${payload.jti}`;
      const storedUserId = await this.redis.get(key);
      if (!storedUserId || storedUserId !== payload.sub) {
        throw new UnauthorizedException('Refresh token revoked or expired');
      }

      // Rotate: invalidate current refresh before issuing new pair
      await this.redis.del(key);
      await this.redis.srem(`refresh:user:${payload.sub}`, payload.jti);

      const user = await this.db.query.users.findFirst({
        where: eq(users.id, payload.sub),
      });
      if (!user || user.status !== 'active') {
        throw new UnauthorizedException('User not found');
      }
      return this.issueTokens(user);
    } catch (err) {
      if (
        err instanceof UnauthorizedException ||
        err instanceof ForbiddenException
      ) {
        throw err;
      }
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(refreshToken: string | undefined, userId?: string) {
    if (refreshToken) {
      try {
        const payload = await this.jwt.verifyAsync<{
          sub: string;
          jti?: string;
          typ?: string;
        }>(refreshToken, {
          secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
        });
        if (payload.jti) {
          await this.redis.del(`refresh:${payload.jti}`);
          await this.redis.srem(`refresh:user:${payload.sub}`, payload.jti);
        }
      } catch {
        /* already invalid */
      }
    }
    if (userId) {
      await this.revokeAllRefreshTokens(userId);
    }
    return { ok: true };
  }

  async revokeAllRefreshTokens(userId: string) {
    const jtis = await this.redis.smembers(`refresh:user:${userId}`);
    if (jtis.length) {
      const pipeline = this.redis.pipeline();
      for (const jti of jtis) {
        pipeline.del(`refresh:${jti}`);
      }
      pipeline.del(`refresh:user:${userId}`);
      await pipeline.exec();
    }
  }

  /** Step-up OTP for high-risk actions (large payouts). */
  async requestStepUp(userId: string) {
    const user = await this.db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    if (!user) throw new UnauthorizedException();

    await this.velocity.checkOtp(user.phone);
    const code = generateOtpCode();
    const digest = hashOtp(this.otpPepper(), user.phone, code);
    await this.redis.set(`otp:stepup:hash:${userId}`, digest, 'EX', 300);
    await this.notifications.sendOtp(user.phone, code);

    const smsMode = this.config.get('SMS_OTP_MODE', { infer: true });
    return {
      expiresInSeconds: 300,
      ...(smsMode === 'log' && !this.isProdLike() ? { devCode: code } : {}),
    };
  }

  async verifyStepUp(userId: string, code: string) {
    const user = await this.db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    if (!user) throw new UnauthorizedException();

    const stored = await this.redis.get(`otp:stepup:hash:${userId}`);
    if (!stored) {
      throw new UnauthorizedException('Invalid or expired step-up OTP');
    }
    const digest = hashOtp(this.otpPepper(), user.phone, code);
    if (!safeEqualHex(stored, digest)) {
      throw new UnauthorizedException('Invalid or expired step-up OTP');
    }
    await this.redis.del(`otp:stepup:hash:${userId}`);
    const ttl = this.config.get('AUTH_STEPUP_TTL_SECONDS', { infer: true });
    await this.redis.set(`stepup:${userId}`, '1', 'EX', ttl);
    return { ok: true, expiresInSeconds: ttl };
  }

  async assertStepUp(userId: string) {
    const ok = await this.redis.get(`stepup:${userId}`);
    if (!ok) {
      throw new ForbiddenException(
        'Step-up verification required. Complete /v1/auth/step-up first.',
      );
    }
  }

  async me(userId: string) {
    const user = await this.db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    if (!user) throw new UnauthorizedException();
    return this.serializeUser(user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const existing = await this.db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    if (!existing) throw new UnauthorizedException();

    const patch: Partial<typeof users.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (dto.tag !== undefined) {
      const tag = dto.tag.toLowerCase();
      if (tag !== existing.tag) {
        const clash = await this.db.query.users.findFirst({
          where: eq(users.tag, tag),
        });
        if (clash) {
          throw new BadRequestException('That username is already taken');
        }
        patch.tag = tag;
      }
    }

    if (dto.avatarUrl !== undefined) {
      if (dto.avatarUrl === null || dto.avatarUrl === '') {
        patch.avatarUrl = null;
      } else {
        this.assertAvatar(dto.avatarUrl);
        patch.avatarUrl = dto.avatarUrl;
      }
    }

    if (Object.keys(patch).length <= 1) {
      return this.serializeUser(existing);
    }

    const [updated] = await this.db
      .update(users)
      .set(patch)
      .where(eq(users.id, userId))
      .returning();

    return this.serializeUser(updated);
  }

  async submitKyc(userId: string, dto: SubmitKycDto) {
    const user = await this.db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    if (!user) throw new BadRequestException('User not found');
    if (user.kycTier !== 'tier_0') {
      throw new BadRequestException('Account is already verified');
    }

    const existingPending = await this.db.query.kycRecords.findFirst({
      where: and(
        eq(kycRecords.userId, userId),
        eq(kycRecords.verificationStatus, 'pending'),
      ),
    });
    if (existingPending) {
      throw new BadRequestException(
        'KYC already submitted and awaiting review',
      );
    }

    const autoApprove =
      this.config.get('KYC_AUTO_APPROVE', { infer: true }) === 'true' &&
      !this.isProdLike();

    const [record] = await this.db
      .insert(kycRecords)
      .values({
        userId,
        documentType: dto.documentType,
        documentNumber: dto.documentNumber,
        verificationStatus: autoApprove ? 'approved' : 'pending',
        providerRef: autoApprove
          ? `mock_${Date.now()}`
          : `manual_${Date.now()}`,
        metadata: {
          fullName: dto.fullName ?? null,
          provider: autoApprove ? 'mock' : 'manual_review',
        },
      })
      .returning();

    if (autoApprove) {
      await this.db
        .update(users)
        .set({ kycTier: 'tier_1', updatedAt: new Date() })
        .where(eq(users.id, userId));
    }

    return {
      id: record.id,
      status: record.verificationStatus,
      kycTier: autoApprove ? ('tier_1' as KycTier) : undefined,
      message: autoApprove
        ? 'KYC auto-approved (sandbox)'
        : 'KYC submitted for review. Limits unlock after ops approval.',
    };
  }

  private async issueTokens(user: typeof users.$inferSelect) {
    const accessToken = await this.jwt.signAsync(
      {
        sub: user.id,
        phone: user.phone,
        kycTier: user.kycTier,
        platformRole: user.platformRole ?? 'customer',
        typ: 'access',
      },
      {
        secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
        expiresIn: this.config.get('JWT_ACCESS_TTL', {
          infer: true,
        }),
      },
    );

    const jti = randomUUID();
    const refreshTtl = this.config.get('JWT_REFRESH_TTL', { infer: true });
    const refreshSeconds = ttlToSeconds(refreshTtl, 30 * 86400);

    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, typ: 'refresh', jti },
      {
        secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
        expiresIn: refreshSeconds,
      },
    );

    await this.redis.set(`refresh:${jti}`, user.id, 'EX', refreshSeconds);
    await this.redis.sadd(`refresh:user:${user.id}`, jti);
    await this.redis.expire(`refresh:user:${user.id}`, refreshSeconds);

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      user: this.serializeUser(user),
    };
  }

  private serializeUser(user: typeof users.$inferSelect) {
    return {
      id: user.id,
      phone: user.phone,
      email: user.email,
      tag: user.tag,
      avatarUrl: user.avatarUrl ?? null,
      status: user.status,
      kycTier: user.kycTier,
      platformRole: user.platformRole ?? 'customer',
      createdAt: user.createdAt,
    };
  }

  private assertAvatar(avatarUrl: string) {
    const okHttp = /^https:\/\//i.test(avatarUrl);
    const okData = /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(avatarUrl);
    if (!okHttp && !okData) {
      throw new BadRequestException(
        'avatarUrl must be an https image URL or a data:image JPEG/PNG/WebP',
      );
    }
    if (avatarUrl.length > 400_000) {
      throw new BadRequestException('Profile photo is too large (max ~300KB)');
    }
  }

  private async allocateTag(phone: string) {
    const suffix = phone.slice(-4);
    const base = `nova${suffix}`;
    let candidate = base;
    let i = 0;
    while (i < 20) {
      const clash = await this.db.query.users.findFirst({
        where: eq(users.tag, candidate),
      });
      if (!clash) return candidate;
      i += 1;
      candidate = `${base}${i}`;
    }
    throw new BadRequestException('Could not allocate user tag');
  }
}
