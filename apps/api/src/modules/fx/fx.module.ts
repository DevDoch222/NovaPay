import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FxService } from './fx.service';
import { FxController } from './fx.controller';
import { LedgerModule } from '../ledger/ledger.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StaticFxRateProvider } from './static-rate.provider';
import { HttpFxRateProvider } from './http-rate.provider';
import { FX_RATE_PROVIDER } from './rate-provider.interface';
import type { Env } from '../../config/env.validation';

@Module({
  imports: [LedgerModule, NotificationsModule],
  providers: [
    FxService,
    StaticFxRateProvider,
    HttpFxRateProvider,
    {
      provide: FX_RATE_PROVIDER,
      inject: [ConfigService, StaticFxRateProvider, HttpFxRateProvider],
      useFactory: (
        config: ConfigService<Env, true>,
        staticProvider: StaticFxRateProvider,
        httpProvider: HttpFxRateProvider,
      ) => {
        const mode = config.get('FX_RATE_MODE', { infer: true }) || 'static';
        if (mode === 'http') return httpProvider;
        if (mode === 'auto') {
          const url = config.get('FX_HTTP_URL', { infer: true });
          return url ? httpProvider : staticProvider;
        }
        return staticProvider;
      },
    },
  ],
  controllers: [FxController],
  exports: [FxService],
})
export class FxModule {}
