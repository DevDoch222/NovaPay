import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { LedgerModule } from './modules/ledger/ledger.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { FxModule } from './modules/fx/fx.module';
import { CardsModule } from './modules/cards/cards.module';
import { ReceiveModule } from './modules/receive/receive.module';
import { BillsModule } from './modules/bills/bills.module';
import { BusinessModule } from './modules/business/business.module';
import { StablecoinsModule } from './modules/stablecoins/stablecoins.module';
import { PublicApiModule } from './modules/public-api/public-api.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ComplianceModule } from './modules/compliance/compliance.module';
import { FeesModule } from './modules/fees/fees.module';
import { ReconciliationModule } from './modules/reconciliation/reconciliation.module';
import { AdminModule } from './modules/admin/admin.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { IdempotencyInterceptor } from './common/interceptors/idempotency.interceptor';
import type { Env } from './config/env.validation';

@Module({
  imports: [
    AppConfigModule,
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => [
        {
          ttl: config.get('THROTTLE_TTL_MS', { infer: true }),
          limit: config.get('THROTTLE_LIMIT', { infer: true }),
        },
      ],
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const isDev = config.get('NODE_ENV', { infer: true }) === 'development';
        return {
          pinoHttp: {
            level: config.get('LOG_LEVEL', { infer: true }),
            transport: isDev
              ? { target: 'pino-pretty', options: { singleLine: true } }
              : undefined,
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'res.headers["set-cookie"]',
              ],
              remove: true,
            },
          },
        };
      },
    }),
    DatabaseModule,
    RedisModule,
    HealthModule,
    AuthModule,
    LedgerModule,
    PaymentsModule,
    FxModule,
    CardsModule,
    ReceiveModule,
    BillsModule,
    BusinessModule,
    StablecoinsModule,
    PublicApiModule,
    NotificationsModule,
    ComplianceModule,
    FeesModule,
    ReconciliationModule,
    AdminModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: IdempotencyInterceptor,
    },
  ],
})
export class AppModule {}
