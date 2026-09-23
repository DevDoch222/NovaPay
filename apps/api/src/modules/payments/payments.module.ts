import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { MockPaymentRailProvider } from './rails/mock-payment-rail.provider';
import { FlutterwavePaymentRailProvider } from './rails/flutterwave-payment-rail.provider';
import { FlutterwaveClient } from './rails/flutterwave.client';
import { PAYMENT_RAIL } from './rails/payment-rail.interface';
import { LedgerModule } from '../ledger/ledger.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ComplianceModule } from '../compliance/compliance.module';
import { FeesModule } from '../fees/fees.module';
import { AuthModule } from '../auth/auth.module';
import type { Env } from '../../config/env.validation';

@Module({
  imports: [
    LedgerModule,
    NotificationsModule,
    ComplianceModule,
    FeesModule,
    AuthModule,
  ],
  providers: [
    PaymentsService,
    MockPaymentRailProvider,
    FlutterwavePaymentRailProvider,
    FlutterwaveClient,
    {
      provide: PAYMENT_RAIL,
      inject: [
        ConfigService,
        MockPaymentRailProvider,
        FlutterwavePaymentRailProvider,
        FlutterwaveClient,
      ],
      useFactory: (
        config: ConfigService<Env, true>,
        mock: MockPaymentRailProvider,
        flutterwave: FlutterwavePaymentRailProvider,
        flwClient: FlutterwaveClient,
      ) => {
        const mode = config.get('PAYMENT_RAIL', { infer: true });
        if (mode === 'mock') return mock;
        if (mode === 'flutterwave') return flutterwave;
        // auto
        return flwClient.isConfigured() ? flutterwave : mock;
      },
    },
  ],
  controllers: [PaymentsController],
})
export class PaymentsModule {}
