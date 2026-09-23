import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ComplianceService } from './compliance.service';
import { AmlMonitorService } from './aml-monitor.service';
import { VelocityService } from './velocity.service';
import { DisputeService } from './dispute.service';
import { RetentionService } from './retention.service';
import { MockSanctionsProvider } from './mock-sanctions.provider';
import { HttpSanctionsProvider } from './http-sanctions.provider';
import { SANCTIONS_PROVIDER } from './sanctions.interface';
import { ComplianceController } from './compliance.controller';
import { ComplianceAdminController } from './compliance-admin.controller';
import { LedgerModule } from '../ledger/ledger.module';
import type { Env } from '../../config/env.validation';
import type { SanctionsProvider } from './sanctions.interface';
import { AdminGuard } from '../../common/guards/admin.guard';

@Module({
  imports: [LedgerModule],
  providers: [
    ComplianceService,
    AmlMonitorService,
    VelocityService,
    DisputeService,
    RetentionService,
    MockSanctionsProvider,
    HttpSanctionsProvider,
    AdminGuard,
    {
      provide: SANCTIONS_PROVIDER,
      inject: [ConfigService, MockSanctionsProvider, HttpSanctionsProvider],
      useFactory: (
        config: ConfigService<Env, true>,
        mock: MockSanctionsProvider,
        http: HttpSanctionsProvider,
      ): SanctionsProvider => {
        const mode = config.get('SANCTIONS_MODE', { infer: true });
        if (mode === 'http') return http;
        if (mode === 'off') {
          return {
            checkName: () =>
              Promise.resolve({
                cleared: true,
                score: 0,
                provider: 'off',
              }),
          };
        }
        return mock;
      },
    },
  ],
  controllers: [ComplianceController, ComplianceAdminController],
  exports: [
    ComplianceService,
    AmlMonitorService,
    VelocityService,
    DisputeService,
    RetentionService,
  ],
})
export class ComplianceModule {}
