import { Module } from '@nestjs/common';
import { ReceiveService } from './receive.service';
import { ReceiveController } from './receive.controller';
import { MockBaasProvider } from './mock-baas.provider';
import { LedgerModule } from '../ledger/ledger.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ComplianceModule } from '../compliance/compliance.module';

@Module({
  imports: [LedgerModule, NotificationsModule, ComplianceModule],
  providers: [ReceiveService, MockBaasProvider],
  controllers: [ReceiveController],
  exports: [ReceiveService],
})
export class ReceiveModule {}
